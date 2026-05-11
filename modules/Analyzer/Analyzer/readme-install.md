Analyzer - PacketScope 网络分析模块

## 安装方法

### 1. 系统依赖安装

#### Ubuntu/Debian 系统

```bash
# 安装 Go 1.25+ (如果未安装)
wget https://go.dev/dl/go1.25.5.linux-amd64.tar.gz
sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.25.5.linux-amd64.tar.gz

# 安装 clang/llvm (用于 BPF 编译)
sudo apt-get update
sudo apt-get install -y clang llvm libbpf-dev

# 安装 Linux 内核头文件
sudo apt-get install -y linux-headers-$(uname -r)
```

#### CentOS/RHEL 系统

```bash
# 安装 Go 1.25+
wget https://go.dev/dl/go1.25.5.linux-amd64.tar.gz
sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.25.5.linux-amd64.tar.gz

# 安装 clang/llvm
sudo yum install -y clang llvm bpftool

# 安装内核头文件
sudo yum install -y kernel-devel-$(uname -r)
```

### 2. 环境变量配置

```bash
# 将 Go 添加到 PATH
echo "export PATH=\$PATH:/usr/local/go/bin" >> ~/.bashrc
echo "export GOPATH=\$HOME/go" >> ~/.bashrc
source ~/.bashrc
```

### 3. 项目依赖安装

```bash
# 进入项目目录
cd .\Analyzer

# 安装 Go 模块依赖
go mod tidy
```

### 4. 编译项目

```bash
# 编译基础工具
make prepare

# 编译 BPF 程序和主程序
make all

# 或仅编译主分析器
make analyzer

# 编译服务器
make server
```

### 5. Python 测试依赖（可选）

```bash
# 安装测试依赖
pip install -r test/requirements.txt
```

### 6. 数据库配置与安装

项目使用 PostgreSQL 数据库存储数据包和函数调用信息。

#### 6.1 安装 PostgreSQL

**Ubuntu/Debian 系统**

```bash
# 更新包列表
sudo apt update

# 安装 PostgreSQL
sudo apt install postgresql postgresql-contrib

# 启动服务
sudo systemctl start postgresql

# 设置开机自启
sudo systemctl enable postgresql
```

**CentOS/RHEL 系统**

```bash
# 安装 PostgreSQL
sudo yum install postgresql-server postgresql-contrib

# 初始化数据库
sudo postgresql-setup initdb

# 启动服务
sudo systemctl start postgresql

# 设置开机自启
sudo systemctl enable postgresql
```

#### 6.2 创建数据库和用户

```bash
# 进入 PostgreSQL 命令行
sudo -u postgres psql
```

```sql
-- 创建用户（可选）
CREATE USER qserver_user WITH PASSWORD 'your_password';
ALTER USER qserver_user CREATEDB;

-- 创建数据包数据库
CREATE DATABASE packetinfo;

-- 创建函数信息数据库
CREATE DATABASE functioninfo;

-- 授权用户访问
GRANT ALL PRIVILEGES ON DATABASE packetinfo TO qserver_user;
GRANT ALL PRIVILEGES ON DATABASE functioninfo TO qserver_user;

-- 退出
\q
```
#### 6.3 配置数据库环境变量

```bash
# 设置数据库连接环境变量（临时）
export PG_HOST=localhost
export PG_PORT=5432
export PG_USER=postgres
export PG_PASSWORD=your_password
export PG_DBNAME_PACKET=packetinfo
export PG_DBNAME_FUNCTION=functioninfo
export PG_SSLMODE=disable
```

```bash
# 设置数据库连接环境变量（永久，添加到 ~/.bashrc）
echo "export PG_HOST=localhost" >> ~/.bashrc
echo "export PG_PORT=5432" >> ~/.bashrc
echo "export PG_USER=postgres" >> ~/.bashrc
echo "export PG_PASSWORD=your_password" >> ~/.bashrc
echo "export PG_DBNAME_PACKET=packetinfo" >> ~/.bashrc
echo "export PG_DBNAME_FUNCTION=functioninfo" >> ~/.bashrc
echo "export PG_SSLMODE=disable" >> ~/.bashrc
source ~/.bashrc
```

| 环境变量名 | 默认值 | 描述 |
|------------|--------|------|
| PG_HOST | localhost | PostgreSQL 服务器地址 |
| PG_PORT | 5432 | PostgreSQL 服务器端口 |
| PG_USER | postgres | 数据库用户名 |
| PG_PASSWORD | 空 | 数据库密码 |
| PG_DBNAME_PACKET | packetinfo | 数据包数据库名 |
| PG_DBNAME_FUNCTION | functioninfo | 函数信息数据库名 |
| PG_SSLMODE | disable | SSL 连接模式 |

## 项目结构

```
Analyzer/
├── base/          # 基础工具模块
├── kbatch/        # BPF kbatch 模块
├── server/        # 服务器模块
├── tcxprober/     # BPF 探针模块
├── test/          # Python 测试模块
├── util/          # 工具函数
├── main.go        # 主程序入口
└── Makefile       # 编译脚本
```

## 运行方式

```bash
# 运行主分析器
./analyzer

# 运行服务器
./qserver
```

## 清理

```bash
make clean
```
