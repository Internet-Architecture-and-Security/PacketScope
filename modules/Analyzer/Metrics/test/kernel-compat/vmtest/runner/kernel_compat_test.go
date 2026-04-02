//go:build vmtest

// Package runner_test 是运行在 QEMU VM 内核态的跨内核兼容性测试集。
//
// 每个 QEMU VM 启动后，此二进制以 PID 1 运行，逐一测试 eBPF 探针是否能
// 在当前内核版本上成功加载和挂载。
//
// 测试文件由 mkrootfs.sh 静态编译后内嵌至 initramfs。
package runner_test

import (
	"encoding/binary"
	"fmt"
	"net"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/cilium/ebpf"
	"github.com/cilium/ebpf/link"
	"github.com/cilium/ebpf/rlimit"
)

// ─── 测试初始化 ───────────────────────────────────────────────────────────────

func TestMain(m *testing.M) {
	if err := rlimit.RemoveMemlock(); err != nil {
		fmt.Fprintf(os.Stderr, "WARNING: rlimit.RemoveMemlock: %v\n", err)
	}
	os.Exit(m.Run())
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

// objPath 返回 eBPF 对象路径（环境变量或默认位置）。
func objPath(t *testing.T) string {
	t.Helper()
	p := os.Getenv("EBPF_OBJ_PATH")
	if p == "" {
		p = "/root/bpf/metrics_bpf.o"
	}
	if _, err := os.Stat(p); err != nil {
		t.Skipf("eBPF object not available: %s", p)
	}
	return p
}

// requireBTF 在无 BTF 的内核上 skip 所有测试。
func requireBTF(t *testing.T) {
	t.Helper()
	if _, err := os.Stat("/sys/kernel/btf/vmlinux"); err != nil {
		t.Skip("BTF not available — all eBPF tests skipped on this kernel")
	}
}

// kernelHasSymbol 通过 /proc/kallsyms 检测内核符号。
func kernelHasSymbol(symbol string) bool {
	data, err := os.ReadFile("/proc/kallsyms")
	if err != nil {
		return false
	}
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 3 && fields[2] == symbol {
			return true
		}
	}
	return false
}

// kernelHasTracepoint 检测指定 tracepoint 是否存在。
func kernelHasTracepoint(group, event string) bool {
	path := fmt.Sprintf("/sys/kernel/debug/tracing/events/%s/%s", group, event)
	_, err := os.Stat(path)
	return err == nil
}

// loadSpec 加载 BPF collection spec，失败则 Fatal。
func loadSpec(t *testing.T) *ebpf.CollectionSpec {
	t.Helper()
	spec, err := ebpf.LoadCollectionSpec(objPath(t))
	if err != nil {
		t.Fatalf("LoadCollectionSpec: %v", err)
	}
	return spec
}

// loadCollection 加载 BPF collection（全部 program），失败则 Fatal。
func loadCollection(t *testing.T) *ebpf.Collection {
	t.Helper()
	spec := loadSpec(t)
	coll, err := ebpf.NewCollection(spec)
	if err != nil {
		t.Fatalf("NewCollection: %v", err)
	}
	return coll
}

// attachTracing 通过 fentry/tp_btf 方式挂载，失败则报告错误。
func attachTracing(t *testing.T, prog *ebpf.Program, name string) link.Link {
	t.Helper()
	var lk link.Link
	var err error
	if strings.HasPrefix(name, "tracepoint/") {
		parts := strings.SplitN(strings.TrimPrefix(name, "tracepoint/"), "/", 2)
		if len(parts) == 2 {
			lk, err = link.Tracepoint(parts[0], parts[1], prog, nil)
		} else {
			err = fmt.Errorf("invalid tracepoint name: %s", name)
		}
	} else {
		lk, err = link.AttachTracing(link.TracingOptions{Program: prog})
	}
	if err != nil {
		t.Errorf("attach %s: %v", name, err)
		return nil
	}
	t.Logf("  ✓ %s: attached", name)
	return lk
}

// ─── 内核信息 ─────────────────────────────────────────────────────────────────

