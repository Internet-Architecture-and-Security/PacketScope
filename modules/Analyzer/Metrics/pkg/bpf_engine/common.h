#ifndef __METRICS_COMMON_H__
#define __METRICS_COMMON_H__

#include "./headers/vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>
#include <bpf/bpf_core_read.h>
#include <bpf/bpf_endian.h>

#pragma clang diagnostic ignored "-Wunused-parameter"

// Filter struct for IPv4
struct filter_v4_t {
    u32 sip;
    u32 dip;
    u16 sport;
    u16 dport;
    u8  protocol;
};

// Filter struct for IPv6
struct filter_v6_t {
    u8 sip[16];
    u8 dip[16];
    u16 sport;
    u16 dport;
    u8  protocol;
};

// Map definition: Five-tuple filter for IPv4
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 1);
    __type(key, u32);
    __type(value, struct filter_v4_t);
} five_tuple_filter_ipv4 SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 1);
    __type(key, u32);
    __type(value, struct filter_v6_t);
} five_tuple_filter_ipv6 SEC(".maps");

// ================= AGGREGATION MAP =================
// Slot index: metric_type*12 + layer*4 + direction*2 + is_ipv6
// PPS(0-11) + LAT(12-23) + DROP(24-25) = 26 slots

#define AGG_MAX         26

#define AGG_PPS         0
#define AGG_LAT         1
#define AGG_DROP        2

#define LAYER_LINK      0
#define LAYER_NETWORK   1
#define LAYER_TRANS     2

#define CL_LINKNETWORK  0
#define CL_NETWORKTRANS 1
#define CL_LINKTRANS    2

#define DIR_RX          0
#define DIR_TX          1

#define AGG_IDX(metric, layer, dir, ipv6) \
    ((u32)((metric)*12 + (layer)*4 + (dir)*2 + (ipv6)))

struct ip_address {
    union {
        u32 v4;
        u8 v6[16];
    };
};

struct agg_val_t {
    u64 packets;
    u64 first_ts_ns;
    u64 last_ts_ns;
    u64 last_lat_us;
    u32 last_pid;
    char last_task[16];
    // Last-seen five-tuple from the most recent packet in this aggregation slot
    struct ip_address last_saddr;
    struct ip_address last_daddr;
    u16 last_sport;
    u16 last_dport;
    u8  last_protocol;
    u8  last_is_ipv6;
    u8  _pad[2];
};

struct {
    __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
    __uint(max_entries, AGG_MAX);
    __type(key, u32);
    __type(value, struct agg_val_t);
} agg_map SEC(".maps");

// Force bpf2go to generate Go type for agg_val_t
struct agg_val_t *UNUSED_agg_val_t __attribute__((unused));

// ================= CONSTANTS & MACROS =================
#ifndef ETH_P_IP
#define ETH_P_IP 0x0800
#endif
#ifndef ETH_P_IPV6
#define ETH_P_IPV6 0x86DD
#endif

#ifndef IPPROTO_TCP
#define IPPROTO_TCP 6
#endif
#ifndef IPPROTO_UDP
#define IPPROTO_UDP 17
#endif

// ================= CROSS-LAYER LATENCY MAPS =================
// Key for latency tracking (matches a specific flow + direction)
struct lat_key_t {
    struct ip_address saddr;
    struct ip_address daddr;
    u16 sport;
    u16 dport;
    u8  protocol;
    u8  is_ipv6;
    u8  direction; // 0: TX, 1: RX
    u8  _pad;
};

struct lat_val_t {
    u64 ts_ns;   // timestamp in nanoseconds
    u32 pid;
    char task[16]; // TASK_COMM_LEN
};

// link -> network latency tracking
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 4096);
    __type(key, struct lat_key_t);
    __type(value, struct lat_val_t);
} start_link SEC(".maps");

// transport -> link latency tracking (trans entry -> link exit)
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 4096);
    __type(key, struct lat_key_t);
    __type(value, struct lat_val_t);
} start_translink SEC(".maps");

// transport -> network latency tracking (trans entry -> network exit)
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 4096);
    __type(key, struct lat_key_t);
    __type(value, struct lat_val_t);
} start_transnetwork SEC(".maps");

// ================= EVENT STRUCT =================
#define TASK_COMM_LEN_MAX 16

struct event_t {
    u64 ts_us;
    u64 delta_us;   // cross-layer latency in microseconds
    u32 pid;
    struct ip_address saddr;
    struct ip_address daddr;
    u16 sport;
    u16 dport;
    u8  protocol;
    u8  direction;  // 0: RX, 1: TX, 2: Drop
    u8  layer;      // 0: link, 1: network, 2: transport
    u8  is_ipv6;    // 0: IPv4, 1: IPv6
    char task[TASK_COMM_LEN_MAX]; // process name (pid_name)
};

