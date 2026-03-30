# PacketScope Guarder API Skill

This skill enables LLM to interact with the PacketScope Guarder module API for network connection tracking, filtering, and AI-powered analysis.

## Overview

Guarder is a network security module that provides:
- Real-time TCP/UDP connection monitoring via eBPF/XDP
- ICMP traffic tracking
- AI-powered filter rule generation and analysis
- Dynamic packet filtering with custom rules

## API Endpoints

### Base URL
```
http://<host>:8080
```

### Connection Monitoring

#### Get Connections
- **Endpoint**: `GET /api/connections`
- **Description**: Get all active TCP/UDP connections
- **Response**: Array of connection entries
```json
[
  {
    "key": "192.168.1.1:12345 -> 10.0.0.1:80 (TCP)",
    "info": "Packets: 10, Bytes: 1024, IP ID: 1234, Last Seen: 2024-01-01T12:00:00Z, First Seen: 2024-01-01T11:59:00Z, TCP Flags: 24, Seq: 12345, Ack: 67890, Window: 65535"
  }
]
```

#### Get ICMP Entries
- **Endpoint**: `GET /api/icmp`
- **Description**: Get all ICMP traffic entries
- **Response**: Array of ICMP entries
```json
[
  {
    "key": "192.168.1.1 -> 10.0.0.1 (Type: 8, Code: 0)",
    "info": "Packets: 5, Bytes: 420, IP ID: 5678, Last Seen: 2024-01-01T12:00:00Z, Inner Packet: {...}"
  }
]
```

#### Get Statistics
- **Endpoint**: `GET /api/stats`
- **Description**: Get performance statistics
- **Response**: Performance stats object
```json
{
  "ICMPTypeCounts": [0, 0, 0, 0, 0, 0, 0, 0, 10, 10, 0, 0, 0, 0, 0, 0],
  "ICMPCodeCounts": [...],
  "TCPRetrans": 0,
  "TCPDuplicateAck": 0,
  "TCPOutOfOrder": 0,
  "TCPZeroWindow": 0,
  "TCPSmallWindow": 0,
  "TotalPackets": 1000,
  "TotalBytes": 500000,
  "DroppedPackets": 10,
  "MalformedPackets": 0
}
```

### Filter Rules Management

#### List Filter Rules
- **Endpoint**: `GET /api/filters`
- **Description**: Get all filter rules
- **Response**: Array of filter rules
```json
[
  {
    "id": 0,
    "src_ip": "any",
    "dst_ip": "10.0.0.1",
    "src_port": 0,
    "dst_port": 80,
    "protocol": "tcp",
    "action": "drop",
    "enabled": true,
    "rule_type": "tcp",
    "comment": "Block HTTP traffic",
    "icmp_type": null,
    "icmp_code": null,
    "tcp_flags": null,
    "tcp_flags_mask": null
  }
]
```

#### Create Filter Rule
- **Endpoint**: `POST /api/filters`
- **Description**: Add a new filter rule
- **Request Body**: FilterRule object
```json
{
  "src_ip": "192.168.1.0/24 or any",
  "dst_ip": "any",
  "src_port": 0,
  "dst_port": 443,
  "protocol": "tcp",
  "action": "drop",
  "enabled": true,
  "rule_type": "tcp",
  "comment": "Block HTTPS traffic from subnet"
}
```

#### Get Filter Rule
- **Endpoint**: `GET /api/filters/{id}`
- **Description**: Get a specific filter rule

#### Update Filter Rule
- **Endpoint**: `PUT /api/filters/{id}`
- **Description**: Update an existing filter rule

#### Delete Filter Rule
- **Endpoint**: `DELETE /api/filters/{id}`
- **Description**: Delete a filter rule

#### Enable Filter Rule
- **Endpoint**: `POST /api/filters/{id}/enable`
- **Description**: Enable a filter rule

#### Disable Filter Rule
- **Endpoint**: `POST /api/filters/{id}/disable`
- **Description**: Disable a filter rule

### AI Configuration

#### Get AI Status
- **Endpoint**: `GET /api/ai/status`
- **Description**: Check AI configuration status
- **Response**:
```json
{
  "is_configured": true,
  "has_api_key": true,
  "has_endpoint": true,
  "has_model": true
}
```

