package aggregation

// ==================== Constants ====================

import (
	"encoding/binary"
	"fmt"
	"net"
)

const AggMax uint32 = 26

// Metric types (first dimension of slot index)
const (
	MetricPPS  = 0 // Per-layer packet count & rate
	MetricLAT  = 1 // Cross-layer latency
	MetricDROP = 2 // Drop count
)

// Layers (for PPS metrics)
const (
	LayerLink    = 0
	LayerNetwork = 1
	LayerTrans   = 2
)

// Crosslayers (for LAT metrics, reuses Layer slot position)
const (
	CrosslayerLinkNetwork  = 0
	CrosslayerNetworkTrans = 1
	CrosslayerLinkTrans    = 2
)

// Directions
const (
	DirRX = 0
	DirTX = 1
)

// ==================== Slot Encoding ====================

// AggIdx computes the fixed slot index:
//
//	index = metricType*12 + layer*4 + direction*2 + isIPv6
func AggIdx(metricType, layer, direction, isIPv6 int) uint32 {
	return uint32(metricType*12 + layer*4 + direction*2 + isIPv6)
}

// SlotMeta describes what a given slot index represents.
type SlotMeta struct {
	MetricType int // 0=PPS, 1=LAT, 2=DROP
	Layer      int // 0-2: layer or crosslayer depending on MetricType
	Direction  int // 0=RX, 1=TX
	IsIPv6     int // 0=IPv4, 1=IPv6
}

// DecodeSlot reverses AggIdx back to its components.
func DecodeSlot(idx uint32) SlotMeta {
	isIPv6 := int(idx % 2)
	direction := int((idx / 2) % 2)
	layer := int((idx / 4) % 3)
	metricType := int(idx / 12)
	return SlotMeta{
		MetricType: metricType,
		Layer:      layer,
		Direction:  direction,
		IsIPv6:     isIPv6,
	}
}

// ==================== Name Mapping ====================

func LayerName(layer int) string {
	switch layer {
	case LayerLink:
		return "link"
	case LayerNetwork:
		return "network"
	case LayerTrans:
		return "trans"
	default:
		return "unknown"
	}
}

func CrosslayerName(cl int) string {
	switch cl {
	case CrosslayerLinkNetwork:
		return "linknetwork"
	case CrosslayerNetworkTrans:
		return "networktrans"
	case CrosslayerLinkTrans:
		return "linktrans"
	default:
		return "unknown"
	}
}

func DirectionName(dir int) string {
	if dir == DirTX {
		return "send"
	}
	return "receive"
}

func IPTypeName(isIPv6 int) string {
	if isIPv6 == 1 {
		return "ipv6"
	}
	return "ipv4"
}

// ==================== Aggregation Value ====================

// AggVal matches the BPF struct agg_val_t layout.
// Must stay in sync with common.h.
type AggVal struct {
	Packets      uint64
	FirstTsNs    uint64
	LastTsNs     uint64
	LastLatUs    uint64
	LastPid      uint32
	LastTask     [16]byte
	LastSAddr    [16]byte // ip_address union: v4 in first 4 bytes, or v6 all 16
	LastDAddr    [16]byte
	LastSPort    uint16
	LastDPort    uint16
	LastProtocol uint8
	LastIsIPv6   uint8
	Pad          [2]byte
}

// FormatAddr converts the raw ip_address union bytes to a human-readable string.
func FormatAddr(raw [16]byte, isIPv6 bool) string {
	if isIPv6 {
		ip := net.IP(raw[:])
		s := ip.String()
		if s == "::" {
			return ""
		}
		return s
	}
	// IPv4: stored in first 4 bytes, network byte order (little endian on x86)
	v4 := binary.LittleEndian.Uint32(raw[:4])
	if v4 == 0 {
		return ""
	}
	return fmt.Sprintf("%d.%d.%d.%d", raw[0], raw[1], raw[2], raw[3])
}

// SumPerCPU reduces per-CPU values to a single aggregated value.
func SumPerCPU(vals []AggVal) AggVal {
	var agg AggVal
	for _, v := range vals {
		agg.Packets += v.Packets

		// FirstTsNs: earliest non-zero
		if v.FirstTsNs > 0 && (agg.FirstTsNs == 0 || v.FirstTsNs < agg.FirstTsNs) {
			agg.FirstTsNs = v.FirstTsNs
		}

		// LastTsNs: latest
		if v.LastTsNs > agg.LastTsNs {
			agg.LastTsNs = v.LastTsNs
			// Carry metadata from the CPU with the most recent activity
			agg.LastLatUs = v.LastLatUs
			agg.LastPid = v.LastPid
			agg.LastTask = v.LastTask
			agg.LastSAddr = v.LastSAddr
			agg.LastDAddr = v.LastDAddr
			agg.LastSPort = v.LastSPort
			agg.LastDPort = v.LastDPort
			agg.LastProtocol = v.LastProtocol
			agg.LastIsIPv6 = v.LastIsIPv6
		}
	}
	return agg
}

// ==================== Metrics Message (JSON output) ====================

// MetricsMessage represents a single JSON message sent over WebSocket.
// Uses omitempty to produce Type A (LAT), Type B (PPS), or Type C (DROP) shapes.
type MetricsMessage struct {
	// PPS (Type B)
	Layer string `json:"layer,omitempty"`

	// LAT (Type A)
	Crosslayer string `json:"crosslayer,omitempty"`

	// Common
	Direction string `json:"direction,omitempty"`
	Type      string `json:"type"`
	PID       int    `json:"pid"`
	PIDName   string `json:"pid_name,omitempty"`
	SAddr     string `json:"saddr"`
	DAddr     string `json:"daddr"`
	SPort     int    `json:"sport"`
	DPort     int    `json:"dport"`

	// PPS fields
	Num *int `json:"num,omitempty"`
	PPS *int `json:"pps(s),omitempty"`

	// LAT fields
	LAT       *float64 `json:"LAT(ms),omitempty"`
	Frequency *int     `json:"frequency(s),omitempty"`

	// DROP fields
	Drop *int `json:"drop(s),omitempty"`
}

