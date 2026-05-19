#!/usr/bin/env python3
"""
测试 fastmcp 的正确用法
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from mcp.server.fastmcp import FastMCP
    print("✅ fastmcp 导入成功")
    
    mcp = FastMCP("test-server")
    
    # 查看 mcp.run 的帮助
    import inspect
    print("\n📋 mcp.run 的签名:")
    print(inspect.signature(mcp.run))
    
    print("\n📋 FastMCP 类的文档:")
    print(inspect.getdoc(FastMCP)[:500])
    
    print("\n📋 FastMCP.__init__ 的签名:")
    print(inspect.signature(FastMCP.__init__))
    
except Exception as e:
    print(f"❌ 错误: {e}")
    import traceback
    traceback.print_exc()
