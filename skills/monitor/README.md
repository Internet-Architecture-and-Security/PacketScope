# PacketScope Monitor Skill & MCP Server

这是一个用于与 PacketScope Monitor 模块 API 交互的 Skill 和 MCP Server。

## 功能

- **数据包查询**：获取最近的网络数据包信息
- **功能调用跟踪**：查询内核网络功能调用
- **套接字监控**：获取当前网络套接字列表
- **功能映射表**：查看功能ID与名称的对应关系
- **MCP Server**：提供 MCP 工具集成

## 安装

### Python 客户端

```bash
pip install requests
```

### MCP Server

```bash
cd skills/monitor
pip install -r requirements.txt
```

## 使用方法

### Python 客户端示例

```python
from monitor_client import MonitorClient

# 创建客户端
client = MonitorClient("http://localhost:8010")

# 获取最近的数据包
packets = client.get_recent_packets(
    src_ip="192.168.1.100",
    dst_ip="10.0.0.1",
    count=10
)
print(f"Got {len(packets)} packets")

# 获取套接字列表
sockets = client.get_socket_list()
print(f"TCP IPv4 sockets: {len(sockets.get('tcpipv4', []))}")

# 查询发送功能调用
func_send = client.query_func_send(
    src_ip="192.168.1.100",
    dst_ip="10.0.0.1"
)
print(f"Function calls: {func_send}")
```

### MCP Server

#### 方式一：使用启动脚本

```bash
cd skills/monitor

# 设置环境变量（可选）
export MONITOR_API_URL="http://localhost:8010"
export MONITOR_MCP_PORT="8012"

# 启动服务器
./start.sh
```

#### 方式二：直接运行

```bash
cd skills/monitor
python3 mcp_server.py
```

#### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MONITOR_MCP_NAME` | `packetscope-monitor` | MCP 服务器名称 |
| `MONITOR_MCP_HOST` | `127.0.0.1` | HTTP 服务器主机 |
| `MONITOR_MCP_PORT` | `8012` | HTTP 服务器端口 |
| `MONITOR_API_URL` | `http://localhost:8010` | Monitor API 地址 |
| `MONITOR_MCP_TRANSPORT` | `stdio` | 传输方式 (`stdio` 或 `http`) |

#### MCP 配置示例

在 Claude Desktop 的配置文件中添加：

```json
{
  "mcpServers": {
    "packetscope-monitor": {
      "command": "/path/to/packetscope/skills/monitor/start.sh",
      "env": {
        "MONITOR_API_URL": "http://localhost:8010"
      }
    }
  }
}
```

#### MCP 工具列表

| 工具 | 说明 |
|------|------|
| `get_recent_packets` | 获取最近的网络数据包 |
| `query_packets` | 查询符合条件的数据包 |
| `get_recent_map` | 获取最近的功能调用映射 |
| `get_func_table` | 获取功能ID映射表 |
| `get_function_name` | 通过ID获取功能名称 |
| `query_func_send` | 查询发送功能调用 |
| `query_func_recv` | 查询接收功能调用 |
| `get_socket_list` | 获取网络套接字列表 |
| `get_established_tcp_sockets` | 获取已建立的TCP连接 |
| `is_attach_finished` | 检查eBPF探针加载状态 |
| `health_check` | 服务健康检查 |
| `server_capabilities` | 获取服务能力与示例 |

## API 端点

### 数据包相关

- `POST /GetRecentPacket` - 获取最近的网络数据包
- `POST /QueryPacket` - 查询符合条件的数据包

### 功能调用相关

- `POST /GetRecentMap` - 获取最近的功能调用映射
- `GET /GetFuncTable` - 获取功能ID映射表
- `POST /QueryFuncSend` - 查询发送功能调用
- `POST /QueryFuncRecv` - 查询接收功能调用

### 套接字相关

- `GET /QuerySockList` - 获取网络套接字列表

### 状态相关

- `GET /IsAttachFinished` - 检查加载状态

## 项目结构

```
packetscope-monitor-skill/
├── SKILL.md              # Skill 文档（API 参考）
├── monitor_client.py     # Python 客户端库
├── mcp_server.py         # MCP Server
├── requirements.txt      # Python 依赖
├── start.sh              # 启动脚本
├── config.example.json   # MCP 配置示例
└── README.md             # 使用说明
```

## 许可证

与 PacketScope 项目相同