// TestKernelFeatures 打印当前内核的能力矩阵，用于分析兼容性问题。
// 此测试永远 PASS，仅作日志用途。
func TestKernelFeatures(t *testing.T) {
	data, _ := os.ReadFile("/proc/version")
	t.Logf("内核版本: %s", strings.TrimSpace(string(data)))

	if _, err := os.Stat("/sys/kernel/btf/vmlinux"); err == nil {
		t.Log("BTF status:  available ✓")
	} else {
		t.Log("BTF status:  NOT available ✗")
	}

	// fentry/kprobe 相关符号
	symbols := []string{
		"netif_receive_skb",
		"ip_local_deliver",
		"ip6_input",
		"inet_recvmsg",
		"inet6_recvmsg",
		"inet_sendmsg",
		"inet6_sendmsg",
		"ip_finish_output",
		"ip6_finish_output",
		"net_dev_start_xmit",
		"kfree_skb",
	}
	t.Log("\n--- 内核符号可用性 ---")
	for _, sym := range symbols {
		avail := "YES ✓"
		if !kernelHasSymbol(sym) {
			avail = "NO  ✗"
		}
		t.Logf("  %-28s %s", sym, avail)
	}

	// kfree_skb reason 参数（内核 5.17 引入）
	t.Logf("\n--- 关键特性 ---")
	t.Logf("  kfree_skb_reason (≥5.17):  %v", kernelHasSymbol("kfree_skb_reason") || kernelHasTracepoint("skb", "kfree_skb_reason"))
	t.Logf("  tracepoint skb/kfree_skb:  %v", kernelHasTracepoint("skb", "kfree_skb"))
}

// ─── 对象加载测试 ─────────────────────────────────────────────────────────────

// TestObjectLoads 验证 BPF 对象可在当前内核上通过 verifier 加载。
// 这是最基础的兼容性测试——若此测试失败，则当前内核完全不支持。
func TestObjectLoads(t *testing.T) {
	requireBTF(t)
	coll := loadCollection(t)
	defer coll.Close()
	t.Logf("BPF 对象加载成功: %d programs, %d maps",
		len(coll.Programs), len(coll.Maps))

	// 验证核心 map 存在
	requiredMaps := []string{"agg_map", "five_tuple_filter_ipv4", "five_tuple_filter_ipv6"}
	for _, name := range requiredMaps {
		if _, ok := coll.Maps[name]; !ok {
			t.Errorf("缺少 map: %s", name)
		} else {
			t.Logf("  map %-30s ✓", name)
		}
	}

	// 验证延迟 map
	latMaps := []string{"start_link", "start_translink", "start_transnetwork"}
	for _, name := range latMaps {
		if _, ok := coll.Maps[name]; !ok {
			t.Errorf("缺少延迟 map: %s", name)
		}
	}
}

// ─── RX 探针测试 ──────────────────────────────────────────────────────────────

// TestRXHooksAttach 验证接收方向的所有探针可成功挂载。
func TestRXHooksAttach(t *testing.T) {
	requireBTF(t)
	coll := loadCollection(t)
	defer coll.Close()

	// 定义 RX 探针: progName → BPF section
	rxHooks := []struct {
		progName string
		section  string
	}{
		{"trace_netif_receive_skb", "tracepoint/net/netif_receive_skb"},
		{"ip_local_deliver_func", "fentry/ip_local_deliver"},
		{"ip6_input_func", "fentry/ip6_input"},
		{"inet_recvmsg_func", "fentry/inet_recvmsg"},
		{"inet6_recvmsg_func", "fentry/inet6_recvmsg"},
	}

	for _, h := range rxHooks {
		prog, ok := coll.Programs[h.progName]
		if !ok {
			t.Errorf("program %s 不在 BPF 对象中", h.progName)
			continue
		}
		lk := attachTracing(t, prog, h.section)
		if lk != nil {
			lk.Close()
		}
	}
}

// ─── TX 探针测试 ──────────────────────────────────────────────────────────────

