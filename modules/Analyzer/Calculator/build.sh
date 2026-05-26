#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

OUTPUT="${OUTPUT:-bin/metrics}"

check_deps() {
  local missing=()
  command -v go    &>/dev/null || missing+=("go")
  command -v clang &>/dev/null || missing+=("clang")
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "Missing dependencies: ${missing[*]}"
    exit 1
  fi
}

cmd_build() {
  check_deps
  mkdir -p ./pkg/bpf_engine/ebpf
  cat << 'EOF' > ./pkg/bpf_engine/ebpf/gen.go
package ebpf

//go:generate go run github.com/cilium/ebpf/cmd/bpf2go -cc clang -type filter_v4_t -type filter_v6_t -type agg_val_t -cflags "-O2 -g -Wall -Wno-unused-variable -D__TARGET_ARCH_x86" Bpf ../../../bpf/metrics.c -- -I../../../bpf/headers
EOF

  go generate ./pkg/bpf_engine/ebpf/
  mkdir -p "$(dirname "$OUTPUT")"
  go build -o "$OUTPUT" ./cmd/metrics/
  echo "Build complete: $OUTPUT"
}

cmd_clean() {
  rm -f "$OUTPUT"
  rm -rf bpf/out/
  echo "Cleanup complete"
}

CMD="${1:-build}"
case "$CMD" in
  build) cmd_build ;;
  clean) cmd_clean ;;
  *) echo "Usage: $0 [build|clean]" ;;
esac
