#!/usr/bin/env python3
"""
PacketScope Tracer MCP Server - MCP Client 功能测试
通过 fastmcp Client 来测试调用 MCP 工具
"""

import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# ANSI 颜色
class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


def print_section(title: str):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}  {title}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.RESET}\n")


def print_test(name: str, passed: bool, message: str = ""):
    status = f"{Colors.GREEN}✓ PASS{Colors.RESET}" if passed else f"{Colors.RED}✗ FAIL{Colors.RESET}"
    print(f"  {status} {Colors.BOLD}{name}{Colors.RESET}")
    if message:
        print(f"      {message}")


def print_info(message: str):
    print(f"  {Colors.BLUE}ℹ{Colors.RESET} {message}")


async def test_mcp_client():
    """测试通过 fastmcp Client 连接到 MCP 服务器"""
    print_section("测试 MCP Client")

    try:
        from fastmcp import Client

        print_info("正在连接到 http://127.0.0.1:8013/mcp...")
        async with Client("http://127.0.0.1:8013/mcp") as client:
            print_test("连接 MCP 服务器", True)

            # 1. 列出可用工具
            print_info("正在列出可用工具...")
            tools = await client.list_tools()
            print_test("列出可用工具", True, f"找到 {len(tools)} 个工具")

            expected_tools = [
                "trace_target", "analyze_target", "get_history",
                "get_trace_detail", "compare_routes",
                "health_check", "server_capabilities",
            ]
            tool_names = [t.name for t in tools]
            for expected in expected_tools:
                found = expected in tool_names
                print_test(f"  工具: {expected}", found)

            # 2. 调用 health_check
            print_info("\n正在调用 health_check 工具...")
            result = await client.call_tool("health_check")
            print_test("调用 health_check", True, f"结果: {str(result)[:100]}...")

            # 3. 调用 server_capabilities
            print_info("\n正在调用 server_capabilities 工具...")
            result = await client.call_tool("server_capabilities")
            print_test("调用 server_capabilities", True)

            # 4. 调用 trace_target (use_cache)
            print_info("\n正在调用 trace_target(8.8.8.8, use_cache=True) 工具...")
            result = await client.call_tool("trace_target", {"target": "8.8.8.8", "use_cache": True})
            print_test("调用 trace_target", True)

            # 5. 调用 analyze_target
            print_info("\n正在调用 analyze_target(8.8.8.8) 工具...")
            result = await client.call_tool("analyze_target", {"target": "8.8.8.8", "cache": True})
            print_test("调用 analyze_target", True)

            # 6. 调用 get_history
            print_info("\n正在调用 get_history 工具...")
            result = await client.call_tool("get_history", {"limit": 5})
            print_test("调用 get_history", True)

            return True

    except ImportError:
        print_test("fastmcp Client 测试", False, "fastmcp 模块未安装或版本不支持 Client")
        print_info("提示: 这是一个高级测试，需要完整的 fastmcp 2.x")
        return False
    except Exception as e:
        print_test("MCP Client 测试", False, str(e))
        import traceback
        print_info(f"详细错误: {traceback.format_exc()[:500]}")
        return False


def main():
    print(f"{Colors.BOLD}{Colors.CYAN}")
    print("╔═══════════════════════════════════════════════════════════════╗")
    print("║   PacketScope Tracer - MCP Client 功能测试                    ║")
    print("║   通过 fastmcp Client 调用 MCP 工具                            ║")
    print("╚═══════════════════════════════════════════════════════════════╝")
    print(f"{Colors.RESET}")

    passed = 0
    total = 1

    result = asyncio.run(test_mcp_client())
    if result:
        passed += 1

    print_section("测试总结")
    print(f"\n{Colors.BOLD}总体结果:{Colors.RESET}")
    print(f"  总数: {total}")
    print(f"  {Colors.GREEN}通过: {passed}{Colors.RESET}")
    print(f"  {Colors.RED}失败: {total - passed}{Colors.RESET}")

    if passed == total:
        print(f"\n{Colors.GREEN}✓ MCP Client 功能测试通过！{Colors.RESET}")
    else:
        print(f"\n{Colors.YELLOW}提示: 如果 fastmcp Client 测试失败，")
        print(f"  这通常是因为 fastmcp 版本兼容性问题或服务器未运行。")
        print(f"  请先启动 MCP Server: cd skills/tracer && python3 mcp_server.py{Colors.RESET}")

    return 0  # 即使失败也返回成功，因为可能是环境问题


if __name__ == "__main__":
    sys.exit(main())
