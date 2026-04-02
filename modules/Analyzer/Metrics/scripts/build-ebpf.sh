#!/usr/bin/env bash
# build-ebpf.sh — Compile the eBPF C sources into a standalone .o for vmtest.
#
# This is separate from bpf2go (which embeds the .o into Go).
# The vmtest runner loads this raw .o directly with cilium/ebpf.
#
# Output: bpf/out/metrics_bpf.o
#
# Usage:
#   ./scripts/build-ebpf.sh
#   TARGET_ARCH=arm64 ./scripts/build-ebpf.sh   # cross-compile

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
SRC="$ROOT/bpf/metrics.c"
HEADERS="$ROOT/bpf/headers"
OUT_DIR="$ROOT/bpf/out"
OUT="$OUT_DIR/metrics_bpf.o"

TARGET_ARCH="${TARGET_ARCH:-x86}"

if ! command -v clang &>/dev/null; then
  echo "错误: 未找到 clang。安装: sudo apt install clang llvm" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "编译 eBPF 对象: $OUT"
clang \
  -target bpf \
  -D__TARGET_ARCH_${TARGET_ARCH} \
  -O2 -g \
  -Wall -Wno-unused-variable \
  -I"$HEADERS" \
  -c "$SRC" \
  -o "$OUT"

# Verify output
if [[ ! -f "$OUT" ]]; then
  echo "错误: 编译失败，输出文件不存在" >&2
  exit 1
fi

SIZE=$(du -sh "$OUT" | cut -f1)
PROGS=$(llvm-objdump -h "$OUT" 2>/dev/null | grep -c "^[[:space:]]*[0-9]" || echo "?")
echo "✓ 编译成功: $OUT ($SIZE)"
echo "  段数: $(llvm-objdump -h "$OUT" 2>/dev/null | grep -c '\.' || echo '?')"
