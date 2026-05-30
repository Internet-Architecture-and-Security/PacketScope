# Packet Scope

一个基于eBPF/XDP技术的高性能网络连接追踪工具，可以监控TCP/UDP连接和ICMP流量，并提供智能的AI驱动过滤器生成功能。

## 🚀 功能特性

- **高性能**: 基于eBPF/XDP技术的零拷贝数据处理
- **全面监控**: TCP/UDP连接追踪和ICMP流量分析
- **智能过滤**: AI驱动的过滤规则生成和管理
- **实时统计**: 详细的网络性能统计和分析
- **HTTP API**: 完整的RESTful API接口
- **精确匹配**: 基于IP、端口、协议等的多维度过滤

## 🏗️ 系统架构

```
┌─────────────────────┐      ┌─────────────────────────────────┐
│                     │      │                                 │
│     网络数据包       │──────▶  eBPF/XDP 程序                  │
│                     │      │  (conn_tracker.c)              │
└─────────────────────┘      └───────────────┬─────────────────┘
                                             │
                                             │ BPF 映射表
                                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                         用户空间程序                              │
│                                                                 │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐    │
│  │   BPF加载器   │    │   映射读取器   │    │   API服务器   │    │
│  │  (main.go)    │    │  (main.go)    │    │  (api.go)     │    │
│  └───────────────┘    └───────────────┘    └───────────────┘    │
│                                                    │            │
│                       ┌─────────────────────────────────────┐   │
│                       │         AI分析模块                   │   │
│                       │       (ai_filter.go)               │   │
│                       └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
                                           ┌───────────────────────┐
                                           │   HTTP客户端/AI模型   │
                                           └───────────────────────┘
```

## 📁 项目结构

```
conn-tracker/
├── bpf/                    # eBPF内核程序
│   └── conn_tracker.c      # 主要的XDP程序
├── cmd/conn-tracker/       # 用户空间应用程序
│   ├── main.go            # 主程序入口
│   ├── api.go             # HTTP API服务器
│   ├── ai_filter.go       # AI过滤器生成
│   ├── filter.go          # 过滤器管理
│   └── common.go          # 通用工具
├── pkg/                   # Go包
└── docs/                  # 文档（此README）
```

## 🔧 安装部署

### 系统要求
- Linux内核 5.4+ (支持eBPF/XDP)
- Go >= 1.22
- libbpf开发库
- clang编译器
- OpenAI API密钥 (可选，用于AI功能)

### 编译安装

#### 国内用户配置
如果遇到Go模块下载超时问题，请在编译前配置Go代理：

```bash
# 设置阿里云Go代理镜像
export GOPROXY=https://mirrors.aliyun.com/goproxy/,direct
export GOSUMDB=sum.golang.google.cn

# 其他可选代理源（选择其一）:
# export GOPROXY=https://goproxy.cn,direct
# export GOPROXY=https://mirrors.cloud.tencent.com/go/,direct
```

#### 编译步骤
```bash
# 克隆仓库
git clone <repository-url>
cd conn-tracker

# （可选）配置Go代理加速下载
export GOPROXY=https://mirrors.aliyun.com/goproxy/,direct
export GOSUMDB=sum.golang.google.cn

# 编译项目
make

# 运行应用
sudo ./conn-tracker -iface eth0 -interval 5 -api :8080
```

### Docker构建时使用自定义Go代理

在中国或其他地区，可以在构建时指定Go代理以加速构建：

```bash
# 使用阿里云Go代理构建
docker build --build-arg GOPROXY=https://mirrors.aliyun.com/goproxy/,direct \
             --build-arg GOSUMDB=sum.golang.google.cn \
             -t guarder .

# 使用goproxy.cn构建
docker build --build-arg GOPROXY=https://goproxy.cn,direct \
             --build-arg GOSUMDB=sum.golang.google.cn \
             -t guarder .

# 使用腾讯云代理构建
docker build --build-arg GOPROXY=https://mirrors.cloud.tencent.com/go/,direct \
             --build-arg GOSUMDB=sum.golang.google.cn \
             -t guarder .

# 默认构建（使用官方Go代理）
docker build -t guarder .
```

