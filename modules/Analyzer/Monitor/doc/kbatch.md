# kbatch 模块文档

## 1. 概述

kbatch 是 PacketScope Analyzer 项目的内核功能调用监控模块，使用 eBPF 技术挂钩到内核网络函数，收集功能调用信息并存储到 PostgreSQL 数据库中。该模块负责监控和分析内核中的网络相关功能调用，为网络流量分析提供底层支持。

## 2. 核心功能

- **内核功能调用监控**：使用 eBPF 技术挂钩到内核网络函数，实时监控功能调用
- **数据收集**：收集功能调用的详细信息，包括 PID、时间戳、功能 ID、端口、IP 地址等
- **数据存储**：将收集到的数据存储到 PostgreSQL 数据库中
- **协议支持**：支持 IPv4 和 IPv6 协议
- **异步处理**：使用 goroutine 实现高效的异步数据处理

## 3. 数据结构

### 3.1 SkProbe 结构体

用于存储内核功能调用的基本信息。

```go
type SkProbe struct {
    Pid          uint32     // 进程 ID
    Padding32    uint32     // 对齐填充
    KernelTime   uint64     // 内核时间戳
    FuncID       uint64     // 功能 ID
    Ret          uint64     // 返回值
    Family       uint64     // 地址族（2=AF_INET, 10=AF_INET6）
    Dport        uint64     // 目标端口
    Lport        uint64     // 本地端口
    Ipv4SendAddr uint32     // IPv4 发送地址
    Ipv4RecvAddr uint32     // IPv4 接收地址
    Ipv6SendAddr [16]uint8  // IPv6 发送地址
    Ipv6RecvAddr [16]uint8  // IPv6 接收地址
}
```

### 3.2 PacketMetadata 结构体

用于存储数据包元数据信息。

```go
type PacketMetadata struct {
    IsPacket   uint64     // 是否为数据包
    Timestamp  uint64     // 时间戳
    Pid        uint64     // 进程 ID
    FuncID     uint64     // 功能 ID
    PayloadLen uint64     // 负载长度
    PayloadHdr [58]uint8  // 负载头部
}
```

## 4. 主要函数

### 4.1 Runkbatch()

模块的主函数，负责初始化和运行整个 kbatch 模块。

```go
func Runkbatch() error
```

**功能：**
- 移除内存锁定限制
- 初始化数据库连接
- 加载 eBPF 程序
- 挂钩到内核功能
- 启动数据处理协程
- 等待信号退出

### 4.2 工具函数

#### 4.2.1 U32ToIpv4(ip uint32) string

将 32 位整数转换为 IPv4 字符串。

```go
func U32ToIpv4(ip uint32) string
```

**参数：**
- `ip`：32 位整数表示的 IPv4 地址

**返回值：**
- IPv4 字符串（例如："192.168.1.1"）

#### 4.2.2 ArrayToIpv6(ip [16]uint8) string

将 16 字节数组转换为 IPv6 字符串。

```go
func ArrayToIpv6(ip [16]uint8) string
```

**参数：**
- `ip`：16 字节数组表示的 IPv6 地址

**返回值：**
- IPv6 字符串（例如："2001:db8::1"）

## 5. 数据库结构

kbatch 模块使用 PostgreSQL 数据库存储收集到的数据，默认数据库名为 `functioninfo`。

### 5.1 functionCall 表

存储普通功能调用信息。

| 字段名 | 数据类型 | 描述 |
|--------|----------|------|
| time | DOUBLE PRECISION | 时间戳 |
| isRet | INTEGER | 是否为返回值（0=调用，1=返回） |
| ID | BIGINT | 功能 ID |
| PID | BIGINT | 进程 ID |

### 5.2 SpecfunctionCall 表

存储特殊功能调用信息，包含网络相关的详细数据。

| 字段名 | 数据类型 | 描述 |
|--------|----------|------|
| time | DOUBLE PRECISION | 时间戳 |
| isRet | INTEGER | 是否为返回值（0=调用，1=返回） |
| ID | BIGINT | 功能 ID |
| PID | BIGINT | 进程 ID |
| family | INTEGER | 地址族（2=AF_INET, 10=AF_INET6） |
| srcport | INTEGER | 源端口 |
| dstport | INTEGER | 目标端口 |
| srcip | VARCHAR | 源 IP 地址 |
| dstip | VARCHAR | 目标 IP 地址 |
| pkt | BYTEA | 数据包内容 |

## 6. 配置和使用

### 6.1 环境变量

kbatch 模块支持通过以下环境变量配置数据库连接：

| 环境变量 | 描述 | 默认值 |
|---------|------|-------|
| POSTGRES_HOST | PostgreSQL 服务器地址 | localhost |
| POSTGRES_PORT | PostgreSQL 服务器端口 | 5432 |
| POSTGRES_USER | PostgreSQL 用户名 | postgres |
| POSTGRES_PASSWORD | PostgreSQL 密码 | password |
| POSTGRES_DB | PostgreSQL 数据库名 | functioninfo |

### 6.2 运行方式

kbatch 模块通常通过主程序入口 `main.go` 调用：

```go
if err := kbatch.Runkbatch(); err != nil {
    log.Fatalf("Runkbatch failed: %v", err)
}
```

也可以单独编译和运行（需要相应的依赖和配置）。

## 7. 工作流程

1. **初始化**：移除内存锁定限制，初始化数据库连接
2. **加载 eBPF 程序**：加载编译好的 eBPF 程序到内核
3. **挂钩内核功能**：将 eBPF 程序挂钩到指定的内核网络函数
4. **启动数据处理**：启动 goroutine 处理收集到的数据
5. **数据收集**：eBPF 程序收集内核功能调用信息
6. **数据处理**：用户空间程序处理收集到的数据
7. **数据存储**：将处理后的数据存储到 PostgreSQL 数据库
8. **等待退出**：等待信号（如 Ctrl+C）退出程序

## 8. 性能考虑

- 使用 eBPF 技术实现高效的数据收集，对系统性能影响小
- 采用异步数据处理和批量插入，提高数据存储效率
- 可通过配置调整数据收集的范围和频率

## 9. 调试和故障排除

### 9.1 常见问题

**问题：** 无法加载 eBPF 程序
**解决方案：**
- 确保内核版本支持 eBPF（5.4+）
- 确保以管理员权限运行程序
- 检查 eBPF 程序代码是否正确

**问题：** 数据库连接失败
**解决方案：**
- 确保 PostgreSQL 服务正在运行
- 检查数据库连接参数是否正确
- 确保数据库用户具有正确的权限

### 9.2 日志和调试信息

程序使用标准的 Go 日志库输出调试信息，可以通过设置环境变量 `GODEBUG=ebpf=1` 获取更详细的 eBPF 调试信息。

## 10. 扩展和定制

### 10.1 添加新的内核功能挂钩

要添加新的内核功能挂钩，需要：
1. 在 `kProberFunc.bpf.c` 中添加新的 eBPF 程序
2. 在 `kbacth.go` 中添加对应的处理代码
3. 更新数据库表结构（如果需要）

### 10.2 自定义数据处理逻辑

可以修改数据处理部分的代码，实现自定义的数据过滤、转换和分析逻辑。

---

**文档生成时间：** 2026-04-21
**文档版本：** 1.0