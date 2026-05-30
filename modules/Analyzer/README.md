# PacketScope Analyzer Module

[中文文档](README-zh.md) | English

## Overview

The Analyzer module of PacketScope provides unprecedented panoramic visualization of protocol interactions. The **Monitor** component captures the complete processing path of packets from the protocol stack entry to application-level handling, producing a cross-layer, cross-protocol interaction panorama. The **Calculator** component further computes cross-layer interaction statistics, including: per-layer traffic, cross-layer interaction frequency, cross-layer latency, and packet loss rate.

Both components are now implemented in Go + cilium/ebpf, replacing the original Python + BCC implementation.

## Features

### Monitor component
- Real-time monitoring of local sockets and network interface status
- Capture traffic packets passing through any network interface (ingress/egress)
- Capture the kernel function path and timings for packets
- Organize kernel paths into call graphs for visualization
- Store all data in PostgreSQL for querying via RESTful API

### Calculator component
- Real-time monitoring of key protocol stack paths: observe packets flowing through link, network, and transport layers
- Real-time computation of cross-layer interaction metrics: per-layer traffic, cross-layer interaction frequency, cross-layer latency, packet loss rate
- Historical trend analysis: view metric changes over time via charts
- WebSocket interface: real-time metrics pushed every second

---

## Module Structure

```
Analyzer/
├── Calculator/                # Cross-layer metrics calculator (Go)
│   ├── cmd/metrics/main.go    # Program entry point
│   ├── pkg/bpf_engine/        # eBPF engine (cilium/ebpf)
│   │   ├── metrics.c          # eBPF C source
│   │   └── engine.go          # Engine: load, attach, filter
│   ├── pkg/aggregation/       # Aggregation & message builder
│   ├── pkg/server/            # WebSocket server
│   ├── Makefile               # Build file
│   ├── build.sh               # Build script
│   └── README.md              # Detailed docs
├── Monitor/                   # Packet capture & function call monitor (Go)
│   ├── main.go                # Program entry point
│   ├── kbatch/                # Kernel function call monitoring (eBPF)
│   ├── tcxprober/             # Network packet capture (eBPF TC)
│   ├── server/                # RESTful API query service
│   ├── base/                  # Base utilities (BTF parsing, JSON)
│   ├── doc/                   # Detailed documentation
│   │   ├── install.md         # Installation guide
│   │   ├── database.md        # Database configuration
│   │   ├── server-api.md      # API reference
│   │   ├── kbatch.md          # kbatch module docs
│   │   └── tcxprober.md       # tcxprober module docs
│   ├── Makefile               # Build file
│   ├── Dockerfile             # Docker build
│   └── readme.md              # Detailed docs
├── README.md                  # This file (English)
└── README-zh.md               # This file (Chinese)
```

---

## Installation Guide

### System Requirements

- Linux kernel with eBPF support (version 6.8+)
- Go >= 1.24
- clang / llvm (for eBPF C compilation)
- PostgreSQL (for Monitor data storage)
- Root/sudo privileges

### Recommended: Docker-based deployment

```bash
# Step 1: Build Monitor module
docker build -t packetscope-analyzer-monitor:v1.0 ./Monitor/

# Step 2: Build Calculator module
docker build -t packetscope-analyzer-calculator:v1.0 ./Calculator/
```

#### Run containers

```bash
# Run Monitor module
docker run --privileged --network host packetscope-analyzer-monitor:v1.0

# Run Calculator module
docker run --privileged --network host packetscope-analyzer-calculator:v1.0
```

Configuration notes:
- `--privileged`: required to load eBPF programs and perform kernel tracing
- `--network host`: enables host network access for full traffic visibility
  - Without host network mode, only container-internal traffic will be captured

### Alternative: Manual installation

#### Monitor module

> Full installation steps: [Monitor/doc/install.md](Monitor/doc/install.md)

```bash
cd Monitor/

# 1. Install system dependencies
sudo apt-get update && sudo apt-get install -y \
    curl wget git make cmake build-essential golang-go \
    gcc g++ clang llvm libbpf-dev linux-headers-generic \
    linux-tools-generic linux-tools-common bpfcc-tools \
    libbpf-tools iproute2 net-tools tcpdump \
    libelf-dev zlib1g-dev pkg-config postgresql-client

# 2. Install bpf2go
go install github.com/cilium/ebpf/cmd/bpf2go@latest

# 3. Configure PostgreSQL
sudo service postgresql start
psql -h localhost -U postgres -c "ALTER USER postgres WITH PASSWORD 'password';"
createdb -h localhost -U postgres tcxprober
createdb -h localhost -U postgres functioninfo

# 4. Configure environment variables
export CGO_ENABLED=1
export PG_HOST=localhost PG_PORT=5432 PG_USER=postgres PG_PASSWORD=password
export PG_DBNAME_PACKET=tcxprober PG_DBNAME_FUNCTION=functioninfo PG_SSLMODE=disable

# 5. Build
make prepare && make && make server

# 6. Run
sudo ./analyzer    # Data collection (kbatch + tcxprober)
./qserver          # API query service (port 8010)
```

