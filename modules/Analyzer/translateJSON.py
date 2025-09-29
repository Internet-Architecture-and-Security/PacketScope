import json as js

def rebuild_json(inputlist):
    dictnow={}
    for item in inputlist:
        dictnow[item["id"]]=item
    return dictnow

KproberHeader="""
#include <net/sock.h>
#include <linux/sched.h>
#include <linux/uio.h>

struct SkProbe
{
	u32 pid;
	u32 padding32;
	u64 kernelTime;
	// char comm[TASK_COMM_LEN];
	// BPF info above
    u64 FuncID;
    u64 ret;
    u64 family;
	u64 dport;
	u64 lport;
	u32 ipv4__sendaddr;
    u32 ipv4__recvaddr;
    u8 ipv6__sendaddr[16];
    u8 ipv6__recvaddr[16];
};

struct packet_metadata
{
    u64 isPacket;
    u64 timestamp;
    u64 pid;
    u64 FuncID;
    u64 payloadlen;
    u8 payloadHdr[58];
};
BPF_RINGBUF_OUTPUT(events, 512);
BPF_RINGBUF_OUTPUT(SpecEvents, 128);

"""

SpecialPartRcvBackup="""
int ktprobe_ip_rcv_core(struct pt_regs *ctx,struct sk_buff *skb)
{
struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
struct packet_metadata *pdata = events.ringbuf_reserve(sizeof(struct packet_metadata));
if(!data){{return 0;}}
if(!pdata){{return 0;}}
//struct sock *sk = skb->sk;
data->ret = 0;
data->FuncID=200000;
pdata->FuncID=200000;
data->kernelTime = bpf_ktime_get_ns();
data->pid = bpf_get_current_pid_tgid();
pdata->pid=data->pid;
u64 plen=skb->len;
pdata->payloadlen = plen;
plen&=0xfff;
pdata->timestamp = data->kernelTime;
//@len: Length of actual data
if(plen>0){
    bpf_skb_load_bytes(skb, 0, &pdata->payload, plen);
}
events.ringbuf_submit(pdata, 0);
events.ringbuf_submit(data, 0);
return 0;
}

int ktretprobe_ip_rcv_core(struct pt_regs *ctx)
{
struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
if(!data){{return 0;}}
data->FuncID=200000;
data->kernelTime = bpf_ktime_get_ns();
data->pid=bpf_get_current_pid_tgid();
data->ret=1;
events.ringbuf_submit(data, 0);
return 0;
}

int ktprobe_ip6_rcv_core(struct pt_regs *ctx,struct sk_buff *skb)
{
struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
struct packet_metadata *pdata = events.ringbuf_reserve(sizeof(struct packet_metadata));
if(!data){{return 0;}}
if(!pdata){{return 0;}}
struct sock *sk = skb->sk;
data->ret = 0;
data->FuncID=200001;
pdata->FuncID=200001;
data->kernelTime = bpf_ktime_get_ns();
data->pid = bpf_get_current_pid_tgid();
pdata->pid=data->pid;
u64 plen=skb->len;
pdata->payloadlen = plen;
pdata->isPacket = 1;
plen&=0xfff;
pdata->timestamp = data->kernelTime;
//@len: Length of actual data
if(plen>0){
    bpf_skb_load_bytes(skb, 0, &pdata->payload, plen);
}
events.ringbuf_submit(pdata, 0);                  
events.ringbuf_submit(data, 0);
return 0;
}

int ktretprobe_ip6_rcv_core(struct pt_regs *ctx)
{
struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
if(!data){{return 0;}}
data->FuncID=200001;
data->kernelTime = bpf_ktime_get_ns();
data->pid=bpf_get_current_pid_tgid();
data->ret=1;
events.ringbuf_submit(data, 0);
return 0;
}
"""

