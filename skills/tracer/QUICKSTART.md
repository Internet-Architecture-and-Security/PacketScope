# PacketScope Tracer MCP Server - 快速入门

## 🚀 5分钟快速开始

### 1. 安装依赖

```bash
cd skills/tracer
pip install -r requirements.txt
```

### 2. 测试可用性

```bash
python3 -c "from tracer_client import TracerClient; c=TracerClient(); print(c.is_ready())"
```

应该看到：
```
True
```

### 3. 选择运行模式

Tracer MCP Server 支持两种模式：

---

#### 📟 模式 A：Stdio 模式（推荐）
MCP 客户端自动管理服务器进程。

**配置 MCP 客户端：**

编辑你的 MCP 配置文件（如 Claude Desktop 的 `claude_desktop_config.json`）：

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

**跳转到步骤4**

---

#### 🌐 模式 B：HTTP 模式（独立运行）
你先手动启动服务器，MCP 客户端通过 HTTP 连接。

**启动服务器：**

```bash
cd skills/tracer
./start-http.sh
```

服务器会在 `http://localhost:8013` 启动。

**配置 MCP 客户端：**

```json
{
  "mcpServers": {
    "packetscope-tracer": {
      "url": "http://localhost:8013/sse"
    }
  }
}
```

**跳转到步骤4**

---

### 4. 确保 Tracer API 正在运行

如果 Tracer API 没有运行，先启动它：

```bash
cd modules/Tracer
python3 app/api/http_server.py
```

### 5. 重启你的 MCP 客户端

重启 Claude Desktop 或其他 MCP 客户端，现在你可以使用 Tracer 工具了！

---

## 📝 第一个查询

在 Claude 中输入：

```
帮我追踪到 8.8.8.8 的路由
```

系统会自动调用 `trace_target` 工具并返回跳点列表。

---

## 🎯 常用查询示例

### 基础追踪
```
追踪到 www.google.com 的路径
```

### 风险分析
```
分析 8.8.8.8 的路由风险
```

### TCP 追踪
```
用 TCP 方式追踪到 1.1.1.1 的 443 端口
```

### 路径对比
```
对比一下现在到 google.com 的路径和之前有什么不同
```

---

## 🛠️ 故障排查

### 问题：提示 "No module named 'mcp'"

**解决方案**：
```bash
pip install fastmcp
```

### 问题：连接 Tracer API 失败

**检查清单**：
1. Tracer API 是否正在运行？(`curl http://localhost:8000/api/ready`)
2. `TRACER_API_URL` 是否正确？
3. 端口 8000 是否被占用？

### 问题：追踪超时

Traceroute 可能需要 10-30 秒完成。如果目标不可达，会返回部分跳点。

---

## 📚 更多文档

- `README.md` - 完整使用说明
- `PROMPTS.md` - 调用提示词组大全
- `SKILL.md` - API参考文档
- `config.example.json` - 配置文件示例

---

## 🎉 完成！

现在你可以开始使用 PacketScope Tracer MCP Server 了！试试这些查询：

1. "健康检查" - 确认一切正常
2. "追踪到 8.8.8.8 的路由" - 看看网络路径
3. "分析 1.1.1.1 的风险" - 评估安全性
