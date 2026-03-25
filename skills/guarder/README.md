# PacketScope Guarder Skill

这是一个用于与 PacketScope Guarder 模块 API 交互的 Skill。

## 功能

- **连接监控**: 获取实时 TCP/UDP 连接和 ICMP 流量
- **过滤器管理**: 创建、更新、删除和启用/禁用过滤器规则
- **AI 分析**: 使用大模型分析网络流量并生成过滤器规则
- **PCAP 分析**: 上传 PCAP 文件并使用大模型进行深度分析

## 安装

### Python 客户端

```bash
pip install requests
```

### Guarder 模块 PCAP 支持（可选）

如需启用 PCAP 分析功能，需要安装 libpcap 开发库并重新编译：

```bash
# Ubuntu/Debian
sudo apt-get install libpcap-dev

# 重新编译 Guarder
cd modules/Guarder
go build -tags pcap -o conn-tracker ./cmd/conn-tracker
```

## 使用方法

### Python 客户端示例

```python
from guarder_client import GuarderClient, FilterRule, AIConfig

# 创建客户端
client = GuarderClient("http://localhost:8080")

# 获取连接列表
connections = client.get_connections()
print(f"Active connections: {len(connections)}")

# 获取统计信息
stats = client.get_stats()
print(f"Total packets: {stats['TotalPackets']}")

# 创建过滤器规则
rule = FilterRule(
    src_ip="192.168.1.100",
    protocol="any",
    action="drop",
    comment="Block suspicious IP"
)
result = client.create_filter(rule)
print(f"Created filter with ID: {result['id']}")

# AI 分析流量
analysis = client.ai_analyze(
    custom_prompt="Focus on identifying port scanning behavior",
    analyze_type="security"
)
print(f"AI Analysis: {analysis['summary']}")

# AI 生成过滤器
filters = client.ai_generate_filters(
    custom_prompt="Block IPs with more than 100 connections",
    analyze_type="security"
)
print(f"Generated filters: {filters['filters']}")

# 上传并分析 PCAP 文件（需要启用 pcap 支持）
pcap_result = client.analyze_pcap(
    file_path="/path/to/capture.pcap",
    custom_prompt="Identify malware C2 communication",
    analyze_type="security"
)
print(f"Threats found: {pcap_result['threats']}")
```

### 快速函数

```python
from guarder_client import block_ip, block_port, create_simple_filter

# 快速阻止 IP
block_ip(client, "192.168.1.100", "Block attacker IP")

# 快速阻止端口
block_port(client, 3389, "tcp", "Block RDP access")

# 创建简单规则
create_simple_filter(
    client,
    src_ip="10.0.0.0/8",
    dst_port=80,
    protocol="tcp",
    action="allow",
    comment="Allow internal HTTP"
)
```

## API 端点

### 连接监控
- `GET /api/connections` - 获取 TCP/UDP 连接
- `GET /api/icmp` - 获取 ICMP 流量
- `GET /api/stats` - 获取性能统计

### 过滤器管理
- `GET /api/filters` - 列出所有过滤器
- `POST /api/filters` - 创建过滤器
- `GET /api/filters/{id}` - 获取特定过滤器
- `PUT /api/filters/{id}` - 更新过滤器
- `DELETE /api/filters/{id}` - 删除过滤器
- `POST /api/filters/{id}/enable` - 启用过滤器
- `POST /api/filters/{id}/disable` - 禁用过滤器

### AI 功能
- `GET /api/ai/status` - 获取 AI 配置状态
- `GET /api/ai/config` - 获取 AI 配置
- `POST /api/ai/config` - 更新 AI 配置
- `POST /api/ai/generate` - AI 生成过滤器
- `POST /api/ai/analyze` - AI 分析流量

### PCAP 分析
- `POST /api/pcap/analyze` - 上传并分析 PCAP 文件

## 配置 AI

在使用 AI 功能前，需要配置 OpenAI API：

```python
config = AIConfig(
    openai_endpoint="https://api.openai.com/v1/chat/completions",
    api_key="your-api-key",
    model="gpt-4",
    temperature=0.7,
    debug=False,
    timeout=120
)
client.update_ai_config(config)
```

## 项目结构

```
packetscope-guarder-skill/
├── SKILL.md              # Skill 文档（API 参考）
├── guarder_client.py     # Python 客户端库
└── README.md             # 使用说明
```

## 添加的 Guarder 功能

本项目在 Guarder 模块中添加了 PCAP 分析功能：

### 新增文件
- `cmd/conn-tracker/pcap_analyzer_pcap.go` - 完整 PCAP 分析实现（带 pcap 构建标签）
- `cmd/conn-tracker/pcap_stub.go` - 存根实现（无 pcap 依赖）

### 修改的文件
- `cmd/conn-tracker/api.go` - 添加 PCAPAnalyzer 到 APIServer，注册新路由

### PCAP 分析功能
- 解析 PCAP 文件并提取网络统计信息
- 识别协议分布、Top IP、Top 端口
- 检测 TCP 标志异常（如 SYN Flood）
- 使用大模型进行安全威胁分析
- 返回结构化威胁报告

## 许可证

与 PacketScope 项目相同