SpecialPartRcvB="""

int ktprobe___netif_receive_skb(struct pt_regs *ctx,struct sk_buff *skb)
{
struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
if(!data){{return 0;}}
//struct sock *sk = skb->sk;
u8 *data_s = (u8 *)(long)skb->data;
u8 *data_end = (u8 *)(long)skb->tail;
data->ret = 0;
data->FuncID=200000;
data->kernelTime = bpf_ktime_get_ns();
data->pid = bpf_get_current_pid_tgid();
/*
if(skb->len<16)
{
    data->family = (long)skb->data;
    data->dport = (long)skb->tail;
    events.ringbuf_submit(data, 0);
    return 0;
    // No complete Eth layer
}
*/
u8 ipver=data_s[14]&0xf0;
if(ipver==64)
{
// ipv4
u32 headerlen=(data_s[14]&0x0f)*4;
u32 nextprotstart=headerlen+14;
u32 subprot=data_s[23];
if(subprot == 17 || subprot == 6)
{
    // UDP or TCP
    data->family = 4; 
    data->ipv4__sendaddr=(data_s[26] << 24) | (data_s[27] << 16) | (data_s[28] << 8) | data_s[29];
    data->ipv4__recvaddr=(data_s[30] << 24) | (data_s[31] << 16) | (data_s[32] << 8) | data_s[33];
    data->lport=data_s[nextprotstart+1]+data_s[nextprotstart]*256;
    data->dport=data_s[nextprotstart+3]+data_s[nextprotstart+2]*256;
    events.ringbuf_submit(data, 0);
    return 0;
}
}
else if(ipver==96)
{
    u32 headertype=data_s[20];
    if(headertype == 6 || headertype==17)
    // TCP/UDP
    {
    data->family = 6;
    bpf_probe_read(&data->ipv6__sendaddr,16,data_s+22);
    bpf_probe_read(&data->ipv6__recvaddr,16,data_s+38);
    data->lport=data_s[55]+data_s[54]*256;
    data->dport=data_s[56]+data_s[57]*256;
    }
    // ipv6
}
events.ringbuf_submit(data, 0);
return 0;
}

int ktretprobe___netif_receive_skb(struct pt_regs *ctx)
{
struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
if(!data){{return 0;}}
data->FuncID=200000;
data->kernelTime = bpf_ktime_get_ns();
data->pid=bpf_get_current_pid_tgid();
data->ret=1;
events.ringbuf_submit(data, 0);
return 0;
}

"""

SpecialPartRcv="""

int ktprobe_ip_rcv_core(struct pt_regs *ctx,struct sk_buff *skb)
{
struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
if(!data){{return 0;}}
//struct sock *sk = skb->sk;
u8 *data_s = (u8 *)(long)skb->data;
u8 *data_end = (u8 *)(long)skb->tail;
data->ret = 0;
data->FuncID=200000;
data->kernelTime = bpf_ktime_get_ns();
data->pid = bpf_get_current_pid_tgid();
/*
if(skb->len<16)
{
    data->family = (long)skb->data;
    data->dport = (long)skb->tail;
    events.ringbuf_submit(data, 0);
    return 0;
    // No complete Eth layer
}
*/
u8 ipver=data_s[0]&0xf0;
if(ipver==64)
{
// ipv4
u32 headerlen=(data_s[0]&0x0f)*4;
u32 nextprotstart=headerlen;
u32 subprot=data_s[9];
if(subprot == 17 || subprot == 6)
{
    // UDP or TCP
    data->family = 4; 
    data->ipv4__sendaddr=(data_s[15] << 24) | (data_s[14] << 16) | (data_s[13] << 8) | data_s[12];
    data->ipv4__recvaddr=(data_s[19] << 24) | (data_s[18] << 16) | (data_s[17] << 8) | data_s[16];
    data->lport=data_s[nextprotstart+1]+data_s[nextprotstart]*256;
    data->dport=data_s[nextprotstart+3]+data_s[nextprotstart+2]*256;
    // events.ringbuf_submit(data, 0);
    // return 0;
}
}
else if(ipver==96)
{
    u32 headertype=data_s[6];
    if(headertype == 6 || headertype==17)
    // TCP/UDP
    {
    data->family = 6;
    bpf_probe_read(&data->ipv6__sendaddr,16,data_s+8);
    bpf_probe_read(&data->ipv6__recvaddr,16,data_s+24);
    data->lport=data_s[41]+data_s[42]*256;
    data->dport=data_s[43]+data_s[44]*256;
    }
    // ipv6
}
events.ringbuf_submit(data, 0);

return 0;
}

int ktretprobe_ip_rcv_core(struct pt_regs *ctx)
{
struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
if(!data){{return 0;}}
data->FuncID=200000;
data->kernelTime = bpf_ktime_get_ns();
data->pid=bpf_get_current_pid_tgid();
data->ret=1;
events.ringbuf_submit(data, 0);
return 0;
}

int ktprobe_ip6_rcv_core(struct pt_regs *ctx,struct sk_buff *skb)
{
struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
if(!data){{return 0;}}
//struct sock *sk = skb->sk;
u8 *data_s = (u8 *)(long)skb->data;
u8 *data_end = (u8 *)(long)skb->tail;
data->ret = 0;
data->FuncID=200001;
data->kernelTime = bpf_ktime_get_ns();
data->pid = bpf_get_current_pid_tgid();
/*
if(skb->len<16)
{
    data->family = (long)skb->data;
    data->dport = (long)skb->tail;
    events.ringbuf_submit(data, 0);
    return 0;
    // No complete Eth layer
}
*/
u8 ipver=data_s[0]&0xf0;
if(ipver==64)
{
// ipv4
u32 headerlen=(data_s[0]&0x0f)*4;
u32 nextprotstart=headerlen;
u32 subprot=data_s[9];
if(subprot == 17 || subprot == 6)
{
    // UDP or TCP
    data->family = 4; 
    data->ipv4__sendaddr=(data_s[15] << 24) | (data_s[14] << 16) | (data_s[13] << 8) | data_s[12];
    data->ipv4__recvaddr=(data_s[19] << 24) | (data_s[18] << 16) | (data_s[17] << 8) | data_s[16];
    data->lport=data_s[nextprotstart+1]+data_s[nextprotstart]*256;
    data->dport=data_s[nextprotstart+3]+data_s[nextprotstart+2]*256;
    //events.ringbuf_submit(data, 0);
    //return 0;
}
}
else if(ipver==96)
{
    u32 headertype=data_s[6];
    if(headertype == 6 || headertype==17)
    // TCP/UDP
    {
    data->family = 6;
    bpf_probe_read(&data->ipv6__sendaddr,16,data_s+8);
    bpf_probe_read(&data->ipv6__recvaddr,16,data_s+24);
    data->lport=data_s[41]+data_s[42]*256;
    data->dport=data_s[43]+data_s[44]*256;
    }
    // ipv6
}
events.ringbuf_submit(data, 0);
return 0;
}

int ktretprobe_ip6_rcv_core(struct pt_regs *ctx)
{
struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
if(!data){{return 0;}}
data->FuncID=200001;
data->kernelTime = bpf_ktime_get_ns();
data->pid=bpf_get_current_pid_tgid();
data->ret=1;
events.ringbuf_submit(data, 0);
return 0;
}

"""