### 命令行参数
- `-iface`: 要监控的网络接口（必需）
- `-interval`: 控制台输出间隔秒数（默认: 10）
- `-api`: API服务器监听地址（默认: :8080）

## 🐳 Docker部署

### Docker快速启动

```bash
# 使用主机网络运行（eBPF必需）
sudo docker run --privileged --network host guarder

# 指定网络接口运行
sudo docker run --privileged --network host guarder ./conn-tracker -iface ens33 -interval 10

# 后台运行
sudo docker run -d --privileged --network host --name guarder-monitor guarder
```

### 发布Docker镜像

#### 1. 标记镜像
```bash
# 标记为Docker Hub镜像
sudo docker tag guarder your-username/guarder:latest
sudo docker tag guarder your-username/guarder:v1.0.0

# 标记为GitHub容器注册表镜像
sudo docker tag guarder ghcr.io/your-username/guarder:latest
sudo docker tag guarder ghcr.io/your-username/guarder:v1.0.0

# 标记为阿里云容器注册表镜像
sudo docker tag guarder registry.cn-hangzhou.aliyuncs.com/your-namespace/guarder:latest
```

#### 2. 推送到注册表

**Docker Hub:**
```bash
# 登录Docker Hub
sudo docker login

# 推送镜像
sudo docker push your-username/guarder:latest
sudo docker push your-username/guarder:v1.0.0
```

**GitHub容器注册表:**
```bash
# 使用GitHub令牌登录
echo $GITHUB_TOKEN | sudo docker login ghcr.io -u your-username --password-stdin

# 推送镜像
sudo docker push ghcr.io/your-username/guarder:latest
sudo docker push ghcr.io/your-username/guarder:v1.0.0
```

**阿里云容器注册表:**
```bash
# 登录阿里云
sudo docker login --username=your-aliyun-username registry.cn-hangzhou.aliyuncs.com

# 推送镜像
sudo docker push registry.cn-hangzhou.aliyuncs.com/your-namespace/guarder:latest
```

#### 3. 多架构构建（可选）

支持多种架构（amd64, arm64）：

```bash
# 创建并使用buildx构建器
sudo docker buildx create --name multiarch-builder --use

# 构建并推送多架构镜像
sudo docker buildx build --platform linux/amd64,linux/arm64 \
  --build-arg GOPROXY=https://goproxy.cn,direct \
  -t your-username/guarder:latest \
  --push .
```

## 📊 连接追踪

### 实时监控
系统提供全面的网络连接追踪，包含详细信息：

- **TCP/UDP连接**: 源/目标IP、端口、数据包计数、字节计数
- **连接状态**: TCP标志位、序列号、确认号
- **时间信息**: 首次发现、最后见到的时间戳
- **性能指标**: 重传、窗口大小、丢包情况

### API接口

#### 获取连接信息
```bash
curl http://localhost:8080/api/connections
```

**响应示例:**
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

#### 获取ICMP流量
```bash
curl http://localhost:8080/api/icmp
```

#### 获取性能统计
```bash
curl http://localhost:8080/api/stats
```

## 🛡️ 过滤器管理

### 功能概述
过滤系统提供内核空间数据包过滤，支持针对不同协议的细粒度过滤：

- **基础过滤**: IP地址、端口、协议
- **ICMP过滤**: ICMP类型、代码以及错误消息检查
- **TCP过滤**: 基于TCP标志位的过滤
- **UDP过滤**: 基于端口的过滤

### 过滤器API

#### 获取所有过滤器
```bash
curl http://localhost:8080/api/filters
```

##### 内置安全过滤器示例

**1. 封禁所有ICMP Ping请求:**
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
    "comment": "封禁所有ICMP ping请求（Echo Request）"
  }'
