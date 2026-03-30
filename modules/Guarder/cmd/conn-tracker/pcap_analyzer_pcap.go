//go:build pcap
// +build pcap

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
)

// PCAPAnalysisRequest PCAP分析请求
type PCAPAnalysisRequest struct {
	CustomPrompt string `json:"custom_prompt,omitempty"`
	AnalyzeType  string `json:"analyze_type"` // "security", "performance", "custom"
}

// PCAPAnalysisResponse PCAP分析响应
type PCAPAnalysisResponse struct {
	Success     bool           `json:"success"`
	Analysis    string         `json:"analysis,omitempty"`
	Threats     []ThreatInfo   `json:"threats,omitempty"`
	Statistics  PCAPStatistics `json:"statistics,omitempty"`
	Suggestions []string       `json:"suggestions,omitempty"`
	Error       string         `json:"error,omitempty"`
}

// ThreatInfo 威胁信息
type ThreatInfo struct {
	Severity    string `json:"severity"`    // "high", "medium", "low"
	Type        string `json:"type"`        // 威胁类型
	Description string `json:"description"` // 威胁描述
	SourceIP    string `json:"source_ip,omitempty"`
	TargetIP    string `json:"target_ip,omitempty"`
	TargetPort  uint16 `json:"target_port,omitempty"`
}

// PCAPStatistics PCAP统计信息
type PCAPStatistics struct {
	TotalPackets uint64            `json:"total_packets"`
	TotalBytes   uint64            `json:"total_bytes"`
	Duration     string            `json:"duration"`
	Protocols    map[string]uint64 `json:"protocols"`
	TopSourceIPs []IPCount         `json:"top_source_ips"`
	TopDestIPs   []IPCount         `json:"top_dest_ips"`
	TopPorts     []PortCount       `json:"top_ports"`
	TCPFlags     TCPFlagStats      `json:"tcp_flags"`
	Connections  uint64            `json:"connections"`
}

// IPCount IP统计
type IPCount struct {
	IP    string `json:"ip"`
	Count uint64 `json:"count"`
}

// PortCount 端口统计
type PortCount struct {
	Port     uint16 `json:"port"`
	Protocol string `json:"protocol"`
	Count    uint64 `json:"count"`
}

// TCPFlagStats TCP标志统计
type TCPFlagStats struct {
	SYN uint64 `json:"syn"`
	ACK uint64 `json:"ack"`
	FIN uint64 `json:"fin"`
	RST uint64 `json:"rst"`
	PSH uint64 `json:"psh"`
	URG uint64 `json:"urg"`
}

// PCAPAnalyzer PCAP分析器
type PCAPAnalyzer struct {
	aiGenerator *AIFilterGenerator
}

// NewPCAPAnalyzer 创建PCAP分析器
func NewPCAPAnalyzer(aiGenerator *AIFilterGenerator) *PCAPAnalyzer {
	return &PCAPAnalyzer{
		aiGenerator: aiGenerator,
	}
}

// AnalyzePCAPFile 分析PCAP文件
func (pa *PCAPAnalyzer) AnalyzePCAPFile(filePath string, req PCAPAnalysisRequest) (*PCAPAnalysisResponse, error) {
	// 打开PCAP文件
	handle, err := pcap.OpenOffline(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open pcap file: %v", err)
	}
	defer handle.Close()

	return pa.analyze(handle, req)
}

// AnalyzePCAPData 分析PCAP数据
func (pa *PCAPAnalyzer) AnalyzePCAPData(data []byte, req PCAPAnalysisRequest) (*PCAPAnalysisResponse, error) {
	// 使用唯一的临时文件，避免并发分析互相覆盖
	tmpFile, err := os.CreateTemp("", "pcap_analysis_*.pcap")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %v", err)
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.Write(data); err != nil {
		tmpFile.Close()
		return nil, fmt.Errorf("failed to write temp file: %v", err)
	}
	if err := tmpFile.Close(); err != nil {
		return nil, fmt.Errorf("failed to close temp file: %v", err)
	}

	return pa.AnalyzePCAPFile(tmpPath, req)
}

