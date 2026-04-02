#!/usr/bin/env bash
# build.sh — PacketScope Metrics 一键编译 & 部署脚本
#
# 用法:
#   ./build.sh               # 编译（生成 BPF 绑定 + Go 二进制）
#   ./build.sh run           # 编译并以 root 运行
#   ./build.sh docker        # 构建 Docker 镜像
#   ./build.sh docker run    # 构建并以 Docker 容器运行
#   ./build.sh clean         # 清理编译产物
#
# 环境变量:
#   OUTPUT=bin/metrics       # 输出二进制路径
#   IMAGE=packetscope/metrics:latest  # Docker 镜像名称
#   GOPROXY=https://goproxy.cn,direct # Go 模块代理（国内环境）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── 配置 ──────────────────────────────────────────────────────────────────────
OUTPUT="${OUTPUT:-bin/metrics}"
IMAGE="${IMAGE:-packetscope/metrics:latest}"

# ── 颜色 ──────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${BOLD}▶ $*${NC}"; }

# ── 前置检查 ──────────────────────────────────────────────────────────────────
check_deps() {
  local missing=()
  command -v go    &>/dev/null || missing+=("go (https://go.dev/dl/)")
  command -v clang &>/dev/null || missing+=("clang (sudo apt install clang llvm)")
  if [[ ${#missing[@]} -gt 0 ]]; then
    error "缺少以下依赖："
    for dep in "${missing[@]}"; do echo "  · $dep"; done
    exit 1
  fi
  local gover; gover=$(go version | grep -oP '\d+\.\d+' | head -1)
  local major minor
  IFS='.' read -r major minor <<< "$gover"
  if (( major < 1 || (major == 1 && minor < 22) )); then
    warn "推荐 Go >= 1.22，当前版本 go${gover} 可能不受支持"
  fi
}

# ── 子命令: build ─────────────────────────────────────────────────────────────
cmd_build() {
  step "检查依赖"
  check_deps
  success "依赖检查通过（$(go version | awk '{print $3}')，$(clang --version | head -1 | awk '{print $1,$3}')）"

  step "生成 BPF Go 绑定（bpf2go）"
  # bpf2go 需要 clang 在 PATH 中
  go generate ./pkg/bpf_engine/ebpf/
  success "BPF 绑定生成完毕"

  step "编译 Go 二进制 → $OUTPUT"
  mkdir -p "$(dirname "$OUTPUT")"
  go build -o "$OUTPUT" ./cmd/metrics/
  success "编译完成: $SCRIPT_DIR/$OUTPUT  ($(du -sh "$OUTPUT" | cut -f1))"

  echo ""
  echo -e "${GREEN}${BOLD}构建成功！${NC}"
  echo "  运行服务: sudo -E ./$OUTPUT"
  echo "  或使用:   sudo -E ./build.sh run"
}

# ── 子命令: run ───────────────────────────────────────────────────────────────
cmd_run() {
  if [[ ! -f "$OUTPUT" ]]; then
    info "二进制不存在，先执行编译..."
    cmd_build
  fi

  if [[ $EUID -ne 0 ]]; then
    error "运行 eBPF 探针需要 root 权限。请使用: sudo -E ./build.sh run"
    exit 1
  fi

  step "启动 Metrics 服务"
  info "WebSocket 端点: ws://0.0.0.0:8020/ws"
  info "按 Ctrl+C 停止"
  exec "./$OUTPUT"
}

# ── 子命令: docker build ──────────────────────────────────────────────────────
cmd_docker_build() {
  if ! command -v docker &>/dev/null; then
    error "未找到 docker。安装: https://docs.docker.com/engine/install/"
    exit 1
  fi

  step "构建 Docker 镜像: $IMAGE"
  docker build -t "$IMAGE" .
  success "镜像构建完成: $IMAGE"

  echo ""
  echo "  运行容器: docker run --privileged --net=host $IMAGE"
  echo "  或使用:   ./build.sh docker run"
}

# ── 子命令: docker run ────────────────────────────────────────────────────────
cmd_docker_run() {
  if ! docker image inspect "$IMAGE" &>/dev/null 2>&1; then
    info "镜像不存在，先构建..."
    cmd_docker_build
  fi

  step "启动 Docker 容器"
  info "镜像:     $IMAGE"
  info "WebSocket: ws://0.0.0.0:8020/ws"
  info "按 Ctrl+C 停止（容器将自动删除）"
  docker run --rm \
    --privileged \
    --net=host \
    --name packetscope-metrics \
    "$IMAGE"
}

# ── 子命令: clean ─────────────────────────────────────────────────────────────
cmd_clean() {
  step "清理编译产物"
  rm -f "$OUTPUT"
  rm -rf bpf/out/
  # bpf2go 生成的文件（保留以避免 go build 失败，仅提示）
  info "提示: bpf2go 生成文件（pkg/bpf_engine/ebpf/bpf_bpf*.go/.o）已保留。"
  info "  如需重新生成请运行: go generate ./pkg/bpf_engine/ebpf/"
  success "清理完成"
}

# ── 入口 ──────────────────────────────────────────────────────────────────────
echo -e "${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║      PacketScope Metrics — 编译 & 部署       ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

CMD="${1:-build}"
shift || true

case "$CMD" in
  build)
    cmd_build
    ;;
  run)
    cmd_run
    ;;
  docker)
    SUBCMD="${1:-build}"
    shift || true
    case "$SUBCMD" in
      build) cmd_docker_build ;;
      run)   cmd_docker_run   ;;
      *)
        error "未知 docker 子命令: $SUBCMD。可用: build, run"
        exit 1
        ;;
    esac
    ;;
  clean)
    cmd_clean
    ;;
  help|--help|-h)
    echo "用法: ./build.sh [命令] [子命令]"
    echo ""
    echo "命令:"
    echo "  build          编译（生成 BPF 绑定 + Go 二进制）  [默认]"
    echo "  run            编译并以 root 运行"
    echo "  docker build   构建 Docker 镜像"
    echo "  docker run     构建并运行 Docker 容器"
    echo "  clean          清理编译产物"
    echo "  help           显示此帮助"
    echo ""
    echo "环境变量:"
    echo "  OUTPUT=bin/metrics               输出二进制路径"
    echo "  IMAGE=packetscope/metrics:latest Docker 镜像名称"
    echo "  GOPROXY=https://goproxy.cn,...   Go 模块代理"
    ;;
  *)
    error "未知命令: $CMD。运行 ./build.sh help 查看帮助。"
    exit 1
    ;;
esac