// struct hack to allow cilium/ebpf to generate type mapping
struct event_t *UNUSED_event_t __attribute__((unused));

// Increment an aggregation slot — called from probes on the hot path.
// Zero cost per-CPU writes, no locks.
// `e` carries the five-tuple of the current packet for last-seen tracking.
static __always_inline void agg_increment(u32 idx, u64 lat_us, struct event_t *e) {
    struct agg_val_t *val = bpf_map_lookup_elem(&agg_map, &idx);
    if (!val)
        return;

    val->packets++;
    u64 now = bpf_ktime_get_ns();
    if (val->first_ts_ns == 0)
        val->first_ts_ns = now;
    val->last_ts_ns = now;
    if (lat_us > 0)
        val->last_lat_us = lat_us;
    val->last_pid = bpf_get_current_pid_tgid() >> 32;
    bpf_get_current_comm(&val->last_task, sizeof(val->last_task));

    // Store last-seen five-tuple
    val->last_saddr = e->saddr;
    val->last_daddr = e->daddr;
    val->last_sport = e->sport;
    val->last_dport = e->dport;
    val->last_protocol = e->protocol;
    val->last_is_ipv6 = e->is_ipv6;
}

// Helper: compare two IPv6 addresses (16 bytes). Returns 0 if equal.
// Uses two 64-bit comparisons — efficient and BPF-verifier friendly.
static __always_inline int ipv6_addr_cmp(const u8 a[16], const u8 b[16]) {
    u64 a_hi, a_lo, b_hi, b_lo;
    __builtin_memcpy(&a_hi, a, 8);
    __builtin_memcpy(&a_lo, a + 8, 8);
    __builtin_memcpy(&b_hi, b, 8);
    __builtin_memcpy(&b_lo, b + 8, 8);
    return (a_hi != b_hi) || (a_lo != b_lo);
}

// Helper: check if a filter IPv6 address is non-zero (i.e. configured)
static __always_inline int ipv6_addr_nonzero(const u8 addr[16]) {
    u64 hi, lo;
    __builtin_memcpy(&hi, addr, 8);
    __builtin_memcpy(&lo, addr + 8, 8);
    return hi || lo;
}

// Helper: check if five-tuple matches the user-configured filter (TX direction)
static __always_inline int match_five_tuple(struct event_t *e) {
    u32 key = 0;

    if (e->is_ipv6 == 0) {
        struct filter_v4_t *f = bpf_map_lookup_elem(&five_tuple_filter_ipv4, &key);
        if (!f) { bpf_printk("tx fail: no filter_v4"); return 0; }

        if (f->protocol && f->protocol != e->protocol) { bpf_printk("tx fail proto: f=%d e=%d", f->protocol, e->protocol); return 0; }
        if (f->sip && f->sip != e->saddr.v4) { bpf_printk("tx fail sip: f=%x pkt_s=%x", f->sip, e->saddr.v4); return 0; }
        if (f->dip && f->dip != e->daddr.v4) { bpf_printk("tx fail dip: f=%x pkt_d=%x", f->dip, e->daddr.v4); return 0; }
        if (f->sport && f->sport != e->sport) { bpf_printk("tx fail sport: f=%d pkt_s=%d", f->sport, e->sport); return 0; }
        if (f->dport && f->dport != e->dport) { bpf_printk("tx fail dport: f=%d pkt_d=%d", f->dport, e->dport); return 0; }

        return 1;
    } else {
        struct filter_v6_t *f = bpf_map_lookup_elem(&five_tuple_filter_ipv6, &key);
        if (!f) { bpf_printk("tx fail: no filter_v6"); return 0; }

        if (f->protocol && f->protocol != e->protocol) { bpf_printk("tx fail proto"); return 0; }
        if (ipv6_addr_nonzero(f->sip) && ipv6_addr_cmp(f->sip, e->saddr.v6)) { bpf_printk("tx fail sip v6"); return 0; }
        if (ipv6_addr_nonzero(f->dip) && ipv6_addr_cmp(f->dip, e->daddr.v6)) { bpf_printk("tx fail dip v6"); return 0; }
        if (f->sport && f->sport != e->sport) { bpf_printk("tx fail sport v6"); return 0; }
        if (f->dport && f->dport != e->dport) { bpf_printk("tx fail dport v6"); return 0; }

        return 1;
    }
}

