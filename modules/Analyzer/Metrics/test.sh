#!/usr/bin/env bash
# test.sh — PacketScope Metrics 一站式测试脚本
#
# 用法:
#   ./test.sh                   # 运行全部单元测试（不需要 root）
#   ./test.sh unit              # 仅单元测试
#   ./test.sh integration       # 单元测试 + BPF 集成测试（需要 root）
#   ./test.sh vmtest            # 跨内核 QEMU 测试（需要 root + QEMU）
#   ./test.sh vmtest 5.15 6.6   # 指定内核版本的 vmtest
#   ./test.sh all               # 全量测试（unit + integration + vmtest）
#   ./test.sh setup             # 安装测试依赖并下载内核镜像
#
#   环境变量:
#     KERNELS="5.15 6.1 6.6"   # 覆盖 vmtest 使用的内核版本列表
#     TIMEOUT=180               # 每个 VM 的超时秒数（默认 120）
#     VERBOSE=1                 # 显示详细输出

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VMTEST_DIR="$SCRIPT_DIR/test/kernel-compat/vmtest"

# ── 颜色 ──────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[PASS]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[FAIL]${NC} $*" >&2; }
header()  { echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BOLD}  $*${NC}"; echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

VERBOSE="${VERBOSE:-0}"
GOTEST_FLAGS="-count=1"
[[ "$VERBOSE" == "1" ]] && GOTEST_FLAGS="$GOTEST_FLAGS -v"

# ── 子命令: setup ───────────────────────────────────────────────────────────
cmd_setup() {
  header "安装测试依赖"

  info "检查 Go 工具链..."
  if ! command -v go &>/dev/null; then
    error "未找到 go。请先安装 Go >= 1.21: https://go.dev/dl/"
    exit 1
  fi
  go version

  info "检查 clang/llvm..."
  if ! command -v clang &>/dev/null; then
    warn "未找到 clang。安装: sudo apt install clang llvm"
  else
    clang --version | head -1
  fi

  info "检查 busybox-static（vmtest rootfs 构建所需）..."
  if ! command -v busybox &>/dev/null; then
    warn "未找到 busybox。安装: sudo apt install busybox-static"
  else
    success "busybox 已就绪"
  fi

  info "检查 QEMU（vmtest 所需）..."
  if ! command -v qemu-system-x86_64 &>/dev/null; then
    warn "未找到 qemu-system-x86_64。安装: sudo apt install qemu-system-x86"
  else
    qemu-system-x86_64 --version | head -1
    success "QEMU 已就绪"
  fi

  info "检查 jq（内核矩阵解析所需）..."
  if ! command -v jq &>/dev/null; then
    warn "未找到 jq。安装: sudo apt install jq"
  else
    success "jq 已就绪"
  fi

  info "下载 Go 依赖..."
  go mod download
  success "Go 依赖已就绪"

  info "下载内核镜像（vmtest 所需，约 200MB）..."
  if [[ -d "$VMTEST_DIR/kernels" ]] && \
     [[ $(ls "$VMTEST_DIR/kernels" 2>/dev/null | wc -l) -gt 0 ]]; then
    warn "内核目录已存在，跳过。如需重新下载: rm -rf $VMTEST_DIR/kernels && ./test.sh setup"
  else
    bash "$VMTEST_DIR/fetch-kernels.sh"
  fi

  echo ""
  success "所有依赖检查完毕。运行 './test.sh unit' 开始测试。"
}

# ── 子命令: unit ────────────────────────────────────────────────────────────
cmd_unit() {
  header "单元测试（无需 root / QEMU）"

  info "运行 aggregation、websocket 协议单元测试..."
  # shellcheck disable=SC2086
  go test $GOTEST_FLAGS \
    -run 'TestAggIdx|TestDecodeSlot|TestSumPerCPU|TestParseParams|TestWSHandler|TestWebSocket' \
    ./test/ 2>&1
  success "单元测试通过"
}

