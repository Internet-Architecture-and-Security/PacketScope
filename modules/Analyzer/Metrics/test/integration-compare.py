#!/usr/bin/env python3
"""
集成对比测试脚本：并行对比 Calculator (旧) 与 Metrics (新) 的 WebSocket 行为

用法：
  # 1. 确保两个服务分别在端口 8020（旧） 和 8021（新）运行：
  #    旧: cd modules/Analyzer/Calculator && sudo python3 monitor.py
  #    新: cd modules/Analyzer/Metrics  && sudo METRICS_PORT=8021 ./bin/metrics

  # 2. 运行本脚本（自动发现真实五元组并对比）
  python3 test/integration-compare.py

  # 3. 可选参数
  python3 test/integration-compare.py --old-url ws://localhost:8020 --new-url ws://localhost:8021
  python3 test/integration-compare.py --sip 192.168.1.1 --dip 10.0.0.1 --sport 0 --dport 443 --protocol tcp
  python3 test/integration-compare.py --collect-secs 8  # 每个五元组收集更长时间
  python3 test/integration-compare.py --no-protocol-tests  # 只跑真实流量对比
"""

import json
import re
import sys
import time
import shlex
import argparse
import threading
import subprocess
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple

try:
    import websocket
except ImportError:
    print("FATAL: websocket-client not installed, run: pip3 install websocket-client")
    sys.exit(1)

# ─────────────────── ANSI Colors ───────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
MAGENTA = "\033[95m"
DIM    = "\033[2m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def ok(msg):      print(f"  {GREEN}✓{RESET} {msg}")
def fail(msg):    print(f"  {RED}✗{RESET} {msg}")
def warn(msg):    print(f"  {YELLOW}!{RESET} {msg}")
def info(msg):    print(f"  {CYAN}→{RESET} {msg}")
def header(msg):  print(f"\n{BOLD}{msg}{RESET}")

# ─────────────────── Collector ───────────────────
@dataclass
# ─────────────────── Real Connection Discovery ───────────────────

@dataclass
class FiveTuple:
    sip: str
    dip: str
    sport: int
    dport: int
    protocol: str = "tcp"
    label: str = ""

    def to_params(self) -> dict:
        # 只要 sip/dip 中有 : 就是 IPv6
        is_v6 = ":" in self.sip or ":" in self.dip
        return {
            "ipv4": not is_v6,
            "ipv6": is_v6,
            "sip":   self.sip,
            "dip":   self.dip,
            "sport": self.sport,
            "dport": self.dport,
            "protocol": self.protocol,
        }

    def display(self) -> str:
        return (f"{self.sip}:{self.sport} → {self.dip}:{self.dport}"
                f"  [{self.protocol.upper()}]"
                + (f"  ({self.label})" if self.label else ""))


def _parse_ss_addr(addr: str) -> Tuple[str, int]:
    """解析 ss 输出中的 addr:port，兼容 IPv4 和 [::1]:port 格式"""
    if addr.startswith("["):
        # IPv6: [fe80::1]:443
        bracket_end = addr.rindex("]")
        ip = addr[1:bracket_end]
        port = int(addr[bracket_end + 2:])
    else:
        parts = addr.rsplit(":", 1)
        ip = parts[0]
        port = int(parts[1]) if len(parts) == 2 else 0
    return ip, port


def discover_real_connections(max_tuples: int = 5,
                               skip_loopback: bool = True) -> List[FiveTuple]:
    """
    从 ss 命令读取当前 ESTABLISHED TCP 连接，返回去重后的 FiveTuple 列表。
    优先选取有外部 IP（非 127.x / ::1）的连接。
    """
    try:
        out = subprocess.check_output(
            ["ss", "-tnp", "state", "established"],
            stderr=subprocess.DEVNULL,
            timeout=5,
        ).decode()
    except Exception as e:
        warn(f"无法运行 ss 命令: {e}")
        return []

    results: List[FiveTuple] = []
    seen: set = set()

    for line in out.splitlines()[1:]:      # 跳过表头
        cols = line.split()
        if len(cols) < 4:
            continue
        local_addr = cols[2]
        peer_addr  = cols[3]

        try:
            sip, sport = _parse_ss_addr(local_addr)
            dip, dport = _parse_ss_addr(peer_addr)
        except (ValueError, IndexError):
            continue

        if skip_loopback:
            if sip.startswith("127.") or sip == "::1":
                continue
            if dip.startswith("127.") or dip == "::1":
                continue

        # 按完整五元组去重（包含端口）
        pair_key = (sip, sport, dip, dport)
        if pair_key in seen:
            continue
        seen.add(pair_key)

        # 提取进程名（第 5 列，若有）
        proc_info = cols[4] if len(cols) > 4 else ""
        proc_match = re.search(r'"([^"]+)"', proc_info)
        label = proc_match.group(1) if proc_match else ""

        results.append(FiveTuple(
            sip=sip, dip=dip,
            sport=sport, dport=dport,   # 使用真实端口，旧 Calculator 需精确匹配
            protocol="tcp",
            label=label,
        ))
        if len(results) >= max_tuples:
            break

    return results