```

**2. 封禁ICMP目标不可达和源抑制消息:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "icmp",
    "protocol": "icmp",
    "icmp_type": 3,
    "action": "drop",
    "enabled": true,
    "comment": "封禁ICMP目标不可达消息"
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
    "comment": "封禁ICMP源抑制消息"
  }'
```

**3. 封禁包含UDP流量的ICMP错误消息:**
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
    "comment": "封禁包含内部UDP数据包的ICMP目标不可达消息"
  }'
```

**4. 高级ICMP过滤 - 封禁特定内部UDP端口:**
```bash
# 封禁包含DNS流量的ICMP错误（内部UDP端口53）
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "icmp",
    "protocol": "icmp",
    "icmp_type": 3,
    "inner_protocol": "udp",
    "inner_dst_ip": "",
    "comment": "封禁暴露DNS查询的ICMP错误消息"
  }'

# 封禁包含内部UDP的ICMP超时消息（traceroute检测）
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "icmp",
    "protocol": "icmp",
    "icmp_type": 11,
    "inner_protocol": "udp",
    "action": "drop",
    "enabled": true,
    "comment": "封禁UDP traceroute尝试（ICMP超时）"
  }'
```

**5. 封禁所有ICMP回显请求（综合Ping封禁）:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "icmp",
    "protocol": "icmp",
    "icmp_type": 8,
    "action": "drop",
    "enabled": true,
    "comment": "封禁所有ICMP回显请求（综合ping封禁）"
  }'
```

**6. 封禁危险端口 - 远程访问:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "tcp",
    "protocol": "tcp",
    "dst_port": 23,
    "action": "drop",
    "enabled": true,
    "comment": "封禁Telnet（不安全的远程访问）"
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
    "comment": "封禁RPC端点映射器（Windows漏洞）"
  }'
```

**7. 封禁危险端口 - 文件共享:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "tcp",
    "protocol": "tcp",
    "dst_port": 445,
    "action": "drop",
    "enabled": true,
    "comment": "封禁SMB/CIFS（勒索软件传播途径）"
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
    "comment": "封禁NetBIOS会话服务"
  }'
```

**8. 封禁危险端口 - 数据库服务:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "tcp",
    "protocol": "tcp",
    "dst_port": 1433,
    "action": "drop",
    "enabled": true,
    "comment": "封禁MS SQL Server（外部访问）"
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
    "comment": "封禁MySQL（外部访问）"
  }'
```

**9. 封禁危险端口 - 远程桌面:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "tcp",
    "protocol": "tcp",
    "dst_port": 3389,
    "action": "drop",
    "enabled": true,
    "comment": "封禁RDP（暴力破解目标）"
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
    "comment": "封禁VNC（不安全的远程访问）"
  }'
```

#### 更新过滤器
```bash
curl -X PUT http://localhost:8080/api/filters/1 \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "enabled": false,
    "comment": "临时禁用"
  }'
```

#### 删除过滤器
```bash
curl -X DELETE http://localhost:8080/api/filters/1
```

#### 启用/禁用过滤器
```bash
# 启用
curl -X POST http://localhost:8080/api/filters/1/enable

# 禁用
curl -X POST http://localhost:8080/api/filters/1/disable
```

### 过滤规则类型

#### 基础规则
字段: `src_ip`, `dst_ip`, `src_port`, `dst_port`, `protocol`

#### TCP规则  
额外字段: `tcp_flags`, `tcp_flags_mask`

#### UDP规则
字段: `src_port`, `dst_port`

#### ICMP规则
额外字段: `icmp_type`, `icmp_code`, `inner_src_ip`, `inner_dst_ip`, `inner_protocol`

### TCP标志位参考

| 标志位 | 数值 | 描述 |
|--------|------|------|
| FIN    | 1    | 连接终止 |
| SYN    | 2    | 同步，建立连接 |
| RST    | 4    | 重置连接 |
| PSH    | 8    | 推送数据 |
| ACK    | 16   | 确认 |
| URG    | 32   | 紧急数据 |