// Helper: check if five-tuple matches in reverse direction (for RX packets)
// In RX: the packet's saddr/sport matches filter's daddr/dport and vice versa
static __always_inline int match_five_tuple_rx(struct event_t *e) {
    u32 key = 0;

    if (e->is_ipv6 == 0) {
        struct filter_v4_t *f = bpf_map_lookup_elem(&five_tuple_filter_ipv4, &key);
        if (!f) { bpf_printk("rx fail: no filter_v4"); return 0; }

        if (f->protocol && f->protocol != e->protocol) { bpf_printk("rx fail proto: f=%d e=%d", f->protocol, e->protocol); return 0; }
        if (f->sip && f->sip != e->daddr.v4) { bpf_printk("rx fail sip: f=%x pkt_d=%x", f->sip, e->daddr.v4); return 0; }
        if (f->dip && f->dip != e->saddr.v4) { bpf_printk("rx fail dip: f=%x pkt_s=%x", f->dip, e->saddr.v4); return 0; }
        if (f->sport && f->sport != e->dport) { bpf_printk("rx fail sport: f=%d pkt_d=%d", f->sport, e->dport); return 0; }
        if (f->dport && f->dport != e->sport) { bpf_printk("rx fail dport: f=%d pkt_s=%d", f->dport, e->sport); return 0; }

        return 1;
    } else {
        struct filter_v6_t *f = bpf_map_lookup_elem(&five_tuple_filter_ipv6, &key);
        if (!f) { bpf_printk("rx fail: no filter_v6"); return 0; }

        if (f->protocol && f->protocol != e->protocol) { bpf_printk("rx fail proto v6"); return 0; }
        if (ipv6_addr_nonzero(f->sip) && ipv6_addr_cmp(f->sip, e->daddr.v6)) { bpf_printk("rx fail sip v6"); return 0; }
        if (ipv6_addr_nonzero(f->dip) && ipv6_addr_cmp(f->dip, e->saddr.v6)) { bpf_printk("rx fail dip v6"); return 0; }
        if (f->sport && f->sport != e->dport) { bpf_printk("rx fail sport v6"); return 0; }
        if (f->dport && f->dport != e->sport) { bpf_printk("rx fail dport v6"); return 0; }

        return 1;
    }
}

// Helper: build lat_key from event_t
static __always_inline void build_lat_key(struct event_t *e, u8 direction, struct lat_key_t *lk) {
    __builtin_memset(lk, 0, sizeof(*lk));
    lk->saddr = e->saddr;
    lk->daddr = e->daddr;
    lk->sport = e->sport;
    lk->dport = e->dport;
    lk->protocol = e->protocol;
    lk->is_ipv6 = e->is_ipv6;
    lk->direction = direction;
}

// Helper: extract five-tuple from struct sock (for transport layer probes)
// sock-based probes (inet_sendmsg / inet_recvmsg) don't have sk_buff,
// they carry socket info with local/remote addresses directly in struct sock.
static __always_inline int extract_sock_five_tuple(struct sock *sk, struct event_t *e, int rx) {
    u16 family = BPF_CORE_READ(sk, __sk_common.skc_family);

    if (family == 2 /* AF_INET */) {
        e->is_ipv6 = 0;
        if (rx) {
            e->saddr.v4 = BPF_CORE_READ(sk, __sk_common.skc_daddr);
            e->daddr.v4 = BPF_CORE_READ(sk, __sk_common.skc_rcv_saddr);
            e->sport = __bpf_ntohs(BPF_CORE_READ(sk, __sk_common.skc_dport));
            e->dport = BPF_CORE_READ(sk, __sk_common.skc_num);
        } else {
            e->saddr.v4 = BPF_CORE_READ(sk, __sk_common.skc_rcv_saddr);
            e->daddr.v4 = BPF_CORE_READ(sk, __sk_common.skc_daddr);
            e->sport = BPF_CORE_READ(sk, __sk_common.skc_num);
            e->dport = __bpf_ntohs(BPF_CORE_READ(sk, __sk_common.skc_dport));
        }
        e->protocol = BPF_CORE_READ_BITFIELD_PROBED(sk, sk_protocol);
        return 0;
    } else if (family == 10 /* AF_INET6 */) {
        e->is_ipv6 = 1;
        if (rx) {
            bpf_core_read(&e->saddr.v6, 16, &sk->__sk_common.skc_v6_daddr);
            bpf_core_read(&e->daddr.v6, 16, &sk->__sk_common.skc_v6_rcv_saddr);
            e->sport = __bpf_ntohs(BPF_CORE_READ(sk, __sk_common.skc_dport));
            e->dport = BPF_CORE_READ(sk, __sk_common.skc_num);
        } else {
            bpf_core_read(&e->saddr.v6, 16, &sk->__sk_common.skc_v6_rcv_saddr);
            bpf_core_read(&e->daddr.v6, 16, &sk->__sk_common.skc_v6_daddr);
            e->sport = BPF_CORE_READ(sk, __sk_common.skc_num);
            e->dport = __bpf_ntohs(BPF_CORE_READ(sk, __sk_common.skc_dport));
        }
        e->protocol = BPF_CORE_READ_BITFIELD_PROBED(sk, sk_protocol);
        return 0;
    }

    return -1;
}

