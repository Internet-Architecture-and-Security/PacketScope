# Metrics 测试指南

## 概览

Metrics 模块包含三类测试，分别面向开发者的不同需求：

| 类型 | 命令 | 是否需要 root | 是否需要 QEMU | 运行时间 |
|------|------|:---:|:---:|------|
| **单元测试** | `./test.sh unit` | 否 | 否 | < 5 秒 |
| **BPF 集成测试** | `./test.sh integration` | 是 | 否 | < 10 秒 |
| **跨内核 vmtest** | `./test.sh vmtest` | 是 | 是 | ~10 分钟 |

---

## 快速开始

```bash
cd modules/Analyzer/Metrics

# 首次使用：安装依赖 + 下载内核镜像
./test.sh setup

# 日常开发：只跑单元测试
./test.sh unit

# 提交前：跑完整跨内核测试
sudo -E ./test.sh vmtest
```

---

## 一、单元测试

无需 root 权限，无需 QEMU，适合日常开发迭代。

```bash
./test.sh unit
```

### 覆盖范围

| 测试文件 | 测试内容 |
|----------|----------|
| `test/aggregation_test.go` | AGG slot 编码/解码、PERCPU 求和算法 |
| `test/websocket_test.go` | WebSocket 消息格式、ParseParams、五元组解析 |

### 直接使用 go test

```bash
# 全部单元测试
go test -count=1 ./test/

# 指定测试名称（支持正则）
go test -v -run TestAggIdx ./test/
go test -v -run TestSumPerCPU ./test/
go test -v -run TestParseParams ./test/

# 带覆盖率
go test -cover ./test/
```

---

## 二、BPF 集成测试

验证 eBPF 程序能在当前宿主机内核上正常加载。需要 root 权限。

```bash
sudo -E ./test.sh integration
```

### 前置条件

```bash
# 宿主机内核需 >= 5.10 并启用 BTF
ls /sys/kernel/btf/vmlinux   # 存在则 BTF 可用

# 安装 clang/llvm（编译 eBPF 对象）
sudo apt install clang llvm
```

### 直接使用 go test

```bash
# 先编译 eBPF 对象
./scripts/build-ebpf.sh

# 运行 BPF 引擎加载测试（需要 root）
sudo go test -v -run TestBPFEngine ./test/
```

---

## 三、跨内核 QEMU vmtest

在隔离 QEMU 虚拟机中验证 eBPF 代码对多个 Linux 内核版本的兼容性。
这是发现内核版本特定 bug 的核心手段。

### 前置条件

```bash
# 1. 安装 QEMU
sudo apt install qemu-system-x86

# 2. 安装 busybox-static（构建 initramfs）
sudo apt install busybox-static

# 3. 安装 jq（解析内核矩阵配置）
sudo apt install jq

# 4. 下载内核镜像（来自 ghcr.io/cilium/ci-kernels，约 200MB）
./test/kernel-compat/vmtest/fetch-kernels.sh
```

### 运行测试

```bash
# 测试所有支持的内核版本
sudo -E ./test.sh vmtest

# 测试指定内核版本
sudo -E ./test.sh vmtest 5.15 6.6

# 通过环境变量指定版本
KERNELS="5.10 5.15 6.1 6.6 6.12" sudo -E ./test.sh vmtest

# 调整每个 VM 的超时时间（默认 120 秒）
TIMEOUT=180 sudo -E ./test.sh vmtest
```

> **为什么需要 `sudo -E`？**
> QEMU 启动内核需要创建虚拟硬件设备，需要 root 权限；`-E` 保留当前用户的环境变量（如 `GOPATH`、`PATH`）。

### 直接使用底层脚本

```bash
cd modules/Analyzer/Metrics

# 步骤 1：编译 eBPF 对象
./scripts/build-ebpf.sh

# 步骤 2：构建测试用 initramfs
./test/kernel-compat/vmtest/mkrootfs.sh

# 步骤 3：运行 QEMU 测试
sudo -E ./test/kernel-compat/vmtest/run-vmtest.sh
sudo -E ./test/kernel-compat/vmtest/run-vmtest.sh 5.15 6.6    # 指定版本
```

### 查看测试日志

每次 vmtest 运行后，各内核的完整测试日志保存在：

```
test/kernel-compat/vmtest/results/
├── 5.10.log
├── 5.15.log
├── 6.1.log
├── 6.6.log
└── 6.12.log
```

```bash
# 查看某个内核的完整测试输出
cat test/kernel-compat/vmtest/results/6.6.log

# 只看失败的测试
grep -A 5 "FAIL" test/kernel-compat/vmtest/results/6.6.log
```

---

## 四、支持的内核版本矩阵

**最低支持版本：Linux 5.10**

> RX/TX 探针使用 `fentry`（`BPF_PROG_TYPE_TRACING`），该特性在 Linux 5.5 引入。
> cilium/ci-kernels 可用的最早镜像为 5.10，且 5.4～5.9 已全部 EOL，故最低支持 5.10 LTS。
> 下载低于 5.10 的内核镜像时，`fetch-kernels.sh` 会报错并拒绝下载。

配置文件：`test/kernel-compat/vmtest/kernel-matrix.json`

