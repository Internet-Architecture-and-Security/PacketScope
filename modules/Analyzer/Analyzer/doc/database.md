# PostgreSQL 配置方法

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

## 2. 创建初始用户和配置密码

默认情况下，PostgreSQL会创建一个名为`postgres`的超级用户。我们需要为这个用户设置密码。

```bash
# 以postgres用户身份登录PostgreSQL
sudo -u postgres psql

# 为postgres用户设置密码
ALTER USER postgres WITH PASSWORD 'your_password';

# 退出PostgreSQL命令行
\q
```

## 3. 创建所需的数据库

项目需要两个数据库：
- `functioninfo`：供kbatch模块使用
- `tcxprober`：供tcxprober模块使用

```bash
# 以postgres用户身份登录PostgreSQL
sudo -u postgres psql

# 创建functioninfo数据库
CREATE DATABASE functioninfo;

# 创建tcxprober数据库
CREATE DATABASE tcxprober;

# 退出PostgreSQL命令行
\q
```

## 4. 调用Analyzer时应提供的必要参数

Analyzer程序支持通过环境变量配置PostgreSQL连接参数。以下是可用的环境变量：

| 环境变量 | 描述 | 默认值 |
|---------|------|-------|
| POSTGRES_HOST | PostgreSQL服务器地址 | localhost |
| POSTGRES_PORT | PostgreSQL服务器端口 | 5432 |
| POSTGRES_USER | PostgreSQL用户名 | postgres |
| POSTGRES_PASSWORD | PostgreSQL密码 | 空字符串 |
| POSTGRES_DB | PostgreSQL数据库名 | functioninfo |

### 4.1 运行Analyzer的方法

#### 方法一：直接在命令行中设置环境变量

```bash
# 设置PostgreSQL密码并运行Analyzer
sudo -E bash -c "POSTGRES_PASSWORD=your_password ./analyzer"
```

#### 方法二：创建.env文件

创建一个包含环境变量的`.env`文件：

```bash
# .env 文件内容
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=functioninfo
```

然后运行Analyzer：

```bash
# 加载环境变量并运行Analyzer
source .env && sudo -E ./analyzer
```

#### 方法三：修改代码中的默认值（不推荐）

你也可以直接修改`kbatch/kbacth.go`和`tcxprober/tcxProber.go`文件中的默认密码值，但这种方法不推荐，因为会将密码硬编码到代码中。

## 5. 验证数据库连接

运行Analyzer后，可以通过以下方式验证数据库连接和数据存储情况：

```bash
# 连接到functioninfo数据库
psql -U postgres -h localhost functioninfo

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

## 6. 常见问题

### 6.1 无法连接到PostgreSQL服务器

- 确保PostgreSQL服务正在运行：`sudo systemctl status postgresql`
- 检查PostgreSQL是否允许远程连接：修改`/etc/postgresql/<version>/main/pg_hba.conf`文件
- 确保防火墙允许5432端口的连接

### 6.2 权限错误

- 确保使用的用户具有足够的权限访问数据库
- 检查数据库和表的所有权

### 6.3 数据类型错误

- 程序已经更新了数据类型，确保使用的是最新版本的代码
- 如果遇到数据类型不匹配的错误，检查PostgreSQL日志文件：`/var/log/postgresql/postgresql-<version>-main.log`

## 7. 注意事项

- 默认情况下，PostgreSQL只允许本地连接，如果需要远程连接，请修改配置文件
- 建议为生产环境创建专门的数据库用户，并设置强密码
- 定期备份PostgreSQL数据库，以防止数据丢失
- 运行Analyzer时需要使用sudo权限，因为需要加载BPF程序