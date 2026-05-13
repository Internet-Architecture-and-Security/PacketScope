package server

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/packetscope/metrics/pkg/aggregation"
)

// FilterUpdater pushes five-tuple filter into BPF maps.
type FilterUpdater interface {
	UpdateIPv4Filter(sip, dip uint32, sport, dport uint16, protocol uint8) error
	UpdateIPv6Filter(sip, dip [16]byte, sport, dport uint16, protocol uint8) error
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// ==================== Request/Response Types ====================

type StreamRequest struct {
	Type   string                 `json:"type"`
	Params map[string]interface{} `json:"params"`
}

type ErrorResponse struct {
	Type    string   `json:"type"`
	Error   string   `json:"error"`
	Details []string `json:"details,omitempty"`
}

type MetricsParams struct {
	IPv4     bool   `json:"ipv4"`
	IPv6     bool   `json:"ipv6"`
	SIP      string `json:"sip"`
	DIP      string `json:"dip"`
	SPort    int    `json:"sport"`
	DPort    int    `json:"dport"`
	Protocol string `json:"protocol"`
}

// ==================== Param Parsing ====================

func ParseParams(params map[string]interface{}) (*MetricsParams, []string) {
	var errors []string
	p := &MetricsParams{}

	if val, ok := params["ipv4_flag"]; ok {
		params["ipv4"] = val
	}
	if val, ok := params["ipv6_flag"]; ok {
		params["ipv6"] = val
	}

	required := []string{"ipv4", "ipv6", "sip", "dip", "sport", "dport", "protocol"}
	for _, req := range required {
		if _, ok := params[req]; !ok {
			errors = append(errors, fmt.Sprintf("Missing parameter: %s", req))
		}
	}
	if len(errors) > 0 {
		return nil, errors
	}

	if v, ok := params["ipv4"].(bool); ok {
		p.IPv4 = v
	} else if v, ok := params["ipv4"].(string); ok {
		p.IPv4 = v == "true"
	}
	if v, ok := params["ipv6"].(bool); ok {
		p.IPv6 = v
	} else if v, ok := params["ipv6"].(string); ok {
		p.IPv6 = v == "true"
	}

	p.SIP, _ = params["sip"].(string)
	p.DIP, _ = params["dip"].(string)
	p.Protocol, _ = params["protocol"].(string)

	parsePort := func(k string) (int, bool) {
		switch v := params[k].(type) {
		case int:
			return v, true
		case float64:
			return int(v), true
		case string:
			var pr int
			if _, err := fmt.Sscanf(v, "%d", &pr); err == nil {
				return pr, true
			}
		}
		return 0, false
	}

	var ok bool
	if p.SPort, ok = parsePort("sport"); !ok || p.SPort < 0 || p.SPort > 65535 {
		errors = append(errors, fmt.Sprintf("Invalid value for sport: %v", params["sport"]))
	}
	if p.DPort, ok = parsePort("dport"); !ok || p.DPort < 0 || p.DPort > 65535 {
		errors = append(errors, fmt.Sprintf("Invalid value for dport: %v", params["dport"]))
	}
	if len(errors) > 0 {
		return nil, errors
	}
	return p, nil
}

// ==================== WebSocket Handler ====================

func WsHandler(w http.ResponseWriter, r *http.Request, engine FilterUpdater, aggMap aggregation.AggMapReader) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("upgrade:", err)
		return
	}
	defer c.Close()

	var (
		mu       sync.Mutex
		cancelFn context.CancelFunc
	)

	for {
		mt, message, err := c.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			break
		}

		var req StreamRequest
		if err := json.Unmarshal(message, &req); err != nil {
			c.WriteMessage(mt, []byte(`{"error": "Invalid JSON"}`))
			continue
		}

		if req.Type != "NumLatencyFrequency" {
			errResp := ErrorResponse{Type: req.Type, Error: "Unknown stream type"}
			b, _ := json.Marshal(errResp)
			c.WriteMessage(mt, b)
			continue
		}

		params, validationErrors := ParseParams(req.Params)
		if len(validationErrors) > 0 {
			errResp := ErrorResponse{Type: req.Type, Error: "Validation failed", Details: validationErrors}
			b, _ := json.Marshal(errResp)
			c.WriteMessage(mt, b)
			continue
		}

		// Push filter to BPF
		var proto uint8
		switch params.Protocol {
		case "tcp":
			proto = 6
		case "udp":
			proto = 17
		case "icmp":
			if params.IPv6 {
				proto = 58 // ICMPv6
			} else {
				proto = 1 // ICMPv4
			}
		}

		if params.IPv4 {
			var sip, dip uint32
			if ip := net.ParseIP(params.SIP); ip != nil {
				sip = parseIPv4(ip)
			}
			if ip := net.ParseIP(params.DIP); ip != nil {
				dip = parseIPv4(ip)
			}
			if err := engine.UpdateIPv4Filter(sip, dip, uint16(params.SPort), uint16(params.DPort), proto); err != nil {
				log.Printf("Failed to update IPv4 filter: %v", err)
			}
		}
		if params.IPv6 {
			var sip, dip [16]byte
			if ip := net.ParseIP(params.SIP); ip != nil {
				copy(sip[:], ip.To16())
			}
			if ip := net.ParseIP(params.DIP); ip != nil {
				copy(dip[:], ip.To16())
			}
			if err := engine.UpdateIPv6Filter(sip, dip, uint16(params.SPort), uint16(params.DPort), proto); err != nil {
				log.Printf("Failed to update IPv6 filter: %v", err)
			}
		}

		// Cancel previous aggregation loop if running
		mu.Lock()
		if cancelFn != nil {
			cancelFn()
		}
		ctx, cancel := context.WithCancel(context.Background())
		cancelFn = cancel
		mu.Unlock()

		// Build filter context for the collector
		filterCtx := &aggregation.FilterContext{
			SAddr: params.SIP,
			DAddr: params.DIP,
			SPort: params.SPort,
			DPort: params.DPort,
		}

		collector := aggregation.NewCollector(aggMap, filterCtx)

		// Flush stale aggregation data accumulated under the previous filter.
		// Without this, the first tick would return packets from the old filter window.
		collector.FlushAll()

		// Send ack
		ack := map[string]string{"type": req.Type, "status": "started"}
		b, _ := json.Marshal(ack)
		c.WriteMessage(mt, b)

		// Start aggregation push loop in background
		go func() {
			ticker := time.NewTicker(1 * time.Second)
			defer ticker.Stop()

			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					msgs := collector.CollectAll(1.0)
					for _, msg := range msgs {
							if (msg.Type == "ipv4" && !params.IPv4) || (msg.Type == "ipv6" && !params.IPv6) {
								continue
							}
						// Frontend does JSON.parse(response.data), so data must be a JSON string
						innerJSON, err := json.Marshal(msg)
						if err != nil {
							continue
						}
						wrapped := map[string]interface{}{
							"type": "NumLatencyFrequency",
							"data": string(innerJSON),
						}
						b, err := json.Marshal(wrapped)
						if err != nil {
							continue
						}
						mu.Lock()
						err = c.WriteMessage(websocket.TextMessage, b)
						mu.Unlock()
						if err != nil {
							return
						}
					}
				}
			}
		}()
	}

	// Cleanup on disconnect
	mu.Lock()
	if cancelFn != nil {
		cancelFn()
	}
	mu.Unlock()
}

func parseIPv4(ip net.IP) uint32 {
	ip = ip.To4()
	if ip == nil {
		return 0
	}
	return uint32(ip[0]) | uint32(ip[1])<<8 | uint32(ip[2])<<16 | uint32(ip[3])<<24
}
