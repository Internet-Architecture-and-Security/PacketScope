# 使用Ubuntu作为基础镜像（基于apt命令推测，可根据实际需求调整版本）
FROM dockerpa2025/packetscope:v1

# 镜像元信息（可选）
LABEL maintainer="Your Name" \
      description="PacketScope IAS Environment"

SHELL ["/bin/bash", "-c"]


# Step0: 配置基础环境并安装node.js（Step0+Step1合并，减少镜像层数）
RUN apt-get update && \
    # Step1: 安装curl及node.js依赖
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    # 清理apt缓存，减小镜像体积
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 复制本地文件到容器（需确保构建上下文包含bcc-master和modules目录）
# 注意：若bcc-master需从源码编译，需提前将源码放置于构建上下文

# Step2: 配置bcc环境
# WORKDIR /bcc-master
WORKDIR /
RUN cd ./bcc-master && apt-get update && \
    # 安装bcc编译依赖
    apt-get install -y zip bison build-essential cmake flex git libedit-dev \
    libllvm14 llvm-14-dev libclang-14-dev python3 zlib1g-dev libelf-dev \
    libfl-dev python3-setuptools liblzma-dev libdebuginfod-dev arping netperf \
    iperf python3-pip linux-tools-$(uname -r) iproute2 linux-headers-$(uname -r) && \
    # 创建构建目录并编译安装bcc
    mkdir ./build && cd ./build && \
    cmake .. && make && make install && \
    # 配置Python3支持
    cmake -DPYTHON_CMD=python3 .. && \
    pushd src/python/ && make && make install && popd && \
    # 清理apt缓存
    apt-get clean && rm -rf /var/lib/apt/lists/* 

    
COPY ./* /PacketScope-main/modules/Tracer/
# Step3: 配置PacketScope依赖
# WORKDIR PacketScope-main/modules/Tracer
RUN pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple && \
    pip install -r PacketScope-main/modules/Tracer/requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
# WORKDIR PacketScope-main/modules/Analyzer 
# 设置默认工作目录
# WORKDIR PacketScope-main/modules/Tracer
CMD ["/bin/bash", "-c", "mount -t tracefs nodev /sys/kernel/tracing && ulimit -n 65535 && python3 PacketScope-main/modules/Tracer/flaskServerMain.py"]

# 容器启动命令（根据实际需求补充，例如启动服务脚本）



# 注意：mount命令在Dockerfile构建阶段无法执行，需在容器运行时手动挂载
# 建议运行时通过--privileged参数及以下命令挂载：
# mount -t tracefs nodev /sys/kernel/tracing
# ulimit -n 65535
# python3 flaskServerMain.py