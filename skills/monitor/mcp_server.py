#!/usr/bin/env python3
"""
PacketScope Monitor MCP Server

Provides MCP tools for interacting with the Monitor module.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from mcp.server.fastmcp import FastMCP

# Add current directory to path for monitor_client import
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from monitor_client import MonitorClient

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

# 加载配置
SERVER_NAME = os.getenv("MONITOR_MCP_NAME", "packetscope-monitor")
SERVER_HOST = os.getenv("MONITOR_MCP_HOST", "127.0.0.1")
SERVER_PORT = int(os.getenv("MONITOR_MCP_PORT", "8012"))
SERVER_MOUNT_PATH = os.getenv("MONITOR_MCP_MOUNT_PATH", "/")
SERVER_SSE_PATH = os.getenv("MONITOR_MCP_SSE_PATH", "/sse")
SERVER_MESSAGE_PATH = os.getenv("MONITOR_MCP_MESSAGE_PATH", "/messages/")
SERVER_STREAMABLE_HTTP_PATH = os.getenv("MONITOR_MCP_HTTP_PATH", "/mcp")
MONITOR_API_URL = os.getenv("MONITOR_API_URL", "http://localhost:8010")

SERVER_INSTRUCTIONS = """
PacketScope Monitor MCP server for network packet analysis, function call tracking, and socket monitoring.

Use this server when user asks for:
- network packet capture / query
- kernel network function call tracing
- socket state monitoring
- recent network activity analysis

