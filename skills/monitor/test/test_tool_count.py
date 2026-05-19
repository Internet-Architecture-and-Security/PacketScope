#!/usr/bin/env python3
"""
测试如何正确获取 fastmcp 工具数量
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

# 测试导入
print("测试 1: 导入 fastmcp")
try:
    from mcp.server.fastmcp import FastMCP
    print("✓ fastmcp 导入成功")
except Exception as e:
    print(f"✗ fastmcp 导入失败: {e}")
    sys.exit(1)

print()
print("测试 2: 创建 FastMCP 实例")
mcp = FastMCP("test-server")
print("✓ FastMCP 实例创建成功")

print()
print("测试 3: 查看 mcp 的属性")
attrs = dir(mcp)
print(f"mcp 有 {len(attrs)} 个属性")
# 查找可能包含工具的属性
tool_attrs = [attr for attr in attrs if 'tool' in attr.lower() or 'tools' in attr.lower()]
print(f"可能的工具属性: {tool_attrs}")

print()
print("测试 4: 注册一个测试工具")
@mcp.tool()
def test_tool():
    return "test"

print("✓ 测试工具注册成功")

print()
print("测试 5: 再次查找工具属性")
for attr in tool_attrs:
    try:
        value = getattr(mcp, attr)
        print(f"{attr}: {type(value)} = {value}")
    except Exception as e:
        print(f"{attr}: 错误 - {e}")

print()
print("测试 6: 手动跟踪工具")
# 我们可以在工具定义时手动跟踪
tools_defined = []

def track_tool(func):
    tools_defined.append(func.__name__)
    return func

@track_tool
@mcp.tool()
def test_tool2():
    return "test2"

print(f"手动跟踪的工具: {tools_defined}")