# ─────────────────── Collector ───────────────────
@dataclass
class Capture:
    messages: List[Dict[str, Any]] = field(default_factory=list)
    connect_ok: bool = False
    error: Optional[str] = None
    connect_time_ms: float = 0.0
    first_msg_time_ms: float = 0.0

def collect_ws(url: str, request: dict, capture: Capture,
               timeout: float = 5.0, max_data_frames: int = 2):
    """连接 WebSocket，发送请求，收集 N 秒内的所有消息"""
    t0 = time.monotonic()
    try:
        ws = websocket.create_connection(url, timeout=timeout)
        capture.connect_ok = True
        capture.connect_time_ms = (time.monotonic() - t0) * 1000

        ws.send(json.dumps(request))

        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            # 每次最多等 0.5s，不等到整个 deadline —— 服务每 1s 推一次数据，需 continue 而非 break
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            ws.settimeout(min(0.5, remaining))
            try:
                raw = ws.recv()
            except websocket.WebSocketTimeoutException:
                continue  # 本次 0.5s 内无数据，继续等到 deadline
            except Exception:
                break
            msg = json.loads(raw)
            if not capture.messages:
                capture.first_msg_time_ms = (time.monotonic() - t0) * 1000
            capture.messages.append(msg)
            # 收到足够数据帧后停止（协议测试用 2 帧，真实流量测试用更多）
            data_msgs = [m for m in capture.messages if "data" in m]
            if len(data_msgs) >= max_data_frames:
                break
        ws.close()
    except Exception as e:
        capture.error = str(e)


# ─────────────────── Static Test Requests ───────────────────

VALID_REQUEST = {
    "type": "NumLatencyFrequency",
    "params": {
        "ipv4": True, "ipv6": False,
        "sip": "0.0.0.0", "dip": "0.0.0.0", "sport": 0, "dport": 0, "protocol": "tcp",
    }
}

MISSING_PARAM_REQUEST = {
    "type": "NumLatencyFrequency",
    "params": {"ipv4": True, "ipv6": False},  # 故意缺少 sip/dip/sport/dport/protocol
}

INVALID_TYPE_REQUEST = {"type": "UnknownType", "params": {}}

INVALID_PORT_REQUEST = {
    "type": "NumLatencyFrequency",
    "params": {
        "ipv4": True, "ipv6": False,
        "sip": "0.0.0.0", "dip": "0.0.0.0", "sport": 99999, "dport": 0, "protocol": "tcp",
    }
}

# ─────────────────── Data Printer ───────────────────

# 前端必须有的字段（高亮对比用）
_FRONTEND_REQUIRED = {"layer", "crosslayer", "direction", "type",
                      "num", "pps(s)", "LAT(ms)", "frequency(s)", "drop(s)"}

def _fmt_val(v: Any) -> str:
    if isinstance(v, float):
        return f"{v:.4f}"
    return str(v)

def _col(text: str, width: int) -> str:
    """右补空格到 width，ANSI 不计入宽度"""
    ansi_escape = re.compile(r'\x1b\[[0-9;]*m')
    visible = ansi_escape.sub("", text)
    pad = max(0, width - len(visible))
    return text + " " * pad

