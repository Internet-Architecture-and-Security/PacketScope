# Tracer v2

一个基于 Flask + MCP 的网络路径分析服务，集成实时 `traceroute` 路由追踪、地理与 ASN 查询、历史缓存记录、异常分析和 Spamhaus 恶意 IP 风险评估功能。

---

## 项目功能一览

* 实时 `traceroute` 路径跟踪，支持 `icmp/tcp` 协议与流式响应每跳节点；
* 基于 MaxMind GeoLite2 提供城市和 ASN 信息；
* 支持对比历史记录并检测路径偏移或高延迟；
* 检测黑名单 IP（Spamhaus DROP/EDROP），输出风险评分；
* 提供 MCP 接口，可直接被 MCP 客户端（Trae/Cline等） 调用。

---

## 项目结构（v2）

```text
Tracer/
├── app/
│   ├── api/
│   │   └── http_server.py                # Flask HTTP 服务入口
│   ├── mcp/
│   │   └── server.py                     # MCP Server 入口
│   ├── services/
│   │   └── tracer_service.py             # 核心业务逻辑
│   └── jobs/
│       └── update_threat_intel.py        # 风险情报更新任务
├── data/
│   ├── geoip/
│   │   ├── GeoLite2-City.mmdb            # 城市级地理 IP 数据库
│   │   └── GeoLite2-ASN.mmdb             # ASN 数据库
│   ├── threat/
│   │   └── risky_ips.json                # 风险 IP 列表
│   └── history/                          # 路由历史缓存
├── requirements.txt
├── start_server.sh                       # 一键启动 HTTP 服务
├── start_mcp.sh                          # 一键启动 MCP 服务
├── README-zh.md
└── README.md
```

---

## 快速启动指南

### 1. 安装依赖（如果不使用 Docker）

```bash
cd /home/ubuntu/PacketScope/modules/Tracer
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

### 2. 下载 MaxMind GeoIP 数据库

前往 MaxMind 官网注册账号并下载两个免费数据库：

* [GeoLite2-City.mmdb](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data)
* [GeoLite2-ASN.mmdb](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data)

将它们放到以下目录：

```text
data/geoip/
```

---

### 3. 下载并安装 `nexttrace`

为了能够运行 `traceroute`，需要安装 [`nexttrace`](https://github.com/nexttrace/nexttrace) 工具。如果使用的是 Linux 系统，可以使用如下命令安装：

```bash
curl -sL nxtrace.org/nt | sudo bash && \
NT_PATH=$(command -v nexttrace) && \
sudo setcap cap_net_raw,cap_net_admin+eip "$NT_PATH"
```

---

### 4. 启动 HTTP 服务

推荐使用启动脚本：

```bash
cd /home/ubuntu/PacketScope/modules/Tracer
./start_server.sh
```

也可手动启动：

```bash
python3 app/api/http_server.py
```

服务默认监听在端口 `8000`。

---

### 5. 启动 MCP 服务

```bash
cd /home/ubuntu/PacketScope/modules/Tracer
./start_mcp.sh
```

默认环境变量（可覆盖）：

* `TRACER_MCP_TRANSPORT=sse`
* `TRACER_MCP_HOST=0.0.0.0`
* `TRACER_MCP_PORT=8011`
* `TRACER_MCP_HTTP_PATH=/mcp`
* `TRACER_MCP_SSE_PATH=/sse`
* `TRACER_MCP_MESSAGE_PATH=/messages/`

---

### 6. 更新黑名单 IP 数据

风险情报来源：

* Spamhaus [DROP list](https://www.spamhaus.org/drop/)
* Spamhaus [EDROP list](https://www.spamhaus.org/drop/edrop/)

执行：

```bash
python3 app/jobs/update_threat_intel.py
```

输出文件位置：

```text
data/threat/risky_ips.json
```

---

## API 接口说明

### `GET /api/trace?target=<ip|domain>&use_cache=true|false&protocol=icmp|tcp&port=<1-65535>`

执行 traceroute 路径追踪。参数说明：

* `target`：目标域名或 IP；
* `use_cache`：是否使用历史缓存（默认 `true`）；
* `protocol`：探测协议，支持 `icmp` 或 `tcp`（默认 `icmp`）；
* `port`：仅当 `protocol=tcp` 时必填，范围 `1-65535`；
* 兼容说明：历史参数 `cache` 仍可用，未传 `protocol` 时默认按 `icmp` 处理。

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

查询指定目标的历史记录（或查询全部）。

参数说明：

* `target`：目标域名或 IP；
* 不需要传 `protocol`/`port`，后端会自动聚合同一目标的 `icmp` 与 `tcp` 历史记录；
* 返回记录中会包含 `protocol` 字段；当 `protocol=tcp` 时会额外返回 `port` 字段。

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

基于目标路由历史与风险数据库进行分析，返回：

* `anomalies`：路径异常
* `alerts`：风险告警
* `riskScore`：综合风险分数

**Sample response:**

```json
{
  "anomalies": [
    {
      "type": "PathDeviation",
      "detail": "跳点 4 出现新IP 203.0.113.1"
    }
  ],
  "alerts": [
    "跳点 203.0.113.1 被列为恶意IP: listed on Spamhaus DROP"
  ],
  "riskScore": 70
}
```

---

### `GET /api/ready`

服务健康检查接口。

**Sample response:**

```json
{
  "ready": true,
  "timestamp": "2026-03-18T20:00:00.000000"
}
```

---

## MCP 使用说明

### MCP 工具清单

* `trace_target(target, use_cache=true)`
* `analyze_target(target, use_cache=true)`
* `get_history(target=None, limit=20)`
* `health_check()`
* `server_capabilities()`

### 在客户端中配置（示例）

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

#### stdio（本机拉起）

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

### 自然语言调用示例

* 帮我分析 `www.google.com` 的路由风险
* 给我查询 `8.8.8.8` 最近 10 条历史路径
* 先做一次健康检查，再追踪 `1.1.1.1`

---

## 致谢

感谢 [nexttrace](https://github.com/nexttrace/nexttrace) 提供的开源路由追踪工具，它使得实时路径追踪变得更加便捷。
