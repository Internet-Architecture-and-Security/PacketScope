# Metrics Testing Guide

## Overview

The Metrics module contains three types of tests targeted at different developer needs:

| Type | Command | Requires Root | Requires QEMU | Run Time |
|------|---------|:-----------:|:-----------:|----------|
| **Unit Tests** | `./test.sh unit` | No | No | < 5 sec |
| **BPF Integration Tests** | `./test.sh integration` | Yes | No | < 10 sec |
| **Cross-kernel vmtest** | `./test.sh vmtest` | Yes | Yes | ~10 mins |

---

## Quick Start

```bash
cd modules/Analyzer/Metrics

# First time: Install dependencies + Fetch kernel images
./test.sh setup

# Daily dev: Run unit tests only
./test.sh unit

# Pre-commit: Run full cross-kernel testing
sudo -E ./test.sh vmtest
```

---

## I. Unit Tests

Requires no root privileges and no QEMU. Ideal for local daily iteration.

```bash
./test.sh unit
```

### Coverage Scope

| Test File | Verification Contents |
|----------|----------|
| `test/aggregation_test.go` | AGG slot encode/decode, PERCPU summation algorithm |
| `test/websocket_test.go` | WebSocket message formats, ParseParams, 5-tuple payload parsing |

### Direct go test usage

```bash
# All unit tests
go test -count=1 ./test/

# Specific test name (supports Regex)
go test -v -run TestAggIdx ./test/
go test -v -run TestSumPerCPU ./test/
go test -v -run TestParseParams ./test/

# With coverage
go test -cover ./test/
```

---

## II. BPF Integration Tests

Verifies that the eBPF program can successfully load into the current host's kernel. Requires root.

```bash
sudo -E ./test.sh integration
```

### Prerequisites

```bash
# Host kernel must be >= 5.10 with BTF enabled
ls /sys/kernel/btf/vmlinux   # If it exists, BTF is supported

# Install clang/llvm (to compile eBPF objects)
sudo apt install clang llvm
```

### Direct go test usage

```bash
# Compile eBPF objects first
./scripts/build-ebpf.sh

# Run BPF engine loading test (root required)
sudo go test -v -run TestBPFEngine ./test/
```

---

## III. Cross-Kernel QEMU vmtest

Validates the compatibility of eBPF code across multiple Linux kernel versions inside isolated QEMU virtual machines.
This is the primary way to uncover kernel version-specific bugs.

### Prerequisites

```bash
# 1. Install QEMU
sudo apt install qemu-system-x86

# 2. Install busybox-static (to build initramfs)
sudo apt install busybox-static

# 3. Install jq (to parse the kernel matrix spec)
sudo apt install jq

# 4. Fetch kernel images (from ghcr.io/cilium/ci-kernels, ~200MB)
./test/kernel-compat/vmtest/fetch-kernels.sh
```

### Run Tests

```bash
# Test all supported kernel versions
sudo -E ./test.sh vmtest

# Test specific kernel versions
sudo -E ./test.sh vmtest 5.15 6.6

# Specify versions via environment variable
KERNELS="5.10 5.15 6.1 6.6 6.12" sudo -E ./test.sh vmtest

# Adjust timeout per VM (defaults to 120 secs)
TIMEOUT=180 sudo -E ./test.sh vmtest
```

> **Why `sudo -E`?**
> Booting QEMU kernels creates virtual hardware devices requiring root; `-E` preserves current user's env vars (e.g. `GOPATH`, `PATH`).

### Run via Low-Level Scripts

```bash
cd modules/Analyzer/Metrics

# Step 1: Compile eBPF objects
./scripts/build-ebpf.sh

# Step 2: Build test initramfs
./test/kernel-compat/vmtest/mkrootfs.sh

# Step 3: Run QEMU tests
sudo -E ./test/kernel-compat/vmtest/run-vmtest.sh
sudo -E ./test/kernel-compat/vmtest/run-vmtest.sh 5.15 6.6    # specific versions
```

### View Test Logs

After a vmtest sequence finishes, complete log outputs per kernel are saved at:

```
test/kernel-compat/vmtest/results/
├── 5.10.log
├── 5.15.log
├── 6.1.log
├── 6.6.log
└── 6.12.log
```

```bash
# Check complete output for a specific kernel
cat test/kernel-compat/vmtest/results/6.6.log

# Check only failed tests
grep -A 5 "FAIL" test/kernel-compat/vmtest/results/6.6.log
```

---

## IV. Supported Kernel Version Matrix

**Minimum Supported Version: Linux 5.10**

> RX/TX probes use `fentry` (`BPF_PROG_TYPE_TRACING`), a feature introduced in Linux 5.5.
> The earliest kernel image available from cilium/ci-kernels is 5.10. Further, 5.4-5.9 are EOL, so 5.10 LTS is our baseline.
> When attempting to download kernels below 5.10, `fetch-kernels.sh` will reject it.

Config list: `test/kernel-compat/vmtest/kernel-matrix.json`

| Kernel Version | LTS Usage | fentry | kfree_skb reason | Drop Hook |
|--------|---------|:------:|:-------:|------|
| 5.10 | Ubuntu 20.04, **Minimum Support Baseline** | ✓ | ✗ | kprobe/tcp_drop |
| 5.15 | Ubuntu 22.04 default | ✓ | ✗ | kprobe/tcp_drop |
| 6.1 | Debian 12 default | ✓ | ✓ | kprobe/tcp_drop_reason |
| 6.6 | Ubuntu 24.04 default | ✓ | ✓ | kprobe/tcp_drop_reason |
| 6.12 | Latest LTS | ✓ | ✓ | kprobe/tcp_drop_reason |