// TestTXHooksAttach 验证发送方向的所有探针可成功挂载。
func TestTXHooksAttach(t *testing.T) {
	requireBTF(t)
	coll := loadCollection(t)
	defer coll.Close()

	txHooks := []struct {
		progName string
		section  string
	}{
		{"inet_sendmsg_func", "fentry/inet_sendmsg"},
		{"inet6_sendmsg_func", "fentry/inet6_sendmsg"},
		{"ip_finish_output_func", "fentry/ip_finish_output"},
		{"ip6_finish_output_func", "fentry/ip6_finish_output"},
		{"net_dev_start_xmit_func", "tp_btf/net_dev_start_xmit"},
	}

	for _, h := range txHooks {
		prog, ok := coll.Programs[h.progName]
		if !ok {
			t.Errorf("program %s 不在 BPF 对象中", h.progName)
			continue
		}
		lk := attachTracing(t, prog, h.section)
		if lk != nil {
			lk.Close()
		}
	}
}

// ─── DROP 探针测试 ────────────────────────────────────────────────────────────

// TestDropHookAttach 验证丢包探针三钩回退链策略的正确性。
//
// 【重构背景】drop.h 从单一 tp_btf/kfree_skb (kfree_skb_func) 重构为三钩策略：
//
//	Priority 1: kprobe/tcp_drop_reason  (kernel >= 6.1) → tcp_drop_reason_func
//	Priority 2: kprobe/tcp_drop         (kernel <  6.1) → tcp_drop_func
//	Priority 3: tracepoint/skb/kfree_skb (universal)   → trace_kfree_skb
//
// 关键点（之前的测试错误所在）：
//   - 旧测试用 link.AttachTracing 挂 kfree_skb_func，这是 tp_btf 的挂载方式
//   - 新 trace_kfree_skb 是 tracepoint 类型，必须用 link.Tracepoint()
//   - 新 tcp_drop_*_func 是 kprobe 类型，必须用 link.Kprobe()
//   - 三个程序名必须全部存在于 BPF 对象中才算重构正确
func TestDropHookAttach(t *testing.T) {
	requireBTF(t)
	coll := loadCollection(t)
	defer coll.Close()

	// Phase 1: 验证三个 drop program 都存在于 BPF 对象中。
	// 任意一个缺失 → drop.h 重构破坏了程序命名（即刻报告）。
	for _, name := range []string{"tcp_drop_reason_func", "tcp_drop_func", "trace_kfree_skb"} {
		if _, ok := coll.Programs[name]; !ok {
			t.Errorf("BUG: drop program %q 不在 BPF 对象中 — 三钩重构后程序名必须全部保留", name)
		} else {
			t.Logf("  program %-28s ✓ exists", name)
		}
	}
	if t.Failed() {
		t.FailNow()
	}

	// Phase 2: 按优先级依次尝试挂载，要求至少一个成功。
	attached := false

	// Priority 1: kprobe/tcp_drop_reason (kernel >= 6.1)
	if kernelHasSymbol("tcp_drop_reason") {
		lk, err := link.Kprobe("tcp_drop_reason", coll.Programs["tcp_drop_reason_func"], nil)
		if err == nil {
			lk.Close()
			attached = true
			t.Log("  drop hook: kprobe/tcp_drop_reason ✓ (kernel >= 6.1)")
		} else {
			t.Logf("  drop hook: kprobe/tcp_drop_reason skip: %v", err)
		}
	}

	// Priority 2: kprobe/tcp_drop (kernel < 6.1)
	if !attached && kernelHasSymbol("tcp_drop") {
		lk, err := link.Kprobe("tcp_drop", coll.Programs["tcp_drop_func"], nil)
		if err == nil {
			lk.Close()
			attached = true
			t.Log("  drop hook: kprobe/tcp_drop ✓ (kernel < 6.1)")
		} else {
			t.Logf("  drop hook: kprobe/tcp_drop skip: %v", err)
		}
	}

	// Priority 3: tracepoint/skb/kfree_skb (universal fallback)
	if !attached {
		if !kernelHasTracepoint("skb", "kfree_skb") {
			t.Skip("无 kprobe 符号且无 tracepoint skb/kfree_skb — DROP 监控不可用")
		}
		lk, err := link.Tracepoint("skb", "kfree_skb", coll.Programs["trace_kfree_skb"], nil)
		if err == nil {
			lk.Close()
			attached = true
			t.Log("  drop hook: tracepoint/skb/kfree_skb ✓ (fallback)")
		} else {
			t.Errorf("  drop hook: tracepoint/skb/kfree_skb FAIL: %v", err)
		}
	}

	if !attached {
		t.Error("所有 drop 钩子均挂载失败")
	} else if !t.Failed() {
		t.Log("drop 钩子三钩回退链验证: PASS")
	}
}

