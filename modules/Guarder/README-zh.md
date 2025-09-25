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
- Go 1.19+
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

#### 添加新过滤规则

**封禁可疑IP:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "basic",
    "src_ip": "192.168.1.100",
    "action": "drop",
    "enabled": true,
    "comment": "封禁可疑IP"
  }'
```

**阻止SYN扫描:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "tcp",
    "protocol": "tcp",
    "tcp_flags": 2,
    "tcp_flags_mask": 2,
    "action": "drop",
    "enabled": true,
    "comment": "阻止SYN扫描"
  }'
```

**阻止ICMP Ping:**
```bash
curl -X POST http://localhost:8080/api/filters \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "icmp",
    "protocol": "icmp",
    "icmp_type": 8,
    "icmp_code": 0,
    "action": "drop",
    "enabled": true,
    "comment": "阻止ICMP ping请求"
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
- 检查Go版本（需要1.19+）

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