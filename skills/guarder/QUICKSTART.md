# PacketScope Guarder Skill - 快速入门

## 🚀 5分钟快速开始

### 1. 安装依赖

```bash
cd skills/guarder
pip install -r requirements.txt
```

### 2. 测试可用性

```bash
python3 -c "from guarder_client import GuarderClient; c=GuarderClient(); print(len(c.get_connections()))"
```

应该看到连接数量（整数）。

### 3. 确保 Guarder API 正在运行

Guarder Skill 通过 HTTP 客户端直接连接 Guarder API，无需额外 MCP 服务器。

如果 Guarder API 没有运行，先启动它：

```bash
cd modules/Guarder
go run ./cmd/conn-tracker
```

默认监听端口：`http://localhost:8080`

### 4. 在 Claude Code 中使用

Guarder 已作为 Claude Code Skill 注册，直接输入：

```
/guarder 查看当前所有连接
```

### 5. Python 客户端使用

```python
from guarder_client import GuarderClient, FilterRule

client = GuarderClient("http://localhost:8080")

# 获取连接
connections = client.get_connections()

# 获取统计
stats = client.get_stats()

# 创建过滤规则
rule = FilterRule(src_ip="192.168.1.100", action="drop", comment="Block IP")
client.create_filter(rule)
```

---

## 📝 第一个查询

在 Claude 中输入：

```
/guarder 查看当前所有连接和统计
```

---

## 🎯 常用查询示例

### 连接监控
```
/guarder 查看当前所有TCP连接
/guarder 获取ICMP流量
/guarder 查看性能统计
```

### 过滤规则
```
/guarder 列出所有过滤规则
/guarder 封禁IP 192.168.1.100
/guarder 阻止端口 3389 TCP
```

### AI 分析
```
/guarder AI分析当前网络安全状况
/guarder 用AI生成安全过滤规则
```

### PCAP 分析
```
/guarder 分析PCAP文件 /path/to/capture.pcap
```

---

## 🛠️ 故障排查

### 问题：连接 Guarder API 失败

**检查清单**：
1. Guarder API 是否正在运行？(`curl http://localhost:8080/api/stats`)
2. 端口 8080 是否被占用？
3. 是否需要 root 权限运行？（XDP 需要）

### 问题：XDP 程序加载失败

Guarder 使用 XDP 进行数据包过滤，需要：
1. Linux 内核 >= 5.4
2. 支持的网卡驱动
3. root 或 CAP_NET_ADMIN 权限

### 问题：AI 功能不可用

**检查**：
```bash
curl http://localhost:8080/api/ai/status
```

如果 `is_configured` 为 false，需要先配置 AI provider。

---

## 📚 更多文档

- `README.md` - 完整使用说明
- `PROMPTS.md` - 调用提示词组大全
- `SKILL.md` - API参考文档
- `guarder_client.py` - Python 客户端库

---

## 🎉 完成！

现在你可以开始使用 PacketScope Guarder Skill 了！试试这些查询：

1. "查看当前所有连接" - 了解网络状态
2. "获取性能统计" - 查看流量概况
3. "AI分析网络安全状况" - AI 安全评估