// analyze 执行实际分析
func (pa *PCAPAnalyzer) analyze(handle *pcap.Handle, req PCAPAnalysisRequest) (*PCAPAnalysisResponse, error) {
	// 首先检查AI配置
	if !pa.aiGenerator.IsConfigured() {
		return &PCAPAnalysisResponse{
			Success: false,
			Error:   "AI is not configured. Please set API key, endpoint and model first.",
		}, nil
	}

	// 解析PCAP并生成摘要
	summary, stats, err := pa.generatePCAPSummary(handle)
	if err != nil {
		return &PCAPAnalysisResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to parse PCAP: %v", err),
		}, nil
	}

	// 调用AI进行分析
	analysis, err := pa.callAIForAnalysis(summary, req)
	if err != nil {
		return &PCAPAnalysisResponse{
			Success:    false,
			Error:      fmt.Sprintf("AI analysis failed: %v", err),
			Statistics: *stats,
		}, nil
	}

	// 解析AI响应
	parsedAnalysis := pa.parseAIAnalysis(analysis)
	parsedAnalysis.Success = true
	parsedAnalysis.Statistics = *stats

	return parsedAnalysis, nil
}

// generatePCAPSummary 生成PCAP摘要
func (pa *PCAPAnalyzer) generatePCAPSummary(handle *pcap.Handle) (string, *PCAPStatistics, error) {
	packetSource := gopacket.NewPacketSource(handle, handle.LinkType())

	stats := &PCAPStatistics{
		Protocols:    make(map[string]uint64),
		TopSourceIPs: make([]IPCount, 0),
		TopDestIPs:   make([]IPCount, 0),
		TopPorts:     make([]PortCount, 0),
	}

	srcIPMap := make(map[string]uint64)
	dstIPMap := make(map[string]uint64)
	portMap := make(map[string]uint64)

	var firstPacket, lastPacket time.Time
	var packetCount uint64
	var byteCount uint64
	connectionSet := make(map[string]bool)

	// 限制处理的包数量以避免过长的分析
	maxPackets := 5000

	for packet := range packetSource.Packets() {
		if packetCount >= uint64(maxPackets) {
			break
		}

		packetCount++
		byteCount += uint64(len(packet.Data()))

		// 记录时间
		if packetCount == 1 {
			firstPacket = packet.Metadata().Timestamp
		}
		lastPacket = packet.Metadata().Timestamp

		// 解析网络层
		networkLayer := packet.NetworkLayer()
		if networkLayer == nil {
			continue
		}

		var srcIP, dstIP string
		var protocol string

		switch layer := networkLayer.(type) {
		case *layers.IPv4:
			srcIP = layer.SrcIP.String()
			dstIP = layer.DstIP.String()
			protocol = layer.Protocol.String()
			stats.Protocols["IPv4"]++
		case *layers.IPv6:
			srcIP = layer.SrcIP.String()
			dstIP = layer.DstIP.String()
			protocol = "IPv6"
			stats.Protocols["IPv6"]++
		}

		// 统计IP
		srcIPMap[srcIP]++
		dstIPMap[dstIP]++

		// 解析传输层
		transportLayer := packet.TransportLayer()
		if transportLayer != nil {
			switch layer := transportLayer.(type) {
			case *layers.TCP:
				protocol = "TCP"
				stats.Protocols["TCP"]++

				// 端口统计
				portKey := fmt.Sprintf("%d/TCP", layer.DstPort)
				portMap[portKey]++

				// TCP标志统计
				if layer.SYN {
					stats.TCPFlags.SYN++
				}
				if layer.ACK {
					stats.TCPFlags.ACK++
				}
				if layer.FIN {
					stats.TCPFlags.FIN++
				}
				if layer.RST {
					stats.TCPFlags.RST++
				}
				if layer.PSH {
					stats.TCPFlags.PSH++
				}
				if layer.URG {
					stats.TCPFlags.URG++
				}

				// 连接统计
				connKey := fmt.Sprintf("%s:%d->%s:%d", srcIP, layer.SrcPort, dstIP, layer.DstPort)
				connectionSet[connKey] = true

			case *layers.UDP:
				protocol = "UDP"
				stats.Protocols["UDP"]++

				portKey := fmt.Sprintf("%d/UDP", layer.DstPort)
				portMap[portKey]++

				connKey := fmt.Sprintf("%s:%d->%s:%d", srcIP, layer.SrcPort, dstIP, layer.DstPort)
				connectionSet[connKey] = true

			case *layers.ICMPv4:
				protocol = "ICMP"
				stats.Protocols["ICMP"]++

			case *layers.ICMPv6:
				protocol = "ICMPv6"
				stats.Protocols["ICMPv6"]++
			}
		}

		// 应用层协议检测
		if appLayer := packet.ApplicationLayer(); appLayer != nil {
			payload := appLayer.Payload()
			if len(payload) > 0 {
				detectedProto := detectApplicationProtocol(payload)
				if detectedProto != "" {
					stats.Protocols[detectedProto]++
				}
			}
		}
	}

	// 计算持续时间
	if !firstPacket.IsZero() && !lastPacket.IsZero() {
		duration := lastPacket.Sub(firstPacket)
		stats.Duration = duration.String()
	}

	stats.TotalPackets = packetCount
	stats.TotalBytes = byteCount
	stats.Connections = uint64(len(connectionSet))

	// 获取Top IPs
	stats.TopSourceIPs = getTopIPs(srcIPMap, 10)
	stats.TopDestIPs = getTopIPs(dstIPMap, 10)
	stats.TopPorts = getTopPorts(portMap, 10)

	// 生成文本摘要
	var summary strings.Builder
	summary.WriteString("=== PCAP File Analysis Summary ===\n\n")
	summary.WriteString(fmt.Sprintf("Analysis Time: %s\n", time.Now().Format(time.RFC3339)))
	summary.WriteString(fmt.Sprintf("Total Packets: %d\n", stats.TotalPackets))
	summary.WriteString(fmt.Sprintf("Total Bytes: %d\n", stats.TotalBytes))
	summary.WriteString(fmt.Sprintf("Duration: %s\n", stats.Duration))
	summary.WriteString(fmt.Sprintf("Unique Connections: %d\n\n", stats.Connections))

	summary.WriteString("=== Protocol Distribution ===\n")
	for proto, count := range stats.Protocols {
		summary.WriteString(fmt.Sprintf("- %s: %d packets\n", proto, count))
	}
	summary.WriteString("\n")

	summary.WriteString("=== Top Source IPs ===\n")
	for _, ip := range stats.TopSourceIPs {
		summary.WriteString(fmt.Sprintf("- %s: %d packets\n", ip.IP, ip.Count))
	}
	summary.WriteString("\n")

	summary.WriteString("=== Top Destination IPs ===\n")
	for _, ip := range stats.TopDestIPs {
		summary.WriteString(fmt.Sprintf("- %s: %d packets\n", ip.IP, ip.Count))
	}
	summary.WriteString("\n")

	summary.WriteString("=== Top Destination Ports ===\n")
	for _, port := range stats.TopPorts {
		summary.WriteString(fmt.Sprintf("- %d/%s: %d packets\n", port.Port, port.Protocol, port.Count))
	}
	summary.WriteString("\n")

	summary.WriteString("=== TCP Flag Distribution ===\n")
	summary.WriteString(fmt.Sprintf("- SYN: %d\n", stats.TCPFlags.SYN))
	summary.WriteString(fmt.Sprintf("- ACK: %d\n", stats.TCPFlags.ACK))
	summary.WriteString(fmt.Sprintf("- FIN: %d\n", stats.TCPFlags.FIN))
	summary.WriteString(fmt.Sprintf("- RST: %d\n", stats.TCPFlags.RST))
	summary.WriteString(fmt.Sprintf("- PSH: %d\n", stats.TCPFlags.PSH))
	summary.WriteString(fmt.Sprintf("- URG: %d\n", stats.TCPFlags.URG))
	summary.WriteString("\n")

	// 异常检测提示
	summary.WriteString("=== Anomaly Indicators ===\n")
	if stats.TCPFlags.SYN > stats.TCPFlags.ACK*2 {
		summary.WriteString("- WARNING: High SYN to ACK ratio - possible SYN flood\n")
	}
	if len(stats.TopSourceIPs) > 0 && stats.TopSourceIPs[0].Count > packetCount/2 {
		summary.WriteString(fmt.Sprintf("- WARNING: Dominant source IP %s - possible attack source\n",
			stats.TopSourceIPs[0].IP))
	}
	if stats.Connections > packetCount/3 {
		summary.WriteString("- NOTE: High connection count - possible port scanning\n")
	}
	summary.WriteString("\n")

	return summary.String(), stats, nil
}

