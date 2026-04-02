# Metrics 模块 — 编译、测试与运行指南

基于 Go + cilium/ebpf 的网络协议栈指标采集服务，通过 11 个内核探针（tp_btf / fentry）在内核态聚合 PPS、跨层延迟和丢包率，每秒定时读取后经 WebSocket 推送给前端。

## 项目结构

```
modules/Analyzer/Metrics/
├── bpf/                          # eBPF C 源码
│   ├── metrics.c                 # 编译入口（include 以下三个文件）
│   ├── common.h                  # 共享结构体、Map 定义、辅助函数
│   ├── rx.h                      # 接收探针 (link/network/transport)
│   ├── tx.h                      # 发送探针 (link/network/transport)
│   └── drop.h                    # 丢包探针
├── cmd/metrics/main.go           # 程序入口
├── pkg/
│   ├── aggregation/              # 聚合引擎（Collector, BuildMessage）
│   ├── bpf_engine/               # BPF 加载器 + Map 读写接口
│   │   └── ebpf/                 # bpf2go 生成的文件（隔离目录）
│   └── server/                   # WebSocket 服务
├── test/                         # 所有测试文件
├── deploy/                       # 部署脚本与本文档
└── Dockerfile                    # 多阶段构建镜像
```

## 前置依赖

| 依赖 | 版本要求 | 用途 |
|------|---------|------|
| Go | >= 1.22 | 编译 |
| Clang + LLVM | >= 15 | 编译 BPF C 代码 |
| libbpf-dev (或内核 BTF) | 内核 >= 5.8 | CO-RE 支持 |
| Linux Kernel | >= 5.8, 启用 BTF | tp_btf / fentry 探针 |

检查内核是否支持 BTF：
```bash
ls /sys/kernel/btf/vmlinux  # 存在即表示支持
```

## 编译

### 1. 生成 BPF Go 绑定
```bash
cd modules/Analyzer/Metrics
go generate ./pkg/bpf_engine/ebpf/
```

### 2. 编译 Go 二进制
```bash
go build -o bin/metrics ./cmd/metrics
```

### 一步编译
```bash
go generate ./pkg/bpf_engine/ebpf/ && go build -o bin/metrics ./cmd/metrics
```

## 测试

### 单元测试（无需 root）
```bash
go test -v ./test/
```

当前覆盖 35 个测试用例：
- 聚合槽位编解码（AggIdx / DecodeSlot 往返）
- SumPerCPU 累加（多 CPU / 全零 / 单 CPU）
- BuildMessage 输出（PPS/LAT/DROP 三类消息格式、RX 地址反转、方向名称）
- WebSocket 参数解析（IPv4/IPv6/ICMP、端口边界、非法输入、未知类型）
- WebSocket 推送流（26 条聚合消息、嵌套 JSON 字符串格式、1 秒超时）
- Collector 集成（空数据心跳、有数据 PPS/LAT 计算）
- 高 PPS 场景（大数值正确性）

### BPF 集成测试（需要 root）
```bash
sudo -E go test -v -run TestBPFEngine -count=1 ./test/
```

此测试会真实加载 BPF 字节码并 attach 全部 11 个探针到内核，验证：
- BPF ELF 加载成功
- 所有 tp_btf / fentry 探针挂载成功
- 资源正确释放

### 全部测试（需要 root）
```bash
sudo -E go test -v -count=1 ./test/
```

## 运行

### 本地运行

```bash
# 需要 root 权限以挂载 eBPF 探针
sudo -E ./bin/metrics
```

服务启动后监听 `ws://0.0.0.0:8020/ws`。

### 使用部署脚本
```bash
sudo -E ./deploy/start.sh
```

### Docker 运行
```bash
docker build -t metrics .
docker run --privileged --net=host metrics
```

## WebSocket 交互验证

