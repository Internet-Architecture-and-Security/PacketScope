# tcxprober 模块文档

## 1. 概述

tcxprober 是 PacketScope Analyzer 项目的网络数据包捕获模块，使用 eBPF 技术实现高效的网络数据包过滤和捕获。该模块负责在指定的网络接口上捕获数据包，并将捕获的数据包详细信息存储到 PostgreSQL 数据库中。

## 2. 核心功能

- **高效数据包捕获**：使用 eBPF 技术在网络接口层面捕获数据包，性能开销低
- **双向流量支持**：支持捕获网络接口的 ingress（入站）和 egress（出站）流量
- **完整数据包信息**：捕获数据包的完整元数据，包括方向、时间戳、接口索引、负载长度和负载内容
- **数据存储**：将捕获的数据包存储到 PostgreSQL 数据库中
- **可配置性**：支持通过命令行参数指定网络接口

## 3. 数据结构

### 3.1 packetMetadata 结构体

用于存储数据包的元数据信息，与 eBPF 程序中定义的结构体对应。

```go
type packetMetadata struct {
    Direction  uint64     // 数据包方向（0=ingress，1=egress）
    Timestamp  uint64     // 时间戳（纳秒）
    Netifidx   uint64     // 网络接口索引
    Payloadlen uint64     // 负载长度
    Payload    [6144]byte // 负载内容
}
```

## 4. 主要函数

### 4.1 TcxExample()

模块的主函数，负责初始化和运行整个 tcxprober 模块。

```go
func TcxExample() error
```

**功能：**
- 解析命令行参数
- 查找指定的网络接口
- 加载 eBPF 对象
- 初始化 PostgreSQL 数据库
- 创建必要的数据表
- 附加 eBPF 程序到网络接口
- 启动数据处理协程
- 等待信号退出

## 5. 数据库结构

### 5.1 packets 表

存储捕获的数据包信息。

| 字段名 | 数据类型 | 描述 |
|--------|----------|------|
| id | SERIAL | 自增主键 |
| direction | BIGINT | 数据包方向（0=ingress，1=egress） |
| timestamp | BIGINT | 时间戳（纳秒） |
| netifidx | BIGINT | 网络接口索引 |
| payloadlen | BIGINT | 负载长度 |
| payload | BYTEA | 负载内容 |

## 6. 配置和使用

### 6.1 命令行参数

| 参数名 | 类型 | 描述 | 默认值 |
|--------|------|------|-------|
| -iface | string | 要附加的网络接口名称 | ens33 |

### 6.2 环境变量

支持通过以下环境变量配置数据库连接：

| 环境变量 | 描述 | 默认值 |
|---------|------|-------|
| POSTGRES_HOST | PostgreSQL 服务器地址 | localhost |
| POSTGRES_PORT | PostgreSQL 服务器端口 | 5432 |
| POSTGRES_USER | PostgreSQL 用户名 | postgres |
| POSTGRES_PASSWORD | PostgreSQL 密码 | password |
| POSTGRES_DB | PostgreSQL 数据库名 | tcxprober |

### 6.3 运行方式

#### 6.3.1 通过主程序调用

tcxprober 模块通常通过主程序入口 `main.go` 调用：

```go
go func() {
    if err := tcxprober.TcxExample(); err != nil {
        log.Fatalf("TcxExample failed: %v", err)
    }
    log.Println("TcxExample completed")
}()
```

#### 6.3.2 单独运行

也可以单独编译和运行 tcxprober 模块：

```bash
# 生成 eBPF 程序
go generate ./tcxprober/tcxProber.go

# 编译模块
go build -o tcxProber ./tcxprober/tcxProber.go

# 运行（需要管理员权限）
sudo ./tcxProber -iface=ens33
```

## 7. 工作流程

1. **参数解析**：解析命令行参数，确定要监控的网络接口
2. **接口查找**：查找指定名称的网络接口，获取接口索引
3. **eBPF 加载**：加载编译好的 eBPF 对象到内核
4. **数据库初始化**：连接 PostgreSQL 数据库，创建必要的数据表
5. **eBPF 附加**：将 eBPF 程序附加到网络接口的 ingress 和 egress 钩子
6. **数据处理**：启动 goroutine 处理从 eBPF 程序收集的数据包
7. **信号处理**：等待用户中断信号（如 Ctrl+C）
8. **资源清理**：移除 eBPF 程序，关闭数据库连接

