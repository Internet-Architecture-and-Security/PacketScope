# Server API 文档

## 1. 概述

PacketScope Analyzer Server 提供了一组 RESTful API 接口，用于查询和分析存储在数据库中的网络数据。这些 API 允许用户获取网络数据包信息、内核功能调用信息和网络套接字状态等。

## 2. 基础信息

### 2.1 服务器地址

默认地址：`http://localhost:8010`

### 2.2 请求格式

所有 API 接受以下请求格式：
- GET 请求：参数通过 URL 查询字符串传递
- POST 请求：参数通过表单形式（application/x-www-form-urlencoded）传递

### 2.3 响应格式

所有 API 响应为 JSON 格式。

## 3. API 端点

### 3.1 获取最近数据包

**端点：** `POST /GetRecentPacket`

**功能：** 获取最近的网络数据包信息

**请求参数：**
| 参数名 | 类型 | 描述 | 必填 |
|--------|------|------|------|
| srcip | string | 源 IP 地址 | 是 |
| dstip | string | 目标 IP 地址 | 是 |
| srcport | string | 源端口 | 是 |
| dstport | string | 目标端口 | 是 |
| ipver | string | IP 版本（"4" 或 "6"） | 是 |
| count | string | 返回的数据包数量 | 是 |

**响应示例：**
```json
[
  {
    "time": 1621545600.123,
    "isRet": 0,
    "ID": 200000,
    "PID": 12345,
    "family": 4,
    "srcport": 12345,
    "dstport": 80,
    "srcip": "192.168.1.100",
    "dstip": "10.0.0.1",
    "pkt": "hexadecimal_payload"
  }
]
```

### 3.2 获取最近功能调用映射

**端点：** `POST /GetRecentMap`

**功能：** 获取最近的功能调用映射信息

**请求参数：**
| 参数名 | 类型 | 描述 | 必填 |
|--------|------|------|------|
| srcip | string | 源 IP 地址 | 是 |
| dstip | string | 目标 IP 地址 | 是 |
| srcport | string | 源端口 | 是 |
| dstport | string | 目标端口 | 是 |
| count | string | 返回的映射数量 | 是 |
| timeDownLimit | string | 最小时间戳 | 是 |

**响应示例：**
```json
[
  [
    [
      {
        "time": 1621545600.123,
        "isRet": 0,
        "ID": 300000,
        "PID": 12345
      }
    ]
  ]
]
```

### 3.3 获取功能ID映射表

**端点：** `GET /GetFuncTable`

**功能：** 获取功能 ID 与功能名称的映射表

**请求参数：** 无

**响应示例：**
```json
{
  "100001": "function_name_1",
  "100002": "function_name_2"
}
```

### 3.4 查询发送功能调用

**端点：** `POST /QueryFuncSend`

**功能：** 查询与发送操作相关的功能调用

**请求参数：**
| 参数名 | 类型 | 描述 | 必填 |
|--------|------|------|------|
| srcip | string | 源 IP 地址 | 是 |
| dstip | string | 目标 IP 地址 | 是 |
| srcport | string | 源端口 | 是 |
| dstport | string | 目标端口 | 是 |

**响应示例：**
```json
[
  [
    {
      "time": 1621545600.123,
      "isRet": 0,
      "ID": 200002,
      "PID": 12345
    }
  ]
]
```

### 3.5 查询接收功能调用

**端点：** `POST /QueryFuncRecv`

**功能：** 查询与接收操作相关的功能调用

**请求参数：**
| 参数名 | 类型 | 描述 | 必填 |
|--------|------|------|------|
| srcip | string | 源 IP 地址 | 是 |
| dstip | string | 目标 IP 地址 | 是 |
| srcport | string | 源端口 | 是 |
| dstport | string | 目标端口 | 是 |

**响应示例：**
```json
[
  [
    {
      "time": 1621545600.123,
      "isRet": 0,
      "ID": 200000,
      "PID": 12345
    }
  ]
]
```

### 3.6 查询数据包

**端点：** `POST /QueryPacket`

**功能：** 查询符合条件的数据包

**请求参数：**
| 参数名 | 类型 | 描述 | 必填 |
|--------|------|------|------|
| srcip | string | 源 IP 地址 | 是 |
| dstip | string | 目标 IP 地址 | 是 |
| srcport | string | 源端口 | 是 |
| dstport | string | 目标端口 | 是 |
| ipver | string | IP 版本（"4" 或 "6"） | 是 |