### 1. 安装 websocat
```bash
# Ubuntu/Debian:
wget -qO websocat https://github.com/vi/websocat/releases/download/v1.11.0/websocat.x86_64-unknown-linux-musl
chmod +x websocat && sudo mv websocat /usr/local/bin/
```

### 2. 连接并下发过滤规则

终端 A — 启动服务：
```bash
sudo -E ./bin/metrics
```

终端 B — 连接 WebSocket：
```bash
websocat ws://localhost:8020/ws
```

发送 IPv4 TCP 过滤指令：
```json
{"type":"NumLatencyFrequency","params":{"ipv4_flag":"true","ipv6_flag":"false","sip":"","dip":"","sport":0,"dport":0,"protocol":"tcp"}}
```

### 3. 制造流量并观察输出

终端 C — 产生网络流量：
```bash
curl -s https://example.com > /dev/null
# 或
ping -c 5 8.8.8.8
```

终端 B 将每秒收到 26 条聚合消息，格式示例：

**PPS 消息**（每层每方向每协议各一条，共 12 条）：
```json
{"type":"NumLatencyFrequency","data":"{\"layer\":\"link\",\"direction\":\"receive\",\"type\":\"ipv4\",\"pid\":0,\"saddr\":\"8.8.8.8\",\"daddr\":\"192.168.1.100\",\"sport\":0,\"dport\":0,\"num\":150,\"pps(s)\":150}"}
```

**延迟消息**（跨层组合 × 方向 × 协议，共 12 条）：
```json
{"type":"NumLatencyFrequency","data":"{\"crosslayer\":\"linknetwork\",\"direction\":\"send\",\"type\":\"ipv4\",\"pid\":0,\"pid_name\":\"curl\",\"saddr\":\"192.168.1.100\",\"daddr\":\"93.184.216.34\",\"sport\":43210,\"dport\":443,\"LAT(ms)\":0.125,\"frequency(s)\":100}"}
```

**丢包消息**（每协议各一条，共 2 条）：
```json
{"type":"NumLatencyFrequency","data":"{\"type\":\"ipv4\",\"pid\":0,\"saddr\":\"\",\"daddr\":\"\",\"sport\":0,\"dport\":0,\"drop(s)\":2}"}
```

### 4. 切换过滤条件

发送新的指令会**自动取消**旧的监控任务并启动新的：
```json
{"type":"NumLatencyFrequency","params":{"ipv4_flag":"false","ipv6_flag":"true","sip":"","dip":"","sport":0,"dport":0,"protocol":"udp"}}
```

## 内核探针列表

| # | 层级 | 方向 | 挂载类型 | 内核函数 |
|---|------|------|---------|---------|
| 1 | 链路层 | RX | tp_btf | netif_receive_skb |
| 2 | 网络层 | RX (v4) | fentry | ip_local_deliver |
| 3 | 网络层 | RX (v6) | fentry | ip6_input |
| 4 | 传输层 | RX (v4) | fentry | inet_recvmsg |
| 5 | 传输层 | RX (v6) | fentry | inet6_recvmsg |
| 6 | 传输层 | TX (v4) | fentry | inet_sendmsg |
| 7 | 传输层 | TX (v6) | fentry | inet6_sendmsg |
| 8 | 网络层 | TX (v4) | fentry | ip_finish_output |
| 9 | 网络层 | TX (v6) | fentry | ip6_finish_output |
| 10 | 链路层 | TX | tp_btf | net_dev_start_xmit |
| 11 | 丢包 | — | tp_btf | kfree_skb |

## 故障排查

```bash
# 检查 BTF 是否可用
ls /sys/kernel/btf/vmlinux

# 检查可用的 tracepoint
sudo cat /sys/kernel/debug/tracing/available_events | grep -E "^(net|skb):"

# 查看已挂载的 BPF 程序
sudo bpftool prog list | grep metrics

# 查看 BPF Map
sudo bpftool map list | grep -E "agg_map|five_tuple"
```