| 内核版本 | LTS 用途 | fentry | kfree_skb reason | Drop 钩子 |
|--------|---------|:------:|:-------:|------|
| 5.10 | Ubuntu 20.04，**最低支持版本** | ✓ | ✗ | kprobe/tcp_drop |
| 5.15 | Ubuntu 22.04 默认 | ✓ | ✗ | kprobe/tcp_drop |
| 6.1 | Debian 12 默认 | ✓ | ✓ | kprobe/tcp_drop_reason |
| 6.6 | Ubuntu 24.04 默认 | ✓ | ✓ | kprobe/tcp_drop_reason |
| 6.12 | 最新 LTS | ✓ | ✓ | kprobe/tcp_drop_reason |

### Drop 钩子的三层回退策略

Drop 探针需要跨内核兼容，Go 加载器在运行时按优先级逐一尝试：

```
优先级 1: kprobe/tcp_drop_reason  (内核 >= 6.1)
    ↓ 失败（符号不存在）
优先级 2: kprobe/tcp_drop         (内核 5.10 ~ 5.15)
    ↓ 失败（符号不存在）
优先级 3: tracepoint/skb/kfree_skb (通用回退，所有内核)
    - 使用 CO-RE bpf_core_field_exists(ctx->reason) 判断
    - reason 字段存在时：过滤 reason > 0 的真实丢包
    - reason 字段不存在时：程序直接返回 0（无法计数）
```

---

## 五、测试文件结构

```
modules/Analyzer/Metrics/
├── test.sh                              # 一站式测试脚本（本文档主角）
├── test/
│   ├── aggregation_test.go              # 聚合算法单元测试
│   ├── integration_test.go              # BPF 引擎集成测试
│   ├── websocket_test.go                # WebSocket 协议单元测试
│   └── kernel-compat/
│       └── vmtest/
│           ├── kernel-matrix.json       # 支持的内核版本及特性矩阵
│           ├── fetch-kernels.sh         # 下载 CI 内核镜像
│           ├── mkrootfs.sh              # 构建 initramfs（含测试二进制）
│           ├── run-vmtest.sh            # 启动 QEMU 运行测试
│           ├── kernels/                 # 下载的内核镜像（gitignore）
│           ├── results/                 # 每次测试的 VM 串口日志
│           └── runner/
│               ├── kernel_compat_test.go  # 内核兼容性测试（在 VM 内运行）
│               └── ws_functional_test.go  # WebSocket 功能测试（在 VM 内运行）
```

### vmtest runner 测试用例

| 测试名称 | 验证内容 |
|----------|----------|
| `TestKernelFeatures` | 打印内核特性（BTF、fentry、kfree_skb_reason 可用性） |
| `TestObjectLoads` | eBPF 对象加载成功，所有 program/map 存在 |
| `TestRXHooksAttach` | RX fentry 探针可以挂载 |
| `TestTXHooksAttach` | TX fentry 探针可以挂载 |
| `TestDropHookAttach` | Drop 三级回退链：至少一个钩子可挂载 |
| `TestDropHookBehavior` | **行为验证**：挂载后真实丢包计数 > 0 |
| `TestAggMapReadWrite` | PERCPU_ARRAY agg_map 可读写 |
| `TestFilterMapsReadWrite` | 五元组过滤 map 可读写 |
| `TestAllProbesAttachSimultaneously` | 全部探针同时挂载不冲突 |
| `TestWSFunctional` | WebSocket 服务启动 + 接收到有效数据帧 |
| `TestWSMessageFormat` | 消息 JSON 格式符合协议规范 |

---

## 六、常见问题

### Q: `./test.sh vmtest` 报 "内核未找到，跳过"

说明对应版本的内核镜像未下载。

```bash
# 下载缺失的内核
./test/kernel-compat/vmtest/fetch-kernels.sh 5.15 6.6

# 或重新下载全部
./test/kernel-compat/vmtest/fetch-kernels.sh
```

### Q: vmtest 报 "⚠ KVM 不可用，回退到 TCG（速度变慢）"

说明当前环境没有 KVM 支持（如嵌套虚拟化被禁用）。测试仍可以运行，但速度会慢 5~10 倍，可增大超时时间：

```bash
TIMEOUT=300 sudo -E ./test.sh vmtest
```

### Q: `TestDropHookBehavior` 在某个内核上被 skip

这是预期行为。该测试在 tracepoint format 无 `reason` 字段时自动跳过（意味着 CO-RE `bpf_core_field_exists` 会返回 0，无法统计有效丢包）。查看跳过原因：

```bash
grep "SKIP\|kfree_skb" test/kernel-compat/vmtest/results/5.10.log
```

### Q: 如何添加新的内核版本

1. 在 `kernel-matrix.json` 中添加新条目（参照现有格式）
2. 运行 `fetch-kernels.sh <新版本>` 下载镜像
3. 运行 `./test.sh vmtest <新版本>` 验证

### Q: BPF 集成测试失败，报 "permission denied"

```bash
# 确认以 root 运行
sudo -E ./test.sh integration

# 检查 BTF 是否可用
ls /sys/kernel/btf/vmlinux
```

### Q: 如何在 CI/CD 中运行 vmtest

由于需要 QEMU 和 KVM，建议在 CI 中使用支持嵌套虚拟化的 runner（如 GitHub Actions 的 `ubuntu-latest` + 自托管 bare-metal runner）：

```yaml
# .github/workflows/vmtest.yml 示例片段
- name: Install dependencies
  run: sudo apt install -y qemu-system-x86 busybox-static jq

- name: Fetch kernels
  run: ./test/kernel-compat/vmtest/fetch-kernels.sh

- name: Run vmtest
  run: sudo -E TIMEOUT=180 ./test.sh vmtest
```
