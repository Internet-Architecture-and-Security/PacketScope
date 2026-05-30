# Calculator 模块说明

本模块通过 WebSocket 接口实现协议栈中分组数据流动数量、延迟、跨层交互频率、丢包等多维度信息的实时统计。基于 Go + cilium/ebpf 重构，取代原 Python+BCC 实现（Metric 模块）。

## 📦 依赖

- **Go** >= 1.24
- **clang**（用于编译 eBPF C 代码）
- **Linux 内核** >= 6.8（需支持 eBPF fentry/kprobe）
- Go 依赖通过 `go.mod` 管理，主要依赖：
  - `github.com/cilium/ebpf` — 纯 Go eBPF 加载与挂载
  - `github.com/gorilla/websocket` — WebSocket 服务

## 🚀 编译与运行

### 编译

```bash
make
```

或使用构建脚本：

```bash
./build.sh build
```

编译将生成可执行文件 `metrics`（或 `bin/metrics`）。

### 运行

运行前需具有管理员权限：

```bash
sudo ./metrics
```

可通过环境变量 `METRICS_PORT` 指定监听端口（默认 `8020`）：

```bash
sudo METRICS_PORT=9090 ./metrics
```

服务启动后，通过 WebSocket（`ws://<host>:8020/` 或 `ws://<host>:8020/ws`）接收实时监控数据。

## 接口列表

### WebSocket - NumLatencyFrequency

功能：统计指定五元组在链路层、网络层、传输层的数据包流动情况、丢包率、跨层延迟与跨层交互频率。

请求示例：

```json
{"type":"NumLatencyFrequency","params":{"ipv4":true,"ipv6":false,"sip":"192.168.126.128","dip":"103.143.17.156","sport":57892,"dport":443,"protocol":"tcp"}}
```

服务端收到请求后，先返回确认消息：

```json
{"type":"NumLatencyFrequency","status":"started"}
```

随后每秒推送监控数据：

```json
{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"linknetwork\", \"direction\": \"send\", \"type\": \"ipv4\", \"pid\": 3206, \"pid_name\": \"Socket Thread\", \"saddr\": \"192.168.126.128\", \"daddr\": \"103.143.17.156\", \"sport\": 57892, \"dport\": 443, \"LAT(ms)\": 0.01, \"frequency(s)\": 35}"}
{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"linknetwork\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": 3617, \"pid_name\": \"StreamT~ns #162\", \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"LAT(ms)\": 0.099, \"frequency(s)\": 35}"}
{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"networktrans\", \"direction\": \"send\", \"type\": \"ipv4\", \"pid\": -1, \"pid_name\": \"NULL\", \"saddr\": \"192.168.126.128\", \"daddr\": \"103.143.17.156\", \"sport\": 57892, \"dport\": 443, \"LAT(ms)\": 0, \"frequency(s)\": 0}"}
{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"networktrans\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": 3617, \"pid_name\": \"StreamT~ns #162\", \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"LAT(ms)\": 0.269, \"frequency(s)\": 35}"}
{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"linktrans\", \"direction\": \"send\", \"type\": \"ipv4\", \"pid\": -1, \"pid_name\": \"NULL\", \"saddr\": \"192.168.126.128\", \"daddr\": \"103.143.17.156\", \"sport\": 57892, \"dport\": 443, \"LAT(ms)\": 0, \"frequency(s)\": 0}"}
{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"linktrans\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": 3617, \"pid_name\": \"StreamT~ns #162\", \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"LAT(ms)\": 0.308, \"frequency(s)\": 35}"}
{"type": "NumLatencyFrequency", "data": "{\"layer\": \"trans\", \"direction\": \"send\", \"type\": \"ipv4\", \"pid\": 3206, \"saddr\": \"192.168.126.128\", \"daddr\": \"103.143.17.156\", \"sport\": 37630, \"dport\": 443, \"num\": 2, \"pps(s)\": 2}"}
{"type": "NumLatencyFrequency", "data": "{\"layer\": \"trans\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": 3206, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"num\": 35, \"pps(s)\": 35}"}
{"type": "NumLatencyFrequency", "data": "{\"layer\": \"network\", \"direction\": \"send\", \"type\": \"ipv4\", \"pid\": 3206, \"saddr\": \"192.168.126.128\", \"daddr\": \"103.143.17.156\", \"sport\": 37630, \"dport\": 443, \"num\": 2, \"pps(s)\": 2}"}
{"type": "NumLatencyFrequency", "data": "{\"layer\": \"network\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": 3617, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"num\": 35, \"pps(s)\": 35}"}
{"type": "NumLatencyFrequency", "data": "{\"layer\": \"link\", \"direction\": \"send\", \"type\": \"ipv4\", \"pid\": 3206, \"saddr\": \"192.168.126.128\", \"daddr\": \"103.143.17.156\", \"sport\": 37630, \"dport\": 443, \"num\": 2, \"pps(s)\": 2}"}
{"type": "NumLatencyFrequency", "data": "{\"layer\": \"link\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": 3617, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"num\": 35, \"pps(s)\": 35}"}
{"type": "NumLatencyFrequency", "data": "{\"type\": \"ipv4\", \"pid\": 0, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57244, \"drop(s)\": 1}"}
```