SpecialPartSnd="""
int ktprobe_icmp_push_reply(struct pt_regs *ctx, struct sock *sk)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){{return 0;}}
    data->kernelTime = bpf_ktime_get_ns();
    data->pid = bpf_get_current_pid_tgid();
    data->FuncID=200002;
    data->ret=0;
    u16 dport = sk->__sk_common.skc_dport;
    data->dport = (dport >> 8) | ((dport << 8) & 0xff00);
    data->lport = sk->__sk_common.skc_num;
    u32 family = sk->__sk_common.skc_family;
    if (family == AF_INET6)
    {
        data->family = 6;
        bpf_probe_read(&data->ipv6__recvaddr, sizeof(sk->__sk_common.skc_v6_daddr.s6_addr),
                       &sk->__sk_common.skc_v6_daddr.s6_addr);
        bpf_probe_read(&data->ipv6__sendaddr, sizeof(sk->__sk_common.skc_v6_rcv_saddr.s6_addr),
                       &sk->__sk_common.skc_v6_rcv_saddr.s6_addr);
    }
    else
    {
        data->family = 4;
        data->ipv4__recvaddr = sk->__sk_common.skc_daddr;
        data->ipv4__sendaddr = sk->__sk_common.skc_rcv_saddr;
    }
    events.ringbuf_submit(data, 0);
    return 0;
}

int ktretprobe_icmp_push_reply(struct pt_regs *ctx)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){{return 0;}}
    data->FuncID=200002;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    events.ringbuf_submit(data, 0);
    return 0;
}

int ktprobe_raw_sendmsg(struct pt_regs *ctx, struct sock *sk)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){{return 0;}}
    data->kernelTime = bpf_ktime_get_ns();
    data->pid = bpf_get_current_pid_tgid();
    data->FuncID=200003;
    data->ret=0;
    u16 dport = sk->__sk_common.skc_dport;
    data->dport = (dport >> 8) | ((dport << 8) & 0xff00);
    data->lport = sk->__sk_common.skc_num;
    u32 family = sk->__sk_common.skc_family;
    if (family == AF_INET6)
    {
        data->family = 6;
        bpf_probe_read(&data->ipv6__recvaddr, sizeof(sk->__sk_common.skc_v6_daddr.s6_addr),
                       &sk->__sk_common.skc_v6_daddr.s6_addr);
        bpf_probe_read(&data->ipv6__sendaddr, sizeof(sk->__sk_common.skc_v6_rcv_saddr.s6_addr),
                       &sk->__sk_common.skc_v6_rcv_saddr.s6_addr);
    }
    else
    {
        data->family = 4;
        data->ipv4__recvaddr = sk->__sk_common.skc_daddr;
        data->ipv4__sendaddr = sk->__sk_common.skc_rcv_saddr;
    }
    events.ringbuf_submit(data, 0);
    return 0;
}

int ktretprobe_raw_sendmsg(struct pt_regs *ctx)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){{return 0;}}
    data->FuncID=200003;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    events.ringbuf_submit(data, 0);
    return 0;
}

int ktprobe_rawv6_sendmsg(struct pt_regs *ctx, struct sock *sk)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){{return 0;}}
    data->kernelTime = bpf_ktime_get_ns();
    data->pid = bpf_get_current_pid_tgid();
    data->FuncID=200004;
    data->ret=0;
    u16 dport = sk->__sk_common.skc_dport;
    data->dport = (dport >> 8) | ((dport << 8) & 0xff00);
    data->lport = sk->__sk_common.skc_num;
    u32 family = sk->__sk_common.skc_family;
    if (family == AF_INET6)
    {
        data->family = 6;
        bpf_probe_read(&data->ipv6__recvaddr, sizeof(sk->__sk_common.skc_v6_daddr.s6_addr),
                       &sk->__sk_common.skc_v6_daddr.s6_addr);
        bpf_probe_read(&data->ipv6__sendaddr, sizeof(sk->__sk_common.skc_v6_rcv_saddr.s6_addr),
                       &sk->__sk_common.skc_v6_rcv_saddr.s6_addr);
    }
    else
    {
        data->family = 4;
        data->ipv4__recvaddr = sk->__sk_common.skc_daddr;
        data->ipv4__sendaddr = sk->__sk_common.skc_rcv_saddr;
    }
    events.ringbuf_submit(data, 0);
    return 0;
}

int ktretprobe_rawv6_sendmsg(struct pt_regs *ctx)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){{return 0;}}
    data->FuncID=200004;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    events.ringbuf_submit(data, 0);
    return 0;
}

int ktprobe_udp_sendmsg(struct pt_regs *ctx, struct sock *sk)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){{return 0;}}
    data->kernelTime = bpf_ktime_get_ns();
    data->pid = bpf_get_current_pid_tgid();
    data->FuncID=200005;
    data->ret=0;
    u16 dport = sk->__sk_common.skc_dport;
    data->dport = (dport >> 8) | ((dport << 8) & 0xff00);
    data->lport = sk->__sk_common.skc_num;
    u32 family = sk->__sk_common.skc_family;
    if (family == AF_INET6)
    {
        data->family = 6;
        bpf_probe_read(&data->ipv6__recvaddr, sizeof(sk->__sk_common.skc_v6_daddr.s6_addr),
                       &sk->__sk_common.skc_v6_daddr.s6_addr);
        bpf_probe_read(&data->ipv6__sendaddr, sizeof(sk->__sk_common.skc_v6_rcv_saddr.s6_addr),
                       &sk->__sk_common.skc_v6_rcv_saddr.s6_addr);
    }
    else
    {
        data->family = 4;
        data->ipv4__recvaddr = sk->__sk_common.skc_daddr;
        data->ipv4__sendaddr = sk->__sk_common.skc_rcv_saddr;
    }
    events.ringbuf_submit(data, 0);
    return 0;
}

int ktretprobe_udp_sendmsg(struct pt_regs *ctx)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){{return 0;}}
    data->FuncID=200005;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    events.ringbuf_submit(data, 0);
    return 0;
}

int ktprobe_udpv6_sendmsg(struct pt_regs *ctx, struct sock *sk)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){{return 0;}}
    data->kernelTime = bpf_ktime_get_ns();
    data->pid = bpf_get_current_pid_tgid();
    data->FuncID=200006;
    data->ret=0;
    u16 dport = sk->__sk_common.skc_dport;
    data->dport = (dport >> 8) | ((dport << 8) & 0xff00);
    data->lport = sk->__sk_common.skc_num;
    u32 family = sk->__sk_common.skc_family;
    if (family == AF_INET6)
    {
        data->family = 6;
        bpf_probe_read(&data->ipv6__recvaddr, sizeof(sk->__sk_common.skc_v6_daddr.s6_addr),
                       &sk->__sk_common.skc_v6_daddr.s6_addr);
        bpf_probe_read(&data->ipv6__sendaddr, sizeof(sk->__sk_common.skc_v6_rcv_saddr.s6_addr),
                       &sk->__sk_common.skc_v6_rcv_saddr.s6_addr);
    }
    else
    {
        data->family = 4;
        data->ipv4__recvaddr = sk->__sk_common.skc_daddr;
        data->ipv4__sendaddr = sk->__sk_common.skc_rcv_saddr;
    }
    events.ringbuf_submit(data, 0);
    return 0;
}

int ktretprobe_udpv6_sendmsg(struct pt_regs *ctx)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){{return 0;}}
    data->FuncID=200006;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    events.ringbuf_submit(data, 0);
    return 0;
}
int ktprobe_tcp_sendmsg(struct pt_regs *ctx, struct sock *sk)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){{return 0;}}
    data->kernelTime = bpf_ktime_get_ns();
    data->pid = bpf_get_current_pid_tgid();
    data->FuncID=200007;
    data->ret=0;
    u16 dport = sk->__sk_common.skc_dport;
    data->dport = (dport >> 8) | ((dport << 8) & 0xff00);
    data->lport = sk->__sk_common.skc_num;
    u32 family = sk->__sk_common.skc_family;
    if (family == AF_INET6)
    {
        data->family = 6;
        bpf_probe_read(&data->ipv6__recvaddr, sizeof(sk->__sk_common.skc_v6_daddr.s6_addr),
                       &sk->__sk_common.skc_v6_daddr.s6_addr);
        bpf_probe_read(&data->ipv6__sendaddr, sizeof(sk->__sk_common.skc_v6_rcv_saddr.s6_addr),
                       &sk->__sk_common.skc_v6_rcv_saddr.s6_addr);
    }
    else
    {
        data->family = 4;
        data->ipv4__recvaddr = sk->__sk_common.skc_daddr;
        data->ipv4__sendaddr = sk->__sk_common.skc_rcv_saddr;
    }
    events.ringbuf_submit(data, 0);
    return 0;
}

int ktretprobe_tcp_sendmsg(struct pt_regs *ctx)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){{return 0;}}
    data->FuncID=200007;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    events.ringbuf_submit(data, 0);
    return 0;
}
"""