// callAIForAnalysis 调用AI进行分析
func (pa *PCAPAnalyzer) callAIForAnalysis(summary string, req PCAPAnalysisRequest) (string, error) {
	prompt := pa.generateSystemPrompt(req.AnalyzeType)

	if req.CustomPrompt != "" {
		prompt += "\n\nAdditional Instructions:\n" + req.CustomPrompt
	}

	// 构建OpenAI请求
	request := OpenAIRequest{
		Model:       pa.aiGenerator.config.Model,
		Temperature: pa.aiGenerator.config.Temperature,
		MaxTokens:   3000,
		ResponseFormat: &OpenAIResponseFormat{
			Type: "json_object",
		},
		Messages: []OpenAIMessage{
			{
				Role:    "system",
				Content: prompt,
			},
			{
				Role:    "user",
				Content: fmt.Sprintf("Analyze this PCAP data and identify threats:\n\n%s", summary),
			},
		},
	}

	jsonData, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %v", err)
	}

	httpReq, err := http.NewRequest("POST", pa.aiGenerator.config.OpenAIEndpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %v", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", pa.aiGenerator.config.APIKey))

	client := &http.Client{Timeout: time.Duration(pa.aiGenerator.config.Timeout) * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("failed to call AI API: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("AI API error: %s - %s", resp.Status, string(body))
	}

	var openaiResp OpenAIResponse
	if err := json.Unmarshal(body, &openaiResp); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %v", err)
	}

	if openaiResp.Error != nil {
		return "", fmt.Errorf("AI API error: %s", openaiResp.Error.Message)
	}

	if len(openaiResp.Choices) == 0 {
		return "", fmt.Errorf("no response from AI")
	}

	return openaiResp.Choices[0].Message.Content, nil
}

