# Packet Scope

A high-performance network connection tracking tool based on eBPF/XDP technology that monitors TCP/UDP connections and ICMP traffic, with intelligent AI-powered filter generation capabilities.

## 🚀 Features

- **High Performance**: Zero-copy data processing with eBPF/XDP technology
- **Comprehensive Monitoring**: TCP/UDP connection tracking and ICMP traffic analysis
- **Intelligent Filtering**: AI-powered filter rule generation and management
- **Real-time Statistics**: Detailed network performance statistics and analysis
- **HTTP API**: Complete RESTful API interface
- **Precise Matching**: Multi-dimensional filtering based on IP, port, protocol, and more

## 🏗️ Architecture

```
┌─────────────────────┐      ┌─────────────────────────────────┐
│                     │      │                                 │
│    Network Packets  │──────▶  eBPF/XDP Program              │
│                     │      │  (conn_tracker.c)              │
└─────────────────────┘      └───────────────┬─────────────────┘
                                             │
                                             │ BPF Maps
                                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                         User Space Program                      │
│                                                                 │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐    │
│  │   BPF Loader  │    │  Map Reader   │    │  API Server   │    │
│  │  (main.go)    │    │  (main.go)    │    │  (api.go)     │    │
│  └───────────────┘    └───────────────┘    └───────────────┘    │
│                                                    │            │
│                       ┌─────────────────────────────────────┐   │
│                       │         AI Analysis Module          │   │
│                       │       (ai_filter.go)               │   │
│                       └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
                                           ┌───────────────────────┐
                                           │   HTTP Clients/AI     │
                                           └───────────────────────┘
```

## 📁 Project Structure

```
conn-tracker/
├── bpf/                    # eBPF kernel programs
│   └── conn_tracker.c      # Main XDP program
├── cmd/conn-tracker/       # User space application
│   ├── main.go            # Main program entry
│   ├── api.go             # HTTP API server
│   ├── ai_filter.go       # AI filter generation
│   ├── filter.go          # Filter management
│   └── common.go          # Common utilities
├── pkg/                   # Go packages
└── docs/                  # Documentation (this README)
```

## 🔧 Installation

### Prerequisites
- Linux kernel 5.4+ (with eBPF/XDP support)
- Go 1.19+
- libbpf development libraries
- clang compiler
- OpenAI API key (optional, for AI functionality)

### Build

#### For Chinese Users (中国用户配置)
If you encounter Go module download timeouts, configure Go proxy before building:

```bash
# Set Go proxy to Alibaba Cloud mirror
export GOPROXY=https://mirrors.aliyun.com/goproxy/,direct
export GOSUMDB=sum.golang.google.cn

# Alternative proxies (choose one):
# export GOPROXY=https://goproxy.cn,direct
# export GOPROXY=https://mirrors.cloud.tencent.com/go/,direct
```

#### Build Steps
```bash
# Clone the repository
git clone <repository-url>
cd conn-tracker

# (Optional) Configure Go proxy for faster downloads
export GOPROXY=https://mirrors.aliyun.com/goproxy/,direct
export GOSUMDB=sum.golang.google.cn

# Build the project
make

# Run the application
sudo ./conn-tracker -iface eth0 -interval 5 -api :8080
```

### Docker Build with Custom Go Proxy

For faster builds in China or other regions, you can specify Go proxy at build time:

```bash
# Build with Alibaba Cloud Go proxy
docker build --build-arg GOPROXY=https://mirrors.aliyun.com/goproxy/,direct \
             --build-arg GOSUMDB=sum.golang.google.cn \
             -t guarder .

# Build with goproxy.cn
docker build --build-arg GOPROXY=https://goproxy.cn,direct \
             --build-arg GOSUMDB=sum.golang.google.cn \
             -t guarder .

# Build with Tencent Cloud proxy
docker build --build-arg GOPROXY=https://mirrors.cloud.tencent.com/go/,direct \
             --build-arg GOSUMDB=sum.golang.google.cn \
             -t guarder .

# Default build (uses official Go proxy)
docker build -t guarder .
```

### Command Line Options
- `-iface`: Network interface to monitor (required)
- `-interval`: Console output interval in seconds (default: 10)
- `-api`: API server listen address (default: :8080)

## 🐳 Docker Deployment

### Quick Start with Docker