// TestDropHookBehavior 是行为级测试（TDD 核心）：
// 挂载 drop 钩子 → 生成被内核实际丢弃的数据包 → 验证 agg_map[DROP] 计数器 > 0。
//
// 这是与 TestDropHookAttach 的本质区别：
//
//	TestDropHookAttach = 能否挂上（配置正确性）
//	TestDropHookBehavior = 挂上之后是否真的工作（行为正确性）
//
// 前提: kernel >= 5.17（reason 字段可用，CO-RE 检查通过）。
// 5.10 / 5.15 上 CO-RE bpf_core_field_exists(ctx->reason) 返回 0，
// BPF 程序直接 return 0，计数器永远不增，此测试在这两个内核上 Skip。
func TestDropHookBehavior(t *testing.T) {
	requireBTF(t)

	// 正确判据：读取 tracefs 格式文件，检查 reason 字段是否存在于 tracepoint 事件结构。
	// 这比 /proc/kallsyms 符号检查更精确：
	//   - 5.15/6.1/6.6 CI 内核：反向移植了 kfree_skb_reason 函数（kallsyms 有该符号），
	//     但 tracepoint 事件格式未更新，无 reason 字段 →
	//     bpf_core_field_exists(ctx->reason) = 0 → BPF 返回 0 → 计数器永远不增 → 应当 Skip
	//   - 6.12 CI 内核：kallsyms 被裁剪（无 kfree_skb_reason 符号），
	//     但 tracepoint 格式有 reason 字段 → CO-RE 正常工作 → 应当运行
	fmtData, err := os.ReadFile("/sys/kernel/debug/tracing/events/skb/kfree_skb/format")
	if err != nil {
		t.Skipf("无法读取 kfree_skb tracepoint format 文件 (%v)，跳过行为验证", err)
	}
	if !strings.Contains(string(fmtData), "reason") {
		t.Skip("tracepoint/skb/kfree_skb format 无 reason 字段 — CO-RE bpf_core_field_exists 返回 0，跳过行为验证")
	}
	if !kernelHasTracepoint("skb", "kfree_skb") {
		t.Skip("tracepoint skb/kfree_skb 不存在")
	}

	spec, err := ebpf.LoadCollectionSpec(objPath(t))
	if err != nil {
		t.Fatalf("LoadCollectionSpec: %v", err)
	}
	coll, err := ebpf.NewCollection(spec)
	if err != nil {
		t.Fatalf("NewCollection: %v", err)
	}
	defer coll.Close()

	lk, err := link.Tracepoint("skb", "kfree_skb", coll.Programs["trace_kfree_skb"], nil)
	if err != nil {
		t.Fatalf("attach tracepoint/skb/kfree_skb: %v", err)
	}
	defer lk.Close()

	// five_tuple_filter_ipv4 是 HASH map（非 ARRAY），key=0 默认不存在。
	// BPF match_five_tuple 在 lookup 返回 NULL 时直接拒绝 → 必须先插入全零通配符。
	// 全零 filter：所有字段 = 0 = 通配，匹配任意 IPv4 流量。
	filterKey := uint32(0)
	filterVal := make([]byte, coll.Maps["five_tuple_filter_ipv4"].ValueSize())
	if err := coll.Maps["five_tuple_filter_ipv4"].Put(filterKey, filterVal); err != nil {
		t.Fatalf("set five_tuple_filter_ipv4 wildcard: %v", err)
	}
	t.Log("  five_tuple_filter_ipv4[0] = 全零通配符已设置 ✓")
	t.Log("  trace_kfree_skb 已挂载，向未监听的 UDP 端口发送数据包触发 NO_SOCKET 丢包...")

	// UDP 到未监听端口 → 内核 kfree_skb(SKB_DROP_REASON_NO_SOCKET)
	// 此时 skb 的网络层头字段仍完整， extract_five_tuple 可正确解析
	// 【注意】TCP SYN 到关闭端口会得到 RST 回复，内核对 SYN 的处理可能不会以 reason>0 调用 kfree_skb。
	// UDP 无连接状态，内核必然以 NO_SOCKET 丢弃。
	udpConn, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listenPacket: %v", err)
	}
	defer udpConn.Close()
	dst := &net.UDPAddr{IP: net.ParseIP("127.0.0.1"), Port: 19998}
	// 发送多个包，提高至少一个被捕获的概率
	for i := 0; i < 5; i++ {
		_, _ = udpConn.(*net.UDPConn).WriteToUDP([]byte("drop-trigger"), dst)
		time.Sleep(5 * time.Millisecond)
	}

	// DROP slot: AggIdx(MetricDROP=2, layer=0, dir=0, isIPv6=0) = 2*12 = 24
	const dropSlot = uint32(24)

	// PERCPU_ARRAY: 获取所有 CPU 的原始字节，累加 Packets 字段（uint64，offset 0）
	var perCPUBytes [][]byte
	if err := coll.Maps["agg_map"].Lookup(dropSlot, &perCPUBytes); err != nil {
		t.Fatalf("agg_map lookup slot %d: %v", dropSlot, err)
	}
	total := uint64(0)
	for _, b := range perCPUBytes {
		if len(b) >= 8 {
			total += binary.LittleEndian.Uint64(b[:8])
		}
	}
	t.Logf("  agg_map[DROP,ipv4].packets = %d (across %d CPUs)", total, len(perCPUBytes))
	if total == 0 {
		t.Error("BUG: drop 钩子挂载成功但 agg_map 计数器为 0 — 钩子 attach 但未实际捕获丢包")
	} else {
		t.Log("  drop 行为验证: PASS ✓")
	}
}

