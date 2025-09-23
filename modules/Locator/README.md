# Locator

一个基于 Flask 的网络路径分析服务，集成实时 `traceroute` 路由追踪、地理与 ASN 查询、历史缓存记录、异常分析和 Spamhaus 恶意 IP 风险评估功能。

---

## 项目功能一览

* 实时 `traceroute` 路径跟踪，支持流式响应每跳节点；
* 基于 MaxMind GeoLite2 提供城市和 ASN 信息；
* 支持对比历史记录并检测路径偏移或高延迟；
* 检测黑名单 IP（Spamhaus DROP/EDROP），输出风险评分；
* 自动更新黑名单 IP，维护 `risky_ips.json` 文件。

---

## 项目结构

```
├── backend.py                  # Flask 后端主程序
├── update_threat_intel.py      # 恶意 IP 更新脚本（从 Spamhaus）
├── risky_ips.json              # 自动生成的风险 IP 列表（JSON 格式）
├── GeoLite2-City.mmdb          # 城市级地理 IP 数据库
├── GeoLite2-ASN.mmdb           # ASN 数据库
├── history/                    # 缓存历史 traceroute 路径
├── Dockerfile                  # Dockerfile 文件
├── docker-compose.yml          # Docker Compose 文件
```

---

## 快速启动指南

### 1. 使用 Docker 或 Docker Compose 启动

#### 1.1 使用 Docker Compose 启动

推荐使用 Docker Compose 来启动所有服务。只需运行以下命令：

```bash
docker-compose up --build
```

这将自动构建并启动所有依赖的容器，包括 Flask 后端和 `nexttrace` 服务。

#### 1.2 使用 Docker 启动

如果你没有使用 Docker Compose，可以按照以下步骤使用 Docker 来手动启动容器：

```bash
# 构建镜像
docker build -t packetscope-locator .

# 启动容器
docker run --rm -v $(pwd)/history:/app/history -p 8000:8000 packetscope-locator
```

服务默认监听在端口 `8000`。

---

### 2. 安装依赖（如果不使用 Docker）

如果你不想使用 Docker，可以按照原始安装方法手动启动服务：

```bash
# 创建虚拟环境
python3 -m venv .venv

# 激活虚拟环境
source .venv/bin/activate

# 安装 Python 依赖
pip install -r requirements.txt
```

---

### 3. 下载 MaxMind GeoIP 数据库

前往 MaxMind 官网注册账号并下载两个免费数据库：

* [GeoLite2-City.mmdb](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data)
* [GeoLite2-ASN.mmdb](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data)

将它们放在项目根目录下。

---

### 4. 下载并安装 `nexttrace`

为了能够运行 `traceroute`，需要安装 [`nexttrace`](https://github.com/nexttrace/nexttrace) 工具。如果使用的是 Linux 系统，可以使用如下命令安装：

   ```bash
   curl -sL nxtrace.org/nt | sudo bash
   ```
---

### 5. 更新黑名单 IP 数据

#### 风险 IP 数据说明来源

使用 `update_threat_intel.py` 脚本自动获取：

* Spamhaus [DROP list](https://www.spamhaus.org/drop/)
* Spamhaus [EDROP list](https://www.spamhaus.org/drop/edrop/)

#### 格式

`risky_ips.json` 文件结构如下：

```json
{
  "192.0.2.0/24": "Spamhaus DROP listed",
  "203.0.113.0/25": "Known malware distributor"
}
```

匹配时将检查每个跳点 IP 是否属于黑名单段。使用以下脚本从 Spamhaus 获取 DROP 和 EDROP 列表：

```bash
python update_threat_intel.py
```

该脚本将生成/更新 `risky_ips.json`，供主服务用于黑名单风险分析。

---

## API 接口说明

### `GET /api/trace?target=<ip|domain>&cache=true|false`

执行 traceroute 路径追踪。参数说明：

* `target`：目标域名或 IP；
* `cache`：是否使用历史缓存（默认 true）。

返回 JSON 流（每跳信息）：

```json
{
    "ip": "106.187.16.93", 
    "latency": 30.998, 
    "jitter": 3.1,
    "packet_loss": "0%", 
    "bandwidth_mbps": 3.13, 
    "location": "None, Japan", 
    "asn": 2516, 
    "isp": "KDDI CORPORATION"
}
```

---

### `GET /api/history?target=<ip|domain>`

查询指定目标的历史记录（或查询全部）。

```json
{
  "www.youtube.com": [
    {
      "result": [
        {
          "asn": "Unknown",
          "bandwidth_mbps": "None",
          "ip": "*",
          "isp": "Unknown",
          "jitter": "None",
          "latency": null,
          "location": "Unknown",
          "packet_loss": "100%"
        },
        {
          "asn": "Unknown",
          "bandwidth_mbps": 1.68,
          "ip": "kix06s11-in-f14.1e100.net",
          "isp": "Unknown",
          "jitter": 5.86,
          "latency": 58.592,
          "location": "Unknown",
          "packet_loss": "0%"
        }
      ],
      "timestamp": "20250505"
    },
    {
      "result": [
        {
          "asn": "Unknown",
          "bandwidth_mbps": "None",
          "ip": "*",
          "isp": "Unknown",
          "jitter": "None",
          "latency": null,
          "location": "Unknown",
          "packet_loss": "100%"
        },
        {
          "asn": "Unknown",
          "bandwidth_mbps": 2.55,
          "ip": "nchkga-ae-in-f14.1e100.net",
          "isp": "Unknown",
          "jitter": 3.82,
          "latency": 38.203,
          "location": "Unknown",
          "packet_loss": "0%"
        }
      ],
      "timestamp": "20250505"
    }
  ]
}
```

---

### `GET /api/analyze?target=<ip|domain>&cache=true|false`

基于目标路由历史与风险数据库进行分析。

返回示例：

```json
{
  "anomalies": [
    { "type": "PathDeviation", "detail": "跳点 4 出现新IP 203.0.113.1" }
  ],
  "alerts": [
    "跳点 203.0.113.1 被列为恶意IP: listed on Spamhaus DROP"
  ],
  "riskScore": 70
}
```

---

### 致谢

感谢 [nexttrace](https://github.com/nexttrace/nexttrace) 提供的开源路由追踪工具，它使得实时路径追踪变得更加便捷。

---
