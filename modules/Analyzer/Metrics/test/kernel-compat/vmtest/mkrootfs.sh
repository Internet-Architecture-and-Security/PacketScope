#!/usr/bin/env bash
# mkrootfs.sh — 构建 vmtest 最小 initramfs。
#
# 内容:
#   - busybox (static)       — shell + coreutils
#   - Go 测试二进制 (static) — 从 runner/ 编译
#   - eBPF 对象文件          — 从 bpf/out/ 取得
#
# 输出: test/kernel-compat/vmtest/rootfs.cpio.gz
#
# 用法:
#   cd modules/Analyzer/Metrics
#   ./test/kernel-compat/vmtest/mkrootfs.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ROOTFS_DIR="$SCRIPT_DIR/.rootfs"
OUTPUT="$SCRIPT_DIR/rootfs.cpio.gz"

echo "=== 构建 vmtest rootfs ==="

# 1. 清理上次构建
rm -rf "$ROOTFS_DIR"
mkdir -p "$ROOTFS_DIR"/{bin,dev,proc,sys,tmp,etc,root,run}

# 2. 安装 busybox
BUSYBOX=$(command -v busybox 2>/dev/null || true)
if [[ -z "$BUSYBOX" ]]; then
  echo "错误: 未找到 busybox。安装: sudo apt install busybox-static" >&2
  exit 1
fi
cp "$BUSYBOX" "$ROOTFS_DIR/bin/busybox"
for cmd in sh ls cat echo mount mkdir grep sleep uname ip ifconfig nc netstat; do
  ln -sf busybox "$ROOTFS_DIR/bin/$cmd"
done

# 3. 编译 eBPF 对象（如不存在）
EBPF_OBJ="$ROOT/bpf/out/metrics_bpf.o"
if [[ ! -f "$EBPF_OBJ" ]]; then
  echo "编译 eBPF 对象 ..."
  bash "$ROOT/scripts/build-ebpf.sh"
fi

# 4. 编译 Go 测试二进制（静态链接，可在 VM 中以 PID 1 运行）
echo "编译 vmtest runner ..."
cd "$ROOT"
CGO_ENABLED=0 go test -c \
  -tags vmtest \
  -o "$ROOTFS_DIR/bin/vmtest-runner" \
  -ldflags="-s -w -extldflags=-static" \
  "./test/kernel-compat/vmtest/runner/" 2>&1
echo "  ✓ 测试二进制已编译"

# 5. 编译 metrics 服务二进制（WebSocket 功能测试所需）
echo "编译 metrics 服务二进制 ..."
CGO_ENABLED=0 go build \
  -o "$ROOTFS_DIR/bin/metrics" \
  -ldflags="-s -w -extldflags=-static" \
  "$ROOT/cmd/metrics/" 2>&1
echo "  ✓ metrics 二进制已编译"

# 6. 复制 eBPF 对象
mkdir -p "$ROOTFS_DIR/root/bpf"
cp "$EBPF_OBJ" "$ROOTFS_DIR/root/bpf/"
echo "  ✓ eBPF 对象已复制"

# 7. 创建 init 脚本（VM 内 PID 1）
cat > "$ROOTFS_DIR/init" << 'INIT_EOF'
#!/bin/sh
mount -t proc    proc    /proc
mount -t sysfs   sysfs   /sys
mount -t debugfs debugfs /sys/kernel/debug 2>/dev/null || true
mount -t bpf     bpf     /sys/fs/bpf       2>/dev/null || true
mount -t tmpfs   tmpfs   /tmp

# 配置 loopback（WebSocket 功能测试需要 127.0.0.1）
ip link set lo up 2>/dev/null || ifconfig lo 127.0.0.1 up 2>/dev/null || true
ip addr add 127.0.0.1/8 dev lo 2>/dev/null || true

echo "========================================"
echo "PacketScope Metrics vmtest: $(uname -r)"
echo "========================================"

if [ -f /sys/kernel/btf/vmlinux ]; then
  echo "BTF: available"
else
  echo "BTF: NOT available — tests will be skipped"
fi

echo ""
echo "=== 运行内核兼容性测试 ==="
EBPF_OBJ_PATH=/root/bpf/metrics_bpf.o \
  /bin/vmtest-runner -test.v -test.timeout=120s 2>&1
TEST_EXIT=$?

echo ""
echo "========================================"
if [ $TEST_EXIT -eq 0 ]; then
  echo "RESULT: PASS (kernel $(uname -r))"
else
  echo "RESULT: FAIL (kernel $(uname -r), exit=$TEST_EXIT)"
fi
echo "========================================"

poweroff -f
INIT_EOF
chmod +x "$ROOTFS_DIR/init"

# 7. 打包 cpio initramfs
echo "打包 rootfs ..."
(cd "$ROOTFS_DIR" && find . | cpio -o -H newc --quiet 2>/dev/null | gzip -1) > "$OUTPUT"
SIZE=$(du -sh "$OUTPUT" | cut -f1)
echo "✓ rootfs 已生成: $OUTPUT ($SIZE)"

rm -rf "$ROOTFS_DIR"