```bash
# Run with host network (required for eBPF)
sudo docker run --privileged --network host guarder

# Run with custom interface
sudo docker run --privileged --network host guarder ./conn-tracker -iface ens33 -interval 10

# Run in background
sudo docker run -d --privileged --network host --name guarder-monitor guarder
```

### Publishing Docker Images

#### 1. Tag Your Image
```bash
# Tag for Docker Hub
sudo docker tag guarder your-username/guarder:latest
sudo docker tag guarder your-username/guarder:v1.0.0

# Tag for GitHub Container Registry
sudo docker tag guarder ghcr.io/your-username/guarder:latest
sudo docker tag guarder ghcr.io/your-username/guarder:v1.0.0

# Tag for Alibaba Cloud Container Registry (China)
sudo docker tag guarder registry.cn-hangzhou.aliyuncs.com/your-namespace/guarder:latest
```

#### 2. Push to Registries

**Docker Hub:**
```bash
# Login to Docker Hub
sudo docker login

# Push images
sudo docker push your-username/guarder:latest
sudo docker push your-username/guarder:v1.0.0
```

**GitHub Container Registry:**
```bash
# Login with GitHub token
echo $GITHUB_TOKEN | sudo docker login ghcr.io -u your-username --password-stdin

# Push images
sudo docker push ghcr.io/your-username/guarder:latest
sudo docker push ghcr.io/your-username/guarder:v1.0.0
```

**Alibaba Cloud Registry (China):**
```bash
# Login to Alibaba Cloud
sudo docker login --username=your-aliyun-username registry.cn-hangzhou.aliyuncs.com

# Push images
sudo docker push registry.cn-hangzhou.aliyuncs.com/your-namespace/guarder:latest
```

#### 3. Multi-Architecture Builds (Optional)

For supporting multiple architectures (amd64, arm64):

```bash
# Create and use buildx builder
sudo docker buildx create --name multiarch-builder --use

# Build and push multi-arch images
sudo docker buildx build --platform linux/amd64,linux/arm64 \
  --build-arg GOPROXY=https://goproxy.cn,direct \
  -t your-username/guarder:latest \
  --push .
```

## 📊 Connection Tracking

### Real-time Monitoring
The system provides comprehensive network connection tracking with detailed information:

- **TCP/UDP Connections**: Source/destination IPs, ports, packet counts, byte counts
- **Connection States**: TCP flags, sequence numbers, acknowledgment numbers
- **Timing Information**: First seen, last seen timestamps
- **Performance Metrics**: Retransmissions, window sizes, packet loss

### API Endpoints

#### Get Connections
```bash
curl http://localhost:8080/api/connections
```

**Response Example:**
```json
[
  {
    "key": "192.168.1.100:12345 -> 8.8.8.8:53 (UDP)",
    "info": "Packets: 1, Bytes: 64, IP ID: 1234, Last Seen: 2023-05-01T12:34:56Z"
  },
  {
    "key": "192.168.1.100:56789 -> 93.184.216.34:443 (TCP)",
    "info": "Packets: 42, Bytes: 8192, TCP Flags: 24, Seq: 1234567890, Ack: 987654321"
  }
]
```

#### Get ICMP Traffic
```bash
curl http://localhost:8080/api/icmp
```

#### Get Performance Statistics
```bash
curl http://localhost:8080/api/stats
```

## 🛡️ Filter Management

### Overview
The filter system provides kernel-space packet filtering with support for fine-grained filtering across different protocols:

- **Basic Filtering**: IP addresses, ports, protocols
- **ICMP Filtering**: ICMP types, codes, and error message inspection
- **TCP Filtering**: TCP flag-based filtering
- **UDP Filtering**: Port-based filtering

### Filter API

#### Get All Filters
```bash
curl http://localhost:8080/api/filters
```

##### Built-in Security Filter Examples

**1. Block All ICMP Ping Requests:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "icmp",
    "protocol": "icmp",
    "icmp_type": 8,
    "icmp_code": 0,
    "action": "drop",
    "enabled": false,
    "comment": "Block all ICMP ping requests (Echo Request)"
  }'
```

**2. Block ICMP Destination Unreachable and Source Quench:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "icmp",
    "protocol": "icmp",
    "icmp_type": 3,
    "action": "drop",
    "enabled": true,
    "comment": "Block ICMP Destination Unreachable messages"
  }'
```