SpecialPartListen="""
int ktprobe_ip_rcv(struct pt_regs *ctx)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){return 0;}
    data->FuncID=300000;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=0;
    events.ringbuf_submit(data, 0);
    return 0;
}
int ktretprobe_ip_rcv(struct pt_regs *ctx)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){return 0;}
    data->FuncID=300000;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    events.ringbuf_submit(data, 0);
    return 0;
}
int ktprobe_ipv6_rcv(struct pt_regs *ctx)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){return 0;}
    data->FuncID=300001;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=0;
    events.ringbuf_submit(data, 0);
    return 0;
}
int ktretprobe_ipv6_rcv(struct pt_regs *ctx)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){return 0;}
    data->FuncID=300001;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    events.ringbuf_submit(data, 0);
    return 0;
}
int ktprobe_ip_list_rcv(struct pt_regs *ctx)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){return 0;}
    data->FuncID=300002;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=0;
    events.ringbuf_submit(data, 0);
    return 0;
}
int ktretprobe_ip_list_rcv(struct pt_regs *ctx)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){return 0;}
    data->FuncID=300002;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    events.ringbuf_submit(data, 0);
    return 0;
}
int ktprobe_ipv6_list_rcv(struct pt_regs *ctx)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){return 0;}
    data->FuncID=300003;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=0;
    events.ringbuf_submit(data, 0);
    return 0;
}
int ktretprobe_ipv6_list_rcv(struct pt_regs *ctx)
{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){return 0;}
    data->FuncID=300003;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    events.ringbuf_submit(data, 0);
    return 0;
}
"""

