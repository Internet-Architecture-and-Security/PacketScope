# Tracer 模块说明

本模块用于进行Analyzer模块的前端操作。

## 安装

本模块可通过Docker安装，运行docker，请执行以下命令：

docker build .

请自行命名与标记您的docker信息，不要直接复制。

docker run --privileged -p 19999:19999 --name your_docker_name your_configured_tag


手动安装流程如下：

1. 安装BCC

本模块依赖的BCC版本为

https://github.com/iovisor/bcc/tree/2b73f76eab440111a717f53290636f8233f15306

请按此版本安装BCC，其它版本BCC不保证可正常运行，如需适配高版本，请向我们提出issue

2. 安装python依赖，请注意，此环境应与BCC位于同一python环境重
cd ../Analyzer
pip install -r ./requirements.txt

3. 配置必要当前运行环境，仅能以root权限运行。

ulimit -n 65535

4. 执行代码

python flaskServer.py

或使用启动脚本，警告，此脚本不保证可以单独运行！

sudo ./start.sh

## 📦 依赖

本模块依赖[ BCC (BPF Compiler Collection)](https://github.com/iovisor/bcc)，用于基于 eBPF 的内核态数据采集。请先根据官方说明安装系统级依赖：

👉 安装 BCC：请参考官方文档 [INSTALL.md](https://github.com/iovisor/bcc/blob/master/INSTALL.md)

安装 Python 环境和依赖：
```bash

# 安装 Python 依赖，应保证运行pip install的环境与bcc所在python环境相同，保证bcc所在环境和依赖处于同一环境下
pip install -r requirements.txt

```

## 🚀 运行
运行脚本前需具有管理员权限，并确保系统支持 eBPF（Linux 内核 ≥ 6.8）：

```bash
# 切换为 root 用户
sudo su

# 切换为 root 用户

su

# 以 root 权限执行（请在root权限下使用，sudo无此指令）
ulimit -n 65535

# 启动监控脚本
python flaskServer.py

# 或使用启动脚本
sudo ./start.sh

```

脚本将会在本地启动一个 HTTP 服务，监听端口 19999。

本模块运行一个服务器，捕捉通过负载机的流量，服务器提供若干个API，可用于提供经处理的数据。

## 接口列表

### /QuerySockList

参数：GET方法，无参数

返回值：形若
{"tcpipv4":[],"tcpipv6":[],"udpipv4":[],"udpipv6":[],"icmpipv4":[],"icmpipv6":[],"rawipv4":[],"rawipv6":[],"dev":[]}
的Dict

Socket数组内为为List,List成员为形若[当前时间,序号,源IP,目的IP,状态]的List

"dev"内为List,List成员为形若[当前时间,网口名]的List

应注意,提供的源IP和目的IP为HEX格式,即若8002A8C0:AA36式的,需通过简单转化变为可打印字符串.

### /GetFuncTable

参数：GET方法，无参数

返回值：形若
{"ID":{"name":函数名}}
的Dict

### /QueryPacket

参数:POST方法,参数如下

srcip:源IP

dstip:目的IP

srcport:源端口

dstport:目的端口

ipver:4/6

应注意:
对IPV6式的IP,其格式并不采用标准ipv6格式,所用格式如下:
fe80:0000:0000:0000:0250:56ff:fec0:2222

并未采用标准格式中的缩略规则

返回值:

IPV4型形若

[(时间,网口号,方向,包长度,包内容,源地址,目的地址,源端口,目的端口,下层协议类型,IPID,TTL,分片信息,可选字段),]

IPV6型形若

[(时间,网口号,方向,包长度,包内容,源地址,目的地址,头类型,源端口,目的端口),]

方向:0为入包,1为出包

### /QueryFuncSend 和 /QueryFuncRecv

参数:POST方法,参数如下

srcip:源IP

dstip:目的IP

srcport:源端口

dstport:目的端口

应注意:
对IPV6式的IP,其格式并不采用标准ipv6格式,所用格式如下:
fe80:0000:0000:0000:0250:56ff:fec0:2222

并未采用标准格式中的缩略规则

返回值:

形如
[[(时间,是否为函数返回,ID号,调用的线程号),],[],]
的List.

ID号通过GetFuncTable获取向函数名的映射表.不采用直接存储函数名,是为了减少存储的数据量.


[[[1750773060.8924384, 0, 200007, 7489], [1750773060.89244, 0, 52954, 7489], [1750773060.8924415, 0, 52920, 7489]], [[1750773060.8924422, 1, 52920, 7489], [1750773060.8924434, 0, 52949, 7489]]]
## 运行

```

```

sudo -E /home/ubuntu/packetscope-web-app/modules/monitor/.venv/bin/python flaskServerMain.py
