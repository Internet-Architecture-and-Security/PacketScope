# PacketScope Analyzer Module

## Overview

The Analyzer module of PacketScope provides unprecedented panoramic visualization of protocol interactions. The Monitor component can capture the complete processing path of packets from the protocol stack entry to application-level handling, producing a cross-layer, cross-protocol interaction panorama. The Calculator component further organizes packet paths through the protocol stack and computes statistics of cross-layer interactions, including: per-layer traffic, cross-layer interaction frequency, cross-layer latency, and packet loss rate.

## Features

### Monitor component
- Real-time monitoring of local sockets and network interface status
- Capture traffic packets passing through any network interface
- Capture the kernel function path and timings for packets
- Organize kernel paths into call graphs for visualization

### Calculator component
- Real-time monitoring of key protocol stack paths: observe packets flowing through link, network, and transport layers
- Real-time computation of cross-layer interaction metrics: per-layer traffic, cross-layer interaction frequency, cross-layer latency, packet loss rate
- Historical trend analysis: view metric changes over time via charts
- API interface: a single API can compute all cross-layer interaction metrics

---

## Module Structure

```
Analyzer/
├──Calculator/
│   ├── Dokcerfile  # Dockerfile for building the container
│   ├── NumLatencyFrequency # Real-time calculation of cross-layer interaction metrics
│   └── monitor.py  # Interface to start the calculator
├── Monitor/       # User space application
│   ├── Dokcerfile  # Dockerfile for building the container
│   ├── AttachAndRunProbers.py # Attach function flow graph interface
│   ├── flaskServerMain.py # Organize server and provide APIs
│   ├── GetRecentMaps.py # Query recent function flow maps
│   ├── Inspector.py # Functional tests; can observe current kernel function calls
│   ├── ListSockets.py # Query current socket status
│   ├── PSUtil.py # Utility helper library
│   ├── QueryAndGetFuncMapRecv.py # Query recent function flow maps (receive side)
│   ├── QueryAndGetFuncMapSend.py # Query recent function flow maps (send side)
│   ├── ReadBTFandGetItsMember.py # Read and preprocess BTF information
│   ├── tcxProber.c # eBPF C file for attaching to TC
│   ├── TcxProber.py # Attach eBPF on TC
│   ├── TcxQuery.py # Query packets passing through a socket
│   ├── TestFilterAndGet.py # Functional tests
│   ├── TestPacket.py # Functional tests
│   ├── TestRecentMap.py # Functional tests
│   └── translateJSON.py # Translate BTF information into C for attaching
├── README.md                   # Readme
└── README-zh.md                # Documentation (this README)
```

## Installation Guide

### System Requirements

- Linux kernel with eBPF support (version 6.8+)
- Docker (for containerized deployment)
- Root/sudo privileges

### Recommended: Docker-based deployment

Docker provides the most reliable and consistent runtime. Follow these build steps in order to ensure dependencies are resolved correctly:

#### Build instructions

Important: build in sequence to ensure dependencies are resolved.

```bash
# Step 1: Build Monitor module
docker build -t packetscope-analyzer-monitor:v1.0 ./Monitor/

# Step 2: Build Calculator module
docker build -t packetscope-analyzer-calculator:v1.0 ./Calculator/
```

#### Run containers

Both modules require specific runtime configurations:

```bash
# Run Monitor module (port 19999)
docker run --privileged --network host -p 19999:19999 packetscope:tracer

# Run Calculator module (port 5000)
docker run --privileged --network host -p 5000:5000 packetscope:analyzer
```

Configuration notes:
- `--privileged`: required to load eBPF programs and perform kernel tracing
- `--network host`: enables host network access for full traffic visibility
  - Without host network mode, only container-internal traffic will be captured
- Port mappings: Monitor (19999), Calculator (5000)

### Alternative: Manual installation

Manual installation offers more flexibility but requires careful environment configuration.

#### Manual installation steps

