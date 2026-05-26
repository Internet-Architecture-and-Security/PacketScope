#!/usr/bin/env python3
"""
MCP 协议规范测试
测试 Tracer MCP Server 是否符合 MCP 协议规范
"""

import asyncio
import json
import os
import sys
import subprocess
from pathlib import Path

# 添加父目录到路径
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
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}  {title}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.RESET}\n")


def print_test(name: str, passed: bool, message: str = ""):
    status = f"{Colors.GREEN}✓ PASS{Colors.RESET}" if passed else f"{Colors.RED}✗ FAIL{Colors.RESET}"
    print(f"  {status} {Colors.BOLD}{name}{Colors.RESET}")
    if message:
        print(f"      {message}")


def print_info(message: str):
    print(f"  {Colors.BLUE}ℹ{Colors.RESET} {message}")


def find_server_script() -> str:
    """查找服务器脚本"""
    current_dir = Path(__file__).resolve().parent.parent
    server_path = current_dir / "mcp_server.py"
    if not server_path.exists():
        raise FileNotFoundError(f"找不到服务器脚本: {server_path}")
    return str(server_path)


async def main():
    print(f"{Colors.BOLD}{Colors.CYAN}")
    print("╔═══════════════════════════════════════════════════════════════╗")
    print("║   PacketScope Tracer MCP Server - 协议规范测试                ║")
    print("╚═══════════════════════════════════════════════════════════════╝")
    print(f"{Colors.RESET}")

    server_script = find_server_script()
    test_results = []

    # 测试 1: 语法检查
    print_section("测试 1: 语法检查")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "py_compile", server_script],
            capture_output=True,
            text=True,
        )
        passed = result.returncode == 0
        print_test("Python 语法检查", passed, "mcp_server.py" if passed else result.stderr)
        test_results.append(("语法检查", passed))
    except Exception as e:
        print_test("Python 语法检查", False, str(e))
        test_results.append(("语法检查", False))

    # 测试 2: 依赖检查
    print_section("测试 2: 依赖检查")
    try:
        import mcp.server.fastmcp
        print_test("fastmcp 导入", True)
        test_results.append(("fastmcp 导入", True))
    except ImportError as e:
        print_test("fastmcp 导入", False, str(e))
        test_results.append(("fastmcp 导入", False))

    try:
        from tracer_client import TracerClient
        print_test("tracer_client 导入", True)
        test_results.append(("tracer_client 导入", True))
    except ImportError as e:
        print_test("tracer_client 导入", False, str(e))
        test_results.append(("tracer_client 导入", False))

    # 测试 3: 服务结构检查
    print_section("测试 3: 服务结构检查")
    try:
        with open(server_script, 'r') as f:
            content = f.read()
            has_fastmcp = 'from mcp.server.fastmcp' in content
            has_tools = '@mcp.tool()' in content
            has_run = 'mcp.run(' in content
            has_banner = 'print_banner' in content
            has_health = 'health_check' in content
            has_trace = 'trace_target' in content
            has_analyze = 'analyze_target' in content
            has_history = 'get_history' in content
            has_compare = 'compare_routes' in content

            print_test("使用 fastmcp 框架", has_fastmcp)
            print_test("有工具定义 (@mcp.tool)", has_tools)
            print_test("有 mcp.run() 调用", has_run)
            print_test("有启动 banner", has_banner)
            print_test("工具: health_check", has_health)
            print_test("工具: trace_target", has_trace)
            print_test("工具: analyze_target", has_analyze)
            print_test("工具: get_history", has_history)
            print_test("工具: compare_routes", has_compare)

            test_results.extend([
                ("使用 fastmcp 框架", has_fastmcp),
                ("有工具定义", has_tools),
                ("有 mcp.run() 调用", has_run),
                ("工具: health_check", has_health),
                ("工具: trace_target", has_trace),
                ("工具: analyze_target", has_analyze),
                ("工具: get_history", has_history),
                ("工具: compare_routes", has_compare),
            ])
    except Exception as e:
        print_test("检查服务器脚本", False, str(e))
        test_results.append(("检查服务器脚本", False))

    # 测试 4: 配置文件检查
    print_section("测试 4: 配置文件检查")
    current_dir = Path(__file__).resolve().parent.parent

    config_files = [
        ("config.example.json", "stdio 模式配置"),
        ("config.http.json", "HTTP 模式配置"),
        ("start.sh", "stdio 启动脚本"),
        ("start-http.sh", "HTTP 启动脚本"),
    ]

    for filename, description in config_files:
        filepath = current_dir / filename
        exists = filepath.exists()
        print_test(description, exists, filename if exists else "文件不存在")
        test_results.append((description, exists))

    # 总结
    print_section("测试总结")
    total = len(test_results)
    passed = sum(1 for _, p in test_results if p)
    failed = total - passed

    print(f"\n{Colors.BOLD}总体结果:{Colors.RESET}")
    print(f"  总数: {total}")
    print(f"  {Colors.GREEN}通过: {passed}{Colors.RESET}")
    print(f"  {Colors.RED}失败: {failed}{Colors.RESET}")

    if failed > 0:
        print(f"\n{Colors.YELLOW}提示:")
        print("  1. 运行 'pip install -r requirements.txt' 安装依赖")
        print("  2. 确保 Tracer API 正在运行")
        print(f"  3. 查看 README.md 了解更多信息{Colors.RESET}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
