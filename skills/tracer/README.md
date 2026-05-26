# PacketScope Tracer Skill & MCP Server

这是一个用于与 PacketScope Tracer 模块 API 交互的 Skill 和 MCP Server。

## 功能

- **路由追踪**：支持 ICMP 和 TCP 协议的 traceroute
- **风险分析**：路径异常检测和风险评分（0-100）
- **历史记录**：查询和对比历史路由数据
- **恶意IP检测**：基于威胁情报的风险告警
- **MCP Server**：提供 MCP 工具集成

## 安装

### Python 客户端

```bash
pip install requests
```

### MCP Server

```bash
cd skills/tracer
pip install -r requirements.txt
```

## 使用方法

### Python 客户端示例

```python
from tracer_client import TracerClient

# 创建客户端
client = TracerClient("http://localhost:8000")

# ICMP 追踪
result = client.trace("8.8.8.8")
print(f"Hops: {len(result.hops)}, Source: {result.source}")

# TCP 追踪
result = client.trace("1.1.1.1", protocol="tcp", port=443)
print(f"Hops: {len(result.hops)}")

# 风险分析
analysis = client.analyze("8.8.8.8")
print(f"Risk Score: {analysis.risk_score}, Anomalies: {len(analysis.anomalies)}")

# 历史记录
history = client.get_history(target="8.8.8.8")
print(f"Records: {len(history.get('8.8.8.8', []))}")

# 健康检查
ready = client.is_ready()
print(f"Ready: {ready}")
```

### MCP Server

Tracer MCP Server 支持两种运行模式：

---

#### 📟 模式一：Stdio 模式（推荐）
MCP 客户端直接启动服务器进程，通过标准输入输出通信。

**启动方式：**

```bash
cd skills/tracer

# 使用启动脚本
./start.sh

# 或直接运行
python3 mcp_server.py
```

**MCP 客户端配置：** (`config.example.json`)

```json
{
  "mcpServers": {
    "packetscope-tracer": {
      "command": "/path/to/packetscope/skills/tracer/start.sh",
      "env": {
        "TRACER_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

---

#### 🌐 模式二：HTTP 模式（独立运行）
用户先手动启动服务器，MCP 客户端通过 HTTP SSE 连接。

**启动服务器：**

```bash
cd skills/tracer

# 使用HTTP启动脚本
./start-http.sh

# 或设置环境变量后运行
export TRACER_MCP_TRANSPORT="streamable-http"
export TRACER_MCP_PORT="8013"
python3 mcp_server.py
```

**MCP 客户端配置：** (`config.http.json`)

```json
{
  "mcpServers": {
    "packetscope-tracer": {
      "url": "http://localhost:8013/sse"
    }
  }
}
```

---

#### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `TRACER_MCP_NAME` | `packetscope-tracer` | MCP 服务器名称 |
| `TRACER_MCP_HOST` | `127.0.0.1` | HTTP 服务器主机（仅HTTP模式） |
| `TRACER_MCP_PORT` | `8013` | HTTP 服务器端口（仅HTTP模式） |
| `TRACER_API_URL` | `http://localhost:8000` | Tracer API 地址 |
| `TRACER_MCP_TRANSPORT` | `stdio` | 传输方式（`stdio` 或 `streamable-http`） |

#### MCP 工具列表

| 工具 | 说明 |
|------|------|
| `trace_target` | 追踪目标路由（支持 ICMP/TCP） |
| `analyze_target` | 分析路径异常和风险评分 |
| `get_history` | 查询历史路由记录 |
| `get_trace_detail` | 获取特定跳点详细信息 |
| `compare_routes` | 对比当前路径与历史路径 |
| `health_check` | 服务健康检查 |
| `server_capabilities` | 获取服务能力与示例 |

## API 端点

### 路由追踪

- `GET /api/trace?target=...&use_cache=...&protocol=...&port=...` - 追踪目标路由

### 风险分析

- `GET /api/analyze?target=...&cache=...` - 分析路径异常

### 历史记录

- `GET /api/history?target=...` - 查询历史记录

### 状态检查

- `GET /api/ready` - 服务就绪检查

## 项目结构

```
skills/tracer/
├── SKILL.md              # Skill 文档（API 参考）
├── PROMPTS.md            # 自然语言提示词模板
├── QUICKSTART.md         # 5 分钟快速入门
├── tracer_client.py      # Python 客户端库
├── mcp_server.py         # MCP Server
├── requirements.txt      # Python 依赖
├── start.sh              # Stdio 启动脚本
├── start-http.sh         # HTTP 启动脚本
├── config.example.json   # MCP 配置示例（Stdio）
├── config.http.json      # MCP 配置示例（HTTP）
└── README.md             # 使用说明
```

## 许可证

与 PacketScope 项目相同