```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "icmp",
    "protocol": "icmp",
    "icmp_type": 4,
    "action": "drop",
    "enabled": true,
    "comment": "Block ICMP Source Quench messages"
  }'
```

**8. Block ICMP Error Messages Containing UDP Traffic:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "icmp",
    "protocol": "icmp",
    "icmp_type": 3,
    "inner_protocol": "udp",
    "action": "drop",
    "enabled": true,
    "comment": "Block ICMP Destination Unreachable with inner UDP packets"
  }'
```

**9. Advanced ICMP Filtering - Block Specific Inner UDP Ports:**
```bash
# Block ICMP errors containing DNS traffic (inner UDP port 53)
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "icmp",
    "protocol": "icmp",
    "icmp_type": 3,
    "inner_protocol": "udp",
    "inner_dst_ip": "",
    "comment": "Block ICMP errors exposing DNS queries"
  }'

# Block ICMP Time Exceeded with inner UDP (traceroute detection)
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "icmp",
    "protocol": "icmp",
    "icmp_type": 11,
    "inner_protocol": "udp",
    "action": "drop",
    "enabled": true,
    "comment": "Block UDP traceroute attempts (ICMP Time Exceeded)"
  }'
```

**10. Block All ICMP Echo Requests (Comprehensive Ping Block):**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "icmp",
    "protocol": "icmp",
    "icmp_type": 8,
    "action": "drop",
    "enabled": true,
    "comment": "Block all ICMP Echo Requests (comprehensive ping block)"
  }'
```

**4. Block Dangerous Ports - Remote Access:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "tcp",
    "protocol": "tcp",
    "dst_port": 23,
    "action": "drop",
    "enabled": true,
    "comment": "Block Telnet (insecure remote access)"
  }'
```

```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "tcp",
    "protocol": "tcp",
    "dst_port": 135,
    "action": "drop",
    "enabled": true,
    "comment": "Block RPC Endpoint Mapper (Windows vulnerability)"
  }'
```

**5. Block Dangerous Ports - File Sharing:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "tcp",
    "protocol": "tcp",
    "dst_port": 445,
    "action": "drop",
    "enabled": true,
    "comment": "Block SMB/CIFS (ransomware vector)"
  }'
```

```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "tcp",
    "protocol": "tcp",
    "dst_port": 139,
    "action": "drop",
    "enabled": true,
    "comment": "Block NetBIOS Session Service"
  }'
```

**6. Block Dangerous Ports - Database Services:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "tcp",
    "protocol": "tcp",
    "dst_port": 1433,
    "action": "drop",
    "enabled": true,
    "comment": "Block MS SQL Server (external access)"
  }'
```

```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "tcp",
    "protocol": "tcp",
    "dst_port": 3306,
    "action": "drop",
    "enabled": true,
    "comment": "Block MySQL (external access)"
  }'
```

**7. Block Dangerous Ports - Remote Desktop:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "tcp",
    "protocol": "tcp",
    "dst_port": 3389,
    "action": "drop",
    "enabled": true,
    "comment": "Block RDP (brute force target)"
  }'
```

```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "tcp",
    "protocol": "tcp",
    "dst_port": 5900,
    "action": "drop",
    "enabled": true,
    "comment": "Block VNC (insecure remote access)"
  }'
```


#### Update Filter
```bash
curl -X PUT http://localhost:8080/api/filters/0 \
  -H "Content-Type: application/json" \
  -d '{
    "id": 0,
    "action": "drop",
    "enabled": false,
    "comment": "Temporarily disabled"
  }'
```

#### Delete Filter
```bash
curl -X DELETE http://localhost:8080/api/filters/0
```

#### Enable/Disable Filter
```bash
# Enable
curl -X POST http://localhost:8080/api/filters/0/enable

# Disable
curl -X POST http://localhost:8080/api/filters/0/disable
```

### Filter Rule Types

#### Wildcard Values
When creating filter rules, you can omit certain fields and the system will automatically set them to wildcard values:
- **IP addresses**: Empty or omitted fields are set to `"any"` (matches any IP)
- **Ports**: Default value `0` matches any port
- **Protocol**: Automatically set based on `rule_type` if not specified
- **ICMP type/code**: Use `255` for wildcard matching in BPF program

#### Testing and Debugging Filters
To verify that your filters are working correctly:

1. **Monitor BPF trace output** (shows detailed filter matching):
```bash
sudo cat /sys/kernel/debug/tracing/trace_pipe
```

2. **Check if filter was added successfully**:
```bash
curl http://localhost:8080/api/filters
```

3. **Test ICMP filter with ping**:
```bash
# Add ICMP filter
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "icmp",
    "icmp_type": 8,
    "icmp_code": 0,
    "action": "drop",
    "enabled": true,
    "comment": "Block ICMP ping requests"
  }'

# Test with ping (should be blocked)
ping -c 1 target_ip
```

#### Basic Rules
Fields: `src_ip`, `dst_ip`, `src_port`, `dst_port`, `protocol`

#### TCP Rules  
Additional fields: `tcp_flags`, `tcp_flags_mask`

#### UDP Rules
Fields: `src_port`, `dst_port`

#### ICMP Rules
Additional fields: `icmp_type`, `icmp_code`, `inner_src_ip`, `inner_dst_ip`, `inner_protocol`

### TCP Flags Reference

| Flag | Value | Description |
|------|-------|-------------|
| FIN  | 1     | Connection termination |
| SYN  | 2     | Synchronize, establish connection |
| RST  | 4     | Reset connection |
| PSH  | 8     | Push data |
| ACK  | 16    | Acknowledgment |
| URG  | 32    | Urgent data |

**Common Combinations:**
- `SYN` (2): Connection request
- `SYN+ACK` (18): Connection response  
- `ACK` (16): Data transmission
- `FIN+ACK` (17): Normal close
- `RST` (4): Force close

## 🤖 AI-Powered Filter Generation

### Overview
The AI intelligent filter generation feature utilizes large language models (like OpenAI GPT series) to analyze network connection data and automatically generate appropriate eBPF filter rules.

### Core Features
- **Intelligent Analysis**: Automatic analysis of TCP/UDP connections, ICMP traffic, and performance statistics
- **Multiple Strategies**: Security-oriented, performance-oriented, and balanced modes
- **Custom Prompts**: User-provided custom analysis instructions
- **Detailed Comments**: Generated rules include detailed explanations and suggestions
- **Flexible Configuration**: Support for custom OpenAI endpoints and model parameters

### AI Configuration

#### Get Current Configuration
```bash
curl http://localhost:8080/api/ai/config
```

#### Update AI Configuration
```bash
curl -X POST http://localhost:8080/api/ai/config \
  -H "Content-Type: application/json" \
  -d '{
    "openai_endpoint": "https://api.openai.com/v1/chat/completions",
    "api_key": "sk-your-openai-api-key",
    "model": "gpt-4",
    "temperature": 0.7,
    "timeout": 120,
    "debug": true
  }'
```

### AI Filter Generation

#### Security-Oriented Analysis
```bash
curl -X POST http://localhost:8080/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "analyze_type": "security",
    "include_tcp": true,
    "include_icmp": true,
    "include_stats": true
  }'
```

#### Performance-Oriented Analysis
```bash
curl -X POST http://localhost:8080/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "analyze_type": "performance",
    "include_tcp": true,
    "include_icmp": false,
    "include_stats": true
  }'
```

#### Custom Analysis
```bash
curl -X POST http://localhost:8080/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "analyze_type": "custom",
    "custom_prompt": "Focus on SSH and HTTP service security, identify brute force attacks",
    "include_tcp": true,
    "include_icmp": true,
    "include_stats": true
  }'
```

#### Network Analysis Only (No Filter Generation)
```bash
curl -X POST http://localhost:8080/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "include_tcp": true,
    "include_icmp": true,
    "include_stats": true,
    "custom_prompt": "Analyze traffic patterns for anomalies"
  }'
```

### Supported Endpoints

#### OpenAI Compatible Endpoints
```bash
# OpenAI Official
"https://api.openai.com/v1/chat/completions"

# Azure OpenAI
"https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2023-05-15"

# DeepSeek AI
"https://api.deepseek.com/v1/chat/completions"
```

#### Local Deployed Models
```bash
# Ollama
"http://localhost:11434/v1/chat/completions"

# vLLM
"http://localhost:8000/v1/chat/completions"

# LocalAI
"http://localhost:8080/v1/chat/completions"
```

### Response Format

