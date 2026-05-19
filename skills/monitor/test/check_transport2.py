#!/usr/bin/env python3
"""
查看 fastmcp 支持的传输方式
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from mcp.server.fastmcp import FastMCP
    
    print("✅ 正在检查 fastmcp...")
    mcp = FastMCP("test")
    
    print("\n📋 检查 run() 的签名:")
    import inspect
    print(inspect.getsource(mcp.run)[:800)
    
    print("\n📋 检查 FastMCP 类的信息:")
    help(FastMCP.__init__)[:600]
    
except Exception as e:
    print(f"❌ 错误: {e}")
    import traceback
    traceback.print_exc()
