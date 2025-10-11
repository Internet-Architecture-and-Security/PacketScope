#!/usr/bin/env python

from __future__ import print_function
from bcc import BPF
from ctypes import *
import argparse
import os
from time import sleep, time, localtime, asctime
import socket
import struct
import json
import queue
from socket import inet_ntop, AF_INET, AF_INET6
from struct import pack
import time


class FiveTupleIPV4(Structure):
    _fields_ = [
        ('saddr', c_uint32),
        ('daddr', c_uint32),
        ('sport', c_uint16),
        ('dport', c_uint16),
        ('protocol', c_uint8)
    ]


class FiveTupleIPV6(Structure):
    _fields_ = [
        ('saddr', c_uint32 * 4),
        ('daddr', c_uint32 * 4),
        ('sport', c_uint16),
        ('dport', c_uint16),
        ('protocol', c_uint8),
        ('_padding', c_uint8 * 3)
    ]


def ip_to_uint(ip):
    try:
        return struct.unpack("!I", socket.inet_aton(ip))[0]
    except:
        raise ValueError("Invalid IP address")


def ipv6_to_uint32(ip):
    try:
        packed = socket.inet_pton(socket.AF_INET6, ip)
        return struct.unpack('!4I', packed)
    except:
        raise ValueError("Invalid IPv6 address")


