package bpf_engine

import (
	"fmt"
	"log"
	"unsafe"

	"github.com/packetscope/metrics/pkg/aggregation"
	"github.com/packetscope/metrics/pkg/bpf_engine/ebpf"

	"github.com/cilium/ebpf/link"
	"github.com/cilium/ebpf/rlimit"
)

type Engine struct {
	objs  ebpf.BpfObjects
	links []link.Link
}

func NewEngine() (*Engine, error) {
	if err := rlimit.RemoveMemlock(); err != nil {
		log.Printf("warn: failed to drop memlock: %v", err)
	}

	var objs ebpf.BpfObjects
	if err := ebpf.LoadBpfObjects(&objs, nil); err != nil {
		return nil, fmt.Errorf("failed to load objects: %w", err)
	}

	var links []link.Link

	attach := func(name string, l link.Link, err error) {
		if err != nil {
			log.Printf("warn: failed to attach %s: %v (skipping)", name, err)
			return
		}
		links = append(links, l)
		log.Printf("attached %s", name)
	}

	// === RX probes ===

	l, err := link.Tracepoint("net", "netif_receive_skb", objs.TraceNetifReceiveSkb, nil)
	attach("tracepoint/net/netif_receive_skb", l, err)

	l, err = link.AttachTracing(link.TracingOptions{Program: objs.IpLocalDeliverFunc})
	attach("fentry/ip_local_deliver", l, err)

	l, err = link.AttachTracing(link.TracingOptions{Program: objs.Ip6InputFunc})
	attach("fentry/ip6_input", l, err)

	l, err = link.AttachTracing(link.TracingOptions{Program: objs.InetRecvmsgFunc})
	attach("fentry/inet_recvmsg", l, err)

	l, err = link.AttachTracing(link.TracingOptions{Program: objs.Inet6RecvmsgFunc})
	attach("fentry/inet6_recvmsg", l, err)

	l, err = link.AttachTracing(link.TracingOptions{Program: objs.TcpRecvmsgFunc})
	attach("fentry/tcp_recvmsg", l, err)

	l, err = link.AttachTracing(link.TracingOptions{Program: objs.UdpRecvmsgFunc})
	attach("fentry/udp_recvmsg", l, err)

	// === TX probes ===
	l, err = link.AttachTracing(link.TracingOptions{Program: objs.InetSendmsgFunc})
	attach("fentry/inet_sendmsg", l, err)

	l, err = link.AttachTracing(link.TracingOptions{Program: objs.Inet6SendmsgFunc})
	attach("fentry/inet6_sendmsg", l, err)

	l, err = link.AttachTracing(link.TracingOptions{Program: objs.TcpSendmsgFunc})
	attach("fentry/tcp_sendmsg", l, err)

	l, err = link.AttachTracing(link.TracingOptions{Program: objs.UdpSendmsgFunc})
	attach("fentry/udp_sendmsg", l, err)

	l, err = link.AttachTracing(link.TracingOptions{Program: objs.IpFinishOutputFunc})
	attach("fentry/ip_finish_output", l, err)

	l, err = link.AttachTracing(link.TracingOptions{Program: objs.Ip6FinishOutputFunc})
	attach("fentry/ip6_finish_output", l, err)

	l, err = link.AttachTracing(link.TracingOptions{Program: objs.NetDevStartXmitFunc})
	attach("tp_btf/net_dev_start_xmit", l, err)

	// === Drop probe — runtime fallback chain ===
	// Priority 1: kprobe/tcp_drop_reason (kernel >= 6.1, most accurate)
	// Priority 2: kprobe/tcp_drop        (kernel < 6.1)
	// Priority 3: tracepoint/skb/kfree_skb (universal fallback, CO-RE)
	dropAttached := false
	l, err = link.Kprobe("tcp_drop_reason", objs.TcpDropReasonFunc, nil)
	if err == nil {
		attach("kprobe/tcp_drop_reason", l, nil)
		dropAttached = true
		log.Printf("drop hook: using kprobe/tcp_drop_reason (kernel >= 6.1)")
	}
	if !dropAttached {
		l, err = link.Kprobe("tcp_drop", objs.TcpDropFunc, nil)
		if err == nil {
			attach("kprobe/tcp_drop", l, nil)
			dropAttached = true
			log.Printf("drop hook: using kprobe/tcp_drop (kernel < 6.1)")
		}
	}
	if !dropAttached {
		l, err = link.Tracepoint("skb", "kfree_skb", objs.TraceKfreeSkb, nil)
		attach("tracepoint/skb/kfree_skb", l, err)
		if err == nil {
			log.Printf("drop hook: using tracepoint/skb/kfree_skb (fallback, CO-RE)")
		}
	}

	if len(links) == 0 {
		objs.Close()
		return nil, fmt.Errorf("failed to attach any BPF program")
	}

	return &Engine{
		objs:  objs,
		links: links,
	}, nil
}