# ── 子命令: integration ─────────────────────────────────────────────────────
cmd_integration() {
  header "集成测试（需要 root 权限加载 BPF 程序）"

  if [[ $EUID -ne 0 ]]; then
    error "BPF 集成测试需要 root 权限。请使用: sudo -E ./test.sh integration"
    exit 1
  fi

  info "先确保 eBPF 对象已编译..."
  if [[ ! -f "$SCRIPT_DIR/bpf/out/metrics_bpf.o" ]]; then
    info "编译 eBPF 对象..."
    bash "$SCRIPT_DIR/scripts/build-ebpf.sh"
  fi

  info "运行 BPF 引擎加载集成测试..."
  # shellcheck disable=SC2086
  go test $GOTEST_FLAGS -run 'TestBPFEngine' ./test/ 2>&1
  success "BPF 集成测试通过"
}

# ── 子命令: vmtest ──────────────────────────────────────────────────────────
cmd_vmtest() {
  header "跨内核 QEMU 兼容性测试"
  local requested_kernels=("$@")

  if [[ $EUID -ne 0 ]]; then
    error "vmtest 需要 root 权限（QEMU 启动内核）。请使用: sudo -E ./test.sh vmtest"
    exit 1
  fi

  if ! command -v qemu-system-x86_64 &>/dev/null; then
    error "未找到 qemu-system-x86_64。安装: sudo apt install qemu-system-x86"
    exit 1
  fi

  # 构建 eBPF 对象
  info "构建 eBPF 对象..."
  bash "$SCRIPT_DIR/scripts/build-ebpf.sh" 2>&1 | grep -E "✓|错误|error" || true

  # 构建 initramfs
  info "构建 initramfs rootfs..."
  bash "$VMTEST_DIR/mkrootfs.sh" 2>&1 | grep -E "✓|错误|error" || true

  # 运行 vmtest
  info "启动 QEMU 内核测试..."
  if [[ ${#requested_kernels[@]} -gt 0 ]]; then
    TIMEOUT="${TIMEOUT:-120}" bash "$VMTEST_DIR/run-vmtest.sh" "${requested_kernels[@]}"
  elif [[ -n "${KERNELS:-}" ]]; then
    # shellcheck disable=SC2086
    TIMEOUT="${TIMEOUT:-120}" bash "$VMTEST_DIR/run-vmtest.sh" $KERNELS
  else
    TIMEOUT="${TIMEOUT:-120}" bash "$VMTEST_DIR/run-vmtest.sh"
  fi
}

# ── 子命令: all ─────────────────────────────────────────────────────────────
cmd_all() {
  header "全量测试（unit + integration + vmtest）"

  cmd_unit

  if [[ $EUID -ne 0 ]]; then
    warn "集成测试和 vmtest 需要 root 权限，已跳过。如需运行: sudo -E ./test.sh all"
  else
    cmd_integration
    cmd_vmtest
  fi

  echo ""
  success "全量测试完成"
}

# ── 入口 ────────────────────────────────────────────────────────────────────
CMD="${1:-unit}"
shift || true

echo -e "${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║       PacketScope Metrics 测试套件           ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

case "$CMD" in
  unit)        cmd_unit ;;
  integration) cmd_integration ;;
  vmtest)      cmd_vmtest "$@" ;;
  all)         cmd_all ;;
  setup)       cmd_setup ;;
  help|--help|-h)
    echo "用法: ./test.sh [命令] [参数...]"
    echo ""
    echo "命令:"
    echo "  unit          单元测试（无需 root）             [默认]"
    echo "  integration   集成测试（需要 root + BPF）"
    echo "  vmtest        跨内核 QEMU 兼容性测试（需要 root）"
    echo "                  ./test.sh vmtest 5.15 6.6        # 指定内核版本"
    echo "  all           运行全部测试"
    echo "  setup         安装依赖 + 下载内核镜像"
    echo "  help          显示此帮助"
    echo ""
    echo "环境变量:"
    echo "  KERNELS=\"5.10 5.15 6.1 6.6 6.12\"  覆盖 vmtest 内核版本"
    echo "  TIMEOUT=180                         每个 VM 的超时秒数"
    echo "  VERBOSE=1                           显示详细 go test 输出"
    ;;
  *)
    error "未知命令: $CMD。运行 ./test.sh help 查看帮助。"
    exit 1
    ;;
esac
