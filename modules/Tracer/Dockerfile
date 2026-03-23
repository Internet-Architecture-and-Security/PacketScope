# 使用官方轻量级 Python 镜像
FROM python:3.11-slim

# 设置环境变量
ENV DEBIAN_FRONTEND=noninteractive \
    PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple \
    PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn

WORKDIR /app

# 配置 Debian 国内镜像源（阿里云）
RUN if [ -f /etc/apt/sources.list ] && [ -s /etc/apt/sources.list ]; then \
        sed -i 's@deb.debian.org@mirrors.aliyun.com@g' /etc/apt/sources.list && \
        sed -i 's@security.debian.org@mirrors.aliyun.com@g' /etc/apt/sources.list; \
    fi && \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -i 's@deb.debian.org@mirrors.aliyun.com@g' /etc/apt/sources.list.d/debian.sources && \
        sed -i 's@security.debian.org@mirrors.aliyun.com@g' /etc/apt/sources.list.d/debian.sources; \
    fi

# 安装必要工具和 nexttrace
RUN apt-get update && apt-get install -y curl wget && \
    # 下载 nexttrace
    echo "Downloading nexttrace" && \
    curl -sL nxtrace.org/nt | bash && \
    nexttrace -V || true && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 复制 Tracer 模块代码
COPY ./ /app

# 安装 Python 依赖（使用清华源）
RUN if [ -f requirements.txt ]; then \
        pip install --no-cache-dir -r requirements.txt \
            -i https://pypi.tuna.tsinghua.edu.cn/simple \
            --trusted-host pypi.tuna.tsinghua.edu.cn; \
    fi

# 暴露端口
EXPOSE 8000

# 设置入口
ENTRYPOINT ["python", "app/api/http_server.py"]