// ─── Map 读写测试 ─────────────────────────────────────────────────────────────

// TestAggMapReadWrite 验证聚合 Map 可在内核内被读写。
func TestAggMapReadWrite(t *testing.T) {
	requireBTF(t)
	coll := loadCollection(t)
	defer coll.Close()

	m, ok := coll.Maps["agg_map"]
	if !ok {
		t.Fatal("agg_map 不存在")
	}

	info, err := m.Info()
	if err != nil {
		t.Fatalf("agg_map info: %v", err)
	}
	t.Logf("agg_map: type=%s, maxEntries=%d, valueSize=%d",
		info.Type, info.MaxEntries, m.ValueSize())

	if info.Type != ebpf.PerCPUArray {
		t.Errorf("agg_map 期望类型 PerCPUArray, 实际: %s", info.Type)
	}

	// 验证可读取所有 26 个 slot
	for i := uint32(0); i < 26; i++ {
		var vals [][]byte
		if err := m.Lookup(i, &vals); err != nil {
			t.Errorf("agg_map lookup slot %d: %v", i, err)
		}
	}
	t.Log("agg_map: 26 个聚合 slot 读取 ✓")
}

// TestFilterMapsReadWrite 验证五元组过滤 Map 可被用户态写入（下发过滤规则）。
func TestFilterMapsReadWrite(t *testing.T) {
	requireBTF(t)
	coll := loadCollection(t)
	defer coll.Close()

	for _, mapName := range []string{"five_tuple_filter_ipv4", "five_tuple_filter_ipv6"} {
		m, ok := coll.Maps[mapName]
		if !ok {
			t.Errorf("%s 不存在", mapName)
			continue
		}

		valSz := m.ValueSize()
		key := uint32(0)
		value := make([]byte, valSz)
		if err := m.Put(key, value); err != nil {
			t.Errorf("%s put: %v", mapName, err)
			continue
		}

		readback := make([]byte, valSz)
		if err := m.Lookup(key, &readback); err != nil {
			t.Errorf("%s lookup: %v", mapName, err)
			continue
		}
		t.Logf("  %s: write/read (valueSize=%d) ✓", mapName, valSz)
	}
}

// ─── 综合兼容性测试 ───────────────────────────────────────────────────────────

