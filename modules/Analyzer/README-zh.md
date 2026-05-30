# PacketScope Analyzer 模块

中文 | [English](README.md)

## 概述

PacketScope 的 Analyzer 模块为用户提供了前所未有的协议交互全景可视化能力。其中，**Monitor** 组件能够捕获分组自协议栈入口至应用层处理的完整处理路径，生成跨层、跨协议的交互全景图。**Calculator** 组件进一步梳理数据包在协议栈中的完整收发路径，统计分析分组跨层交互信息，包含：层流量、跨层交互频率、跨层延迟、丢包率。

两个组件均已完成 Go + cilium/ebpf 重构，取代了原有的 Python + BCC 实现。

## 特性

### Monitor 组件
- 实时监控当前计算机的套接字和网卡状态
- 捕获通过任一网络接口的流量包（ingress / egress）
- 捕捉网络包通过各内核函数的路径与耗时
- 将内核路径组织为调用图以提供可视化功能
- 所有数据存储于 PostgreSQL，通过 RESTful API 提供查询服务

### Calculator 组件
- 网络协议栈关键路径实时监控：实时监控数据包流经链路层、网络层、传输层的过程
- 跨层交互指标实时计算：层流量、跨层交互频率、跨层延迟、丢包率
- 历史趋势分析：历史曲线图查看指标变化
- WebSocket 接口：每秒自动推送实时指标数据

---

## 模块架构

```
Analyzer/
├── Calculator/                # 跨层指标计算器（Go）
│   ├── cmd/metrics/main.go    # 程序入口
│   ├── pkg/bpf_engine/        # eBPF 引擎（cilium/ebpf）
│   │   ├── metrics.c          # eBPF C 源码
│   │   └── engine.go          # 引擎：加载、挂载、过滤器
│   ├── pkg/aggregation/       # 聚合与消息构建
│   ├── pkg/server/            # WebSocket 服务
│   ├── Makefile               # 构建文件
│   ├── build.sh               # 构建脚本
│   └── README.md              # 详细文档
├── Monitor/                   # 数据包捕获与功能调用监控（Go）
│   ├── main.go                # 程序入口
│   ├── kbatch/                # 内核功能调用监控（eBPF）
│   ├── tcxprober/             # 网络数据包捕获（eBPF TC）
│   ├── server/                # RESTful API 查询服务
│   ├── base/                  # 基础工具（BTF 解析、JSON 转换等）
│   ├── doc/                   # 详细文档
│   │   ├── install.md         # 安装指南
│   │   ├── database.md        # 数据库配置
│   │   ├── server-api.md      # API 参考
│   │   ├── kbatch.md          # kbatch 模块文档
│   │   └── tcxprober.md       # tcxprober 模块文档
│   ├── Makefile               # 构建文件
│   ├── Dockerfile             # Docker 构建
│   └── readme.md              # 详细文档
├── README.md                  # 本文件（英文）
└── README-zh.md               # 本文件（中文）
```

---

## 安装指南

### 系统要求

- 支持 eBPF 的 Linux 内核（6.8+ 版本）
- Go >= 1.24
- clang / llvm（编译 eBPF C 代码）
- PostgreSQL（Monitor 数据存储）
- Root/sudo 权限

### 推荐方式：基于 Docker 的部署

```bash
# 步骤 1: 构建 Monitor 模块
docker build -t packetscope-analyzer-monitor:v1.0 ./Monitor/

# 步骤 2: 构建 Calculator 模块
docker build -t packetscope-analyzer-calculator:v1.0 ./Calculator/
```

#### 运行容器

```bash
# 运行 Monitor 模块
docker run --privileged --network host packetscope-analyzer-monitor:v1.0

# 运行 Calculator 模块
docker run --privileged --network host packetscope-analyzer-calculator:v1.0
```

**配置说明：**
- `--privileged`：加载 eBPF 程序和内核追踪所必需
- `--network host`：启用宿主机网络访问以获取完整流量可见性
  - 若不使用 host 网络模式，将只能捕获容器内部流量

### 备选方式：手动安装

#### Monitor 模块

> 完整安装步骤详见 [Monitor/doc/install.md](Monitor/doc/install.md)

```bash
cd Monitor/

# 1. 安装系统依赖
sudo apt-get update && sudo apt-get install -y \
    curl wget git make cmake build-essential golang-go \
    gcc g++ clang llvm libbpf-dev linux-headers-generic \
    linux-tools-generic linux-tools-common bpfcc-tools \
    libbpf-tools iproute2 net-tools tcpdump \
    libelf-dev zlib1g-dev pkg-config postgresql-client

# 2. 安装 bpf2go 工具
go install github.com/cilium/ebpf/cmd/bpf2go@latest

# 3. 配置 PostgreSQL
sudo service postgresql start
psql -h localhost -U postgres -c "ALTER USER postgres WITH PASSWORD 'password';"
createdb -h localhost -U postgres tcxprober
createdb -h localhost -U postgres functioninfo

# 4. 配置环境变量
export CGO_ENABLED=1
export PG_HOST=localhost PG_PORT=5432 PG_USER=postgres PG_PASSWORD=password
export PG_DBNAME_PACKET=tcxprober PG_DBNAME_FUNCTION=functioninfo PG_SSLMODE=disable

# 5. 编译
make prepare && make && make server

# 6. 运行
sudo ./analyzer    # 数据采集（kbatch + tcxprober）
./qserver          # API 查询服务（端口 8010）
```