KproberBody="""
int ktprobe_{0}(struct pt_regs *ctx)
{{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){{return 0;}}
    data->FuncID={1};
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=0;
    events.ringbuf_submit(data, 0);
    return 0;
}}
int ktretprobe_{0}(struct pt_regs *ctx)
{{
    struct SkProbe *data = events.ringbuf_reserve(sizeof(struct SkProbe));
    if(!data){{return 0;}}
    data->FuncID={1};
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    events.ringbuf_submit(data, 0);
    return 0;
}}

"""
DisabledList=["____sys_recvmsg","___sys_recvmsg","sock_recvmsg","security_socket_recvmsg",
              "apparmor_socket_recvmsg","unix_stream_recvmsg","consume_skb",
              "__skb_datagram_iter","skb_copy_datagram_iter","skb_put","skb_release_data",
              "skb_release_head_state","kfree_skbmem","skb_free_head","__build_skb_around",
              "sock_def_readable","skb_queue_tail","sock_alloc_send_pskb","skb_set_owner_w",
              "sock_wfree","skb_copy_datagram_from_iter","unix_scm_to_skb","skb_unlink",
              "apparmor_socket_sendmsg","security_socket_sendmsg","security_socket_getpeersec_dgram",
              "____sys_sendmsg","___sys_sendmsg","unix_stream_sendmsg","tcp_poll","tcp_stream_memory_free",
              "lock_sock_nested","tcp_release_cb","map_sock_addr","security_socket_getpeername","inet_label_sock_perm",
              "aa_inet_sock_perm","apparmor_socket_getpeername","sock_do_ioctl",
              "udp_poll",
              ]



