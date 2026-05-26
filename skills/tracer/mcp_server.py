#!/usr/bin/env python3
"""
PacketScope Tracer MCP Server

Provides MCP tools for interacting with the Tracer module.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from mcp.server.fastmcp import FastMCP

# Add current directory to path for tracer_client import
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from tracer_client import TracerClient

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
║        PacketScope Tracer MCP Server                       ║
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
SERVER_NAME = os.getenv("TRACER_MCP_NAME", "packetscope-tracer")
SERVER_HOST = os.getenv("TRACER_MCP_HOST", "127.0.0.1")
SERVER_PORT = int(os.getenv("TRACER_MCP_PORT", "8013"))
SERVER_MOUNT_PATH = os.getenv("TRACER_MCP_MOUNT_PATH", "/")
SERVER_SSE_PATH = os.getenv("TRACER_MCP_SSE_PATH", "/sse")
SERVER_MESSAGE_PATH = os.getenv("TRACER_MCP_MESSAGE_PATH", "/messages/")
SERVER_STREAMABLE_HTTP_PATH = os.getenv("TRACER_MCP_HTTP_PATH", "/mcp")
TRACER_API_URL = os.getenv("TRACER_API_URL", "http://localhost:8000")

SERVER_INSTRUCTIONS = """
PacketScope Tracer MCP server for route tracing and risk analysis.

Use this server when user asks for:
- network path trace / traceroute
- route anomaly analysis
- risk score or malicious hop alerts
- hop history query
- route comparison with historical paths

Tool routing guide:
- trace_target: trace a target and get hops with geo/ASN info
- analyze_target: get anomalies, alerts, and riskScore
- get_history: fetch cached route history
- get_trace_detail: get detail of a specific hop in a trace
- compare_routes: compare current path against historical paths
- health_check: server readiness and status
- server_capabilities: discover all tool usage and examples

Target input rules:
- prefer domain/IP, e.g. www.google.com or 8.8.8.8
- protocol can be "icmp" (default) or "tcp"
- port is required when protocol is "tcp"
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
_client: Optional[TracerClient] = None

# 工具列表 - 手动维护
_TOOLS = [
    "trace_target",
    "analyze_target",
    "get_history",
    "get_trace_detail",
    "compare_routes",
    "health_check",
    "server_capabilities",
]


def get_client() -> TracerClient:
    """Get or create Tracer client instance."""
    global _client
    if _client is None:
        _client = TracerClient(TRACER_API_URL)
    return _client


def log_tool_call(tool_name: str, **kwargs):
    """记录工具调用"""
    params = []
    for key, value in kwargs.items():
        if value:
            params.append(f"{key}={repr(value)}")

    if params:
        print_status(f"调用工具: {Colors.BOLD}{tool_name}{Colors.RESET} ({', '.join(params)})", "info")
    else:
        print_status(f"调用工具: {Colors.BOLD}{tool_name}{Colors.RESET}", "info")


@mcp.tool()
def trace_target(
    target: str,
    use_cache: bool = True,
    protocol: str = "icmp",
    port: Optional[int] = None,
):
    """
    Trace a network target and return hop-by-hop results with geo/ASN info.

    Args:
        target: IP address or domain name (e.g. "8.8.8.8", "www.google.com")
        use_cache: Whether to use cached results if available (default: True)
        protocol: Traceroute protocol, "icmp" or "tcp" (default: "icmp")
        port: Required when protocol is "tcp", port number 1-65535

    Returns:
        Trace result with target, resolved IP, source (cache/live), and hops list.
    """
    log_tool_call("trace_target", target=target, protocol=protocol, port=port)
    try:
        client = get_client()
        result = client.trace(
            target=target,
            use_cache=use_cache,
            protocol=protocol,
            port=port,
        )
        response = {
            "success": True,
            "target": result.target,
            "source": result.source,
            "hop_count": len(result.hops),
            "hops": result.hops,
        }
        print_status(
            f"返回 {Colors.BOLD}{len(result.hops)}{Colors.RESET} 个跳点 (来源: {result.source})",
            "success",
        )
        return response
    except Exception as e:
        print_status(f"错误: {e}", "warning")
        return {"success": False, "error": str(e)}


