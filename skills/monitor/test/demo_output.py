#!/usr/bin/env python3
"""
演示 mcp_server.py 的输出效果
"""

from datetime import datetime

# ANSI 颜色代码
class Colors:
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    RESET = "\033[0m"

def print_banner():
    """打印启动横幅"""
    banner = f"""
{Colors.BOLD}{Colors.CYAN}╔════════════════════════════════════════════════════════════╗
║                                                            ║
║        PacketScope Monitor MCP Server                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝{Colors.RESET}
"""
    print(banner)

def print_status(message: str, status: str = "info"):
    """打印状态信息"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    if status == "success":
        icon = f"{Colors.GREEN}✓{Colors.RESET}"
    elif status == "warning":
        icon = f"{Colors.YELLOW}⚠{Colors.RESET}"
    elif status == "info":
        icon = f"{Colors.BLUE}ℹ{Colors.RESET}"
    else:
        icon = f"{Colors.CYAN}→{Colors.RESET}"
    print(f"{Colors.BOLD}[{timestamp}]{Colors.RESET} {icon} {message}")

def demo():
    """演示输出"""
    print_banner()
    print_status("正在初始化...", "info")
    
    print_status(f"服务器名称: {Colors.BOLD}packetscope-monitor{Colors.RESET}", "info")
    print_status(f"Monitor API: {Colors.BOLD}http://localhost:8010{Colors.RESET}", "info")
    print_status(f"传输模式: {Colors.BOLD}http{Colors.RESET}", "info")
    print_status(f"监听地址: {Colors.BOLD}http://127.0.0.1:8012{Colors.RESET}", "info")
    print_status(f"SSE 端点: {Colors.BOLD}http://127.0.0.1:8012/sse{Colors.RESET}", "info")
    
    print_status("正在注册工具...", "info")
    print_status(f"已注册 {Colors.BOLD}12{Colors.RESET} 个工具", "success")
    print_status(f"工具列表: {Colors.BOLD}get_recent_packets, query_packets, get_recent_map, get_func_table, get_function_name ... 还有 7 个{Colors.RESET}", "info")
    
    print_status(f"正在连接 Monitor API (http://localhost:8010)...", "info")
    print_status("Monitor API 连接成功", "success")
    
    print_status("服务器已就绪", "success")
    print()
    print(f"{Colors.BOLD}提示: 按 Ctrl+C 停止服务器{Colors.RESET}")
    print()
    
    # 模拟工具调用
    print_status("调用工具: get_recent_packets (count='10', src_ip='192.168.1.100')", "info")
    print_status("返回 10 个数据包", "success")
    
    print_status("调用工具: get_socket_list", "info")
    print_status("返回 25 个套接字", "success")
    
    print_status("调用工具: health_check", "info")
    print_status("健康检查完成: eBPF探针已加载", "success")

if __name__ == "__main__":
    print()
    print(f"{Colors.BOLD}{Colors.CYAN}=== mcp_server.py 输出效果演示 ==={Colors.RESET}")
    print()
    demo()
    print()
    print(f"{Colors.BOLD}{Colors.CYAN}=== 演示结束 ==={Colors.RESET}")
    print()
