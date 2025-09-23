# 基础镜像
FROM node:20-slim

# 设置工作目录
WORKDIR /app

# 设置国内 npm 源
RUN npm config set registry https://registry.npmmirror.com

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制项目文件
COPY . .

# 暴露端口
EXPOSE 4173

# 启动应用
CMD ["npm", "run", "preview"]
