package test

import (
	"fmt"
	"testing"

	"github.com/packetscope/metrics/pkg/aggregation"
)

// ==================== Slot Index Encoding ====================

func TestAggIdx(t *testing.T) {
	tests := []struct {
		name                     string
		metric, layer, dir, ipv6 int
		want                     uint32
	}{
		{"PPS/link/RX/v4", aggregation.MetricPPS, aggregation.LayerLink, aggregation.DirRX, 0, 0},
		{"PPS/link/RX/v6", aggregation.MetricPPS, aggregation.LayerLink, aggregation.DirRX, 1, 1},
		{"PPS/link/TX/v4", aggregation.MetricPPS, aggregation.LayerLink, aggregation.DirTX, 0, 2},
		{"PPS/link/TX/v6", aggregation.MetricPPS, aggregation.LayerLink, aggregation.DirTX, 1, 3},
		{"PPS/network/RX/v4", aggregation.MetricPPS, aggregation.LayerNetwork, aggregation.DirRX, 0, 4},
		{"PPS/trans/TX/v6", aggregation.MetricPPS, aggregation.LayerTrans, aggregation.DirTX, 1, 11},
		{"LAT/linknet/RX/v4", aggregation.MetricLAT, aggregation.CrosslayerLinkNetwork, aggregation.DirRX, 0, 12},
		{"LAT/nettrans/TX/v6", aggregation.MetricLAT, aggregation.CrosslayerNetworkTrans, aggregation.DirTX, 1, 19},
		{"LAT/linktrans/RX/v4", aggregation.MetricLAT, aggregation.CrosslayerLinkTrans, aggregation.DirRX, 0, 20},
		{"LAT/linktrans/TX/v6", aggregation.MetricLAT, aggregation.CrosslayerLinkTrans, aggregation.DirTX, 1, 23},
		{"DROP/v4", aggregation.MetricDROP, 0, 0, 0, 24},
		{"DROP/v6", aggregation.MetricDROP, 0, 0, 1, 25},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := aggregation.AggIdx(tt.metric, tt.layer, tt.dir, tt.ipv6)
			if got != tt.want {
				t.Errorf("AggIdx(%d,%d,%d,%d) = %d, want %d",
					tt.metric, tt.layer, tt.dir, tt.ipv6, got, tt.want)
			}
		})
	}
}

// ==================== Slot Decoding ====================

func TestDecodeSlot_Roundtrip(t *testing.T) {
	for _, mt := range []int{aggregation.MetricPPS, aggregation.MetricLAT} {
		for layer := 0; layer < 3; layer++ {
			for dir := 0; dir < 2; dir++ {
				for ipv6 := 0; ipv6 < 2; ipv6++ {
					idx := aggregation.AggIdx(mt, layer, dir, ipv6)
					got := aggregation.DecodeSlot(idx)
					if got.MetricType != mt || got.Layer != layer ||
						got.Direction != dir || got.IsIPv6 != ipv6 {
						t.Errorf("DecodeSlot(%d): got %+v, want metric=%d layer=%d dir=%d ipv6=%d",
							idx, got, mt, layer, dir, ipv6)
					}
				}
			}
		}
	}
	for ipv6 := 0; ipv6 < 2; ipv6++ {
		idx := aggregation.AggIdx(aggregation.MetricDROP, 0, 0, ipv6)
		got := aggregation.DecodeSlot(idx)
		if got.MetricType != aggregation.MetricDROP || got.IsIPv6 != ipv6 {
			t.Errorf("DecodeSlot DROP(%d): got %+v", idx, got)
		}
	}
}

// ==================== SumPerCPU ====================

func TestSumPerCPU(t *testing.T) {
	vals := []aggregation.AggVal{
		{Packets: 100, FirstTsNs: 1000, LastTsNs: 5000, LastLatUs: 50, LastPid: 1},
		{Packets: 200, FirstTsNs: 900, LastTsNs: 6000, LastLatUs: 60, LastPid: 2},
		{Packets: 0, FirstTsNs: 0, LastTsNs: 0, LastLatUs: 0, LastPid: 0},
	}
	sum := aggregation.SumPerCPU(vals)
	if sum.Packets != 300 {
		t.Errorf("Packets = %d, want 300", sum.Packets)
	}
	if sum.FirstTsNs != 900 {
		t.Errorf("FirstTsNs = %d, want 900", sum.FirstTsNs)
	}
	if sum.LastTsNs != 6000 {
		t.Errorf("LastTsNs = %d, want 6000", sum.LastTsNs)
	}
	if sum.LastLatUs != 60 {
		t.Errorf("LastLatUs = %d, want 60", sum.LastLatUs)
	}
	if sum.LastPid != 2 {
		t.Errorf("LastPid = %d, want 2", sum.LastPid)
	}
}

