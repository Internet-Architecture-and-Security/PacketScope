#!/bin/bash

###########################################################
# PacketScope 一键从镜像文件启动脚本
# 自动清理、加载并启动所有服务
###########################################################

set -e # 遇到错误立即退出

# --- 配置 ---
# 镜像 tar 文件列表 (脚本将自动查找这些文件)
TAR_FILES=(
    "packetscope-app.tar"
    "packetscope-analyzer-monitor.tar"
    "packetscope-analyzer-calculator.tar"
    "packetscope-guarder.tar" # 注意：这个 tar 文件将用于 'guarder' 服务
    "packetscope-tracer.tar"
)

# 对应的 Docker 镜像名称和标签 (必须与 tar 文件中包含的镜像匹配)
# 注意: 'packetscope-analyzer-monitor' 使用 v1.0 标签，其余默认为 latest
IMAGE_NAMES=(
    "packetscope-app:latest"
    "packetscope-analyzer-monitor:v1.0"
    "packetscope-analyzer-calculator:latest"
    "packetscope-guarder:latest" # 假设 'packetscope-analyzer-guarder.tar' 包含名为 'packetscope-guarder' 的镜像
    "packetscope-tracer:latest"
)

# 新的 Docker Compose 文件名
COMPOSE_FILE="docker-compose.load.yml"

# --- 脚本功能 ---

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 打印分隔线
print_separator() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 打印标题
print_header() {
    clear
    print_separator
    echo -e "${BLUE}  ____              _      _   ____                        ${NC}"
    echo -e "${BLUE} |  _ \\ __ _  ___| | __ | |_/ ___|  ___ ___  _ __   ___ ${NC}"
    echo -e "${BLUE} | |_) / _\` |/ __| |/ /| __\\___ \\ / __/ _ \\| '_ \\ / _ \\${NC}"
    echo -e "${BLUE} |  __/ (_| | (__|   < | |_ ___) | (_| (_) | |_) |  __/${NC}"
    echo -e "${BLUE} |_|   \\__,_|\\___|_|\\_\\ \\__|____/ \\___\\___/| .__/ \\___|${NC}"
    echo -e "${BLUE}                                           |_|              ${NC}"
    print_separator
    echo -e "${GREEN}  一键从镜像文件启动脚本${NC}"
    print_separator
    echo ""
}

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }

# 检查 Docker 是否运行
check_docker() {
    log_info "检查 Docker 环境..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装！请先安装 Docker。"
        exit 1
    fi
    if ! sudo docker info &> /dev/null; then
        log_error "Docker 未运行！请启动 Docker 服务。"
        exit 1
    fi
    log_success "Docker 环境正常"
}

# 停止并清理现有服务
stop_services() {
    log_info "停止并清理旧的服务容器..."
    if [ -f "$COMPOSE_FILE" ]; then
        sudo docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
    fi
    sudo docker compose down -v 2>/dev/null || true # 同时尝试清理默认 docker-compose.yml 的服务
    log_success "服务已停止并清理"
    echo ""
}

# 删除旧镜像
remove_images() {
    print_separator
    log_info "开始删除旧的 Docker 镜像..."
    print_separator
    for image in "${IMAGE_NAMES[@]}"; do
        if sudo docker image inspect "$image" &> /dev/null; then
            log_warning "删除镜像: $image"
            sudo docker rmi -f "$image"
        else
            log_info "镜像 $image 不存在，无需删除。"
        fi
    done
    log_success "旧镜像清理完成"
    echo ""
}

# 从 .tar 文件加载镜像
load_images() {
    print_separator
    log_info "开始从 .tar 文件加载镜像..."
    print_separator
    for tar_file in "${TAR_FILES[@]}"; do
        if [ -f "$tar_file" ]; then
            log_info "加载中: $tar_file"
            sudo docker load -i "$tar_file"
        else
            log_error "镜像文件未找到: $tar_file"
            log_warning "请确保所有 .tar 文件都与此脚本位于同一目录中。"
            exit 1
        fi
    done
    log_success "所有镜像加载成功！"
    echo ""
}

# 创建用于加载镜像的 docker-compose 文件
create_compose_file() {
    log_info "正在生成新的 Docker Compose 配置文件: $COMPOSE_FILE"
    
    # 使用 HEREDOC 创建文件
    cat > "$COMPOSE_FILE" << EOL
version: '3.8'

services:
  # 根目录主服务
  app:
    image: ${IMAGE_NAMES[0]} # packetscope-app:latest
    container_name: packetscope_app
    ports:
      - "4173:4173"
    depends_on:
      - analyzer-monitor
      - analyzer-calculator
      - guarder
      - tracer

  analyzer-monitor:
    image: ${IMAGE_NAMES[1]} # packetscope-analyzer-monitor:v1.0
    container_name: packetscope-analyzer-monitor
    privileged: true
    network_mode: host    # ✅ 使用宿主机网络

  analyzer-calculator:
    image: ${IMAGE_NAMES[2]} # packetscope-analyzer-calculator:latest
    container_name: packetscope-analyzer-calculator
    privileged: true
    network_mode: host    # ✅ 使用宿主机网络
    depends_on:
      - analyzer-monitor
  
  guarder:
    image: ${IMAGE_NAMES[3]} # packetscope-guarder:latest
    container_name: packetscope-guarder
    privileged: true
    network_mode: host    # ✅ 使用宿主机网络
  
  tracer:
    image: ${IMAGE_NAMES[4]} # packetscope-tracer:latest
    container_name: packetscope-tracer
    restart: unless-stopped
    ports:
      - "8000:8000"
EOL

    log_success "$COMPOSE_FILE 创建成功"
    echo ""
}


# 启动服务
start_services() {
    log_info "使用 $COMPOSE_FILE 启动所有服务..."
    echo ""
    
    if sudo docker compose -f "$COMPOSE_FILE" up -d; then
        log_success "服务启动成功"
    else
        log_error "服务启动失败。请检查日志: sudo docker compose -f $COMPOSE_FILE logs"
        exit 1
    fi
}

# 显示服务信息
show_services() {
    echo ""
    print_separator
    log_info "服务状态："
    print_separator
    sudo docker compose -f "$COMPOSE_FILE" ps
    
    echo ""
    print_separator
    log_info "服务端点："
    print_separator
    echo -e "  ${CYAN}Web UI:${NC}                     http://localhost:4173"
    echo -e "  ${CYAN}Guarder API:${NC}                http://localhost:8080"
    echo -e "  ${CYAN}Tracer API:${NC}                 http://localhost:8000"
    # The following are on host network, assuming default ports if not exposed
    # Add back if they have specific ports to connect to
    
    echo ""
    print_separator
    log_info "常用命令："
    print_separator
    echo -e "  ${YELLOW}查看日志:${NC}   sudo docker compose -f $COMPOSE_FILE logs -f"
    echo -e "  ${YELLOW}停止服务:${NC}   sudo docker compose -f $COMPOSE_FILE down"
    echo -e "  ${YELLOW}重启服务:${NC}   sudo docker compose -f $COMPOSE_FILE restart"
    echo -e "  ${YELLOW}查看状态:${NC}   sudo docker compose -f $COMPOSE_FILE ps"
    print_separator
    echo ""
}

# 主函数
main() {
    local start_time=$(date +%s)
    
    print_header
    check_docker
    stop_services
    remove_images
    load_images
    create_compose_file
    start_services
    show_services
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "部署完成！总耗时: ${duration}秒"
    echo ""
}

# 捕获 Ctrl+C
trap 'echo ""; log_warning "用户中断操作"; exit 130' INT

# 执行主函数
main