// generateSystemPrompt 生成系统提示词
func (pa *PCAPAnalyzer) generateSystemPrompt(analyzeType string) string {
	basePrompt := "You are a network security expert specializing in PCAP analysis. Analyze the provided network traffic summary and identify security threats and anomalies.\n\n" +
		"CRITICAL: You MUST respond with ONLY a valid JSON object. Do not include any explanatory text, markdown formatting, or code blocks. Your entire response must be parseable as JSON.\n\n" +
		"Required JSON Output Format:\n" +
		"{\n" +
		"  \"analysis\": \"Detailed analysis of the network traffic and identified threats\",\n" +
		"  \"threats\": [\n" +
		"    {\n" +
		"      \"severity\": \"high|medium|low\",\n" +
		"      \"type\": \"Type of threat (e.g., Port Scan, SYN Flood, Malware C2)\",\n" +
		"      \"description\": \"Detailed description of the threat\",\n" +
		"      \"source_ip\": \"Source IP if applicable\",\n" +
		"      \"target_ip\": \"Target IP if applicable\",\n" +
		"      \"target_port\": 0\n" +
		"    }\n" +
		"  ],\n" +
		"  \"suggestions\": [\"Security recommendations based on the analysis\"]\n" +
		"}\n\n" +
		"Severity Levels:\n" +
		"- high: Immediate threat requiring action (active attacks, malware)\n" +
		"- medium: Suspicious activity requiring investigation\n" +
		"- low: Minor issues or informational findings\n\n" +
		"Common Threat Types:\n" +
		"- Port Scanning: Unusual number of connections to different ports\n" +
		"- SYN Flood: High SYN packets without completing handshakes\n" +
		"- DDoS: Distributed denial of service patterns\n" +
		"- Brute Force: Repeated login attempts\n" +
		"- Data Exfiltration: Unusual outbound data transfers\n" +
		"- Malware C2: Command and control communication patterns\n" +
		"- DNS Tunneling: Suspicious DNS traffic patterns"

	switch analyzeType {
	case "security":
		return basePrompt + "\n\nFOCUS ON SECURITY:\n" +
			"- Identify all potential security threats\n" +
			"- Prioritize active attacks over reconnaissance\n" +
			"- Look for indicators of compromise (IoCs)\n" +
			"- Consider both external attacks and insider threats"

	case "performance":
		return basePrompt + "\n\nFOCUS ON PERFORMANCE:\n" +
			"- Identify bandwidth hogs and resource-intensive traffic\n" +
			"- Look for network inefficiencies\n" +
			"- Flag unusual traffic patterns that impact performance\n" +
			"- Consider both throughput and latency issues"

	default:
		return basePrompt + "\n\nBALANCED ANALYSIS:\n" +
			"- Consider both security and performance aspects\n" +
			"- Prioritize issues by overall impact\n" +
			"- Provide actionable recommendations"
	}
}

