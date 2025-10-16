# PacketScope Analyzer 模块

## 概述

PacketScope的Analyzer模块为用户提供了前所未有的协议交互全景可视化能力。其中，**Monitor**组件能够捕获分组自协议栈入口至应用层处理的完整处理路径，生成跨层、跨协议的交互全景图。**Calculator**组件进一步梳理数据包在协议栈中的完整收发路径，统计分析分组跨层交互信息，包含：层流量、跨层交互频率、跨层延迟、丢包率 。

## 特性

### Monitor 组件
- 实时监控当前计算机的套接字和网卡状态
- 捕获通过任一网络接口的流量包
- 捕捉网络包通过各内核函数的路径与耗时
- 将内核路径组织为调用图以提供可视化功能

### Calculator 组件
- 网络协议栈关键路径实时监控：实时监控数据包流经链路层、网络层、传输层的过程
- 跨层交互指标实时计算：层流量、跨层交互频率、跨层延迟、丢包率
- 历史趋势分析：历史曲线图查看指标变化
- API 接口：只需要一个接口就能计算所有跨层交互指标


---

## 模块架构

```
Analyzer/
├──Calculator/
│   ├── Dokcerfile  # 用于构建容器的 Dockerfile
│   ├── NumLatencyFrequency # 实时计算跨层交互性能指标
│   └── monitor.py  # 启动监控程序的接口
├── Monitor/       # User space application
│   ├── Dokcerfile  # 用于构建容器的 Dockerfile
│   ├── AttachAndRunProbers.py # 用于附加函数流图接口
│   ├── flaskServerMain.py # 用于组织服务器并提供接口
│   ├── GetRecentMaps.py # 查询最新若干个函数流图
│   ├── Inspector.py # 功能测试,可用于观测当前内核函数调用情况
│   ├── ListSockets.py # 查询当前套接字状态
│   ├── PSUtil.py # 辅助函数库
│   ├── QueryAndGetFuncMapRecv.py # 查询最新若干个函数流图(接收部分)
│   ├── QueryAndGetFuncMapSend.py # 查询最新若干个函数流图(发送部分)
│   ├── ReadBTFandGetItsMember.py # 读取并预处理BTF信息
│   ├── tcxProber.c # eBPF-c文件,用于挂载到TC上
│   ├── TcxProber.py # 在TC上挂载eBPF
│   ├── TcxQuery.py # 查询通过某套接字的流量包
│   ├── TestFilterAndGet.py # 功能测试
│   ├── TestPacket.py # 功能测试
│   ├── TestRecentMap.py # 功能测试
│   └── translateJSON.py # 将BTF信息转换为C语言挂载
├── README.md                   # Readme
└── README-zh.md                  # Documentation (this README)
```


## 安装指南

### 系统要求

- 支持 eBPF 的 Linux 内核（6.8+ 版本）
- Docker（用于容器化部署）
- Root/sudo 权限

### 推荐方式：基于 Docker 的部署

Docker 部署方式提供最可靠和一致的运行环境。请严格按照以下步骤确保正确的构建顺序：

#### 构建说明

**重要提示：** 必须按顺序构建，以确保依赖关系正确解析。

```bash
# 步骤 1: 构建 Monitor 模块
docker build -t packetscope-analyzer-monitor:v1.0 ./Monitor/

# 步骤 2: 构建 Calculator 模块
docker build -t packetscope-analyzer-calculator:v1.0 ./Calculator/
```

#### 运行容器

两个模块都需要特定的运行时配置：

```bash
# 运行 Monitor 模块（端口 19999）
docker run --privileged --network host -p 19999:19999 packetscope:tracer

# 运行 Calculator 模块（端口 5000）
docker run --privileged --network host -p 5000:5000 packetscope:analyzer
```

**配置说明：**
- `--privileged`：加载 eBPF 程序和内核追踪所必需
- `--network host`：启用宿主机网络访问以获取完整流量可见性
  - 若不使用 host 网络模式，将只能捕获容器内部流量
- 端口映射：Monitor（19999）、Calculator（5000）

### 备选方式：手动安装

手动安装提供更大的灵活性，但需要仔细配置环境。

#### 安装步骤