Tool routing guide:
- get_recent_packets: fetch recent network packets
- query_packets: search packets by criteria
- get_recent_map: get recent function call mappings
- get_func_table: lookup function ID to name mapping
- query_func_send: get send-related function calls
- query_func_recv: get receive-related function calls
- get_socket_list: list current network sockets
- health_check: server readiness
- server_capabilities: discover all tool usage and examples
"""

mcp = FastMCP(
    SERVER_NAME,
    instructions=SERVER_INSTRUCTIONS.strip(),
    host=SERVER_HOST,
    port=SERVER_PORT,
    mount_path=SERVER_MOUNT_PATH,
    sse_path=SERVER_SSE_PATH,
    message_path=SERVER_MESSAGE_PATH,
    streamable_http_path=SERVER_STREAMABLE_HTTP_PATH,
)

# Global client instance
_client: Optional[MonitorClient] = None

# 工具列表 - 手动维护
_TOOLS = [
    "get_recent_packets",
    "query_packets",
    "get_recent_map",
    "get_func_table",
    "get_function_name",
    "query_func_send",
    "query_func_recv",
    "get_socket_list",
    "get_established_tcp_sockets",
    "is_attach_finished",
    "health_check",
    "server_capabilities"
]


def get_client() -> MonitorClient:
    """Get or create Monitor client instance."""
    global _client
    if _client is None:
        _client = MonitorClient(MONITOR_API_URL)
    return _client


def log_tool_call(tool_name: str, **kwargs):
    """记录工具调用"""
    params = []
    for key, value in kwargs.items():
        if value:  # 只显示有值的参数
            params.append(f"{key}={repr(value)}")
    
    if params:
        print_status(f"调用工具: {Colors.BOLD}{tool_name}{Colors.RESET} ({', '.join(params)})", "info")
    else:
        print_status(f"调用工具: {Colors.BOLD}{tool_name}{Colors.RESET}", "info")


@mcp.tool()
def get_recent_packets(
    src_ip: str = "",
    dst_ip: str = "",
    src_port: str = "",
    dst_port: str = "",
    ip_ver: str = "",
    count: str = "10"
):
    """
    Get recent network packets with optional filters.
    
    Args:
        src_ip: Source IP address filter
        dst_ip: Destination IP address filter
        src_port: Source port filter
        dst_port: Destination port filter
        ip_ver: IP version ("4" or "6")
        count: Number of packets to return (default: 10)
        
    Returns:
        List of packet entries with timestamp, IPs, ports, payload, etc.
    """
    log_tool_call("get_recent_packets", src_ip=src_ip, dst_ip=dst_ip, src_port=src_port, dst_port=dst_port, ip_ver=ip_ver, count=count)
    try:
        client = get_client()
        packets = client.get_recent_packets(
            src_ip=src_ip,
            dst_ip=dst_ip,
            src_port=src_port,
            dst_port=dst_port,
            ip_ver=ip_ver,
            count=count
        )
        result = {
            "success": True,
            "count": len(packets),
            "packets": packets
        }
        print_status(f"返回 {Colors.BOLD}{len(packets)}{Colors.RESET} 个数据包", "success")
        return result
    except Exception as e:
        print_status(f"错误: {e}", "warning")
        return {
            "success": False,
            "error": str(e)
        }


@mcp.tool()
def query_packets(
    src_ip: str = "",
    dst_ip: str = "",
    src_port: str = "",
    dst_port: str = "",
    ip_ver: str = ""
):
    """
    Query packets matching specific criteria.
    
    Args:
        src_ip: Source IP address filter
        dst_ip: Destination IP address filter
        src_port: Source port filter
        dst_port: Destination port filter
        ip_ver: IP version ("4" or "6")
        
    Returns:
        List of matching packet entries.
    """
    try:
        client = get_client()
        packets = client.query_packets(
            src_ip=src_ip,
            dst_ip=dst_ip,
            src_port=src_port,
            dst_port=dst_port,
            ip_ver=ip_ver
        )
        return {
            "success": True,
            "count": len(packets),
            "packets": packets
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@mcp.tool()
def get_recent_map(
    src_ip: str = "",
    dst_ip: str = "",
    src_port: str = "",
    dst_port: str = "",
    count: str = "10",
    time_down_limit: str = ""
):
    """
    Get recent function call mappings.
    
    Args:
        src_ip: Source IP address filter
        dst_ip: Destination IP address filter
        src_port: Source port filter
        dst_port: Destination port filter
        count: Number of entries to return (default: 10)
        time_down_limit: Minimum timestamp
        
    Returns:
        List of function call entries.
    """
    try:
        client = get_client()
        func_map = client.get_recent_map(
            src_ip=src_ip,
            dst_ip=dst_ip,
            src_port=src_port,
            dst_port=dst_port,
            count=count,
            time_down_limit=time_down_limit
        )
        return {
            "success": True,
            "function_map": func_map
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@mcp.tool()
def get_func_table():
    """
    Get function ID to name mapping.
    
    Returns:
        Dictionary mapping function IDs to names.
    """
    try:
        client = get_client()
        func_table = client.get_func_table()
        return {
            "success": True,
            "function_table": func_table
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@mcp.tool()
def get_function_name(func_id: int):
    """
    Get function name from function ID.
    
    Args:
        func_id: Function ID to lookup
        
    Returns:
        Function name or None if not found.
    """
    try:
        client = get_client()
        func_table = client.get_func_table()
        func_name = func_table.get(str(func_id))
        return {
            "success": True,
            "function_id": func_id,
            "function_name": func_name
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@mcp.tool()
def query_func_send(
    src_ip: str = "",
    dst_ip: str = "",
    src_port: str = "",
    dst_port: str = ""
):
    """
    Query function calls related to send operations.
    
    Args:
        src_ip: Source IP address filter
        dst_ip: Destination IP address filter
        src_port: Source port filter
        dst_port: Destination port filter
        
    Returns:
        List of send-related function call entries.
    """
    try:
        client = get_client()
        func_calls = client.query_func_send(
            src_ip=src_ip,
            dst_ip=dst_ip,
            src_port=src_port,
            dst_port=dst_port
        )
        return {
            "success": True,
            "function_calls": func_calls
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@mcp.tool()
def query_func_recv(
    src_ip: str = "",
    dst_ip: str = "",
    src_port: str = "",
    dst_port: str = ""
):
    """
    Query function calls related to receive operations.
    
    Args:
        src_ip: Source IP address filter
        dst_ip: Destination IP address filter
        src_port: Source port filter
        dst_port: Destination port filter
        
    Returns:
        List of receive-related function call entries.
    """
    try:
        client = get_client()
        func_calls = client.query_func_recv(
            src_ip=src_ip,
            dst_ip=dst_ip,
            src_port=src_port,
            dst_port=dst_port
        )
        return {
            "success": True,
            "function_calls": func_calls
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@mcp.tool()
def get_socket_list():
    """
    Get current network socket list.
    
    Returns:
        Dictionary with socket types as keys and lists of socket entries as values.
    """
    log_tool_call("get_socket_list")
    try:
        client = get_client()
        sockets = client.get_socket_list()
        
        # Count sockets by type
        socket_counts = {}
        total_sockets = 0
        for socket_type, socket_list in sockets.items():
            count = len(socket_list)
            socket_counts[socket_type] = count
            total_sockets += count
        
        result = {
            "success": True,
            "socket_counts": socket_counts,
            "sockets": sockets
        }
        print_status(f"返回 {Colors.BOLD}{total_sockets}{Colors.RESET} 个套接字", "success")
        return result
    except Exception as e:
        print_status(f"错误: {e}", "warning")
        return {
            "success": False,
            "error": str(e)
        }


@mcp.tool()
def get_established_tcp_sockets():
    """
    Get all established TCP IPv4 sockets.
    
    Returns:
        List of established TCP sockets.
    """
    try:
        client = get_client()
        sockets = client.get_socket_list()
        tcp_sockets = sockets.get("tcpipv4", [])
        established = [sock for sock in tcp_sockets if "ESTABLISHED" in sock[4]]
        
        return {
            "success": True,
            "count": len(established),
            "sockets": established
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@mcp.tool()
def is_attach_finished():
    """
    Check if eBPF probes are attached.
    
    Returns:
        True if probes are attached.
    """
    try:
        client = get_client()
        attached = client.is_attach_finished()
        return {
            "success": True,
            "attached": attached
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@mcp.tool()
def health_check():
    """
    Check server health and readiness.
    
    Returns:
        Health status information.
    """
    log_tool_call("health_check")
    try:
        client = get_client()
        attached = client.is_attach_finished()
        
        result = {
            "success": True,
            "ready": True,
            "timestamp": datetime.now().isoformat(),
            "monitor_api_url": MONITOR_API_URL,
            "probes_attached": attached
        }
        
        status_msg = "eBPF探针已加载" if attached else "eBPF探针未加载"
        print_status(f"健康检查完成: {Colors.BOLD}{status_msg}{Colors.RESET}", "success")
        return result
    except Exception as e:
        print_status(f"健康检查失败: {e}", "warning")
        return {
            "success": False,
            "ready": False,
            "error": str(e)
        }


@mcp.tool()
def server_capabilities():
    """
    Get server capabilities and tool usage examples.
    
    Returns:
        Server capabilities and tool documentation.
    """
    return {
        "name": SERVER_NAME,
        "transport": "http",
        "monitor_api_url": MONITOR_API_URL,
        "tools": [
            {
                "name": "get_recent_packets",
                "purpose": "获取最近的网络数据包",
                "params": {
                    "src_ip": "string|optional",
                    "dst_ip": "string|optional",
                    "src_port": "string|optional",
                    "dst_port": "string|optional",
                    "ip_ver": "string|optional, '4' or '6'",
                    "count": "string|optional, default '10'"
                },
                "examples": [
                    "count='10'",
                    "src_ip='192.168.1.100', dst_ip='10.0.0.1'",
                    "ip_ver='4', count='20'"
                ],
            },
            {
                "name": "query_packets",
                "purpose": "查询符合条件的数据包",
                "params": {
                    "src_ip": "string|optional",
                    "dst_ip": "string|optional",
                    "src_port": "string|optional",
                    "dst_port": "string|optional",
                    "ip_ver": "string|optional, '4' or '6'"
                },
                "examples": ["src_ip='192.168.1.100'"],
            },
            {
                "name": "get_recent_map",
                "purpose": "获取最近的功能调用映射",
                "params": {
                    "src_ip": "string|optional",
                    "dst_ip": "string|optional",
                    "src_port": "string|optional",
                    "dst_port": "string|optional",
                    "count": "string|optional, default '10'",
                    "time_down_limit": "string|optional"
                },
                "examples": ["count='10'"],
            },
            {
                "name": "get_func_table",
                "purpose": "获取功能ID映射表",
                "params": {},
                "examples": [],
            },
            {
                "name": "get_function_name",
                "purpose": "通过ID获取功能名称",
                "params": {"func_id": "int"},
                "examples": ["func_id=200000"],
            },
            {
                "name": "query_func_send",
                "purpose": "查询发送功能调用",
                "params": {
                    "src_ip": "string|optional",
                    "dst_ip": "string|optional",
                    "src_port": "string|optional",
                    "dst_port": "string|optional"
                },
                "examples": ["src_ip='192.168.1.100'"],
            },
            {
                "name": "query_func_recv",
                "purpose": "查询接收功能调用",
                "params": {
                    "src_ip": "string|optional",
                    "dst_ip": "string|optional",
                    "src_port": "string|optional",
                    "dst_port": "string|optional"
                },
                "examples": ["dst_ip='10.0.0.1'"],
            },
            {
                "name": "get_socket_list",
                "purpose": "获取网络套接字列表",
                "params": {},
                "examples": [],
            },
            {
                "name": "get_established_tcp_sockets",
                "purpose": "获取已建立的TCP连接",
                "params": {},
                "examples": [],
            },
            {
                "name": "is_attach_finished",
                "purpose": "检查eBPF探针加载状态",
                "params": {},
                "examples": [],
            },
            {
                "name": "health_check",
                "purpose": "服务健康检查",
                "params": {},
            },
            {
                "name": "server_capabilities",
                "purpose": "获取服务能力与示例",
                "params": {},
            },
        ],
        "natural_language_examples": [
            "帮我看下最近的10个网络数据包",
            "查询192.168.1.100的发送功能调用",
            "列出当前所有已建立的TCP连接",
            "功能ID 200000对应的是什么函数",
        ],
    }


def run():
    """Run the MCP server."""
    # 打印启动信息
    print_banner()
    print_status("正在初始化...", "info")
    
    # 打印配置信息
    print_status(f"服务器名称: {Colors.BOLD}{SERVER_NAME}{Colors.RESET}", "info")
    print_status(f"Monitor API: {Colors.BOLD}{MONITOR_API_URL}{Colors.RESET}", "info")
    print_status(f"监听地址: {Colors.BOLD}http://{SERVER_HOST}:{SERVER_PORT}{Colors.RESET}", "info")
    print_status(f"SSE 端点: {Colors.BOLD}http://{SERVER_HOST}:{SERVER_PORT}{SERVER_SSE_PATH}{Colors.RESET}", "info")
    
    print_status("正在注册工具...", "info")
    
    # 使用手动维护的工具列表
    tool_count = len(_TOOLS)
    print_status(f"已注册 {Colors.BOLD}{tool_count}{Colors.RESET} 个工具", "success")
    
    # 显示工具名称
    if tool_count > 0:
        tool_list = ", ".join(_TOOLS[:5])
        if tool_count > 5:
            tool_list += f" ... 还有 {tool_count - 5} 个"
        print_status(f"工具列表: {Colors.BOLD}{tool_list}{Colors.RESET}", "info")
    
    # 测试 Monitor API 连接
    print_status(f"正在连接 Monitor API ({MONITOR_API_URL})...", "info")
    try:
        client = get_client()
        # 尝试一个简单的健康检查
        client.is_attach_finished()
        print_status("Monitor API 连接成功", "success")
    except Exception as e:
        print_status(f"Monitor API 连接失败: {e}", "warning")
        print_status("请确保 Monitor API 正在运行", "warning")
    
    print_status("服务器已就绪", "success")
    print()
    print(f"{Colors.BOLD}提示: 按 Ctrl+C 停止服务器{Colors.RESET}")
    print()
    
    # 运行服务器
    try:
        # 使用 streamable-http 传输方式（这是功能最全的 HTTP 传输）
        transport = os.environ.get("MONITOR_MCP_TRANSPORT", "streamable-http")
        mcp.run(transport=transport)
    except KeyboardInterrupt:
        print()
        print_status("正在关闭服务器...", "info")
        print_status("再见！", "success")


if __name__ == "__main__":
    run()