@mcp.tool()
def analyze_target(target: str, cache: bool = True):
    """
    Analyze route anomalies and calculate risk score for a target.

    Args:
        target: IP address or domain name
        cache: Whether to use cached trace results (default: True)

    Returns:
        Analysis result with anomalies, alerts, and riskScore (0-100).
    """
    log_tool_call("analyze_target", target=target)
    try:
        client = get_client()
        result = client.analyze(target=target, cache=cache)

        # Risk level
        if result.risk_score >= 70:
            level = "high"
        elif result.risk_score >= 40:
            level = "medium"
        else:
            level = "low"

        response = {
            "success": True,
            "target": result.target,
            "riskScore": result.risk_score,
            "riskLevel": level,
            "anomalies": result.anomalies,
            "alerts": result.alerts,
        }
        print_status(
            f"风险评分: {Colors.BOLD}{result.risk_score}{Colors.RESET} ({level}), "
            f"异常: {len(result.anomalies)}, 告警: {len(result.alerts)}",
            "success",
        )
        return response
    except Exception as e:
        print_status(f"错误: {e}", "warning")
        return {"success": False, "error": str(e)}


@mcp.tool()
def get_history(target: Optional[str] = None, limit: int = 20):
    """
    Get traceroute history records.

    Args:
        target: Optional IP/domain filter. If None, returns all history.
        limit: Maximum number of records per target (default: 20)

    Returns:
        Dictionary of history records keyed by target.
    """
    log_tool_call("get_history", target=target, limit=limit)
    try:
        client = get_client()
        history = client.get_history(target=target)

        # Apply limit per target
        if limit > 0:
            limited = {}
            for key, records in history.items():
                if isinstance(records, list):
                    limited[key] = records[:limit]
                else:
                    limited[key] = records
            history = limited

        total = sum(len(v) for v in history.values() if isinstance(v, list))
        print_status(f"返回 {Colors.BOLD}{total}{Colors.RESET} 条历史记录", "success")
        return {"success": True, "history": history}
    except Exception as e:
        print_status(f"错误: {e}", "warning")
        return {"success": False, "error": str(e)}


@mcp.tool()
def get_trace_detail(target: str, hop_index: int):
    """
    Get detailed information about a specific hop in a trace.

    Args:
        target: IP address or domain name
        hop_index: Hop index (0-based, 0 = first hop)

    Returns:
        Detailed hop information including geo, ASN, latency, etc.
    """
    log_tool_call("get_trace_detail", target=target, hop_index=hop_index)
    try:
        client = get_client()
        result = client.trace(target=target, use_cache=True)

        if hop_index < 0 or hop_index >= len(result.hops):
            return {
                "success": False,
                "error": f"Hop index {hop_index} out of range (0-{len(result.hops)-1})",
            }

        hop = result.hops[hop_index]
        print_status(
            f"跳点 {Colors.BOLD}{hop_index}{Colors.RESET}: {hop.get('ip', 'unknown')} "
            f"({hop.get('location', 'unknown')})",
            "success",
        )
        return {"success": True, "hop_index": hop_index, "hop": hop}
    except Exception as e:
        print_status(f"错误: {e}", "warning")
        return {"success": False, "error": str(e)}


@mcp.tool()
def compare_routes(target: str):
    """
    Compare the current route to a target against its historical routes.

    Detects path deviations, new IPs, and latency changes compared to
    the most recent historical trace.

    Args:
        target: IP address or domain name

    Returns:
        Comparison result showing current vs historical path differences.
    """
    log_tool_call("compare_routes", target=target)
    try:
        client = get_client()

        # Get current trace (live)
        current = client.trace(target=target, use_cache=False)

        # Get history
        history = client.get_history(target=target)

        # Find the most recent historical record
        historical_hops = None
        for ip_key, records in history.items():
            if isinstance(records, list) and records:
                latest = records[0]
                if isinstance(latest, dict):
                    result_data = latest.get("result", latest)
                    if isinstance(result_data, list):
                        historical_hops = result_data
                    elif isinstance(result_data, dict) and "hops" in result_data:
                        historical_hops = result_data["hops"]
                break

        if historical_hops is None:
            return {
                "success": True,
                "target": target,
                "comparison": "no_history",
                "message": "No historical data available for comparison",
                "current_hops": current.hops,
                "hop_count": len(current.hops),
            }

        # Compare IPs
        current_ips = [h.get("ip") for h in current.hops]
        historical_ips = [h.get("ip") for h in historical_hops]

        new_ips = [ip for ip in current_ips if ip and ip not in set(historical_ips)]
        removed_ips = [ip for ip in historical_ips if ip and ip not in set(current_ips)]

        # Compare latency
        latency_changes = []
        hist_ip_map = {h.get("ip"): h for h in historical_hops if h.get("ip")}
        for hop in current.hops:
            ip = hop.get("ip")
            if ip and ip in hist_ip_map:
                cur_lat = hop.get("latency")
                hist_lat = hist_ip_map[ip].get("latency")
                if cur_lat and hist_lat:
                    diff = round(cur_lat - hist_lat, 2)
                    if abs(diff) > 50:
                        latency_changes.append({
                            "ip": ip,
                            "current_latency": cur_lat,
                            "historical_latency": hist_lat,
                            "change_ms": diff,
                        })

        response = {
            "success": True,
            "target": target,
            "current_hop_count": len(current.hops),
            "historical_hop_count": len(historical_hops),
            "new_ips": new_ips,
            "removed_ips": removed_ips,
            "latency_changes": latency_changes,
        }

        changes = len(new_ips) + len(removed_ips) + len(latency_changes)
        print_status(
            f"路径对比完成: {Colors.BOLD}{changes}{Colors.RESET} 处差异 "
            f"(新增: {len(new_ips)}, 移除: {len(removed_ips)}, 延迟变化: {len(latency_changes)})",
            "success",
        )
        return response
    except Exception as e:
        print_status(f"错误: {e}", "warning")
        return {"success": False, "error": str(e)}


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
        ready = client.is_ready()
        health = client.health_check()

        result = {
            "success": True,
            "ready": ready,
            "timestamp": datetime.now().isoformat(),
            "tracer_api_url": TRACER_API_URL,
            **health,
        }

        status_msg = "Tracer API 已就绪" if ready else "Tracer API 未就绪"
        print_status(f"健康检查完成: {Colors.BOLD}{status_msg}{Colors.RESET}", "success")
        return result
    except Exception as e:
        print_status(f"健康检查失败: {e}", "warning")
        return {"success": False, "ready": False, "error": str(e)}


