# PacketScope Tracer API Skill & MCP Server

This skill enables LLM to interact with the PacketScope Tracer module API for route tracing, risk analysis, and history queries.

## Overview

Tracer is a network path analysis module that provides:
- Real-time traceroute with ICMP and TCP protocols
- Geographic and ASN enrichment for each hop
- Route anomaly detection and risk scoring
- Historical route tracking and comparison
- Malicious IP detection against threat intelligence feeds

## MCP Server Tools

The Tracer MCP Server provides the following tools for LLM interaction:

### Route Tracing Tools

- `trace_target` - Trace a network target and return hop-by-hop results
  - Parameters: `target` (string), `use_cache` (bool, default: True), `protocol` ("icmp" or "tcp", default: "icmp"), `port` (int, optional, required for TCP)
  - Returns: Target, resolved IP, source (cache/live), hop list with geo/ASN info

- `get_trace_detail` - Get detailed information about a specific hop
  - Parameters: `target` (string), `hop_index` (int, 0-based)
  - Returns: Detailed hop info including IP, latency, jitter, packet loss, location, ASN, ISP, geo coordinates

- `compare_routes` - Compare current route against historical routes
  - Parameters: `target` (string)
  - Returns: New IPs, removed IPs, latency changes between current and historical path

### Risk Analysis Tools

- `analyze_target` - Run anomaly analysis and calculate risk score
  - Parameters: `target` (string), `cache` (bool, default: True)
  - Returns: Anomalies list, alerts list, riskScore (0-100), riskLevel (low/medium/high)

### History Tools

- `get_history` - Get traceroute history records
  - Parameters: `target` (string, optional), `limit` (int, default: 20)
  - Returns: Dictionary of history records keyed by target IP

### Status Check Tools

- `health_check` - Check server health and readiness
  - Parameters: None
  - Returns: Health status, readiness, timestamp

- `server_capabilities` - Get server capabilities and tool usage examples
  - Parameters: None
  - Returns: Server capabilities, tool list, natural language examples

## API Endpoints

### Base URL

```
http://localhost:8000
```

### Route Tracing

#### Trace Target

- **Endpoint**: `GET /api/trace`
- **Description**: Run a traceroute to the target
- **Query Parameters**:
  - `target`: IP address or domain (required)
  - `use_cache`: Use cached results if available (default: "true")
  - `protocol`: "icmp" or "tcp" (default: "icmp")
  - `port`: Port number, required when protocol=tcp (1-65535)

**Response** (streaming NDJSON, one hop per line):

```json
{"hop": 1, "ip": "192.168.1.1", "latency": 1.23, "jitter": 0.5, "packet_loss": "0.0%", "bandwidth_mbps": 47.17, "location": "Beijing, China", "asn": "4134", "isp": "China Telecom", "geo": {"lat": 39.9, "lon": 116.4, "radius_km": 50, "timezone": "Asia/Shanghai"}}
```

### Risk Analysis

#### Analyze Target

- **Endpoint**: `GET /api/analyze`
- **Description**: Run anomaly analysis and risk scoring
- **Query Parameters**:
  - `target`: IP address or domain (required)
  - `cache`: Use cached trace results (default: "true")

**Response**:

```json
{
  "anomalies": [
    {"type": "PathDeviation", "detail": "跳点 5 出现新IP 10.0.0.1"},
    {"type": "HighLatency", "detail": "跳点 5 (10.0.0.1) 延迟过高 250ms"}
  ],
  "alerts": [
    "跳点 10.0.0.1 被列为恶意IP: Spamhaus DROP list"
  ],
  "riskScore": 50
}
```

### History

#### Get History

- **Endpoint**: `GET /api/history`
- **Description**: Get traceroute history records
- **Query Parameters**:
  - `target`: IP or domain filter (optional)

**Response**:

```json
{
  "8.8.8.8": [
    {
      "timestamp": "20240101-120000",
      "protocol": "icmp",
      "result": [...]
    }
  ]
}
```

### Status Check

#### Readiness Check

- **Endpoint**: `GET /api/ready`
- **Description**: Check if the Tracer service is ready

**Response**:

```json
{
  "ready": true,
  "timestamp": "2024-01-01T12:00:00.000000"
}
```

## Usage Examples

### Python Client Example

```python
from tracer_client import TracerClient

# Create client
client = TracerClient("http://localhost:8000")

# ICMP trace
result = client.trace("8.8.8.8")
print(f"Hops: {len(result.hops)}, Source: {result.source}")

# TCP trace
result = client.trace("1.1.1.1", protocol="tcp", port=443)
print(f"Hops: {len(result.hops)}")

# Risk analysis
analysis = client.analyze("8.8.8.8")
print(f"Risk Score: {analysis.risk_score}, Anomalies: {len(analysis.anomalies)}")

# History
history = client.get_history(target="8.8.8.8")
print(f"Records: {len(history.get('8.8.8.8', []))}")
```

## Risk Score Levels

| Score | Level | Description |
|-------|-------|-------------|
| 0-39 | low | Route appears normal, no significant threats |
| 40-69 | medium | Some anomalies detected, moderate risk |
| 70-100 | high | Significant threats or multiple anomalies |

## Anomaly Types

| Type | Description |
|------|-------------|
| `PathDeviation` | A hop IP not seen in historical traces |
| `HighLatency` | A hop with latency exceeding 200ms |
| `MaliciousIP` | A hop IP found in threat intelligence feeds |
