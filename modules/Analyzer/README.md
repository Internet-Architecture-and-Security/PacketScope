# PacketScope Analyzer 模块

## 概述

Analyzer 模块是PacketScope的一个部件，可深入洞察 Linux 内核网络栈中的数据包处理过程。该系统由 **Monitor（监控器）** 和 **Calculator（计算器）** 两个核心组件构成，协同工作以实现网络流量在内核各层的捕获、追踪和分析。

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
docker build -t packetscope:tracer ./Monitor/

# 步骤 2: 构建 Calculator 模块
docker build -t packetscope:analyzer ./Calculator/
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
   sudo python3 Monitor/flaskServerMain.py
   
   # 终端 2：启动 Calculator
   sudo python3 Calculator/monitor.py
   ```

---

## 架构与功能

### Monitor 组件

Monitor 组件作为数据采集层，负责实时数据包捕获和内核级追踪。

**核心能力：**

- **网络接口发现**：查询系统网络接口和套接字信息
- **流量拦截**：利用 TCX（Traffic Control eXpress）钩子捕获通过网络接口的数据包
- **内核函数追踪**：采用 kprobe 技术监控内核函数调用
- **调用图构建**：构建以数据包为中心的函数调用图，展现每个数据包在网络栈中的完整路径

**技术实现：**
- 在关键内核挂载点附加 eBPF 程序
- 最小性能开销的实时数据采集
- 结构化数据存储以支持下游分析

### Calculator 组件

Calculator 组件提供分析和度量层，处理捕获的数据并提取可操作的洞察。

**核心能力：**

- **网络栈分析**：监控数据包流经 OSI 各层和 Linux 网络子系统的过程
- **性能指标**：计算吞吐量、延迟和数据包处理速率
- **丢包检测**：识别并量化各层级的数据包丢失情况
- **流量特征分析**：分析流量模式和连接状态

**分析特性：**
- 实时指标聚合
- 历史趋势分析
- 异常检测能力

---


## 代码架构

### Monitor 模块结构

Monitor 代码库分为五个功能域：

#### 1. 套接字信息获取
**文件：** `ListSockets.py`

与 Linux 内核 API 交互以提取：
- 活跃网络接口配置
- 打开的套接字描述符及其状态
- 连接元数据（本地/远程地址、端口、协议）

#### 2. 数据包捕获子系统
**文件：** `TcxProber.py`、`tcxProber.c`

实现基于 TCX 的数据包拦截：
- 在网络接口钩子上附加 eBPF 程序
- 捕获双向流量（入站/出站）
- 执行初步的数据包分类和过滤
- 提取数据包头和元数据

#### 3. 内核信息处理
**文件：** `ReadBTFandGetItsMember.py`、`translateJSON.py`

处理内核调试信息：
- 解析 BTF（BPF 类型格式）数据以枚举内核函数
- 识别与`sk_buff` 相关的数据包处理关键函数
- 应用语义过滤选择网络相关函数
- 为动态函数追踪生成插桩代码

#### 4. 函数调用监控
**文件：** `AttachAndRunProbers.py`

编排动态追踪：
- 将 kprobe 附加到已识别的内核函数
- 捕获带时序信息的函数进入/退出事件
- 关联函数调用与数据包标识符
- 将调用追踪数据持久化到数据库

#### 5. API 与数据访问层
**文件：** 其他

提供外部接口：
- 用于数据检索的 Flask API
- 数据库查询接口
- 数据导出功能

### Calculator 模块结构

Calculator 组件实现分析算法和指标计算：

- **指标引擎**：将原始追踪数据聚合为统计摘要
- **流分析器**：追踪连接生命周期和状态转换
- **丢包检测器**：通过调用图分析识别数据包丢失
- **性能监视器**：计算延迟分布和吞吐量指标

---

## API 参考

### Monitor 接口

```
GET  /IsAttachFinished          - 验证启动状态
GET  /GetRecentPacket             - 获取最近包信息
GET  /GetRecentMap             - 获取最近函数流信息
GET /UnsetFilter         - 取消过滤器
GET /SetFilter          - 设置过滤器
GET /ClearData          - 清理数据
GET /QuerySockList      - 获取套接字与网卡信息

```

### Calculator 接口

```
GET  /api/NumLatencyFrequency             - 获取当前指标

```

---

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
