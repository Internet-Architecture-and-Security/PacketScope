//go:build vmtest

package runner_test

// ws_functional_test.go — WebSocket 功能测试，在 QEMU VM 内真实内核上运行。
//
// 测试策略 (TDD 行为规约)：
//   "启动 metrics 服务后，必须能通过 WebSocket 收到包含正确 JSON 结构的
//   NumLatencyFrequency 消息，且 packets 字段在有 loopback 流量时 > 0。"
//
// 执行路径：
//   1. 启动 /bin/metrics 二进制（由 mkrootfs.sh 编译并放入 rootfs）
//   2. 等待端口 8020 就绪
//   3. 拨号 WebSocket ws://127.0.0.1:8020/ws
//   4. 发送 NumLatencyFrequency 请求（零 filter = 通配所有流量）
//   5. 在 loopback 上生成 TCP 流量（确保有数据可观测）
//   6. 接收 ≥3 条消息，验证外层和内层 JSON 结构
//   7. 检查至少一条消息的 packets 字段 > 0

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

const (
	metricsAddr = "127.0.0.1:8020"
	metricsBin  = "/bin/metrics"
)

// ─── WebSocket 消息结构 ───────────────────────────────────────────────────────

// outerMsg 是 metrics WebSocket 服务端的外层消息格式。
// 有两种形式:
//
//	A. ACK:     {"type":"NumLatencyFrequency","status":"started"}  (data 字段不存在)
//	B. 指标消息: {"type":"NumLatencyFrequency","data":"<JSON 字符串>"}  (data 是嵌套 JSON)
type outerMsg struct {
	Type   string `json:"type"`
	Status string `json:"status,omitempty"` // ACK 消息的 status 字段
	Data   string `json:"data,omitempty"`   // 指标消息的嵌套 JSON 字符串
}

// innerMsg 是 data 字段解码后的内层结构。
// 字段名来自 aggregation.MetricsMessage 的 JSON tag，必须与服务端保持一致。
// 【TDD注意】 若这里的字段名与服务端不匹配，验证将失败（字段为零并报错）。
type innerMsg struct {
	Layer      string   `json:"layer"`      // PPS 消息: "link"/"network"/"trans"
	Crosslayer string   `json:"crosslayer"` // LAT 消息
	Direction  string   `json:"direction"`  // "receive"/"send"
	Type       string   `json:"type"`       // "ipv4"/"ipv6"
	Num        *int     `json:"num"`        // PPS 总包数
	Lat        *float64 `json:"LAT(ms)"`    // LAT 类: 延迟 ms
}

// ─── TestWSFunctional ─────────────────────────────────────────────────────────

// TestWSFunctional 运行完整的 WebSocket 端到端功能测试。
//
// 依赖：
//   - /bin/metrics 存在（由 mkrootfs.sh 编译）
//   - BPF 权限可用（VM 内以 root 运行）
//   - lo 接口已 up（mkrootfs.sh init 脚本配置）
func TestWSFunctional(t *testing.T) {
	if _, err := os.Stat(metricsBin); err != nil {
		t.Skipf("/bin/metrics 不存在 (mkrootfs.sh 需要编译该二进制): %v", err)
	}
	requireBTF(t)

	// 1. 启动 metrics 服务
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, metricsBin)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		t.Fatalf("启动 %s 失败: %v", metricsBin, err)
	}
	defer func() {
		cmd.Process.Kill()
		cmd.Wait()
	}()
	t.Logf("metrics 进程已启动 (PID %d)", cmd.Process.Pid)

	// 2. 等待端口 8020 就绪（最多 15 秒）
	if err := waitForMetricsPort(metricsAddr, 15*time.Second); err != nil {
		t.Fatalf("metrics 未在 15s 内监听 %s: %v", metricsAddr, err)
	}
	t.Logf("metrics 已在 %s 就绪", metricsAddr)

	// 3. 拨号 WebSocket
	u := url.URL{Scheme: "ws", Host: metricsAddr, Path: "/ws"}
	dialer := websocket.Dialer{HandshakeTimeout: 5 * time.Second}
	conn, _, err := dialer.Dial(u.String(), http.Header{"Origin": {"http://127.0.0.1"}})
	if err != nil {
		t.Fatalf("WebSocket Dial(%s) 失败: %v", u.String(), err)
	}
	defer conn.Close()
	t.Logf("WebSocket 已连接: %s", u.String())

	// 4. 发送 NumLatencyFrequency 请求（零 filter = 通配所有流量）
	req := map[string]interface{}{
		"type": "NumLatencyFrequency",
		"params": map[string]interface{}{
			"ipv4":     true,
			"ipv6":     false,
			"sip":      "0.0.0.0",
			"dip":      "0.0.0.0",
			"sport":    0,
			"dport":    0,
			"protocol": "tcp",
		},
	}
	if err := conn.WriteJSON(req); err != nil {
		t.Fatalf("WebSocket 发送请求失败: %v", err)
	}
	t.Log("已发送 NumLatencyFrequency 请求")

	// 5. 在 loopback 上生成 TCP 流量（后台持续进行）
	go generateLoopbackTraffic(t)

	// 6. 接收消息并验证结构（收 5 条: 1 个 ACK + 4 个指标，确保 traffic 数据包含其中）
	msgs := collectWSMessages(t, conn, 5, 12*time.Second)
	if len(msgs) < 2 {
		t.Errorf("期望收到 ≥2 条消息 (ACK + 指标), 实际只收到 %d 条", len(msgs))
	}
	t.Logf("共收到 %d 条 WebSocket 消息", len(msgs))

	// 7. 验证消息结构与行为
	validateWSMessages(t, msgs)
}

