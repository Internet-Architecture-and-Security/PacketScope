# 使用Ubuntu作为基础镜像（基于apt命令推测，可根据实际需求调整版本）
FROM packetscope-analyzer-monitor:v1.0

# 镜像元信息（可选）
LABEL maintainer="Your Name" \
      description="PacketScope IAS Environment"

SHELL ["/bin/bash", "-c"]

# 复制本地文件到容器（需确保构建上下文包含bcc-master和modules目录）
# 注意：若bcc-master需从源码编译，需提前将源码放置于构建上下文
# Step2: 配置bcc环境
# WORKDIR /bcc-master
WORKDIR /

COPY ./* /PacketScope-main/modules/Analyzer/
# Step3: 配置PacketScope依赖
# WORKDIR PacketScope-main/modules/Tracer
RUN pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple && \
    pip install -r PacketScope-main/modules/Analyzer/requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# WORKDIR PacketScope-main/modules/Analyzer 
# 设置默认工作目录
# WORKDIR PacketScope-main/modules/Tracer
CMD ["/bin/bash", "-c", "mount -t tracefs nodev /sys/kernel/tracing && mount -t debugfs none /sys/kernel/debug && ulimit -n 65535 && python3 PacketScope-main/modules/Analyzer/monitor.py"]

# 容器启动命令（根据实际需求补充，例如启动服务脚本）



# 注意：mount命令在Dockerfile构建阶段无法执行，需在容器运行时手动挂载
# 建议运行时通过--privileged参数及以下命令挂载：
# mount -t tracefs nodev /sys/kernel/tracing
# ulimit -n 65535
# python3 flaskServerMain.py