#!/usr/bin/env python3
"""
Tracer Client 功能测试
测试 tracer_client.py 的各种功能
"""

import sys
from pathlib import Path
from unittest.mock import Mock, patch

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tracer_client import TracerClient, quick_trace, quick_analyze

# ANSI 颜色
class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


def print_section(title: str):
    print(f"\n{Colors.BOLD}{Colors.YELLOW}{'='*70}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.YELLOW}  {title}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.YELLOW}{'='*70}{Colors.RESET}\n")


def print_test(name: str, passed: bool, message: str = ""):
    status = f"{Colors.GREEN}✓ PASS{Colors.RESET}" if passed else f"{Colors.RED}✗ FAIL{Colors.RESET}"
    print(f"  {status} {Colors.BOLD}{name}{Colors.RESET}")
    if message:
        print(f"      {message}")


def test_client_creation():
    """测试客户端创建"""
    print_section("测试 1: 客户端创建")

    try:
        client = TracerClient("http://localhost:8000")
        print_test("创建客户端实例", True)
        print_test("base_url 设置正确", client.base_url == "http://localhost:8000")
        return True
    except Exception as e:
        print_test("创建客户端实例", False, str(e))
        return False


def test_method_existence():
    """测试所有方法存在"""
    print_section("测试 2: 方法存在性")

    client = TracerClient("http://localhost:8000")

    methods = [
        "trace",
        "analyze",
        "get_history",
        "is_ready",
        "health_check",
    ]

    all_passed = True
    for method in methods:
        exists = hasattr(client, method) and callable(getattr(client, method))
        print_test(f"类方法存在: {method}", exists)
        if not exists:
            all_passed = False

    # 测试便利函数
    print_test("便利函数: quick_trace", callable(quick_trace))
    print_test("便利函数: quick_analyze", callable(quick_analyze))

    return all_passed


def test_trace_params():
    """测试 trace 参数处理"""
    print_section("测试 3: trace 参数处理")

    client = TracerClient("http://localhost:8000")

    try:
        with patch.object(client.session, 'get') as mock_get:
            mock_response = Mock()
            mock_response.headers = {"Content-Type": "application/json"}
            mock_response.json.return_value = [{"hop": 1, "ip": "8.8.8.8"}]
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response

            # ICMP trace
            result = client.trace("8.8.8.8")
            print_test("ICMP trace 接受参数", True)

            # TCP trace with port
            result = client.trace("1.1.1.1", protocol="tcp", port=443)
            print_test("TCP trace 接受 protocol/port 参数", True)

            return True
    except Exception as e:
        print_test("参数处理", False, str(e))
        return False


def test_analyze_params():
    """测试 analyze 参数处理"""
    print_section("测试 4: analyze 参数处理")

    client = TracerClient("http://localhost:8000")

    try:
        with patch.object(client.session, 'get') as mock_get:
            mock_response = Mock()
            mock_response.json.return_value = {
                "anomalies": [],
                "alerts": [],
                "riskScore": 0,
            }
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response

            result = client.analyze("8.8.8.8", cache=True)
            print_test("analyze 接受参数", True)
            print_test("risk_score 属性", result.risk_score == 0)
            print_test("anomalies 属性", len(result.anomalies) == 0)

            return True
    except Exception as e:
        print_test("analyze 参数处理", False, str(e))
        return False


def test_dataclasses():
    """测试数据类"""
    print_section("测试 5: 数据类")

    try:
        from tracer_client import TraceResult, AnalysisResult

        # TraceResult
        tr = TraceResult(target="8.8.8.8", hops=[{"hop": 1}], source="live")
        print_test("TraceResult 创建", tr.target == "8.8.8.8" and tr.source == "live")

        # AnalysisResult
        ar = AnalysisResult(target="8.8.8.8", anomalies=[], alerts=[], risk_score=50)
        print_test("AnalysisResult 创建", ar.risk_score == 50)

        return True
    except Exception as e:
        print_test("数据类", False, str(e))
        return False


def test_is_ready_failure():
    """测试 is_ready 连接失败处理"""
    print_section("测试 6: is_ready 容错")

    client = TracerClient("http://localhost:99999")

    try:
        result = client.is_ready()
        print_test("连接失败返回 False", result is False)
        return True
    except Exception as e:
        print_test("is_ready 容错", False, str(e))
        return False


def main():
    print(f"{Colors.BOLD}{Colors.GREEN}")
    print("╔═══════════════════════════════════════════════════════════════╗")
    print("║   PacketScope Tracer Client - 功能测试                        ║")
    print("╚═══════════════════════════════════════════════════════════════╝")
    print(f"{Colors.RESET}")

    tests = [
        ("客户端创建", test_client_creation),
        ("方法存在性", test_method_existence),
        ("trace 参数", test_trace_params),
        ("analyze 参数", test_analyze_params),
        ("数据类", test_dataclasses),
        ("is_ready 容错", test_is_ready_failure),
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

    if failed == 0:
        print(f"\n{Colors.GREEN}✓ 所有测试通过！{Colors.RESET}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
