// For tcx, it's certainly best method...
#include <net/sock.h>
#include <linux/sched.h>
#include <linux/uio.h>
// #include <vmlinux.h>
// #include <bpf/bpf_helpers.h>
// #include <bpf/bpf_core_read.h>
// #include <bpf/bpf_tracing.h>
// #include <bpf/bpf_endian.h>
#define ENABLE_FILTER 0
#define TARGETDPORT 0
#define TARGETLPORT 0


// Ref:https://github.com/iovisor/bcc/blob/1dcfcec51c89713d243247ad7abea654a6dc7b20/examples/networking/simple_tc.py#L22
// examples/networking/simple_tc.py
BPF_RINGBUF_OUTPUT(events, 128);

struct packet_metadata
{
    u64 direction;
    // 0 For Output, 1 For Input
    // u64 dport;
    // u64 lport;
    // u64 family;
    // u32 ipv4__sendaddr;
    // u32 ipv4__recvaddr;
    // u8 ipv6__sendaddr[16];
    // u8 ipv6__recvaddr[16];
    // Four-Ele Set for Specification
    u64 timestamp;
    u64 netifidx;
    u64 payloadlen;
    // u64 pid;
    // char comm[TASK_COMM_LEN];
    u8 payload[6144];
};

// struct packet_payload
// {
// }

static __always_inline void
handle_tc(struct __sk_buff *skb, bool egress)
{

    // Filter
    // Templated this struct
    // if(skb->data_end-skb->data<132)
    // {
    //     return;
    // }
    // u32 tdport=skb->remote_port;
    // u32 tdport=0;
    // u32 dportnum=((tdport>> 8) | ((tdport << 8) & 0xff00));
    // if(ENABLE_FILTER)
    // {
    // if(TARGETDPORT!=dportnum)
    // {
        // return;
    // }
    // if(TARGETLPORT!=skb->local_port)
    // {
        // return;
    // }
    // }    
    // void *ringbuf = NULL;
    struct packet_metadata *meta;
    // struct packet_payload *payload;
    // Useless item put into zero
    meta = events.ringbuf_reserve(sizeof(struct packet_metadata));
    if (meta == NULL)
    {
        return;
    }
    
    // meta = (struct packet_metadata *)ringbuf;
    // __builtin_memset(meta,0,sizeof(struct packet_metadata)-2000);
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
    // meta->pid = bpf_get_current_pid_tgid();
    // bpf_get_current_comm(&meta->comm, sizeof(meta->comm));
    u64 payload_len = (u64)skb->len;
    meta->payloadlen = payload_len;
    payload_len&=0xfff;
    // meta->dport=dportnum;
    // (dport >> 8) | ((dport << 8) & 0xff00)
    // meta->lport=skb->local_port;
    // if (skb->family == AF_INET6) {
    //     meta->family=6;
    //     bpf_probe_read(&meta->ipv6__recvaddr, sizeof(skb->local_ip6),
    //                    &skb->local_ip6);
    //     bpf_probe_read(&meta->ipv6__sendaddr, sizeof(skb->remote_ip6),
    //                    &skb->remote_ip6);
    // }
	// else
	// {
    //     meta->family=4;
	// 	meta->ipv4__recvaddr=skb->local_ip4;
	// 	meta->ipv4__sendaddr=skb->remote_ip4;
	// }
    if (payload_len > 0)
    {
        // payload = (struct skb_data_t *)(meta + 1);
        
        bpf_skb_load_bytes(skb, 0, &meta->payload, payload_len);
    }
    events.ringbuf_submit(meta, 0);

    return;
}

// SEC("tc");
// int tc_ingress(struct __sk_buff *skb)
// {
//     bpf_skb_pull_data(skb, 0);
//     handle_tc(skb, false);
//     return TC_ACT_UNSPEC;
// }

// #ifndef NO_TCX
// SEC("tcx/ingress")
int tcx_ingress(struct __sk_buff *skb)
{
    bpf_skb_pull_data(skb, 0);
    handle_tc(skb, false);
    return 1;
}
// #endif

// SEC("tc");
// int tc_egress(struct __sk_buff *skb)
// {
//     bpf_skb_pull_data(skb, 0);
//     handle_tc(skb, true);
//     return TC_ACT_UNSPEC;
// }

// #ifndef NO_TCX
// SEC("tcx/egress")
int tcx_egress(struct __sk_buff *skb)
{
    bpf_skb_pull_data(skb, 0);
    handle_tc(skb, true);
    return 1;
}
// #endif