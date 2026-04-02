#!/usr/bin/env bash
# run-vmtest.sh — 启动 QEMU VM 在不同内核版本上运行 eBPF 兼容性测试。
#
# 用法:
#   cd modules/Analyzer/Metrics
#   sudo -E ./test/kernel-compat/vmtest/run-vmtest.sh              # 测试所有内核
#   sudo -E ./test/kernel-compat/vmtest/run-vmtest.sh 5.15 6.6     # 指定版本
#   sudo -E ./test/kernel-compat/vmtest/run-vmtest.sh --arch arm64 6.6
#   TIMEOUT=180 sudo -E ./test/kernel-compat/vmtest/run-vmtest.sh  # 调整超时
#
# 前置条件:
#   1. QEMU:    sudo apt install qemu-system-x86
#   2. 内核:    ./test/kernel-compat/vmtest/fetch-kernels.sh
#   3. rootfs:  ./test/kernel-compat/vmtest/mkrootfs.sh  (或先 make build-ebpf)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KERNELS_DIR="$SCRIPT_DIR/kernels"
ROOTFS="$SCRIPT_DIR/rootfs.cpio.gz"
RESULTS_DIR="$SCRIPT_DIR/results"
TIMEOUT="${TIMEOUT:-120}"
ARCH="x86_64"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 解析 --arch 参数
ARGS=()
while [[ $# -gt 0 ]]; do
  case $1 in
    --arch) ARCH="$2"; shift 2 ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
set -- "${ARGS[@]+"${ARGS[@]}"}"

QEMU_BIN="qemu-system-${ARCH}"

if [[ ! -f "$ROOTFS" ]]; then
  echo "错误: rootfs 不存在。先运行:" >&2
  echo "  ./test/kernel-compat/vmtest/mkrootfs.sh" >&2
  exit 1
fi

if ! command -v "$QEMU_BIN" &>/dev/null; then
  echo "错误: 未找到 $QEMU_BIN。安装: sudo apt install qemu-system-x86" >&2
  exit 1
fi

# KVM 检测
ACCEL="-cpu host -enable-kvm"
if [[ ! -w /dev/kvm ]] 2>/dev/null; then
  echo -e "${YELLOW}⚠ KVM 不可用，回退到 TCG（速度变慢）${NC}"
  ACCEL="-cpu max"
fi

# 解析待测版本
REQUESTED=("$@")
if [[ ${#REQUESTED[@]} -eq 0 ]]; then
  if command -v jq &>/dev/null && [[ -f "$SCRIPT_DIR/kernel-matrix.json" ]]; then
    mapfile -t REQUESTED < <(jq -r '.kernels[].version' "$SCRIPT_DIR/kernel-matrix.json")
  else
    mapfile -t REQUESTED < <(ls "$KERNELS_DIR" 2>/dev/null)
  fi
fi

mkdir -p "$RESULTS_DIR"

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
SUMMARY=()

run_vm() {
  local ver="$1"
  local kernel_dir="$KERNELS_DIR/$ver"
  local vmlinuz=""
  local logfile="$RESULTS_DIR/$ver.log"

  # 查找 vmlinuz
  for candidate in \
    "$kernel_dir/boot/vmlinuz" \
    "$kernel_dir/vmlinuz" \
    "$kernel_dir/boot/vmlinuz-"* \
    "$kernel_dir/vmlinuz-"*; do
    if [[ -f "$candidate" ]]; then
      vmlinuz="$candidate"
      break
    fi
  done

  if [[ -z "$vmlinuz" ]]; then
    echo -e "${YELLOW}⚠ $ver: 内核未找到，跳过（运行 fetch-kernels.sh）${NC}"
    SKIP_COUNT=$((SKIP_COUNT + 1))
    SUMMARY+=("SKIP     $ver  (kernel not downloaded)")
    return
  fi

  echo -n "  ⏳ $ver: 启动 VM ..."
  > "$logfile"

  timeout --kill-after=10 "$TIMEOUT" "$QEMU_BIN" \
    $ACCEL \
    -m 512 \
    -smp 2 \
    -display none \
    -vga none \
    -no-reboot \
    -monitor none \
    -kernel "$vmlinuz" \
    -initrd "$ROOTFS" \
    -append "console=ttyS0 quiet panic=-1" \
    -serial file:"$logfile" \
    </dev/null 2>/dev/null || true

  if grep -q "RESULT: PASS" "$logfile"; then
    echo -e "\r${GREEN}  ✓ $ver: PASS${NC}                        "
    PASS_COUNT=$((PASS_COUNT + 1))
    SUMMARY+=("PASS     $ver")
    # 显示测试摘要
    grep -E "^    --- (PASS|FAIL)|^--- (PASS|FAIL)" "$logfile" 2>/dev/null | head -20 | sed 's/^/    /' || true
  elif grep -q "RESULT: FAIL" "$logfile"; then
    echo -e "\r${RED}  ✗ $ver: FAIL${NC}                        "
    FAIL_COUNT=$((FAIL_COUNT + 1))
    SUMMARY+=("FAIL     $ver")
    echo "    --- 失败详情 ---"
    grep -E "FAIL|panic|Error|错误" "$logfile" | head -20 | sed 's/^/    /'
    echo "    详细日志: $logfile"
  else
    echo -e "\r${YELLOW}  ? $ver: 超时或崩溃${NC}                  "
    FAIL_COUNT=$((FAIL_COUNT + 1))
    SUMMARY+=("TIMEOUT  $ver")
    echo "    --- 最后输出 ---"
    tail -15 "$logfile" | sed 's/^/    /'
  fi
}

echo -e "${CYAN}"
echo "╔════════════════════════════════════════╗"
echo "║  PacketScope Metrics 跨内核兼容性测试  ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"
echo "QEMU:     $($QEMU_BIN --version | head -1)"
echo "架构:     $ARCH"
echo "内核版本: ${REQUESTED[*]}"
echo "超时:     ${TIMEOUT}s / VM"
echo ""

for ver in "${REQUESTED[@]}"; do
  run_vm "$ver"
done

echo ""
echo "════════════════════════════════════════"
echo "测试结果汇总"
echo "════════════════════════════════════════"
for line in "${SUMMARY[@]}"; do
  if [[ "$line" == PASS* ]]; then
    echo -e "  ${GREEN}$line${NC}"
  elif [[ "$line" == FAIL* || "$line" == TIMEOUT* ]]; then
    echo -e "  ${RED}$line${NC}"
  else
    echo -e "  ${YELLOW}$line${NC}"
  fi
done
echo ""
echo -e "通过: ${GREEN}$PASS_COUNT${NC}  失败: ${RED}$FAIL_COUNT${NC}  跳过: ${YELLOW}$SKIP_COUNT${NC}"

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo ""
  echo -e "${RED}完整日志目录: $RESULTS_DIR/${NC}"
  exit 1
fi
