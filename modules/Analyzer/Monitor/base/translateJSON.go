//go:build linux
// +build linux

package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
)

// TranslateJSON reads ./.cache/relatedFuncD5.json, builds a mapping by id
// and writes ./.cache/FuncIDMap.json. It also generates
// ./.cache/kProberFunc.c from templates and the discovered functions.
// This function is exported; helpers below are unexported.
func TranslateJSON() error {
	// ensure cache dir
	if err := os.MkdirAll("./.cache", 0o755); err != nil {
		return err
	}

	inPath := filepath.Join(".", ".cache", "relatedFuncD5.json")
	b, err := ioutil.ReadFile(inPath)
	if err != nil {
		return fmt.Errorf("read %s: %w", inPath, err)
	}

	var mainFile []map[string]interface{}
	if err := json.Unmarshal(b, &mainFile); err != nil {
		return fmt.Errorf("unmarshal %s: %w", inPath, err)
	}

	subjs := rebuildJSON(mainFile)

	// add the hard-coded entries from the original script
	subjs["200000"] = map[string]interface{}{"id": 200000, "name": "ip_rcv_core"}
	subjs["200001"] = map[string]interface{}{"id": 200001, "name": "ip6_rcv_core"}
	subjs["200002"] = map[string]interface{}{"id": 200002, "name": "icmp_push_reply"}
	subjs["200003"] = map[string]interface{}{"id": 200003, "name": "rawv6_sendmsg"}
	subjs["200004"] = map[string]interface{}{"id": 200004, "name": "raw_sendmsg"}
	subjs["200005"] = map[string]interface{}{"id": 200005, "name": "udp_sendmsg"}
	subjs["200006"] = map[string]interface{}{"id": 200006, "name": "udpv6_sendmsg"}
	subjs["200007"] = map[string]interface{}{"id": 200007, "name": "tcp_sendmsg"}
	subjs["300000"] = map[string]interface{}{"id": 300000, "name": "ip_rcv"}
	subjs["300001"] = map[string]interface{}{"id": 300001, "name": "ipv6_rcv"}
	subjs["300002"] = map[string]interface{}{"id": 300002, "name": "ip_list_rcv"}
	subjs["300003"] = map[string]interface{}{"id": 300003, "name": "ipv6_list_rcv"}

	outPath := filepath.Join(".", ".cache", "FuncIDMap.json")
	outB, err := json.MarshalIndent(subjs, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal FuncIDMap.json: %w", err)
	}
	if err := ioutil.WriteFile(outPath, outB, 0o644); err != nil {
		return fmt.Errorf("write %s: %w", outPath, err)
	}

	// Build list of functions to emit probes for
	funcList := selectFunctions(mainFile)

	bpf := kproberHeader + specialPartRcv + specialPartSnd + specialPartListen
	for _, fi := range funcList {
		bpf += fmt.Sprintf(kproberBody, fi.name, SnakeToSpecial(fi.name), fi.id, fi.name, SnakeToSpecial(fi.name), fi.id)
	}

	kpath := filepath.Join(".", "kbatch", "kProberFunc.bpf.c")
	if err := ioutil.WriteFile(kpath, []byte(bpf), 0o644); err != nil {
		return fmt.Errorf("write %s: %w", kpath, err)
	}

	return nil
}

// helper types and data
type funcInfo struct {
	name string
	id   interface{}
}

var disabledList = []string{"____sys_recvmsg", "___sys_recvmsg", "sock_recvmsg", "security_socket_recvmsg",
	"apparmor_socket_recvmsg", "unix_stream_recvmsg", "consume_skb",
	"__skb_datagram_iter", "skb_copy_datagram_iter", "skb_put", "skb_release_data",
	"skb_release_head_state", "kfree_skbmem", "skb_free_head", "__build_skb_around",
	"sock_def_readable", "skb_queue_tail", "sock_alloc_send_pskb", "skb_set_owner_w",
	"sock_wfree", "skb_copy_datagram_from_iter", "unix_scm_to_skb", "skb_unlink",
	"apparmor_socket_sendmsg", "security_socket_sendmsg", "security_socket_getpeersec_dgram",
	"____sys_sendmsg", "___sys_sendmsg", "unix_stream_sendmsg", "tcp_poll", "tcp_stream_memory_free",
	"lock_sock_nested", "tcp_release_cb", "map_sock_addr", "security_socket_getpeername", "inet_label_sock_perm",
	"aa_inet_sock_perm", "apparmor_socket_getpeername", "sock_do_ioctl", "udp_poll",
}

