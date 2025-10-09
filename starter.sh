#!/bin/bash

#############################################
# PacketScope 一键编译并启动脚本
# 自动顺序构建所有服务并启动
#############################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 服务列表（按依赖顺序）
SERVICES=(
    "analyzer-monitor"
    "analyzer-protocolstack"
    "guarder"
    "tracer"
    "app"
)

# 打印分隔线
print_separator() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 打印标题
print_header() {
    clear
    print_separator
    echo -e "${BLUE}   ____            _        _   ____                       ${NC}"
    echo -e "${BLUE}  |  _ \\ __ _  ___| | _____| |_/ ___|  ___ ___  _ __   ___ ${NC}"
    echo -e "${BLUE}  | |_) / _\` |/ __| |/ / _ \\ __\\___ \\ / __/ _ \\| '_ \\ / _ \\${NC}"
    echo -e "${BLUE}  |  __/ (_| | (__|   <  __/ |_ ___) | (_| (_) | |_) |  __/${NC}"
    echo -e "${BLUE}  |_|   \\__,_|\\___|_|\\_\\___|\\__|____/ \\___\\___/| .__/ \\___|${NC}"
    echo -e "${BLUE}                                               |_|          ${NC}"
    print_separator
    echo -e "${GREEN}  一键编译并启动脚本${NC}"
    print_separator
    echo ""
}

# 打印信息
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# 检查 Docker 是否运行
check_docker() {
    log_info "检查 Docker 环境..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装！"
        exit 1
    fi
    
    if ! sudo docker info &> /dev/null; then
        log_error "Docker 未运行！请启动 Docker 服务"
        exit 1
    fi
    
    log_success "Docker 环境正常"
}

# 显示当前状态
show_status() {
    log_info "当前服务状态："
    sudo docker compose ps 2>/dev/null || echo "  没有运行的服务"
    echo ""
}

# 停止现有服务
stop_services() {
    log_info "停止现有服务..."
    sudo docker compose down 2>/dev/null || true
    log_success "服务已停止"
    echo ""
}

# 构建单个服务
build_service() {
    local service=$1
    local index=$2
    local total=$3
    
    echo ""
    print_separator
    echo -e "${YELLOW}[$index/$total] 构建服务: ${CYAN}$service${NC}"
    print_separator
    
    # 显示详细构建过程
    if sudo docker compose build --progress=plain "$service" 2>&1 | tee "/tmp/build-$service.log"; then
        log_success "$service 构建成功"
        return 0
    else
        log_error "$service 构建失败"
        log_error "详细日志: /tmp/build-$service.log"
        return 1
    fi
}

# 构建所有服务
build_all() {
    log_info "开始顺序构建所有服务..."
    echo ""
    
    local total=${#SERVICES[@]}
    local current=0
    
    for service in "${SERVICES[@]}"; do
        current=$((current + 1))
        
        if ! build_service "$service" "$current" "$total"; then
            log_error "构建过程失败，停止执行"
            exit 1
        fi
    done
    
    echo ""
    print_separator
    log_success "所有服务构建完成！"
    print_separator
    echo ""
}

# 启动服务
start_services() {
    log_info "启动所有服务..."
    echo ""
    
    if sudo docker compose up -d; then
        log_success "服务启动成功"
    else
        log_error "服务启动失败"
        exit 1
    fi
}

# 显示服务信息
show_services() {
    echo ""
    print_separator
    log_info "服务状态："
    print_separator
    sudo docker compose ps
    
    echo ""
    print_separator
    log_info "服务端点："
    print_separator
    echo -e "  ${CYAN}Web UI:${NC}                       http://localhost:4173"
    echo -e "  ${CYAN}Guarder API:${NC}                  http://localhost:8080"
    echo -e "  ${CYAN}Tracer API:${NC}                   http://localhost:8000"
    echo -e "  ${CYAN}Analyzer-Monitor API:${NC}         http://localhost:5000"
    echo -e "  ${CYAN}Analyzer-ProtocolStack API:${NC}   http://localhost:19999"
    
    echo ""
    print_separator
    log_info "常用命令："
    print_separator
    echo -e "  ${YELLOW}查看日志:${NC}     sudo docker compose logs -f"
    echo -e "  ${YELLOW}停止服务:${NC}     sudo docker compose down"
    echo -e "  ${YELLOW}重启服务:${NC}     sudo docker compose restart"
    echo -e "  ${YELLOW}查看状态:${NC}     sudo docker compose ps"
    print_separator
    echo ""
}

# 主函数
main() {
    local start_time=$(date +%s)
    
    # 显示标题
    print_header
    
    # 检查环境
    check_docker
    
    # 显示当前状态
    show_status
    
    # 停止现有服务
    stop_services
    
    # 构建所有服务
    build_all
    
    # 启动服务
    start_services
    
    # 显示服务信息
    show_services
    
    # 计算耗时
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "部署完成！总耗时: ${duration}秒"
    echo ""
}

# 捕获 Ctrl+C
trap 'echo ""; log_warning "用户中断操作"; exit 130' INT

# 执行主函数
main