返回值说明：

```
1）
"crosslayer": "linknetwork",表示"链路层与网络层"之间的交互情况；
"direction": "send",表示发包情况，
"type": "ipv4", 表示协议是ipv4还是ipv6
"pid": -1, 表示线程id,若为-1,则表示当前五元组无丢包情况
"pid_name": "Socket Thread", 表示线程名称，
"saddr": "192.168.126.128",
"daddr": "103.143.17.156",
"sport": 57892,
"dport": 443,

"LAT(ms)": 0.01,  表示给定五元组，数据包从网络层到链路层的延时时间，单位ms
"frequency(s)": 35,   表示给定五元组，数据包从网络层到链路层的交互频率，单位s

2）
"crosslayer": "linknetwork",表示"链路层与网络层"之间的交互情况；
"direction": "receive",表示收包情况，

其余字段含义同上，注意：
"LAT(ms)": 0.099,  表示给定五元组，数据包从链路层到网络层的延时时间，单位ms
"frequency(s)": 35,   表示给定五元组，数据包从链路层到网络层的交互频率，单位s

3）
"crosslayer": "networktrans",表示"网络层与传输层"之间的交互情况；
"direction": "send",表示发包情况，

其余字段含义同上，注意：
"LAT(ms)": 0,  表示给定五元组，数据包从传输层到网络层的延时时间，单位ms
"frequency(s)": 0,   表示给定五元组，数据包从传输层到网络层的交互频率，单位s

4）
"crosslayer": "networktrans",表示"网络层与传输层"之间的交互情况；
"direction": "receive",表示收包情况，

其余字段含义同上，注意：
"LAT(ms)": 0,  表示给定五元组，数据包从网络层到传输层的延时时间，单位ms
"frequency(s)": 0,   表示给定五元组，数据包从网络层到传输层的交互频率，单位s

5）
"crosslayer": "linktrans",表示"链路与传输层"之间的交互情况；
"direction": "send",表示发包情况，

其余字段含义同上，注意：
"LAT(ms)": 0,  表示给定五元组，数据包从传输层到链路层的延时时间，单位ms
"frequency(s)": 0,   表示给定五元组，数据包从传输层到链路层的交互频率，单位s

6）
"crosslayer": "linktrans",表示"链路与传输层"之间的交互情况；
"direction": "receive",表示收包情况，

其余字段含义同上，注意：
"LAT(ms)": 0.308,  表示给定五元组，数据包从链路层到传输层的延时时间，单位ms
"frequency(s)": 35,   表示给定五元组，数据包从链路层到传输层的交互频率，单位s

7）
"layer": "trans",表示"传输层数据包数量"；
"direction": "send",表示发包

其余字段含义同上，注意：
"num":2,  表示给定五元组，传输层处理的数据包数目
"pps(s)": 2,   表示给定五元组，传输层处理的数据包的频率，单位为s

8)
"layer": "trans",表示"传输层数据包数量"；
"direction": "receive",表示收包

其余字段含义同上，注意：
"num":35  表示给定五元组，传输层处理的数据包数目
"pps(s)": 35,   表示给定五元组，传输层处理的数据包的频率，单位为s

9)
"layer": "network",表示"网络层数据包数量"；
"direction": "send",表示发包

其余字段含义同上，注意：
"num":2,  表示给定五元组，网络层处理的数据包数目
"pps(s)": 2,   表示给定五元组，网络层处理的数据包的频率，单位为s

10)
"layer": "network",表示"网络层数据包数量"；
"direction": "receive",表示收包

其余字段含义同上，注意：
"num":35  表示给定五元组，网络层处理的数据包数目
"pps(s)": 35,   表示给定五元组，网络层处理的数据包的频率，单位为s

11)
"layer": "link",表示"链路层数据包数量"；
"direction": "send",表示发包

其余字段含义同上，注意：
"num":2,  表示给定五元组，链路层处理的数据包数目
"pps(s)": 2,   表示给定五元组，链路层处理的数据包的频率，单位为s

12)
"layer": "link",表示"链路层数据包数量"；
"direction": "receive",表示收包

其余字段含义同上，注意：
"num":35  表示给定五元组，链路层处理的数据包数目
"pps(s)": 35,   表示给定五元组，链路层处理的数据包的频率，单位为s

13)
其余字段含义同上，注意：
"drop(s)": 1,   表示给定五元组，tcp的丢包率，单位为s
```

## 与 Metric 模块的主要区别

| 特性 | Metric（Python） | Calculator（Go） |
|------|-------------------|-------------------|
| 语言 | Python + BCC | Go + cilium/ebpf |
| eBPF 加载 | BCC 运行时编译 | bpf2go 预编译（CO-RE） |
| 通信方式 | HTTP API（端口 5000） | WebSocket（端口 8020） |
| 数据推送 | 请求-响应 | 每秒自动推送 |
| 内核依赖 | 需安装 BCC | 无需 BCC，纯 Go 加载 |
