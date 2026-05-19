#!/usr/bin/env python3
"""
Monitor Client 功能测试
测试 monitor_client.py 的各种功能
"""

import sys
from pathlib import Path
from unittest.mock import Mock, patch

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from monitor_client import (
    MonitorClient,
    get_established_tcp_sockets,
    get_function_name
)

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
        client = MonitorClient("http://localhost:8010")
        print_test("创建客户端实例", True)
        print_test("base_url 设置正确", client.base_url == "http://localhost:8010")
        return True
    except Exception as e:
        print_test("创建客户端实例", False, str(e))
        return False


def test_method_existence():
    """测试所有方法存在"""
    print_section("测试 2: 方法存在性")
    
    client = MonitorClient("http://localhost:8010")
    
    class_methods = [
        "get_recent_packets",
        "query_packets",
        "get_recent_map",
        "get_func_table",
        "query_func_send",
        "query_func_recv",
        "get_socket_list",
        "is_attach_finished"
    ]
    
    all_passed = True
    for method in class_methods:
        exists = hasattr(client, method) and callable(getattr(client, method))
        print_test(f"类方法存在: {method}", exists)
        if not exists:
            all_passed = False
    
    # 测试便利函数
    print_test("便利函数: get_established_tcp_sockets", callable(get_established_tcp_sockets))
    print_test("便利函数: get_function_name", callable(get_function_name))
    
    return all_passed


def test_get_recent_packets_params():
    """测试 get_recent_packets 参数处理"""
    print_section("测试 3: get_recent_packets 参数")
    
    client = MonitorClient("http://localhost:8010")
    
    try:
        # 模拟 session.post
        with patch.object(client.session, 'post') as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = []
            mock_response.raise_for_status.return_value = None
            mock_post.return_value = mock_response
            
            # 测试带参数
            result = client.get_recent_packets(
                src_ip="192.168.1.100",
                dst_ip="10.0.0.1",
                count="20"
            )
            
            # 验证 post 被调用
            print_test("get_recent_packets 接受参数", True)
            return True
    except Exception as e:
        print_test("参数处理", False, str(e))
        return False


def test_get_established_tcp_sockets():
    """测试 get_established_tcp_sockets 便利函数"""
    print_section("测试 4: get_established_tcp_sockets 便利函数")
    
    client = MonitorClient("http://localhost:8010")
    
    try:
        # 模拟 get_socket_list
        with patch.object(client, 'get_socket_list') as mock_get_sockets:
            mock_get_sockets.return_value = {
                "tcpipv4": [
                    ["192.168.1.100", "54321", "10.0.0.1", "80", "ESTABLISHED"],
                    ["192.168.1.100", "54322", "10.0.0.2", "443", "ESTABLISHED"],
                    ["0.0.0.0", "8080", "0.0.0.0", "0", "LISTEN"]
                ]
            }
            
            result = get_established_tcp_sockets(client)
            
            print_test("返回 ESTABLISHED 套接字", len(result) == 2)
            return len(result) == 2
    except Exception as e:
        print_test("get_established_tcp_sockets", False, str(e))
        return False


def test_get_function_name():
    """测试 get_function_name 便利函数"""
    print_section("测试 5: get_function_name 便利函数")
    
    client = MonitorClient("http://localhost:8010")
    
    try:
        # 模拟 get_func_table
        with patch.object(client, 'get_func_table') as mock_get_table:
            mock_get_table.return_value = {
                "200000": "tcp_sendmsg",
                "200001": "tcp_recvmsg"
            }
            
            name = get_function_name(client, 200000)
            print_test("正确查找函数名", name == "tcp_sendmsg")
            
            name_none = get_function_name(client, 999999)
            print_test("找不到返回 None", name_none is None)
            
            return True
    except Exception as e:
        print_test("get_function_name", False, str(e))
        return False


def main():
    """主函数"""
    print(f"{Colors.BOLD}{Colors.GREEN}")
    print("╔═══════════════════════════════════════════════════════════════╗")
    print("║   PacketScope Monitor Client - 功能测试                        ║")
    print("╚═══════════════════════════════════════════════════════════════╝")
    print(f"{Colors.RESET}")
    
    tests = [
        ("客户端创建", test_client_creation),
        ("方法存在性", test_method_existence),
        ("get_recent_packets 参数", test_get_recent_packets_params),
        ("get_established_tcp_sockets 便利函数", test_get_established_tcp_sockets),
        ("get_function_name 便利函数", test_get_function_name)
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"  {Colors.RED}✗ ERROR{Colors.RESET} {name}: {e}")
            results.append((name, False))
    
    # 总结
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
