import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from mcp.server.fastmcp import FastMCP

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.services import tracer_service as service

SERVER_NAME = os.getenv("TRACER_MCP_NAME", "packetscope-tracer")
SERVER_HOST = os.getenv("TRACER_MCP_HOST", "127.0.0.1")
SERVER_PORT = int(os.getenv("TRACER_MCP_PORT", "8011"))
SERVER_MOUNT_PATH = os.getenv("TRACER_MCP_MOUNT_PATH", "/")
SERVER_SSE_PATH = os.getenv("TRACER_MCP_SSE_PATH", "/sse")
SERVER_MESSAGE_PATH = os.getenv("TRACER_MCP_MESSAGE_PATH", "/messages/")
SERVER_STREAMABLE_HTTP_PATH = os.getenv("TRACER_MCP_HTTP_PATH", "/mcp")
SERVER_TRANSPORT = os.getenv("TRACER_MCP_TRANSPORT", "stdio")

SERVER_INSTRUCTIONS = """
PacketScope Tracer MCP server for route tracing and risk analysis.

Use this server when user asks for:
- network path trace / traceroute
- hop history query
- route anomaly analysis
- risk score or malicious hop alerts

Tool routing guide:
- trace_target: get hops and geo/asn info
- analyze_target: get anomalies and riskScore
- get_history: fetch cached route history
- health_check: server readiness
- server_capabilities: discover all tool usage and examples

Target input rules:
- prefer domain/IP, e.g. www.google.com or 8.8.8.8
- URL input is accepted and normalized automatically
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


def _normalize_target(target: str) -> str:
    normalized = target.strip().strip("`'\"")
    normalized = normalized.replace("%E3%80%82", "")
    normalized = normalized.rstrip("。.,;!?")
    if "://" in normalized:
        parsed = urlparse(normalized)
        if parsed.hostname:
            normalized = parsed.hostname
    normalized = re.sub(r"\s+", "", normalized)
    return normalized


def _resolve_target_ip(target: str) -> str:
    normalized = _normalize_target(target)
    ip_address = (
        service.get_ip_from_url(normalized)
        if not normalized.replace(".", "").isdigit()
        else normalized
    )
    if not ip_address:
        raise ValueError(f"Invalid target: {target}")
    return ip_address


def _collect_live_hops(target: str, ip_address: str):
    hops = []
    for line in service.run_traceroute(target, ip_address):
        line = line.strip()
        if not line:
            continue
        try:
            hops.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return hops


def _load_latest_cached_hops(ip_address: str):
    ip_dir = os.path.join(service.HISTORY_DIR, ip_address)
    if not os.path.exists(ip_dir):
        return None
    files = sorted(os.listdir(ip_dir), reverse=True)
    if not files:
        return None
    latest_file = os.path.join(ip_dir, files[0])
    with open(latest_file, "r") as f:
        return json.load(f)


def _load_history_records(target: Optional[str] = None, limit: int = 20):
    if target:
        ip_address = _resolve_target_ip(target)
        ip_dir = os.path.join(service.HISTORY_DIR, ip_address)
        if not os.path.exists(ip_dir):
            return {target: []}
        history = []
        for file_name in sorted(os.listdir(ip_dir), reverse=True)[:limit]:
            file_path = os.path.join(ip_dir, file_name)
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
                timestamp = file_name.split("-")[0]
                history.append({"timestamp": timestamp, "result": data})
            except Exception:
                continue
        return {target: history}

    records = {}
    if not os.path.exists(service.HISTORY_DIR):
        return records

    for ip in os.listdir(service.HISTORY_DIR):
        ip_path = os.path.join(service.HISTORY_DIR, ip)
        if not os.path.isdir(ip_path):
            continue
        entries = []
        for file_name in sorted(os.listdir(ip_path), reverse=True)[:limit]:
            file_path = os.path.join(ip_path, file_name)
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
                timestamp = file_name.split("-")[0]
                entries.append({"timestamp": timestamp, "result": data})
            except Exception:
                continue
        records[ip] = entries
    return records


@mcp.tool()
def trace_target(target: str, use_cache: bool = True):
    normalized = _normalize_target(target)
    if not normalized:
        return {"error": "Missing target"}

    try:
        ip_address = _resolve_target_ip(normalized)
    except ValueError as e:
        return {"error": str(e)}

    hops = _load_latest_cached_hops(ip_address) if use_cache else None
    source = "cache"
    if hops is None:
        hops = _collect_live_hops(normalized, ip_address)
        source = "live"

    return {
        "target": normalized,
        "resolved_ip": ip_address,
        "source": source,
        "hops": hops,
    }


@mcp.tool()
def analyze_target(target: str, use_cache: bool = True):
    trace_result = trace_target(target=target, use_cache=use_cache)
    if "error" in trace_result:
        return trace_result

    ip_address = trace_result["resolved_ip"]
    current_hops = trace_result["hops"]
    history = service.load_recent_history(ip_address)
    anomalies = service.analyze_anomalies(current_hops, history)
    risk_score, alerts = service.guarder_risk_score(current_hops)
    alerts += [a["detail"] for a in anomalies]
    total_score = min(risk_score + len(anomalies) * 10, 100)

    return {
        "target": target,
        "resolved_ip": ip_address,
        "anomalies": anomalies,
        "alerts": alerts,
        "riskScore": total_score,
    }


@mcp.tool()
def get_history(target: Optional[str] = None, limit: int = 20):
    if limit <= 0:
        return {"error": "limit must be greater than 0"}
    normalized_target = _normalize_target(target) if target else None
    return {"history": _load_history_records(target=normalized_target, limit=limit)}


@mcp.tool()
def health_check():
    return {
        "ready": True,
        "timestamp": datetime.now().isoformat(),
        "riskyIpsCount": len(service.RISKY_IPS),
    }


@mcp.tool()
def server_capabilities():
    return {
        "name": SERVER_NAME,
        "transport": SERVER_TRANSPORT,
        "tools": [
            {
                "name": "trace_target",
                "purpose": "追踪目标路由并返回 hops",
                "params": {"target": "string", "use_cache": "boolean, default=true"},
                "examples": ["www.google.com", "8.8.8.8", "http://www.google.com"],
            },
            {
                "name": "analyze_target",
                "purpose": "分析路径异常并返回风险评分",
                "params": {"target": "string", "use_cache": "boolean, default=true"},
                "examples": ["www.youtube.com", "1.1.1.1"],
            },
            {
                "name": "get_history",
                "purpose": "查询历史记录",
                "params": {"target": "string|optional", "limit": "int, default=20"},
                "examples": ["target=www.google.com", "target omitted"],
            },
            {"name": "health_check", "purpose": "服务健康检查", "params": {}},
            {"name": "server_capabilities", "purpose": "获取服务能力与示例", "params": {}},
        ],
        "natural_language_examples": [
            "帮我看下到 www.google.com 的路径质量",
            "分析 8.8.8.8 的风险和异常",
            "把最近 10 条 www.youtube.com 的历史记录给我",
        ],
    }


def run():
    mcp.run(transport=SERVER_TRANSPORT, mount_path=SERVER_MOUNT_PATH)


if __name__ == "__main__":
    run()
