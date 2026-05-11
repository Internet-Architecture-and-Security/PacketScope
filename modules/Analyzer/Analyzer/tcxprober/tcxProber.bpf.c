//go:build ignore

#include <linux/bpf.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_endian.h>
#include <stdbool.h>
// #include <vmlinux.h>
// #include <bpf/bpf_helpers.h>
// #include <bpf/bpf_core_read.h>
// #include <bpf/bpf_tracing.h>
// #include <bpf/bpf_endian.h>

typedef __u64 u64;
typedef __u8 u8;
typedef __u32 u32;

#define TC_ACT_OK 0
#define ENABLE_FILTER 0
#define TARGETDPORT 0
#define TARGETLPORT 0


// Ref:https://github.com/iovisor/bcc/blob/1dcfcec51c89713d243247ad7abea654a6dc7b20/examples/networking/simple_tc.py#L22
// examples/networking/simple_tc.py
struct {
    __uint(type, BPF_MAP_TYPE_PERF_EVENT_ARRAY);
    __uint(key_size, sizeof(int));
    __uint(value_size, sizeof(u32));
    __uint(max_entries, 128);
} events SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
    __type(key, int);
    __type(value, struct packet_metadata);
    __uint(max_entries, 1);
} metadata_buffer SEC(".maps");

struct packet_metadata
{
    u64 direction;
    u64 timestamp;
    u64 netifidx;
    u64 payloadlen;
    u8 payload[6144];
};

// struct packet_payload
// {
// }

static __always_inline void
handle_tc(struct __sk_buff *skb, bool egress)
{
    // 从 per-cpu array map 获取缓冲区
    int key = 0;
    struct packet_metadata *meta = bpf_map_lookup_elem(&metadata_buffer, &key);
    if (!meta)
    {
        return;
    }
    

    
    if (egress)
    {
        meta->direction = 0;
    }
    else
    {
        meta->direction = 1;
    }
    meta->timestamp = bpf_ktime_get_ns();
    meta->netifidx = skb->ifindex;
    u64 payload_len = (u64)skb->len;
    meta->payloadlen = payload_len;
    payload_len&=0xfff;
    if (payload_len > 0)
    {
        bpf_skb_load_bytes(skb, 0, meta->payload, payload_len);
    }
    
    // 将数据输出到 perf event array
    bpf_perf_event_output(skb, &events, BPF_F_CURRENT_CPU, meta, sizeof(*meta));

    return;
}

// int tcx_ingress_v4(struct __sk_buff *skb)
// {
//     bpf_skb_pull_data(skb, 0);
//     handle_tc(skb, false);
//     return 1;
// }

// int tcx_ingress_v6(struct __sk_buff *skb)
// {
//     bpf_skb_pull_data(skb, 0);
//     handle_tc(skb, false);
//     return 1;
// }
SEC("tc/ingress")
int tcx_ingress(struct __sk_buff *skb)
{
    bpf_skb_pull_data(skb, 0);
    handle_tc(skb, false);
    return TC_ACT_OK;
}
// int tcx_egress_v4(struct __sk_buff *skb)
// {
//     bpf_skb_pull_data(skb, 0);
//     handle_tc(skb, true);
//     return 1;
// }

// int tcx_egress_v6(struct __sk_buff *skb)
// {
//     bpf_skb_pull_data(skb, 0);
//     handle_tc(skb, true);
//     return 1;
// }
SEC("tc/egress")
int tcx_egress(struct __sk_buff *skb)
{
    bpf_skb_pull_data(skb, 0);
    handle_tc(skb, true);
    return TC_ACT_OK;
}


char LICENSE[] SEC("license") = "GPL";