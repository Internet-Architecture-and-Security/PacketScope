#!/usr/bin/env bash
# test.sh — PacketScope Metrics one-stop test runner
#
# Usage:
#   ./test.sh                   # Run unit tests only (no root needed)
#   ./test.sh unit              # Unit tests only
#   ./test.sh integration       # Unit + BPF integration tests (requires root)
#   ./test.sh vmtest            # Cross-kernel QEMU tests (requires root + QEMU)
#   ./test.sh vmtest 5.15 6.6   # vmtest for specific kernel versions
#   ./test.sh all               # Full test suite (unit + integration + vmtest)
#   ./test.sh setup             # Install test dependencies and fetch kernel images
#
#   Environment variables:
#     KERNELS="5.15 6.1 6.6"   # Override kernel list used by vmtest
#     TIMEOUT=180               # Timeout seconds per VM (default: 120)
#     VERBOSE=1                 # Show verbose output

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VMTEST_DIR="$SCRIPT_DIR/test/kernel-compat/vmtest"

# ── Colors ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[PASS]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[FAIL]${NC} $*" >&2; }
header()  { echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BOLD}  $*${NC}"; echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

VERBOSE="${VERBOSE:-0}"
GO_TEST_FLAGS="-count=1"
[[ "$VERBOSE" == "1" ]] && GO_TEST_FLAGS="$GO_TEST_FLAGS -v"

# ── Subcommand: setup ─────────────────────────────────────────────────────────
cmd_setup() {
  header "Install test dependencies"

  info "Checking Go toolchain..."
  if ! command -v go &>/dev/null; then
    error "go not found. Please install Go >= 1.21: https://go.dev/dl/"
    exit 1
  fi
  go version

  info "Checking clang/llvm..."
  if ! command -v clang &>/dev/null; then
    warn "clang not found. Install with: sudo apt install clang llvm"
  else
    clang --version | head -1
  fi

  info "Checking busybox-static (required to build vmtest rootfs)..."
  if ! command -v busybox &>/dev/null; then
    warn "busybox not found. Install with: sudo apt install busybox-static"
  else
    success "busybox is ready"
  fi

  info "Checking QEMU (required for vmtest)..."
  if ! command -v qemu-system-x86_64 &>/dev/null; then
    warn "qemu-system-x86_64 not found. Install with: sudo apt install qemu-system-x86"
  else
    qemu-system-x86_64 --version | head -1
    success "QEMU is ready"
  fi

  info "Checking jq (required for kernel matrix parsing)..."
  if ! command -v jq &>/dev/null; then
    warn "jq not found. Install with: sudo apt install jq"
  else
    success "jq is ready"
  fi

  info "Downloading Go dependencies..."
  go mod download
  success "Go dependencies are ready"

  info "Fetching kernel images (required for vmtest, ~200MB)..."
  if [[ -d "$VMTEST_DIR/kernels" ]] && \
     [[ $(ls "$VMTEST_DIR/kernels" 2>/dev/null | wc -l) -gt 0 ]]; then
    warn "Kernel directory already exists, skipping. To re-download: rm -rf $VMTEST_DIR/kernels && ./test.sh setup"
  else
    bash "$VMTEST_DIR/fetch-kernels.sh"
  fi

  echo ""
  success "All dependency checks completed. Run './test.sh unit' to start testing."
}

# ── Subcommand: unit ─────────────────────────────────────────────────────────
cmd_unit() {
  header "Unit tests (no root / QEMU required)"

  info "Running aggregation and websocket protocol unit tests..."
  # shellcheck disable=SC2086
  go test $GO_TEST_FLAGS \
    -run 'TestAggIdx|TestDecodeSlot|TestSumPerCPU|TestParseParams|TestWSHandler|TestWebSocket' \
    ./test/ 2>&1
  success "Unit tests passed"
}

