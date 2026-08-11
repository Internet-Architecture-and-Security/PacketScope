# ============================================================
# Stage 1 — 构建前端
# ============================================================
FROM node:20-alpine AS build

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ============================================================
# Stage 2 — 运行时（nginx + 静态文件 + 反向代理）
# ============================================================
FROM nginx:alpine

# 前端静态文件
COPY --from=build /app/dist /usr/share/nginx/html

# nginx 配置（反向代理到后端服务）
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