func TestSumPerCPU_AllZeros(t *testing.T) {
	vals := make([]aggregation.AggVal, 4)
	sum := aggregation.SumPerCPU(vals)
	if sum.Packets != 0 {
		t.Errorf("Packets = %d, want 0", sum.Packets)
	}
}

func TestSumPerCPU_SingleCPU(t *testing.T) {
	vals := []aggregation.AggVal{
		{Packets: 42, FirstTsNs: 100, LastTsNs: 200, LastLatUs: 10, LastPid: 7},
	}
	sum := aggregation.SumPerCPU(vals)
	if sum.Packets != 42 || sum.LastPid != 7 {
		t.Errorf("unexpected: %+v", sum)
	}
}

// ==================== BuildMessage ====================

func TestBuildMessage_PPS(t *testing.T) {
	ctx := &aggregation.FilterContext{
		SAddr: "192.168.1.1", DAddr: "10.0.0.1",
		SPort: 80, DPort: 443,
	}
	slot := aggregation.SlotMeta{
		MetricType: aggregation.MetricPPS,
		Layer:      aggregation.LayerLink,
		Direction:  aggregation.DirRX,
		IsIPv6:     0,
	}
	agg := aggregation.AggVal{Packets: 1000, LastPid: 42}
	msg := aggregation.BuildMessage(slot, agg, 1.0, ctx)

	if msg.Layer != "link" {
		t.Errorf("Layer = %q, want link", msg.Layer)
	}
	if msg.Direction != "receive" {
		t.Errorf("Direction = %q, want receive", msg.Direction)
	}
	if msg.Type != "ipv4" {
		t.Errorf("Type = %q, want ipv4", msg.Type)
	}
	if msg.Num == nil || *msg.Num != 1000 {
		t.Errorf("Num = %v, want 1000", msg.Num)
	}
	if msg.PPS == nil || *msg.PPS != 1000 {
		t.Errorf("PPS = %v, want 1000", msg.PPS)
	}
	// RX direction should swap addresses
	if msg.SAddr != "10.0.0.1" || msg.DAddr != "192.168.1.1" {
		t.Errorf("RX addrs not swapped: SAddr=%s DAddr=%s, want 10.0.0.1->192.168.1.1", msg.SAddr, msg.DAddr)
	}
	if msg.SPort != 443 || msg.DPort != 80 {
		t.Errorf("RX ports not swapped: %d->%d, want 443->80", msg.SPort, msg.DPort)
	}
	if msg.PID != 42 {
		t.Errorf("PID = %d, want 42", msg.PID)
	}
	if msg.Crosslayer != "" || msg.LAT != nil || msg.Drop != nil {
		t.Error("PPS message should not have crosslayer/LAT/drop fields")
	}
}

func TestBuildMessage_PPS_TX_NoSwap(t *testing.T) {
	ctx := &aggregation.FilterContext{SAddr: "192.168.1.1", DAddr: "10.0.0.1", SPort: 80, DPort: 443}
	slot := aggregation.SlotMeta{
		MetricType: aggregation.MetricPPS, Layer: aggregation.LayerLink,
		Direction: aggregation.DirTX, IsIPv6: 0,
	}
	msg := aggregation.BuildMessage(slot, aggregation.AggVal{Packets: 100}, 1.0, ctx)
	// TX should NOT swap addresses
	if msg.SAddr != "192.168.1.1" || msg.DAddr != "10.0.0.1" {
		t.Errorf("TX addrs should not swap: SAddr=%s DAddr=%s", msg.SAddr, msg.DAddr)
	}
	if msg.SPort != 80 || msg.DPort != 443 {
		t.Errorf("TX ports should not swap: %d->%d", msg.SPort, msg.DPort)
	}
	if msg.Direction != "send" {
		t.Errorf("Direction = %q, want send", msg.Direction)
	}
}