def print_data_side_by_side(old_inner_list: List[dict], new_inner_list: List[dict],
                             tuple_label: str = ""):
    """
    把旧/新服务返回的内层数据记录以表格形式侧边打印。
    按 (layer/crosslayer + direction) 对齐行。
    高亮：绿色=值相同，黄色=值不同，红色=某端缺失。
    """
    COL_W = 36  # 每列字符宽度

    def row_key(d: dict) -> str:
        loc = d.get("layer") or d.get("crosslayer") or ("drop" if "drop(s)" in d else "?")
        return f"{loc}|{d.get('direction','')}"

    old_map: Dict[str, dict] = {}
    for d in old_inner_list:
        k = row_key(d)
        old_map.setdefault(k, d)

    new_map: Dict[str, dict] = {}
    for d in new_inner_list:
        k = row_key(d)
        new_map.setdefault(k, d)

    all_keys = list(dict.fromkeys(list(old_map.keys()) + list(new_map.keys())))

    divider = f"  {DIM}{'─'*(COL_W*2+5)}{RESET}"

    print(f"\n  {BOLD}{'五元组: ' + tuple_label if tuple_label else '数据对比'}{RESET}")
    print(f"  {_col(BOLD+'旧 Calculator'+RESET, COL_W+10)}  {BOLD}新 Metrics{RESET}")
    print(divider)

    for key in all_keys:
        old_d = old_map.get(key)
        new_d = new_map.get(key)

        # 收集所有字段
        all_fields = list(dict.fromkeys(
            list(old_d.keys() if old_d else []) +
            list(new_d.keys() if new_d else [])
        ))

        # 行标题
        loc, direction = key.split("|", 1)
        tag = f"{CYAN}{loc}{RESET}/{direction}" if direction else f"{CYAN}{loc}{RESET}"
        if old_d is None:
            tag += f"  {RED}(旧服务无此记录){RESET}"
        if new_d is None:
            tag += f"  {YELLOW}(新服务无此记录){RESET}"
        print(f"  {BOLD}{tag}{RESET}")

        for field_name in all_fields:
            oval = old_d.get(field_name) if old_d else None
            nval = new_d.get(field_name) if new_d else None

            if oval is None and nval is None:
                continue

            oval_s = _fmt_val(oval) if oval is not None else f"{DIM}(无){RESET}"
            nval_s = _fmt_val(nval) if nval is not None else f"{DIM}(无){RESET}"

            is_required = field_name in _FRONTEND_REQUIRED

            if oval is None:
                lhs = f"{DIM}(无){RESET}"
                rhs = f"{YELLOW}{nval_s}{RESET}" if is_required else nval_s
                diff_mark = f"{YELLOW}△{RESET}"
            elif nval is None:
                lhs = f"{RED}{oval_s}{RESET}" if is_required else f"{DIM}{oval_s}{RESET}"
                rhs = f"{RED}(缺失){RESET}" if is_required else f"{DIM}(无){RESET}"
                diff_mark = f"{RED}✗{RESET}" if is_required else f"{DIM}−{RESET}"
            elif str(oval) == str(nval):
                lhs = f"{GREEN}{oval_s}{RESET}"
                rhs = f"{GREEN}{nval_s}{RESET}"
                diff_mark = f"{GREEN}={RESET}"
            else:
                # 仅对测量类字段计算百分比偏差；元数据字段（pid/addr/port/name等）只显示 ≠
                _METRIC_FIELDS = {"num", "pps(s)", "LAT(ms)", "frequency(s)", "drop(s)"}
                if field_name in _METRIC_FIELDS:
                    try:
                        fo, fn = float(oval), float(nval)
                        if fo != 0:
                            pct = abs(fn - fo) / abs(fo) * 100
                            diff_mark = f"{YELLOW}~{pct:.0f}%{RESET}"
                        else:
                            diff_mark = f"{YELLOW}≠{RESET}"
                    except (TypeError, ValueError):
                        diff_mark = f"{YELLOW}≠{RESET}"
                else:
                    diff_mark = f"{YELLOW}≠{RESET}"
                lhs = f"{YELLOW}{oval_s}{RESET}"
                rhs = f"{YELLOW}{nval_s}{RESET}"

            req_mark = f"{MAGENTA}*{RESET}" if is_required else " "
            label_col = f"    {req_mark} {field_name:<18}"
            print(f"{label_col} {_col(lhs, COL_W)} {diff_mark}  {rhs}")

        print(divider)