**常见组合:**
- `SYN` (2): 连接请求
- `SYN+ACK` (18): 连接响应  
- `ACK` (16): 数据传输
- `FIN+ACK` (17): 正常关闭
- `RST` (4): 强制关闭

## 🤖 AI智能过滤器生成

### 功能概述
AI智能过滤器生成功能利用大语言模型（如OpenAI GPT系列）分析网络连接数据，自动生成相应的eBPF过滤规则。

### 核心特性
- **智能分析**: 自动分析TCP/UDP连接、ICMP流量和性能统计
- **多种策略**: 安全导向、性能导向和平衡模式
- **自定义提示**: 用户提供的自定义分析指令
- **详细注释**: 生成的规则包含详细说明和建议
- **灵活配置**: 支持自定义OpenAI端点和模型参数

### AI配置

#### 获取当前配置
```bash
curl http://localhost:8080/api/ai/config
```

#### 更新AI配置
```bash
curl -X POST http://localhost:8080/api/ai/config \
  -H "Content-Type: application/json" \
  -d '{
    "openai_endpoint": "https://api.deepseek.com/chat/completions",
    "api_key": "API KEY",
    "model": "deepseek-chat",
    "temperature": 0.7,
    "timeout": 120,
    "debug": true
  }'
```

### AI过滤器生成

#### 安全导向分析
```bash
curl -X POST http://localhost:8080/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "analyze_type": "security",
    "include_tcp": true,
    "include_icmp": true,
    "include_stats": false
  }'
```

#### 性能导向分析
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

#### 自定义分析
```bash
curl -X POST http://localhost:8080/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "analyze_type": "custom",
    "custom_prompt": "重点关注SSH和HTTP服务安全，识别暴力破解攻击",
    "include_tcp": true,
    "include_icmp": true,
    "include_stats": true
  }'
```

#### 仅网络分析（不生成过滤器）
```bash
curl -X POST http://localhost:8080/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "include_tcp": true,
    "include_icmp": true,
    "include_stats": true,
    "custom_prompt": "分析流量模式中的异常行为"
  }'
```

### 支持的端点

#### OpenAI兼容端点
```bash
# OpenAI官方
"https://api.openai.com/v1/chat/completions"

# Azure OpenAI
"https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2023-05-15"

# DeepSeek AI
"https://api.deepseek.com/v1/chat/completions"
```

#### 本地部署模型
```bash
# Ollama
"http://localhost:11434/v1/chat/completions"

# vLLM
"http://localhost:8000/v1/chat/completions"

# LocalAI
"http://localhost:8080/v1/chat/completions"
```

### 响应格式

#### 成功响应
```json
{
  "success": true,
  "analysis": "网络流量分析显示SSH服务存在潜在的暴力破解攻击...",
  "suggestions": [
    "为SSH连接实施速率限制",
    "封禁可疑IP地址",
    "监控端口扫描活动"
  ],
  "filters": [
    {
      "rule_type": "tcp",
      "protocol": "tcp",
      "tcp_flags": 2,
      "tcp_flags_mask": 2,
      "action": "drop",
      "enabled": true,
      "comment": "阻止TCP SYN扫描攻击"
    }
  ],
  "tokens_used": 250
}
```

### 调试模式

#### 启用调试模式
```bash
curl -X POST http://localhost:8080/api/ai/config \
  -H "Content-Type: application/json" \
  -d '{
    "debug": true,
    "timeout": 120
  }'
```

启用调试模式时，详细信息会输出到服务器控制台：
- 请求参数
- 连接数据摘要  
- 生成的系统提示词
- OpenAI API请求/响应
- HTTP请求/响应详情
- JSON解析过程
- 最终结果

## 🎯 使用场景

### 网络安全监控
- 实时监控网络连接状态
- 检测异常流量和潜在威胁
- 自动生成安全防护规则

### 性能优化
- 分析网络瓶颈和性能问题
- 优化网络配置和流量分布
- 智能生成性能优化规则

### 合规性审计
- 网络访问控制和审计
- 安全标准合规性配置检查
- 自动化合规性报告生成