func TestBuildMessage_PPS_IPv6(t *testing.T) {
	ctx := &aggregation.FilterContext{SAddr: "::1", DAddr: "fe80::1", SPort: 80, DPort: 443}
	slot := aggregation.SlotMeta{
		MetricType: aggregation.MetricPPS, Layer: aggregation.LayerNetwork,
		Direction: aggregation.DirTX, IsIPv6: 1,
	}
	msg := aggregation.BuildMessage(slot, aggregation.AggVal{Packets: 50}, 2.0, ctx)
	if msg.Type != "ipv6" {
		t.Errorf("Type = %q, want ipv6", msg.Type)
	}
	if msg.PPS == nil || *msg.PPS != 25 {
		t.Errorf("PPS = %v, want 25", msg.PPS)
	}
}

func TestBuildMessage_LAT(t *testing.T) {
	ctx := &aggregation.FilterContext{
		SAddr: "10.0.0.1", DAddr: "10.0.0.2",
		SPort: 8080, DPort: 9090,
	}
	slot := aggregation.SlotMeta{
		MetricType: aggregation.MetricLAT,
		Layer:      aggregation.CrosslayerLinkNetwork,
		Direction:  aggregation.DirTX,
		IsIPv6:     0,
	}
	agg := aggregation.AggVal{Packets: 500, LastLatUs: 1500}
	msg := aggregation.BuildMessage(slot, agg, 1.0, ctx)

	if msg.Crosslayer != "linknetwork" {
		t.Errorf("Crosslayer = %q, want linknetwork", msg.Crosslayer)
	}
	if msg.Direction != "send" {
		t.Errorf("Direction = %q, want send", msg.Direction)
	}
	if msg.LAT == nil || *msg.LAT != 1.5 {
		t.Errorf("LAT = %v, want 1.5", msg.LAT)
	}
	if msg.Frequency == nil || *msg.Frequency != 500 {
		t.Errorf("Frequency = %v, want 500", msg.Frequency)
	}
	if msg.Layer != "" || msg.Num != nil || msg.Drop != nil {
		t.Error("LAT message should not have layer/num/drop fields")
	}
}

func TestBuildMessage_Drop(t *testing.T) {
	ctx := &aggregation.FilterContext{
		SAddr: "1.1.1.1", DAddr: "2.2.2.2", SPort: 80, DPort: 443,
	}
	slot := aggregation.SlotMeta{MetricType: aggregation.MetricDROP, IsIPv6: 1}
	agg := aggregation.AggVal{Packets: 5}
	msg := aggregation.BuildMessage(slot, agg, 1.0, ctx)

	if msg.Type != "ipv6" {
		t.Errorf("Type = %q, want ipv6", msg.Type)
	}
	if msg.Drop == nil || *msg.Drop != 5 {
		t.Errorf("Drop = %v, want 5 (rate=packets/interval)", msg.Drop)
	}
	if msg.Direction != "" || msg.Layer != "" || msg.Crosslayer != "" {
		t.Error("DROP message should not have direction/layer/crosslayer")
	}
	// DROP should swap addresses (same as RX direction)
	if msg.SAddr != "2.2.2.2" || msg.DAddr != "1.1.1.1" {
		t.Errorf("DROP addrs not swapped: SAddr=%s DAddr=%s, want 2.2.2.2->1.1.1.1", msg.SAddr, msg.DAddr)
	}
	if msg.SPort != 443 || msg.DPort != 80 {
		t.Errorf("DROP ports not swapped: %d->%d, want 443->80", msg.SPort, msg.DPort)
	}
}

func TestBuildMessage_Drop_Rate(t *testing.T) {
	ctx := &aggregation.FilterContext{SAddr: "1.1.1.1", DAddr: "2.2.2.2", SPort: 80, DPort: 443}
	slot := aggregation.SlotMeta{MetricType: aggregation.MetricDROP, IsIPv6: 0}
	agg := aggregation.AggVal{Packets: 10}
	msg := aggregation.BuildMessage(slot, agg, 2.0, ctx)
	if msg.Drop == nil || *msg.Drop != 5 {
		t.Errorf("Drop rate = %v, want 5 (10 packets / 2s)", msg.Drop)
	}
}

func TestBuildMessage_ZeroInterval(t *testing.T) {
	ctx := &aggregation.FilterContext{}
	slot := aggregation.SlotMeta{MetricType: aggregation.MetricPPS, Layer: 0, Direction: 0, IsIPv6: 0}
	agg := aggregation.AggVal{Packets: 100}
	msg := aggregation.BuildMessage(slot, agg, 0, ctx)
	if msg.PPS == nil || *msg.PPS != 100 {
		t.Errorf("PPS with zero interval = %v, want 100", msg.PPS)
	}
}

// ==================== Mock AggMapReader ====================

type mockAggMap struct {
	data map[uint32][]aggregation.AggVal
}