# ─────────────────── Runner ───────────────────
class CompareRunner:
    def __init__(self, old_url: str, new_url: str,
                 collect_secs: float = 6.0,
                 warmup_secs: float = 0.0,
                 no_filter: bool = False,
                 real_tuples: Optional[List[FiveTuple]] = None):
        self.old_url = old_url
        self.new_url = new_url
        self.collect_secs = collect_secs
        self.warmup_secs = warmup_secs  # 旧服务 BCC 编译等待时间
        self.no_filter = no_filter      # 强制使用通配参数
        self.real_tuples = real_tuples
        self.passed = 0
        self.failed = 0
        self.warned = 0

    def _run_both(self, request: dict, timeout: float = 6.0,
                  max_data_frames: int = 2):
        old_c = Capture()
        new_c = Capture()
        t_old = threading.Thread(target=collect_ws,
                                 args=(self.old_url, request, old_c, timeout, max_data_frames))
        t_new = threading.Thread(target=collect_ws,
                                 args=(self.new_url, request, new_c, timeout, max_data_frames))
        t_old.start(); t_new.start()
        t_old.join();  t_new.join()
        return old_c, new_c

    def _assert(self, label: str, condition: bool, note: str = "",
                expected=None, got=None):
        if condition:
            ok(f"{label}")
            self.passed += 1
        else:
            detail = note
            if expected is not None:
                detail += f" (expected: {expected!r}, got: {got!r})"
            fail(f"{label}  {detail}")
            self.failed += 1

    def _warn(self, label: str, note: str = ""):
        warn(f"{label}  {note}")
        self.warned += 1

    # ── TC1: 连通性 ──────────────────────────────────────
    def test_connectivity(self):
        header("[TC1] 连通性测试")
        old, new = self._run_both(VALID_REQUEST, timeout=3.0)
        self._assert("旧 Calculator 可连接", old.connect_ok, note=old.error or "")
        self._assert("新 Metrics 可连接",    new.connect_ok, note=new.error or "")
        if old.connect_ok and new.connect_ok:
            info(f"旧服务 {old.connect_time_ms:.1f}ms | 新服务 {new.connect_time_ms:.1f}ms")

    # ── TC2: ACK 行为差异 ────────────────────────────────
    def test_ack_behavior(self):
        header("[TC2] ACK 行为对比")
        old, new = self._run_both(VALID_REQUEST, timeout=self.collect_secs)
        if not old.connect_ok or not new.connect_ok:
            warn("跳过：至少一个服务不可达"); return

        old_first = old.messages[0] if old.messages else {}
        new_first = new.messages[0] if new.messages else {}

        self._assert("旧 Calculator 无 ACK（直接流数据）",
                     old_first.get("status") != "started",
                     note="旧服务不应发 status:started")
        self._assert("新 Metrics 先发 ACK（status:started）",
                     new_first.get("status") == "started",
                     note="新服务应先发 ACK")
        self._warn("已知差异：新服务多一条 status:started 消息",
                   "前端已做兼容处理，不影响功能")

    # ── TC3: 外层格式 ────────────────────────────────────
    def test_outer_format(self):
        header("[TC3] 外层消息格式对比")
        old, new = self._run_both(VALID_REQUEST, timeout=self.collect_secs + 2)
        if not old.connect_ok or not new.connect_ok:
            warn("跳过：至少一个服务不可达"); return

        for label, c in [("旧 Calculator", old), ("新 Metrics", new)]:
            dm = [m for m in c.messages if "data" in m]
            if not dm:
                warn(f"{label}: 未收到 data 消息（BPF 可能无流量）"); continue
            m = dm[0]
            self._assert(f'{label}: type == "NumLatencyFrequency"',
                         m.get("type") == "NumLatencyFrequency", got=m.get("type"))
            self._assert(f"{label}: data 为 JSON 字符串",
                         isinstance(m.get("data"), str))

    # ── TC4: 内层字段 ────────────────────────────────────
    def test_inner_fields(self):
        header("[TC4] 内层 data 字段对比")
        old, new = self._run_both(VALID_REQUEST, timeout=self.collect_secs + 2)
        if not old.connect_ok or not new.connect_ok:
            warn("跳过：至少一个服务不可达"); return

        old_dm = [m for m in old.messages if "data" in m]
        new_dm = [m for m in new.messages if "data" in m]
        if not old_dm or not new_dm:
            warn("数据帧不足，请先产生网络流量后重试"); return

        try:
            old_inner = json.loads(old_dm[0]["data"])
            new_inner = json.loads(new_dm[0]["data"])
        except Exception as e:
            fail(f"data 字段解析失败: {e}"); return

        info(f"旧服务内层字段: {sorted(old_inner.keys())}")
        info(f"新服务内层字段: {sorted(new_inner.keys())}")

        for f in sorted(_FRONTEND_REQUIRED):
            self._assert(f'前端必要字段 "{f}" 新服务存在',
                         f in new_inner,
                         note="新服务缺失该字段，前端会报错")

    # ── TC5: 缺参数错误 ──────────────────────────────────
    def test_missing_param_error(self):
        header("[TC5] 缺少参数时错误响应格式")
        old, new = self._run_both(MISSING_PARAM_REQUEST, timeout=3.0)

        for label, c in [("旧 Calculator", old), ("新 Metrics", new)]:
            if not c.connect_ok:
                warn(f"{label} 不可达，跳过"); continue
            if not c.messages:
                warn(f"{label} 无响应"); continue
            m = c.messages[0]
            self._assert(f'{label}: 含 "error" 字段', "error" in m)
            self._assert(f'{label}: type 正确',
                         m.get("type") == "NumLatencyFrequency", got=m.get("type"))
            if isinstance(m.get("details"), list):
                ok(f'{label}: details={m["details"]}')
            else:
                self._warn(f'{label}: 无 details 字段')

    # ── TC6: 未知类型 ────────────────────────────────────
    def test_unknown_type(self):
        header("[TC6] 未知消息类型响应")
        old, new = self._run_both(INVALID_TYPE_REQUEST, timeout=3.0)
        for label, c in [("旧 Calculator", old), ("新 Metrics", new)]:
            if not c.connect_ok:
                warn(f"{label} 不可达，跳过"); continue
            if not c.messages:
                warn(f"{label} 对未知类型无响应（可能直接忽略）"); continue
            m = c.messages[0]
            if "error" in m:
                ok(f'{label}: 返回错误 {m["error"]!r}')
            else:
                self._warn(f'{label}: 未返回标准错误', f"消息={m}")

    # ── TC7: 非法端口 ────────────────────────────────────
    def test_invalid_port(self):
        header("[TC7] 非法端口值验证")
        old, new = self._run_both(INVALID_PORT_REQUEST, timeout=3.0)
        for label, c in [("旧 Calculator", old), ("新 Metrics", new)]:
            if not c.connect_ok:
                warn(f"{label} 不可达，跳过"); continue
            if not c.messages:
                warn(f"{label} 无响应"); continue
            if "error" in c.messages[0]:
                ok(f'{label}: 拒绝非法端口 99999')
            else:
                self._warn(f'{label}: 未拒绝非法端口 99999')

    # ── TC8: 响应时延 ────────────────────────────────────
    def test_latency(self):
        header("[TC8] 响应时延基准")
        old, new = self._run_both(VALID_REQUEST, timeout=self.collect_secs)
        if old.connect_ok and old.messages:
            info(f"旧 Calculator 首消息时延: {old.first_msg_time_ms:.0f}ms")
        if new.connect_ok and new.messages:
            info(f"新 Metrics 首消息时延:    {new.first_msg_time_ms:.0f}ms  "
                 f"(首帧类型: {new.messages[0].get('status', 'data')})")

    # ── TC9: 真实五元组数据对比 ──────────────────────────
    def test_real_traffic_comparison(self, manual_tuple: Optional[FiveTuple] = None):
        header("[TC9] 真实网络流量数据对比")

        # 确定测试用的五元组列表
        if manual_tuple is not None:
            tuples = [manual_tuple]
            info(f"使用手动指定五元组: {manual_tuple.display()}")
        else:
            info("正在从 ss 命令发现真实活跃连接...")
            tuples = discover_real_connections(max_tuples=3)
            if not tuples:
                warn("未发现活跃外部连接，使用通配（空 sip/dip）参数代替")
                tuples = [FiveTuple(sip="", dip="", sport=0, dport=0,
                                    protocol="tcp", label="通配")]
            else:
                for t in tuples:
                    info(f"发现连接: {t.display()}")

        for idx, tup in enumerate(tuples, 1):
            print(f"\n  {BOLD}── 五元组 {idx}/{len(tuples)}: {tup.display()} ──{RESET}")

            # 旧 Calculator 不支持通配（port=0 表示精确匹配端口0，而非通配）
            # 因此无论是否 --no-filter，旧服务始终发送真实五元组
            old_params = tup.to_params()

            # 新 Metrics 支持通配：--no-filter 时使用 0.0.0.0/0 观测全量流量
            if self.no_filter:
                new_params = {"ipv4": True, "ipv6": False, "sip": "0.0.0.0", "dip": "0.0.0.0",
                              "sport": 0, "dport": 0, "protocol": tup.protocol}
                info(f"[旧 Calculator] 精确匹配五元组: {tup.display()}")
                info(f"[新 Metrics]    通配模式 sip/dip=0.0.0.0，观测所有 {tup.protocol.upper()} 流量")
            else:
                new_params = tup.to_params()
                info(f"精确匹配五元组: {tup.display()}")

            old_req = {"type": "NumLatencyFrequency", "params": old_params}
            new_req = {"type": "NumLatencyFrequency", "params": new_params}
            info(f"旧服务请求参数: {json.dumps(old_params, ensure_ascii=False)}")
            info(f"新服务请求参数: {json.dumps(new_params, ensure_ascii=False)}")

            if self.warmup_secs > 0:
                info(f"等待 BCC 预热 {self.warmup_secs}s（旧服务 BPF 编译时间）…")

            info(f"收集时长: {self.collect_secs}s，请确保此期间有该五元组的网络流量…")

            # 并行收集，旧服务额外等待 warmup_secs（BCC 编译）
            # 新 Metrics 每秒推 26 条（slot 0-25），DROP slot 在 24/25 号位置，
            # 最少需要收两批完整数据（52+）才能保证覆盖到 drop(s) 字段
            max_frames = 60
            old_timeout = self.collect_secs + self.warmup_secs
            new_timeout = self.collect_secs
            old_c = Capture()
            new_c = Capture()
            t_old = threading.Thread(target=collect_ws,
                                     args=(self.old_url, old_req, old_c,
                                           old_timeout, max_frames))
            t_new = threading.Thread(target=collect_ws,
                                     args=(self.new_url, new_req, new_c,
                                           new_timeout, max_frames))
            t_old.start(); t_new.start()
            t_old.join();  t_new.join()

            if not old_c.connect_ok:
                fail(f"旧服务连接失败: {old_c.error}"); continue
            if not new_c.connect_ok:
                fail(f"新服务连接失败: {new_c.error}"); continue

            old_dm = [m for m in old_c.messages if "data" in m]
            new_dm = [m for m in new_c.messages if "data" in m]

            info(f"旧服务收到: {len(old_c.messages)} 条消息 "
                 f"（data帧 {len(old_dm)} 条）")
            info(f"新服务收到: {len(new_c.messages)} 条消息 "
                 f"（data帧 {len(new_dm)} 条，"
                 f"含ACK {sum(1 for m in new_c.messages if m.get('status')=='started')} 条）")

            # 打印非数据帧消息（错误/ACK），帮助诊断
            def print_non_data_msgs(label: str, capture: Capture):
                for m in capture.messages:
                    if "data" in m:
                        continue
                    if m.get("status") == "started":
                        continue  # ACK 已通过计数显示
                    # 错误消息或未知类型
                    msg_str = json.dumps(m, ensure_ascii=False)
                    print(f"  {RED}  [{label}] 非数据消息: {msg_str}{RESET}")

            print_non_data_msgs("旧 Calculator", old_c)
            print_non_data_msgs("新 Metrics",    new_c)

            # ── 断言1: 两端都必须收到数据帧 ──────────────────────────────────
            self._assert(
                f"五元组 {idx}: 旧 Calculator 收到数据帧（BCC 精确匹配）",
                bool(old_dm),
                note="旧服务 0 数据帧：可能 BCC 编译超时或过滤器未命中"
            )
            self._assert(
                f"五元组 {idx}: 新 Metrics 收到数据帧",
                bool(new_dm),
                note="新服务 0 数据帧：BPF 可能未捕获到流量"
            )

            if not old_dm and not new_dm:
                warn("两端均无数据帧，可能原因：")
                warn("  1. 旧服务 BCC 编译需 ~15s，请加 --warmup-secs 20 重试")
                warn("  2. BPF 过滤器未匹配到报文，请加 --no-filter 使用通配参数")
                warn("  3. 请确保测试期间有该 IP 对方向的网络流量")
                continue

            # 解析内层 JSON
            def parse_inner(msgs) -> List[dict]:
                result = []
                for m in msgs:
                    try:
                        result.append(json.loads(m["data"]))
                    except Exception:
                        pass
                return result

            old_inner_list = parse_inner(old_dm)
            new_inner_list = parse_inner(new_dm)

            # 侧边打印
            print_data_side_by_side(old_inner_list, new_inner_list,
                                    tuple_label=tup.display())

            # ── 断言3: 返回数据的地址/端口必须与请求的过滤器一致 ─────────────
            # 只在精确过滤模式下检查（--no-filter 时新服务是通配的，不做此检查）
            def check_filter_match(label: str, inner_list: List[dict],
                                   params: dict, idx: int):
                """检查 inner_list 中非零地址的记录是否与请求的 sip/dip/sport/dport 匹配"""
                req_sip   = params.get("sip", "")
                req_dip   = params.get("dip", "")
                req_sport = params.get("sport", 0)
                req_dport = params.get("dport", 0)
                # 只有请求了精确过滤才校验（通配用 0.0.0.0/0）
                is_exact = (req_sip not in ("", "0.0.0.0") or
                            req_dip not in ("", "0.0.0.0") or
                            req_sport != 0 or req_dport != 0)
                if not is_exact or not inner_list:
                    return
                mismatches = []
                for d in inner_list:
                    got_saddr = d.get("saddr", "")
                    got_daddr = d.get("daddr", "")
                    got_sport = d.get("sport", 0)
                    got_dport = d.get("dport", 0)
                    # 跳过全零记录（心跳帧，无真实数据）
                    if got_saddr in ("", "0.0.0.0") and got_daddr in ("", "0.0.0.0"):
                        continue
                    # 地址比较（saddr/daddr 允许正反向）
                    addr_ok = (
                        (req_sip in ("", "0.0.0.0") or got_saddr == req_sip or got_daddr == req_sip) and
                        (req_dip in ("", "0.0.0.0") or got_daddr == req_dip or got_saddr == req_dip)
                    )
                    port_ok = (
                        (req_sport == 0 or got_sport == req_sport or got_dport == req_sport) and
                        (req_dport == 0 or got_dport == req_dport or got_sport == req_dport)
                    )
                    if not addr_ok or not port_ok:
                        mismatches.append(
                            f"saddr={got_saddr} daddr={got_daddr} "
                            f"sport={got_sport} dport={got_dport}"
                        )
                if mismatches:
                    self._assert(
                        f"五元组 {idx}: {label} 返回数据地址/端口与请求过滤器一致",
                        False,
                        note=f"过滤器={req_sip}:{req_sport}→{req_dip}:{req_dport}  "
                             f"实际返回（{len(mismatches)} 条）: {mismatches[0]}"
                    )
                else:
                    self._assert(
                        f"五元组 {idx}: {label} 返回数据地址/端口与请求过滤器一致",
                        True
                    )

            if old_inner_list:
                check_filter_match("旧 Calculator", old_inner_list, old_params, idx)
            if new_inner_list and not self.no_filter:
                check_filter_match("新 Metrics",    new_inner_list, new_params, idx)

            # ── 断言4: 新服务必须覆盖前端所有必要字段 ──────────────────────────
            if new_inner_list:
                new_keys = set()
                for d in new_inner_list:
                    new_keys |= d.keys()
                missing = _FRONTEND_REQUIRED - new_keys
                if missing:
                    self._assert(
                        f"五元组 {idx}: 新服务覆盖前端所有必要字段",
                        False,
                        note=f"缺失字段: {missing}"
                    )
                else:
                    self._assert(f"五元组 {idx}: 新服务覆盖前端所有必要字段", True)

    # ── 汇总 ─────────────────────────────────────────────
    def run_all(self, manual_tuple: Optional[FiveTuple] = None,
                skip_protocol_tests: bool = False):
        print(f"\n{BOLD}{'═'*70}{RESET}")
        print(f"{BOLD}  PacketScope 集成对比测试{RESET}")
        print(f"  旧 Calculator: {CYAN}{self.old_url}{RESET}")
        print(f"  新 Metrics:    {CYAN}{self.new_url}{RESET}")
        print(f"  数据收集时长:  {self.collect_secs}s / 五元组"
              + (f"（+{self.warmup_secs}s BCC预热）" if self.warmup_secs > 0 else ""))
        print(f"  过滤模式:      {'通配（--no-filter）' if self.no_filter else '精确 sip/dip'}")
        print(f"{BOLD}{'═'*70}{RESET}")

        if not skip_protocol_tests:
            self.test_connectivity()
            self.test_ack_behavior()
            self.test_outer_format()
            self.test_inner_fields()
            self.test_missing_param_error()
            self.test_unknown_type()
            self.test_invalid_port()
            self.test_latency()

        self.test_real_traffic_comparison(manual_tuple=manual_tuple)

        print(f"\n{BOLD}{'═'*70}{RESET}")
        total = self.passed + self.failed
        status = GREEN + "PASS" + RESET if self.failed == 0 else RED + "FAIL" + RESET
        print(f"  结果: {status}  通过 {GREEN}{self.passed}{RESET}/{total}  "
              f"失败 {RED}{self.failed}{RESET}  "
              f"已知差异 {YELLOW}{self.warned}{RESET}")
        print(f"\n  {DIM}图例: {GREEN}={RESET}{DIM}值相同  "
              f"{YELLOW}~N%{RESET}{DIM}=数值偏差  "
              f"{RED}✗{RESET}{DIM}=前端必要字段缺失  "
              f"{MAGENTA}*{RESET}{DIM}=前端必要字段  "
              f"{DIM}−{RESET}{DIM}=旧有新无(前端不用){RESET}")
        print(f"{BOLD}{'═'*70}{RESET}\n")

        if self.failed > 0:
            print(f"{YELLOW}提示:{RESET}")
            print("  - 如有 'data 帧不足' 警告：在测试期间产生流量后重试")
            print("  - ACK 差异是已知设计差异，前端已做兼容处理")

        return self.failed


