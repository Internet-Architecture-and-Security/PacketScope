> **📄 Note**: This document covers the legacy server's database setup. For current database configuration, see [../README.md](../README.md).

# PostgreSQL数据库安装与配置说明

## 1. 安装PostgreSQL

### Ubuntu/Debian系统
```bash
# 更新包列表
sudo apt update

# 安装PostgreSQL
sudo apt install postgresql postgresql-contrib

# 启动PostgreSQL服务
sudo systemctl start postgresql

# 设置开机自启
sudo systemctl enable postgresql
```

### CentOS/RHEL系统
```bash
# 安装PostgreSQL
sudo yum install postgresql-server postgresql-contrib

# 初始化数据库
sudo postgresql-setup initdb

# 启动PostgreSQL服务
sudo systemctl start postgresql

# 设置开机自启
sudo systemctl enable postgresql
```

### macOS系统
```bash
# 使用Homebrew安装
brew install postgresql

# 启动服务
brew services start postgresql
```

## 2. 创建数据库和用户

### 进入PostgreSQL命令行
```bash
sudo -u postgres psql
```

### 创建用户（可选）
```sql
-- 创建用户
CREATE USER qserver_user WITH PASSWORD 'your_password';

-- 授予权限
ALTER USER qserver_user CREATEDB;
```

### 创建数据库
```sql
-- 创建数据包数据库
CREATE DATABASE tcxprober;

-- 创建函数信息数据库
CREATE DATABASE functioninfo;

-- 授权用户访问数据库
GRANT ALL PRIVILEGES ON DATABASE tcxprober TO qserver_user;
GRANT ALL PRIVILEGES ON DATABASE functioninfo TO qserver_user;
```

### 退出PostgreSQL命令行
```sql\q
```

## 3. 创建表结构

### 连接到tcxprober数据库
```bash
sudo -u postgres psql -d tcxprober
```

### 创建IPv4数据包表
```sql
CREATE TABLE ipv4packets (
    id SERIAL PRIMARY KEY,
    time DOUBLE PRECISION NOT NULL,
    srcip VARCHAR(15) NOT NULL,
    dstip VARCHAR(15) NOT NULL,
    srcport INTEGER NOT NULL,
    dstport INTEGER NOT NULL,
    protocol VARCHAR(10),
    length INTEGER,
    content TEXT
);

-- 创建索引以提高查询性能
CREATE INDEX idx_ipv4packets_srcip_dstip_srcport_dstport ON ipv4packets(srcip, dstip, srcport, dstport);
CREATE INDEX idx_ipv4packets_time ON ipv4packets(time DESC);
```

### 创建IPv6数据包表
```sql
CREATE TABLE ipv6packets (
    id SERIAL PRIMARY KEY,
    time DOUBLE PRECISION NOT NULL,
    srcip VARCHAR(45) NOT NULL,
    dstip VARCHAR(45) NOT NULL,
    srcport INTEGER NOT NULL,
    dstport INTEGER NOT NULL,
    protocol VARCHAR(10),
    length INTEGER,
    content TEXT
);

-- 创建索引以提高查询性能
CREATE INDEX idx_ipv6packets_srcip_dstip_srcport_dstport ON ipv6packets(srcip, dstip, srcport, dstport);
CREATE INDEX idx_ipv6packets_time ON ipv6packets(time DESC);
```

### 连接到functioninfo数据库
```bash
sudo -u postgres psql -d functioninfo
```

### 创建SpecfunctionCall表
```sql
CREATE TABLE SpecfunctionCall (
    id SERIAL PRIMARY KEY,
    time DOUBLE PRECISION NOT NULL,
    PID INTEGER NOT NULL,
    srcip VARCHAR(45) NOT NULL,
    dstip VARCHAR(45) NOT NULL,
    srcport INTEGER NOT NULL,
    dstport INTEGER NOT NULL,
    function_name VARCHAR(100)
);

-- 创建索引
CREATE INDEX idx_specfunctioncall_pid ON SpecfunctionCall(PID);
CREATE INDEX idx_specfunctioncall_time ON SpecfunctionCall(time);
CREATE INDEX idx_specfunctioncall_srcip_dstip_srcport_dstport ON SpecfunctionCall(srcip, dstip, srcport, dstport);
```

### 创建functionCall表
```sql
CREATE TABLE functionCall (
    id SERIAL PRIMARY KEY,
    time DOUBLE PRECISION NOT NULL,
    PID INTEGER NOT NULL,
    isRet BOOLEAN NOT NULL,
    function_name VARCHAR(100),
    parameters TEXT
);

-- 创建索引
CREATE INDEX idx_functioncall_pid ON functionCall(PID);
CREATE INDEX idx_functioncall_time ON functionCall(time);
CREATE INDEX idx_functioncall_isret ON functionCall(isRet);
```

## 4. 配置环境变量

项目使用以下环境变量来配置PostgreSQL连接：

| 环境变量名 | 默认值 | 描述 |
|------------|--------|------|
| PG_HOST | localhost | PostgreSQL服务器地址 |
| PG_PORT | 5432 | PostgreSQL服务器端口 |
| PG_USER | postgres | 数据库用户名 |
| PG_PASSWORD | 空 | 数据库密码 |
| PG_DBNAME_PACKET | tcxprober | 数据包数据库名 |
| PG_DBNAME_FUNCTION | functioninfo | 函数信息数据库名 |
| PG_SSLMODE | disable | SSL连接模式 |

### 设置环境变量（临时）
```bash
export PG_HOST=localhost
export PG_PORT=5432
export PG_USER=postgres
export PG_PASSWORD=your_password
export PG_DBNAME_PACKET=tcxprober
export PG_DBNAME_FUNCTION=functioninfo
export PG_SSLMODE=disable
```

### 设置环境变量（永久）
将上述环境变量添加到`~/.bashrc`或`~/.profile`文件中，然后执行：
```bash
source ~/.bashrc
```

## 5. 运行项目

### 构建项目
```bash
go build
```

### 运行项目
```bash
./qserver
```

## 6. 验证数据库连接

项目启动后，可以通过访问以下API端点来验证数据库连接：

- 查询数据包：POST http://localhost:8010/QueryPacket
- 获取最近数据包：POST http://localhost:8010/GetRecentPacket
- 查询发送函数：POST http://localhost:8010/QueryFuncSend
- 查询接收函数：POST http://localhost:8010/QueryFuncRecv
- 获取最近映射：POST http://localhost:8010/GetRecentMap

## 7. 故障排除

### 连接失败
- 检查PostgreSQL服务是否正在运行
- 检查环境变量是否正确设置
- 检查数据库用户名和密码是否正确
- 检查数据库是否存在

### 查询无结果
- 检查表结构是否正确创建
- 检查是否有数据插入到表中
- 检查查询条件是否正确

## 8. 数据迁移（从SQLite3到PostgreSQL）

如果需要将现有SQLite3数据库中的数据迁移到PostgreSQL，可以使用以下工具：

1. **pgloader**
   ```bash
   # 安装pgloader
sudo apt install pgloader

# 迁移数据包数据库
pgloader sqlite://./.cache/PacketInfo.db postgresql://qserver_user:your_password@localhost/tcxprober

# 迁移函数信息数据库
pgloader sqlite://./.cache/FunctionInfo.db postgresql://qserver_user:your_password@localhost/functioninfo
   ```

注意：迁移前请备份SQLite3数据库文件。