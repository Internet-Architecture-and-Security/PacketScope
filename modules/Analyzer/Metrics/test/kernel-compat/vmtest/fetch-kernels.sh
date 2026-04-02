#!/usr/bin/env bash
# fetch-kernels.sh — 下载 BTF 内核用于 vmtest。
#
# 内核来自 ghcr.io/cilium/ci-kernels（与 cilium/ebpf CI 相同）。
#
# 用法:
#   ./test/kernel-compat/vmtest/fetch-kernels.sh           # 下载全部
#   ./test/kernel-compat/vmtest/fetch-kernels.sh 5.15 6.6  # 指定版本

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KERNELS_DIR="$SCRIPT_DIR/kernels"
MATRIX="$SCRIPT_DIR/kernel-matrix.json"

if ! command -v jq &>/dev/null; then
  echo "错误: 需要 jq。安装: sudo apt install jq" >&2
  exit 1
fi

REQUESTED=("$@")
if [[ ${#REQUESTED[@]} -eq 0 ]]; then
  mapfile -t REQUESTED < <(jq -r '.kernels[].version' "$MATRIX")
fi

REGISTRY="ghcr.io/cilium/ci-kernels"

# 版本比较：检测是否低于最低支持版本 5.10
version_lt_min() {
  local ver="$1" min="5.10"
  # 按 . 分割后逐段比较
  IFS='.' read -ra va <<< "$ver"
  IFS='.' read -ra vm <<< "$min"
  local i
  for i in 0 1; do
    local a=${va[$i]:-0} b=${vm[$i]:-0}
    if (( a < b )); then return 0; fi
    if (( a > b )); then return 1; fi
  done
  return 1  # 相等：不低于最低版本
}

for ver in "${REQUESTED[@]}"; do
  # 检查是否低于最低支持版本
  if version_lt_min "$ver"; then
    echo "" >&2
    echo "╔══════════════════════════════════════════════════════════════╗" >&2
    echo "║  错误：内核 $ver 低于最低支持版本 5.10                 ║" >&2
    echo "║                                                              ║" >&2
    echo "║  PacketScope Metrics 的 RX/TX 探针使用 fentry，             ║" >&2
    echo "║  而 fentry (BPF_PROG_TYPE_TRACING) 在 Linux 5.5 才引入。   ║" >&2
    echo "║  5.4 及更低版本会导致 BPF 程序加载失败 (invalid argument)。 ║" >&2
    echo "║                                                              ║" >&2
    echo "║  支持的最低版本：5.10 (LTS, Ubuntu 20.04)                   ║" >&2
    echo "╚══════════════════════════════════════════════════════════════╝" >&2
    echo "" >&2
    exit 1
  fi

  tag=$(jq -r --arg v "$ver" '.kernels[] | select(.version == $v) | .tag' "$MATRIX")
  if [[ -z "$tag" || "$tag" == "null" ]]; then
    echo "⚠ 跳过未知版本: $ver（不在 kernel-matrix.json 中）"
    continue
  fi

  dest="$KERNELS_DIR/$ver"
  if [[ -f "$dest/boot/vmlinuz" ]]; then
    echo "✓ $ver 已存在，跳过"
    continue
  fi

  echo "⬇ 下载内核 $ver (tag: $tag) ..."
  mkdir -p "$dest"

  if command -v crane &>/dev/null; then
    tmptar=$(mktemp)
    crane export "$REGISTRY:$tag" "$tmptar" 2>/dev/null
    tar -xf "$tmptar" -C "$dest" 2>/dev/null || true
    rm -f "$tmptar"
  elif command -v docker &>/dev/null; then
    cid=$(docker create "$REGISTRY:$tag" /bin/true 2>/dev/null)
    docker cp "$cid:/" "$dest/" 2>/dev/null || true
    docker rm "$cid" &>/dev/null || true
  else
    echo "错误: 需要 crane 或 docker。" >&2
    echo "安装 crane: go install github.com/google/go-containerregistry/cmd/crane@latest" >&2
    exit 1
  fi

  if [[ -f "$dest/boot/vmlinuz" ]]; then
    echo "  ✓ $ver 下载完成"
  else
    echo "  ⚠ $ver 提取失败，未找到 vmlinuz" >&2
    find "$dest" -name "vmlinuz*" -o -name "bzImage*" 2>/dev/null || true
  fi
done

echo ""
echo "=== 内核清单 ==="
for ver in "${REQUESTED[@]}"; do
  if [[ -f "$KERNELS_DIR/$ver/boot/vmlinuz" ]]; then
    size=$(du -sh "$KERNELS_DIR/$ver/boot/vmlinuz" | cut -f1)
    echo "  ✓ $ver  ($size)"
  else
    echo "  ✗ $ver  (未就绪)"
  fi
done