## 8. 技术实现细节

### 8.1 eBPF 程序加载

使用 `go generate` 命令生成 eBPF 程序的 Go 绑定代码：

```go
//go:generate go run github.com/cilium/ebpf/cmd/bpf2go tcxProber tcxProber.bpf.c -- -I./headers -I/usr/include/x86_64-linux-gnu
```

然后使用生成的代码加载 eBPF 对象：

```go
var objs tcxProberObjects
err = loadTcxProberObjects(&objs, nil)
```

### 8.2 TC 程序附加

使用 `github.com/florianl/go-tc` 库将 eBPF 程序附加到网络接口的 TC（Traffic Control）钩子：

1. 创建 TC 句柄
2. 配置 ingress 和 egress qdisc（队列规则）
3. 附加 eBPF 程序到 qdisc

### 8.3 数据包处理

使用 `perf` 事件缓冲区从内核接收捕获的数据包：

```go
rd, err := perf.NewReader(objs.tcxProberMaps.TcxEvents, os.Getpagesize())
```

然后在循环中读取和处理数据包：

```go
for {
    record, err := rd.Read()
    // 处理数据包
}
```

### 8.4 数据存储

使用批量插入的方式将数据包存储到数据库中，提高性能：

```go
tx, err := db.Begin()
stmt, err := tx.Prepare("INSERT INTO packets (direction, timestamp, netifidx, payloadlen, payload) VALUES ($1, $2, $3, $4, $5)")

for _, packet := range currentPackets {
    _, err = stmt.Exec(packet.Direction, packet.Timestamp, packet.Netifidx, packet.Payloadlen, packet.Payload[:packet.Payloadlen])
}
	err = tx.Commit()
```

## 9. 性能考虑

- 使用 eBPF 技术在网络内核空间捕获数据包，减少用户空间和内核空间之间的数据拷贝
- 采用批量插入的方式存储数据，减少数据库连接开销
- 可配置的缓冲区大小，适应不同的网络流量情况
- 负载过滤功能，只捕获感兴趣的数据包（可在 eBPF 程序中配置）

## 10. 调试和故障排除

### 10.1 常见问题

**问题：** 无法找到指定的网络接口
**解决方案：**
- 使用 `ifconfig` 或 `ip addr` 命令确认网络接口名称
- 确保网络接口处于激活状态

**问题：** 无法附加 eBPF 程序到网络接口
**解决方案：**
- 确保以管理员权限运行程序
- 检查网络接口是否支持 TC 钩子
- 确认内核版本支持 eBPF 功能

**问题：** 数据库连接失败
**解决方案：**
- 确保 PostgreSQL 服务正在运行
- 检查数据库连接参数是否正确
- 确保数据库用户具有正确的权限

### 10.2 日志和调试信息

程序使用标准的 Go 日志库输出调试信息，可以通过设置环境变量 `GODEBUG=ebpf=1` 获取更详细的 eBPF 调试信息。

## 11. 扩展和定制

### 11.1 修改捕获的数据包字段

要修改捕获的数据包字段，需要：
1. 更新 eBPF 程序中的 `packet_metadata` 结构体
2. 更新 Go 代码中的 `packetMetadata` 结构体
3. 更新数据库表结构
4. 更新数据处理和存储代码

### 11.2 添加数据包过滤功能

可以在 eBPF 程序中添加过滤逻辑，只捕获感兴趣的数据包：

```c
// 在 eBPF 程序中添加过滤条件
if (ip->protocol != IPPROTO_TCP) {
    return TC_ACT_OK;
}
```

### 11.3 支持更多网络接口

可以修改代码，支持同时在多个网络接口上捕获数据包：

1. 扩展命令行参数，支持指定多个网络接口
2. 为每个网络接口创建独立的 eBPF 程序和处理协程

---

**文档生成时间：** 2026-04-21
**文档版本：** 1.0