func newMockAggMap(numCPUs int) *mockAggMap {
	m := &mockAggMap{data: make(map[uint32][]aggregation.AggVal)}
	for i := uint32(0); i < aggregation.AggMax; i++ {
		m.data[i] = make([]aggregation.AggVal, numCPUs)
	}
	return m
}

func (m *mockAggMap) LookupPerCPU(key uint32) ([]aggregation.AggVal, error) {
	vals, ok := m.data[key]
	if !ok {
		return nil, fmt.Errorf("key %d not found", key)
	}
	ret := make([]aggregation.AggVal, len(vals))
	copy(ret, vals)
	return ret, nil
}

func (m *mockAggMap) ResetKey(key uint32) error {
	if vals, ok := m.data[key]; ok {
		for i := range vals {
			vals[i] = aggregation.AggVal{}
		}
	}
	return nil
}

// ==================== Collector Integration ====================

func TestCollectorCollectAll_Heartbeat(t *testing.T) {
	mock := newMockAggMap(2)
	ctx := &aggregation.FilterContext{
		SAddr: "1.2.3.4", DAddr: "5.6.7.8", SPort: 80, DPort: 443,
	}
	c := aggregation.NewCollector(mock, ctx)
	msgs := c.CollectAll(1.0)
	if len(msgs) != int(aggregation.AggMax) {
		t.Fatalf("expected %d messages (heartbeat), got %d", aggregation.AggMax, len(msgs))
	}
	for i, m := range msgs {
		if m.Num != nil && *m.Num != 0 {
			t.Errorf("slot %d: num = %d, want 0", i, *m.Num)
		}
		if m.PPS != nil && *m.PPS != 0 {
			t.Errorf("slot %d: pps = %d, want 0", i, *m.PPS)
		}
		if m.LAT != nil && *m.LAT != 0 {
			t.Errorf("slot %d: lat = %f, want 0", i, *m.LAT)
		}
		if m.Frequency != nil && *m.Frequency != 0 {
			t.Errorf("slot %d: freq = %d, want 0", i, *m.Frequency)
		}
		if m.Drop != nil && *m.Drop != 0 {
			t.Errorf("slot %d: drop = %d, want 0", i, *m.Drop)
		}
	}
}

func TestCollectorCollectAll_WithData(t *testing.T) {
	mock := newMockAggMap(2)
	ctx := &aggregation.FilterContext{
		SAddr: "10.0.0.1", DAddr: "10.0.0.2", SPort: 80, DPort: 443,
	}

	idx := aggregation.AggIdx(aggregation.MetricPPS, aggregation.LayerLink, aggregation.DirRX, 0)
	mock.data[idx][0] = aggregation.AggVal{Packets: 300, LastPid: 42}
	mock.data[idx][1] = aggregation.AggVal{Packets: 200, LastPid: 43}

	latIdx := aggregation.AggIdx(aggregation.MetricLAT, aggregation.CrosslayerLinkNetwork, aggregation.DirRX, 0)
	mock.data[latIdx][0] = aggregation.AggVal{Packets: 500, LastLatUs: 2000, LastTsNs: 1000}

	c := aggregation.NewCollector(mock, ctx)
	msgs := c.CollectAll(1.0)

	if len(msgs) != int(aggregation.AggMax) {
		t.Fatalf("expected %d messages, got %d", aggregation.AggMax, len(msgs))
	}

	foundPPS := false
	for _, m := range msgs {
		if m.Layer == "link" && m.Direction == "receive" && m.Type == "ipv4" {
			if m.Num == nil || *m.Num != 500 {
				t.Errorf("PPS Num = %v, want 500", m.Num)
			}
			if m.PPS == nil || *m.PPS != 500 {
				t.Errorf("PPS = %v, want 500", m.PPS)
			}
			foundPPS = true
		}
	}
	if !foundPPS {
		t.Error("PPS/link/RX/IPv4 message not found")
	}

	foundLAT := false
	for _, m := range msgs {
		if m.Crosslayer == "linknetwork" && m.Direction == "receive" && m.Type == "ipv4" {
			if m.LAT == nil || *m.LAT != 2.0 {
				t.Errorf("LAT = %v, want 2.0", m.LAT)
			}
			if m.Frequency == nil || *m.Frequency != 500 {
				t.Errorf("Frequency = %v, want 500", m.Frequency)
			}
			foundLAT = true
		}
	}
	if !foundLAT {
		t.Error("LAT/linknetwork/RX/IPv4 message not found")
	}
}