// FilterContext carries the user-provided filter parameters for inclusion in output.
type FilterContext struct {
	SAddr string
	DAddr string
	SPort int
	DPort int
}

// ==================== Message Builder ====================

func intPtr(v int) *int             { return &v }
func float64Ptr(v float64) *float64 { return &v }

func taskString(task [16]byte) string {
	n := 0
	for n < len(task) && task[n] != 0 {
		n++
	}
	s := string(task[:n])
	if s == "" {
		return "NULL"
	}
	return s
}

// BuildMessage constructs a MetricsMessage from a decoded slot and aggregated value.
// intervalSec is the collection period (typically 1.0 second).
func BuildMessage(slot SlotMeta, agg AggVal, intervalSec float64, ctx *FilterContext) MetricsMessage {
	if intervalSec <= 0 {
		intervalSec = 1.0
	}

	// Determine addresses: prefer BPF last-seen data; fall back to filter context
	isV6 := agg.LastIsIPv6 != 0
	sAddr := FormatAddr(agg.LastSAddr, isV6)
	dAddr := FormatAddr(agg.LastDAddr, isV6)
	sPort := int(agg.LastSPort)
	dPort := int(agg.LastDPort)

	// Fallback to filter context when BPF has no data (zero-value heartbeat)
	if sAddr == "" && ctx.SAddr != "" {
		sAddr = ctx.SAddr
	}
	if dAddr == "" && ctx.DAddr != "" {
		dAddr = ctx.DAddr
	}
	if sPort == 0 && ctx.SPort != 0 {
		sPort = ctx.SPort
	}
	if dPort == 0 && ctx.DPort != 0 {
		dPort = ctx.DPort
	}

	// RX and DROP messages swap src/dst to show "from peer's perspective"
	if slot.Direction == DirRX || slot.MetricType == MetricDROP {
		sAddr, dAddr = dAddr, sAddr
		sPort, dPort = dPort, sPort
	}

	msg := MetricsMessage{
		Type:    IPTypeName(slot.IsIPv6),
		PID:     int(agg.LastPid),
		PIDName: taskString(agg.LastTask),
		SAddr:   sAddr,
		DAddr:   dAddr,
		SPort:   sPort,
		DPort:   dPort,
	}

	switch slot.MetricType {
	case MetricPPS:
		msg.Layer = LayerName(slot.Layer)
		msg.Direction = DirectionName(slot.Direction)
		num := int(agg.Packets)
		pps := int(float64(agg.Packets) / intervalSec)
		msg.Num = &num
		msg.PPS = &pps

	case MetricLAT:
		msg.Crosslayer = CrosslayerName(slot.Layer)
		msg.Direction = DirectionName(slot.Direction)
		lat := float64(agg.LastLatUs) / 1000.0 // us → ms
		freq := int(float64(agg.Packets) / intervalSec)
		msg.LAT = &lat
		msg.Frequency = &freq

	case MetricDROP:
		drop := int(float64(agg.Packets) / intervalSec)
		msg.Drop = &drop
		// DROP messages have no direction/layer/crosslayer
	}

	return msg
}

// ==================== AggMap Interface ====================

// AggMapReader abstracts reading from a BPF_MAP_TYPE_PERCPU_ARRAY.
type AggMapReader interface {
	LookupPerCPU(key uint32) ([]AggVal, error)
	ResetKey(key uint32) error
}

// ==================== Collector ====================

// Collector reads all 26 aggregation slots and produces MetricsMessages.
type Collector struct {
	aggMap AggMapReader
	ctx    *FilterContext
}

// NewCollector creates a Collector bound to an AggMap and filter context.
func NewCollector(aggMap AggMapReader, ctx *FilterContext) *Collector {
	return &Collector{aggMap: aggMap, ctx: ctx}
}

// UpdateContext replaces the current filter context (e.g., when a new WS request arrives).
func (c *Collector) UpdateContext(ctx *FilterContext) {
	c.ctx = ctx
}

// FlushAll resets all 26 aggregation slots without reading them.
// Call this immediately after updating the BPF filter so that packets accumulated
// under the previous filter do not pollute the first tick of the new filter.
func (c *Collector) FlushAll() {
	if c.aggMap == nil {
		return
	}
	for idx := uint32(0); idx < AggMax; idx++ {
		c.aggMap.ResetKey(idx)
	}
}

// CollectAll reads all 26 slots, sums per-CPU values, builds messages, then resets.
// Always returns exactly AggMax messages (heartbeat when values are zero).
func (c *Collector) CollectAll(intervalSec float64) []MetricsMessage {
	if c.aggMap == nil {
		return []MetricsMessage{}
	}
	msgs := make([]MetricsMessage, 0, AggMax)
	for idx := uint32(0); idx < AggMax; idx++ {
		vals, err := c.aggMap.LookupPerCPU(idx)
		if err != nil {
			// On error, emit a zero-value message
			slot := DecodeSlot(idx)
			msgs = append(msgs, BuildMessage(slot, AggVal{}, intervalSec, c.ctx))
			continue
		}

		agg := SumPerCPU(vals)
		slot := DecodeSlot(idx)
		msgs = append(msgs, BuildMessage(slot, agg, intervalSec, c.ctx))

		// Reset the slot for the next period
		c.aggMap.ResetKey(idx)
	}

	return msgs
}