### Drop Hook 3-Tier Fallback Strategy

Drop probes require broad cross-kernel compatibility, so the Go loader attempts the following chain by priority during initialization:

```
Priority 1: kprobe/tcp_drop_reason  (Kernel >= 6.1)
    ↓ Failed (symbol not found)
Priority 2: kprobe/tcp_drop         (Kernel 5.10 ~ 5.15)
    ↓ Failed (symbol not found)
Priority 3: tracepoint/skb/kfree_skb (Generic fallback, all kernels)
    - Uses CO-RE bpf_core_field_exists(ctx->reason) check
    - If 'reason' exists: Filter out reason > 0 representing actual packet drops
    - If 'reason' does not exist: Directly returns 0 (skips metric collection)
```

---

## V. Testing Directory Tree

```
modules/Analyzer/Metrics/
├── test.sh                              # Main one-stop wrapper script
├── test/
│   ├── aggregation_test.go              # Unit test: Aggregation logic
│   ├── integration_test.go              # Integration: BPF Engine load tests
│   ├── websocket_test.go                # Unit test: WebSocket messaging
│   └── kernel-compat/
│       └── vmtest/
│           ├── kernel-matrix.json       # Supported kernel variants list
│           ├── fetch-kernels.sh         # Fetch CI kernel images
│           ├── mkrootfs.sh              # Build initramfs (packs test bins)
│           ├── run-vmtest.sh            # Boot QEMU & run
│           ├── kernels/                 # Dropped kernel images (gitignore)
│           ├── results/                 # Serial logs per VM run
│           └── runner/
│               ├── kernel_compat_test.go  # Kernel compat suite (runs inside VM)
│               └── ws_functional_test.go  # WS functional suite (runs inside VM)
```

### vmtest Runner Test Cases

| Case Name | Scope / Purpose |
|----------|----------|
| `TestKernelFeatures` | Echoes kernel support (BTF, fentry, kfree_skb_reason) |
| `TestObjectLoads` | Main eBPF ELF loads perfectly and map/progs are present |
| `TestRXHooksAttach` | RX fentry hooks are capable of attaching |
| `TestTXHooksAttach` | TX fentry hooks are capable of attaching |
| `TestDropHookAttach` | Asserts Drop hook multi-fallback successfully attached to at least one |
| `TestDropHookBehavior` | **Behavioral Validate**: Real drop counters > 0 upon simulated fault |
| `TestAggMapReadWrite` | PERCPU_ARRAY agg_map r/w functionality |
| `TestFilterMapsReadWrite` | Filter Maps r/w capability |
| `TestAllProbesAttachSimultaneously` | Attach all links alongside each other smoothly |
| `TestWSFunctional` | Start local WebSocket service and correctly process traffic frames |
| `TestWSMessageFormat` | Checks valid conformity of emitted JSON formats |

---

## VI. FAQ

### Q: `./test.sh vmtest` throws "kernel not found, skipping"

The required kernel version image is missing from disks.

```bash
# Fetch missing images explicitly
./test/kernel-compat/vmtest/fetch-kernels.sh 5.15 6.6

# Or fetch everything
./test/kernel-compat/vmtest/fetch-kernels.sh
```

### Q: vmtest indicates "⚠ KVM unavailable, falling back to TCG (slow)"

The current environment does not have KVM natively exposed (like disabled nested virt). Tests can still complete, but expect a 5-10x slowdown. Extend timeout parameters to compensate:

```bash
TIMEOUT=300 sudo -E ./test.sh vmtest
```

### Q: `TestDropHookBehavior` gets skipped on a certain kernel

This is the expected outcome. It happens when the `kfree_skb` tracepoint payload misses the `reason` struct attribute, driving CO-RE `bpf_core_field_exists` to gracefully back off (effectively blocking valid drop filtering). Look inside serial logs:

```bash
grep "SKIP\|kfree_skb" test/kernel-compat/vmtest/results/5.10.log
```

### Q: How to introduce tests for a new kernel baseline

1. Insert a new stanza inside `kernel-matrix.json` (match schema format)
2. Run `./test/kernel-compat/vmtest/fetch-kernels.sh <new_version>`
3. Prove logic holds up using `./test.sh vmtest <new_version>`

### Q: BPF integration tests fail with "permission denied"

```bash
# Always use sudo -E
sudo -E ./test.sh integration

# Assure Kernel space exhibits BTF payloads
ls /sys/kernel/btf/vmlinux
```

### Q: How to automate vmtest inside CI/CD

Since it explicitly calls upon QEMU and optimal KVM access, preferably select a runner endowed with nested virt capabilities (like typical GitHub Actions `ubuntu-latest` nodes or self-hosted bare metal servers):

```yaml
# .github/workflows/vmtest.yml snippet example
- name: Install dependencies
  run: sudo apt install -y qemu-system-x86 busybox-static jq

- name: Fetch kernels
  run: ./test/kernel-compat/vmtest/fetch-kernels.sh

- name: Run vmtest
  run: sudo -E TIMEOUT=180 ./test.sh vmtest
```