func TestCollectorResetsAfterCollect(t *testing.T) {
	mock := newMockAggMap(1)
	ctx := &aggregation.FilterContext{}
	idx := aggregation.AggIdx(aggregation.MetricPPS, aggregation.LayerLink, aggregation.DirRX, 0)
	mock.data[idx][0] = aggregation.AggVal{Packets: 100}
	c := aggregation.NewCollector(mock, ctx)
	c.CollectAll(1.0)
	if mock.data[idx][0].Packets != 0 {
		t.Error("Expected slot to be reset after collection")
	}
}

func TestCollectorCollectAll_HighPPS(t *testing.T) {
	mock := newMockAggMap(8)
	ctx := &aggregation.FilterContext{SAddr: "1.1.1.1", DAddr: "2.2.2.2"}
	idx := aggregation.AggIdx(aggregation.MetricPPS, aggregation.LayerLink, aggregation.DirRX, 0)
	for i := 0; i < 8; i++ {
		mock.data[idx][i] = aggregation.AggVal{Packets: 125000}
	}
	c := aggregation.NewCollector(mock, ctx)
	msgs := c.CollectAll(1.0)
	found := false
	for _, m := range msgs {
		if m.Layer == "link" && m.Direction == "receive" && m.Type == "ipv4" {
			found = true
			if m.Num == nil || *m.Num != 1000000 {
				t.Errorf("High PPS Num = %v, want 1000000", m.Num)
			}
			if m.PPS == nil || *m.PPS != 1000000 {
				t.Errorf("High PPS = %v, want 1000000", m.PPS)
			}
		}
	}
	if !found {
		t.Error("PPS/link/RX/IPv4 message not found in HighPPS test")
	}
}

// ==================== Name Mapping ====================

func TestLayerName(t *testing.T) {
	tests := []struct {
		layer int
		want  string
	}{
		{aggregation.LayerLink, "link"},
		{aggregation.LayerNetwork, "network"},
		{aggregation.LayerTrans, "trans"},
	}
	for _, tt := range tests {
		got := aggregation.LayerName(tt.layer)
		if got != tt.want {
			t.Errorf("LayerName(%d) = %q, want %q", tt.layer, got, tt.want)
		}
	}
}

func TestCrosslayerName(t *testing.T) {
	tests := []struct {
		cl   int
		want string
	}{
		{aggregation.CrosslayerLinkNetwork, "linknetwork"},
		{aggregation.CrosslayerNetworkTrans, "networktrans"},
		{aggregation.CrosslayerLinkTrans, "linktrans"},
	}
	for _, tt := range tests {
		got := aggregation.CrosslayerName(tt.cl)
		if got != tt.want {
			t.Errorf("CrosslayerName(%d) = %q, want %q", tt.cl, got, tt.want)
		}
	}
}

func TestDirectionName(t *testing.T) {
	if aggregation.DirectionName(aggregation.DirRX) != "receive" {
		t.Error("DirRX should be receive")
	}
	if aggregation.DirectionName(aggregation.DirTX) != "send" {
		t.Error("DirTX should be send")
	}
}

func TestIPTypeName(t *testing.T) {
	if aggregation.IPTypeName(0) != "ipv4" {
		t.Error("0 should be ipv4")
	}
	if aggregation.IPTypeName(1) != "ipv6" {
		t.Error("1 should be ipv6")
	}
}

// ==================== FormatAddr ====================

func TestFormatAddr_IPv4(t *testing.T) {
	// 192.168.1.100 in little-endian (x86)
	var raw [16]byte
	raw[0] = 192
	raw[1] = 168
	raw[2] = 1
	raw[3] = 100
	got := aggregation.FormatAddr(raw, false)
	if got != "192.168.1.100" {
		t.Errorf("FormatAddr IPv4 = %q, want 192.168.1.100", got)
	}
}

func TestFormatAddr_IPv4_Zero(t *testing.T) {
	var raw [16]byte
	got := aggregation.FormatAddr(raw, false)
	if got != "" {
		t.Errorf("FormatAddr IPv4 zero = %q, want empty", got)
	}
}

func TestFormatAddr_IPv6(t *testing.T) {
	// ::1
	var raw [16]byte
	raw[15] = 1
	got := aggregation.FormatAddr(raw, true)
	if got != "::1" {
		t.Errorf("FormatAddr IPv6 = %q, want ::1", got)
	}
}