SpecList=["ip_rcv_core","ip6_rcv_core","icmp_push_reply","rawv6_sendmsg",
          "raw_sendmsg","udp_sendmsg","udpv6_sendmsg","tcp_sendmsg","ipv6_rcv","ip_rcv","ip_list_rcv","ipv6_list_rcv"
          ]
# SpecList=["__netif_receive_skb","icmp_push_reply","rawv6_sendmsg",
        #   "raw_sendmsg","udp_sendmsg","udpv6_sendmsg","tcp_sendmsg",
        #   ]
# Commonly Applied
def translateJSON():
    fo=open("./.cache/relatedFuncD5.json","r")
    fw=open("./.cache/FuncIDMap.json","w")
    mainFile=js.load(fo)
    subjs=rebuild_json(mainFile)
    subjs["200000"]={"id": 200000,"name": "ip_rcv_core"}
    subjs["200001"]={"id": 200001,"name": "ip6_rcv_core"}
    subjs["200002"]={"id": 200002,"name": "icmp_push_reply"}
    subjs["200003"]={"id": 200003,"name": "rawv6_sendmsg"}
    subjs["200004"]={"id": 200004,"name": "raw_sendmsg"}
    subjs["200005"]={"id": 200005,"name": "udp_sendmsg"}
    subjs["200006"]={"id": 200006,"name": "udpv6_sendmsg"}
    subjs["200007"]={"id": 200007,"name": "tcp_sendmsg"}
    subjs["300000"]={"id": 300000,"name": "ip_rcv"}
    subjs["300001"]={"id": 300001,"name": "ipv6_rcv"}
    subjs["300002"]={"id": 300002,"name": "ip_list_rcv"}
    subjs["300003"]={"id": 300003,"name": "ipv6_list_rcv"}
    js.dump(subjs,fw)
    fw.close()
    fo.close()
    FuncList=[]
    for item in mainFile:
        if item["name"].find("bpf") != -1 or item["name"] in DisabledList:
            # BPF not applied to itself
            continue
        keywordList=["tcp","udp","icmp","recv","send","xmit","ip","sk","sock"]
        # keywordList=["tcp"]
        if item["name"] in SpecList:
            continue
        found=0
        for ket in keywordList:
            if item["name"].find(ket)!=-1:
                found=1
        if found == 1:
            # continue
            # if(item["name"]=="tcp_recvmsg"):
            FuncList.append((item["name"],item["id"]))

    BPFFile=KproberHeader+SpecialPartRcv+SpecialPartSnd+SpecialPartListen

    for item in FuncList:
        BPFFile+=KproberBody.format(item[0],item[1])
    f=open("./.cache/kProberFunc.c","w")
    f.write(BPFFile)
    f.close()



