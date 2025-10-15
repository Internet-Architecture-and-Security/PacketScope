

# Tracer

A Flask-based network path analysis service that integrates real-time `traceroute` tracking, geographic and ASN lookup, historical caching, anomaly detection, and Spamhaus-based malicious IP risk assessment.

---

## Features Overview

* Real-time `traceroute` with per-hop streaming updates.
* City and ASN information powered by MaxMind GeoLite2.
* Historical record comparison and deviation/latency anomaly detection.
* Blacklist IP detection (Spamhaus DROP/EDROP) with risk scoring.
* Automatic threat intelligence updates maintaining a `risky_ips.json` file.

---

## Project Structure

```
├── backend.py                  # Main Flask backend application
├── update_threat_intel.py      # Script to update malicious IPs   (from Spamhaus)
├── risky_ips.json              # Auto-generated JSON file of risky IP ranges
├── GeoLite2-City.mmdb          # City-level geolocation database
├── GeoLite2-ASN.mmdb           # ASN database
├── history/                    # Cached traceroute results
├── Dockerfile                  # Dockerfile for building the container
├── docker-compose.yml          # Docker Compose configuration
```

---

## Quick Start Guide

### 1. Start with Docker or Docker Compose

#### 1.1 Start using Docker Compose (Recommended)

Run the following command to build and start all services automatically:

```bash
docker-compose up --build
```

This will build and start the Flask backend and all dependencies.

#### 1.2 Start manually with Docker

If you prefer to run without Docker Compose, you can start the container manually:

```bash
# Build the image
docker build -t packetscope-tracer .

# Run the container
docker run --rm -v $(pwd)/history:/app/history -p 8000:8000 packetscope-tracer
```

By default, the service listens on port `8000`.

---

### 2. Manual Setup (Without Docker)

If you prefer to run it locally without Docker:

```bash
# Create a virtual environment
python3 -m venv .venv

# Activate the virtual environment
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

---

### 3. Download MaxMind GeoIP Databases

Register for a free MaxMind account and download the following two databases:

* [GeoLite2-City.mmdb](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data)
* [GeoLite2-ASN.mmdb](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data)

Place both files in the project root directory.

---

### 4. Install `nexttrace`

To perform traceroute operations, install [`nexttrace`](https://github.com/nexttrace/nexttrace).
On Linux, simply run:

```bash
curl -sL nxtrace.org/nt | sudo bash
```

---

### 5. Update Malicious IP Data

#### Data Source

The script `update_threat_intel.py` automatically fetches data from:

* Spamhaus [DROP list](https://www.spamhaus.org/drop/)
* Spamhaus [EDROP list](https://www.spamhaus.org/drop/edrop/)

#### File Format

The generated `risky_ips.json` will look like this:

```json
{
  "192.0.2.0/24": "Spamhaus DROP listed",
  "203.0.113.0/25": "Known malware distributor"
}
```

During analysis, each hop’s IP will be checked against these CIDR ranges.

Run the script to update:

```bash
python update_threat_intel.py
```

This will generate or refresh `risky_ips.json` for blacklist risk analysis.

---

## API Reference

### `GET /api/trace?target=<ip|domain>&cache=true|false`

Performs a traceroute for the given target.

**Parameters:**

* `target`: Target domain or IP.
* `cache`: Whether to use cached results (default: `true`).

**Sample response (per-hop):**

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

Fetch historical traceroute results for a given target (or all if unspecified).

**Sample response:**

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
    }
  ]
}
```

---

### `GET /api/analyze?target=<ip|domain>&cache=true|false`

Performs route anomaly detection and risk scoring using the historical database and blacklist data.

**Sample response:**

```json
{
  "anomalies": [
    { "type": "PathDeviation", "detail": "Hop 4 shows a new IP 203.0.113.1" }
  ],
  "alerts": [
    "Hop 203.0.113.1 is listed as malicious: listed on Spamhaus DROP"
  ],
  "riskScore": 70
}
```

---

## Acknowledgments

Special thanks to [nexttrace](https://github.com/nexttrace/nexttrace) for providing the powerful open-source traceroute engine that enables efficient real-time path tracking.

---