# BPF program generator
def create_bpf_text():
    return """
    #include <net/tcp_states.h> 
    #include <linux/netdevice.h>
    #include <linux/ethtool.h>
    #include <linux/ip.h>
    #include <linux/ipv6.h>
    #include <linux/tcp.h>
    #include <linux/udp.h>
    #include <linux/icmp.h>
    #include <linux/if_ether.h>
    #include <uapi/linux/ptrace.h>
    #include <net/sock.h>
    #include <bcc/proto.h>
    #include <linux/skbuff.h>

    struct five_tuple_ipv4 {
        u32 saddr;
        u32 daddr;
        u16 sport;
        u16 dport;
        u8 protocol;
    };
    BPF_ARRAY(five_tuple_filter_ipv4, struct five_tuple_ipv4, 1);

    struct five_tuple_ipv6 {
        __u32 saddr[4];
        __u32 daddr[4];
        u16 sport;
        u16 dport;
        u8 protocol;
    };
    BPF_ARRAY(five_tuple_filter_ipv6, struct five_tuple_ipv6, 1);

    struct key_t {
        u8 protocol;
        union {
            struct {
                u32 saddr;
                u32 daddr;
            } ipv4;
            struct {
                __u32 saddr[4];
                __u32 daddr[4];
            } ipv6;
        };
        u16 sport;
        u16 dport;
        u8 direction;  
    };

    struct info_t {
        u64 ts;
        u32 pid;
        char task[TASK_COMM_LEN];
    };
    BPF_HASH(start, struct key_t, struct info_t);

    struct info_t_translink {
        u64 ts_translink;
        u32 pid_translink;
        char task_translink[TASK_COMM_LEN];
    };
    BPF_HASH(start_translink, struct key_t, struct info_t_translink);

    struct info_t_transnetwork {
        u64 ts_transnetwork;
        u32 pid_transnetwork;
        char task_transnetwork[TASK_COMM_LEN];
    };
    BPF_HASH(start_transnetwork, struct key_t, struct info_t_transnetwork);

    struct ipv4_data_t {
        u64 ts_us;
        u32 pid;
        u32 saddr;
        u32 daddr;
        u16 lport;
        u16 dport;
        u64 delta_us;
        char task[TASK_COMM_LEN];
    };
    BPF_PERF_OUTPUT(ipv4_events_tx);  
    BPF_PERF_OUTPUT(ipv4_events_rx);  

    struct ipv6_data_t {
        u64 ts_us;
        u32 pid;
        unsigned __int128 saddr;
        unsigned __int128 daddr;
        u16 lport;
        u16 dport;
        u64 delta_us;
        char task[TASK_COMM_LEN];
    };
    BPF_PERF_OUTPUT(ipv6_events_tx);   
    BPF_PERF_OUTPUT(ipv6_events_rx); 

    // 2、linktrans:
    struct ipv4_data_t_linktrans {
        u64 ts_us;
        u32 pid;
        u32 saddr;
        u32 daddr;
        u16 lport;
        u16 dport;
        u64 delta_us;
        char task[TASK_COMM_LEN];
    };
    BPF_PERF_OUTPUT(ipv4_events_tx_linktrans);  
    BPF_PERF_OUTPUT(ipv4_events_rx_linktrans);  

    struct ipv6_data_t_linktrans {
        u64 ts_us;
        u32 pid;
        unsigned __int128 saddr;
        unsigned __int128 daddr;
        u16 lport;
        u16 dport;
        u64 delta_us;
        char task[TASK_COMM_LEN];
    };
    BPF_PERF_OUTPUT(ipv6_events_tx_linktrans);   
    BPF_PERF_OUTPUT(ipv6_events_rx_linktrans); 

    // 3、networktrans:
    struct ipv4_data_t_networktrans {
        u64 ts_us;
        u32 pid;
        u32 saddr;
        u32 daddr;
        u16 lport;
        u16 dport;
        u64 delta_us;
        char task[TASK_COMM_LEN];
    };
    BPF_PERF_OUTPUT(ipv4_events_tx_networktrans);  
    BPF_PERF_OUTPUT(ipv4_events_rx_networktrans);  

    struct ipv6_data_t_networktrans {
        u64 ts_us;
        u32 pid;
        unsigned __int128 saddr;
        unsigned __int128 daddr;
        u16 lport;
        u16 dport;
        u64 delta_us;
        char task[TASK_COMM_LEN];
    };
    BPF_PERF_OUTPUT(ipv6_events_tx_networktrans);   
    BPF_PERF_OUTPUT(ipv6_events_rx_networktrans); 

    // packet num:
    // trans output:
    struct ipv4_data_t_transnum {
        u64 ts_us;
        u32 pid;
        u32 saddr;
        u32 daddr;
        u16 lport;
        u16 dport;
    };
    BPF_PERF_OUTPUT(ipv4_events_tx_transnum);   

    struct ipv6_data_t_transnum {
        u64 ts_us;
        u32 pid;
        unsigned __int128 saddr;
        unsigned __int128 daddr;
        u16 lport;
        u16 dport;
    };
    BPF_PERF_OUTPUT(ipv6_events_tx_transnum); 

     // trans input:
    struct ipv4_data_r_transnum {
        u64 ts_us;
        u32 pid;
        u32 saddr;
        u32 daddr;
        u16 lport;
        u16 dport;
    };
    BPF_PERF_OUTPUT(ipv4_events_rx_transnum);   

    struct ipv6_data_r_transnum {
        u64 ts_us;
        u32 pid;
        unsigned __int128 saddr;
        unsigned __int128 daddr;
        u16 lport;
        u16 dport;
    }; 
    BPF_PERF_OUTPUT(ipv6_events_rx_transnum); 

    // network output:
    struct ipv4_data_t_networknum {
        u64 ts_us;
        u32 pid;
        u32 saddr;
        u32 daddr;
        u16 lport;
        u16 dport;
    };
    BPF_PERF_OUTPUT(ipv4_events_tx_networknum);   

    struct ipv6_data_t_networknum {
        u64 ts_us;
        u32 pid;
        unsigned __int128 saddr;
        unsigned __int128 daddr;
        u16 lport;
        u16 dport;
    };
    BPF_PERF_OUTPUT(ipv6_events_tx_networknum); 

    // network input:
    struct ipv4_data_r_networknum {
        u64 ts_us;
        u32 pid;
        u32 saddr;
        u32 daddr;
        u16 lport;
        u16 dport;
    };
    BPF_PERF_OUTPUT(ipv4_events_rx_networknum);   

    struct ipv6_data_r_networknum {
        u64 ts_us;
        u32 pid;
        unsigned __int128 saddr;
        unsigned __int128 daddr;
        u16 lport;
        u16 dport;
    }; 
    BPF_PERF_OUTPUT(ipv6_events_rx_networknum);

   // link output:
    struct ipv4_data_t_linknum {
        u64 ts_us;
        u32 pid;
        u32 saddr;
        u32 daddr;
        u16 lport;
        u16 dport;
    };
    BPF_PERF_OUTPUT(ipv4_events_tx_linknum);   

    struct ipv6_data_t_linknum {
        u64 ts_us;
        u32 pid;
        unsigned __int128 saddr;
        unsigned __int128 daddr;
        u16 lport;
        u16 dport;
    };
    BPF_PERF_OUTPUT(ipv6_events_tx_linknum); 

    // link input:
    struct ipv4_data_r_linknum {
        u64 ts_us;
        u32 pid;
        u32 saddr;
        u32 daddr;
        u16 lport;
        u16 dport;
    };
    BPF_PERF_OUTPUT(ipv4_events_rx_linknum);   

    struct ipv6_data_r_linknum {
        u64 ts_us;
        u32 pid;
        unsigned __int128 saddr;
        unsigned __int128 daddr;
        u16 lport;
        u16 dport;
    }; 
    BPF_PERF_OUTPUT(ipv6_events_rx_linknum);

    // 1、tcp drop:
    // IPv4 data struct: drop
    struct ipv4_data_t_drop {
        u64 ts_us;
        u32 pid;
        u32 saddr;
        u32 daddr;
        u16 lport;
        u16 dport;
    };
    BPF_PERF_OUTPUT(ipv4_events);  
    // IPv6 data struct: drop
    struct ipv6_data_t_drop {
        u64 ts_us;
        u32 pid;
        unsigned __int128 saddr;
        unsigned __int128 daddr;
        u16 lport;
        u16 dport;
    };
    BPF_PERF_OUTPUT(ipv6_events); 

    static inline struct iphdr *skb_to_iphdr(const struct sk_buff *skb) {
        return (struct iphdr *)(skb->head + skb->network_header);
    }

    static inline struct ipv6hdr *skb_to_ipv6hdr(const struct sk_buff *skb) {
        return (struct ipv6hdr *)(skb->head + skb->network_header);
    }

    static struct tcphdr *skb_to_tcphdr(const struct sk_buff *skb) {
        return (struct tcphdr *)(skb->head + skb->transport_header);
    }

    static struct udphdr *skb_to_udphdr(const struct sk_buff *skb) {
        return (struct udphdr *)(skb->head + skb->transport_header);
    }

    // 从sock结构提取四元组信息
    static void extract_key(struct key_t *key, struct sk_buff *skb, u8 direction) {
        u16 protocol;
        bpf_probe_read_kernel(&protocol, sizeof(protocol), (void *)&skb->protocol);
        protocol = bpf_htons(protocol);

        key->direction = direction;

        if ( protocol == ETH_P_IP ) {   
            // Read IP header
            struct iphdr *iph = skb_to_iphdr(skb);
            key->ipv4.saddr = bpf_ntohl(iph->saddr);
            key->ipv4.daddr = bpf_ntohl(iph->daddr); 
            key->protocol = iph->protocol;

            // For TCP/UDP, ports
            if ( iph->protocol == IPPROTO_TCP ){   
                struct tcphdr *tcph = skb_to_tcphdr(skb);            
                key->sport = bpf_ntohs(tcph->source);
                key->dport = bpf_ntohs(tcph->dest);
            }
            else if ( iph->protocol == IPPROTO_UDP ){          
                struct udphdr *udph = skb_to_udphdr(skb);
                key->sport = bpf_ntohs(udph->source);
                key->dport = bpf_ntohs(udph->dest);
            }
            else {           
                key->sport = 0;
                key->dport = 0;
            }
       }  
       else if ( protocol == ETH_P_IPV6 ) {
            // Read IP header
            struct ipv6hdr *ipv6h = skb_to_ipv6hdr(skb);
            key->ipv6.saddr[0] = bpf_ntohl(ipv6h->saddr.in6_u.u6_addr32[0]);
            key->ipv6.saddr[1] = bpf_ntohl(ipv6h->saddr.in6_u.u6_addr32[1]);
            key->ipv6.saddr[2] = bpf_ntohl(ipv6h->saddr.in6_u.u6_addr32[2]);
            key->ipv6.saddr[3] = bpf_ntohl(ipv6h->saddr.in6_u.u6_addr32[3]);

            key->ipv6.daddr[0] = bpf_ntohl(ipv6h->daddr.in6_u.u6_addr32[0]);
            key->ipv6.daddr[1] = bpf_ntohl(ipv6h->daddr.in6_u.u6_addr32[1]);
            key->ipv6.daddr[2] = bpf_ntohl(ipv6h->daddr.in6_u.u6_addr32[2]);
            key->ipv6.daddr[3] = bpf_ntohl(ipv6h->daddr.in6_u.u6_addr32[3]);

            key->protocol = ipv6h->nexthdr;

            // For TCP/UDP, ports
            if ( ipv6h->nexthdr == IPPROTO_TCP ){                
                struct tcphdr *tcph = skb_to_tcphdr(skb);
                key->sport = bpf_ntohs(tcph->source);
                key->dport = bpf_ntohs(tcph->dest);
            }
            else if ( ipv6h->nexthdr == IPPROTO_UDP ){         
                struct udphdr *udph = skb_to_udphdr(skb);
                key->sport = bpf_ntohs(udph->source);
                key->dport = bpf_ntohs(udph->dest);
            }
            else {           
                key->sport = 0;
                key->dport = 0;
            }
       }  
    }

    // Five-tuple matching 
    static inline int match_five_tuple(struct sk_buff *skb) {
        u16 protocol;
        bpf_probe_read_kernel(&protocol, sizeof(protocol), (void *)&skb->protocol);
        protocol = bpf_htons(protocol);

        if (protocol == ETH_P_IP) {
            int key = 0;
            struct five_tuple_ipv4 *filter = five_tuple_filter_ipv4.lookup(&key);
            if (!filter) return 0;

            struct iphdr *iph = skb_to_iphdr(skb);
            if (iph->protocol != filter->protocol || 
                bpf_ntohl(iph->saddr) != filter->saddr || 
                bpf_ntohl(iph->daddr) != filter->daddr) {
                return 0;
            }

            if (iph->protocol == IPPROTO_TCP) {
                struct tcphdr *tcph = skb_to_tcphdr(skb);
                if (bpf_ntohs(tcph->source) != bpf_ntohs(filter->sport) ||
                    bpf_ntohs(tcph->dest) != bpf_ntohs(filter->dport) ) {
                    return 0;
                }
            }
            else if (iph->protocol == IPPROTO_UDP) {
                struct udphdr *udph = skb_to_udphdr(skb);
                if (bpf_ntohs(udph->source) != bpf_ntohs(filter->sport) || 
                    bpf_ntohs(udph->dest) != bpf_ntohs(filter->dport) ) {
                    return 0;
                }
            }
            return 1;
        }
        else if (protocol == ETH_P_IPV6) {
            int key = 0;
            struct five_tuple_ipv6 *filter = five_tuple_filter_ipv6.lookup(&key);
            if (!filter) return 0;

            struct ipv6hdr *ipv6h = skb_to_ipv6hdr(skb);
            if (ipv6h->nexthdr != filter->protocol) {
                return 0;
            }

            #pragma unroll
            for (int i = 0; i < 4; i++) {
                __u32 saddr_part;
                bpf_probe_read_kernel(&saddr_part, sizeof(saddr_part), &ipv6h->saddr.in6_u.u6_addr32[i]);
                if (bpf_ntohl(saddr_part) != filter->saddr[i]) {
                    return 0;
                }
            }

            #pragma unroll
            for (int i = 0; i < 4; i++) {
                __u32 daddr_part;
                bpf_probe_read_kernel(&daddr_part, sizeof(daddr_part), &ipv6h->daddr.in6_u.u6_addr32[i]);
                if (bpf_ntohl(daddr_part) != filter->daddr[i]) {
                    return 0;
                }
            }

            if (ipv6h->nexthdr == IPPROTO_TCP) {
                struct tcphdr *tcph = skb_to_tcphdr(skb);
                if (bpf_ntohs(tcph->source) != bpf_ntohs(filter->sport) ||
                    bpf_ntohs(tcph->dest) != bpf_ntohs(filter->dport)  ) {
                    return 0;
                }
            }
            else if (ipv6h->nexthdr == IPPROTO_UDP) {
                struct udphdr *udph = skb_to_udphdr(skb);
                if (bpf_ntohs(udph->source) != bpf_ntohs(filter->sport) || 
                    bpf_ntohs(udph->dest) != bpf_ntohs(filter->dport)  ) {
                    return 0;
                }
            }
            return 1;
        }
        return 0;
    }

    // Five-tuple matching (reverse direction)
    static inline int match_five_tuple_rx(struct sk_buff *skb) {
        u16 protocol;
        bpf_probe_read_kernel(&protocol, sizeof(protocol), (void *)&skb->protocol);
        protocol = bpf_htons(protocol);

        if (protocol == ETH_P_IP) {
            int key = 0;
            struct five_tuple_ipv4 *filter = five_tuple_filter_ipv4.lookup(&key);
            if (!filter) return 0;

            struct iphdr *iph = skb_to_iphdr(skb);
            if (iph->protocol != filter->protocol || 
                bpf_ntohl(iph->daddr) != filter->saddr || 
                bpf_ntohl(iph->saddr) != filter->daddr) {
                return 0;
            }

            if (iph->protocol == IPPROTO_TCP) {
                struct tcphdr *tcph = skb_to_tcphdr(skb);
                if (bpf_ntohs(tcph->dest) != bpf_ntohs(filter->sport) ||
                    bpf_ntohs(tcph->source) != bpf_ntohs(filter->dport) ) {
                    return 0;
                }
            }
            else if (iph->protocol == IPPROTO_UDP) {
                struct udphdr *udph = skb_to_udphdr(skb);
                if (bpf_ntohs(udph->dest) != bpf_ntohs(filter->sport) || 
                    bpf_ntohs(udph->source) != bpf_ntohs(filter->dport) ) {
                    return 0;
                }
            }
            return 1;
        }
        else if (protocol == ETH_P_IPV6) {
            int key = 0;
            struct five_tuple_ipv6 *filter = five_tuple_filter_ipv6.lookup(&key);
            if (!filter) return 0;

            struct ipv6hdr *ipv6h = skb_to_ipv6hdr(skb);
            if (ipv6h->nexthdr != filter->protocol) {
                return 0;
            }

            #pragma unroll
            for (int i = 0; i < 4; i++) {
                __u32 saddr_part;
                bpf_probe_read_kernel(&saddr_part, sizeof(saddr_part), &ipv6h->saddr.in6_u.u6_addr32[i]);
                if (bpf_ntohl(saddr_part) != filter->daddr[i]) {
                    return 0;
                }
            }

            #pragma unroll
            for (int i = 0; i < 4; i++) {
                __u32 daddr_part;
                bpf_probe_read_kernel(&daddr_part, sizeof(daddr_part), &ipv6h->daddr.in6_u.u6_addr32[i]);
                if (bpf_ntohl(daddr_part) != filter->saddr[i]) {
                    return 0;
                }
            }

            if (ipv6h->nexthdr == IPPROTO_TCP) {
                struct tcphdr *tcph = skb_to_tcphdr(skb);
                if (bpf_ntohs(tcph->source) != bpf_ntohs(filter->dport) ||
                    bpf_ntohs(tcph->dest) != bpf_ntohs(filter->sport) ) {
                    return 0;
                }
            }
            else if (ipv6h->nexthdr == IPPROTO_UDP) {
                struct udphdr *udph = skb_to_udphdr(skb);
                if (bpf_ntohs(udph->source) != bpf_ntohs(filter->dport) || 
                    bpf_ntohs(udph->dest) != bpf_ntohs(filter->sport) ) {
                    return 0;
                }
            }
            return 1;
        }
        return 0;
    }

    static void extract_key_sock(struct key_t *key, struct socket *sock, u8 direction) {
        key->direction = direction;
        struct sock *sk = sock->sk;
        u16 family = 0;
        bpf_probe_read(&family, sizeof(family), &sk->__sk_common.skc_family);

        if ( family == AF_INET ) {   
            u32 saddr = sk->__sk_common.skc_rcv_saddr;
            key->ipv4.saddr = bpf_ntohl(saddr);
            u32 daddr = sk->__sk_common.skc_daddr;
            key->ipv4.daddr = bpf_ntohl(daddr);
            u16 dport = sk->__sk_common.skc_dport;
            key->dport = bpf_ntohs(dport);
            u16 sport = sk->__sk_common.skc_num;
            key->sport = (sport);  

            // protocol
            u16 protocol = 0;
            int gso_max_segs_offset = offsetof(struct sock, sk_gso_max_segs);
            int sk_lingertime_offset = offsetof(struct sock, sk_lingertime);
            if (sk_lingertime_offset - gso_max_segs_offset == 2)
                protocol = sk->sk_protocol;
            else if (sk_lingertime_offset - gso_max_segs_offset == 4)
                // 4.10+ with little endian
                #if __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
                          protocol = *(u8 *)((u64)&sk->sk_gso_max_segs - 3);
                       else
                           // pre-4.10 with little endian
                          protocol = *(u8 *)((u64)&sk->sk_wmem_queued - 3);
                #elif __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
                          // 4.10+ with big endian
                          protocol = *(u8 *)((u64)&sk->sk_gso_max_segs - 1);
                       else
                          // pre-4.10 with big endian
                          protocol = *(u8 *)((u64)&sk->sk_wmem_queued - 1);
                #else
                # error "Fix your compiler's __BYTE_ORDER__?!"
                #endif

            key->protocol = protocol;

        } 
        else if ( family == AF_INET6 ) {
            key->ipv6.saddr[0] = bpf_ntohl(sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32[0]);
            key->ipv6.saddr[1] = bpf_ntohl(sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32[1]);
            key->ipv6.saddr[2] = bpf_ntohl(sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32[2]);
            key->ipv6.saddr[3] = bpf_ntohl(sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32[3]);
            //
            key->ipv6.daddr[0] = bpf_ntohl(sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32[0]);
            key->ipv6.daddr[1] = bpf_ntohl(sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32[1]);
            key->ipv6.daddr[2] = bpf_ntohl(sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32[2]);
            key->ipv6.daddr[3] = bpf_ntohl(sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32[3]);

            u16 dport = sk->__sk_common.skc_dport;
            key->dport = bpf_ntohs(dport);
            u16 sport = sk->__sk_common.skc_num;
            key->sport = bpf_ntohs(sport);

            // protocol
            u16 protocol = 0;
            int gso_max_segs_offset = offsetof(struct sock, sk_gso_max_segs);
            int sk_lingertime_offset = offsetof(struct sock, sk_lingertime);
            if (sk_lingertime_offset - gso_max_segs_offset == 2)
                protocol = sk->sk_protocol;
            else if (sk_lingertime_offset - gso_max_segs_offset == 4)
                // 4.10+ with little endian
                #if __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
                          protocol = *(u8 *)((u64)&sk->sk_gso_max_segs - 3);
                       else
                           // pre-4.10 with little endian
                          protocol = *(u8 *)((u64)&sk->sk_wmem_queued - 3);
                #elif __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
                          // 4.10+ with big endian
                          protocol = *(u8 *)((u64)&sk->sk_gso_max_segs - 1);
                       else
                          // pre-4.10 with big endian
                          protocol = *(u8 *)((u64)&sk->sk_wmem_queued - 1);
                #else
                # error "Fix your compiler's __BYTE_ORDER__?!"
                #endif

            key->protocol = protocol;
       }    
    }

    static void extract_key_sock_rx(struct key_t *key, struct socket *sock, u8 direction) {
        key->direction = direction;
        struct sock *sk = sock->sk;
        u16 family = 0;
        bpf_probe_read(&family, sizeof(family), &sk->__sk_common.skc_family);

        if ( family == AF_INET ) {   
            u32 saddr = sk->__sk_common.skc_rcv_saddr;
            key->ipv4.daddr = bpf_ntohl(saddr);
            u32 daddr = sk->__sk_common.skc_daddr;
            key->ipv4.saddr = bpf_ntohl(daddr);
            u16 dport = sk->__sk_common.skc_dport;
            key->sport = bpf_ntohs(dport);
            u16 sport = sk->__sk_common.skc_num;
            key->dport = (sport); 

            // protocol
            u16 protocol = 0;
            int gso_max_segs_offset = offsetof(struct sock, sk_gso_max_segs);
            int sk_lingertime_offset = offsetof(struct sock, sk_lingertime);
            if (sk_lingertime_offset - gso_max_segs_offset == 2)
                protocol = sk->sk_protocol;
            else if (sk_lingertime_offset - gso_max_segs_offset == 4)
                // 4.10+ with little endian
                #if __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
                          protocol = *(u8 *)((u64)&sk->sk_gso_max_segs - 3);
                       else
                           // pre-4.10 with little endian
                          protocol = *(u8 *)((u64)&sk->sk_wmem_queued - 3);
                #elif __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
                          // 4.10+ with big endian
                          protocol = *(u8 *)((u64)&sk->sk_gso_max_segs - 1);
                       else
                          // pre-4.10 with big endian
                          protocol = *(u8 *)((u64)&sk->sk_wmem_queued - 1);
                #else
                # error "Fix your compiler's __BYTE_ORDER__?!"
                #endif

           key->protocol = protocol;

        }  
        else if ( family == AF_INET6 ) {
            key->ipv6.daddr[0] = bpf_ntohl(sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32[0]);
            key->ipv6.daddr[1] = bpf_ntohl(sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32[1]);
            key->ipv6.daddr[2] = bpf_ntohl(sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32[2]);
            key->ipv6.daddr[3] = bpf_ntohl(sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32[3]);
            //
            key->ipv6.saddr[0] = bpf_ntohl(sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32[0]);
            key->ipv6.saddr[1] = bpf_ntohl(sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32[1]);
            key->ipv6.saddr[2] = bpf_ntohl(sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32[2]);
            key->ipv6.saddr[3] = bpf_ntohl(sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32[3]);

            u16 dport = sk->__sk_common.skc_dport;
            key->sport = bpf_ntohs(dport);
            u16 sport = sk->__sk_common.skc_num;
            key->dport = bpf_ntohs(sport);

            // protocol
            u16 protocol = 0;
            int gso_max_segs_offset = offsetof(struct sock, sk_gso_max_segs);
            int sk_lingertime_offset = offsetof(struct sock, sk_lingertime);
            if (sk_lingertime_offset - gso_max_segs_offset == 2)
                protocol = sk->sk_protocol;
            else if (sk_lingertime_offset - gso_max_segs_offset == 4)
                // 4.10+ with little endian
                #if __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
                          protocol = *(u8 *)((u64)&sk->sk_gso_max_segs - 3);
                       else
                           // pre-4.10 with little endian
                          protocol = *(u8 *)((u64)&sk->sk_wmem_queued - 3);
                #elif __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
                          // 4.10+ with big endian
                          protocol = *(u8 *)((u64)&sk->sk_gso_max_segs - 1);
                       else
                          // pre-4.10 with big endian
                          protocol = *(u8 *)((u64)&sk->sk_wmem_queued - 1);
                #else
                # error "Fix your compiler's __BYTE_ORDER__?!"
                #endif

            key->protocol = protocol;
       }    
    }

    static inline int match_five_tuple_sock(struct socket *sock){  
        struct sock *sk = sock->sk;
        u16 family = 0;
        bpf_probe_read(&family, sizeof(family), &sk->__sk_common.skc_family);

        if (family == AF_INET) {
            u32 saddr = sk->__sk_common.skc_rcv_saddr;
            saddr = bpf_ntohl(saddr);
            u32 daddr = sk->__sk_common.skc_daddr;
            daddr = bpf_ntohl(daddr);
            u16 dport = sk->__sk_common.skc_dport;
            dport = bpf_ntohs(dport);
            u16 sport = sk->__sk_common.skc_num;
            sport = bpf_ntohs(sport);

            // protocol
            u16 protocol = 0;
            int gso_max_segs_offset = offsetof(struct sock, sk_gso_max_segs);
            int sk_lingertime_offset = offsetof(struct sock, sk_lingertime);
            if (sk_lingertime_offset - gso_max_segs_offset == 2)
               protocol = sk->sk_protocol;
            else if (sk_lingertime_offset - gso_max_segs_offset == 4)
               // 4.10+ with little endian
                #if __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
                          protocol = *(u8 *)((u64)&sk->sk_gso_max_segs - 3);
                       else
                           // pre-4.10 with little endian
                          protocol = *(u8 *)((u64)&sk->sk_wmem_queued - 3);
                #elif __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
                          // 4.10+ with big endian
                          protocol = *(u8 *)((u64)&sk->sk_gso_max_segs - 1);
                       else
                          // pre-4.10 with big endian
                          protocol = *(u8 *)((u64)&sk->sk_wmem_queued - 1);
                #else
                # error "Fix your compiler's __BYTE_ORDER__?!"
                #endif

            int key = 0;
            struct five_tuple_ipv4 *filter = five_tuple_filter_ipv4.lookup(&key);
            if(!filter){
                return 0;  
            }   

            // Check protocol, source IP and Destination IP
            if ( (protocol != filter->protocol) || 
                 (saddr != filter->saddr) || 
                 (daddr != filter->daddr) ){       

                return 0;
            }

            // For TCP/UDP, check ports
            if(  sport != (filter->sport)  ||    
                 dport != bpf_ntohs(filter->dport)   ){
                 return 0;
            }

            return 1;
        } 
        else if (family == AF_INET6) {
            u32 saddr[4];
            saddr[0] = bpf_ntohl(sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32[0]);
            saddr[1] = bpf_ntohl(sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32[1]);
            saddr[2] = bpf_ntohl(sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32[2]);
            saddr[3] = bpf_ntohl(sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32[3]);

            u32 daddr[4];
            daddr[0] = bpf_ntohl(sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32[0]);
            daddr[1] = bpf_ntohl(sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32[1]);
            daddr[2] = bpf_ntohl(sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32[2]);
            daddr[3] = bpf_ntohl(sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32[3]);

            u16 dport = sk->__sk_common.skc_dport;
            dport = bpf_ntohs(dport);
            u16 sport = sk->__sk_common.skc_num;
            sport = bpf_ntohs(sport);

            // protocol
            u16 protocol = 0;
            int gso_max_segs_offset = offsetof(struct sock, sk_gso_max_segs);
            int sk_lingertime_offset = offsetof(struct sock, sk_lingertime);
            if (sk_lingertime_offset - gso_max_segs_offset == 2)
                protocol = sk->sk_protocol;
            else if (sk_lingertime_offset - gso_max_segs_offset == 4)
                // 4.10+ with little endian
                #if __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
                          protocol = *(u8 *)((u64)&sk->sk_gso_max_segs - 3);
                       else
                           // pre-4.10 with little endian
                          protocol = *(u8 *)((u64)&sk->sk_wmem_queued - 3);
                #elif __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
                          // 4.10+ with big endian
                          protocol = *(u8 *)((u64)&sk->sk_gso_max_segs - 1);
                       else
                          // pre-4.10 with big endian
                          protocol = *(u8 *)((u64)&sk->sk_wmem_queued - 1);
                #else
                # error "Fix your compiler's __BYTE_ORDER__?!"
                #endif

            // 匹配
            int key = 0;
            struct five_tuple_ipv6 *filter = five_tuple_filter_ipv6.lookup(&key);
            if(!filter){
                return 0;   // 若无五元组，则不输出
            }   

            // Check protocol, source IP and Destination IP
            if ( protocol != filter->protocol) return 0;
            if (  
                saddr[0] != filter->saddr[0] || 
                saddr[1] != filter->saddr[1] || 
                saddr[2] != filter->saddr[2] || 
                saddr[3] != filter->saddr[3] ||
                daddr[0] != filter->daddr[0] || 
                daddr[1] != filter->daddr[1] || 
                daddr[2] != filter->daddr[2] || 
                daddr[3] != filter->daddr[3] ){     
                return 0;
            }

            // For TCP/UDP, check ports
            if(  sport != (filter->sport)  ||    
                 dport != bpf_ntohs(filter->dport)   ){
                return 0;
            }

            return 1;
       }
       return 0;
    }


    // output
    TRACEPOINT_PROBE( net, net_dev_start_xmit ){ 
        u8 direction = 0;
        struct sk_buff *skb = (struct sk_buff*)args->skbaddr;

        if( !match_five_tuple(skb) ){
            return 0;
        }

        struct key_t key = {};
        extract_key(&key, skb, direction);  

        // networklink:
        struct info_t *infop = start.lookup(&key); 
        if (infop == 0) {
            return 0;   
        }
        u64 ts = infop->ts;
        u64 now = bpf_ktime_get_ns();
        u64 delta_us = (now - ts) / 1000ul;

        u16 protocol;
        bpf_probe_read_kernel(&protocol, sizeof(protocol), (void *)&skb->protocol);
        if ( bpf_htons(protocol) == ETH_P_IP ) {   
            struct ipv4_data_t data4 = {.pid = infop->pid};
            data4.ts_us = now / 1000;
            data4.delta_us = delta_us;
            data4.saddr = key.ipv4.saddr;
            data4.daddr = key.ipv4.daddr;
            data4.lport = key.sport;
            data4.dport = key.dport;
            __builtin_memcpy(&data4.task, infop->task, sizeof(data4.task));
            ipv4_events_tx.perf_submit((void *)args, &data4, sizeof(data4));

        } else /* AF_INET6 */ {
            struct ipv6_data_t data6 = {.pid = infop->pid };
            data6.ts_us = now / 1000;
            data6.delta_us = delta_us;
            data6.saddr = ((unsigned __int128)key.ipv6.saddr[0] << 96) |
            ((unsigned __int128)key.ipv6.saddr[1] << 64) |
            ((unsigned __int128)key.ipv6.saddr[2] << 32) |
            (unsigned __int128)key.ipv6.saddr[3];
            data6.daddr = ((unsigned __int128)key.ipv6.daddr[0] << 96) |
            ((unsigned __int128)key.ipv6.daddr[1] << 64) |
            ((unsigned __int128)key.ipv6.daddr[2] << 32) |
            (unsigned __int128)key.ipv6.daddr[3];
            data6.lport = key.sport;
            data6.dport = key.dport;
            __builtin_memcpy(&data6.task, infop->task, sizeof(data6.task));
            ipv6_events_tx.perf_submit((void *)args, &data6, sizeof(data6));
        }
        start.delete(&key); 

        // translink:
        struct info_t_translink *infop_translink = start_translink.lookup(&key); 
        if (infop_translink == 0) {
            return 0;   
        }
        u64 ts_translink = infop_translink->ts_translink;
        u64 now_translink = bpf_ktime_get_ns();
        u64 delta_us_translink = (now_translink - ts_translink) / 1000ul;

        if ( bpf_htons(protocol) == ETH_P_IP ) {   
            struct ipv4_data_t_linktrans data4_linktrans = {.pid = infop_translink->pid_translink};
            data4_linktrans.ts_us = now_translink / 1000;
            data4_linktrans.delta_us = delta_us_translink;
            data4_linktrans.saddr = key.ipv4.saddr;
            data4_linktrans.daddr = key.ipv4.daddr;
            data4_linktrans.lport = key.sport;
            data4_linktrans.dport = key.dport;
            __builtin_memcpy(&data4_linktrans.task, infop_translink->task_translink, sizeof(data4_linktrans.task));
            ipv4_events_tx_linktrans.perf_submit((void *)args, &data4_linktrans, sizeof(data4_linktrans));

        } else /* AF_INET6 */ {
            struct ipv6_data_t_linktrans data6_linktrans = {.pid = infop_translink->pid_translink };
            data6_linktrans.ts_us = now_translink / 1000;
            data6_linktrans.delta_us = delta_us_translink;
            data6_linktrans.saddr = ((unsigned __int128)key.ipv6.saddr[0] << 96) |
            ((unsigned __int128)key.ipv6.saddr[1] << 64) |
            ((unsigned __int128)key.ipv6.saddr[2] << 32) |
            (unsigned __int128)key.ipv6.saddr[3];
            data6_linktrans.daddr = ((unsigned __int128)key.ipv6.daddr[0] << 96) |
            ((unsigned __int128)key.ipv6.daddr[1] << 64) |
            ((unsigned __int128)key.ipv6.daddr[2] << 32) |
            (unsigned __int128)key.ipv6.daddr[3];
            data6_linktrans.lport = key.sport;
            data6_linktrans.dport = key.dport;
            __builtin_memcpy(&data6_linktrans.task, infop_translink->task_translink, sizeof(data6_linktrans.task));
            ipv6_events_tx_linktrans.perf_submit((void *)args, &data6_linktrans, sizeof(data6_linktrans));
        }
        start_translink.delete(&key);

        // link output
        u32 pid = bpf_get_current_pid_tgid() >> 32;
        if ( bpf_htons(protocol) == ETH_P_IP ) {   
            struct ipv4_data_t_linknum data4_linknum = {.pid = pid};
            data4_linknum.ts_us = bpf_ktime_get_ns() / 1000;
            data4_linknum.saddr = key.ipv4.saddr;
            data4_linknum.daddr = key.ipv4.daddr;
            data4_linknum.lport = key.sport;
            data4_linknum.dport = key.dport;
            ipv4_events_tx_linknum.perf_submit((void *)args, &data4_linknum, sizeof(data4_linknum));

        } else /* AF_INET6 */ {
            struct ipv6_data_t_linknum data6_linknum = {.pid = pid };
            data6_linknum.ts_us = bpf_ktime_get_ns() / 1000;
            data6_linknum.saddr = ((unsigned __int128)key.ipv6.saddr[0] << 96) |
            ((unsigned __int128)key.ipv6.saddr[1] << 64) |
            ((unsigned __int128)key.ipv6.saddr[2] << 32) |
            (unsigned __int128)key.ipv6.saddr[3];
            data6_linknum.daddr = ((unsigned __int128)key.ipv6.daddr[0] << 96) |
            ((unsigned __int128)key.ipv6.daddr[1] << 64) |
            ((unsigned __int128)key.ipv6.daddr[2] << 32) |
            (unsigned __int128)key.ipv6.daddr[3];
            data6_linknum.lport = key.sport;
            data6_linknum.dport = key.dport;
            ipv6_events_tx_linknum.perf_submit((void *)args, &data6_linknum, sizeof(data6_linknum));
        }

        return 0;
    }

    static int __trace_ip_output(struct pt_regs *ctx, struct net *net, struct sock *sk, struct sk_buff *skb){
        u8 direction = 0;
        if( !match_five_tuple(skb) ){
            return 0;
        }

        u32 pid = bpf_get_current_pid_tgid() >> 32;
        struct info_t info = {.pid = pid};
        info.ts = bpf_ktime_get_ns();
        bpf_get_current_comm(&info.task, sizeof(info.task));

        struct key_t key = {};
        extract_key(&key, skb, direction);
        start.update(&key, &info);

        // transnetwork:
        struct info_t_transnetwork *infop_transnetwork = start_transnetwork.lookup(&key); 
        if (infop_transnetwork == 0) {
            return 0;   
        }
        u64 ts_transnetwork = infop_transnetwork->ts_transnetwork;
        u64 now_transnetwork = bpf_ktime_get_ns();
        u64 delta_us_transnetwork = (now_transnetwork - ts_transnetwork) / 1000ul;

        u16 protocol;
        bpf_probe_read_kernel(&protocol, sizeof(protocol), (void *)&skb->protocol);

        if ( bpf_htons(protocol) == ETH_P_IP ) {   
            struct ipv4_data_t_networktrans data4_networktrans = {.pid = infop_transnetwork->pid_transnetwork};
            data4_networktrans.ts_us = now_transnetwork / 1000;
            data4_networktrans.delta_us = delta_us_transnetwork;
            data4_networktrans.saddr = key.ipv4.saddr;
            data4_networktrans.daddr = key.ipv4.daddr;
            data4_networktrans.lport = key.sport;
            data4_networktrans.dport = key.dport;
            __builtin_memcpy(&data4_networktrans.task, infop_transnetwork->task_transnetwork, sizeof(data4_networktrans.task));
            ipv4_events_tx_networktrans.perf_submit(ctx, &data4_networktrans, sizeof(data4_networktrans));

        } else /* AF_INET6 */ {
            struct ipv6_data_t_networktrans data6_networktrans = {.pid = infop_transnetwork->pid_transnetwork };
            data6_networktrans.ts_us = now_transnetwork / 1000;
            data6_networktrans.delta_us = delta_us_transnetwork;
            data6_networktrans.saddr = ((unsigned __int128)key.ipv6.saddr[0] << 96) |
            ((unsigned __int128)key.ipv6.saddr[1] << 64) |
            ((unsigned __int128)key.ipv6.saddr[2] << 32) |
            (unsigned __int128)key.ipv6.saddr[3];
            data6_networktrans.daddr = ((unsigned __int128)key.ipv6.daddr[0] << 96) |
            ((unsigned __int128)key.ipv6.daddr[1] << 64) |
            ((unsigned __int128)key.ipv6.daddr[2] << 32) |
            (unsigned __int128)key.ipv6.daddr[3];
            data6_networktrans.lport = key.sport;
            data6_networktrans.dport = key.dport;
            __builtin_memcpy(&data6_networktrans.task, infop_transnetwork->task_transnetwork, sizeof(data6_networktrans.task));
            ipv6_events_tx_networktrans.perf_submit(ctx, &data6_networktrans, sizeof(data6_networktrans));
        }
        start_transnetwork.delete(&key);

        // network output
        if ( bpf_htons(protocol) == ETH_P_IP ) {   
            struct ipv4_data_t_networknum data4_networknum = {.pid = pid};
            data4_networknum.ts_us = bpf_ktime_get_ns() / 1000;
            data4_networknum.saddr = key.ipv4.saddr;
            data4_networknum.daddr = key.ipv4.daddr;
            data4_networknum.lport = key.sport;
            data4_networknum.dport = key.dport;
            ipv4_events_tx_networknum.perf_submit(ctx, &data4_networknum, sizeof(data4_networknum));

        } else /* AF_INET6 */ {
            struct ipv6_data_t_networknum data6_networknum = {.pid = pid };
            data6_networknum.ts_us = now_transnetwork / 1000;
            data6_networknum.saddr = ((unsigned __int128)key.ipv6.saddr[0] << 96) |
            ((unsigned __int128)key.ipv6.saddr[1] << 64) |
            ((unsigned __int128)key.ipv6.saddr[2] << 32) |
            (unsigned __int128)key.ipv6.saddr[3];
            data6_networknum.daddr = ((unsigned __int128)key.ipv6.daddr[0] << 96) |
            ((unsigned __int128)key.ipv6.daddr[1] << 64) |
            ((unsigned __int128)key.ipv6.daddr[2] << 32) |
            (unsigned __int128)key.ipv6.daddr[3];
            data6_networknum.lport = key.sport;
            data6_networknum.dport = key.dport;
            ipv6_events_tx_networknum.perf_submit(ctx, &data6_networknum, sizeof(data6_networknum));
        }

        return 0;
    }

    int trace_ip_output(struct pt_regs *ctx, struct net *net, struct sock *sk, struct sk_buff *skb){
        return __trace_ip_output(ctx, net, sk, skb);
    }

    // output
    static int __trace_trans_output(struct pt_regs *ctx, struct socket *sock, struct msghdr *msg){ 

        if( !match_five_tuple_sock(sock) ){    
            return 0;
        }
        u8 direction = 0;

        u32 pid = bpf_get_current_pid_tgid() >> 32;
        struct info_t_translink info = {.pid_translink = pid};
        info.ts_translink = bpf_ktime_get_ns();
        bpf_get_current_comm(&info.task_translink, sizeof(info.task_translink));

        struct key_t key = {};
        extract_key_sock(&key, sock, direction);
        start_translink.update(&key, &info);

        // link-trans
        struct info_t_transnetwork info_transnetwork = {.pid_transnetwork = pid};
        info_transnetwork.ts_transnetwork = bpf_ktime_get_ns();
        bpf_get_current_comm(&info_transnetwork.task_transnetwork, sizeof(info_transnetwork.task_transnetwork));
        start_transnetwork.update(&key, &info_transnetwork);

        // trans output num:
        struct sock *sk = sock->sk;
        u16 family = 0;
        bpf_probe_read(&family, sizeof(family), &sk->__sk_common.skc_family);
        if ( family == AF_INET ) {   
            struct ipv4_data_t_transnum data4_transnum = { };
            data4_transnum.pid = pid;
            data4_transnum.ts_us = bpf_ktime_get_ns() / 1000;
            data4_transnum.lport = key.sport;
            data4_transnum.dport = key.dport;
            data4_transnum.saddr = key.ipv4.saddr;
            data4_transnum.daddr = key.ipv4.daddr; 

            ipv4_events_tx_transnum.perf_submit(ctx, &data4_transnum, sizeof(data4_transnum));
        } 
        else {
            struct ipv6_data_t_transnum data6_transnum = { };
            data6_transnum.pid = pid; 
            data6_transnum.ts_us = bpf_ktime_get_ns() / 1000;
            data6_transnum.saddr = ((unsigned __int128)key.ipv6.saddr[0] << 96) |
                          ((unsigned __int128)key.ipv6.saddr[1] << 64) |
                          ((unsigned __int128)key.ipv6.saddr[2] << 32) |
                          (unsigned __int128)key.ipv6.saddr[3];
            data6_transnum.daddr = ((unsigned __int128)key.ipv6.daddr[0] << 96) |
                          ((unsigned __int128)key.ipv6.daddr[1] << 64) |
                          ((unsigned __int128)key.ipv6.daddr[2] << 32) |
                          (unsigned __int128)key.ipv6.daddr[3];
            data6_transnum.lport = key.sport;
            data6_transnum.dport = key.dport;

            ipv6_events_tx_transnum.perf_submit(ctx, &data6_transnum, sizeof(data6_transnum));
        }

        return 0;
    }

    int trace_trans_output(struct pt_regs *ctx, struct socket *sock, struct msghdr *msg){
        return __trace_trans_output(ctx, sock, msg);
    } 

    // input 
    TRACEPOINT_PROBE(net, netif_receive_skb){
        struct sk_buff *skb = (struct sk_buff*)args->skbaddr;
        u8 direction = 1;
        if( !match_five_tuple_rx(skb) ){
            return 0;
        }

        u32 pid = bpf_get_current_pid_tgid() >> 32;
        struct info_t info = {.pid = pid};
        info.ts = bpf_ktime_get_ns();
        bpf_get_current_comm(&info.task, sizeof(info.task));

        struct key_t key = {};
        extract_key(&key, skb, direction);
        start.update(&key, &info);

        // link-trans
        struct info_t_translink info_translink = {.pid_translink = pid};
        info_translink.ts_translink = bpf_ktime_get_ns();
        bpf_get_current_comm(&info_translink.task_translink, sizeof(info_translink.task_translink));
        start_translink.update(&key, &info_translink);

        // link input 
        u16 protocol;
        bpf_probe_read_kernel(&protocol, sizeof(protocol), (void *)&skb->protocol);

        if ( bpf_htons(protocol) == ETH_P_IP ) {   
            struct ipv4_data_r_linknum data4_linknum = {.pid = pid };
            data4_linknum.ts_us = bpf_ktime_get_ns() / 1000;
            data4_linknum.saddr = key.ipv4.saddr;
            data4_linknum.daddr = key.ipv4.daddr;
            data4_linknum.lport = key.sport;
            data4_linknum.dport = key.dport;
            ipv4_events_rx_linknum.perf_submit( (void *)args, &data4_linknum, sizeof(data4_linknum) );

        } else /* AF_INET6 */ {
            struct ipv6_data_r_linknum data6_linknum = {.pid = pid };
            data6_linknum.ts_us = bpf_ktime_get_ns()  / 1000;
            data6_linknum.saddr = ((unsigned __int128)key.ipv6.saddr[0] << 96) |
            ((unsigned __int128)key.ipv6.saddr[1] << 64) |
            ((unsigned __int128)key.ipv6.saddr[2] << 32) |
            (unsigned __int128)key.ipv6.saddr[3];
            data6_linknum.daddr = ((unsigned __int128)key.ipv6.daddr[0] << 96) |
            ((unsigned __int128)key.ipv6.daddr[1] << 64) |
            ((unsigned __int128)key.ipv6.daddr[2] << 32) |
            (unsigned __int128)key.ipv6.daddr[3];
            data6_linknum.lport = key.sport;
            data6_linknum.dport = key.dport;
            ipv6_events_rx_linknum.perf_submit( (void *)args, &data6_linknum, sizeof(data6_linknum) );
        }        

        return 0;
    }

    static int __trace_ip_rcv(struct pt_regs *ctx, struct sk_buff *skb){

        u8 direction = 1;
        if( !match_five_tuple_rx(skb) ){
            return 0;
        }

        struct key_t key = {};
        extract_key(&key, skb, direction);  

        // transnetwork
        u32 pid_transnetwork = bpf_get_current_pid_tgid() >> 32;
        struct info_t_transnetwork info_transnetwork = {.pid_transnetwork = pid_transnetwork};
        info_transnetwork.ts_transnetwork = bpf_ktime_get_ns();
        bpf_get_current_comm(&info_transnetwork.task_transnetwork, sizeof(info_transnetwork.task_transnetwork));
        start_transnetwork.update(&key, &info_transnetwork);

        //
        struct info_t *infop = start.lookup(&key); 
        if (infop == 0) {
            return 0;   
        }
        u64 ts = infop->ts;
        u64 now = bpf_ktime_get_ns();
        u64 delta_us = (now - ts) / 1000ul;

        u16 protocol;
        bpf_probe_read_kernel(&protocol, sizeof(protocol), (void *)&skb->protocol);
        if ( bpf_htons(protocol) == ETH_P_IP ) {   
            struct ipv4_data_t data4 = {.pid = infop->pid};
            data4.ts_us = now / 1000;
            data4.delta_us = delta_us;
            data4.saddr = key.ipv4.saddr;
            data4.daddr = key.ipv4.daddr;
            data4.lport = key.sport;
            data4.dport = key.dport;
            __builtin_memcpy(&data4.task, infop->task, sizeof(data4.task));
            ipv4_events_rx.perf_submit( ctx, &data4, sizeof(data4) );

        } else /* AF_INET6 */ {
            struct ipv6_data_t data6 = {.pid = infop->pid };
            data6.ts_us = now / 1000;
            data6.delta_us = delta_us;
            data6.saddr = ((unsigned __int128)key.ipv6.saddr[0] << 96) |
            ((unsigned __int128)key.ipv6.saddr[1] << 64) |
            ((unsigned __int128)key.ipv6.saddr[2] << 32) |
            (unsigned __int128)key.ipv6.saddr[3];
            data6.daddr = ((unsigned __int128)key.ipv6.daddr[0] << 96) |
            ((unsigned __int128)key.ipv6.daddr[1] << 64) |
            ((unsigned __int128)key.ipv6.daddr[2] << 32) |
            (unsigned __int128)key.ipv6.daddr[3];
            data6.lport = key.sport;
            data6.dport = key.dport;
            __builtin_memcpy(&data6.task, infop->task, sizeof(data6.task));
            ipv6_events_rx.perf_submit( ctx, &data6, sizeof(data6) );
        }
        start.delete(&key); 

        // network input 
        if ( bpf_htons(protocol) == ETH_P_IP ) {   
            struct ipv4_data_r_networknum data4_networknum = {.pid = pid_transnetwork };
            data4_networknum.ts_us = bpf_ktime_get_ns() / 1000;
            data4_networknum.saddr = key.ipv4.saddr;
            data4_networknum.daddr = key.ipv4.daddr;
            data4_networknum.lport = key.sport;
            data4_networknum.dport = key.dport;
            ipv4_events_rx_networknum.perf_submit( ctx, &data4_networknum, sizeof(data4_networknum) );

        } else /* AF_INET6 */ {
            struct ipv6_data_r_networknum data6_networknum = {.pid = pid_transnetwork };
            data6_networknum.ts_us = bpf_ktime_get_ns()  / 1000;
            data6_networknum.saddr = ((unsigned __int128)key.ipv6.saddr[0] << 96) |
            ((unsigned __int128)key.ipv6.saddr[1] << 64) |
            ((unsigned __int128)key.ipv6.saddr[2] << 32) |
            (unsigned __int128)key.ipv6.saddr[3];
            data6_networknum.daddr = ((unsigned __int128)key.ipv6.daddr[0] << 96) |
            ((unsigned __int128)key.ipv6.daddr[1] << 64) |
            ((unsigned __int128)key.ipv6.daddr[2] << 32) |
            (unsigned __int128)key.ipv6.daddr[3];
            data6_networknum.lport = key.sport;
            data6_networknum.dport = key.dport;
            ipv6_events_rx_networknum.perf_submit( ctx, &data6_networknum, sizeof(data6_networknum) );
        }

        return 0;
    }

    int trace_ip_rcv(struct pt_regs *ctx, struct sk_buff *skb){ 
       return __trace_ip_rcv(ctx,skb);
    }

    // 2、trans_rcv:
    static int __trace_trans_rcv(struct pt_regs *ctx, struct socket *sock, struct msghdr *msg){
        u8 direction = 1;
        if( !match_five_tuple_sock(sock)  ){     
            return 0;
        }
        struct key_t key = {};
        extract_key_sock_rx(&key, sock, direction);     
        struct info_t_translink *infop = start_translink.lookup(&key); 
        if (infop == 0) {
            return 0;   
        }
        u64 ts = infop->ts_translink;
        u64 now = bpf_ktime_get_ns();
        u64 delta_us = (now - ts) / 1000ul;

        struct sock *sk = sock->sk;
        u16 family = 0;
        bpf_probe_read(&family, sizeof(family), &sk->__sk_common.skc_family);
        if ( family == AF_INET ) {   
            struct ipv4_data_t_linktrans data4 = {.pid = infop->pid_translink};
            data4.ts_us = now / 1000;
            data4.delta_us = delta_us;
            data4.saddr = key.ipv4.saddr;
            data4.daddr = key.ipv4.daddr;
            data4.lport = key.sport;
            data4.dport = key.dport;
            __builtin_memcpy(&data4.task, infop->task_translink, sizeof(data4.task));
            ipv4_events_rx_linktrans.perf_submit( ctx, &data4, sizeof(data4) );

        } else /* AF_INET6 */ {
            struct ipv6_data_t_linktrans data6 = {.pid = infop->pid_translink };
            data6.ts_us = now / 1000;
            data6.delta_us = delta_us;
            data6.saddr = ((unsigned __int128)key.ipv6.saddr[0] << 96) |
                          ((unsigned __int128)key.ipv6.saddr[1] << 64) |
                          ((unsigned __int128)key.ipv6.saddr[2] << 32) |
                          (unsigned __int128)key.ipv6.saddr[3];
            data6.daddr = ((unsigned __int128)key.ipv6.daddr[0] << 96) |
                          ((unsigned __int128)key.ipv6.daddr[1] << 64) |
                          ((unsigned __int128)key.ipv6.daddr[2] << 32) |
                          (unsigned __int128)key.ipv6.daddr[3];
            data6.lport = key.sport;
            data6.dport = key.dport;
            __builtin_memcpy(&data6.task, infop->task_translink, sizeof(data6.task));
            ipv6_events_rx_linktrans.perf_submit( ctx, &data6, sizeof(data6) );
        }
        start_translink.delete(&key);  

        // transnetwork: 
        struct info_t_transnetwork *infop_transnetwork = start_transnetwork.lookup(&key); 
        if (infop_transnetwork == 0) {
            return 0;   
        }
        u64 ts_transnetwork = infop_transnetwork->ts_transnetwork;
        u64 now_transnetwork = bpf_ktime_get_ns();
        u64 delta_us_transnetwork = (now_transnetwork - ts_transnetwork) / 1000ul;

        if ( family == AF_INET ) {  
            struct ipv4_data_t_networktrans data4_networktrans = {.pid = infop_transnetwork->pid_transnetwork};
            data4_networktrans.ts_us = now_transnetwork / 1000;
            data4_networktrans.delta_us = delta_us_transnetwork;
            data4_networktrans.saddr = key.ipv4.saddr;
            data4_networktrans.daddr = key.ipv4.daddr;
            data4_networktrans.lport = key.sport;
            data4_networktrans.dport = key.dport;
            __builtin_memcpy(&data4_networktrans.task, infop_transnetwork->task_transnetwork, sizeof(data4_networktrans.task));
            ipv4_events_rx_networktrans.perf_submit(ctx, &data4_networktrans, sizeof(data4_networktrans));

        } else /* AF_INET6 */ {
            struct ipv6_data_t_networktrans data6_networktrans = {.pid = infop_transnetwork->pid_transnetwork };
            data6_networktrans.ts_us = now_transnetwork / 1000;
            data6_networktrans.delta_us = delta_us_transnetwork;
            data6_networktrans.saddr = ((unsigned __int128)key.ipv6.saddr[0] << 96) |
            ((unsigned __int128)key.ipv6.saddr[1] << 64) |
            ((unsigned __int128)key.ipv6.saddr[2] << 32) |
            (unsigned __int128)key.ipv6.saddr[3];
            data6_networktrans.daddr = ((unsigned __int128)key.ipv6.daddr[0] << 96) |
            ((unsigned __int128)key.ipv6.daddr[1] << 64) |
            ((unsigned __int128)key.ipv6.daddr[2] << 32) |
            (unsigned __int128)key.ipv6.daddr[3];
            data6_networktrans.lport = key.sport;
            data6_networktrans.dport = key.dport;
            __builtin_memcpy(&data6_networktrans.task, infop_transnetwork->task_transnetwork, sizeof(data6_networktrans.task));
            ipv6_events_rx_networktrans.perf_submit(ctx, &data6_networktrans, sizeof(data6_networktrans));
        }
        start_transnetwork.delete(&key);

        // trans input num:
        u32 pid = bpf_get_current_pid_tgid() >> 32;
        if ( family == AF_INET ) {   
            struct ipv4_data_r_transnum data4_transnum = { };
            data4_transnum.pid = pid;
            data4_transnum.ts_us = bpf_ktime_get_ns() / 1000;
            data4_transnum.lport = key.sport;
            data4_transnum.dport = key.dport;
            data4_transnum.saddr = key.ipv4.saddr;
            data4_transnum.daddr = key.ipv4.daddr; 

            ipv4_events_rx_transnum.perf_submit(ctx, &data4_transnum, sizeof(data4_transnum));
        } 
        else {
            struct ipv6_data_r_transnum data6_transnum = { };
            data6_transnum.pid = pid; 
            data6_transnum.ts_us = bpf_ktime_get_ns() / 1000;
            data6_transnum.saddr = ((unsigned __int128)key.ipv6.saddr[0] << 96) |
                          ((unsigned __int128)key.ipv6.saddr[1] << 64) |
                          ((unsigned __int128)key.ipv6.saddr[2] << 32) |
                          (unsigned __int128)key.ipv6.saddr[3];
            data6_transnum.daddr = ((unsigned __int128)key.ipv6.daddr[0] << 96) |
                          ((unsigned __int128)key.ipv6.daddr[1] << 64) |
                          ((unsigned __int128)key.ipv6.daddr[2] << 32) |
                          (unsigned __int128)key.ipv6.daddr[3];
            data6_transnum.lport = key.sport;
            data6_transnum.dport = key.dport; 

            ipv6_events_rx_transnum.perf_submit(ctx, &data6_transnum, sizeof(data6_transnum));
        }

        return 0;
    }

    int trace_trans_rcv(struct pt_regs *ctx, struct socket *sock, struct msghdr *msg){  

       return __trace_trans_rcv(ctx, sock, msg);
    }

    // 1、tcp drop:
    static int __trace_tcp_drop(void *ctx, struct sock *sk, struct sk_buff *skb, u32 reason)
    {
        if( !match_five_tuple_rx(skb) ){
            return 0;
        } 
        u32 pid = bpf_get_current_pid_tgid() >> 32;
        u64 now = bpf_ktime_get_ns();
        u16 protocol;
        bpf_probe_read_kernel(&protocol, sizeof(protocol), (void *)&skb->protocol);
        protocol = bpf_htons(protocol);

        if ( protocol == ETH_P_IP ) {   
            struct ipv4_data_t_drop data4 = { };
            data4.pid = pid;
            data4.ts_us = now / 1000;

            // Read IP header
            struct iphdr *iph = skb_to_iphdr(skb);
            data4.saddr = bpf_ntohl(iph->saddr);
            data4.daddr = bpf_ntohl(iph->daddr); 

            // For TCP/UDP, ports
            if ( iph->protocol == IPPROTO_TCP ){   
                struct tcphdr *tcph = skb_to_tcphdr(skb);            
                data4.lport = bpf_ntohs(tcph->source);
                data4.dport = bpf_ntohs(tcph->dest);
            }
            else if ( iph->protocol == IPPROTO_UDP ){          
                struct udphdr *udph = skb_to_udphdr(skb);
                data4.lport = bpf_ntohs(udph->source);
                data4.dport = bpf_ntohs(udph->dest);
            }
            else {          
                data4.lport = 0;
                data4.dport = 0;
            }
            ipv4_events.perf_submit(ctx, &data4, sizeof(data4));
        } 
        else if (protocol == ETH_P_IPV6) {
            struct ipv6_data_t_drop data6 = { };
            data6.pid = pid; 
            data6.ts_us = now / 1000;

            // Read IP header
            struct ipv6hdr *ipv6h = skb_to_ipv6hdr(skb);
            data6.saddr = ( (unsigned __int128)( bpf_ntohl(ipv6h->saddr.in6_u.u6_addr32[0]) ) << 96 ) |
                          ( (unsigned __int128)( bpf_ntohl(ipv6h->saddr.in6_u.u6_addr32[1]) ) << 64 ) |
                          ( (unsigned __int128)( bpf_ntohl(ipv6h->saddr.in6_u.u6_addr32[2]) ) << 32 ) |
                          ( (unsigned __int128)( bpf_ntohl(ipv6h->saddr.in6_u.u6_addr32[3]) ) );

            data6.daddr = ( (unsigned __int128)( bpf_ntohl(ipv6h->daddr.in6_u.u6_addr32[0]) ) << 96 ) |
                          ( (unsigned __int128)( bpf_ntohl(ipv6h->daddr.in6_u.u6_addr32[1]) ) << 64 ) | 
                          ( (unsigned __int128)( bpf_ntohl(ipv6h->daddr.in6_u.u6_addr32[2]) ) << 32 ) |
                          ( (unsigned __int128)( bpf_ntohl(ipv6h->daddr.in6_u.u6_addr32[3]) ) );

            // For TCP/UDP, ports
            if ( ipv6h->nexthdr == IPPROTO_TCP ){                
                struct tcphdr *tcph = skb_to_tcphdr(skb);
                data6.lport = bpf_ntohs(tcph->source);
                data6.dport = bpf_ntohs(tcph->dest);
            }
            else if ( ipv6h->nexthdr == IPPROTO_UDP ){         
                struct udphdr *udph = skb_to_udphdr(skb);
                data6.lport = bpf_ntohs(udph->source);
                data6.dport = bpf_ntohs(udph->dest);
            }
            else {           
                data6.lport = 0;
                data6.dport = 0;
            }
            ipv6_events.perf_submit(ctx, &data6, sizeof(data6));
        }
        return 0;
    }

    int trace_tcp_drop(struct pt_regs *ctx, struct sock *sk, struct sk_buff *skb)
    {
        return __trace_tcp_drop(ctx, sk, skb, SKB_DROP_REASON_NOT_SPECIFIED);
    }
    """


