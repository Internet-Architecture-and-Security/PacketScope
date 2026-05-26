# 配置国内 Go 代理
FROM ubuntu:24.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV CGO_ENABLED=1

# Go proxy configuration (can be overridden at build time)
# ARG GOPROXY=https://proxy.golang.org,direct
# ARG GOSUMDB=sum.golang.org
# ENV GOPROXY=${GOPROXY}
# ENV GOSUMDB=${GOSUMDB}
# 配置 Go 代理
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=sum.golang.google.cn
# ARG GOSUMDB=sum.golang.org
# ENV GOPROXY=${GOPROXY}
# ENV GOSUMDB=${GOSUMDB}

# Keep default Ubuntu sources (no mirror changes for other dependencies)

# Update package lists and install system dependencies
RUN apt-get update && apt-get install -y \
    # Basic tools
    curl \
    wget \
    git \
    make \
    build-essential \
    # Go programming language
    golang-go \
    # C/C++ development
    gcc \
    g++ \
    clang \
    llvm \
    # eBPF/XDP dependencies
    libbpf-dev \
    linux-headers-generic \
    linux-tools-generic \
    linux-tools-common \
    # Additional eBPF tools
    bpfcc-tools \
    libbpf-tools \
    # Network tools
    iproute2 \
    net-tools \
    tcpdump \
    # Development libraries
    libelf-dev \
    zlib1g-dev \
    pkg-config \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Verify Go installation
RUN go version

# 复制模块代码到容器中
COPY . /Monitor

WORKDIR /Monitor   

# 安装项目依赖
RUN go mod tidy

# 通过make编译模块


# Download Go dependencies
RUN go mod download

# Install bpf2go tool for eBPF code generation
RUN go install github.com/cilium/ebpf/cmd/bpf2go@latest

# 安装PostgreSQL客户端
RUN apt-get update && apt-get install -y postgresql-client

# 配置 PostgreSQL 环境变量
ENV PG_HOST=localhost \
    PG_PORT=5432 \
    PG_USER=postgres \
    PG_PASSWORD=password \
    PG_DBNAME_PACKET=tcxprober \
    PG_DBNAME_FUNCTION=functioninfo \
    PG_SSLMODE=disable

# 启动PostgreSQL服务
RUN service postgresql start

# 保证PostgreSQL的正常运行，配置用户权限
RUN psql -h $PG_HOST -p $PG_PORT -U $PG_USER -c "ALTER USER $PG_USER WITH PASSWORD '$PG_PASSWORD';"

# 创建PostgreSQL数据库
RUN createdb -h $PG_HOST -p $PG_PORT -U $PG_USER $PG_DBNAME_PACKET
RUN createdb -h $PG_HOST -p $PG_PORT -U $PG_USER $PG_DBNAME_FUNCTION

# make 编译模块
RUN make prepare && make && make server

# 先后启动 analyzer 和 qserver
CMD ["./analyzer", "./qserver"]
