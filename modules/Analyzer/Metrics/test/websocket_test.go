package test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
	"github.com/packetscope/metrics/pkg/aggregation"
	"github.com/packetscope/metrics/pkg/server"
)

// --- Mock Engine ---

type mockEngine struct {
	lastIPv4Filter struct {
		sip, dip     uint32
		sport, dport uint16
		protocol     uint8
	}
	lastIPv6Filter struct {
		sip, dip     [16]byte
		sport, dport uint16
		protocol     uint8
	}
	ipv4Called bool
	ipv6Called bool
}

func (m *mockEngine) UpdateIPv4Filter(sip, dip uint32, sport, dport uint16, protocol uint8) error {
	m.ipv4Called = true
	m.lastIPv4Filter.sip = sip
	m.lastIPv4Filter.dip = dip
	m.lastIPv4Filter.sport = sport
	m.lastIPv4Filter.dport = dport
	m.lastIPv4Filter.protocol = protocol
	return nil
}

func (m *mockEngine) UpdateIPv6Filter(sip, dip [16]byte, sport, dport uint16, protocol uint8) error {
	m.ipv6Called = true
	m.lastIPv6Filter.sip = sip
	m.lastIPv6Filter.dip = dip
	m.lastIPv6Filter.sport = sport
	m.lastIPv6Filter.dport = dport
	m.lastIPv6Filter.protocol = protocol
	return nil
}

// --- ParseParams Tests ---

func TestParseParams_ValidIPv4(t *testing.T) {
	params := map[string]interface{}{
		"ipv4_flag": "true",
		"ipv6_flag": "false",
		"sip":       "192.168.1.1",
		"dip":       "10.0.0.1",
		"sport":     float64(8080),
		"dport":     "443",
		"protocol":  "tcp",
	}

	p, errs := server.ParseParams(params)
	if len(errs) > 0 {
		t.Fatalf("Expected no errors, got %v", errs)
	}
	if !p.IPv4 {
		t.Error("IPv4 should be true")
	}
	if p.IPv6 {
		t.Error("IPv6 should be false")
	}
	if p.SIP != "192.168.1.1" {
		t.Errorf("SIP=%s, want 192.168.1.1", p.SIP)
	}
	if p.SPort != 8080 {
		t.Errorf("SPort=%d, want 8080", p.SPort)
	}
	if p.DPort != 443 {
		t.Errorf("DPort=%d, want 443", p.DPort)
	}
	if p.Protocol != "tcp" {
		t.Errorf("Protocol=%s, want tcp", p.Protocol)
	}
}

func TestParseParams_MissingFields(t *testing.T) {
	params := map[string]interface{}{
		"sip": "1.2.3.4",
	}
	_, errs := server.ParseParams(params)
	if len(errs) == 0 {
		t.Fatal("Expected validation errors for missing params")
	}
}

func TestParseParams_InvalidPort(t *testing.T) {
	params := map[string]interface{}{
		"ipv4":     true,
		"ipv6":     false,
		"sip":      "",
		"dip":      "",
		"sport":    "not_a_port",
		"dport":    0,
		"protocol": "tcp",
	}
	_, errs := server.ParseParams(params)
	if len(errs) == 0 {
		t.Fatal("Expected error for invalid sport")
	}
}

func TestParseParams_BooleanAndStringFlags(t *testing.T) {
	// Test that both bool and string "true"/"false" work
	tests := []struct {
		name string
		val  interface{}
		want bool
	}{
		{"bool true", true, true},
		{"bool false", false, false},
		{"string true", "true", true},
		{"string false", "false", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			params := map[string]interface{}{
				"ipv4": tt.val, "ipv6": false,
				"sip": "", "dip": "", "sport": 0, "dport": 0, "protocol": "tcp",
			}
			p, errs := server.ParseParams(params)
			if len(errs) > 0 {
				t.Fatalf("Unexpected errors: %v", errs)
			}
			if p.IPv4 != tt.want {
				t.Errorf("IPv4=%v, want %v", p.IPv4, tt.want)
			}
		})
	}
}

func TestParseParams_PortBoundary(t *testing.T) {
	tests := []struct {
		name    string
		sport   interface{}
		wantErr bool
	}{
		{"port 0", float64(0), false},
		{"port 65535", float64(65535), false},
		{"port 80 string", "80", false},
		{"port negative", float64(-1), true},
		{"port overflow", float64(65536), true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			params := map[string]interface{}{
				"ipv4": true, "ipv6": false,
				"sip": "", "dip": "", "sport": tt.sport, "dport": 0, "protocol": "tcp",
			}
			_, errs := server.ParseParams(params)
			if tt.wantErr && len(errs) == 0 {
				t.Error("Expected error")
			}
			if !tt.wantErr && len(errs) > 0 {
				t.Errorf("Unexpected errors: %v", errs)
			}
		})
	}
}

// --- WebSocket Handler Tests ---