// Helper: parse network and transport headers from skb
static __always_inline int extract_five_tuple(struct sk_buff *skb, struct event_t *e) {
    u16 mac_proto = BPF_CORE_READ(skb, protocol);
    mac_proto = __bpf_ntohs(mac_proto);

    unsigned char *head = BPF_CORE_READ(skb, head);
    u16 mac_header = BPF_CORE_READ(skb, mac_header);
    u16 network_header = BPF_CORE_READ(skb, network_header);

    // TX path: network_header is often invalid (~0U == 65535/0xffff)
    // fallback to skb->data if network_header is invalid or 0
    if (network_header == 0 || network_header == (u16)0xffff) {
        if (mac_header != 0 && mac_header != (u16)0xffff) {
            network_header = mac_header + 14;
        } else {
            unsigned char *data = BPF_CORE_READ(skb, data);
            network_header = data - head;
        }
    }

    struct iphdr *iph = (struct iphdr *)(head + network_header);
    u8 version_ihl = 0;
    bpf_core_read(&version_ihl, 1, iph);
    u8 version = version_ihl >> 4;

    // Use mac_proto OR version directly to identify IP
    if (mac_proto == ETH_P_IP || version == 4) {
        e->is_ipv6 = 0;
        e->saddr.v4 = BPF_CORE_READ(iph, saddr);
        e->daddr.v4 = BPF_CORE_READ(iph, daddr);
        e->protocol = BPF_CORE_READ(iph, protocol);

        u8 ihl = version_ihl & 0x0f;
        u16 transport_header = network_header + (ihl * 4);

        if (e->protocol == IPPROTO_TCP) {
            struct tcphdr *tcph = (struct tcphdr *)(head + transport_header);
            e->sport = __bpf_ntohs(BPF_CORE_READ(tcph, source));
            e->dport = __bpf_ntohs(BPF_CORE_READ(tcph, dest));
        } else if (e->protocol == IPPROTO_UDP) {
            struct udphdr *udph = (struct udphdr *)(head + transport_header);
            e->sport = __bpf_ntohs(BPF_CORE_READ(udph, source));
            e->dport = __bpf_ntohs(BPF_CORE_READ(udph, dest));
        }
        return 0;

    } else if (mac_proto == ETH_P_IPV6 || version == 6) {
        struct ipv6hdr *ip6h = (struct ipv6hdr *)(head + network_header);
        e->is_ipv6 = 1;

        bpf_core_read(&e->saddr.v6, sizeof(e->saddr.v6), &ip6h->saddr.in6_u.u6_addr8);
        bpf_core_read(&e->daddr.v6, sizeof(e->daddr.v6), &ip6h->daddr.in6_u.u6_addr8);

        e->protocol = BPF_CORE_READ(ip6h, nexthdr);

        u16 transport_header = network_header + 40;

        if (e->protocol == IPPROTO_TCP) {
            struct tcphdr *tcph = (struct tcphdr *)(head + transport_header);
            e->sport = __bpf_ntohs(BPF_CORE_READ(tcph, source));
            e->dport = __bpf_ntohs(BPF_CORE_READ(tcph, dest));
        } else if (e->protocol == IPPROTO_UDP) {
            struct udphdr *udph = (struct udphdr *)(head + transport_header);
            e->sport = __bpf_ntohs(BPF_CORE_READ(udph, source));
            e->dport = __bpf_ntohs(BPF_CORE_READ(udph, dest));
        }
        return 0;
    }

    return -1;
}

// ================= LATENCY HELPERS =================

// Create a latency value with current timestamp/pid/task
static __always_inline struct lat_val_t new_lat_val(void) {
    struct lat_val_t lv = {};
    lv.ts_ns = bpf_ktime_get_ns();
    lv.pid = bpf_get_current_pid_tgid() >> 32;
    bpf_get_current_comm(&lv.task, sizeof(lv.task));
    return lv;
}

// Lookup a latency map, compute delta_us, optionally delete the entry
static __always_inline u64 calc_latency(void *map, struct lat_key_t *lk, int cleanup) {
    struct lat_val_t *prev = bpf_map_lookup_elem(map, lk);
    if (!prev)
        return 0;
    u64 delta = (bpf_ktime_get_ns() - prev->ts_ns) / 1000;
    if (cleanup)
        bpf_map_delete_elem(map, lk);
    return delta;
}

// Record current timestamp into a latency map
static __always_inline void record_lat(void *map, struct lat_key_t *lk) {
    struct lat_val_t lv = new_lat_val();
    bpf_map_update_elem(map, lk, &lv, BPF_ANY);
}

#endif // __METRICS_COMMON_H__