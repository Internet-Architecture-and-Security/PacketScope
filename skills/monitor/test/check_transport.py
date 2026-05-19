#!/usr/bin/env python3
"""
检查 fastmcp 支持哪些传输模式
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from mcp.server.fastmcp import FastMCP
    print("✅ fastmcp 导入成功")
    
    mcp = FastMCP("test-server")
    
    # 尝试获取文档或源码
    import inspect
    run_signature = inspect.signature(mcp.run)
    print("\n📋 mcp.run() 的参数:", run_signature)
    
    # 尝试查看默认参数
    source = inspect.getsource(mcp.run)
    print("\n📖 源码片段:")
    print(source[:200])
    
except Exception as e:
    print(f"❌ 错误: {e}")
    import traceback
    traceback.print_exc()