// TestAllProbesAttachSimultaneously 验证所有 11 个探针可以同时挂载（无冲突）。
// 这模拟了实际运行时的状态。
func TestAllProbesAttachSimultaneously(t *testing.T) {
	requireBTF(t)
	coll := loadCollection(t)
	defer coll.Close()

	type probe struct {
		name    string
		section string
	}

	// 注意：drop 钩子使用 kprobe/tracepoint，不在此列表中（见下方独立验证）
	allProbes := []probe{
		// RX (fentry/tracepoint)
		{"trace_netif_receive_skb", "tracepoint/net/netif_receive_skb"},
		{"ip_local_deliver_func", "fentry/ip_local_deliver"},
		{"ip6_input_func", "fentry/ip6_input"},
		{"inet_recvmsg_func", "fentry/inet_recvmsg"},
		{"inet6_recvmsg_func", "fentry/inet6_recvmsg"},
		// TX (fentry + tp_btf)
		{"inet_sendmsg_func", "fentry/inet_sendmsg"},
		{"inet6_sendmsg_func", "fentry/inet6_sendmsg"},
		{"ip_finish_output_func", "fentry/ip_finish_output"},
		{"ip6_finish_output_func", "fentry/ip6_finish_output"},
		{"net_dev_start_xmit_func", "tp_btf/net_dev_start_xmit"},
		// DROP 钩子已从此列表移除：
		// 原引用 kfree_skb_func (tp_btf) 已不存在，三钩重构后为 kprobe/tracepoint 类型，
		// 须用 link.Kprobe / link.Tracepoint，而非 link.AttachTracing。
		// 由 TestDropHookAttach 独立验证。
	}
	const expectedProbes = 10 // 5 RX + 5 TX

	var links []link.Link
	attached := 0

	for _, p := range allProbes {
		prog, ok := coll.Programs[p.name]
		if !ok {
			t.Errorf("program %s 不在 BPF 对象中", p.name)
			continue
		}

		var lk link.Link
		var err error
		if strings.HasPrefix(p.section, "tracepoint/") {
			parts := strings.SplitN(strings.TrimPrefix(p.section, "tracepoint/"), "/", 2)
			if len(parts) == 2 {
				lk, err = link.Tracepoint(parts[0], parts[1], prog, nil)
			} else {
				err = fmt.Errorf("invalid tracepoint name: %s", p.section)
			}
		} else {
			lk, err = link.AttachTracing(link.TracingOptions{Program: prog})
		}

		if err != nil {
			t.Errorf("  ✗ %-42s %v", p.section, err)
			continue
		}
		links = append(links, lk)
		attached++
		t.Logf("  ✓ %-42s attached", p.section)
	}

	// 独立测试 drop 钩子（使用 kprobe/tracepoint，而非 AttachTracing）
	dropAttached := false
	for _, sym := range []string{"tcp_drop_reason", "tcp_drop"} {
		name := sym + "_func"
		if prog, ok := coll.Programs[name]; ok && kernelHasSymbol(sym) {
			if lk, err := link.Kprobe(sym, prog, nil); err == nil {
				links = append(links, lk)
				dropAttached = true
				attached++
				t.Logf("  ✓ kprobe/%-34s attached", sym)
				break
			}
		}
	}
	if !dropAttached && kernelHasTracepoint("skb", "kfree_skb") {
		if prog, ok := coll.Programs["trace_kfree_skb"]; ok {
			if lk, err := link.Tracepoint("skb", "kfree_skb", prog, nil); err == nil {
				links = append(links, lk)
				dropAttached = true
				attached++
				t.Log("  ✓ tracepoint/skb/kfree_skb                   attached (fallback)")
			}
		}
	}
	if !dropAttached {
		t.Error("drop 钩子（kprobe/tracepoint）无一可挂载")
	}

	for _, lk := range links {
		lk.Close()
	}

	expected := expectedProbes + 1 // +1 for drop
	t.Logf("\n同时挂载探针数: %d / %d (含 1 个 drop 钩子)", attached, expected)
	if attached < expected {
		t.Errorf("部分探针挂载失败 (%d/%d)", attached, expected)
	}
}
