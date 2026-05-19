# PacketScope Monitor API Skill

This skill enables LLM to interact with the PacketScope Monitor module API for network packet analysis, function call tracking, and socket monitoring.

## Overview

Monitor is a network analysis module that provides:
- Real-time network packet capture and query
- Kernel network function call tracking
- Socket state monitoring
- Function ID mapping lookup

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
  - `srcip`: Source IP address (optional)
  - `dstip`: Destination IP address (optional)
  - `srcport`: Source port (optional)
  - `dstport`: Destination port (optional)
  - `ipver`: IP version ("4" or "6", optional)
  - `count`: Number of packets to return (optional)

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
  - `srcip`: Source IP address (optional)
  - `dstip`: Destination IP address (optional)
  - `srcport`: Source port (optional)
  - `dstport`: Destination port (optional)
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
  - `srcip`: Source IP address (optional)
  - `dstip`: Destination IP address (optional)
  - `srcport`: Source port (optional)
  - `dstport`: Destination port (optional)
  - `count`: Number of entries to return (optional)
  - `timeDownLimit`: Minimum timestamp (optional)

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
  - `srcip`: Source IP address (optional)
  - `dstip`: Destination IP address (optional)
  - `srcport`: Source port (optional)
  - `dstport`: Destination port (optional)

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
  - `srcip`: Source IP address (optional)
  - `dstip`: Destination IP address (optional)
  - `srcport`: Source port (optional)
  - `dstport`: Destination port (optional)

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
