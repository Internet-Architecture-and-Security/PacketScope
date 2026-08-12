#!/bin/bash
# PacketScope 国内一键部署脚本
# 适用于国内 VPS — 自动配置镜像源、安装 Docker、构建并启动

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  PacketScope 国内一键部署${NC}"
echo -e "${CYAN}========================================${NC}"

# ---- 1. 安装 Docker ----
if ! command -v docker &>/dev/null; then
  echo -e "${GREEN}[1/4] 安装 Docker...${NC}"
  sudo apt-get update -qq
  sudo apt-get install -y docker.io docker-compose-v2
  sudo usermod -aG docker "$USER"
else
  echo -e "${GREEN}[1/4] Docker 已安装${NC}"
fi

# ---- 2. 配置 Docker 国内镜像加速 ----
echo -e "${GREEN}[2/4] 配置 Docker 镜像加速...${NC}"
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run"
  ]
}
EOF
sudo systemctl restart docker 2>/dev/null || true
sleep 1

# ---- 3. 获取源码 ----
REPO_DIR="$HOME/PacketScope"
echo -e "${GREEN}[3/4] 获取源码...${NC}"

if [ -d "$REPO_DIR/.git" ]; then
  echo "  已有仓库，更新中..."
  cd "$REPO_DIR" && git pull
else
  # 尝试 GitHub，被墙则用 ghproxy 镜像
  if ! git clone --depth 1 https://github.com/Internet-Architecture-and-Security/PacketScope.git "$REPO_DIR" 2>/dev/null; then
    echo "  GitHub 直连失败，用 ghproxy 镜像..."
    git clone --depth 1 https://ghproxy.com/https://github.com/Internet-Architecture-and-Security/PacketScope.git "$REPO_DIR"
  fi
fi

cd "$REPO_DIR"

# ---- 4. 构建 & 启动 ----
echo -e "${GREEN}[4/4] 构建并启动服务（需要 10-30 分钟，视网络而定）...${NC}"
sudo docker compose build --progress=plain
sudo docker compose up -d

# ---- 完成 ----
IP=$(curl -s ifconfig.me 2>/dev/null || ip -4 addr show scope global | grep inet | head -1 | awk '{print $2}' | cut -d/ -f1)
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}  PacketScope 部署完成！${NC}"
echo -e "${CYAN}========================================${NC}"
echo -e "  Web UI:  ${CYAN}http://${IP}${NC}"
echo -e ""
echo -e "  管理命令:"
echo -e "    查看状态:  sudo docker compose -f $REPO_DIR/docker-compose.yml ps"
echo -e "    查看日志:  sudo docker compose -f $REPO_DIR/docker-compose.yml logs -f"
echo -e "    重启服务:  sudo docker compose -f $REPO_DIR/docker-compose.yml restart"
echo -e "    停止服务:  sudo docker compose -f $REPO_DIR/docker-compose.yml down"
echo -e "${CYAN}========================================${NC}"
echo -e "  ${RED}⚠ 请确保云安全组已放行端口 80 (TCP)${NC}"