// ─── TestWSMessageFormat ──────────────────────────────────────────────────────

// TestWSMessageFormat 专项验证 WebSocket 消息协议格式（外层 JSON + 内层嵌套 JSON 字符串）。
// 与 BPF 行为解耦，单独验证协议约定。
func TestWSMessageFormat(t *testing.T) {
	if _, err := os.Stat(metricsBin); err != nil {
		t.Skipf("/bin/metrics 不存在，跳过格式测试")
	}
	requireBTF(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, metricsBin)
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		t.Fatalf("启动 %s: %v", metricsBin, err)
	}
	defer func() { cmd.Process.Kill(); cmd.Wait() }()

	if err := waitForMetricsPort(metricsAddr, 10*time.Second); err != nil {
		t.Fatalf("%v", err)
	}

	u := url.URL{Scheme: "ws", Host: metricsAddr, Path: "/ws"}
	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		t.Fatalf("WebSocket Dial: %v", err)
	}
	defer conn.Close()

	req := map[string]interface{}{
		"type": "NumLatencyFrequency",
		"params": map[string]interface{}{
			"ipv4": true, "ipv6": false,
			"sip": "0.0.0.0", "dip": "0.0.0.0",
			"sport": 0, "dport": 0, "protocol": "tcp",
		},
	}
	conn.WriteJSON(req)

	// 第一条消息是 ACK ({"status":"started"})，没有 data 字段，跳过它。
	// 读第二条才是实际的指标消息。
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	var raw []byte
	var err2 error
	for i := 0; i < 3; i++ {
		_, raw, err2 = conn.ReadMessage()
		if err2 != nil {
			t.Fatalf("第 %d 条消息读取失败: %v", i+1, err2)
		}
		// 跳过 ACK
		if !strings.Contains(string(raw), "\"data\"") {
			t.Logf("跳过第 %d 条 (ACK): %s", i+1, string(raw))
			continue
		}
		break
	}

	// 外层必须是合法 JSON 且含 type / data 字段
	var outer map[string]interface{}
	if err := json.Unmarshal(raw, &outer); err != nil {
		t.Fatalf("外层 JSON 无效: %v\n原始: %s", err, raw)
	}
	msgType, _ := outer["type"].(string)
	dataStr, ok := outer["data"].(string)
	if !ok {
		t.Fatalf("外层 data 字段不是字符串: %s", raw)
	}
	// data 必须是合法 JSON（嵌套 JSON 字符串协议约定）
	var inner map[string]interface{}
	if err := json.Unmarshal([]byte(dataStr), &inner); err != nil {
		t.Errorf("内层 data 不是合法 JSON: %v\ndata=%s", err, dataStr)
	} else {
		keys := make([]string, 0, len(inner))
		for k := range inner {
			keys = append(keys, k)
		}
		t.Logf("外层 type=%q, 内层 keys=%v", msgType, keys)
		t.Log("  WebSocket 消息格式验证: PASS ✓")
	}
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