def create_kfree_skb_text():
    return """
    TRACEPOINT_PROBE(skb, kfree_skb) {
        struct sk_buff *skb = args->skbaddr;
        struct sock *sk = skb->sk;
        enum skb_drop_reason reason = args->reason;

        if (reason > SKB_DROP_REASON_NOT_SPECIFIED) {
            return __trace_tcp_drop(args, sk, skb, (u32)reason);
        }
        return 0;
    }
    """


def enter(ipv4_flag, ipv6_flag, sip, dip, sport, dport, protocol):
    print('enter enter_linknetwork')
    if not ipv4_flag and not ipv6_flag:
        yield json.dumps({'error': 'At least one of IPv4 or IPv6 must be enabled'}) + '\n'
        return

    for name, value in [('sip', sip), ('dip', dip), ('protocol', protocol)]:
        if not value:
            yield json.dumps({'error': f'Missing required parameter: {name}'}) + '\n'
            return

    try:
        sport = int(sport)
        dport = int(dport)
        if not (0 <= sport <= 65535) or not (0 <= dport <= 65535):
            raise ValueError("Port out of range")
    except ValueError:
        yield json.dumps({'error': 'Invalid port number (must be 0-65535)'}) + '\n'
        return

    protocol = protocol.lower()
    if protocol not in ['tcp', 'udp', 'icmp']:
        yield json.dumps({'error': "Invalid protocol (must be 'tcp', 'udp', or 'icmp')"}) + '\n'
        return

    # 准备BPF程序
    bpf_text = create_bpf_text()
    kfree_skb_traceable = False
    if BPF.tracepoint_exists("skb", "kfree_skb"):
        if BPF.kernel_struct_has_field("trace_event_raw_kfree_skb", "reason") == 1:
            bpf_text += create_kfree_skb_text()
            kfree_skb_traceable = True

    b = BPF(text=bpf_text)

    # 事件队列
    event_queue = queue.Queue()

    # linknetwork:
    cnt_ipv4_rx = 0
    start_time_ipv4_rx = 0
    end_time_ipv4_rx = 0

    cnt_ipv4_tx = 0
    start_time_ipv4_tx = 0
    end_time_ipv4_tx = 0

    cnt_ipv6_rx = 0
    start_time_ipv6_rx = 0
    end_time_ipv6_rx = 0

    cnt_ipv6_tx = 0
    start_time_ipv6_tx = 0
    end_time_ipv6_tx = 0

    def handle_ipv4_event_tx(cpu, data, size):
        nonlocal cnt_ipv4_tx, start_time_ipv4_tx, end_time_ipv4_tx
        nonlocal sip, dip, sport, dport 
        event = b["ipv4_events_tx"].event(data)
        interval = 0
        cnt_ipv4_tx += 1

        if cnt_ipv4_tx == 1:
            start_time_ipv4_tx = event.ts_us
        else:
            end_time_ipv4_tx = event.ts_us
        interval = (end_time_ipv4_tx - start_time_ipv4_tx) / 1000000;

        if interval > 1:
            frequency = float(cnt_ipv4_tx) / interval
            cnt_ipv4_tx = 0
            start_time_ipv4_tx = 0
            end_time_ipv4_tx = 0

            event_data = {
                'crosslayer': 'linknetwork',
                'direction': 'send',
                'type': 'ipv4',
                'pid': event.pid,
                'pid_name': event.task.decode('utf-8', 'replace'),
                'saddr': sip,
                'daddr': dip,
                'sport': sport,
                'dport': dport,

                'LAT(ms)': float(event.delta_us) / 1000,
                'frequency(s)': frequency
            }
            event_queue.put(event_data)

    def handle_ipv6_event_tx(cpu, data, size):
        nonlocal cnt_ipv6_tx, start_time_ipv6_tx, end_time_ipv6_tx
        nonlocal sip, dip, sport, dport 
        event = b["ipv6_events_tx"].event(data)

        interval = 0
        cnt_ipv6_tx += 1
        if cnt_ipv6_tx == 1:
            start_time_ipv6_tx = event.ts_us
        else:
            end_time_ipv6_tx = event.ts_us

        interval = (end_time_ipv6_tx - start_time_ipv6_tx) / 1000000;
        if interval > 1:
            frequency = float(cnt_ipv6_tx) / interval
            cnt_ipv6_tx = 0
            start_time_ipv6_tx = 0
            end_time_ipv6_tx = 0

            event_data = {
                'crosslayer': 'linknetwork',
                'direction': 'send',
                'type': 'ipv6',
                'pid': event.pid,
                'pid_name': event.task.decode('utf-8', 'replace'),
                'saddr': sip,
                'daddr': dip,
                'sport': sport,
                'dport': dport,

                'LAT(ms)': float(event.delta_us) / 1000,
                'frequency(s)': frequency
            }
            event_queue.put(event_data)

    def handle_ipv4_event_rx(cpu, data, size):
        nonlocal cnt_ipv4_rx, start_time_ipv4_rx, end_time_ipv4_rx
        nonlocal sip, dip, sport, dport 
        event = b["ipv4_events_rx"].event(data)
        interval = 0

        cnt_ipv4_rx += 1
        if cnt_ipv4_rx == 1:
            start_time_ipv4_rx = event.ts_us
        else:
            end_time_ipv4_rx = event.ts_us

        interval = (end_time_ipv4_rx - start_time_ipv4_rx) / 1000000;

        if interval > 1:
            frequency = float(cnt_ipv4_rx) / interval
            cnt_ipv4_rx = 0
            start_time_ipv4_rx = 0
            end_time_ipv4_rx = 0

            event_data = {
                'crosslayer': 'linknetwork',
                'direction': 'receive',
                'type': 'ipv4',
                'pid': event.pid,
                'pid_name': event.task.decode('utf-8', 'replace'),
                'saddr': dip,
                'daddr': sip,
                'sport': dport,
                'dport': sport,

                'LAT(ms)': float(event.delta_us) / 1000,
                'frequency(s)': frequency
            }
            event_queue.put(event_data)

    def handle_ipv6_event_rx(cpu, data, size):
        nonlocal cnt_ipv6_rx, start_time_ipv6_rx, end_time_ipv6_rx
        nonlocal sip, dip, sport, dport 
        event = b["ipv6_events_rx"].event(data)
        interval = 0
        cnt_ipv6_rx += 1
        if cnt_ipv6_rx == 1:
            start_time_ipv6_rx = event.ts_us
        else:
            end_time_ipv6_rx = event.ts_us

        interval = (end_time_ipv6_rx - start_time_ipv6_rx) / 1000000;
        if interval > 1:
            frequency = float(cnt_ipv6_rx) / interval
            cnt_ipv6_rx = 0
            start_time_ipv6_rx = 0
            end_time_ipv6_rx = 0

            event_data = {
                'crosslayer': 'linknetwork',
                'direction': 'receive',
                'type': 'ipv6',
                'pid': event.pid,
                'pid_name': event.task.decode('utf-8', 'replace'),
                'saddr': dip,
                'daddr': sip,
                'sport': dport,
                'dport': sport,

                'LAT(ms)': float(event.delta_us) / 1000,
                'frequency(s)': frequency
            }
            event_queue.put(event_data)

    # 1、 tcp drop：
    # 状态变量
    state = {
        'ipv4': {'count': 0, 'start': 0, 'end': 0},
        'ipv6': {'count': 0, 'start': 0, 'end': 0}
    }

    # 事件处理函数
    def handle_ipv4_event_drop(cpu, data, size):
        nonlocal state
        nonlocal sip, dip, sport, dport 
        event = b["ipv4_events"].event(data)
        s = state['ipv4']
        s['count'] += 1
        if s['count'] == 1:
            s['start'] = event.ts_us
        else:
            s['end'] = event.ts_us
            
        interval = (s['end'] - s['start']) / 1000000
        if interval > 1:
            drops = s['count'] / interval
            s['count'] = 0
            s['start'] = 0
            s['end'] = 0

            event_data = {
                'type': 'ipv4',
                'pid': event.pid,
                'saddr': dip,
                'daddr': sip,
                'sport': dport,
                'dport': sport,
                'drop(s)': drops
            }
            event_queue.put(event_data)

    def handle_ipv6_event_drop(cpu, data, size):
        nonlocal state
        nonlocal sip, dip, sport, dport 
        drops = 0
        event = b["ipv6_events"].event(data)
        s = state['ipv6']
        s['count'] += 1
        if s['count'] == 1:
            s['start'] = event.ts_us
        else:
            s['end'] = event.ts_us

        interval = (s['end'] - s['start']) / 1000000
        if interval > 1:
            drops = s['count'] / interval
            s['count'] = 0
            s['start'] = 0
            s['end'] = 0

            event_data = {
                'type': 'ipv6',
                'pid': event.pid,
                'saddr': dip,
                'daddr': sip,
                'sport': dport,
                'dport': sport,
                'drop(s)': drops
            }
            event_queue.put(event_data)

    # 2、linktrans：
    cnt_ipv4_rx_linktrans = 0
    start_time_ipv4_rx_linktrans = 0
    end_time_ipv4_rx_linktrans = 0

    cnt_ipv4_tx_linktrans = 0
    start_time_ipv4_tx_linktrans = 0
    end_time_ipv4_tx_linktrans = 0

    cnt_ipv6_rx_linktrans = 0
    start_time_ipv6_rx_linktrans = 0
    end_time_ipv6_rx_linktrans = 0

    cnt_ipv6_tx_linktrans = 0
    start_time_ipv6_tx_linktrans = 0
    end_time_ipv6_tx_linktrans = 0

    def handle_ipv4_event_tx_linktrans(cpu, data, size):
        nonlocal cnt_ipv4_tx_linktrans, start_time_ipv4_tx_linktrans, end_time_ipv4_tx_linktrans
        nonlocal sip, dip, sport, dport 

        event = b["ipv4_events_tx_linktrans"].event(data)
        interval = 0
        cnt_ipv4_tx_linktrans += 1

        if cnt_ipv4_tx_linktrans == 1:
            start_time_ipv4_tx_linktrans = event.ts_us
        else:
            end_time_ipv4_tx_linktrans = event.ts_us

        interval = (end_time_ipv4_tx_linktrans - start_time_ipv4_tx_linktrans) / 100000;
        if interval > 1:
            #print("222")
            frequency = float(cnt_ipv4_tx_linktrans) / interval
            cnt_ipv4_tx_linktrans = 0
            start_time_ipv4_tx_linktrans = 0
            end_time_ipv4_tx_linktrans = 0

            event_data = {
                'crosslayer': 'linktrans',
                'direction': 'send',
                'type': 'ipv4',
                'pid': event.pid,
                'pid_name': event.task.decode('utf-8', 'replace'),
                'saddr': sip,
                'daddr': dip,
                'sport': sport,
                'dport': dport,

                'LAT(ms)': float(event.delta_us) / 1000,
                'frequency(s)': frequency
            }
            event_queue.put(event_data)

    def handle_ipv6_event_tx_linktrans(cpu, data, size):
        nonlocal cnt_ipv6_tx_linktrans, start_time_ipv6_tx_linktrans, end_time_ipv6_tx_linktrans
        
        nonlocal sip, dip, sport, dport 
        event = b["ipv6_events_tx_linktrans"].event(data)

        interval = 0
        cnt_ipv6_tx_linktrans += 1
        if cnt_ipv6_tx_linktrans == 1:
            start_time_ipv6_tx_linktrans = event.ts_us
        else:
            end_time_ipv6_tx_linktrans = event.ts_us

        interval = (end_time_ipv6_tx_linktrans - start_time_ipv6_tx_linktrans) / 1000000;
        if interval > 1:
            frequency = float(cnt_ipv6_tx_linktrans) / interval
            cnt_ipv6_tx_linktrans = 0
            start_time_ipv6_tx_linktrans = 0
            end_time_ipv6_tx_linktrans = 0

            event_data = {
                'crosslayer': 'linktrans',
                'direction': 'send',
                'type': 'ipv6',
                'pid': event.pid,
                'pid_name': event.task.decode('utf-8', 'replace'),
                'saddr': sip,
                'daddr': dip,
                'sport': sport,
                'dport': dport,

                'LAT(ms)': float(event.delta_us) / 1000,
                'frequency(s)': frequency
            }
            event_queue.put(event_data)

    def handle_ipv4_event_rx_linktrans(cpu, data, size):
        nonlocal cnt_ipv4_rx_linktrans, start_time_ipv4_rx_linktrans, end_time_ipv4_rx_linktrans
        
        nonlocal sip, dip, sport, dport 
        event = b["ipv4_events_rx_linktrans"].event(data)
        interval = 0
        cnt_ipv4_rx_linktrans += 1
        if cnt_ipv4_rx_linktrans == 1:
            start_time_ipv4_rx_linktrans = event.ts_us
        else:
            end_time_ipv4_rx_linktrans = event.ts_us

        interval = (end_time_ipv4_rx_linktrans - start_time_ipv4_rx_linktrans) / 1000000;

        if interval > 1:
            frequency = float(cnt_ipv4_rx_linktrans) / interval
            cnt_ipv4_rx_linktrans = 0
            start_time_ipv4_rx_linktrans = 0
            end_time_ipv4_rx_linktrans = 0

            event_data = {
                'crosslayer': 'linktrans',
                'direction': 'receive',
                'type': 'ipv4',
                'pid': event.pid,
                'pid_name': event.task.decode('utf-8', 'replace'),
                'saddr': dip,
                'daddr': sip,
                'sport': dport,
                'dport': sport,

                'LAT(ms)': float(event.delta_us) / 1000,
                'frequency(s)': frequency
            }
            event_queue.put(event_data)

    def handle_ipv6_event_rx_linktrans(cpu, data, size):
        nonlocal cnt_ipv6_rx_linktrans, start_time_ipv6_rx_linktrans, end_time_ipv6_rx_linktrans
        nonlocal sip, dip, sport, dport 
        event = b["ipv6_events_rx_linktrans"].event(data)
        interval = 0
        cnt_ipv6_rx_linktrans += 1
        if cnt_ipv6_rx_linktrans == 1:
            start_time_ipv6_rx_linktrans = event.ts_us
        else:
            end_time_ipv6_rx_linktrans = event.ts_us

        interval = (end_time_ipv6_rx_linktrans - start_time_ipv6_rx_linktrans) / 1000000;
        if interval > 1:
            frequency = float(cnt_ipv6_rx_linktrans) / interval
            cnt_ipv6_rx_linktrans = 0
            start_time_ipv6_rx_linktrans = 0
            end_time_ipv6_rx_linktrans = 0

            event_data = {
                'crosslayer': 'linktrans',
                'direction': 'receive',
                'type': 'ipv6',
                'pid': event.pid,
                'pid_name': event.task.decode('utf-8', 'replace'),
                'saddr': dip,
                'daddr': sip,
                'sport': dport,
                'dport': sport,

                'LAT(ms)': float(event.delta_us) / 1000,
                'frequency(s)': frequency
            }
            event_queue.put(event_data)

    # 3、networktrans：
    cnt_ipv4_rx_networktrans = 0
    start_time_ipv4_rx_networktrans = 0
    end_time_ipv4_rx_networktrans = 0

    cnt_ipv4_tx_networktrans = 0
    start_time_ipv4_tx_networktrans = 0
    end_time_ipv4_tx_networktrans = 0

    cnt_ipv6_rx_networktrans = 0
    start_time_ipv6_rx_networktrans = 0
    end_time_ipv6_rx_networktrans = 0

    cnt_ipv6_tx_networktrans = 0
    start_time_ipv6_tx_networktrans = 0
    end_time_ipv6_tx_networktrans = 0

    def handle_ipv4_event_tx_networktrans(cpu, data, size):
        nonlocal cnt_ipv4_tx_networktrans, start_time_ipv4_tx_networktrans, end_time_ipv4_tx_networktrans
        nonlocal sip, dip, sport, dport 

        event = b["ipv4_events_tx_networktrans"].event(data)
        interval = 0
        cnt_ipv4_tx_networktrans += 1

        if cnt_ipv4_tx_networktrans == 1:
            start_time_ipv4_tx_networktrans = event.ts_us
        else:
            end_time_ipv4_tx_networktrans = event.ts_us

        interval = (end_time_ipv4_tx_networktrans - start_time_ipv4_tx_networktrans) / 100000;
        if interval > 1:
            frequency = float(cnt_ipv4_tx_networktrans) / interval
            cnt_ipv4_tx_networktrans = 0
            start_time_ipv4_tx_networktrans = 0
            end_time_ipv4_tx_networktrans = 0

            event_data = {
                'crosslayer': 'networktrans',
                'direction': 'send',
                'type': 'ipv4',
                'pid': event.pid,
                'pid_name': event.task.decode('utf-8', 'replace'),
                'saddr': sip,
                'daddr': dip,
                'sport': sport,
                'dport': dport,

                'LAT(ms)': float(event.delta_us) / 1000,
                'frequency(s)': frequency
            }
            event_queue.put(event_data)

    def handle_ipv6_event_tx_networktrans(cpu, data, size):
        nonlocal cnt_ipv6_tx_networktrans, start_time_ipv6_tx_networktrans, end_time_ipv6_tx_networktrans
        nonlocal sip, dip, sport, dport 
        event = b["ipv6_events_tx_networktrans"].event(data)

        interval = 0
        cnt_ipv6_tx_networktrans += 1
        if cnt_ipv6_tx_networktrans == 1:
            start_time_ipv6_tx_networktrans = event.ts_us
        else:
            end_time_ipv6_tx_networktrans = event.ts_us

        interval = (end_time_ipv6_tx_networktrans - start_time_ipv6_tx_networktrans) / 1000000;
        if interval > 1:
            frequency = float(cnt_ipv6_tx_networktrans) / interval
            cnt_ipv6_tx_networktrans = 0
            start_time_ipv6_tx_networktrans = 0
            end_time_ipv6_tx_networktrans = 0

            event_data = {
                'crosslayer': 'networktrans',
                'direction': 'send',
                'type': 'ipv6',
                'pid': event.pid,
                'pid_name': event.task.decode('utf-8', 'replace'),
                'saddr': sip,
                'daddr': dip,
                'sport': sport,
                'dport': dport,

                'LAT(ms)': float(event.delta_us) / 1000,
                'frequency(s)': frequency
            }
            event_queue.put(event_data)

    def handle_ipv4_event_rx_networktrans(cpu, data, size):
        nonlocal cnt_ipv4_rx_networktrans, start_time_ipv4_rx_networktrans, end_time_ipv4_rx_networktrans
        nonlocal sip, dip, sport, dport 
        event = b["ipv4_events_rx_networktrans"].event(data)
        interval = 0
        cnt_ipv4_rx_networktrans += 1
        if cnt_ipv4_rx_networktrans == 1:
            start_time_ipv4_rx_networktrans = event.ts_us
        else:
            end_time_ipv4_rx_networktrans = event.ts_us

        interval = (end_time_ipv4_rx_networktrans - start_time_ipv4_rx_networktrans) / 1000000;

        if interval > 1:
            frequency = float(cnt_ipv4_rx_networktrans) / interval
            cnt_ipv4_rx_networktrans = 0
            start_time_ipv4_rx_networktrans = 0
            end_time_ipv4_rx_networktrans = 0

            event_data = {
                'crosslayer': 'networktrans',
                'direction': 'receive',
                'type': 'ipv4',
                'pid': event.pid,
                'pid_name': event.task.decode('utf-8', 'replace'),
                'saddr': dip,
                'daddr': sip,
                'sport': dport,
                'dport': sport,

                'LAT(ms)': float(event.delta_us) / 1000,
                'frequency(s)': frequency
            }
            event_queue.put(event_data)

    def handle_ipv6_event_rx_networktrans(cpu, data, size):
        nonlocal cnt_ipv6_rx_networktrans, start_time_ipv6_rx_networktrans, end_time_ipv6_rx_networktrans
        nonlocal sip, dip, sport, dport 
        event = b["ipv6_events_rx_networktrans"].event(data)
        interval = 0
        cnt_ipv6_rx_networktrans += 1
        if cnt_ipv6_rx_networktrans == 1:
            start_time_ipv6_rx_networktrans = event.ts_us
        else:
            end_time_ipv6_rx_networktrans = event.ts_us

        interval = (end_time_ipv6_rx_networktrans - start_time_ipv6_rx_networktrans) / 1000000;
        if interval > 1:
            frequency = float(cnt_ipv6_rx_networktrans) / interval
            cnt_ipv6_rx_networktrans = 0
            start_time_ipv6_rx_networktrans = 0
            end_time_ipv6_rx_networktrans = 0

            event_data = {
                'crosslayer': 'networktrans',
                'direction': 'receive',
                'type': 'ipv6',
                'pid': event.pid,
                'pid_name': event.task.decode('utf-8', 'replace'),
                'saddr': dip,
                'daddr': sip,
                'sport': dport,
                'dport': sport,

                'LAT(ms)': float(event.delta_us) / 1000,
                'frequency(s)': frequency
            }
            event_queue.put(event_data)

    # 1、 trans num：
    state_tx_transnum = {
        'ipv4': {'count': 0, 'start': 0, 'end': 0},
        'ipv6': {'count': 0, 'start': 0, 'end': 0}
    }

    def handle_ipv4_event_tx_transnum(cpu, data, size):
        nonlocal state_tx_transnum
        nonlocal sip, dip, sport, dport 
        event = b["ipv4_events_tx_transnum"].event(data)
        s = state_tx_transnum['ipv4']
        s['count'] += 1
        if s['count'] == 1:
            s['start'] = event.ts_us
        else:
            s['end'] = event.ts_us

        pps = 0
        interval = (s['end'] - s['start']) / 1000000
        if interval > 1:
            pps = s['count'] / interval
            #print("eee")
            event_data = {
                'layer': 'trans',
                'direction': 'send',
                'type': 'ipv4',
                'pid': event.pid,
                'saddr': sip,
                'daddr': dip,
                'sport': sport,
                'dport': dport,
                'num': s['count'] - 1,
                'pps(s)': pps
            }
            event_queue.put(event_data)
            s['count'] = 0
            s['start'] = 0
            s['end'] = 0

    def handle_ipv6_event_tx_transnum(cpu, data, size):
        nonlocal state_tx_transnum
        nonlocal sip, dip, sport, dport 
        pps = 0
        event = b["ipv6_events_tx_transnum"].event(data)
        s = state_tx_transnum['ipv6']
        s['count'] += 1
        if s['count'] == 1:
            s['start'] = event.ts_us
        else:
            s['end'] = event.ts_us

        interval = (s['end'] - s['start']) / 1000000
        if interval > 1:
            pps = s['count'] / interval

            event_data = {
                'layer': 'trans',
                'direction': 'send',
                'type': 'ipv6',
                'pid': event.pid,
                'saddr': sip,
                'daddr': dip,
                'sport': sport,
                'dport': dport,
                'num': s['count'] - 1,
                'pps(s)': pps
            }
            event_queue.put(event_data)
            s['count'] = 0
            s['start'] = 0
            s['end'] = 0

    # 1、 network num：
    state_tx_networknum = {
        'ipv4': {'count': 0, 'start': 0, 'end': 0},
        'ipv6': {'count': 0, 'start': 0, 'end': 0}
    }

    def handle_ipv4_event_tx_networknum(cpu, data, size):
        nonlocal state_tx_networknum
        nonlocal sip, dip, sport, dport 
        event = b["ipv4_events_tx_networknum"].event(data)
        s = state_tx_networknum['ipv4']
        s['count'] += 1
        if s['count'] == 1:
            s['start'] = event.ts_us
        else:
            s['end'] = event.ts_us

        pps = 0
        interval = (s['end'] - s['start']) / 1000000
        if interval > 1:
            pps = s['count'] / interval
            event_data = {
                'layer': 'network',
                'direction': 'send',
                'type': 'ipv4',
                'pid': event.pid,
                'saddr': sip,
                'daddr': dip,
                'sport': sport,
                'dport': dport,
                'num': s['count'] - 1,
                'pps(s)': pps
            }
            event_queue.put(event_data)
            s['count'] = 0
            s['start'] = 0
            s['end'] = 0

    def handle_ipv6_event_tx_networknum(cpu, data, size):
        nonlocal state_tx_networknum
        nonlocal sip, dip, sport, dport 
        pps = 0
        event = b["ipv6_events_tx_networknum"].event(data)
        s = state_tx_networknum['ipv6']
        s['count'] += 1
        if s['count'] == 1:
            s['start'] = event.ts_us
        else:
            s['end'] = event.ts_us

        interval = (s['end'] - s['start']) / 1000000
        if interval > 1:
            pps = s['count'] / interval

            event_data = {
                'layer': 'network',
                'direction': 'send',
                'type': 'ipv6',
                'pid': event.pid,
                'saddr': sip,
                'daddr': dip,
                'sport': sport,
                'dport': dport,
                'num': s['count'] - 1,
                'pps(s)': pps
            }
            event_queue.put(event_data)
            s['count'] = 0
            s['start'] = 0
            s['end'] = 0

    # 1、 link num：
    state_tx_linknum = {
        'ipv4': {'count': 0, 'start': 0, 'end': 0},
        'ipv6': {'count': 0, 'start': 0, 'end': 0}
    }

    def handle_ipv4_event_tx_linknum(cpu, data, size):
        nonlocal state_tx_linknum
        nonlocal sip, dip, sport, dport 
        event = b["ipv4_events_tx_linknum"].event(data)
        s = state_tx_linknum['ipv4']
        s['count'] += 1
        if s['count'] == 1:
            s['start'] = event.ts_us
        else:
            s['end'] = event.ts_us

        pps = 0
        interval = (s['end'] - s['start']) / 1000000
        if interval > 1:
            pps = s['count'] / interval
            event_data = {
                'layer': 'link',
                'direction': 'send',
                'type': 'ipv4',
                'pid': event.pid,
                'saddr': sip,
                'daddr': dip,
                'sport': sport,
                'dport': dport,
                'num': s['count'] - 1,
                'pps(s)': pps
            }
            event_queue.put(event_data)
            s['count'] = 0
            s['start'] = 0
            s['end'] = 0

    def handle_ipv6_event_tx_linknum(cpu, data, size):
        nonlocal state_tx_linknum
        nonlocal sip, dip, sport, dport 
        pps = 0
        event = b["ipv6_events_tx_linknum"].event(data)
        s = state_tx_linknum['ipv6']
        s['count'] += 1
        if s['count'] == 1:
            s['start'] = event.ts_us
        else:
            s['end'] = event.ts_us

        interval = (s['end'] - s['start']) / 1000000
        if interval > 1:
            pps = s['count'] / interval

            event_data = {
                'layer': 'link',
                'direction': 'send',
                'type': 'ipv6',
                'pid': event.pid,
                'saddr': sip,
                'daddr': dip,
                'sport': sport,
                'dport': dport,
                'num': s['count'] - 1,
                'pps(s)': pps
            }
            event_queue.put(event_data)
            s['count'] = 0
            s['start'] = 0
            s['end'] = 0

    # 1、 trans num：
    state_rx_transnum = {
        'ipv4': {'count': 0, 'start': 0, 'end': 0},
        'ipv6': {'count': 0, 'start': 0, 'end': 0}
    }

    def handle_ipv4_event_rx_transnum(cpu, data, size):
        nonlocal state_rx_transnum
        nonlocal sip, dip, sport, dport 
        event = b["ipv4_events_rx_transnum"].event(data)
        s = state_rx_transnum['ipv4']
        s['count'] += 1
        if s['count'] == 1:
            s['start'] = event.ts_us
        else:
            s['end'] = event.ts_us

        pps = 0
        interval = (s['end'] - s['start']) / 1000000
        if interval > 1:
            pps = s['count'] / interval
            event_data = {
                'layer': 'trans',
                'direction': 'receive',
                'type': 'ipv4',
                'pid': event.pid,
                'saddr': dip,
                'daddr': sip,
                'sport': dport,
                'dport': sport,
                'num': s['count'] - 1,
                'pps(s)': pps
            }
            event_queue.put(event_data)
            s['count'] = 0
            s['start'] = 0
            s['end'] = 0

    def handle_ipv6_event_rx_transnum(cpu, data, size):
        nonlocal state_rx_transnum
        nonlocal sip, dip, sport, dport 
        pps = 0
        event = b["ipv6_events_rx_transnum"].event(data)
        s = state_rx_transnum['ipv6']
        s['count'] += 1
        if s['count'] == 1:
            s['start'] = event.ts_us
        else:
            s['end'] = event.ts_us

        interval = (s['end'] - s['start']) / 1000000
        if interval > 1:
            pps = s['count'] / interval

            event_data = {
                'layer': 'trans',
                'direction': 'receive',
                'type': 'ipv6',
                'pid': event.pid,
                'saddr': dip,
                'daddr': sip,
                'sport': dport,
                'dport': sport,
                'num': s['count'] - 1,
                'pps(s)': pps
            }
            event_queue.put(event_data)
            s['count'] = 0
            s['start'] = 0
            s['end'] = 0

    # 1、 network num：
    state_rx_networknum = {
        'ipv4': {'count': 0, 'start': 0, 'end': 0},
        'ipv6': {'count': 0, 'start': 0, 'end': 0}
    }

    def handle_ipv4_event_rx_networknum(cpu, data, size):
        nonlocal state_rx_networknum
        nonlocal sip, dip, sport, dport 
        event = b["ipv4_events_rx_networknum"].event(data)
        s = state_rx_networknum['ipv4']
        s['count'] += 1
        if s['count'] == 1:
            s['start'] = event.ts_us
        else:
            s['end'] = event.ts_us

        pps = 0
        interval = (s['end'] - s['start']) / 1000000
        if interval > 1:
            pps = s['count'] / interval
            event_data = {
                'layer': 'network',
                'direction': 'receive',
                'type': 'ipv4',
                'pid': event.pid,
                'saddr': dip,
                'daddr': sip,
                'sport': dport,
                'dport': sport,
                'num': s['count'] - 1,
                'pps(s)': pps
            }
            event_queue.put(event_data)
            s['count'] = 0
            s['start'] = 0
            s['end'] = 0

    def handle_ipv6_event_rx_networknum(cpu, data, size):
        nonlocal state_rx_networknum
        nonlocal sip, dip, sport, dport 
        pps = 0
        event = b["ipv6_events_rx_networknum"].event(data)
        s = state_rx_networknum['ipv6']
        s['count'] += 1
        if s['count'] == 1:
            s['start'] = event.ts_us
        else:
            s['end'] = event.ts_us

        interval = (s['end'] - s['start']) / 1000000
        if interval > 1:
            pps = s['count'] / interval

            event_data = {
                'layer': 'network',
                'direction': 'receive',
                'type': 'ipv6',
                'pid': event.pid,
                'saddr': dip,
                'daddr': sip,
                'sport': dport,
                'dport': sport,
                'num': s['count'] - 1,
                'pps(s)': pps
            }
            event_queue.put(event_data)
            s['count'] = 0
            s['start'] = 0
            s['end'] = 0

    # 1、 link num：
    state_rx_linknum = {
        'ipv4': {'count': 0, 'start': 0, 'end': 0},
        'ipv6': {'count': 0, 'start': 0, 'end': 0}
    }

    def handle_ipv4_event_rx_linknum(cpu, data, size):
        nonlocal state_rx_linknum
        nonlocal sip, dip, sport, dport 
        event = b["ipv4_events_rx_linknum"].event(data)
        s = state_rx_linknum['ipv4']
        s['count'] += 1
        if s['count'] == 1:
            s['start'] = event.ts_us
        else:
            s['end'] = event.ts_us

        pps = 0
        interval = (s['end'] - s['start']) / 1000000
        if interval > 1:
            pps = s['count'] / interval
            event_data = {
                'layer': 'link',
                'direction': 'receive',
                'type': 'ipv4',
                'pid': event.pid,
                'saddr': dip,
                'daddr': sip,
                'sport': dport,
                'dport': sport,
                'num': s['count'] - 1,
                'pps(s)': pps
            }
            event_queue.put(event_data)
            s['count'] = 0
            s['start'] = 0
            s['end'] = 0

    def handle_ipv6_event_rx_linknum(cpu, data, size):
        nonlocal state_rx_linknum
        nonlocal sip, dip, sport, dport 
        pps = 0
        event = b["ipv6_events_rx_linknum"].event(data)
        s = state_rx_linknum['ipv6']
        s['count'] += 1
        if s['count'] == 1:
            s['start'] = event.ts_us
        else:
            s['end'] = event.ts_us

        interval = (s['end'] - s['start']) / 1000000
        if interval > 1:
            pps = s['count'] / interval

            event_data = {
                'layer': 'link',
                'direction': 'receive',
                'type': 'ipv6',
                'pid': event.pid,
                'saddr': dip,
                'daddr': sip,
                'sport': dport,
                'dport': sport,
                'num': s['count'] - 1,
                'pps(s)': pps
            }
            event_queue.put(event_data)
            s['count'] = 0
            s['start'] = 0
            s['end'] = 0

    # 附加探针
    try:
        if b.get_kprobe_functions(b"tcp_drop"):
            b.attach_kprobe(event="tcp_drop", fn_name="trace_tcp_drop")
        elif b.tracepoint_exists("skb", "kfree_skb") and kfree_skb_traceable:
            pass
        else:
            yield json.dumps({'error': 'Kernel tracing capabilities not available'}) + '\n'
            return

    except Exception as e:
        yield json.dumps({'error': f'Tracing setup failed: {str(e)}'}) + '\n'
        return

    # 设置IPv4过滤
    if ipv4_flag:
        try:
            b.attach_kprobe(event="ip_finish_output", fn_name="trace_ip_output")
            b.attach_kprobe(event="ip_local_deliver", fn_name="trace_ip_rcv")
            b.attach_kprobe(event="inet_sendmsg", fn_name="trace_trans_output")
            b.attach_kprobe(event="inet_recvmsg", fn_name="trace_trans_rcv")
            protocol_map = {
                "tcp": 6,
                "udp": 17,
                "icmp": 1
            }
            five_tuple_ipv4 = FiveTupleIPV4()
            five_tuple_ipv4.saddr = ip_to_uint(sip)
            five_tuple_ipv4.daddr = ip_to_uint(dip)
            five_tuple_ipv4.sport = socket.htons(sport)
            five_tuple_ipv4.dport = socket.htons(dport)
            five_tuple_ipv4.protocol = protocol_map[protocol]
            five_tuple_filter_ipv4 = b['five_tuple_filter_ipv4']
            five_tuple_filter_ipv4[0] = five_tuple_ipv4
            b["ipv4_events_tx_linktrans"].open_perf_buffer(handle_ipv4_event_tx_linktrans)
            b["ipv4_events_tx_networktrans"].open_perf_buffer(handle_ipv4_event_tx_networktrans)
            b["ipv4_events_tx"].open_perf_buffer(handle_ipv4_event_tx)
            b["ipv4_events_tx_transnum"].open_perf_buffer(handle_ipv4_event_tx_transnum)
            b["ipv4_events_tx_networknum"].open_perf_buffer(handle_ipv4_event_tx_networknum)
            b["ipv4_events_tx_linknum"].open_perf_buffer(handle_ipv4_event_tx_linknum)
            # 
            b["ipv4_events"].open_perf_buffer(handle_ipv4_event_drop)
            b["ipv4_events_rx"].open_perf_buffer(handle_ipv4_event_rx)
            b["ipv4_events_rx_networktrans"].open_perf_buffer(handle_ipv4_event_rx_networktrans)
            b["ipv4_events_rx_linktrans"].open_perf_buffer(handle_ipv4_event_rx_linktrans)

            b["ipv4_events_rx_transnum"].open_perf_buffer(handle_ipv4_event_rx_transnum)
            b["ipv4_events_rx_networknum"].open_perf_buffer(handle_ipv4_event_rx_networknum)
            b["ipv4_events_rx_linknum"].open_perf_buffer(handle_ipv4_event_rx_linknum)

        except ValueError as e:
            yield json.dumps({'error': f'IPv4 configuration error: {str(e)}'}) + '\n'
            return

    # 设置IPv6过滤
    if ipv6_flag:
        try:
            b.attach_kprobe(event="ip6_finish_output", fn_name="trace_ip_output")
            b.attach_kprobe(event="ip6_input", fn_name="trace_ip_rcv")
            b.attach_kprobe(event="inet6_sendmsg", fn_name="trace_trans_output")
            b.attach_kprobe(event="inet6_recvmsg", fn_name="trace_trans_rcv")
            protocol_map = {
                "tcp": 6,
                "udp": 17,
                "icmp": 58
            }
            five_tuple_ipv6 = FiveTupleIPV6()
            saddr_parts = ipv6_to_uint32(sip)
            daddr_parts = ipv6_to_uint32(dip)
            five_tuple_ipv6.saddr = (c_uint32 * 4)(*saddr_parts)
            five_tuple_ipv6.daddr = (c_uint32 * 4)(*daddr_parts)
            five_tuple_ipv6.sport = socket.htons(sport)
            five_tuple_ipv6.dport = socket.htons(dport)
            five_tuple_ipv6.protocol = protocol_map[protocol]
            five_tuple_filter_ipv6 = b['five_tuple_filter_ipv6']
            five_tuple_filter_ipv6[0] = five_tuple_ipv6
            b["ipv6_events_tx_linktrans"].open_perf_buffer(handle_ipv6_event_tx_linktrans)
            b["ipv6_events_tx_networktrans"].open_perf_buffer(handle_ipv6_event_tx_networktrans)
            b["ipv6_events_tx"].open_perf_buffer(handle_ipv6_event_tx)
            b["ipv6_events_tx_transnum"].open_perf_buffer(handle_ipv6_event_tx_transnum)
            b["ipv6_events_tx_networknum"].open_perf_buffer(handle_ipv6_event_tx_networknum)
            b["ipv6_events_tx_linknum"].open_perf_buffer(handle_ipv6_event_tx_linknum)
            #
            b["ipv6_events"].open_perf_buffer(handle_ipv6_event_drop)
            b["ipv6_events_rx"].open_perf_buffer(handle_ipv6_event_rx)
            b["ipv6_events_rx_networktrans"].open_perf_buffer(handle_ipv6_event_rx_networktrans)
            b["ipv6_events_rx_linktrans"].open_perf_buffer(handle_ipv6_event_rx_linktrans)

            b["ipv6_events_rx_transnum"].open_perf_buffer(handle_ipv6_event_rx_transnum)
            b["ipv6_events_rx_networknum"].open_perf_buffer(handle_ipv6_event_rx_networknum)
            b["ipv6_events_rx_linknum"].open_perf_buffer(handle_ipv6_event_rx_linknum)

        except ValueError as e:
            yield json.dumps({'error': f'IPv6 configuration error: {str(e)}'}) + '\n'
            return

    # b.trace_print()
    # 主事件循环
    while True:
        try:
            b.perf_buffer_poll(timeout=10000)
            processed = False
            # 输出所有结果
            while not event_queue.empty():
                data = event_queue.get()
                yield json.dumps(data) + '\n'
                processed = True

            if not processed:
                if ipv4_flag:
                    yield json.dumps({
                        'crosslayer': 'linktrans',
                        'direction': 'send',
                        'type': 'ipv4',
                        'pid': -1,
                        'pid_name': 'NULL',
                        'saddr': sip,
                        'daddr': dip,
                        'sport': sport,
                        'dport': dport,
                        'LAT(ms)': 0,
                        'frequency(s)': 0
                    })
                    yield json.dumps({
                        'crosslayer': 'networktrans',
                        'direction': 'send',
                        'type': 'ipv4',
                        'pid': -1,
                        'pid_name': 'NULL',
                        'saddr': sip,
                        'daddr': dip,
                        'sport': sport,
                        'dport': dport,
                        'LAT(ms)': 0,
                        'frequency(s)': 0
                    })
                    yield json.dumps({
                        'crosslayer': 'linknetwork',
                        'direction': 'send',
                        'type': 'ipv4',
                        'pid': -1,
                        'pid_name': 'NULL',
                        'saddr': sip,
                        'daddr': dip,
                        'sport': sport,
                        'dport': dport,
                        'LAT(ms)': 0,
                        'frequency(s)': 0
                    })
                    yield json.dumps({
                        'layer': 'trans',
                        'direction': 'send',
                        'type': 'ipv4',
                        'pid': -1,
                        'saddr': sip,
                        'daddr': dip,
                        'sport': sport,
                        'dport': dport, 
                        'num': 0,
                        'pps(s)': 0
                    })
                    yield json.dumps({
                        'layer': 'network',
                        'direction': 'send',
                        'type': 'ipv4',
                        'pid': -1,
                        'saddr': sip,
                        'daddr': dip,
                        'sport': sport,
                        'dport': dport, 
                        'num': 0,
                        'pps(s)': 0
                    })
                    yield json.dumps({
                        'layer': 'link',
                        'direction': 'send',
                        'type': 'ipv4',
                        'pid': -1,
                        'saddr': sip,
                        'daddr': dip,
                        'sport': sport,
                        'dport': dport, 
                        'num': 0,
                        'pps(s)': 0
                    })
                    yield json.dumps({
                        'crosslayer': 'linknetwork',
                        'direction': 'receive',
                        'type': 'ipv4',
                        'pid': -1,
                        'pid_name': 'NULL',
                        'saddr': dip,
                        'daddr': sip,
                        'sport': dport,
                        'dport': sport,
                        'LAT(ms)': 0,
                        'frequency(s)': 0
                    })
                    yield json.dumps({
                        'crosslayer': 'networktrans', 
                        'direction': 'receive',
                        'type': 'ipv4',
                        'pid': -1,
                        'pid_name': 'NULL',
                        'saddr': dip,
                        'daddr': sip,
                        'sport': dport,
                        'dport': sport,
                        'LAT(ms)': 0,
                        'frequency(s)': 0
                    })
                    yield json.dumps({
                        'crosslayer': 'linktrans',
                        'direction': 'receive',
                        'type': 'ipv4',
                        'pid': -1,
                        'pid_name': 'NULL',
                        'saddr': dip,
                        'daddr': sip,
                        'sport': dport,
                        'dport': sport,
                        'LAT(ms)': 0,
                        'frequency(s)': 0
                    })
                    yield json.dumps({
                        'layer': 'trans',
                        'direction': 'receive',
                        'type': 'ipv4',
                        'pid': -1,
                        'saddr': dip,
                        'daddr': sip,
                        'sport': dport,
                        'dport': sport, 
                        'num': 0,
                        'pps(s)': 0
                    })
                    yield json.dumps({
                        'layer': 'network',
                        'direction': 'receive',
                        'type': 'ipv4',
                        'pid': -1,
                        'saddr': dip,
                        'daddr': sip,
                        'sport': dport,
                        'dport': sport, 
                        'num': 0,
                        'pps(s)': 0
                    })
                    yield json.dumps({
                        'layer': 'link',
                        'direction': 'receive',
                        'type': 'ipv4',
                        'pid': -1,
                        'saddr': dip,
                        'daddr': sip,
                        'sport': dport,
                        'dport': sport, 
                        'num': 0,
                        'pps(s)': 0
                    })
                    yield json.dumps({
                        'type': 'ipv4',
                        'pid': -1,
                        'saddr': dip,
                        'daddr': sip,
                        'sport': dport,
                        'dport': sport,
                        'drop(s)': 0
                    })
                if ipv6_flag:
                    yield json.dumps({
                        'crosslayer': 'linktrans',
                        'direction': 'send',
                        'type': 'ipv6',
                        'pid': -1,
                        'pid_name': 'NULL',
                        'saddr': sip,
                        'daddr': dip,
                        'sport': sport,
                        'dport': dport,

                        'LAT(ms)': 0,
                        'frequency(s)': 0
                    })
                    yield json.dumps({
                        'crosslayer': 'networktrans',
                        'direction': 'send',
                        'type': 'ipv6',
                        'pid': -1,
                        'pid_name': 'NULL',
                        'saddr': sip,
                        'daddr': dip,
                        'sport': sport,
                        'dport': dport,

                        'LAT(ms)': 0,
                        'frequency(s)': 0
                    })
                    yield json.dumps({
                        'crosslayer': 'linknetwork',
                        'direction': 'send',
                        'type': 'ipv6',
                        'pid': -1,
                        'pid_name': 'NULL',
                        'saddr': sip,
                        'daddr': dip,
                        'sport': sport,
                        'dport': dport,

                        'LAT(ms)': 0,
                        'frequency(s)': 0
                    })
                    yield json.dumps({
                        'layer': 'trans',
                        'direction': 'send',
                        'type': 'ipv6',
                        'pid': -1,
                        'saddr': sip,
                        'daddr': dip,
                        'sport': sport,
                        'dport': dport,
                        'num': 0,
                        'pps(s)': 0
                    })
                    yield json.dumps({
                        'layer': 'network',
                        'direction': 'send',
                        'type': 'ipv6',
                        'pid': -1,
                        'saddr': sip,
                        'daddr': dip,
                        'sport': sport,
                        'dport': dport,
                        'num': 0,
                        'pps(s)': 0
                    })
                    yield json.dumps({
                        'layer': 'link',
                        'direction': 'send',
                        'type': 'ipv6',
                        'pid': -1,
                        'saddr': sip,
                        'daddr': dip,
                        'sport': sport,
                        'dport': dport,
                        'num': 0,
                        'pps(s)': 0
                    })
                    yield json.dumps({
                        'crosslayer': 'linknetwork',
                        'direction': 'receive',
                        'type': 'ipv6',
                        'pid': -1,
                        'pid_name': 'NULL',
                        'saddr': dip,
                        'daddr': sip,
                        'sport': dport,
                        'dport': sport,

                        'LAT(ms)': 0,
                        'frequency(s)': 0
                    })
                    yield json.dumps({
                        'crosslayer': 'networktrans',
                        'direction': 'receive',
                        'type': 'ipv6',
                        'pid': -1,
                        'pid_name': 'NULL',
                        'saddr': dip,
                        'daddr': sip,
                        'sport': dport,
                        'dport': sport,

                        'LAT(ms)': 0,
                        'frequency(s)': 0
                    })
                    yield json.dumps({
                        'crosslayer': 'linktrans',
                        'direction': 'receive',
                        'type': 'ipv6',
                        'pid': -1,
                        'pid_name': 'NULL',
                        'saddr': dip,
                        'daddr': sip,
                        'sport': dport,
                        'dport': sport,

                        'LAT(ms)': 0,
                        'frequency(s)': 0
                    })
                    yield json.dumps({
                        'layer': 'trans',
                        'direction': 'receive',
                        'type': 'ipv6',
                        'pid': -1,
                        'saddr': dip,
                        'daddr': sip,
                        'sport': dport,
                        'dport': sport,
                        'num': 0,
                        'pps(s)': 0
                    })
                    yield json.dumps({
                        'layer': 'network',
                        'direction': 'receive',
                        'type': 'ipv6',
                        'pid': -1,
                        'saddr': dip,
                        'daddr': sip,
                        'sport': dport,
                        'dport': sport,
                        'num': 0,
                        'pps(s)': 0
                    })
                    yield json.dumps({
                        'layer': 'link',
                        'direction': 'receive',
                        'type': 'ipv6',
                        'pid': -1,
                        'saddr': dip,
                        'daddr': sip,
                        'sport': dport,
                        'dport': sport,
                        'num': 0,
                        'pps(s)': 0
                    })
                    yield json.dumps({
                        'type': 'ipv6',
                        'pid': -1,
                        'saddr': dip,
                        'daddr': sip,
                        'sport': dport,
                        'dport': sport,
                        'drop(s)': 0
                    })

        except KeyboardInterrupt:
            exit()



