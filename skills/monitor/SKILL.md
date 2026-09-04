---
name: packetscope-monitor
description: Query PacketScope Monitor for recent network packets, kernel function call tracking, and live socket state. Use when investigating network traffic, tracing which kernel functions handled a connection, or inspecting sockets on a host running the Monitor module.
---

# PacketScope Monitor API Skill & MCP Server

This skill enables LLM to interact with the PacketScope Monitor module API for network packet analysis, function call tracking, and socket monitoring.

## Overview

Monitor is a network analysis module that provides:
- Real-time network packet capture and query
- Kernel network function call tracking
- Socket state monitoring
- Function ID mapping lookup

## MCP Server Tools

The Monitor MCP Server provides the following tools for LLM interaction:

### Packet Query Tools

- `get_recent_packets` - Get recent network packets with optional filters
  - Parameters: `src_ip`, `dst_ip`, `src_port`, `dst_port`, `ip_ver`, `count`
  - Returns: List of packets with timestamp, IPs, ports, payload, etc.

- `query_packets` - Query packets matching specific criteria
  - Parameters: `src_ip`, `dst_ip`, `src_port`, `dst_port`, `ip_ver`
  - Returns: List of matching packet entries

### Function Call Tracking Tools

- `get_recent_map` - Get recent function call mappings
  - Parameters: `src_ip`, `dst_ip`, `src_port`, `dst_port`, `count`, `time_down_limit`
  - Returns: List of function call entries

- `get_func_table` - Get function ID to name mapping
  - Parameters: None
  - Returns: Dictionary mapping function IDs to names

- `get_function_name` - Get function name from function ID
  - Parameters: `func_id`
  - Returns: Function name or None if not found

- `query_func_send` - Query function calls related to send operations
  - Parameters: `src_ip`, `dst_ip`, `src_port`, `dst_port`
  - Returns: List of send-related function call entries

- `query_func_recv` - Query function calls related to receive operations
  - Parameters: `src_ip`, `dst_ip`, `src_port`, `dst_port`
  - Returns: List of receive-related function call entries

### Socket Monitoring Tools

- `get_socket_list` - Get current network socket list
  - Parameters: None
  - Returns: Dictionary with socket types as keys and lists of socket entries

- `get_established_tcp_sockets` - Get all established TCP IPv4 sockets
  - Parameters: None
  - Returns: List of established TCP sockets

### Status Check Tools

- `is_attach_finished` - Check if eBPF probes are attached
  - Parameters: None
  - Returns: True if probes are attached

- `health_check` - Check server health and readiness
  - Parameters: None
  - Returns: Health status information

- `server_capabilities` - Get server capabilities and tool usage examples
  - Parameters: None
  - Returns: Server capabilities and tool documentation

## API Endpoints

### Base URL

```
http://localhost:8010
```

### Packet Queries

#### Get Recent Packets

- **Endpoint**: `POST /GetRecentPacket`
- **Description**: Get recent network packets with optional filters
- **Request Body**: form-data
  - `srcip`: Source IP address 
  - `dstip`: Destination IP address 
  - `srcport`: Source port 
  - `dstport`: Destination port 
  - `ipver`: IP version ("4" or "6", optional)
  - `count`: Number of packets to return 

**Response**:

```json
[
  {
    "time": 1621545600.123,
    "isRet": 0,
    "ID": 200000,
    "PID": 12345,
    "family": 4,
    "srcport": 12345,
    "dstport": 80,
    "srcip": "192.168.1.100",
    "dstip": "10.0.0.1",
    "pkt": "hexadecimal_payload"
  }
]
```

#### Query Packets

- **Endpoint**: `POST /QueryPacket`
- **Description**: Query packets matching specific criteria
- **Request Body**: form-data
  - `srcip`: Source IP address 
  - `dstip`: Destination IP address 
  - `srcport`: Source port 
  - `dstport`: Destination port 
  - `ipver`: IP version ("4" or "6", optional)

**Response**:

```json
[
  {
    "id": 1,
    "direction": 1,
    "timestamp": 1621545600123456789,
    "netifidx": 2,
    "payloadlen": 1500,
    "payload": "hexadecimal_payload"
  }
]
```