// waitForMetricsPort 轮询 TCP 端口直到可连接或超时。
func waitForMetricsPort(addr string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		c, err := net.DialTimeout("tcp", addr, 500*time.Millisecond)
		if err == nil {
			c.Close()
			return nil
		}
		time.Sleep(200 * time.Millisecond)
	}
	return fmt.Errorf("端口 %s 在 %v 内不可达", addr, timeout)
}

// generateLoopbackTraffic 在 loopback 上生成 TCP echo 流量。
func generateLoopbackTraffic(t *testing.T) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Logf("warn: 无法监听 loopback: %v", err)
		return
	}
	defer ln.Close()

	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) { defer c.Close(); io.Copy(c, c) }(c)
		}
	}()

	for i := 0; i < 6; i++ {
		c, err := net.DialTimeout("tcp", ln.Addr().String(), 500*time.Millisecond)
		if err != nil {
			continue
		}
		fmt.Fprintf(c, "vmtest traffic %d\n", i)
		c.Close()
		time.Sleep(150 * time.Millisecond)
	}
}

// collectWSMessages 从 gorilla WebSocket 连接读取指定数量的消息，超时则提前返回。
func collectWSMessages(t *testing.T, conn *websocket.Conn, want int, timeout time.Duration) []outerMsg {
	t.Helper()
	var msgs []outerMsg
	conn.SetReadDeadline(time.Now().Add(timeout))
	for len(msgs) < want {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			if strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "deadline") {
				t.Logf("接收超时，已收集 %d 条消息", len(msgs))
				break
			}
			t.Logf("WebSocket 接收错误: %v", err)
			break
		}
		var msg outerMsg
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Errorf("消息 JSON 解析失败: %v (raw=%s)", err, raw)
			continue
		}
		msgs = append(msgs, msg)
	}
	return msgs
}

// validateWSMessages 验证消息结构完整性并检查是否有非零包数。
// ACK 消息（status="started", data=""）会被跳过。
// 内层 JSON 字段名必须与 aggregation.MetricsMessage 的 JSON tag 一致。
func validateWSMessages(t *testing.T, msgs []outerMsg) {
	t.Helper()

	validDirections := map[string]bool{"receive": true, "send": true, "": true}
	validLayers := map[string]bool{
		"link": true, "network": true, "trans": true,
		"linktrans": true, "networktrans": true, "linknetwork": true, "": true,
	}
	var hasNonZero bool
	metricsCount := 0

	for i, msg := range msgs {
		// ACK 消息: status="started", data="" — 跳过
		if msg.Status == "started" || msg.Data == "" {
			t.Logf("  消息[%d]: ACK (status=%s)", i, msg.Status)
			continue
		}
		metricsCount++
		if msg.Type != "NumLatencyFrequency" {
			t.Errorf("消息[%d] type=%q, 期望 NumLatencyFrequency", i, msg.Type)
		}
		// data 是嵌套 JSON 字符串（前端执行 JSON.parse(data)）
		var inner innerMsg
		if err := json.Unmarshal([]byte(msg.Data), &inner); err != nil {
			t.Errorf("消息[%d] 内层 data 解析失败: %v", i, err)
			continue
		}
		if !validDirections[inner.Direction] {
			t.Errorf("消息[%d] 非法 direction=%q", i, inner.Direction)
		}
		if !validLayers[inner.Layer] && !validLayers[inner.Crosslayer] {
			t.Errorf("消息[%d] 非法 layer=%q crosslayer=%q", i, inner.Layer, inner.Crosslayer)
		}
		numVal := 0
		if inner.Num != nil {
			numVal = *inner.Num
		}
		if numVal > 0 {
			hasNonZero = true
		}
		t.Logf("  消息[%d]: dir=%-8s layer=%-10s crosslayer=%-10s num=%d",
			i, inner.Direction, inner.Layer, inner.Crosslayer, numVal)
	}

	if metricsCount == 0 {
		t.Error("未收到任何指标消息（只收到 ACK 或无消息）")
		return
	}
	if !hasNonZero {
		t.Error("BUG: 所有指标消息 num == 0 — BPF 钩子可能未生效或 loopback 流量未被捕获")
	} else {
		t.Log("  WebSocket 功能验证: PASS — 收到有效消息且 num > 0 ✓")
	}
}