### 事件响应
- 快速响应网络安全事件
- 自动生成紧急防护规则
- 威胁狩猎的流量模式分析

## 🛠️ 高级配置

### 环境变量
```bash
export OPENAI_API_KEY="your-api-key"
export OPENAI_ENDPOINT="https://api.openai.com/v1/chat/completions"
export AI_DEBUG="true"
```

### 自动化脚本示例
```bash
#!/bin/bash

# 配置AI服务
curl -X POST http://localhost:8080/api/ai/config \
  -H "Content-Type: application/json" \
  -d '{
    "openai_endpoint": "'$OPENAI_ENDPOINT'",
    "api_key": "'$OPENAI_API_KEY'",
    "model": "gpt-4",
    "temperature": 0.5,
    "timeout": 120
  }'

# 生成安全过滤规则
RESPONSE=$(curl -s -X POST http://localhost:8080/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "analyze_type": "security",
    "include_tcp": true,
    "include_icmp": true,
    "include_stats": true
  }')

# 检查是否成功
if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
  echo "AI分析成功完成"
  echo "$RESPONSE" | jq '.analysis'
  
  # 自动应用生成的规则（可选）
  echo "$RESPONSE" | jq '.filters[]' | while IFS= read -r filter; do
    curl -X POST http://localhost:8080/api/filters \
      -H "Content-Type: application/json" \
      -d "$filter"
  done
else
  echo "AI分析失败："
  echo "$RESPONSE" | jq '.error'
fi
```

## 🔍 故障排除

### 常见问题

#### 编译错误
- 确保安装了Linux内核头文件
- 验证clang和libbpf开发包
- 检查Go版本（需要1.22+）

#### API连接问题
```bash
# 检查服务是否运行
curl http://localhost:8080/api/stats

# 验证网络接口
ip link show
```

#### AI生成失败
- 验证API密钥和端点配置
- 检查到AI服务的网络连接
- 启用调试模式获取详细错误信息
- 增加超时时间应对慢速AI响应

#### 权限错误
```bash
# eBPF操作需要使用sudo运行
sudo ./conn-tracker -iface eth0
```

## 📋 技术规格

- **内核要求**: Linux 5.4+
- **内存使用**: 典型情况下 < 50MB
- **CPU开销**: 现代系统上 < 1%
- **网络协议**: IPv4, TCP, UDP, ICMP
- **最大连接**: 支持1M+并发追踪
- **过滤规则**: 支持1000+规则

## 📦 PCAP文件分析

### 概述
PCAP分析功能允许您上传并分析数据包捕获文件，使用AI驱动的威胁检测。这可以对网络流量进行离线分析，以识别安全威胁、异常和攻击模式。

### 功能特性
- **协议分析**: 自动检测协议（TCP、UDP、ICMP、HTTP、HTTPS、DNS、SSH等）
- **流量统计**: 源/目标IP、端口、数据包计数排名
- **异常检测**: SYN洪水检测、端口扫描模式识别
- **AI驱动分析**: 使用大语言模型识别威胁并提供建议
- **结构化报告**: JSON格式输出，包含严重级别、威胁类型和可操作建议

### 前提条件

#### 启用PCAP支持编译

```bash
# 安装libpcap开发库
sudo apt-get install libpcap-dev

# 启用PCAP支持编译
cd modules/Guarder
go build -tags pcap -o conn-tracker ./cmd/conn-tracker
```

### API使用方法

#### 分析PCAP文件

```bash
curl -X POST http://localhost:8080/api/pcap/analyze \
  -F "file=@/path/to/capture.pcap" \
  -F "analyze_type=security" \
  -F "custom_prompt=重点关注识别恶意软件C2通信"
```

**参数说明:**
- `file`: 要分析的PCAP或PCAPNG文件（必需）
- `analyze_type`: 分析类型 - `security`（安全）、`performance`（性能）或 `custom`（自定义）（默认: security）
- `custom_prompt`: AI分析的附加指令（可选）