### Function Call Tracking

#### Get Recent Function Map

- **Endpoint**: `POST /GetRecentMap`
- **Description**: Get recent function call mappings
- **Request Body**: form-data
  - `srcip`: Source IP address 
  - `dstip`: Destination IP address 
  - `srcport`: Source port 
  - `dstport`: Destination port 
  - `count`: Number of entries to return 
  - `timeDownLimit`: Minimum timestamp 

**Response**:

```json
[
  [
    [
      {
        "time": 1621545600.123,
        "isRet": 0,
        "ID": 300000,
        "PID": 12345
      }
    ]
  ]
]
```

#### Get Function Table

- **Endpoint**: `GET /GetFuncTable`
- **Description**: Get function ID to name mapping
- **Response**:

```json
{
  "100001": "function_name_1",
  "100002": "function_name_2"
}
```

#### Query Send Functions

- **Endpoint**: `POST /QueryFuncSend`
- **Description**: Query function calls related to send operations
- **Request Body**: form-data
  - `srcip`: Source IP address 
  - `dstip`: Destination IP address 
  - `srcport`: Source port 
  - `dstport`: Destination port 

**Response**:

```json
[
  [
    {
      "time": 1621545600.123,
      "isRet": 0,
      "ID": 200002,
      "PID": 12345
    }
  ]
]
```

#### Query Receive Functions

- **Endpoint**: `POST /QueryFuncRecv`
- **Description**: Query function calls related to receive operations
- **Request Body**: form-data
  - `srcip`: Source IP address 
  - `dstip`: Destination IP address 
  - `srcport`: Source port 
  - `dstport`: Destination port 

**Response**:

```json
[
  [
    {
      "time": 1621545600.123,
      "isRet": 0,
      "ID": 200000,
      "PID": 12345
    }
  ]
]
```

### Socket Monitoring

#### Get Socket List

- **Endpoint**: `GET /QuerySockList`
- **Description**: Get current network socket list
- **Response**:

```json
{
  "tcpipv4": [
    [
      1621545600.123,
      "1",
      "192.168.1.100:80",
      "10.0.0.1:443",
      "01(ESTABLISHED)"
    ]
  ],
  "tcpipv6": [],
  "udpipv4": [],
  "udpipv6": [],
  "icmpipv4": [],
  "icmpipv6": [],
  "rawipv4": [],
  "rawipv6": [],
  "dev": []
}
```

### Status Check

#### Check Attach Status

- **Endpoint**: `GET /IsAttachFinished`
- **Description**: Check if eBPF probes are attached
- **Response**:

```json
[true]
```

## Usage Examples

### Python Client Example

```python
import requests

class MonitorClient:
    def __init__(self, base_url="http://localhost:8010"):
        self.base_url = base_url
    
    def get_recent_packets(self, src_ip="", dst_ip="", src_port="", dst_port="", ip_ver="", count=""):
        """Get recent network packets"""
        data = {}
        if src_ip: data["srcip"] = src_ip
        if dst_ip: data["dstip"] = dst_ip
        if src_port: data["srcport"] = src_port
        if dst_port: data["dstport"] = dst_port
        if ip_ver: data["ipver"] = ip_ver
        if count: data["count"] = count
        
        resp = requests.post(f"{self.base_url}/GetRecentPacket", data=data)
        return resp.json()
    
    def get_socket_list(self):
        """Get current socket list"""
        resp = requests.get(f"{self.base_url}/QuerySockList")
        return resp.json()
```

## Function ID Ranges

| ID Range | Description |
|----------|-------------|
| 200000-200001 | Receive-related functions |
| 200002-200007 | Send-related functions |
| 300000+ | Other function calls |

## Socket States

| Code | State |
|------|-------|
| 01 | ESTABLISHED |
| 02 | SYN_SENT |
| 03 | SYN_RECV |
| 04 | FIN_WAIT1 |
| 05 | FIN_WAIT2 |
| 06 | TIME_WAIT |
| 07 | CLOSE |
| 08 | CLOSE_WAIT |
| 09 | LAST_ACK |
| 0A | LISTEN |
| 0B | CLOSING |