1. Install BCC (BPF Compiler Collection)

   Refer to the official installation guide: https://github.com/iovisor/bcc/blob/master/INSTALL.md

   ⚠️ Compatibility warning: manual installation is not recommended for production due to potential kernel compatibility issues. BCC cannot guarantee backward compatibility across all kernel versions.

2. Install Python dependencies

   Enter each module directory and install dependencies:
   ```bash
   # Install Monitor dependencies
   cd Monitor/
   sudo pip install -r requirements.txt

   # Install Calculator dependencies
   cd ../Calculator/
   sudo pip install -r requirements.txt
   ```

3. Start modules

   Both modules must run as root:
   ```bash
   # Terminal 1: start Monitor
   sudo su
   ulimit -n 65535
   python3 Monitor/flaskServerMain.py

   # Terminal 2: start Calculator
   sudo python3 Calculator/monitor.py
   ```

---

## API Reference

### Monitor API

GET  /IsAttachFinished          - Check startup status  
Parameters: GET, none  
Return: [True] or [False]

GET  /GetRecentPacket           - Get recent packet info  
Parameters: srcip, dstip, srcport, dstport, limit  
Note: For IPv6, a non-standard IPv6 format is used, e.g.:
fe80:0000:0000:0000:0250:56ff:fec0:2222  
Return: an array like [[packet_info], [packet_info], ...]  
IPv4 format example: [(time, if_index, direction, length, payload, src_addr, dst_addr, src_port, dst_port, lower_proto, IPID, TTL, fragmentation, optional_fields), ...]  
IPv6 format example: [(time, if_index, direction, length, payload, src_addr, dst_addr, next_header, src_port, dst_port), ...]

GET  /GetRecentMap              - Get recent function flow info  
Parameters: srcip, dstip, srcport, dstport, limit  
Note: IPv6 uses the same non-standard format shown above.  
Return: an array like [[func_call_chain], [func_call_chain], ...]  
Example:
[[[1750773060.8924384, 0, 200007, 7489], [1750773060.89244, 0, 52954, 7489], [1750773060.8924415, 0, 52920, 7489]],
 [[1750773060.8924422, 1, 52920, 7489], [1750773060.8924434, 0, 52949, 7489]]]

GET /UnsetFilter               - Remove filter  
Parameters: GET, none  
Return: none

GET /SetFilter                 - Set filter  
Parameters: POST with fields: srcip, dstip, srcport, dstport, ipver (4/6)  
Note: IPv6 uses the non-standard format shown above.  
Return: none

GET /ClearData                 - Clear data  
Parameters: GET, none  
Return: none

GET /QuerySockList             - Get socket and device info  
Parameters: GET, none  
Return: a dict like:
{"tcpipv4":[],"tcpipv6":[],"udpipv4":[],"udpipv6":[],"icmpipv4":[],"icmpipv6":[],"rawipv4":[],"rawipv6":[],"dev":[]}  
Socket arrays contain lists; each element is [current_time, index, srcIP, dstIP, state]  
"dev" contains lists; each element is [current_time, interface_name]  
Note: provided srcIP and dstIP are in HEX format, e.g., 8002A8C0:AA36; simple conversion is needed to make them human-readable.

### Calculator API

GET  /api/NumLatencyFrequency  - Get current metrics

