#!/usr/bin/env python3
"""
PacketScope Tracer MCP Server - 集成测试

这个测试会真正连接到运行中的 Tracer API 服务器（端口 8000）
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tracer_client import TracerClient, quick_trace, quick_analyze

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


def test_connection(client):
    """测试与服务器的连接"""
    print_section("测试 1: 服务器连接")

    try:
        ready = client.is_ready()
        print_test("连接到 Tracer API", True)
        print_test("is_ready 查询", ready, f"返回: {ready}")
        return True
    except Exception as e:
        print_test("连接到 Tracer API", False, str(e))
        return False


def test_trace(client):
    """测试 ICMP 追踪"""
    print_section("测试 2: ICMP trace")

    try:
        result = client.trace("8.8.8.8", use_cache=True)
        print_test("ICMP trace 调用成功", True)
        print_info(f"  跳点数: {len(result.hops)}, 来源: {result.source}")
        if result.hops:
            first = result.hops[0]
            print_info(f"  第1跳: ip={first.get('ip')}, location={first.get('location')}")
        return True
    except Exception as e:
        print_test("ICMP trace", False, str(e))
        return False


def test_analyze(client):
    """测试风险分析"""
    print_section("测试 3: analyze")

    try:
        result = client.analyze("8.8.8.8", cache=True)
        print_test("analyze 调用成功", True)
        print_info(f"  风险评分: {result.risk_score}")
        print_info(f"  异常数: {len(result.anomalies)}")
        print_info(f"  告警数: {len(result.alerts)}")
        return True
    except Exception as e:
        print_test("analyze", False, str(e))
        return False


def test_get_history(client):
    """测试历史记录查询"""
    print_section("测试 4: get_history")

    try:
        history = client.get_history()
        print_test("get_history 调用成功", True)
        print_info(f"  历史目标数: {len(history)}")
        for target, records in list(history.items())[:3]:
            count = len(records) if isinstance(records, list) else 1
            print_info(f"  - {target}: {count} 条记录")
        return True
    except Exception as e:
        print_test("get_history", False, str(e))
        return False


def test_health_check(client):
    """测试健康检查"""
    print_section("测试 5: health_check")

    try:
        health = client.health_check()
        print_test("health_check 调用成功", True)
        print_info(f"  结果: {health}")
        return True
    except Exception as e:
        print_test("health_check", False, str(e))
        return False


def test_get_history_with_target(client):
    """测试指定目标的历史记录"""
    print_section("测试 6: get_history(target=8.8.8.8)")

    try:
        history = client.get_history(target="8.8.8.8")
        print_test("指定目标历史查询", True)
        print_info(f"  结果: {list(history.keys())}")
        return True
    except Exception as e:
        print_test("指定目标历史查询", False, str(e))
        return False


def main():
    print(f"{Colors.BOLD}{Colors.CYAN}")
    print("╔═══════════════════════════════════════════════════════════════╗")
    print("║   PacketScope Tracer - 集成测试                               ║")
    print("║   连接到实际的 Tracer API (http://localhost:8000)             ║")
    print("╚═══════════════════════════════════════════════════════════════╝")
    print(f"{Colors.RESET}")

    client = TracerClient("http://localhost:8000")

    tests = [
        ("服务器连接", test_connection),
        ("ICMP trace", test_trace),
        ("analyze", test_analyze),
        ("get_history", test_get_history),
        ("health_check", test_health_check),
        ("指定目标历史", test_get_history_with_target),
    ]

    results = []
    for name, test_func in tests:
        try:
            result = test_func(client)
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
        print("  请确保 Tracer API 正在运行 (http://localhost:8000)")
        print("  cd modules/Tracer && python3 app/api/http_server.py")
        print("  确保网络连接正常{Colors.RESET}")
    else:
        print(f"\n{Colors.GREEN}✓ 所有集成测试通过！Tracer API 工作正常！{Colors.RESET}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