// handlePCAPAnalyze 处理PCAP分析请求
func (s *APIServer) handlePCAPAnalyze(w http.ResponseWriter, r *http.Request) {
	s.enableCORS(w, r)
	if r.Method == "OPTIONS" {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 解析multipart表单，最大32MB
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, fmt.Sprintf("Failed to parse form: %v", err), http.StatusBadRequest)
		return
	}

	// 获取上传的文件
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get file: %v", err), http.StatusBadRequest)
		return
	}
	defer file.Close()

	// 检查文件扩展名
	if !strings.HasSuffix(strings.ToLower(header.Filename), ".pcap") &&
		!strings.HasSuffix(strings.ToLower(header.Filename), ".pcapng") {
		http.Error(w, "Invalid file type. Only .pcap and .pcapng files are supported", http.StatusBadRequest)
		return
	}

	// 读取文件内容
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read file: %v", err), http.StatusInternalServerError)
		return
	}

	// 获取分析参数
	customPrompt := r.FormValue("custom_prompt")
	analyzeType := r.FormValue("analyze_type")
	if analyzeType == "" {
		analyzeType = "security"
	}

	// 保存到唯一的临时文件，避免并发请求相互覆盖
	tmpFile, err := os.CreateTemp("", "pcap_analyze_*.pcap")
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create temp file: %v", err), http.StatusInternalServerError)
		return
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.Write(fileBytes); err != nil {
		tmpFile.Close()
		http.Error(w, fmt.Sprintf("Failed to save temp file: %v", err), http.StatusInternalServerError)
		return
	}
	if err := tmpFile.Close(); err != nil {
		http.Error(w, fmt.Sprintf("Failed to close temp file: %v", err), http.StatusInternalServerError)
		return
	}

	// 执行分析
	req := PCAPAnalysisRequest{
		CustomPrompt: customPrompt,
		AnalyzeType:  analyzeType,
	}

	resp, err := s.pcapAnalyzer.AnalyzePCAPFile(tmpPath, req)
	if err != nil {
		http.Error(w, fmt.Sprintf("Analysis failed: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// parseAIAnalysis 解析AI分析结果
func (pa *PCAPAnalyzer) parseAIAnalysis(content string) *PCAPAnalysisResponse {
	content = strings.TrimSpace(content)

	// 清理markdown标记
	if strings.HasPrefix(content, "```json") {
		content = strings.TrimPrefix(content, "```json")
	}
	if strings.HasPrefix(content, "```") {
		content = strings.TrimPrefix(content, "```")
	}
	if strings.HasSuffix(content, "```") {
		content = strings.TrimSuffix(content, "```")
	}
	content = strings.TrimSpace(content)

	var result PCAPAnalysisResponse
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		// 如果解析失败，返回原始内容作为分析
		return &PCAPAnalysisResponse{
			Success:  true,
			Analysis: content,
		}
	}

	return &result
}

// detectApplicationProtocol 检测应用层协议
func detectApplicationProtocol(payload []byte) string {
	if len(payload) < 4 {
		return ""
	}

	// HTTP detection
	if strings.HasPrefix(string(payload), "GET ") ||
		strings.HasPrefix(string(payload), "POST ") ||
		strings.HasPrefix(string(payload), "HTTP/") {
		return "HTTP"
	}

	// HTTPS detection (TLS handshake)
	if payload[0] == 0x16 && payload[1] == 0x03 {
		return "HTTPS"
	}

	// DNS detection
	if len(payload) > 12 && payload[2] == 0x01 && payload[3] == 0x00 {
		return "DNS"
	}

	// SSH detection
	if strings.HasPrefix(string(payload), "SSH-") {
		return "SSH"
	}

	// FTP detection
	if strings.HasPrefix(string(payload), "220 ") ||
		strings.HasPrefix(string(payload), "USER ") ||
		strings.HasPrefix(string(payload), "PASS ") {
		return "FTP"
	}

	// SMTP detection
	if strings.HasPrefix(string(payload), "HELO ") ||
		strings.HasPrefix(string(payload), "EHLO ") ||
		strings.HasPrefix(string(payload), "MAIL FROM:") {
		return "SMTP"
	}

	return ""
}

// getTopIPs 获取Top IP
func getTopIPs(ipMap map[string]uint64, n int) []IPCount {
	var counts []IPCount
	for ip, count := range ipMap {
		counts = append(counts, IPCount{IP: ip, Count: count})
	}

	// 简单冒泡排序
	for i := 0; i < len(counts); i++ {
		for j := i + 1; j < len(counts); j++ {
			if counts[j].Count > counts[i].Count {
				counts[i], counts[j] = counts[j], counts[i]
			}
		}
	}

	if len(counts) > n {
		return counts[:n]
	}
	return counts
}

// getTopPorts 获取Top端口
func getTopPorts(portMap map[string]uint64, n int) []PortCount {
	var counts []PortCount
	for portKey, count := range portMap {
		var port uint16
		var proto string
		fmt.Sscanf(portKey, "%d/%s", &port, &proto)
		counts = append(counts, PortCount{Port: port, Protocol: proto, Count: count})
	}

	// 简单冒泡排序
	for i := 0; i < len(counts); i++ {
		for j := i + 1; j < len(counts); j++ {
			if counts[j].Count > counts[i].Count {
				counts[i], counts[j] = counts[j], counts[i]
			}
		}
	}

	if len(counts) > n {
		return counts[:n]
	}
	return counts
}
