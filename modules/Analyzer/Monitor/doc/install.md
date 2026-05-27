# Monitor 模块安装指南

本文档拆解 Monitor 模块的完整安装步骤。

## 环境要求

- 具有 sudo 权限的用户

## 安装步骤

### 1. 设置环境变量

```bash
export CGO_ENABLED=1
```

### 2. 配置 Go 代理（国内用户推荐）

```bash
export GOPROXY=https://goproxy.cn,direct
export GOSUMDB=sum.golang.google.cn
```

### 3. 安装系统依赖

```bash
sudo apt-get update && sudo apt-get install -y \
    curl \
    wget \
    git \
    make \
    cmake \
    build-essential \
    golang-go \
    gcc \
    g++ \
    clang \
    llvm \
    libbpf-dev \
    linux-headers-generic \
    linux-tools-generic \
    linux-tools-common \
    bpfcc-tools \
    libbpf-tools \
    iproute2 \
    net-tools \
    tcpdump \
    libelf-dev \
    zlib1g-dev \
    pkg-config
```

### 4. 验证 Go 安装

```bash
go version
```

### 5. 克隆项目代码

```bash
git clone <repository-url> /Monitor
cd /Monitor
```

### 6. 安装项目依赖

```bash
go mod tidy
```

### 7. 下载 Go 依赖

```bash
go mod download
```

### 8. 安装 bpf2go 工具

```bash
go install github.com/cilium/ebpf/cmd/bpf2go@latest
```

### 9. 安装 PostgreSQL 客户端

```bash
sudo apt-get update && sudo apt-get install -y postgresql-client
```

### 10. 配置 PostgreSQL 环境变量

```bash
export PG_HOST=localhost
export PG_PORT=5432
export PG_USER=postgres
export PG_PASSWORD=password
export PG_DBNAME_PACKET=tcxprober
export PG_DBNAME_FUNCTION=functioninfo
export PG_SSLMODE=disable
```

### 11. 启动 PostgreSQL 服务

```bash
sudo service postgresql start
```

### 12. 配置 PostgreSQL 用户权限

```bash
psql -h $PG_HOST -p $PG_PORT -U $PG_USER -c "ALTER USER $PG_USER WITH PASSWORD '$PG_PASSWORD';"
```

### 13. 创建 PostgreSQL 数据库

```bash
createdb -h $PG_HOST -p $PG_PORT -U $PG_USER $PG_DBNAME_PACKET
createdb -h $PG_HOST -p $PG_PORT -U $PG_USER $PG_DBNAME_FUNCTION
```

### 14. 编译模块

```bash
make prepare && make && make server
```

### 15. 启动服务

```bash
./analyzer ./qserver
```

## 环境变量说明

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| PG_HOST | localhost | PostgreSQL 主机地址 |
| PG_PORT | 5432 | PostgreSQL 端口 |
| PG_USER | postgres | PostgreSQL 用户名 |
| PG_PASSWORD | password | PostgreSQL 密码 |
| PG_DBNAME_PACKET | tcxprober | 数据包数据库名称 |
| PG_DBNAME_FUNCTION | functioninfo | 函数信息数据库名称 |
| PG_SSLMODE | disable | SSL 连接模式 |
| GOPROXY | https://goproxy.cn,direct | Go 模块代理 |
| GOSUMDB | sum.golang.google.cn | Go 校验和数据库 |

## 注意事项

1. 确保系统已安装最新的 Linux 内核头文件
2. eBPF 功能需要 Linux 内核 4.15+ 版本支持
3. 建议在 Ubuntu 24.04 环境下执行安装
4. 首次编译可能需要较长时间，请耐心等待