@mcp.tool()
def server_capabilities():
    """
    Get server capabilities and tool usage examples.

    Returns:
        Server capabilities and tool documentation.
    """
    return {
        "name": SERVER_NAME,
        "transport": "streamable-http",
        "tracer_api_url": TRACER_API_URL,
        "tools": [
            {
                "name": "trace_target",
                "purpose": "追踪目标路由并返回 hops",
                "params": {
                    "target": "string, IP or domain",
                    "use_cache": "boolean, default=true",
                    "protocol": "string, 'icmp' or 'tcp', default='icmp'",
                    "port": "int|optional, required when protocol='tcp', 1-65535",
                },
                "examples": ["www.google.com", "8.8.8.8", "target='1.1.1.1', protocol='tcp', port=443"],
            },
            {
                "name": "analyze_target",
                "purpose": "分析路径异常并返回风险评分",
                "params": {"target": "string", "cache": "boolean, default=true"},
                "examples": ["www.youtube.com", "1.1.1.1"],
            },
            {
                "name": "get_history",
                "purpose": "查询历史路由记录",
                "params": {"target": "string|optional", "limit": "int, default=20"},
                "examples": ["target=www.google.com", "target omitted"],
            },
            {
                "name": "get_trace_detail",
                "purpose": "获取特定跳点的详细信息",
                "params": {"target": "string", "hop_index": "int, 0-based"},
                "examples": ["target=8.8.8.8, hop_index=3"],
            },
            {
                "name": "compare_routes",
                "purpose": "对比当前路径与历史路径",
                "params": {"target": "string"},
                "examples": ["target=www.google.com"],
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
            "帮我看下到 www.google.com 的路径质量",
            "分析 8.8.8.8 的风险和异常",
            "把最近 10 条 www.youtube.com 的历史记录给我",
            "用 TCP 方式追踪到 1.1.1.1 的 443 端口",
            "对比一下现在到 google.com 的路径和之前有什么不同",
        ],
    }


def run():
    """Run the MCP server."""
    # 打印启动信息
    print_banner()
    print_status("正在初始化...", "info")

    # 打印配置信息
    print_status(f"服务器名称: {Colors.BOLD}{SERVER_NAME}{Colors.RESET}", "info")
    print_status(f"Tracer API: {Colors.BOLD}{TRACER_API_URL}{Colors.RESET}", "info")
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

    # 测试 Tracer API 连接
    print_status(f"正在连接 Tracer API ({TRACER_API_URL})...", "info")
    try:
        client = get_client()
        ready = client.is_ready()
        if ready:
            print_status("Tracer API 连接成功", "success")
        else:
            print_status("Tracer API 未就绪", "warning")
    except Exception as e:
        print_status(f"Tracer API 连接失败: {e}", "warning")
        print_status("请确保 Tracer API 正在运行", "warning")

    print_status("服务器已就绪", "success")
    print()
    print(f"{Colors.BOLD}提示: 按 Ctrl+C 停止服务器{Colors.RESET}")
    print()

    # 运行服务器
    try:
        mcp.run(transport="streamable-http")
    except KeyboardInterrupt:
        print()
        print_status("正在关闭服务器...", "info")
        print_status("再见！", "success")


if __name__ == "__main__":
    run()