#### Success Response
```json
{
  "success": true,
  "analysis": "Network traffic analysis shows potential brute force attack on SSH service...",
  "suggestions": [
    "Implement rate limiting for SSH connections",
    "Block suspicious IP addresses",
    "Monitor for port scanning activities"
  ],
  "filters": [
    {
      "rule_type": "tcp",
      "protocol": "tcp",
      "tcp_flags": 2,
      "tcp_flags_mask": 2,
      "action": "drop",
      "enabled": true,
      "comment": "Block TCP SYN scanning attacks"
    }
  ],
  "tokens_used": 250
}
```

### Debug Mode

#### Enable Debug Mode
```bash
curl -X POST http://localhost:8080/api/ai/config \
  -H "Content-Type: application/json" \
  -d '{
    "debug": true,
    "timeout": 120
  }'
```

When debug mode is enabled, detailed information is printed to the server console:
- Request parameters
- Connection data summary  
- Generated system prompts
- OpenAI API requests/responses
- HTTP request/response details
- JSON parsing process
- Final results

## 🎯 Use Cases

### Network Security Monitoring
- Real-time monitoring of network connection states
- Detection of anomalous traffic and potential threats
- Automatic generation of security protection rules

### Performance Optimization
- Analysis of network bottlenecks and performance issues
- Optimization of network configuration and traffic distribution
- Intelligent generation of performance optimization rules

### Compliance Auditing
- Network access control and auditing
- Configuration checks for security standard compliance
- Automated compliance report generation

### Incident Response
- Rapid response to network security incidents
- Automatic generation of emergency protection rules
- Traffic pattern analysis for threat hunting

## 🛠️ Advanced Configuration

### Environment Variables
```bash
export OPENAI_API_KEY="your-api-key"
export OPENAI_ENDPOINT="https://api.openai.com/v1/chat/completions"
export AI_DEBUG="true"
```

### Automation Script Example
```bash
#!/bin/bash

# Configure AI service
curl -X POST http://localhost:8080/api/ai/config \
  -H "Content-Type: application/json" \
  -d '{
    "openai_endpoint": "'$OPENAI_ENDPOINT'",
    "api_key": "'$OPENAI_API_KEY'",
    "model": "gpt-4",
    "temperature": 0.5,
    "timeout": 120
  }'

# Generate security filter rules
RESPONSE=$(curl -s -X POST http://localhost:8080/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "analyze_type": "security",
    "include_tcp": true,
    "include_icmp": true,
    "include_stats": true
  }')

# Check if successful
if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
  echo "AI analysis completed successfully"
  echo "$RESPONSE" | jq '.analysis'
  
  # Auto-apply generated rules (optional)
  echo "$RESPONSE" | jq '.filters[]' | while IFS= read -r filter; do
    curl -X POST http://localhost:8080/api/filters \
      -H "Content-Type: application/json" \
      -d "$filter"
  done
else
  echo "AI analysis failed:"
  echo "$RESPONSE" | jq '.error'
fi
```

## 🔍 Troubleshooting

### Common Issues

#### Compilation Errors
- Ensure Linux kernel headers are installed
- Verify clang and libbpf development packages
- Check Go version (1.19+ required)

#### API Connection Issues
```bash
# Check if service is running
curl http://localhost:8080/api/stats

# Verify network interface
ip link show
```

#### AI Generation Failures
- Verify API key and endpoint configuration
- Check network connectivity to AI service
- Enable debug mode for detailed error information
- Increase timeout for slow AI responses

#### Permission Errors
```bash
# Run with sudo for eBPF operations
sudo ./conn-tracker -iface eth0
```

## 📋 Technical Specifications

- **Kernel Requirements**: Linux 5.4+
- **Memory Usage**: < 50MB typical
- **CPU Overhead**: < 1% on modern systems
- **Network Protocols**: IPv4, TCP, UDP, ICMP
- **Maximum Connections**: 1M+ concurrent tracking
- **Filter Rules**: 1000+ rules supported

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🌟 Acknowledgments

- eBPF/XDP technology from the Linux kernel community
- OpenAI for AI-powered analysis capabilities
- Go eBPF libraries and tools

## 📚 Additional Resources

- [eBPF Documentation](https://ebpf.io/)
- [XDP Tutorial](https://github.com/xdp-project/xdp-tutorial)
- [OpenAI API Documentation](https://platform.openai.com/docs)

---

For the Chinese version of this documentation, see [README-zh.md](README-zh.md). 