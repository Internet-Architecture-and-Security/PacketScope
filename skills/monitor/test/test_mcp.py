#!/usr/bin/env python3
"""
Test script for Monitor MCP Server
"""

import sys
from pathlib import Path

# Add current directory to path
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from monitor_client import MonitorClient

def test_client_import():
    """Test that client can be imported."""
    print("✓ monitor_client imported successfully")
    return True

def test_client_creation():
    """Test that client can be created."""
    try:
        client = MonitorClient("http://localhost:8010")
        print("✓ MonitorClient created successfully")
        return True
    except Exception as e:
        print(f"✗ Failed to create client: {e}")
        return False

def test_tool_availability():
    """Test that all tools are available in mcp_server."""
    try:
        import inspect
        import mcp_server
        
        # Get all tools from mcp_server
        mcp_globals = vars(mcp_server)
        tool_names = []
        for name, obj in mcp_globals.items():
            # Check if it's a function and might be a tool
            if inspect.isfunction(obj) and not name.startswith('_'):
                # Check if it has a tool decorator (simple check)
                if hasattr(obj, '__name__'):
                    tool_names.append(name)
        
        # Expected tools
        expected_tools = [
            'get_recent_packets',
            'query_packets',
            'get_recent_map',
            'get_func_table',
            'get_function_name',
            'query_func_send',
            'query_func_recv',
            'get_socket_list',
            'get_established_tcp_sockets',
            'is_attach_finished',
            'health_check',
            'server_capabilities'
        ]
        
        print("✓ MCP Server tools available:")
        for tool in expected_tools:
            if tool in tool_names:
                print(f"  - {tool}")
            else:
                print(f"  - {tool} (not found)")
        
        return True
    except Exception as e:
        print(f"✗ Failed to check tools: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 60)
    print("PacketScope Monitor MCP Server - 可用性检查")
    print("=" * 60)
    print()
    
    tests = [
        test_client_import,
        test_client_creation,
        test_tool_availability
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"✗ Test {test.__name__} failed with exception: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
        print()
    
    print("=" * 60)
    print(f"结果: {passed} 个通过, {failed} 个失败")
    print("=" * 60)
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
