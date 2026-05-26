# PacketScope Analyzer 项目文档

## 1. 项目概述

PacketScope Analyzer 是一个网络数据包分析和监控系统，使用 eBPF 技术实现高效的网络流量捕获、分析和功能调用跟踪。该系统由多个核心模块组成，包括数据包捕获、功能调用分析和API服务等。

## 2. 目录结构

```
Analyzer/
├── .cache/              # 缓存文件目录（中间文件）
├── .trae/               # Trae IDE相关文件
│   └── skills/          # 智能体调用技能
│       ├── network-analyzer/  # 网络分析技能
│       └── port-info/   # 端口信息技能
├── base/                # 基础功能模块
├── doc/                 # 项目文档目录（当前目录）
├── kbatch/              # 内核功能调用监控模块
├── server/              # API服务器模块
├── tcxprober/           # 网络数据包捕获模块
├── test/                # 测试代码目录
├── DBreadme.md          # 数据库配置文档
├── Makefile             # 项目构建文件
├── analyzer             # 编译后的可执行文件
├── baserun              # 基础运行程序
├── database.md          # 数据库说明文档
├── go.mod               # Go模块定义
├── go.sum               # Go模块依赖
├── main.go              # 项目主入口
└── readme               # 项目说明文件
```

## 3. 核心模块说明

### 3.1 主程序入口 (main.go)

主程序入口文件，负责初始化和启动各个核心模块。它使用 goroutine 异步调用 tcxprober 模块，然后同步调用 kbatch 模块。

**核心功能：**
- 异步启动网络数据包捕获模块 (tcxprober)
- 同步启动内核功能调用监控模块 (kbatch)
- 协调各个模块的运行和资源管理

### 3.2 内核功能调用监控模块 (kbatch)

负责监控内核中的网络相关功能调用，使用 eBPF 技术挂钩到内核函数，收集功能调用信息并存储到数据库中。

**核心文件：**
- `kbacth.go`：主要功能实现文件
- `kProberFunc.bpf.c`：eBPF 程序源文件（生成文件，不包含在文档中）

**核心功能：**
- 加载 eBPF 程序并挂钩到内核网络函数
- 收集内核功能调用的详细信息（PID、时间戳、功能ID、端口等）
- 将收集到的数据存储到 PostgreSQL 数据库
- 支持 IPv4 和 IPv6 协议

### 3.3 网络数据包捕获模块 (tcxprober)

负责捕获网络接口上的数据包，使用 eBPF 技术实现高效的数据包过滤和捕获，并将结果存储到数据库中。

**核心文件：**
- `tcxProber.go`：主要功能实现文件
- `tcxProber.bpf.c`：eBPF 程序源文件（生成文件，不包含在文档中）

**核心功能：**
- 加载 eBPF 程序并附加到指定网络接口
- 捕获网络数据包的详细信息（方向、时间戳、接口索引、负载等）
- 将捕获的数据包存储到 PostgreSQL 数据库
- 支持 ingress 和 egress 双向流量捕获

### 3.4 API服务器模块 (server)

提供 HTTP API 接口，用于查询和分析存储在数据库中的网络数据。

**核心文件：**
- `main.go`：服务器主入口
- `database.go`：数据库操作实现
- `sockets.go`：网络套接字信息查询实现

**核心功能：**
- 提供 RESTful API 接口
- 支持查询网络数据包信息
- 支持查询内核功能调用信息
- 支持查询网络套接字状态
- 提供数据过滤和排序功能

### 3.5 基础功能模块 (base)

提供项目所需的基础功能，包括 BTF 解析、JSON 转换等。

**核心文件：**
- `ReadBTFandGetItsMember.go`：BTF 解析功能
- `TransUtilSec.go`：工具函数
- `translateJSON.go`：JSON 转换功能
- `baserun.go`：基础运行功能

**核心功能：**
- BTF (BPF Type Format) 解析
- 数据格式转换
- 工具函数集合
- 基础运行环境设置

## 4. 配置和使用方法

### 4.1 环境要求

- Go 1.16 或更高版本
- Linux 内核 5.4 或更高版本（支持 eBPF）
- PostgreSQL 数据库
- 网络接口设备（如 ens33）

### 4.2 数据库配置

系统使用 PostgreSQL 数据库存储捕获的网络数据和功能调用信息。需要创建以下数据库：