func dialWS(t *testing.T, handler http.HandlerFunc) (*websocket.Conn, func()) {
	t.Helper()
	s := httptest.NewServer(handler)
	u := "ws" + strings.TrimPrefix(s.URL, "http")
	ws, _, err := websocket.DefaultDialer.Dial(u, nil)
	if err != nil {
		s.Close()
		t.Fatalf("dial: %v", err)
	}
	return ws, func() { ws.Close(); s.Close() }
}

func TestWsHandler_ValidRequest(t *testing.T) {
	m := &mockEngine{}
	ws, cleanup := dialWS(t, func(w http.ResponseWriter, r *http.Request) {
		server.WsHandler(w, r, m, nil)
	})
	defer cleanup()

	req := server.StreamRequest{
		Type: "NumLatencyFrequency",
		Params: map[string]interface{}{
			"ipv4": true, "ipv6": false,
			"sip": "127.0.0.1", "dip": "127.0.0.2",
			"sport": 1234, "dport": 5678, "protocol": "udp",
		},
	}
	reqBytes, _ := json.Marshal(req)
	if err := ws.WriteMessage(websocket.TextMessage, reqBytes); err != nil {
		t.Fatalf("write: %v", err)
	}

	_, msg, err := ws.ReadMessage()
	if err != nil {
		t.Fatalf("read: %v", err)
	}

	if !strings.Contains(string(msg), "NumLatencyFrequency") {
		t.Errorf("unexpected response: %s", msg)
	}
	if !m.ipv4Called {
		t.Error("IPv4 filter was not updated")
	}
}

func TestWsHandler_UnknownType(t *testing.T) {
	m := &mockEngine{}
	ws, cleanup := dialWS(t, func(w http.ResponseWriter, r *http.Request) {
		server.WsHandler(w, r, m, nil)
	})
	defer cleanup()

	req := `{"type":"UnknownCommand","params":{}}`
	ws.WriteMessage(websocket.TextMessage, []byte(req))

	_, msg, err := ws.ReadMessage()
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if !strings.Contains(string(msg), "Unknown stream type") {
		t.Errorf("expected error for unknown type, got: %s", msg)
	}
}

func TestWsHandler_InvalidJSON(t *testing.T) {
	m := &mockEngine{}
	ws, cleanup := dialWS(t, func(w http.ResponseWriter, r *http.Request) {
		server.WsHandler(w, r, m, nil)
	})
	defer cleanup()

	ws.WriteMessage(websocket.TextMessage, []byte("not json"))

	_, msg, _ := ws.ReadMessage()
	if !strings.Contains(string(msg), "Invalid JSON") {
		t.Errorf("expected Invalid JSON error, got: %s", msg)
	}
}

func TestWsHandler_MissingParams(t *testing.T) {
	m := &mockEngine{}
	ws, cleanup := dialWS(t, func(w http.ResponseWriter, r *http.Request) {
		server.WsHandler(w, r, m, nil)
	})
	defer cleanup()

	req := `{"type":"NumLatencyFrequency","params":{"sip":"1.2.3.4"}}`
	ws.WriteMessage(websocket.TextMessage, []byte(req))

	_, msg, _ := ws.ReadMessage()
	if !strings.Contains(string(msg), "Validation failed") {
		t.Errorf("expected validation error, got: %s", msg)
	}
}

func TestWsHandler_IPv6Request(t *testing.T) {
	m := &mockEngine{}
	ws, cleanup := dialWS(t, func(w http.ResponseWriter, r *http.Request) {
		server.WsHandler(w, r, m, nil)
	})
	defer cleanup()

	req := server.StreamRequest{
		Type: "NumLatencyFrequency",
		Params: map[string]interface{}{
			"ipv4": false, "ipv6": true,
			"sip": "::1", "dip": "fe80::1",
			"sport": 80, "dport": 443, "protocol": "tcp",
		},
	}
	reqBytes, _ := json.Marshal(req)
	ws.WriteMessage(websocket.TextMessage, reqBytes)

	_, msg, err := ws.ReadMessage()
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if !m.ipv6Called {
		t.Error("IPv6 filter was not updated")
	}
	if !strings.Contains(string(msg), "NumLatencyFrequency") {
		t.Errorf("unexpected: %s", msg)
	}
}

// ==================== ICMPv6 Protocol Tests ====================

func TestParseParams_ICMPv4(t *testing.T) {
	params := map[string]interface{}{
		"ipv4": true, "ipv6": false,
		"sip": "", "dip": "", "sport": 0, "dport": 0,
		"protocol": "icmp",
	}
	p, errs := server.ParseParams(params)
	if len(errs) > 0 {
		t.Fatalf("Unexpected errors: %v", errs)
	}
	if p.Protocol != "icmp" {
		t.Errorf("Protocol=%s, want icmp", p.Protocol)
	}
}

