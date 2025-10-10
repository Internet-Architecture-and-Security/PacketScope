# Analyzer 模块说明

本模块通过 HTTP API 接口实现协议栈中分组数据流动数量、延迟、跨层交互频率、丢包等多维度信息的实时统计。

## 📦 依赖

本模块依赖[ BCC (BPF Compiler Collection)](https://github.com/iovisor/bcc)，用于基于 eBPF 的内核态数据采集。请先根据官方说明安装系统级依赖：

👉 安装 BCC：请参考官方文档 [INSTALL.md](https://github.com/iovisor/bcc/blob/master/INSTALL.md)

安装 Python 环境和依赖：
```bash

sudo su

# 安装 Python 依赖
pip install -r requirements.txt

```

## 🚀 运行
运行脚本前需具有管理员权限，并确保系统支持 eBPF（Linux 内核 ≥ 6.8）：

```bash
# 切换为 root 用户（或使用 sudo）
sudo -s

# 启动监控脚本
python monitor.py

```

脚本将会在本地启动一个 HTTP 服务，监听端口 5000，用于展示或导出监控数据。

## 接口列表

### /api/NumLatencyFrequency

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

返回值说明：

```
1）
"crosslayer": "linknetwork",表示"链路层与网络层"之间的交互情况；
"direction": "send",表示发包情况，
"type": "ipv4", 表示协议是ipv4还是ipv6
"pid": -1, 表示线程id,若为-1,则表示当前五元组无丢包情况
"pid_name": "Socket Thread", 表示线程名称，
"saddr": "192.168.126.128", 
"daddr": "103.143.17.156", 
"sport": 57892,
"dport": 443,

"LAT(ms)": 0.01,  表示给定五元组，数据包从网络层到链路层的延时时间，单位ms  
"frequency(s)": 35.3051937862859,   表示给定五元组，数据包从网络层到链路层的交互频率，单位s  

2）
"crosslayer": "linknetwork",表示"链路层与网络层"之间的交互情况；
"direction": "receive",表示收包情况，

其余字段含义同上，注意：
"LAT(ms)": 0.099,  表示给定五元组，数据包从链路层到网络层的延时时间，单位ms  
"frequency(s)": 35.303..,   表示给定五元组，数据包从链路层到网络层的交互频率，单位s  

3）
"crosslayer": "networktrans",表示"网络层与传输层"之间的交互情况；
"direction": "send",表示发包情况，

其余字段含义同上，注意：
"LAT(ms)": 0,  表示给定五元组，数据包从传输层到网络层的延时时间，单位ms  
"frequency(s)": 0,   表示给定五元组，数据包从传输层到网络层的交互频率，单位s  

4）
"crosslayer": "networktrans",表示"网络层与传输层"之间的交互情况；
"direction": "receive",表示收包情况，

其余字段含义同上，注意：
"LAT(ms)": 0,  表示给定五元组，数据包从网络层到传输层的延时时间，单位ms  
"frequency(s)": 0,   表示给定五元组，数据包从网络层到传输层的交互频率，单位s  

5）
"crosslayer": "linktrans",表示"链路与传输层"之间的交互情况；
"direction": "send",表示发包情况，

其余字段含义同上，注意：
"LAT(ms)": 0,  表示给定五元组，数据包从传输层到链路层的延时时间，单位ms  
"frequency(s)": 0,   表示给定五元组，数据包从传输层到链路层的交互频率，单位s

6）
"crosslayer": "linktrans",表示"链路与传输层"之间的交互情况；
"direction": "receive",表示收包情况，

其余字段含义同上，注意：
"LAT(ms)": 0.308,  表示给定五元组，数据包从链路层到传输层的延时时间，单位ms  
"frequency(s)": 35.305...,   表示给定五元组，数据包从链路层到传输层的交互频率，单位s
  
7）
"layer": "trans",表示"传输层数据包数量"；
"direction": "send",表示发包

其余字段含义同上，注意：
"num":2,  表示给定五元组，传输层处理的数据包数目  
"pps(s)": 2.42...,   表示给定五元组，传输层处理的数据包的频率，单位为s 

8)
"layer": "trans",表示"传输层数据包数量"；
"direction": "receive",表示发包

其余字段含义同上，注意：
"num":35  表示给定五元组，传输层处理的数据包数目  
"pps(s)": 35.30...,   表示给定五元组，传输层处理的数据包的频率，单位为s 
  
9)
"layer": "network",表示"网络层数据包数量"；
"direction": "send",表示发包

其余字段含义同上，注意：
"num":2,  表示给定五元组，网络层处理的数据包数目  
"pps(s)": 2.42...,   表示给定五元组，网络层处理的数据包的频率，单位为s 

10)
"layer": "network",表示"网络层数据包数量"；
"direction": "receive",表示发包

其余字段含义同上，注意：
"num":35  表示给定五元组，网络层处理的数据包数目  
"pps(s)": 35.30...,   表示给定五元组，网络层处理的数据包的频率，单位为s 
  
11)
"layer": "link",表示"链路层数据包数量"；
"direction": "send",表示发包

其余字段含义同上，注意：
"num":2,  表示给定五元组，链路层处理的数据包数目  
"pps(s)": 2.42...,   表示给定五元组，链路层处理的数据包的频率，单位为s 

12)
"layer": "link",表示"链路层数据包数量"；
"direction": "receive",表示发包

其余字段含义同上，注意：
"num":35  表示给定五元组，链路层处理的数据包数目  
"pps(s)": 35.30...,   表示给定五元组，链路层处理的数据包的频率，单位为s   
  

13)
其余字段含义同上，注意：
"drops(s)": 1.20...,   表示给定五元组，tcp的丢包率，单位为s
```


{"type": "NumLatencyFrequency", "data": "{\"layer\": \"link\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": -1, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"num\": 0, \"pps(s)\": 0}"}

{"type": "NumLatencyFrequency", "data": "{\"layer\": \"network\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": -1, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"num\": 0, \"pps(s)\": 0}"}

{"type": "NumLatencyFrequency", "data": "{\"layer\": \"trans\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": -1, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"num\": 0, \"pps(s)\": 0}"}

{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"linknetwork\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": -1, \"pid_name\": \"NULL\", \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"LAT(ms)\": 0, \"frequency(s)\": 0}"}

{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"networktrans\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": -1, \"pid_name\": \"NULL\", \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"LAT(ms)\": 0, \"frequency(s)\": 0}"}

{"type": "NumLatencyFrequency", "data": "{\"crosslayer\": \"linktrans\", \"direction\": \"receive\", \"type\": \"ipv4\", \"pid\": -1, \"pid_name\": \"NULL\", \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"LAT(ms)\": 0, \"frequency(s)\": 0}"}

{"type": "NumLatencyFrequency", "data": "{\"type\": \"ipv4\", \"pid\": -1, \"saddr\": \"103.143.17.156\", \"daddr\": \"192.168.126.128\", \"sport\": 443, \"dport\": 57892, \"drop(s)\": 0}"}