**响应示例：**
```json
[
  {
    "id": 1,
    "direction": 1,
    "timestamp": 1621545600123456789,
    "netifidx": 2,
    "payloadlen": 1500,
    "payload": "hexadecimal_payload"
  }
]
```

### 3.7 获取网络套接字列表

**端点：** `GET /QuerySockList`

**功能：** 获取当前系统的网络套接字列表

**请求参数：** 无

**响应示例：**
```json
{
  "tcpipv4": [
    [
      1621545600.123,
      "1",
      "192.168.1.100:80",
      "10.0.0.1:443",
      "01(ESTABLISHED)"
    ]
  ],
  "tcpipv6": [],
  "udpipv4": [],
  "udpipv6": [],
  "icmpipv4": [],
  "icmpipv6": [],
  "rawipv4": [],
  "rawipv6": [],
  "dev": []
}
```

## 4. 数据结构

### 4.1 功能调用条目

```json
{
  "time": 1621545600.123,  // 时间戳（秒）
  "isRet": 0,              // 0 = 调用开始，1 = 调用返回
  "ID": 200000,            // 功能 ID
  "PID": 12345             // 进程 ID
}
```

### 4.2 数据包条目

```json
{
  "id": 1,                      // 数据包 ID
  "direction": 1,               // 0 = 入站，1 = 出站
  "timestamp": 1621545600123456789,  // 时间戳（纳秒）
  "netifidx": 2,                // 网络接口索引
  "payloadlen": 1500,           // 负载长度
  "payload": "hexadecimal_payload"  // 负载（十六进制）
}
```

### 4.3 网络套接字条目

```json
[
  1621545600.123,        // 时间戳（秒）
  "1",                   // ID
  "192.168.1.100:80",   // 源 IP:端口
  "10.0.0.1:443",       // 目标 IP:端口
  "01(ESTABLISHED)"     // 状态
]
```

## 5. 功能 ID 说明

| ID 范围 | 描述 |
|---------|------|
| 200000-200001 | 接收操作相关功能 |
| 200002-200007 | 发送操作相关功能 |
| 300000+ | 其他功能调用 |

## 6. 状态代码

| 代码 | 描述 |
|------|------|
| 01 | ESTABLISHED |
| 02 | SYN_SENT |
| 03 | SYN_RECV |
| 04 | FIN_WAIT1 |
| 05 | FIN_WAIT2 |
| 06 | TIME_WAIT |
| 07 | CLOSE |
| 08 | CLOSE_WAIT |
| 09 | LAST_ACK |
| 0A | LISTEN |
| 0B | CLOSING |

## 7. 使用示例

### 7.1 获取最近10个数据包

```bash
curl -X POST http://localhost:8010/GetRecentPacket \
  -d "srcip=192.168.1.100" \
  -d "dstip=10.0.0.1" \
  -d "srcport=12345" \
  -d "dstport=80" \
  -d "ipver=4" \
  -d "count=10"
```

### 7.2 查询发送功能调用

```bash
curl -X POST http://localhost:8010/QueryFuncSend \
  -d "srcip=192.168.1.100" \
  -d "dstip=10.0.0.1" \
  -d "srcport=12345" \
  -d "dstport=80"
```

### 7.3 获取功能 ID 映射表

```bash
curl -X GET http://localhost:8010/GetFuncTable
```

### 7.4 获取网络套接字列表

```bash
curl -X GET http://localhost:8010/QuerySockList
```

## 8. 错误处理

服务器会返回以下常见错误：

- `400 Bad Request`：请求参数错误
- `500 Internal Server Error`：服务器内部错误
- `503 Service Unavailable`：服务不可用（如数据库连接失败）

**错误响应示例：**
```json
{
  "error": "Database connection failed"
}
```

## 9. 性能考虑

- 对于大数据集查询，建议使用适当的过滤条件
- 限制返回的记录数量可以提高查询性能
- 避免在高峰期进行大规模查询

## 10. 安全注意事项

- 服务器默认不进行身份验证，请确保在生产环境中添加适当的安全措施
- 建议使用 HTTPS 加密传输
- 限制访问服务器的 IP 地址范围

---

**文档生成时间：** 2026-04-21
**文档版本：** 1.0