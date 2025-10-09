# Analyzer模块介绍

## 安装说明

本节主要介绍Analyzer模块的安装过程。

### 通过构建Docker运行本模块（推荐）

请先Build Monitor 模块获取可用Docker，再Build ProtocolStack模块，顺序不宜颠倒。

docker build -t packetscope:tracer ./Monitor/

docker build -t packetscope:analyzer ./ProtocolStack/

#### Docker 运行说明

一般而言，docker运行需要启用特权模式（--privileged）并启用端口映射，Monitor模块映射在19999端口上，而ProtocolStack映射在5000端口上，并应注意，为使Docker可捕捉宿主机网络，应启用host网络映射模式，不然，则仅捕捉Docker内部网络。

### 通过手动Build运行此模块

通过手动build运行此模块，首先应安装BCC，安装流程请参考（https://github.com/iovisor/bcc/blob/master/INSTALL.md）。因存在潜在的兼容性问题，开发者不能保证BCC拥有足够的下兼容能力，不推荐此类安装方法。然后在root环境下分别安装两个模块内的python依赖（requirements.txt），最后分别运行flaskServerMain.py（Monitor）和monitor.py（ProtocolStack）。

## 功能说明

本模块主要分为Monitor和ProtocolStack两个组件，其相应主要功能如下：

### Monitor

Monitor模块主要负责从系统内获取网卡与套接字信息，通过TCX机制捕捉通过网卡的流量，以及用kprobe获取内核种各个函数的调用情况，并将其组织为以包为核心的函数调用网络。

### ProtocolStack

ProtocolStack模块主要负责监视网络流通过各级网络栈的状况，监听流量通过频率，丢包率等各个重要信息，获取当前流量状态。

## 代码说明

### Monitor

Monitor代码可分为5个部分，获取套接字信息，获取包信息，内核信息处理，监听函数调用和响应外部调用。

ListSockets.py提供获取套接字信息的功能，通过Linux内核调用获取当前网卡信息，套接字信息等必要的网络信息。

TcxProber.py和