# ─────────────────── Entry Point ───────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Calculator vs Metrics 集成对比测试")
    parser.add_argument("--old-url",  default="ws://localhost:8020",
                        help="旧 Calculator WebSocket URL (default: ws://localhost:8020)")
    parser.add_argument("--new-url",  default="ws://localhost:8021",
                        help="新 Metrics WebSocket URL (default: ws://localhost:8021)")
    parser.add_argument("--collect-secs", type=float, default=6.0,
                        help="每个五元组收集数据的秒数 (default: 6)")
    parser.add_argument("--warmup-secs", type=float, default=15.0,
                        help="旧服务 BCC/BPF 编译预热等待秒数 (default: 15，BCC 编译约需 14s)")
    parser.add_argument("--no-filter", action="store_true",
                        help="不设置 sip/dip 过滤，使用通配参数抓取所有 TCP 流量")
    parser.add_argument("--no-protocol-tests", action="store_true",
                        help="跳过 TC1-TC8 协议测试，只进行真实流量对比")
    # 手动指定五元组（可选）
    parser.add_argument("--sip",      default=None, help="源 IP（手动指定五元组）")
    parser.add_argument("--dip",      default=None, help="目的 IP（手动指定五元组）")
    parser.add_argument("--sport",    type=int, default=0, help="源端口 0=通配")
    parser.add_argument("--dport",    type=int, default=0, help="目的端口 0=通配")
    parser.add_argument("--protocol", default="tcp", choices=["tcp", "udp", "icmp"],
                        help="协议 (default: tcp)")
    args = parser.parse_args()

    # 如果显式指定了 sip/dip，构造手动五元组
    manual_tuple = None
    if args.sip or args.dip:
        manual_tuple = FiveTuple(
            sip=args.sip or "",
            dip=args.dip or "",
            sport=args.sport,
            dport=args.dport,
            protocol=args.protocol,
            label="手动指定",
        )

    runner = CompareRunner(
        old_url=args.old_url,
        new_url=args.new_url,
        collect_secs=args.collect_secs,
        warmup_secs=args.warmup_secs,
        no_filter=args.no_filter,
    )
    exit_code = runner.run_all(
        manual_tuple=manual_tuple,
        skip_protocol_tests=args.no_protocol_tests,
    )
    sys.exit(exit_code)

