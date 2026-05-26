#!/usr/bin/env python3
"""
PacketScope Tracer MCP Server - MCP 服务器测试

这个测试用于验证 127.0.0.1:8013 上的 MCP 服务器是否正常运行
"""

import sys
import requests
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


def test_server_reachable():
    """测试服务器是否可访问"""
    print_section("测试 1: 服务器连接")

    test_endpoints = [
        "http://127.0.0.1:8013/mcp",
        "http://127.0.0.1:8013/",
        "http://127.0.0.1:8013/sse",
    ]

    for endpoint in test_endpoints:
        try:
            print_info(f"  尝试端点: {endpoint}")
            response = requests.get(endpoint, timeout=2)
            if response.status_code in [200, 404, 405, 401]:
                print_test("HTTP 服务器可访问", True, f"端点: {endpoint} 状态码: {response.status_code}")
                return True
        except requests.exceptions.ConnectionError:
            continue
        except Exception as e:
            print_info(f"  端点 {endpoint} 错误: {e}")

    print_test("HTTP 服务器可访问", False, "所有端点都无法连接 - 服务器未运行或端口不对？")
    return False


def test_tracer_api_health():
    """通过 TracerClient 测试 API 健康"""
    print_section("测试 2: Tracer API 健康检查")

    try:
        from tracer_client import TracerClient
        client = TracerClient("http://localhost:8000")
        ready = client.is_ready()
        print_test("Tracer API 健康", ready, f"ready: {ready}")
        return ready
    except Exception as e:
        print_test("Tracer API 健康", False, str(e))
        return False


def test_server_startup():
    """测试服务器文件是否能正常启动"""
    print_section("测试 3: 服务器文件检查")

    server_path = Path(__file__).resolve().parent.parent / "mcp_server.py"

    if not server_path.exists():
        print_test("服务器文件存在", False, f"找不到 {server_path}")
        return False

    print_test("服务器文件存在", True, str(server_path))

    try:
        import subprocess

        result = subprocess.run(
            [sys.executable, "-m", "py_compile", str(server_path)],
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            print_test("服务器文件语法正确", True)
        else:
            print_test("服务器文件语法正确", False, result.stderr)
            return False

    except Exception as e:
        print_test("服务器文件检查", False, str(e))
        return False

    return True


def test_config_files():
    """测试配置文件是否存在"""
    print_section("测试 4: 配置文件")

    base_path = Path(__file__).resolve().parent.parent

    configs = [
        ("config.example.json", "Stdio 配置"),
        ("config.http.json", "HTTP 配置"),
        ("start.sh", "Stdio 启动脚本"),
        ("start-http.sh", "HTTP 启动脚本"),
        ("requirements.txt", "依赖列表"),
    ]

    all_passed = True
    for filename, description in configs:
        filepath = base_path / filename
        if filepath.exists():
            print_test(description, True)
        else:
            print_test(description, False, f"文件不存在: {filename}")
            all_passed = False

    return all_passed


def main():
    print(f"{Colors.BOLD}{Colors.CYAN}")
    print("╔═══════════════════════════════════════════════════════════════╗")
    print("║   PacketScope Tracer - MCP 服务器测试                         ║")
    print("║   测试 127.0.0.1:8013 上的 MCP 服务器                          ║")
    print("╚═══════════════════════════════════════════════════════════════╝")
    print(f"{Colors.RESET}")

    tests = [
        ("服务器连接", test_server_reachable),
        ("Tracer API 健康", test_tracer_api_health),
        ("服务器文件", test_server_startup),
        ("配置文件", test_config_files),
    ]

    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"  {Colors.RED}✗ ERROR{Colors.RESET} {name}: {e}")
            results.append((name, False))

    print_section("测试总结")

    total = len(results)
    passed = sum(1 for _, p in results if p)
    failed = total - passed

    print(f"\n{Colors.BOLD}总体结果:{Colors.RESET}")
    print(f"  总数: {total}")
    print(f"  {Colors.GREEN}通过: {passed}{Colors.RESET}")
    print(f"  {Colors.RED}失败: {failed}{Colors.RESET}")

    if failed > 0:
        print(f"\n{Colors.YELLOW}提示:")
        print("  1. 确保 Tracer API 正在运行 (http://localhost:8000)")
        print("  2. 如果要测试 MCP 服务器，请先启动它：")
        print("     cd skills/tracer")
        print("     python3 mcp_server.py")
        print("  3. 检查端口 8013 是否被占用")
        print("  4. 查看 README.md 了解更多信息{Colors.RESET}")
    else:
        print(f"\n{Colors.GREEN}✓ MCP 服务器测试通过！{Colors.RESET}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