1. **安装 BCC（BPF 编译器集合）**
   
   请参考官方安装指南：[BCC 安装文档](https://github.com/iovisor/bcc/blob/master/INSTALL.md)
   
   ⚠️ **兼容性警告：** 由于潜在的内核兼容性问题，不推荐在生产环境使用手动安装方式。BCC 无法保证在所有内核版本上的向下兼容性。

2. **安装 Python 依赖**
   
   进入各模块目录并安装依赖：
   ```bash
   # 安装 Monitor 依赖
   cd Monitor/
   sudo pip install -r requirements.txt
   
   # 安装 Calculator 依赖
   cd ../Calculator/
   sudo pip install -r requirements.txt
   ```

3. **启动模块**
   
   两个模块都必须以 root 权限运行：
   ```bash
   # 终端 1：启动 Monitor
   sudo su
   ulimit -n 65535
   python3 Monitor/flaskServerMain.py
   
   # 终端 2：启动 Calculator
   sudo python3 Calculator/monitor.py
   ```

---



## API 参考

### Monitor 接口


GET  /IsAttachFinished          - 验证启动状态
参数:GET方法，无参数
返回值：[True]或者[False]

GET  /GetRecentPacket             - 获取最近包信息
```
参数如下:srcip:源IP dstip:目的IP srcport:源端口 dstport:目的端口 limit:查询数量
应注意对IPV6式的IP,其格式并不采用标准ipv6格式,所用格式如下:
fe80:0000:0000:0000:0250:56ff:fec0:2222
返回值：形如[[包信息],[包信息],[包信息]]的数组,
IPV4型形若[(时间,网口号,方向,包长度,包内容,源地址,目的地址,源端口,目的端口,下层协议类型,IPID,TTL,分片信息,可选字段),]
IPV6型形若[(时间,网口号,方向,包长度,包内容,源地址,目的地址,头类型,源端口,目的端口),]
```

GET  /GetRecentMap             - 获取最近函数流信息
```
参数如下:srcip:源IP dstip:目的IP srcport:源端口 dstport:目的端口 limit:查询数量
应注意对IPV6式的IP,其格式并不采用标准ipv6格式,所用格式如下:
fe80:0000:0000:0000:0250:56ff:fec0:2222
返回值:形如[[函数调用链],[函数调用链],[函数调用链]]的数组
例如[[[1750773060.8924384, 0, 200007, 7489], [1750773060.89244, 0, 52954, 7489], [1750773060.8924415, 0, 52920, 7489]], [[1750773060.8924422, 1, 52920, 7489], [1750773060.8924434, 0, 52949, 7489]]]
```

GET /UnsetFilter         - 取消过滤器
```
参数：GET方法，无参数
返回值：无
```

GET /SetFilter          - 设置过滤器
```
参数:POST方法,参数如下:srcip:源IP dstip:目的IP srcport:源端口 dstport:目的端口 ipver:4/6
应注意对IPV6式的IP,其格式并不采用标准ipv6格式,所用格式如下:
fe80:0000:0000:0000:0250:56ff:fec0:2222
返回值：无
```

GET /ClearData          - 清理数据
```
参数：GET方法，无参数
返回值：无
```

GET /QuerySockList      - 获取套接字与网卡信息
```
参数：GET方法，无参数
返回值：形若
{"tcpipv4":[],"tcpipv6":[],"udpipv4":[],"udpipv6":[],"icmpipv4":[],"icmpipv6":[],"rawipv4":[],"rawipv6":[],"dev":[]}
的Dict
Socket数组内为为List,List成员为形若[当前时间,序号,源IP,目的IP,状态]的List
"dev"内为List,List成员为形若[当前时间,网口名]的List
应注意,提供的源IP和目的IP为HEX格式,即若8002A8C0:AA36式的,需通过简单转化变为可打印字符串.
```

### Calculator 接口


GET  /api/NumLatencyFrequency             - 获取当前指标

功能：统计指定五元组在链路层、网络层、传输层的数据包流动情况、丢包率、跨层延迟与跨层交互频率
请求示例：
```
{"type":"NumLatencyFrequency","params":{"ipv4":true,"ipv6":false,"sip":"192.168.126.128","dip":"103.143.17.156","sport":57892,"dport":443,"protocol":"tcp"}}
```
输出示例：
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

## 故障排查

### 常见问题

**权限被拒绝错误**
- 确保模块以 root 权限运行
- 验证内核配置中已启用 eBPF
- 验证debugfs等模块已挂载

**未捕获到数据包**
- 确认 Docker 使用了 `--network host` 参数
- 检查网络接口已启动且正在接收流量

**BCC 兼容性问题**
- 验证已安装内核头文件：`sudo apt-get install linux-headers-$(uname -r)`
- 查阅 BCC 兼容性矩阵以确认您的内核版本

**抓取函数列表缺失**
- 输入:`ulimit -n 65535`以扩大最大挂载点数量，此数字可以增大，通常而言不应小于内核有关函数总数的4倍。

**模块持续异常**
- 重启相应模块功能即可，多数情况是BCC有关代码未正常卸载导致。

## 致谢

感谢 BCC 提供的开源工具，Sqlite 提供的开源数据库功能