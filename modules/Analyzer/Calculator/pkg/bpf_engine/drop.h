// ============================================================
// Drop probes — packet discarded in the kernel
// ============================================================
//
// CROSS-KERNEL COMPATIBILITY STRATEGY
// =====================================
// Three hooks are compiled into the same BPF object. The Go loader (engine.go)
// attaches exactly ONE at runtime based on kernel availability:
//
//   Priority 1: kprobe/tcp_drop_reason  — kernel >= 6.1
//               Renamed from tcp_drop in 6.1. Carries exact drop reason code.
//               Most accurate for TCP drops.
//
//   Priority 2: kprobe/tcp_drop         — kernel < 6.1  (5.10 – 5.15)
//               Original 2-argument symbol (sock, skb). No reason field.
//               Matches the original Python/BCC implementation which also used
//               this kprobe when tcp_drop_reason was not available.
//
//   Priority 3: tracepoint/skb/kfree_skb — universal fallback (all kernels)
//               Classic tracepoint with CO-RE bpf_core_field_exists() check.
//               On kernels < 5.17 (no reason field): always returns 0 because
//               kfree_skb fires for every buffer free (not only real drops) and
//               we cannot distinguish them without the reason field.
//               On kernels >= 5.17: filters reason > NOT_SPECIFIED (0), so only
//               real drops of our five-tuple-matched flows are counted.
//
// WHY NOT tp_btf/kfree_skb (original approach)?
//   tp_btf strictly validates the BTF argument list against the kernel's type.
//   Its argument count varies across kernel versions (2 args before 5.17,
//   3 args after), causing verifier rejection on mismatched kernels regardless
//   of whether we declare the extra argument or not.
//   Classic tracepoint (tracepoint/skb/kfree_skb) with void *ctx + CO-RE is
//   the correct portable pattern for tracepoints with evolving signatures.
//
// Reference: /home/ywb/opensource/PacketScope/modules/Analyzer/Metrics/bpf/src/hooks/drop.h

// ── 1. kprobe/tcp_drop_reason (kernel >= 6.1) ────────────────────────────
SEC("kprobe/tcp_drop_reason")
int BPF_KPROBE(tcp_drop_reason_func, struct sock *sk, struct sk_buff *skb, int reason)
{
    struct event_t e;
    __builtin_memset(&e, 0, sizeof(e));

    if (extract_sock_five_tuple(sk, &e, 1) == 0 && match_five_tuple_rx(&e)) {
        agg_increment(AGG_IDX(AGG_DROP, 0, 0, e.is_ipv6), 0, &e);
        return 0;
    }
    if (extract_sock_five_tuple(sk, &e, 0) == 0 && match_five_tuple(&e)) {
        agg_increment(AGG_IDX(AGG_DROP, 0, 0, e.is_ipv6), 0, &e);
        return 0;
    }
    return 0;
}

// ── 2. kprobe/tcp_drop (kernel < 6.1) ────────────────────────────────────
SEC("kprobe/tcp_drop")
int BPF_KPROBE(tcp_drop_func, struct sock *sk, struct sk_buff *skb)
{
    struct event_t e;
    __builtin_memset(&e, 0, sizeof(e));

    if (extract_sock_five_tuple(sk, &e, 1) == 0 && match_five_tuple_rx(&e)) {
        agg_increment(AGG_IDX(AGG_DROP, 0, 0, e.is_ipv6), 0, &e);
        return 0;
    }
    if (extract_sock_five_tuple(sk, &e, 0) == 0 && match_five_tuple(&e)) {
        agg_increment(AGG_IDX(AGG_DROP, 0, 0, e.is_ipv6), 0, &e);
        return 0;
    }
    return 0;
}

// ── 3. tracepoint/skb/kfree_skb — universal fallback with CO-RE ──────────
//
// Uses classic tracepoint (not tp_btf) so argument count differences across
// kernel versions do not cause verifier rejections.
// CO-RE bpf_core_field_exists() probes whether the 'reason' field exists.
SEC("tracepoint/skb/kfree_skb")
int trace_kfree_skb(struct trace_event_raw_kfree_skb *ctx)
{
    // CO-RE: only proceed if kernel has the reason field (>= 5.17)
    // Without it we cannot distinguish real drops from normal buffer frees.
    if (!bpf_core_field_exists(ctx->reason))
        return 0;

    enum skb_drop_reason reason = BPF_CORE_READ(ctx, reason);
    if ((__u32)reason <= 0)
        return 0;  // SKB_DROP_REASON_NOT_SPECIFIED = 0, not a real drop

    struct sk_buff *skb = (struct sk_buff *)BPF_CORE_READ(ctx, skbaddr);

    struct event_t e;
    __builtin_memset(&e, 0, sizeof(e));

    if (extract_five_tuple(skb, &e) < 0)
        return 0;
    if (!match_five_tuple(&e) && !match_five_tuple_rx(&e))
        return 0;

    agg_increment(AGG_IDX(AGG_DROP, 0, 0, e.is_ipv6), 0, &e);
    return 0;
}