func (e *Engine) Close() {
	for _, l := range e.links {
		l.Close()
	}
	e.objs.Close()
}

// ==================== Filter Updates ====================

func (e *Engine) UpdateIPv4Filter(sip, dip uint32, sport, dport uint16, protocol uint8) error {
	key := uint32(0)
	filter := ebpf.BpfFilterV4T{
		Sip:      sip,
		Dip:      dip,
		Sport:    sport,
		Dport:    dport,
		Protocol: protocol,
	}
	return e.objs.FiveTupleFilterIpv4.Put(&key, &filter)
}

func (e *Engine) UpdateIPv6Filter(sip, dip [16]byte, sport, dport uint16, protocol uint8) error {
	key := uint32(0)
	filter := ebpf.BpfFilterV6T{
		Sip:      sip,
		Dip:      dip,
		Sport:    sport,
		Dport:    dport,
		Protocol: protocol,
	}
	return e.objs.FiveTupleFilterIpv6.Put(&key, &filter)
}

// ==================== AggMapReader Implementation ====================

// AggMapAdapter wraps the BPF PERCPU_ARRAY map as an aggregation.AggMapReader.
type AggMapAdapter struct {
	engine *Engine
}

func (e *Engine) AggMap() *AggMapAdapter {
	return &AggMapAdapter{engine: e}
}

func (a *AggMapAdapter) LookupPerCPU(key uint32) ([]aggregation.AggVal, error) {
	var perCPU []ebpf.BpfAggValT
	if err := a.engine.objs.AggMap.Lookup(key, &perCPU); err != nil {
		return nil, err
	}
	// Convert from generated type to aggregation.AggVal
	result := make([]aggregation.AggVal, len(perCPU))
	for i, v := range perCPU {
		var task [16]byte
		for j, c := range v.LastTask {
			task[j] = byte(c)
		}
		// Convert ip_address union to [16]byte
		// bpf2go generates: struct { _ HostLayout; V4 uint32; _ [12]byte }
		// The underlying memory is 16 bytes matching C's union { u32 v4; u8 v6[16]; }
		saddr := *(*[16]byte)(unsafe.Pointer(&v.LastSaddr))
		daddr := *(*[16]byte)(unsafe.Pointer(&v.LastDaddr))
		result[i] = aggregation.AggVal{
			Packets:      v.Packets,
			FirstTsNs:    v.FirstTsNs,
			LastTsNs:     v.LastTsNs,
			LastLatUs:    v.LastLatUs,
			LastPid:      v.LastPid,
			LastTask:     task,
			LastSAddr:    saddr,
			LastDAddr:    daddr,
			LastSPort:    v.LastSport,
			LastDPort:    v.LastDport,
			LastProtocol: v.LastProtocol,
			LastIsIPv6:   v.LastIsIpv6,
		}
	}
	return result, nil
}

func (a *AggMapAdapter) ResetKey(key uint32) error {
	var perCPU []ebpf.BpfAggValT
	// Read to determine CPU count, then zero
	if err := a.engine.objs.AggMap.Lookup(key, &perCPU); err != nil {
		return err
	}
	zeros := make([]ebpf.BpfAggValT, len(perCPU))
	return a.engine.objs.AggMap.Put(key, zeros)
}
