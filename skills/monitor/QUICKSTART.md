# PacketScope Monitor MCP Server - 快速入门

## 🚀 5分钟快速开始

### 1. 安装依赖

```bash
cd skills/monitor
pip install -r requirements.txt
```

### 2. 测试可用性

```bash
python3 test_mcp.py
```

应该看到：
```
✓ monitor_client imported successfully
✓ MonitorClient created successfully
```

### 3. 选择运行模式

Monitor MCP Server 支持两种模式：

---

#### 📟 模式 A：Stdio 模式（推荐）
MCP 客户端自动管理服务器进程。

**配置 MCP 客户端：**

编辑你的 MCP 配置文件（如 Claude Desktop 的 `claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "packetscope-monitor": {
      "command": "/path/to/PacketScope/skills/monitor/start.sh",
      "env": {
        "MONITOR_API_URL": "http://localhost:8010"
      }
    }
  }
}
```

**跳转到步骤4**

---

#### 🌐 模式 B：HTTP 模式（独立运行）
你先手动启动服务器，MCP 客户端通过 HTTP 连接。

**启动服务器：**

```bash
cd skills/monitor
./start-http.sh
```

服务器会在 `http://localhost:8012` 启动。

**配置 MCP 客户端：**

```json
{
  "mcpServers": {
    "packetscope-monitor": {
      "url": "http://localhost:8012/sse"
    }
  }
}
```

**跳转到步骤4**

---

### 4. 确保 Monitor API 正在运行

如果 Monitor API 没有运行，先启动它：

```bash
cd modules/Analyzer/Monitor/server
go run main.go
```

### 5. 重启你的 MCP 客户端

重启 Claude Desktop 或其他 MCP 客户端，现在你可以使用 Monitor 工具了！

---

## 📝 第一个查询

在 Claude 中输入：

```
帮我看看最近的10个网络数据包
```

系统会自动调用 `get_recent_packets` 工具并返回结果。

---

## 🎯 常用查询示例

### 查看网络连接
```
列出当前所有已建立的TCP连接
```

### 查找特定IP
```
查找来源为192.168.1.100的最近数据包
```

### 健康检查
```
健康检查
```

### 查看功能映射
```
功能ID 200000对应的是什么函数？
```

---

## 🛠️ 故障排查

### 问题：提示 "No module named 'mcp'"

**解决方案**：
```bash
pip install fastmcp
```

### 问题：连接 Monitor API 失败

**检查清单**：
1. Monitor API 是否正在运行？
2. `MONITOR_API_URL` 是否正确？
3. 端口 8010 是否被占用？

### 问题：eBPF探针未加载

**检查**：
```
eBPF探针加载了吗？
```

如果返回 `false`，需要先启动 Monitor 的 eBPF 探针。

---

## 📚 更多文档

- `README.md` - 完整使用说明
- `PROMPTS.md` - 调用提示词组大全
- `SKILL.md` - API参考文档
- `config.example.json` - 配置文件示例

---

## 🎉 完成！

现在你可以开始使用 PacketScope Monitor MCP Server 了！试试这些查询：

1. "健康检查" - 确认一切正常
2. "查看最近的10个数据包" - 看看网络流量
3. "列出所有已建立的TCP连接" - 查看当前连接

祝你使用愉快！