- `functioninfo`：存储内核功能调用信息（kbatch 模块使用）
- `tcxprober`：存储网络数据包信息（tcxprober 模块使用）
- `packetinfo`：存储数据包详细信息（server 模块使用）

**配置环境变量：**

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=password
export POSTGRES_DB=functioninfo  # 或 tcxprober、packetinfo
export PG_HOST=localhost
export PG_PORT=5432
export PG_USER=postgres
export PG_PASSWORD=password
export PG_DBNAME_FUNCTION=functioninfo
export PG_DBNAME_PACKET=packetinfo
export PG_SSLMODE=disable
```

### 4.3 编译和运行

**编译项目：**

```bash
# 生成 eBPF 程序并编译整个项目
go generate ./tcxprober/tcxProber.go && CGO_ENABLED=1 go build -o analyzer main.go

# 或使用 Makefile
make
```

**运行项目：**

```bash
# 以管理员权限运行
sudo ./analyzer
```

**运行服务器：**

```bash
cd server
go run main.go
```

## 5. API 接口文档

### 5.1 网络分析 API

**获取最近数据包：**
```
POST /GetRecentPacket
```

**获取最近功能调用映射：**
```
POST /GetRecentMap
```

**获取功能ID映射表：**
```
GET /GetFuncTable
```

**查询发送功能调用：**
```
POST /QueryFuncSend
```

**查询接收功能调用：**
```
POST /QueryFuncRecv
```

**查询数据包：**
```
POST /QueryPacket
```

### 5.2 端口信息 API

**获取网络套接字列表：**
```
GET /QuerySockList
```

## 6. 智能体调用技能

### 6.1 network-analyzer

提供网络分析功能，包括数据包查询、功能调用分析等。

**使用场景：**
- 需要获取网络数据包信息时
- 需要分析内核功能调用时
- 需要查询网络连接状态时

### 6.2 port-info

提供网络端口信息查询功能。

**使用场景：**
- 需要获取网络套接字信息时
- 需要查询端口状态时
- 需要分析网络连接时

## 7. 项目依赖

### 7.1 主要依赖包

- `github.com/cilium/ebpf`：eBPF 程序加载和管理
- `github.com/lib/pq`：PostgreSQL 数据库驱动
- `github.com/florianl/go-tc`：Linux TC (Traffic Control) 接口
- `github.com/vishvananda/netlink`：网络接口和路由管理

### 7.2 依赖管理

项目使用 Go Modules 进行依赖管理，依赖信息存储在 `go.mod` 和 `go.sum` 文件中。

## 8. 测试

项目包含多种测试用例，主要位于 `test/` 目录下：

- `database_test.py`：数据库测试
- `server_api_test.py`：API 接口测试

**运行测试：**

```bash
cd test
python3 database_test.py
python3 server_api_test.py
```

## 9. 常见问题和解决方案

### 9.1 权限问题

**问题：** 运行程序时提示权限不足
**解决方案：** 使用 `sudo` 以管理员权限运行程序

### 9.2 数据库连接问题

**问题：** 无法连接到 PostgreSQL 数据库
**解决方案：**
1. 确保 PostgreSQL 服务已启动
2. 检查数据库连接参数是否正确
3. 确保数据库用户具有正确的权限

### 9.3 eBPF 加载问题

**问题：** 无法加载 eBPF 程序
**解决方案：**
1. 确保内核版本支持 eBPF（5.4+）
2. 确保系统已安装必要的依赖
3. 检查 eBPF 程序代码是否正确

## 10. 开发指南

### 10.1 代码结构

项目采用模块化设计，各个功能模块之间保持低耦合，便于维护和扩展。

### 10.2 新增功能

1. 了解项目的整体结构和现有模块
2. 根据功能需求选择合适的模块
3. 遵循现有代码风格和命名规范
4. 编写测试用例确保功能正确性

### 10.3 提交代码

1. 确保代码通过所有测试
2. 遵循 Git 提交规范
3. 提交前检查代码风格和质量

## 11. 许可证

项目采用 MIT 许可证，详情请参考 LICENSE 文件。

## 12. 联系方式

如有问题或建议，请联系项目维护人员。

---

**文档生成时间：** 2026-04-21
**文档版本：** 1.0