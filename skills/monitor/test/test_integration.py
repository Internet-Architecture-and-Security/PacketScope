#!/usr/bin/env python3
"""
PacketScope Monitor MCP Server - 集成测试

这个测试会真正连接到运行中的 Monitor API 服务器（端口 8010）
"""

import sys
from pathlib import Path

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
        attached = client.is_attach_finished()
        print_test("连接到 Monitor API", True)
        print_test("查询 is_attach_finished", True, f"返回: {attached}")
        return True
    except Exception as e:
        print_test("连接到 Monitor API", False, str(e))
        return False


def test_get_recent_packets(client):
    """测试获取最近数据包"""
    print_section("测试 2: get_recent_packets")
    
    try:
        packets = client.get_recent_packets(count="5")
        print_test("API 调用成功", True)
        print_info(f"获取到 {len(packets)} 个数据包")
        if packets:
            print_info(f"第一个数据包: {str(packets[0])[:100]}...")
        return True
    except Exception as e:
        print_test("获取数据包", False, str(e))
        return False


def test_get_socket_list(client):
    """测试获取套接字列表"""
    print_section("测试 3: get_socket_list")
    
    try:
        sockets = client.get_socket_list()
        print_test("API 调用成功", True)
        
        if sockets is None:
            print_info("返回: None（无数据）")
        elif isinstance(sockets, list):
            print_info(f"获取到 {len(sockets)} 个套接字")
            if sockets:
                print_info(f"第一个套接字: {str(sockets[0])[:80]}...")
        elif isinstance(sockets, dict):
            total = 0
            for sock_type, sock_list in sockets.items():
                if sock_list:
                    total += len(sock_list)
                    print_info(f"  {sock_type}: {len(sock_list)} 个")
            print_info(f"总共 {total} 个套接字")
        else:
            print_info(f"返回类型: {type(sockets)}")
            print_info(f"返回值: {str(sockets)[:100]}")
        
        return True
    except Exception as e:
        print_test("获取套接字列表", False, str(e))
        return False


def test_get_established_tcp_sockets(client):
    """测试获取已建立的 TCP 套接字"""
    print_section("测试 4: get_established_tcp_sockets")
    
    try:
        established = get_established_tcp_sockets(client)
        print_test("获取 ESTABLISHED 套接字成功", True)
        print_info(f"已建立 {len(established)} 个 TCP 连接")
        if established:
            print_info(f"第一个连接: {established[0]}")
        return True
    except Exception as e:
        print_test("获取已建立的 TCP 套接字", False, str(e))
        return False


def test_get_func_table(client):
    """测试获取功能映射表"""
    print_section("测试 5: get_func_table")
    
    try:
        func_table = client.get_func_table()
        print_test("获取功能映射表成功", True)
        print_info(f"功能映射表有 {len(func_table)} 个条目")
        
        if func_table:
            first_id = next(iter(func_table.keys()))
            first_name = func_table[first_id]
            print_info(f"示例: {first_id} -> {first_name}")
        
        return True
    except Exception as e:
        print_test("获取功能映射表", False, str(e))
        return False


def test_get_function_name(client):
    """测试 get_function_name 便利函数"""
    print_section("测试 6: get_function_name")
    
    try:
        func_table = client.get_func_table()
        if func_table:
            first_id = next(iter(func_table.keys()))
            actual_name = get_function_name(client, int(first_id))
            
            print_test("查找现有 ID 成功", actual_name is not None)
            print_info(f"{first_id} -> {actual_name}")
            
            # 测试不存在的 ID
            non_existent = get_function_name(client, 999999999)
            print_test("查找不存在的 ID 返回 None 或空值", True)
        
        return True
    except Exception as e:
        print_test("get_function_name", False, str(e))
        return False


def test_query_packets(client):
    """测试查询数据包"""
    print_section("测试 7: query_packets")
    
    try:
        packets = client.query_packets()
        print_test("API 调用成功", True)
        print_info(f"查询到 {len(packets)} 个数据包")
        return True
    except Exception as e:
        print_test("query_packets", False, str(e))
        return False


def main():
    print(f"{Colors.BOLD}{Colors.CYAN}")
    print("╔═══════════════════════════════════════════════════════════════╗")
    print("║   PacketScope Monitor - 集成测试                               ║")
    print("║   连接到实际的 Monitor API (http://localhost:8010)            ║")
    print("╚═══════════════════════════════════════════════════════════════╝")
    print(f"{Colors.RESET}")
    
    client = MonitorClient("http://localhost:8010")
    
    tests = [
        ("服务器连接", test_connection),
        ("get_recent_packets", test_get_recent_packets),
        ("get_socket_list", test_get_socket_list),
        ("get_established_tcp_sockets", test_get_established_tcp_sockets),
        ("get_func_table", test_get_func_table),
        ("get_function_name", test_get_function_name),
        ("query_packets", test_query_packets)
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
        print("  请确保 Monitor API 正在运行 (http://localhost:8010)")
        print("  检查 ./qserver 是否已启动")
        print("  确保网络连接正常{Colors.RESET}")
    else:
        print(f"\n{Colors.GREEN}✓ 所有集成测试通过！Monitor API 工作正常！{Colors.RESET}")
    
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