func TestWsHandler_ICMPv4Filter(t *testing.T) {
	m := &mockEngine{}
	ws, cleanup := dialWS(t, func(w http.ResponseWriter, r *http.Request) {
		server.WsHandler(w, r, m, nil)
	})
	defer cleanup()

	req := server.StreamRequest{
		Type: "NumLatencyFrequency",
		Params: map[string]interface{}{
			"ipv4": true, "ipv6": false,
			"sip": "1.2.3.4", "dip": "5.6.7.8",
			"sport": 0, "dport": 0, "protocol": "icmp",
		},
	}
	b, _ := json.Marshal(req)
	ws.WriteMessage(websocket.TextMessage, b)
	_, _, _ = ws.ReadMessage()

	if !m.ipv4Called {
		t.Fatal("IPv4 filter not called for ICMP")
	}
	if m.lastIPv4Filter.protocol != 1 {
		t.Errorf("ICMP proto = %d, want 1", m.lastIPv4Filter.protocol)
	}
}

func TestWsHandler_ICMPv6Filter(t *testing.T) {
	m := &mockEngine{}
	ws, cleanup := dialWS(t, func(w http.ResponseWriter, r *http.Request) {
		server.WsHandler(w, r, m, nil)
	})
	defer cleanup()

	req := server.StreamRequest{
		Type: "NumLatencyFrequency",
		Params: map[string]interface{}{
			"ipv4": false, "ipv6": true,
			"sip": "::1", "dip": "fe80::1",
			"sport": 0, "dport": 0, "protocol": "icmp",
		},
	}
	b, _ := json.Marshal(req)
	ws.WriteMessage(websocket.TextMessage, b)
	_, _, _ = ws.ReadMessage()

	if !m.ipv6Called {
		t.Fatal("IPv6 filter not called for ICMPv6")
	}
	if m.lastIPv6Filter.protocol != 58 {
		t.Errorf("ICMPv6 proto = %d, want 58", m.lastIPv6Filter.protocol)
	}
}

// ==================== WebSocket Output Push Test ====================

func TestWsHandler_AggregationPush(t *testing.T) {
	m := &mockEngine{}
	mock := newMockAggMap(2)

	// Seed one PPS slot with data
	idx := aggregation.AggIdx(aggregation.MetricPPS, aggregation.LayerLink, aggregation.DirRX, 0)

	ws, cleanup := dialWS(t, func(w http.ResponseWriter, r *http.Request) {
		server.WsHandler(w, r, m, mock)
	})
	defer cleanup()

	req := server.StreamRequest{
		Type: "NumLatencyFrequency",
		Params: map[string]interface{}{
			"ipv4": true, "ipv6": false,
			"sip": "10.0.0.1", "dip": "10.0.0.2",
			"sport": 80, "dport": 443, "protocol": "tcp",
		},
	}
	b, _ := json.Marshal(req)
	ws.WriteMessage(websocket.TextMessage, b)

	// First message should be the ack
	_, ackMsg, err := ws.ReadMessage()
	if err != nil {
		t.Fatalf("read ack: %v", err)
	}
	if !strings.Contains(string(ackMsg), "started") {
		t.Fatalf("expected ack, got: %s", ackMsg)
	}

	// Re-seed mock data because the background ticker might have cleared it while waiting
	idx = aggregation.AggIdx(aggregation.MetricPPS, aggregation.LayerLink, aggregation.DirRX, 0)
	mock.data[idx][0] = aggregation.AggVal{Packets: 42, LastPid: 7, LastTsNs: 1000}

	// Next messages should be the aggregation data (26 messages per tick)
	// Read up to 26 messages within a reasonable timeout
	received := 0
	foundPPS := false
	for i := 0; i < 13; i++ {
		_, msg, err := ws.ReadMessage()
		if err != nil {
			t.Fatalf("read aggregation msg %d: %v", i, err)
		}
		received++

		// Frontend does JSON.parse(response.data), so "data" must be a JSON string
		var wrapped struct {
			Type string `json:"type"`
			Data string `json:"data"` // must be a string, not object
		}
		if err := json.Unmarshal(msg, &wrapped); err != nil {
			t.Fatalf("unmarshal msg %d: %v", i, err)
		}
		if wrapped.Type != "NumLatencyFrequency" {
			t.Errorf("msg %d type = %q, want NumLatencyFrequency", i, wrapped.Type)
		}

		// Parse the nested JSON string
		var d aggregation.MetricsMessage
		if err := json.Unmarshal([]byte(wrapped.Data), &d); err != nil {
			t.Fatalf("msg %d: data is not valid JSON string: %v\nraw: %s", i, err, wrapped.Data)
		}

		if d.Layer == "link" && d.Direction == "receive" && d.Type == "ipv4" {
			if d.Num != nil && *d.Num == 42 {
				foundPPS = true
			} else {
				t.Logf("Found layer=%s dir=%s type=%s num=%v", d.Layer, d.Direction, d.Type, d.Num)
			}
		}
	}

	if received != 13 {
		t.Errorf("received %d messages, want 13", received)
	}
	if !foundPPS {
		t.Error("Did not find PPS/link/RX/IPv4 message with Num=42")
	}
}