#### Calculator 模块

```bash
cd Calculator/

# 1. 编译
make

# 2. 运行
sudo ./metrics               # WebSocket 服务（端口 8020）
sudo METRICS_PORT=9090 ./metrics  # 自定义端口
```

---

## API 参考

### Monitor 接口

Monitor API 服务监听 `http://localhost:8010`。

| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/GetRecentPacket` | 获取最近数据包 |
| POST | `/GetRecentMap` | 获取最近功能调用映射 |
| GET | `/GetFuncTable` | 获取功能 ID 映射表 |
| POST | `/QueryFuncSend` | 查询发送功能调用 |
| POST | `/QueryFuncRecv` | 查询接收功能调用 |
| POST | `/QueryPacket` | 查询数据包 |
| GET | `/QuerySockList` | 获取网络套接字列表 |

> 完整 API 文档：[Monitor/doc/server-api.md](Monitor/doc/server-api.md)

### Calculator 接口

Calculator 模块通过 WebSocket 服务（`ws://<host>:8020/` 或 `/ws`）提供实时指标推送。

**端点：** `NumLatencyFrequency`

请求示例：
```json
{"type":"NumLatencyFrequency","params":{"ipv4":true,"ipv6":false,"sip":"192.168.126.128","dip":"103.143.17.156","sport":57892,"dport":443,"protocol":"tcp"}}
```

服务端先返回确认消息：
```json
{"type":"NumLatencyFrequency","status":"started"}
```

随后每秒推送监控数据：
```json
{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"linknetwork\", \"direction\": \"send\", \"type\": \"ipv4\", \"pid\": 3206, \"pid_name\": \"Socket Thread\", \"saddr\": \"192.168.126.128\", \"daddr\": \"103.143.17.156\", \"sport\": 57892, \"dport\": 443, \"LAT(ms)\": 0.01, \"frequency(s)\": 35}"}
{"type": "NumLatencyFrequency", "data": "{\"layer\": \"trans\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": 3206, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"num\": 35, \"pps(s)\": 35}"}
{"type": "NumLatencyFrequency", "data": "{\"type\": \"ipv4\", \"pid\": 0, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57244, \"drop(s)\": 1}"}
```

> 完整 API 文档：[Calculator/README.md](Calculator/README.md)

---

## 技术栈

| 特性 | Monitor | Calculator |
|------|---------|------------|
| 语言 | Go | Go |
| eBPF 加载 | cilium/ebpf (bpf2go) | cilium/ebpf (bpf2go) |
| eBPF 挂载 | fentry/kprobe + TC | fentry/kprobe + tracepoint |
| 通信方式 | HTTP REST（端口 8010） | WebSocket（端口 8020） |
| 数据存储 | PostgreSQL | 内核 BPF map 聚合 |
| eBPF 编译 | CO-RE (bpf2go) | CO-RE (bpf2go) |
| 内核依赖 | 无（无需 BCC） | 无（无需 BCC） |

---

## 环境变量

### Monitor

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| PG_HOST | localhost | PostgreSQL 主机地址 |
| PG_PORT | 5432 | PostgreSQL 端口 |
| PG_USER | postgres | PostgreSQL 用户名 |
| PG_PASSWORD | password | PostgreSQL 密码 |
| PG_DBNAME_PACKET | tcxprober | 数据包数据库名称 |
| PG_DBNAME_FUNCTION | functioninfo | 函数信息数据库名称 |
| PG_SSLMODE | disable | SSL 连接模式 |

### Calculator

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| METRICS_PORT | 8020 | WebSocket 服务端口 |

---

## 故障排查

### 常见问题

**权限被拒绝错误**
- 确保模块以 root 权限运行（`sudo`）
- 验证内核配置中已启用 eBPF

**未捕获到数据包**
- 若使用 Docker，确保使用了 `--network host` 参数
- 检查网络接口已启动且正在接收流量

**eBPF 程序加载失败**
- 确保内核版本支持 eBPF（推荐 6.8+）
- 安装匹配当前内核的头文件：`sudo apt-get install linux-headers-$(uname -r)`

**数据库连接失败（Monitor）**
- 确保 PostgreSQL 服务正在运行：`sudo systemctl status postgresql`
- 检查数据库连接参数是否与环境变量一致
- 确保数据库用户具有正确的权限

**抓取函数列表缺失**
- 输入：`ulimit -n 65535` 以扩大最大挂载点数量

## 致谢

感谢 cilium/ebpf 提供的 Go eBPF 库、PostgreSQL 提供的数据库引擎，以及 BCC 开源项目的启发。