**响应示例:**
```json
{
  "success": true,
  "analysis": "网络流量分析发现潜在的端口扫描活动...",
  "threats": [
    {
      "severity": "high",
      "type": "Port Scanning",
      "description": "检测到来自192.168.1.100的顺序端口扫描，目标端口为22、80、443、3306",
      "source_ip": "192.168.1.100",
      "target_ip": "10.0.0.5",
      "target_port": 0
    },
    {
      "severity": "medium",
      "type": "SYN Flood",
      "description": "检测到大量未完成握手的SYN数据包",
      "source_ip": "192.168.1.105",
      "target_ip": "10.0.0.1",
      "target_port": 80
    }
  ],
  "statistics": {
    "total_packets": 5000,
    "total_bytes": 2450000,
    "duration": "2m30s",
    "protocols": {
      "TCP": 3500,
      "UDP": 1200,
      "ICMP": 300
    },
    "top_source_ips": [
      {"ip": "192.168.1.100", "count": 1500},
      {"ip": "192.168.1.105", "count": 1200}
    ],
    "top_ports": [
      {"port": 80, "protocol": "TCP", "count": 2000},
      {"port": 443, "protocol": "TCP", "count": 1500}
    ],
    "tcp_flags": {
      "syn": 1800,
      "ack": 1600,
      "fin": 800,
      "rst": 200
    },
    "connections": 450
  },
  "suggestions": [
    "在防火墙层面封禁源IP 192.168.1.100",
    "对SYN数据包实施速率限制",
    "在目标服务器上启用SYN Cookie",
    "调查192.168.1.105是否已被入侵"
  ]
}
```

### 分析类型

#### 安全分析
专注于识别安全威胁：
- 端口扫描和侦察
- SYN洪水和DDoS攻击
- 恶意软件命令与控制（C2）通信
- 暴力破解攻击
- 数据泄露尝试

```bash
curl -X POST http://localhost:8080/api/pcap/analyze \
  -F "file=@capture.pcap" \
  -F "analyze_type=security" \
  -F "custom_prompt=重点关注SSH暴力破解尝试"
```

#### 性能分析
专注于网络性能问题：
- 带宽消耗
- 延迟问题
- 网络瓶颈
- 资源密集型流量

```bash
curl -X POST http://localhost:8080/api/pcap/analyze \
  -F "file=@capture.pcap" \
  -F "analyze_type=performance"
```

### Python客户端示例

```python
import requests

def analyze_pcap(file_path, analyze_type="security", custom_prompt=""):
    url = "http://localhost:8080/api/pcap/analyze"
    
    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {
            'analyze_type': analyze_type,
            'custom_prompt': custom_prompt
        }
        response = requests.post(url, files=files, data=data)
    
    return response.json()

# 安全威胁分析
result = analyze_pcap(
    file_path="network_capture.pcap",
    analyze_type="security",
    custom_prompt="查找横向移动的迹象"
)

if result['success']:
    print(f"发现 {len(result['threats'])} 个威胁:")
    for threat in result['threats']:
        print(f"  [{threat['severity'].upper()}] {threat['type']}: {threat['description']}")
else:
    print(f"分析失败: {result['error']}")
```

### 限制

- 最大文件大小: 32MB（可在 `api.go` 中配置）
- 每个文件最大处理数据包数: 5000（出于性能考虑）
- 完整功能需要安装libpcap-dev
- AI分析需要配置OpenAI API密钥

## 🤝 贡献指南

1. Fork仓库
2. 创建功能分支
3. 进行更改
4. 如适用，添加测试
5. 提交拉取请求

## 📄 许可证

MIT许可证 - 详见LICENSE文件。

## 🌟 致谢

- Linux内核社区的eBPF/XDP技术
- OpenAI提供的AI分析能力
- Go eBPF库和工具

## 📚 额外资源

- [eBPF文档](https://ebpf.io/)
- [XDP教程](https://github.com/xdp-project/xdp-tutorial)
- [OpenAI API文档](https://platform.openai.com/docs)

---

英文版本请参见 [README.md](README.md). 