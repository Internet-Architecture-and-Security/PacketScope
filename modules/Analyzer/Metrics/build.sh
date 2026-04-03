#!/usr/bin/env bash
# build.sh — PacketScope Metrics one-click build & deploy script
#
# Usage:
#   ./build.sh               # Build (generate BPF bindings + Go binary)
#   ./build.sh run           # Build and run as root
#   ./build.sh docker        # Build Docker image
#   ./build.sh docker run    # Build and run in Docker container
#   ./build.sh clean         # Clean build artifacts
#
# Build dependencies (Ubuntu/Debian example):
#   sudo apt install -y go clang llvm libbpf-dev
#   - go:         Build the Go service
#   - clang/llvm: Compile eBPF C sources (bpf2go)
#   - libbpf-dev: Provide bpf_helpers.h / bpf_tracing.h / bpf_endian.h
#
# Environment variables:
#   OUTPUT=bin/metrics       # Output binary path
#   IMAGE=packetscope/metrics:latest  # Docker image name
#   GOPROXY=https://goproxy.cn,direct # Go module proxy

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Config ─────────────────────────────────────────────────────────────────────
OUTPUT="${OUTPUT:-bin/metrics}"
IMAGE="${IMAGE:-packetscope/metrics:latest}"

# ── Colors ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${BOLD}▶ $*${NC}"; }

# ── Prerequisite checks ────────────────────────────────────────────────────────
check_deps() {
  # bpf2go invokes clang during go generate to compile eBPF sources,
  # so BPF headers from libbpf-dev are required in addition to go/clang.
  local missing=()
  command -v go    &>/dev/null || missing+=("go (https://go.dev/dl/)")
  command -v clang &>/dev/null || missing+=("clang (sudo apt install clang llvm)")
  if [[ ! -f /usr/include/bpf/bpf_helpers.h ]] || [[ ! -f /usr/include/bpf/bpf_tracing.h ]] || [[ ! -f /usr/include/bpf/bpf_endian.h ]]; then
    missing+=("libbpf headers (sudo apt install libbpf-dev)")
  fi
  if [[ ${#missing[@]} -gt 0 ]]; then
    error "Missing required dependencies:"
    for dep in "${missing[@]}"; do echo "  · $dep"; done
    exit 1
  fi
  local gover; gover=$(go version | grep -oP '\d+\.\d+' | head -1)
  local major minor
  IFS='.' read -r major minor <<< "$gover"
  if (( major < 1 || (major == 1 && minor < 22) )); then
    warn "Go >= 1.22 is recommended; current version go${gover} may be unsupported"
  fi
}

# ── Subcommand: build ─────────────────────────────────────────────────────────
cmd_build() {
  step "Checking dependencies"
  check_deps
  success "Dependency check passed ($(go version | awk '{print $3}'), $(clang --version | head -1 | awk '{print $1,$3}'))"

  step "Generating BPF Go bindings (bpf2go)"
  # Auto-generate the go:generate file
  mkdir -p ./pkg/bpf_engine/ebpf
  cat << 'EOF' > ./pkg/bpf_engine/ebpf/gen.go
package ebpf

//go:generate go run github.com/cilium/ebpf/cmd/bpf2go -cc clang -type filter_v4_t -type filter_v6_t -type agg_val_t -cflags "-O2 -g -Wall -Wno-unused-variable -D__TARGET_ARCH_x86" Bpf ../../../bpf/metrics.c -- -I../../../bpf/headers
EOF

  # bpf2go requires clang in PATH
  go generate ./pkg/bpf_engine/ebpf/
  success "BPF bindings generated"

  step "Building Go binary -> $OUTPUT"
  mkdir -p "$(dirname "$OUTPUT")"
  go build -o "$OUTPUT" ./cmd/metrics/
  success "Build complete: $SCRIPT_DIR/$OUTPUT  ($(du -sh "$OUTPUT" | cut -f1))"

  echo ""
  echo -e "${GREEN}${BOLD}Build succeeded!${NC}"
  echo "  Run service: sudo -E ./$OUTPUT"
  echo "  Or use:      sudo -E ./build.sh run"
}

# ── Subcommand: run ───────────────────────────────────────────────────────────
cmd_run() {
  if [[ ! -f "$OUTPUT" ]]; then
    info "Binary not found, building first..."
    cmd_build
  fi

  if [[ $EUID -ne 0 ]]; then
    error "Running eBPF probes requires root privileges. Use: sudo -E ./build.sh run"
    exit 1
  fi

  step "Starting Metrics service"
  info "WebSocket endpoint: ws://0.0.0.0:8020/ws"
  info "Press Ctrl+C to stop"
  exec "./$OUTPUT"
}

# ── Subcommand: docker build ──────────────────────────────────────────────────
cmd_docker_build() {
  if ! command -v docker &>/dev/null; then
    error "docker not found. Install: https://docs.docker.com/engine/install/"
    exit 1
  fi

  step "Building Docker image: $IMAGE"
  docker build -t "$IMAGE" .
  success "Image build complete: $IMAGE"

  echo ""
  echo "  Run container: docker run --privileged --net=host $IMAGE"
  echo "  Or use:        ./build.sh docker run"
}

# ── Subcommand: docker run ────────────────────────────────────────────────────
cmd_docker_run() {
  if ! docker image inspect "$IMAGE" &>/dev/null 2>&1; then
    info "Image not found, building first..."
    cmd_docker_build
  fi

  step "Starting Docker container"
  info "Image:     $IMAGE"
  info "WebSocket: ws://0.0.0.0:8020/ws"
  info "Press Ctrl+C to stop (container will be removed automatically)"
  docker run --rm \
    --privileged \
    --net=host \
    --name packetscope-metrics \
    "$IMAGE"
}

# ── Subcommand: clean ─────────────────────────────────────────────────────────
cmd_clean() {
  step "Cleaning build artifacts"
  rm -f "$OUTPUT"
  rm -rf bpf/out/
  # Keep bpf2go-generated files to avoid go build failures.
  info "Note: bpf2go-generated files (pkg/bpf_engine/ebpf/bpf_bpf*.go/.o) were kept."
  info "  To regenerate, run: go generate ./pkg/bpf_engine/ebpf/"
  success "Cleanup complete"
}

# ── Entry ──────────────────────────────────────────────────────────────────────
echo -e "${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║      PacketScope Metrics — Build & Deploy    ║"
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
        error "Unknown docker subcommand: $SUBCMD. Available: build, run"
        exit 1
        ;;
    esac
    ;;
  clean)
    cmd_clean
    ;;
  help|--help|-h)
    echo "Usage: ./build.sh [command] [subcommand]"
    echo ""
    echo "Commands:"
    echo "  build          Build (generate BPF bindings + Go binary)  [default]"
    echo "  run            Build and run as root"
    echo "  docker build   Build Docker image"
    echo "  docker run     Build and run Docker container"
    echo "  clean          Clean build artifacts"
    echo "  help           Show this help"
    echo ""
    echo "Environment variables:"
    echo "  OUTPUT=bin/metrics               Output binary path"
    echo "  IMAGE=packetscope/metrics:latest Docker image name"
    echo "  GOPROXY=https://goproxy.cn,...   Go module proxy"
    ;;
  *)
    error "Unknown command: $CMD. Run ./build.sh help for usage."
    exit 1
    ;;
esac