# ── Subcommand: integration ──────────────────────────────────────────────────
cmd_integration() {
  header "Integration tests (requires root to load BPF programs)"

  if [[ $EUID -ne 0 ]]; then
    error "BPF integration tests require root privileges. Use: sudo -E ./test.sh integration"
    exit 1
  fi

  info "Ensuring eBPF object is built..."
  if [[ ! -f "$SCRIPT_DIR/bpf/out/metrics_bpf.o" ]]; then
    info "Building eBPF object..."
    bash "$SCRIPT_DIR/scripts/build-ebpf.sh"
  fi

  info "Running BPF engine loading integration tests..."
  # shellcheck disable=SC2086
  go test $GO_TEST_FLAGS -run 'TestBPFEngine' ./test/ 2>&1
  success "BPF integration tests passed"
}

# ── Subcommand: vmtest ───────────────────────────────────────────────────────
cmd_vmtest() {
  header "Cross-kernel QEMU compatibility tests"
  local requested_kernels=("$@")

  if [[ $EUID -ne 0 ]]; then
    error "vmtest requires root privileges (QEMU boots the kernel). Use: sudo -E ./test.sh vmtest"
    exit 1
  fi

  if ! command -v qemu-system-x86_64 &>/dev/null; then
    error "qemu-system-x86_64 not found. Install with: sudo apt install qemu-system-x86"
    exit 1
  fi

  # Build eBPF object
  info "Building eBPF object..."
  bash "$SCRIPT_DIR/scripts/build-ebpf.sh" 2>&1 | grep -E "✓|error" || true

  # Build initramfs
  info "Building initramfs rootfs..."
  bash "$VMTEST_DIR/mkrootfs.sh" 2>&1 | grep -E "✓|error" || true

  # Run vmtest
  info "Starting QEMU kernel tests..."
  if [[ ${#requested_kernels[@]} -gt 0 ]]; then
    TIMEOUT="${TIMEOUT:-120}" bash "$VMTEST_DIR/run-vmtest.sh" "${requested_kernels[@]}"
  elif [[ -n "${KERNELS:-}" ]]; then
    # shellcheck disable=SC2086
    TIMEOUT="${TIMEOUT:-120}" bash "$VMTEST_DIR/run-vmtest.sh" $KERNELS
  else
    TIMEOUT="${TIMEOUT:-120}" bash "$VMTEST_DIR/run-vmtest.sh"
  fi
}

# ── Subcommand: all ──────────────────────────────────────────────────────────
cmd_all() {
  header "Full test suite (unit + integration + vmtest)"

  cmd_unit

  if [[ $EUID -ne 0 ]]; then
    warn "Integration and vmtest require root privileges, skipped. To run them: sudo -E ./test.sh all"
  else
    cmd_integration
    cmd_vmtest
  fi

  echo ""
  success "Full test suite completed"
}

# ── Entry ────────────────────────────────────────────────────────────────────
CMD="${1:-unit}"
shift || true

echo -e "${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║       PacketScope Metrics Test Suite         ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

case "$CMD" in
  unit)        cmd_unit ;;
  integration) cmd_integration ;;
  vmtest)      cmd_vmtest "$@" ;;
  all)         cmd_all ;;
  setup)       cmd_setup ;;
  help|--help|-h)
    echo "Usage: ./test.sh [command] [args...]"
    echo ""
    echo "Commands:"
    echo "  unit          Unit tests (no root required)      [default]"
    echo "  integration   Integration tests (requires root + BPF)"
    echo "  vmtest        Cross-kernel QEMU compatibility tests (requires root)"
    echo "                  ./test.sh vmtest 5.15 6.6        # specific kernel versions"
    echo "  all           Run all tests"
    echo "  setup         Install dependencies + fetch kernel images"
    echo "  help          Show this help"
    echo ""
    echo "Environment variables:"
    echo "  KERNELS=\"5.10 5.15 6.1 6.6 6.12\"  Override vmtest kernel versions"
    echo "  TIMEOUT=180                         Timeout seconds per VM"
    echo "  VERBOSE=1                           Show verbose go test output"
    ;;
  *)
    error "Unknown command: $CMD. Run ./test.sh help for usage."
    exit 1
    ;;
esac
