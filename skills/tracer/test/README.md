# PacketScope Tracer MCP Server Tests

这个目录包含了 Tracer MCP Server 的测试文件。

## 测试文件

### test_tracer_client.py
**Mock 单元测试**，使用 unittest.mock 模拟 API 调用：
- 客户端创建
- 方法存在性
- trace/analyze 参数处理
- 数据类验证
- is_ready 容错

**运行测试：**
```bash
python3 test/test_tracer_client.py
```
无需 Tracer API 运行

---

### test_mcp_protocol.py
**MCP 协议规范测试**：
- 语法检查
- 依赖检查
- 服务结构检查（工具定义、banner、mcp.run）
- 配置文件检查

**运行测试：**
```bash
python3 test/test_mcp_protocol.py
```
无需 Tracer API 运行

---

### test_integration.py
**集成测试**，连接到实际的 Tracer API 服务器（端口 8000）：
- 服务器连接测试
- ICMP trace 测试
- analyze 风险分析测试
- get_history 历史记录测试
- health_check 健康检查

**运行测试：**
```bash
python3 test/test_integration.py
```
前提：需要 Tracer API 正在运行（端口 8000）

---

### test_mcp_server.py
**MCP 服务器测试**，测试 127.0.0.1:8013 上的 MCP 服务器：
- HTTP 服务器连接测试
- Tracer API 健康检查
- 服务器文件验证
- 配置文件验证

**运行测试：**
```bash
python3 test/test_mcp_server.py
```
前提：需要 Tracer API + MCP Server 正在运行

---

### test_mcp_client.py
**MCP Client 功能测试**，通过 fastmcp Client 调用 MCP 工具：
- 连接 MCP 服务器
- 列出工具
- 调用 health_check / trace_target / analyze_target / get_history

**运行测试：**
```bash
python3 test/test_mcp_client.py
```
前提：需要 MCP Server 正在运行（端口 8013）

---

## 前置条件

### 1. 安装 Python 依赖
```bash
cd skills/tracer
pip3 install -r requirements.txt
```

### 2. 启动 Tracer API（8000 端口）
```bash
cd modules/Tracer
source .venv/bin/activate
python3 app/api/http_server.py
```

### 3. 启动 MCP 服务器（8013 端口，HTTP 模式）
```bash
cd skills/tracer
python3 mcp_server.py
```

## 运行所有测试

```bash
# 运行 Mock 测试（无需服务器）
python3 test/test_tracer_client.py
python3 test/test_mcp_protocol.py

# 运行集成测试（需要 Tracer API 运行）
python3 test/test_integration.py

# 运行 MCP 服务器测试（需要 MCP Server 运行）
python3 test/test_mcp_server.py
python3 test/test_mcp_client.py
```

## 测试类型对比

| 测试文件 | 测试内容 | 需要的服务 |
|---------|---------|----------|
| test_tracer_client.py | Mock 单元测试 | 无 |
| test_mcp_protocol.py | 协议规范检查 | 无 |
| test_integration.py | Tracer API (8000) | Tracer API |
| test_mcp_server.py | MCP Server (8013) | Tracer API + MCP Server |
| test_mcp_client.py | MCP Client | MCP Server |

## 推荐测试顺序

1. **先运行 Mock 测试**：验证代码结构正确
2. **再运行集成测试**：验证与真实 API 的通信
3. **最后运行 MCP 服务器测试**：验证 MCP 服务器正常工作
