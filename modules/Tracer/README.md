# Tracer v2

A Flask + MCP network path analysis service that combines real-time `traceroute`, geographic and ASN enrichment, history caching, anomaly analysis, and Spamhaus-based malicious IP risk scoring.

---

## Features Overview

* Real-time `traceroute` with per-hop streaming output, supporting both `icmp` and `tcp`.
* City and ASN enrichment powered by MaxMind GeoLite2.
* Historical path storage with comparison-based anomaly detection.
* Malicious IP checks using Spamhaus DROP / EDROP with risk scoring.
* MCP tools for direct use from MCP clients (Trae/Cline, etc.).

---

## Project Structure (v2)

```text
Tracer/
├── app/
│   ├── api/
│   │   └── http_server.py                # Flask HTTP entry
│   ├── mcp/
│   │   └── server.py                     # MCP server entry
│   ├── services/
│   │   └── tracer_service.py             # Core business logic
│   └── jobs/
│       └── update_threat_intel.py        # Threat intel update job
├── data/
│   ├── geoip/
│   │   ├── GeoLite2-City.mmdb            # City-level geolocation DB
│   │   └── GeoLite2-ASN.mmdb             # ASN DB
│   ├── threat/
│   │   └── risky_ips.json                # Risky IP list
│   └── history/                          # Traceroute history cache
├── requirements.txt
├── start_server.sh                       # Start HTTP service
├── start_mcp.sh                          # Start MCP service
├── README-zh-v2.md
└── README-v2.md
```

---

## Quick Start Guide

### 1. Start with Docker or Docker Compose

#### 1.1 Start using Docker Compose (recommended)

```bash
docker-compose up --build
```

#### 1.2 Start manually with Docker

```bash
docker build -t packetscope-tracer .
docker run --rm -v $(pwd)/data/history:/app/data/history -p 8000:8000 packetscope-tracer
```

Default port: `8000`

---

### 2. Install dependencies (without Docker)

```bash
cd /home/ubuntu/PacketScope/modules/Tracer
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

### 3. Download MaxMind GeoIP databases

Register on MaxMind and download:

* [GeoLite2-City.mmdb](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data)
* [GeoLite2-ASN.mmdb](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data)

Place them in:

```text
data/geoip/
```

---

### 4. Install `nexttrace`

To run traceroute, install [`nexttrace`](https://github.com/nexttrace/nexttrace):

```bash
curl -sL nxtrace.org/nt | sudo bash && \
NT_PATH=$(command -v nexttrace) && \
sudo setcap cap_net_raw,cap_net_admin+eip "$NT_PATH"
```

---

### 5. Start HTTP service

Recommended:

```bash
cd /home/ubuntu/PacketScope/modules/Tracer
./start_server.sh
```

Or run directly:

```bash
python3 app/api/http_server.py
```

Default port: `8000`

---

### 6. Start MCP service

```bash
cd /home/ubuntu/PacketScope/modules/Tracer
./start_mcp.sh
```

Default env vars (override if needed):

* `TRACER_MCP_TRANSPORT=sse`
* `TRACER_MCP_HOST=0.0.0.0`
* `TRACER_MCP_PORT=8011`
* `TRACER_MCP_HTTP_PATH=/mcp`
* `TRACER_MCP_SSE_PATH=/sse`
* `TRACER_MCP_MESSAGE_PATH=/messages/`

---

### 7. Update malicious IP data

Threat intel sources:

* Spamhaus [DROP list](https://www.spamhaus.org/drop/)
* Spamhaus [EDROP list](https://www.spamhaus.org/drop/edrop/)

Run:

```bash
python3 app/jobs/update_threat_intel.py
```

Output:

```text
data/threat/risky_ips.json
```

---

## API Reference

### `GET /api/trace?target=<ip|domain>&use_cache=true|false&protocol=icmp|tcp&port=<1-65535>`

Runs traceroute for the target.

**Parameters:**

* `target`: Target domain or IP.
* `use_cache`: Whether to use history cache (default: `true`).
* `protocol`: Probe protocol, `icmp` or `tcp` (default: `icmp`).
* `port`: Required only when `protocol=tcp`, range `1-65535`.
* Compatibility: legacy `cache` is still supported; if `protocol` is omitted, `icmp` is used.
**Sample request:**

```
curl 'http://localhost:8000/api/trace?target=8.8.8.8&use_cache=false&protocol=icmp'
curl 'http://localhost:8000/api/trace?target=8.8.8.8&use_cache=false&protocol=tcp&port=53'
``` 
**Sample response:**

```json
{
  "hop": 1,
  "ip": "106.187.16.93",
  "latency": 30.998,
  "jitter": 3.1,
  "packet_loss": "0%",
  "bandwidth_mbps": 3.13,
  "location": "None, Japan",
  "asn": 2516,
  "isp": "KDDI CORPORATION",
  "geo": {
    "lat": 35.6895,
    "lon": 139.6917,
    "radius_km": 20,
    "timezone": "Asia/Tokyo"
  }
}
```

---

### `GET /api/history?target=<ip|domain>`

Returns historical traceroute records for the target, or all records if `target` is omitted.

**Parameters:**

* `target`: Target domain or IP.
* No need to pass `protocol` or `port`; backend auto-merges both `icmp` and `tcp` records for the same target.
* Each record includes `protocol`; if `protocol=tcp`, the record also includes `port`.

**Sample response:**

```json
{
  "www.youtube.com": [
    {
      "timestamp": "20250505",
      "protocol": "icmp",
      "result": [
        {
          "hop": 1,
          "ip": "203.0.113.1",
          "latency": 12.3,
          "packet_loss": "0%"
        }
      ]
    },
    {
      "timestamp": "20250504",
      "protocol": "tcp",
      "port": 80,
      "result": [
        {
          "hop": 1,
          "ip": "198.51.100.10",
          "latency": 18.6,
          "packet_loss": "0%"
        }
      ]
    }
  ]
}
```

---

### `GET /api/analyze?target=<ip|domain>&cache=true|false`

Runs anomaly analysis and risk scoring based on historical paths and blacklist data.

**Sample response:**

```json
{
  "anomalies": [
    {
      "type": "PathDeviation",
      "detail": "Hop 4 shows a new IP 203.0.113.1"
    }
  ],
  "alerts": [
    "Hop 203.0.113.1 is listed as malicious: listed on Spamhaus DROP"
  ],
  "riskScore": 70
}
```

---

### `GET /api/ready`

Service readiness check.

**Sample response:**

```json
{
  "ready": true,
  "timestamp": "2026-03-18T20:00:00.000000"
}
```

---

## MCP Usage

### MCP tools

* `trace_target(target, use_cache=true)`
* `analyze_target(target, use_cache=true)`
* `get_history(target=None, limit=20)`
* `health_check()`
* `server_capabilities()`

### Client config example

#### sse

```json
{
  "mcpServers": {
    "packetscope-tracer": {
      "transport": "sse",
      "url": "http://<server-ip>:8011/sse"
    }
  }
}
```

#### stdio (local process)

```json
{
  "mcpServers": {
    "packetscope-tracer": {
      "command": "python3",
      "args": ["/home/ubuntu/PacketScope/modules/Tracer/app/mcp/server.py"],
      "env": {
        "TRACER_MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

### Natural language examples

* Analyze route risk for `www.google.com`
* Query the latest 10 route histories for `8.8.8.8`
* Run readiness check, then trace `1.1.1.1`

---

## Acknowledgments

Special thanks to [nexttrace](https://github.com/nexttrace/nexttrace) for the open-source traceroute engine.
