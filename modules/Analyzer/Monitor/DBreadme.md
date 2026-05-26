# PostgreSQL 安装与配置说明

## 1. PostgreSQL 安装

### Ubuntu/Debian 系统
```bash
# 更新包列表
sudo apt update

# 安装PostgreSQL
sudo apt install postgresql postgresql-contrib

# 启动PostgreSQL服务
sudo systemctl start postgresql

# 设置PostgreSQL服务开机自启
sudo systemctl enable postgresql
```

### CentOS/RHEL 系统
```bash
# 安装PostgreSQL
sudo yum install postgresql-server postgresql-contrib

# 初始化数据库
sudo postgresql-setup initdb

# 启动PostgreSQL服务
sudo systemctl start postgresql

# 设置PostgreSQL服务开机自启
sudo systemctl enable postgresql
```

### macOS 系统 (使用Homebrew)
```bash
# 安装PostgreSQL
brew install postgresql

# 启动PostgreSQL服务
brew services start postgresql
```

## 2. PostgreSQL 配置

### 2.1 创建用户

默认情况下，PostgreSQL创建了一个名为`postgres`的超级用户。我们需要为应用创建一个新用户。

```bash
# 切换到postgres用户
sudo -u postgres psql

# 创建新用户 (替换your_username为实际用户名)
CREATE USER your_username WITH PASSWORD 'your_password';

# 为用户授予创建数据库的权限
ALTER USER your_username CREATEDB;

# 退出PostgreSQL命令行
\q
```

### 2.2 创建数据库

使用刚刚创建的用户创建项目所需的数据库。

```bash
# 使用新用户登录PostgreSQL
psql -U your_username -h localhost

# 创建数据库 (项目需要两个数据库)
CREATE DATABASE functioninfo;
CREATE DATABASE tcxprober;

# 退出PostgreSQL命令行
\q
```

## 3. 项目配置

### 3.1 环境变量

项目支持通过环境变量配置PostgreSQL连接参数。以下是可用的环境变量：

| 环境变量 | 描述 | 默认值 |
|---------|------|-------|
| POSTGRES_HOST | PostgreSQL服务器地址 | localhost |
| POSTGRES_PORT | PostgreSQL服务器端口 | 5432 |
| POSTGRES_USER | PostgreSQL用户名 | postgres |
| POSTGRES_PASSWORD | PostgreSQL密码 | (空) |
| POSTGRES_DB | PostgreSQL数据库名 | functioninfo (kbatch程序) / tcxprober (tcxprober程序) |

### 3.2 示例环境变量配置

创建一个`.env`文件来存储环境变量（可选）：

```bash
# .env 文件内容
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
POSTGRES_DB=functioninfo
```

运行程序时，可以通过以下方式加载环境变量：

```bash
# Linux/macOS
source .env && ./batchattach

# Windows (PowerShell)
$env:POSTGRES_USER="your_username"; $env:POSTGRES_PASSWORD="your_password"; ./batchattach.exe
```

## 4. 项目依赖更新

### 4.1 Go 依赖

项目已经更新了`go.mod`文件，添加了PostgreSQL驱动依赖。运行以下命令下载依赖：

```bash
go mod tidy
```

### 4.2 Python 依赖

Python程序需要`psycopg2`库来连接PostgreSQL。运行以下命令安装：

```bash
pip install psycopg2-binary
```

## 5. 运行项目

### 5.1 运行Go程序

```bash
# 编译并运行kbatch程序
cd /home/p/桌面/Analyzer
make
./batchattach

# 或者直接运行tcxprober程序
cd /home/p/桌面/Analyzer/tcxprober
go run tcxProber.go
```

### 5.2 运行Python程序

```bash
cd /home/p/桌面/Analyzer/kbatch
python3 AttachAndRunProbers.py
```

## 6. 验证数据库连接

运行程序后，可以通过以下方式验证数据库连接和数据存储情况：

```bash
# 连接到数据库
psql -U your_username -h localhost functioninfo

# 查看表结构
\dt

# 查看表数据
SELECT * FROM functionCall LIMIT 10;
SELECT * FROM SpecfunctionCall LIMIT 10;

# 连接到tcxprober数据库
\c tcxprober

# 查看表结构
\dt

# 查看表数据
SELECT * FROM packets LIMIT 10;

# 退出PostgreSQL命令行
\q
```

## 7. 常见问题

### 7.1 无法连接到PostgreSQL服务器

- 确保PostgreSQL服务正在运行：`sudo systemctl status postgresql`
- 检查PostgreSQL是否允许远程连接：修改`/etc/postgresql/<version>/main/pg_hba.conf`文件
- 确保防火墙允许5432端口的连接

### 7.2 权限错误

- 确保使用的用户具有足够的权限访问数据库
- 检查数据库和表的所有权

### 7.3 数据类型错误

- 程序已经更新了数据类型，确保使用的是最新版本的代码
- 如果遇到数据类型不匹配的错误，检查PostgreSQL日志文件：`/var/log/postgresql/postgresql-<version>-main.log`

## 8. 注意事项

- 项目不再使用SQLite数据库，所有数据将存储在PostgreSQL中
- 默认情况下，PostgreSQL只允许本地连接，如果需要远程连接，请修改配置文件
- 建议为生产环境创建专门的数据库用户，并设置强密码
- 定期备份PostgreSQL数据库，以防止数据丢失