var specList = []string{"ip_rcv_core", "ip6_rcv_core", "icmp_push_reply", "rawv6_sendmsg",
	"raw_sendmsg", "udp_sendmsg", "udpv6_sendmsg", "tcp_sendmsg", "ipv6_rcv", "ip_rcv", "ip_list_rcv", "ipv6_list_rcv",
}

func rebuildJSON(input []map[string]interface{}) map[string]map[string]interface{} {
	dictnow := make(map[string]map[string]interface{})
	for _, item := range input {
		var key string
		if v, ok := item["id"]; ok {
			switch t := v.(type) {
			case float64:
				key = fmt.Sprintf("%d", int64(t))
			case int:
				key = fmt.Sprintf("%d", t)
			case int64:
				key = fmt.Sprintf("%d", t)
			case string:
				key = t
			default:
				key = fmt.Sprintf("%v", v)
			}
		} else {
			// fallback: try name
			if n, ok := item["name"].(string); ok {
				key = n
			} else {
				continue
			}
		}
		// store the original item map
		dictnow[key] = item
	}
	return dictnow
}

func inList(s string, list []string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

func selectFunctions(mainFile []map[string]interface{}) []funcInfo {
	keywordList := []string{"tcp", "udp", "icmp", "recv", "send", "xmit", "ip", "sk", "sock"}
	var ret []funcInfo
	for _, item := range mainFile {
		name, _ := item["name"].(string)
		if name == "" {
			continue
		}
		if strings.Contains(name, "bpf") || strings.Contains(name, "trace") || inList(name, disabledList) {
			continue
		}
		if inList(name, specList) {
			continue
		}
		found := false
		for _, k := range keywordList {
			if strings.Contains(name, k) {
				found = true
				break
			}
		}
		if found {
			ret = append(ret, funcInfo{name: name, id: item["id"]})
		}
	}
	return ret
}

// Below are literal templates ported from the original Python script.
var kproberHeader = `
//go:build ignore
#include "./vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_endian.h>
#include <bpf/bpf_tracing.h>
#include <bpf/bpf_core_read.h>

typedef __u64 u64;
typedef __u8 u8;
typedef __u32 u32;
typedef __u16 u16;

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
struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 1 << 24);
} events SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 1 << 24);
} SpecEvents SEC(".maps");
// BPF_RINGBUF_OUTPUT(events, 512);
// BPF_RINGBUF_OUTPUT(SpecEvents, 128);


char LICENSE[] SEC("license") = "GPL";

`

var specialPartRcv = `
SEC("kprobe/ip_rcv_core")
int BPF_KPROBE(KtprobeipVZVXrcvVZVXcore,struct sk_buff *skb)
{
struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
if(!data){{return 0;}}
data->ret = 0;
data->FuncID=200000;
data->kernelTime = bpf_ktime_get_ns();
data->pid = bpf_get_current_pid_tgid();

void *data_ptr = NULL;
bpf_core_read(&data_ptr, sizeof(data_ptr), &skb->data);
if(!data_ptr){
    bpf_ringbuf_submit(data, 0);
    return 0;
}

u8 byte0;
if(bpf_probe_read_kernel(&byte0, sizeof(byte0), data_ptr)){
    bpf_ringbuf_submit(data, 0);
    return 0;
}
u8 ipver = byte0 & 0xF0;

if(ipver == 64){
    // IPv4
    u32 headerlen = (byte0 & 0x0F) * 4;
    
    u8 byte9;
    if(bpf_probe_read_kernel(&byte9, sizeof(byte9), (u8 *)data_ptr + 9)){
        bpf_ringbuf_submit(data, 0);
        return 0;
    }
    u32 subprot = byte9;
    
    if(subprot == 17 || subprot == 6){
        // UDP or TCP
        u8 s1, s2, s3, s4, d1, d2, d3, d4;
        if(bpf_probe_read_kernel(&s1, sizeof(s1), (u8 *)data_ptr + 12)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&s2, sizeof(s2), (u8 *)data_ptr + 13)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&s3, sizeof(s3), (u8 *)data_ptr + 14)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&s4, sizeof(s4), (u8 *)data_ptr + 15)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&d1, sizeof(d1), (u8 *)data_ptr + 16)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&d2, sizeof(d2), (u8 *)data_ptr + 17)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&d3, sizeof(d3), (u8 *)data_ptr + 18)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&d4, sizeof(d4), (u8 *)data_ptr + 19)){bpf_ringbuf_submit(data, 0);return 0;}
        
        data->family = 4;
        data->ipv4__sendaddr = (s4 << 24) | (s3 << 16) | (s2 << 8) | s1;
        data->ipv4__recvaddr = (d4 << 24) | (d3 << 16) | (d2 << 8) | d1;
        
        u8 l0, l1, dp0, dp1;
        if(bpf_probe_read_kernel(&l0, sizeof(l0), (u8 *)data_ptr + headerlen)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&l1, sizeof(l1), (u8 *)data_ptr + headerlen + 1)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&dp0, sizeof(dp0), (u8 *)data_ptr + headerlen + 2)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&dp1, sizeof(dp1), (u8 *)data_ptr + headerlen + 3)){bpf_ringbuf_submit(data, 0);return 0;}
        
        data->lport = (u64)l1 + ((u64)l0 << 8);
        data->dport = (u64)dp1 + ((u64)dp0 << 8);
    }
} else if(ipver == 96){
    // IPv6
    u8 byte6;
    if(bpf_probe_read_kernel(&byte6, sizeof(byte6), (u8 *)data_ptr + 6)){
        bpf_ringbuf_submit(data, 0);
        return 0;
    }
    u32 headertype = byte6;
    
    if(headertype == 6 || headertype == 17){
        // TCP or UDP
        data->family = 6;
        bpf_probe_read_kernel(&data->ipv6__sendaddr, 16, (u8 *)data_ptr + 8);
        bpf_probe_read_kernel(&data->ipv6__recvaddr, 16, (u8 *)data_ptr + 24);
        
        u8 l0, l1, dp0, dp1;
        if(bpf_probe_read_kernel(&l0, sizeof(l0), (u8 *)data_ptr + 40)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&l1, sizeof(l1), (u8 *)data_ptr + 41)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&dp0, sizeof(dp0), (u8 *)data_ptr + 42)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&dp1, sizeof(dp1), (u8 *)data_ptr + 43)){bpf_ringbuf_submit(data, 0);return 0;}
        
        data->lport = (u64)l0 + ((u64)l1 << 8);
        data->dport = (u64)dp0 + ((u64)dp1 << 8);
    }
}

bpf_ringbuf_submit(data, 0);
return 0;
}
SEC("kretprobe/ip_rcv_core")
int BPF_KRETPROBE(KtretprobeipVZVXrcvVZVXcore)
{
struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
if(!data){{return 0;}}
data->FuncID=200000;
data->kernelTime = bpf_ktime_get_ns();
data->pid=bpf_get_current_pid_tgid();
data->ret=1;
bpf_ringbuf_submit(data, 0);
return 0;
}
SEC("kprobe/ip6_rcv_core")
int BPF_KPROBE(Ktprobeip6VZVXrcvVZVXcore,struct sk_buff *skb)
{
struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
if(!data){{return 0;}}
data->ret = 0;
data->FuncID=200001;
data->kernelTime = bpf_ktime_get_ns();
data->pid = bpf_get_current_pid_tgid();

void *data_ptr = NULL;
bpf_core_read(&data_ptr, sizeof(data_ptr), &skb->data);
if(!data_ptr){
    bpf_ringbuf_submit(data, 0);
    return 0;
}

u8 byte0;
if(bpf_probe_read_kernel(&byte0, sizeof(byte0), data_ptr)){
    bpf_ringbuf_submit(data, 0);
    return 0;
}
u8 ipver = byte0 & 0xF0;

if(ipver == 64){
    // IPv4
    u32 headerlen = (byte0 & 0x0F) * 4;
    
    u8 byte9;
    if(bpf_probe_read_kernel(&byte9, sizeof(byte9), (u8 *)data_ptr + 9)){
        bpf_ringbuf_submit(data, 0);
        return 0;
    }
    u32 subprot = byte9;
    
    if(subprot == 17 || subprot == 6){
        // UDP or TCP
        u8 s1, s2, s3, s4, d1, d2, d3, d4;
        if(bpf_probe_read_kernel(&s1, sizeof(s1), (u8 *)data_ptr + 12)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&s2, sizeof(s2), (u8 *)data_ptr + 13)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&s3, sizeof(s3), (u8 *)data_ptr + 14)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&s4, sizeof(s4), (u8 *)data_ptr + 15)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&d1, sizeof(d1), (u8 *)data_ptr + 16)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&d2, sizeof(d2), (u8 *)data_ptr + 17)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&d3, sizeof(d3), (u8 *)data_ptr + 18)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&d4, sizeof(d4), (u8 *)data_ptr + 19)){bpf_ringbuf_submit(data, 0);return 0;}
        
        data->family = 4;
        data->ipv4__sendaddr = (s4 << 24) | (s3 << 16) | (s2 << 8) | s1;
        data->ipv4__recvaddr = (d4 << 24) | (d3 << 16) | (d2 << 8) | d1;
        
        u8 l0, l1, dp0, dp1;
        if(bpf_probe_read_kernel(&l0, sizeof(l0), (u8 *)data_ptr + headerlen)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&l1, sizeof(l1), (u8 *)data_ptr + headerlen + 1)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&dp0, sizeof(dp0), (u8 *)data_ptr + headerlen + 2)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&dp1, sizeof(dp1), (u8 *)data_ptr + headerlen + 3)){bpf_ringbuf_submit(data, 0);return 0;}
        
        data->lport = (u64)l1 + ((u64)l0 << 8);
        data->dport = (u64)dp1 + ((u64)dp0 << 8);
    }
} else if(ipver == 96){
    // IPv6
    u8 byte6;
    if(bpf_probe_read_kernel(&byte6, sizeof(byte6), (u8 *)data_ptr + 6)){
        bpf_ringbuf_submit(data, 0);
        return 0;
    }
    u32 headertype = byte6;
    
    if(headertype == 6 || headertype == 17){
        // TCP or UDP
        data->family = 6;
        bpf_probe_read_kernel(&data->ipv6__sendaddr, 16, (u8 *)data_ptr + 8);
        bpf_probe_read_kernel(&data->ipv6__recvaddr, 16, (u8 *)data_ptr + 24);
        
        u8 l0, l1, dp0, dp1;
        if(bpf_probe_read_kernel(&l0, sizeof(l0), (u8 *)data_ptr + 40)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&l1, sizeof(l1), (u8 *)data_ptr + 41)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&dp0, sizeof(dp0), (u8 *)data_ptr + 42)){bpf_ringbuf_submit(data, 0);return 0;}
        if(bpf_probe_read_kernel(&dp1, sizeof(dp1), (u8 *)data_ptr + 43)){bpf_ringbuf_submit(data, 0);return 0;}
        
        data->lport = (u64)l0 + ((u64)l1 << 8);
        data->dport = (u64)dp0 + ((u64)dp1 << 8);
    }
}

bpf_ringbuf_submit(data, 0);
return 0;
}
SEC("kretprobe/ip6_rcv_core")
int BPF_KRETPROBE(Ktretprobeip6VZVXrcvVZVXcore)
{
struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
if(!data){{return 0;}}
data->FuncID=200001;
data->kernelTime = bpf_ktime_get_ns();
data->pid=bpf_get_current_pid_tgid();
data->ret=1;
bpf_ringbuf_submit(data, 0);
return 0;
}
`

var specialPartSnd = `
SEC("kprobe/icmp_push_reply")
int BPF_KPROBE(KtprobeicmpVZVXpushVZVXreply)
{
   struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){{return 0;}}
    data->kernelTime = bpf_ktime_get_ns();
    data->pid = bpf_get_current_pid_tgid();
    data->FuncID=200002;
    data->ret=0;
    
    // 从寄存器中获取sock指针（在x86_64上，第一个参数通常在rdi寄存器中）
    struct sock *sk = (struct sock *)PT_REGS_PARM1(ctx);
    
    // 验证sk指针是否可读
    if (sk == NULL) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    
    u16 dport;
    if (bpf_probe_read_kernel(&dport, sizeof(dport), &sk->__sk_common.skc_dport) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    data->dport = (dport >> 8) | ((dport << 8) & 0xff00);
    
    u16 lport;
    if (bpf_probe_read_kernel(&lport, sizeof(lport), &sk->__sk_common.skc_num) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    data->lport = (lport >> 8) | ((lport << 8) & 0xff00);
    
    u32 family;
    if (bpf_probe_read_kernel(&family, sizeof(family), &sk->__sk_common.skc_family) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    
    if (family == 10) /* AF_INET6 */
    {
        data->family = 6;
        if (bpf_probe_read_kernel(&data->ipv6__recvaddr, sizeof(data->ipv6__recvaddr), 
                             &sk->__sk_common.skc_v6_daddr.in6_u.u6_addr8) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
        if (bpf_probe_read_kernel(&data->ipv6__sendaddr, sizeof(data->ipv6__sendaddr), 
                             &sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr8) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
    }
    else
    {
        data->family = 4;
        if (bpf_probe_read_kernel(&data->ipv4__recvaddr, sizeof(data->ipv4__recvaddr), 
                             &sk->__sk_common.skc_daddr) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
        if (bpf_probe_read_kernel(&data->ipv4__sendaddr, sizeof(data->ipv4__sendaddr), 
                             &sk->__sk_common.skc_rcv_saddr) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
    }
    
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kretprobe/icmp_push_reply")
int BPF_KRETPROBE(KtretprobeicmpVZVXpushVZVXreply)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){{return 0;}}
    data->FuncID=200002;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kprobe/raw_sendmsg")
int BPF_KPROBE(KtproberawVZVXsendmsg)
{
     struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){{return 0;}}
    data->kernelTime = bpf_ktime_get_ns();
    data->pid = bpf_get_current_pid_tgid();
    data->FuncID=200003;
    data->ret=0;
    
    // 从寄存器中获取sock指针（在x86_64上，第一个参数通常在rdi寄存器中）
    struct sock *sk = (struct sock *)PT_REGS_PARM1(ctx);
    
    // 验证sk指针是否可读
    if (sk == NULL) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    
    u16 dport;
    if (bpf_probe_read_kernel(&dport, sizeof(dport), &sk->__sk_common.skc_dport) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    data->dport = (dport >> 8) | ((dport << 8) & 0xff00);
    
    u16 lport;
    if (bpf_probe_read_kernel(&lport, sizeof(lport), &sk->__sk_common.skc_num) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    data->lport = (lport >> 8) | ((lport << 8) & 0xff00);
    
    u32 family;
    if (bpf_probe_read_kernel(&family, sizeof(family), &sk->__sk_common.skc_family) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    
    if (family == 10) /* AF_INET6 */
    {
        data->family = 6;
        if (bpf_probe_read_kernel(&data->ipv6__recvaddr, sizeof(data->ipv6__recvaddr), 
                             &sk->__sk_common.skc_v6_daddr.in6_u.u6_addr8) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
        if (bpf_probe_read_kernel(&data->ipv6__sendaddr, sizeof(data->ipv6__sendaddr), 
                             &sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr8) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
    }
    else
    {
        data->family = 4;
        if (bpf_probe_read_kernel(&data->ipv4__recvaddr, sizeof(data->ipv4__recvaddr), 
                             &sk->__sk_common.skc_daddr) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
        if (bpf_probe_read_kernel(&data->ipv4__sendaddr, sizeof(data->ipv4__sendaddr), 
                             &sk->__sk_common.skc_rcv_saddr) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
    }
    
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kretprobe/raw_sendmsg")
int BPF_KRETPROBE(KtretproberawVZVXsendmsg)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){{return 0;}}
    data->FuncID=200003;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    bpf_ringbuf_submit(data, 0);
    return 0;
}

SEC("kprobe/rawv6_sendmsg")
int BPF_KPROBE(Ktproberawv6VZVXsendmsg)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){{return 0;}}
    data->kernelTime = bpf_ktime_get_ns();
    data->pid = bpf_get_current_pid_tgid();
    data->FuncID=200004;
    data->ret=0;
    
    // 从寄存器中获取sock指针（在x86_64上，第一个参数通常在rdi寄存器中）
    struct sock *sk = (struct sock *)PT_REGS_PARM1(ctx);
    
    // 验证sk指针是否可读
    if (sk == NULL) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    
    u16 dport;
    if (bpf_probe_read_kernel(&dport, sizeof(dport), &sk->__sk_common.skc_dport) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    data->dport = (dport >> 8) | ((dport << 8) & 0xff00);
    
    u16 lport;
    if (bpf_probe_read_kernel(&lport, sizeof(lport), &sk->__sk_common.skc_num) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    data->lport = (lport >> 8) | ((lport << 8) & 0xff00);
    
    u32 family;
    if (bpf_probe_read_kernel(&family, sizeof(family), &sk->__sk_common.skc_family) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    
    if (family == 10) /* AF_INET6 */
    {
        data->family = 6;
        if (bpf_probe_read_kernel(&data->ipv6__recvaddr, sizeof(data->ipv6__recvaddr), 
                             &sk->__sk_common.skc_v6_daddr.in6_u.u6_addr8) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
        if (bpf_probe_read_kernel(&data->ipv6__sendaddr, sizeof(data->ipv6__sendaddr), 
                             &sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr8) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
    }
    else
    {
        data->family = 4;
        if (bpf_probe_read_kernel(&data->ipv4__recvaddr, sizeof(data->ipv4__recvaddr), 
                             &sk->__sk_common.skc_daddr) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
        if (bpf_probe_read_kernel(&data->ipv4__sendaddr, sizeof(data->ipv4__sendaddr), 
                             &sk->__sk_common.skc_rcv_saddr) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
    }
    
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kretprobe/rawv6_sendmsg")
int BPF_KRETPROBE(Ktretproberawv6VZVXsendmsg)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){{return 0;}}
    data->FuncID=200004;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kprobe/udp_sendmsg")
int BPF_KPROBE(KtprobeudpVZVXsendmsg)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){{return 0;}}
    data->kernelTime = bpf_ktime_get_ns();
    data->pid = bpf_get_current_pid_tgid();
    data->FuncID=200005;
    data->ret=0;
    
    // 从寄存器中获取sock指针（在x86_64上，第一个参数通常在rdi寄存器中）
    struct sock *sk = (struct sock *)PT_REGS_PARM1(ctx);
    
    // 验证sk指针是否可读
    if (sk == NULL) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    
    u16 dport;
    if (bpf_probe_read_kernel(&dport, sizeof(dport), &sk->__sk_common.skc_dport) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    data->dport = (dport >> 8) | ((dport << 8) & 0xff00);
    
    u16 lport;
    if (bpf_probe_read_kernel(&lport, sizeof(lport), &sk->__sk_common.skc_num) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    data->lport = (lport >> 8) | ((lport << 8) & 0xff00);
    
    u32 family;
    if (bpf_probe_read_kernel(&family, sizeof(family), &sk->__sk_common.skc_family) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    
    if (family == 10) /* AF_INET6 */
    {
        data->family = 6;
        if (bpf_probe_read_kernel(&data->ipv6__recvaddr, sizeof(data->ipv6__recvaddr), 
                             &sk->__sk_common.skc_v6_daddr.in6_u.u6_addr8) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
        if (bpf_probe_read_kernel(&data->ipv6__sendaddr, sizeof(data->ipv6__sendaddr), 
                             &sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr8) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
    }
    else
    {
        data->family = 4;
        if (bpf_probe_read_kernel(&data->ipv4__recvaddr, sizeof(data->ipv4__recvaddr), 
                             &sk->__sk_common.skc_daddr) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
        if (bpf_probe_read_kernel(&data->ipv4__sendaddr, sizeof(data->ipv4__sendaddr), 
                             &sk->__sk_common.skc_rcv_saddr) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
    }
    
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kretprobe/udp_sendmsg")
int BPF_KRETPROBE(KtretprobeudpVZVXsendmsg)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){{return 0;}}
    data->FuncID=200005;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kprobe/udpv6_sendmsg")
int BPF_KPROBE(Ktprobeudpv6VZVXsendmsg)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){{return 0;}}
    data->kernelTime = bpf_ktime_get_ns();
    data->pid = bpf_get_current_pid_tgid();
    data->FuncID=200006;
    data->ret=0;
    
    // 从寄存器中获取sock指针（在x86_64上，第一个参数通常在rdi寄存器中）
    struct sock *sk = (struct sock *)PT_REGS_PARM1(ctx);
    
    // 验证sk指针是否可读
    if (sk == NULL) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    
    u16 dport;
    if (bpf_probe_read_kernel(&dport, sizeof(dport), &sk->__sk_common.skc_dport) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    data->dport = (dport >> 8) | ((dport << 8) & 0xff00);
    
    u16 lport;
    if (bpf_probe_read_kernel(&lport, sizeof(lport), &sk->__sk_common.skc_num) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    data->lport = (lport >> 8) | ((lport << 8) & 0xff00);
    
    u32 family;
    if (bpf_probe_read_kernel(&family, sizeof(family), &sk->__sk_common.skc_family) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    
    if (family == 10) /* AF_INET6 */
    {
        data->family = 6;
        if (bpf_probe_read_kernel(&data->ipv6__recvaddr, sizeof(data->ipv6__recvaddr), 
                             &sk->__sk_common.skc_v6_daddr.in6_u.u6_addr8) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
        if (bpf_probe_read_kernel(&data->ipv6__sendaddr, sizeof(data->ipv6__sendaddr), 
                             &sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr8) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
    }
    else
    {
        data->family = 4;
        if (bpf_probe_read_kernel(&data->ipv4__recvaddr, sizeof(data->ipv4__recvaddr), 
                             &sk->__sk_common.skc_daddr) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
        if (bpf_probe_read_kernel(&data->ipv4__sendaddr, sizeof(data->ipv4__sendaddr), 
                             &sk->__sk_common.skc_rcv_saddr) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
    }
    
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kretprobe/udpv6_sendmsg")
int BPF_KRETPROBE(Ktretprobeudpv6VZVXsendmsg)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){{return 0;}}
    data->FuncID=200006;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kprobe/tcp_sendmsg")
int BPF_KPROBE(KtprobetcpVZVXsendmsg)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){{return 0;}}
    data->kernelTime = bpf_ktime_get_ns();
    data->pid = bpf_get_current_pid_tgid();
    data->FuncID=200007;
    data->ret=0;
    
    // 从寄存器中获取sock指针（在x86_64上，第一个参数通常在rdi寄存器中）
    struct sock *sk = (struct sock *)PT_REGS_PARM1(ctx);
    
    // 验证sk指针是否可读
    if (sk == NULL) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    
    u16 dport;
    if (bpf_probe_read_kernel(&dport, sizeof(dport), &sk->__sk_common.skc_dport) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    data->dport = (dport >> 8) | ((dport << 8) & 0xff00);
    
    u16 lport;
    if (bpf_probe_read_kernel(&lport, sizeof(lport), &sk->__sk_common.skc_num) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    data->lport = (lport >> 8) | ((lport << 8) & 0xff00);
    
    u32 family;
    if (bpf_probe_read_kernel(&family, sizeof(family), &sk->__sk_common.skc_family) != 0) {
        bpf_ringbuf_discard(data, 0);
        return 0;
    }
    
    if (family == 10) /* AF_INET6 */
    {
        data->family = 6;
        if (bpf_probe_read_kernel(&data->ipv6__recvaddr, sizeof(data->ipv6__recvaddr), 
                             &sk->__sk_common.skc_v6_daddr.in6_u.u6_addr8) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
        if (bpf_probe_read_kernel(&data->ipv6__sendaddr, sizeof(data->ipv6__sendaddr), 
                             &sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr8) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
    }
    else
    {
        data->family = 4;
        if (bpf_probe_read_kernel(&data->ipv4__recvaddr, sizeof(data->ipv4__recvaddr), 
                             &sk->__sk_common.skc_daddr) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
        if (bpf_probe_read_kernel(&data->ipv4__sendaddr, sizeof(data->ipv4__sendaddr), 
                             &sk->__sk_common.skc_rcv_saddr) != 0) {
            bpf_ringbuf_discard(data, 0);
            return 0;
        }
    }
    
    bpf_ringbuf_submit(data, 0);
    return 0;
}

SEC("kretprobe/tcp_sendmsg")
int BPF_KRETPROBE(KtretprobetcpVZVXsendmsg)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){{return 0;}}
    data->FuncID=200007;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    bpf_ringbuf_submit(data, 0);
    return 0;
}
`

var specialPartListen = `
SEC("kprobe/ip_rcv")
int BPF_KPROBE(KtprobeipVZVXrcv)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){return 0;}
    data->FuncID=300000;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=0;
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kretprobe/ip_rcv")
int BPF_KRETPROBE(KtretprobeipVZVXrcv)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){return 0;}
    data->FuncID=300000;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kprobe/ipv6_rcv")
int BPF_KPROBE(Ktprobeipv6VZVXrcv)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){return 0;}
    data->FuncID=300001;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=0;
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kretprobe/ipv6_rcv")
int BPF_KRETPROBE(Ktretprobeipv6VZVXrcv)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){return 0;}
    data->FuncID=300001;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kprobe/ip_list_rcv")
int BPF_KPROBE(KtprobeipVZVXlistVZVXrcv)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){return 0;}
    data->FuncID=300002;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=0;
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kretprobe/ip_list_rcv")
int BPF_KRETPROBE(KtretprobeipVZVXlistVZVXrcv)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){return 0;}
    data->FuncID=300002;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kprobe/ipv6_list_rcv")
int BPF_KPROBE(Ktprobeipv6VZVXlistVZVXrcv)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){return 0;}
    data->FuncID=300003;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=0;
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kretprobe/ipv6_list_rcv")
int BPF_KRETPROBE(Ktretprobeipv6VZVXlistVZVXrcv)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){return 0;}
    data->FuncID=300003;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    bpf_ringbuf_submit(data, 0);
    return 0;
}
`

var kproberBody = `
SEC("kprobe/%s")
int BPF_KPROBE(Ktprobe%s)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){return 0;}
    data->FuncID=%v;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=0;
    bpf_ringbuf_submit(data, 0);
    return 0;
}
SEC("kretprobe/%s")
int BPF_KRETPROBE(Ktretprobe%s)
{
    struct SkProbe *data = bpf_ringbuf_reserve(&events, sizeof(struct SkProbe), 0);
    if(!data){return 0;}
    data->FuncID=%v;
    data->kernelTime = bpf_ktime_get_ns();
    data->pid=bpf_get_current_pid_tgid();
    data->ret=1;
    bpf_ringbuf_submit(data, 0);
    return 0;
}
`
