# PacketScope Monitor MCP Server Tests

这个目录包含了 Monitor MCP Server 的测试文件。

## 测试文件

### test_mcp_server.py ⭐ 新增
**MCP 服务器测试**，测试 127.0.0.1:8012 上的 MCP 服务器：
- HTTP 服务器连接测试
- 配置文件验证
- 服务器文件检查

**运行测试：**
```bash
python3 test/test_mcp_server.py
```
⚠️ 前提：需要安装 fastmcp 依赖并启动 MCP 服务器

---

### test_integration.py ⭐ 推荐
**真正的集成测试**，连接到实际的 Monitor API 服务器（端口 8010）：
- 服务器连接测试
- API 功能测试
- 真实数据验证

**运行测试：**
```bash
python3 test/test_integration.py
```
⚠️ 前提：需要 Monitor API 正在运行（`./qserver`）

---

### test_monitor_client.py
**Mock 单元测试**，使用 unittest.mock 模拟 API 调用：
- 客户端创建
- 方法存在性
- 参数处理
- 便利函数功能

**运行测试：**
```bash
python3 test/test_monitor_client.py
```
✅ 无需 Monitor API 运行

---

### test_mcp_protocol.py
**MCP 协议规范测试**：
- 语法检查
- 依赖检查
- 配置文件检查
- 服务结构检查

**运行测试：**
```bash
python3 test/test_mcp_protocol.py
```
✅ 无需 Monitor API 运行

## 前置条件

### 1. 安装 Python 依赖
```bash
cd skills/monitor
pip3 install -r requirements.txt --break-system-packages
```

### 2. 启动 Monitor API（8010 端口）
```bash
cd modules/Analyzer/Monitor
./qserver
```

### 3. 启动 MCP 服务器（8012 端口，HTTP 模式）
```bash
cd skills/monitor
python3 mcp_server.py
```

## 运行所有测试

```bash
# 运行 MCP 服务器测试
python3 test/test_mcp_server.py

# 运行 Mock 测试（无需服务器）
python3 test/test_monitor_client.py
python3 test/test_mcp_protocol.py

# 运行集成测试（需要 Monitor API 运行）
python3 test/test_integration.py
```

## 测试类型对比

| 测试文件 | 测试内容 | 需要的服务 |
|---------|---------|----------|
| test_mcp_server.py | MCP 服务器（8012） | Monitor API (8010) + MCP Server (8012) |
| test_integration.py | Monitor API (8010) | Monitor API (8010) |
| test_monitor_client.py | Mock 单元测试 | 无 |
| test_mcp_protocol.py | 协议规范检查 | 无 |

## 其他文件

以下文件是开发过程中的临时文件：
- `demo_output.py` - 演示输出
- `test_mcp.py` - 旧版本测试
- `test_tool_count.py` - 旧版本测试

## 推荐测试顺序

1. **先运行 Mock 测试**：验证代码结构正确
2. **再运行集成测试**：验证与真实 API 的通信
3. **最后运行 MCP 服务器测试**：验证 MCP 服务器正常工作

## 注意事项

运行测试前请确保：
1. 已安装依赖：`pip3 install -r requirements.txt --break-system-packages`
2. Monitor API 正在运行（端口 8010）
3. 如需测试 MCP 服务器，确保它在 8012 端口运行