Function: compute packet movement, packet loss, cross-layer latency and cross-layer interaction frequency for a specified 5-tuple across link, network, and transport layers.  
Request example:
```json
{"type":"NumLatencyFrequency","params":{"ipv4":true,"ipv6":false,"sip":"192.168.126.128","dip":"103.143.17.156","sport":57892,"dport":443,"protocol":"tcp"}}
```
Output example:
```
{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"linknetwork\", \"direction\": \"send\", \"type\": \"ipv4\", \"pid\": 3206, \"pid_name\": \"Socket Thread\", \"saddr\": \"192.168.126.128\", \"daddr\": \"103.143.17.156\", \"sport\": 57892, \"dport\": 443, \"LAT(ms)\": 0.01, \"frequency(s)\": 35.3051937862859}\n"}
{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"linknetwork\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": 3617, \"pid_name\": \"StreamT~ns #162\", \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"LAT(ms)\": 0.099, \"frequency(s)\": 35.30391275226362}\n"}
{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"networktrans\", \"direction\": \"send\", \"type\": \"ipv4\", \"pid\": -1, \"pid_name\": \"NULL\", \"saddr\": \"192.168.126.128\", \"daddr\": \"103.143.17.156\", \"sport\": 57892, \"dport\": 443, \"LAT(ms)\": 0, \"frequency(s)\": 0}"}
{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"networktrans\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": 3617, \"pid_name\": \"StreamT~ns #162\", \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"LAT(ms)\": 0.269, \"frequency(s)\": 35.30557465216654}\n"}
{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"linktrans\", \"direction\": \"send\", \"type\": \"ipv4\", \"pid\": -1, \"pid_name\": \"NULL\", \"saddr\": \"192.168.126.128\", \"daddr\": \"103.143.17.156\", \"sport\": 57892, \"dport\": 443, \"LAT(ms)\": 0, \"frequency(s)\": 0}"}
{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"linktrans\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": 3617, \"pid_name\": \"StreamT~ns #162\", \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"LAT(ms)\": 0.308, \"frequency(s)\": 35.30560927674498}\n"}
{"type": "NumLatencyFrequency", "data": "{\"layer\": \"trans\", \"direction\": \"send\", \"type\": \"ipv4\", \"pid\": 3206, \"saddr\": \"192.168.126.128\", \"daddr\": \"103.143.17.156\", \"sport\": 37630, \"dport\": 443, \"num\": 2, \"pps(s)\": 2.4280114828756396}\n"}
{"type": "NumLatencyFrequency", "data": "{\"layer\": \"trans\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": 3206, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"num\": 35, \"pps(s)\": 35.30557465216654}\n"}
{"type": "NumLatencyFrequency", "data": "{\"layer\": \"network\", \"direction\": \"send\", \"type\": \"ipv4\", \"pid\": 3206, \"saddr\": \"192.168.126.128\", \"daddr\": \"103.143.17.156\", \"sport\": 37630, \"dport\": 443, \"num\": 2, \"pps(s)\": 2.428141185078587}\n"}
{"type": "NumLatencyFrequency", "data": "{\"layer\": \"network\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": 3617, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"num\": 35, \"pps(s)\": 35.303947373582446}\n"}
{"type": "NumLatencyFrequency", "data": "{\"layer\": \"link\", \"direction\": \"send\", \"type\": \"ipv4\", \"pid\": 3206, \"saddr\": \"192.168.126.128\", \"daddr\": \"103.143.17.156\", \"sport\": 37630, \"dport\": 443, \"num\": 2, \"pps(s)\": 2.428158872816276}\n"}
{"type": "NumLatencyFrequency", "data": "{\"layer\": \"link\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": 3617, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"num\": 35, \"pps(s)\": 35.30346268129799}\n"}
{"type": "NumLatencyFrequency", "data": "{\"type\": \"ipv4\", \"pid\": 0, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57244, \"drop(s)\": 1.2019447465999988}\n"}
```

## Troubleshooting

### Common issues

Permission denied errors
- Ensure modules run with root privileges
- Verify eBPF is enabled in kernel configuration
- Verify debugfs and related components are mounted

No packets captured
- Ensure Docker is run with `--network host`
- Check network interface is up and receiving traffic

BCC compatibility issues
- Ensure kernel headers are installed: `sudo apt-get install linux-headers-$(uname -r)`
- Consult BCC compatibility matrix for your kernel version

Missing function list
- Run: `ulimit -n 65535` to increase the maximum number of open file descriptors; this value can be increased further. Generally it should be at least 4x the number of kernel functions of interest.

Module keeps failing
- Restart the affected module. Often BCC-related code was not properly unloaded.

## Acknowledgements

Thanks to BCC for the open-source tooling and SQLite for the open-source database functionality.