#### Get AI Config
- **Endpoint**: `GET /api/ai/config`
- **Description**: Get current AI configuration
- **Response**:
```json
{
  "openai_endpoint": "https://api.openai.com/v1/chat/completions",
  "model": "gpt-3.5-turbo",
  "temperature": 0.7,
  "debug": false,
  "timeout": 120
}
```

#### Update AI Config
- **Endpoint**: `POST /api/ai/config`
- **Description**: Update AI configuration
- **Request Body**:
```json
{
  "openai_endpoint": "https://api.openai.com/v1/chat/completions",
  "api_key": "your-api-key",
  "model": "gpt-4",
  "temperature": 0.5,
  "debug": true,
  "timeout": 120
}
```

### AI Analysis & Generation

#### Generate Filters with AI
- **Endpoint**: `POST /api/ai/generate`
- **Description**: Analyze network traffic and generate filter rules using AI
- **Request Body**:
```json
{
  "custom_prompt": "Focus on blocking suspicious scanning behavior",
  "analyze_type": "security",
  "include_icmp": true,
  "include_tcp": true,
  "include_stats": true
}
```
- **Response**:
```json
{
  "success": true,
  "filters": [...],
  "analysis": "Detected potential port scanning from 192.168.1.100",
  "suggestions": ["Block the source IP", "Monitor for further activity"],
  "tokens_used": 500
}
```

#### Analyze Connections with AI
- **Endpoint**: `POST /api/ai/analyze`
- **Description**: Get AI analysis of current network connections
- **Request Body**:
```json
{
  "custom_prompt": "Analyze for DDoS patterns",
  "include_icmp": true,
  "include_tcp": true,
  "include_stats": true
}
```
- **Response**:
```json
{
  "success": true,
  "summary": "Network analysis summary..."
}
```

### PCAP Analysis

#### Analyze PCAP File
- **Endpoint**: `POST /api/pcap/analyze`
- **Description**: Upload and analyze a PCAP file using AI
- **Request Body**: multipart/form-data
  - `file`: PCAP file to analyze
  - `custom_prompt`: Optional custom analysis prompt
  - `analyze_type`: "security", "performance", or "custom"
- **Response**:
```json
{
  "success": true,
  "analysis": "Detailed analysis of PCAP content...",
  "threats": [...],
  "statistics": {...},
  "suggestions": [...]
}
```

## Usage Examples

### Python Client Example

```python
import requests

class GuarderClient:
    def __init__(self, base_url="http://localhost:8080"):
        self.base_url = base_url
    
    def get_connections(self):
        """Get all TCP/UDP connections"""
        resp = requests.get(f"{self.base_url}/api/connections")
        return resp.json()
    
    def get_stats(self):
        """Get performance statistics"""
        resp = requests.get(f"{self.base_url}/api/stats")
        return resp.json()
    
    def create_filter(self, rule):
        """Create a new filter rule"""
        resp = requests.post(f"{self.base_url}/api/filters", json=rule)
        return resp.json()
    
    def ai_analyze(self, prompt="", analyze_type="security"):
        """Analyze connections with AI"""
        data = {
            "custom_prompt": prompt,
            "analyze_type": analyze_type,
            "include_icmp": True,
            "include_tcp": True,
            "include_stats": True
        }
        resp = requests.post(f"{self.base_url}/api/ai/analyze", json=data)
        return resp.json()
```

## Filter Rule Types

### Basic Rules
- Match on IP addresses and ports
- Protocol: tcp, udp, icmp, any
- Action: allow, drop

### TCP Rules
- TCP-specific matching with flags
- Flags: SYN, ACK, FIN, RST, PSH, URG

### ICMP Rules
- Match on ICMP type and code
- Common types: 0 (Echo Reply), 8 (Echo Request), 3 (Destination Unreachable)

### Rule Priorities
Rules are evaluated in order by ID (0 to 31). First matching rule wins.

## AI Analysis Types

- **security**: Focus on identifying and blocking security threats
- **performance**: Focus on optimizing network performance
- **custom**: Use custom prompt for specialized analysis
