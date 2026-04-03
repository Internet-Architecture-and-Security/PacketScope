# PacketScope Metrics

基于 **Go + cilium/ebpf** 的内核态网络指标采集模块。通过 11 个 eBPF 探针（fentry / kprobe / tracepoint）在内核态实时聚合数据，每秒定时读取后通过 **WebSocket** 推送给前端，支持跨 Linux 内核版本运行（5.10 LTS ～ 6.12 LTS）。

## 架构概览

```
内核空间                                    用户空间
┌────────────────────────────────┐          ┌───────────────────────────────┐
│  eBPF 探针 (11 个)              │          │  Go 服务                      │
│                                │          │                               │
│  RX fentry (3 层)              │          │  Ticker(1s)                   │
│  TX fentry (3 层)         ───▶ │ PERCPU   │  ├─ 读取 agg_map (26 slots)  │
│  Drop (kprobe/tracepoint)      │  ARRAY   │  ├─ SumPerCPU + 计算指标     │
│                                │  agg_map │  └─ WebSocket 推送 JSON      │
│                                │          │                               │
│  五元组过滤 Map                 │          │  ws://0.0.0.0:8020/ws        │
└────────────────────────────────┘          └───────────────────────────────┘
```

**设计亮点**：无论流量 PPS 为 1 还是 1,000,000，用户态每秒固定执行 52 次 Map 操作，开销 $O(1)$，不会随流量增大而退化。

## 系统要求

| 需求 | 最低版本 | 说明 |
|------|---------|------|
| Linux 内核 | **5.10 LTS** | 需启用 BTF；fentry 在 5.5 引入 |
| Go | >= 1.22 | 编译 |
| Clang + LLVM | >= 15 | 编译 eBPF C 源码 |
| root 权限 | — | 加载 BPF 程序需要 `CAP_BPF` |

检查内核 BTF 支持：
```bash
ls /sys/kernel/btf/vmlinux   # 存在则 BTF 可用
```

## 目录结构

```
Metrics/
├── build.sh                  # 一键编译 & 部署脚本
├── test.sh                   # 一键测试脚本
├── cmd/metrics/main.go       # 服务入口
├── bpf/                      # eBPF C 源码
│   ├── metrics.c             # 编译入口
│   ├── common.h              # 共享结构 / Map / 辅助函数
│   ├── rx.h                  # 接收方向探针
│   ├── tx.h                  # 发送方向探针
│   └── drop.h                # 丢包探针（三级回退兼容策略）
├── pkg/
│   ├── aggregation/          # 聚合引擎（Collector, BuildMessage）
│   ├── bpf_engine/           # BPF 加载器 + Map 读写
│   │   └── ebpf/             # bpf2go 生成的绑定文件
│   └── server/               # WebSocket 服务
├── scripts/
│   └── build-ebpf.sh         # 独立编译 BPF .o（供 vmtest 使用）
├── deploy/
│   └── start.sh              # 最简启动脚本
├── test/                     # 单元测试 + BPF 集成测试
│   └── kernel-compat/vmtest/ # 跨内核 QEMU 兼容性测试
├── docs/
│   ├── aggregation-design.md # 内核态聚合方案设计文档
│   └── testing.md            # 测试完整指南
└── Dockerfile                # 多阶段构建镜像
```

---

## 快速开始

### 1. 编译

```bash
cd modules/Analyzer/Metrics

# 一键编译（生成 BPF 绑定 + Go 二进制 → bin/metrics）
./build.sh
```

### 2. 运行

```bash
# 需要 root 权限加载 eBPF 探针
sudo -E ./build.sh run

# 或直接执行二进制
sudo -E ./bin/metrics
```

服务启动后监听 `ws://0.0.0.0:8020`（前端地址）和 `ws://0.0.0.0:8020/ws`（均可用）。

### 3. 测试

```bash
# 下载必要的依赖
./test.sh setup

# 单元测试（无需 root）
./test.sh

# 跨内核兼容性测试（需要 root + QEMU）
sudo -E ./test.sh vmtest
```

### 4. Docker 部署

```bash
# 构建并运行
./build.sh docker build
./build.sh docker run

# 或一步执行
docker build -t packetscope/metrics .
docker run --privileged --net=host packetscope/metrics
```

---

## 脚本说明

### `build.sh` — 编译与部署

```
用法: ./build.sh [命令]

  build          编译（BPF 绑定生成 + Go 二进制）   [默认]
  run            编译并以 root 启动服务
  docker build   构建 Docker 镜像
  docker run     启动 Docker 容器（自动构建镜像）
  clean          删除 bin/metrics 和 bpf/out/
  help           显示帮助

环境变量:
  OUTPUT=bin/metrics                 输出路径
  IMAGE=packetscope/metrics:latest   Docker 镜像名称
```

### `test.sh` — 测试套件

```
用法: ./test.sh [命令]

  unit          单元测试（无需 root）                [默认]
  integration   BPF 集成测试（需要 root）
  vmtest        跨内核 QEMU 兼容性测试（需要 root）
                  ./test.sh vmtest 5.15 6.6           # 指定版本
  all           全量测试
  setup         安装依赖 + 下载内核镜像
  help          显示帮助

环境变量:
  KERNELS="5.10 5.15 6.1 6.6 6.12"  vmtest 内核版本
  TIMEOUT=180                         每个 VM 超时秒数
  VERBOSE=1                           详细输出
```

### `scripts/build-ebpf.sh` — 独立编译 BPF 对象

```bash
./scripts/build-ebpf.sh                    # 编译 bpf/out/metrics_bpf.o
TARGET_ARCH=arm64 ./scripts/build-ebpf.sh  # 交叉编译
```

### `deploy/start.sh` — 最简启动

```bash
sudo -E ./deploy/start.sh   # 自动检查/构建二进制后运行
```

### `test/kernel-compat/vmtest/` — vmtest 底层脚本

```bash
# 下载内核镜像（>= 5.10，来自 ghcr.io/cilium/ci-kernels）
./test/kernel-compat/vmtest/fetch-kernels.sh
./test/kernel-compat/vmtest/fetch-kernels.sh 5.15 6.6  # 指定版本

# 构建 initramfs（内含测试二进制 + metrics 服务）
./test/kernel-compat/vmtest/mkrootfs.sh

# 启动 QEMU 运行测试
sudo -E ./test/kernel-compat/vmtest/run-vmtest.sh
sudo -E ./test/kernel-compat/vmtest/run-vmtest.sh 5.15 6.6  # 指定版本
```

---

## WebSocket 协议

连接地址：`ws://<host>:8020/ws`

**发送过滤规则：**
```json
{
  "ipv4_flag": "true",
  "sip": "192.168.1.100",
  "dip": "10.0.0.1",
  "sport": 0,
  "dport": 80,
  "protocol": 6
}
```
> 数值字段为 `0` 表示通配（匹配任意）。

**接收消息格式：**

首条为 ACK：
```json
{"type": "NumLatencyFrequency", "status": "started"}
```

后续为周期性指标（`data` 为嵌套 JSON 字符串）：
```json
{
  "type": "NumLatencyFrequency",
  "data": "{\"layer\":\"network\",\"direction\":\"receive\",\"type\":\"ipv4\",\"num\":1234,\"pps(s)\":1234,\"drop(s)\":0,\"LAT(ms)\":0.5}"
}
```

---

## 支持的内核版本

见 [docs/testing.md](docs/testing.md#四支持的内核版本矩阵) 完整矩阵，以及 [docs/aggregation-design.md](docs/aggregation-design.md) 了解内核态聚合方案设计。
