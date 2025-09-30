# 使用官方轻量级 Python 镜像
FROM python:3.11-slim

WORKDIR /app

# 安装必要工具和 nexttrace
RUN apt-get update && apt-get install -y curl && \
    curl -sL nxtrace.org/nt | bash && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 复制 Locator 模块代码
COPY ./ /app

# 暴露端口
EXPOSE 8000

# 安装 Python 依赖
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

# 设置入口
ENTRYPOINT ["python", "backend.py"]