#### Calculator module

```bash
cd Calculator/

# 1. Build
make

# 2. Run
sudo ./metrics               # WebSocket server (port 8020)
sudo METRICS_PORT=9090 ./metrics  # Custom port
```

---

## API Reference

### Monitor API

The Monitor API server listens on `http://localhost:8010`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/GetRecentPacket` | Get recent packets |
| POST | `/GetRecentMap` | Get recent function call maps |
| GET | `/GetFuncTable` | Get function ID mapping table |
| POST | `/QueryFuncSend` | Query send-side function calls |
| POST | `/QueryFuncRecv` | Query receive-side function calls |
| POST | `/QueryPacket` | Query packets by 5-tuple |
| GET | `/QuerySockList` | Get socket and device list |

> Full API documentation: [Monitor/doc/server-api.md](Monitor/doc/server-api.md)

### Calculator API

The Calculator module exposes a WebSocket server at `ws://<host>:8020/` (or `/ws`).

**Endpoint:** `NumLatencyFrequency`

Request example:
```json
{"type":"NumLatencyFrequency","params":{"ipv4":true,"ipv6":false,"sip":"192.168.126.128","dip":"103.143.17.156","sport":57892,"dport":443,"protocol":"tcp"}}
```

The server returns an acknowledgment first:
```json
{"type":"NumLatencyFrequency","status":"started"}
```

Then pushes metrics every second:
```json
{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"linknetwork\", \"direction\": \"send\", \"type\": \"ipv4\", \"pid\": 3206, \"pid_name\": \"Socket Thread\", \"saddr\": \"192.168.126.128\", \"daddr\": \"103.143.17.156\", \"sport\": 57892, \"dport\": 443, \"LAT(ms)\": 0.01, \"frequency(s)\": 35}"}
{"type": "NumLatencyFrequency", "data": "{\"layer\": \"trans\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": 3206, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"num\": 35, \"pps(s)\": 35}"}
{"type": "NumLatencyFrequency", "data": "{\"type\": \"ipv4\", \"pid\": 0, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57244, \"drop(s)\": 1}"}
```

> Full API documentation: [Calculator/README.md](Calculator/README.md)

---

## Technology Stack

| Feature | Monitor | Calculator |
|---------|---------|------------|
| Language | Go | Go |
| eBPF loading | cilium/ebpf (bpf2go) | cilium/ebpf (bpf2go) |
| eBPF attach | fentry/kprobe + TC | fentry/kprobe + tracepoint |
| Communication | HTTP REST (port 8010) | WebSocket (port 8020) |
| Data storage | PostgreSQL | In-kernel BPF map aggregation |
| eBPF compilation | CO-RE (bpf2go) | CO-RE (bpf2go) |
| Kernel dependency | None (no BCC) | None (no BCC) |

---

## Environment Variables

### Monitor

| Variable | Default | Description |
|----------|---------|-------------|
| PG_HOST | localhost | PostgreSQL host |
| PG_PORT | 5432 | PostgreSQL port |
| PG_USER | postgres | PostgreSQL user |
| PG_PASSWORD | password | PostgreSQL password |
| PG_DBNAME_PACKET | tcxprober | Packet database name |
| PG_DBNAME_FUNCTION | functioninfo | Function info database name |
| PG_SSLMODE | disable | SSL connection mode |

### Calculator

| Variable | Default | Description |
|----------|---------|-------------|
| METRICS_PORT | 8020 | WebSocket server port |

---

## Troubleshooting

### Common issues

**Permission denied errors**
- Ensure modules run with root privileges (`sudo`)
- Verify eBPF is enabled in kernel configuration

**No packets captured**
- If using Docker, ensure `--network host` is set
- Check network interface is up and receiving traffic

**eBPF program loading fails**
- Ensure kernel version supports eBPF (6.8+ recommended)
- Install matching kernel headers: `sudo apt-get install linux-headers-$(uname -r)`

**Database connection fails (Monitor)**
- Ensure PostgreSQL service is running: `sudo systemctl status postgresql`
- Verify connection parameters match the environment variables
- Ensure the database user has correct permissions

**Missing function list**
- Run: `ulimit -n 65535` to increase the maximum number of open file descriptors

## Acknowledgements

Thanks to cilium/ebpf for the Go eBPF library, PostgreSQL for the database engine, and the original BCC project for inspiration.
