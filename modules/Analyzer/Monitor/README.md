# Monitor 模块说明

Monitor 模块是 PacketScope Analyzer 的核心数据采集组件，使用 eBPF 技术实现高效的网络流量捕获、内核功能调用跟踪，并通过 RESTful API 提供数据查询服务。所有采集数据存储在 PostgreSQL 数据库中。

## 目录结构

```
Monitor/
├── base/                # 基础功能模块（BTF 解析、JSON 转换等）
├── doc/                 # 项目详细文档
│   ├── install.md       # 安装指南
│   ├── database.md      # 数据库配置
│   ├── server-api.md    # API 接口文档
│   ├── kbatch.md        # kbatch 模块文档
│   └── tcxprober.md     # tcxprober 模块文档
├── kbatch/              # 内核功能调用监控模块
├── server/              # API 服务器模块
├── tcxprober/           # 网络数据包捕获模块
├── test/                # 测试代码目录
├── Dockerfile           # Docker 构建文件
├── Makefile             # 项目构建文件
├── main.go              # 项目主入口
├── go.mod / go.sum      # Go 模块依赖
└── readme.md            # 本文件
```

## 核心模块

### 1. 主程序入口 (main.go)

异步启动 tcxprober（数据包捕获），同步启动 kbatch（功能调用监控）。

### 2. kbatch — 内核功能调用监控

使用 eBPF 挂钩内核网络函数，收集功能调用信息并存储到 `functioninfo` 数据库。

**核心功能：**
- 监控内核网络函数调用（PID、时间戳、功能 ID、端口、IP 等）
- 支持 IPv4 和 IPv6
- 异步批量写入 PostgreSQL

**数据库表：**
- `functionCall` — 普通功能调用（time, isRet, ID, PID）
- `SpecfunctionCall` — 含网络详情的功能调用（含 srcip, dstip, srcport, dstport, pkt 等）

详细文档：[doc/kbatch.md](doc/kbatch.md)

### 3. tcxprober — 网络数据包捕获

使用 eBPF TC 钩子捕获指定网络接口的 ingress/egress 数据包，存储到 `tcxprober` 数据库。

**核心功能：**
- 双向流量捕获（ingress / egress）
- 捕获数据包方向、时间戳、接口索引、负载长度、负载内容
- 批量写入 PostgreSQL

**数据库表：**
- `packets` — 数据包信息（direction, timestamp, netifidx, payloadlen, payload）

**命令行参数：**
- `-iface`：指定网络接口，默认 `ens33`

详细文档：[doc/tcxprober.md](doc/tcxprober.md)

### 4. server — API 查询服务

提供 HTTP API，用于查询数据库中的网络数据，默认监听 `http://localhost:8010`。

**接口列表：**

| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/GetRecentPacket` | 获取最近数据包 |
| POST | `/GetRecentMap` | 获取最近功能调用映射 |
| GET | `/GetFuncTable` | 获取功能 ID 映射表 |
| POST | `/QueryFuncSend` | 查询发送功能调用 |
| POST | `/QueryFuncRecv` | 查询接收功能调用 |
| POST | `/QueryPacket` | 查询数据包 |
| GET | `/QuerySockList` | 获取网络套接字列表 |

详细文档：[doc/server-api.md](doc/server-api.md)

## 依赖

- **Go** >= 1.24
- **clang / llvm**（编译 eBPF C 代码）
- **Linux 内核** >= 6.8（eBPF 支持）
- **PostgreSQL**（数据存储）
- Go 主要依赖：
  - `github.com/cilium/ebpf` — eBPF 程序加载和管理
  - `github.com/lib/pq` — PostgreSQL 驱动
  - `github.com/florianl/go-tc` — TC 钩子附加
  - `github.com/vishvananda/netlink` — 网络接口管理

## 安装

> 完整安装步骤详见 [doc/install.md](doc/install.md)

### 1. 安装系统依赖

```bash
sudo apt-get update && sudo apt-get install -y \
    curl wget git make cmake build-essential golang-go \
    gcc g++ clang llvm libbpf-dev linux-headers-generic \
    linux-tools-generic linux-tools-common bpfcc-tools \
    libbpf-tools iproute2 net-tools tcpdump \
    libelf-dev zlib1g-dev pkg-config postgresql-client
```

### 2. 安装 bpf2go 工具

```bash
go install github.com/cilium/ebpf/cmd/bpf2go@latest
```

### 3. 配置 PostgreSQL

```bash
# 启动服务
sudo service postgresql start

# 设置密码
psql -h localhost -p 5432 -U postgres -c "ALTER USER postgres WITH PASSWORD 'password';"

# 创建数据库
createdb -h localhost -p 5432 -U postgres tcxprober
createdb -h localhost -p 5432 -U postgres functioninfo
```

详细数据库配置：[doc/database.md](doc/database.md)

### 4. 配置环境变量

```bash
export CGO_ENABLED=1
export PG_HOST=localhost
export PG_PORT=5432
export PG_USER=postgres
export PG_PASSWORD=password
export PG_DBNAME_PACKET=tcxprober
export PG_DBNAME_FUNCTION=functioninfo
export PG_SSLMODE=disable
```

### 5. 编译

```bash
make prepare && make && make server
```

### 6. 运行

```bash
sudo ./analyzer   # 启动数据采集（kbatch + tcxprober）
./qserver         # 启动 API 查询服务
```

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| PG_HOST | localhost | PostgreSQL 主机地址 |
| PG_PORT | 5432 | PostgreSQL 端口 |
| PG_USER | postgres | PostgreSQL 用户名 |
| PG_PASSWORD | password | PostgreSQL 密码 |
| PG_DBNAME_PACKET | tcxprober | 数据包数据库名称 |
| PG_DBNAME_FUNCTION | functioninfo | 函数信息数据库名称 |
| PG_SSLMODE | disable | SSL 连接模式 |
| GOPROXY | https://goproxy.cn,direct | Go 模块代理（国内推荐） |

## 注意事项

1. 运行 `analyzer` 需要 sudo 权限（加载 eBPF 程序）
2. 建议在 Ubuntu 24.04 环境下运行
3. 确保已安装匹配当前内核版本的 linux-headers
4. 生产环境中建议为 PostgreSQL 创建专用用户并设置强密码