func TestFormatAddr_IPv6_Zero(t *testing.T) {
	var raw [16]byte
	got := aggregation.FormatAddr(raw, true)
	if got != "" {
		t.Errorf("FormatAddr IPv6 zero = %q, want empty", got)
	}
}

// ==================== BuildMessage with BPF five-tuple ====================

func TestBuildMessage_BPF_FiveTuple_TX(t *testing.T) {
	ctx := &aggregation.FilterContext{SAddr: "1.1.1.1", DAddr: "2.2.2.2", SPort: 80, DPort: 443}
	slot := aggregation.SlotMeta{
		MetricType: aggregation.MetricPPS, Layer: aggregation.LayerLink,
		Direction: aggregation.DirTX, IsIPv6: 0,
	}
	var saddr, daddr [16]byte
	saddr[0], saddr[1], saddr[2], saddr[3] = 10, 0, 0, 1
	daddr[0], daddr[1], daddr[2], daddr[3] = 10, 0, 0, 2
	agg := aggregation.AggVal{
		Packets:    500,
		LastTsNs:   1000,
		LastSAddr:  saddr,
		LastDAddr:  daddr,
		LastSPort:  8080,
		LastDPort:  9090,
		LastIsIPv6: 0,
	}
	msg := aggregation.BuildMessage(slot, agg, 1.0, ctx)
	// TX: no swap, should use BPF data (10.0.0.1 / 10.0.0.2), not filter ctx
	if msg.SAddr != "10.0.0.1" {
		t.Errorf("SAddr = %q, want 10.0.0.1", msg.SAddr)
	}
	if msg.DAddr != "10.0.0.2" {
		t.Errorf("DAddr = %q, want 10.0.0.2", msg.DAddr)
	}
	if msg.SPort != 8080 {
		t.Errorf("SPort = %d, want 8080", msg.SPort)
	}
	if msg.DPort != 9090 {
		t.Errorf("DPort = %d, want 9090", msg.DPort)
	}
}

func TestBuildMessage_BPF_FiveTuple_RX_Swap(t *testing.T) {
	ctx := &aggregation.FilterContext{}
	slot := aggregation.SlotMeta{
		MetricType: aggregation.MetricPPS, Layer: aggregation.LayerLink,
		Direction: aggregation.DirRX, IsIPv6: 0,
	}
	var saddr, daddr [16]byte
	saddr[0], saddr[1], saddr[2], saddr[3] = 10, 0, 0, 1
	daddr[0], daddr[1], daddr[2], daddr[3] = 10, 0, 0, 2
	agg := aggregation.AggVal{
		Packets:    100,
		LastTsNs:   1000,
		LastSAddr:  saddr,
		LastDAddr:  daddr,
		LastSPort:  8080,
		LastDPort:  9090,
		LastIsIPv6: 0,
	}
	msg := aggregation.BuildMessage(slot, agg, 1.0, ctx)
	// RX: should swap → SAddr=10.0.0.2 (was daddr), DAddr=10.0.0.1 (was saddr)
	if msg.SAddr != "10.0.0.2" {
		t.Errorf("RX SAddr = %q, want 10.0.0.2 (swapped from daddr)", msg.SAddr)
	}
	if msg.DAddr != "10.0.0.1" {
		t.Errorf("RX DAddr = %q, want 10.0.0.1 (swapped from saddr)", msg.DAddr)
	}
	if msg.SPort != 9090 {
		t.Errorf("RX SPort = %d, want 9090 (swapped)", msg.SPort)
	}
	if msg.DPort != 8080 {
		t.Errorf("RX DPort = %d, want 8080 (swapped)", msg.DPort)
	}
}

func TestBuildMessage_Heartbeat_FallbackToContext(t *testing.T) {
	ctx := &aggregation.FilterContext{SAddr: "1.1.1.1", DAddr: "2.2.2.2", SPort: 80, DPort: 443}
	slot := aggregation.SlotMeta{
		MetricType: aggregation.MetricPPS, Layer: aggregation.LayerLink,
		Direction: aggregation.DirTX, IsIPv6: 0,
	}
	// Zero AggVal — heartbeat, no BPF data
	msg := aggregation.BuildMessage(slot, aggregation.AggVal{}, 1.0, ctx)
	// Should fall back to filter context
	if msg.SAddr != "1.1.1.1" {
		t.Errorf("Heartbeat SAddr = %q, want 1.1.1.1 (from context)", msg.SAddr)
	}
	if msg.DAddr != "2.2.2.2" {
		t.Errorf("Heartbeat DAddr = %q, want 2.2.2.2 (from context)", msg.DAddr)
	}
}
