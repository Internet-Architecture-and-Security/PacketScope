package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// PerfStats 性能统计结构体（与bpf中的结构对应）
type PerfStats struct {
	ICMPTypeCounts   [16]uint64  `json:"ICMPTypeCounts"`
	ICMPCodeCounts   [256]uint64 `json:"ICMPCodeCounts"`
	TCPRetrans       uint64      `json:"TCPRetrans"`
	TCPDuplicateAck  uint64      `json:"TCPDuplicateAck"`
	TCPOutOfOrder    uint64      `json:"TCPOutOfOrder"`
	TCPZeroWindow    uint64      `json:"TCPZeroWindow"`
	TCPSmallWindow   uint64      `json:"TCPSmallWindow"`
	TotalPackets     uint64      `json:"TotalPackets"`
	TotalBytes       uint64      `json:"TotalBytes"`
	DroppedPackets   uint64      `json:"DroppedPackets"`
	MalformedPackets uint64      `json:"MalformedPackets"`
}

const (
	AIProviderOpenAI    = "openai"
	AIProviderAnthropic = "anthropic"

	defaultOpenAIEndpoint    = "https://api.openai.com/v1/chat/completions"
	defaultOpenAIModel       = "gpt-3.5-turbo"
	defaultAnthropicEndpoint = "https://api.anthropic.com/v1/messages"
	defaultAnthropicModel    = "claude-3-5-sonnet-latest"
	defaultAnthropicVersion  = "2023-06-01"
)

// AIFilterConfig AI过滤器配置
type AIFilterConfig struct {
	Provider         string  `json:"provider"`
	OpenAIEndpoint   string  `json:"openai_endpoint"`
	APIKey           string  `json:"api_key"`
	Model            string  `json:"model"`
	Temperature      float64 `json:"temperature"`
	Debug            bool    `json:"debug"`             // 调试模式
	Timeout          int     `json:"timeout"`           // 超时时间（秒）
	AnthropicVersion string  `json:"anthropic_version"` // Anthropic 兼容协议版本
}

// AIFilterRequest AI过滤器请求
type AIFilterRequest struct {
	CustomPrompt string `json:"custom_prompt,omitempty"`
	AnalyzeType  string `json:"analyze_type"` // "security", "performance", "custom"
	IncludeICMP  bool   `json:"include_icmp"`
	IncludeTCP   bool   `json:"include_tcp"`
	IncludeStats bool   `json:"include_stats"`
}

// AIFilterResponse AI过滤器响应
type AIFilterResponse struct {
	Success     bool         `json:"success"`
	Filters     []FilterRule `json:"filters,omitempty"`
	Analysis    string       `json:"analysis,omitempty"`
	Suggestions []string     `json:"suggestions,omitempty"`
	Error       string       `json:"error,omitempty"`
	TokensUsed  int          `json:"tokens_used,omitempty"`
}

// OpenAIRequest OpenAI API请求结构
type OpenAIRequest struct {
	Model          string                `json:"model"`
	Messages       []OpenAIMessage       `json:"messages"`
	Temperature    float64               `json:"temperature"`
	MaxTokens      int                   `json:"max_tokens"`
	ResponseFormat *OpenAIResponseFormat `json:"response_format,omitempty"`
	Functions      []OpenAIFunction      `json:"functions,omitempty"`
}

type AnthropicRequest struct {
	Model       string             `json:"model"`
	System      string             `json:"system,omitempty"`
	Messages    []AnthropicMessage `json:"messages"`
	Temperature float64            `json:"temperature,omitempty"`
	MaxTokens   int                `json:"max_tokens"`
}

type AnthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// OpenAIMessage OpenAI消息结构
type OpenAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// OpenAIFunction OpenAI函数定义
type OpenAIFunction struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Parameters  interface{} `json:"parameters"`
}

// OpenAIResponse OpenAI API响应结构
type OpenAIResponse struct {
	ID      string         `json:"id"`
	Object  string         `json:"object"`
	Created int64          `json:"created"`
	Model   string         `json:"model"`
	Choices []OpenAIChoice `json:"choices"`
	Usage   OpenAIUsage    `json:"usage"`
	Error   *OpenAIError   `json:"error,omitempty"`
}

// OpenAIChoice OpenAI选择结构
type OpenAIChoice struct {
	Index        int           `json:"index"`
	Message      OpenAIMessage `json:"message"`
	FinishReason string        `json:"finish_reason"`
}

// OpenAIUsage OpenAI使用统计
type OpenAIUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// OpenAIError OpenAI错误结构
type OpenAIError struct {
	Message string `json:"message"`
	Type    string `json:"type"`
	Code    string `json:"code"`
}

// OpenAIResponseFormat OpenAI响应格式结构
type OpenAIResponseFormat struct {
	Type string `json:"type"`
}

type AnthropicResponse struct {
	ID         string                  `json:"id"`
	Type       string                  `json:"type"`
	Role       string                  `json:"role"`
	Model      string                  `json:"model"`
	Content    []AnthropicContentBlock `json:"content"`
	Usage      AnthropicUsage          `json:"usage"`
	Error      *OpenAIError            `json:"error,omitempty"`
	StopReason string                  `json:"stop_reason"`
}

type AnthropicContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type AnthropicUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

type AITextResponse struct {
	Content    string
	TokensUsed int
	Provider   string
}

// AIFilterGenerator AI过滤器生成器
type AIFilterGenerator struct {
	config AIFilterConfig
	client *http.Client
}

// ValidateConfig 校验AI过滤器配置
func (a *AIFilterGenerator) ValidateConfig() error {
	if !isSupportedAIProvider(a.config.Provider) {
		return fmt.Errorf("unsupported AI provider: %s", a.config.Provider)
	}

	if strings.TrimSpace(a.config.APIKey) == "" {
		return fmt.Errorf("API key is required but not configured")
	}

	if strings.TrimSpace(a.config.OpenAIEndpoint) == "" {
		return fmt.Errorf("OpenAI endpoint is required but not configured")
	}

	if strings.TrimSpace(a.config.Model) == "" {
		return fmt.Errorf("model is required but not configured")
	}

	return nil
}

// IsConfigured 检查是否已正确配置
func (a *AIFilterGenerator) IsConfigured() bool {
	return isSupportedAIProvider(a.config.Provider) &&
		strings.TrimSpace(a.config.APIKey) != "" &&
		strings.TrimSpace(a.config.OpenAIEndpoint) != "" &&
		strings.TrimSpace(a.config.Model) != ""
}

// NewAIFilterGenerator 创建AI过滤器生成器
func NewAIFilterGenerator(config AIFilterConfig) *AIFilterGenerator {
	config = normalizeAIFilterConfig(config)

	// 设置默认超时时间
	timeout := config.Timeout
	if timeout == 0 {
		timeout = 120 // 默认120秒
	}

	generator := &AIFilterGenerator{
		config: config,
		client: &http.Client{
			Timeout: time.Duration(timeout) * time.Second,
		},
	}

	// 在调试模式下输出配置状态
	if config.Debug {
		fmt.Println("=== AI Filter Generator Configuration ===")
		fmt.Printf("Provider: %s\n", config.Provider)
		fmt.Printf("OpenAI Endpoint: %s\n", config.OpenAIEndpoint)
		fmt.Printf("Model: %s\n", config.Model)
		fmt.Printf("Temperature: %.2f\n", config.Temperature)
		fmt.Printf("Timeout: %d seconds\n", timeout)
		if config.Provider == AIProviderAnthropic {
			fmt.Printf("Anthropic Version: %s\n", config.AnthropicVersion)
		}
		fmt.Printf("API Key Configured: %t\n", strings.TrimSpace(config.APIKey) != "")
		fmt.Printf("Configuration Valid: %t\n", generator.IsConfigured())
		fmt.Println("=========================================")
		fmt.Println()
	}

	return generator
}

func isSupportedAIProvider(provider string) bool {
	switch strings.TrimSpace(strings.ToLower(provider)) {
	case AIProviderOpenAI, AIProviderAnthropic:
		return true
	default:
		return false
	}
}

func normalizeAIFilterConfig(config AIFilterConfig) AIFilterConfig {
	provider := strings.TrimSpace(strings.ToLower(config.Provider))
	if provider == "" {
		provider = AIProviderOpenAI
	}
	config.Provider = provider

	config.OpenAIEndpoint = strings.TrimSpace(config.OpenAIEndpoint)
	config.Model = strings.TrimSpace(config.Model)
	config.AnthropicVersion = strings.TrimSpace(config.AnthropicVersion)

	if config.OpenAIEndpoint == "" {
		switch provider {
		case AIProviderAnthropic:
			config.OpenAIEndpoint = defaultAnthropicEndpoint
		default:
			config.OpenAIEndpoint = defaultOpenAIEndpoint
		}
	}

	if config.Model == "" {
		switch provider {
		case AIProviderAnthropic:
			config.Model = defaultAnthropicModel
		default:
			config.Model = defaultOpenAIModel
		}
	}

	if config.Temperature == 0 {
		config.Temperature = 0.7
	}
	if config.Timeout == 0 {
		config.Timeout = 120
	}
	if provider == AIProviderAnthropic && config.AnthropicVersion == "" {
		config.AnthropicVersion = defaultAnthropicVersion
	}

	return config
}

// generateConnectionSummary 生成连接摘要信息
func (a *AIFilterGenerator) generateConnectionSummary(objs *connTrackerObjects, includeICMP, includeTCP, includeStats bool) (string, error) {
	const maxLength = 10000 // 最大字符数限制
	var summary strings.Builder

	summary.WriteString("=== Network Connection Analysis ===\n\n")

	// 添加时间戳
	summary.WriteString(fmt.Sprintf("Analysis Time: %s\n\n", time.Now().Format(time.RFC3339)))

	if includeTCP {
		// 获取TCP/UDP连接信息
		connections, err := GetConnections(objs.ConnMap)
		if err != nil {
			return "", fmt.Errorf("failed to get connections: %v", err)
		}

		summary.WriteString("=== TCP/UDP Connections ===\n")
		summary.WriteString(fmt.Sprintf("Total Connections: %d\n\n", len(connections)))

		// 分析连接模式
		tcpCount, udpCount := 0, 0
		ipMap := make(map[string]int)

		// 限制显示的连接数量，避免内容过长
		maxConnections := 50
		displayedConnections := 0

		for _, conn := range connections {
			// 检查当前长度，如果接近限制则停止添加详细信息
			if summary.Len() > maxLength*0.7 { // 预留30%空间给其他部分
				summary.WriteString(fmt.Sprintf("... (showing first %d of %d connections, truncated to save space)\n\n", displayedConnections, len(connections)))
				break
			}

			if displayedConnections < maxConnections {
				summary.WriteString(fmt.Sprintf("Connection: %s\n", conn.Key))
				summary.WriteString(fmt.Sprintf("Details: %s\n\n", conn.Info))
				displayedConnections++
			}

			// 解析连接信息进行统计
			if strings.Contains(conn.Key, "(TCP)") {
				tcpCount++
			} else if strings.Contains(conn.Key, "(UDP)") {
				udpCount++
			}

			// 简单的IP统计
			parts := strings.Split(conn.Key, " -> ")
			if len(parts) >= 2 {
				srcParts := strings.Split(parts[0], ":")
				if len(srcParts) >= 2 {
					ipMap[srcParts[0]]++
				}
			}
		}

		summary.WriteString(fmt.Sprintf("Connection Summary:\n- TCP Connections: %d\n- UDP Connections: %d\n\n", tcpCount, udpCount))

		// 显示活跃IP (限制数量)
		summary.WriteString("Active Source IPs:\n")
		ipCount := 0
		for ip, count := range ipMap {
			if count > 1 && ipCount < 20 { // 最多显示20个活跃IP
				summary.WriteString(fmt.Sprintf("- %s: %d connections\n", ip, count))
				ipCount++
			}
		}
		if len(ipMap) > 20 {
			summary.WriteString(fmt.Sprintf("... and %d more IPs\n", len(ipMap)-20))
		}
		summary.WriteString("\n")
	}

	if includeICMP && summary.Len() < maxLength*0.9 { // 只有在还有空间时才添加ICMP信息
		// 获取ICMP信息
		icmpEntries, err := GetICMPEntries(objs.IcmpMap)
		if err != nil {
			return "", fmt.Errorf("failed to get ICMP entries: %v", err)
		}

		summary.WriteString("=== ICMP Traffic ===\n")
		summary.WriteString(fmt.Sprintf("Total ICMP Entries: %d\n\n", len(icmpEntries)))

		icmpTypeMap := make(map[string]int)

		// 限制显示的ICMP条目数量
		maxICMPEntries := 30
		displayedICMP := 0

		for _, icmp := range icmpEntries {
			if summary.Len() > maxLength*0.95 { // 接近限制时停止
				summary.WriteString(fmt.Sprintf("... (showing first %d of %d ICMP entries, truncated)\n\n", displayedICMP, len(icmpEntries)))
				break
			}

			if displayedICMP < maxICMPEntries {
				summary.WriteString(fmt.Sprintf("ICMP: %s\n", icmp.Key))
				summary.WriteString(fmt.Sprintf("Details: %s\n\n", icmp.Info))
				displayedICMP++
			}

			// 统计ICMP类型
			if strings.Contains(icmp.Key, "Type: ") {
				parts := strings.Split(icmp.Key, "Type: ")
				if len(parts) > 1 {
					typePart := strings.Split(parts[1], ",")[0]
					icmpTypeMap[typePart]++
				}
			}
		}

		summary.WriteString("ICMP Type Summary:\n")
		for icmpType, count := range icmpTypeMap {
			summary.WriteString(fmt.Sprintf("- Type %s: %d packets\n", icmpType, count))
		}
		summary.WriteString("\n")
	}

	if includeStats && summary.Len() < maxLength*0.98 { // 确保有空间添加统计信息
		// 获取统计信息
		var stats PerfStats
		var key uint32 = 0
		if err := objs.PerfStatsMap.Lookup(&key, &stats); err == nil {
			summary.WriteString("=== Performance Statistics ===\n")
			summary.WriteString(fmt.Sprintf("Total Packets: %d\n", stats.TotalPackets))
			summary.WriteString(fmt.Sprintf("Total Bytes: %d\n", stats.TotalBytes))
			summary.WriteString(fmt.Sprintf("Dropped Packets: %d\n", stats.DroppedPackets))
			summary.WriteString(fmt.Sprintf("Malformed Packets: %d\n", stats.MalformedPackets))
			summary.WriteString(fmt.Sprintf("TCP Retransmissions: %d\n", stats.TCPRetrans))
			summary.WriteString(fmt.Sprintf("TCP Zero Window: %d\n", stats.TCPZeroWindow))
			summary.WriteString("\n")

			// ICMP统计
			summary.WriteString("ICMP Type Counts:\n")
			for i, count := range stats.ICMPTypeCounts {
				if count > 0 {
					summary.WriteString(fmt.Sprintf("- Type %d: %d\n", i, count))
				}
			}
			summary.WriteString("\n")
		}
	}

	result := summary.String()

	// 最终截断检查
	if len(result) > maxLength {
		result = result[:maxLength-100] + "\n\n... (content truncated to fit 10000 character limit)"
		if a.config.Debug {
			fmt.Printf("=== Content Truncated ===\n")
			fmt.Printf("Original length: %d characters\n", summary.Len())
			fmt.Printf("Truncated to: %d characters\n", len(result))
			fmt.Println("=========================\n")
		}
	}

	return result, nil
}

// generateSystemPrompt 生成系统提示词
func (a *AIFilterGenerator) generateSystemPrompt(analyzeType string) string {
	basePrompt := `You are a network security expert specializing in eBPF/XDP packet filtering. Your task is to analyze network connection data and identify the most critical security threat, then generate ONE primary defensive filter rule to block suspicious traffic.

CRITICAL: You MUST respond with ONLY a valid JSON object. Do not include any explanatory text, markdown formatting, or code blocks. Your entire response must be parseable as JSON.

Filter Rule Types:
1. "basic" - IP address, port, and protocol filtering
2. "tcp" - TCP-specific filtering with flags
3. "udp" - UDP-specific filtering  
4. "icmp" - ICMP-specific filtering with types and codes

Primary Action: "drop" - Block suspicious/malicious traffic

Required JSON Output Format:
{
  "analysis": "Brief analysis of the most critical security threat identified",
  "suggestions": ["Key security recommendations"],
  "filters": [
    {
      "rule_type": "basic|tcp|udp|icmp",
      "src_ip": "specific IP or empty for any",
      "dst_ip": "specific IP or empty for any", 
      "src_port": port_number_or_0_for_any,
      "dst_port": port_number_or_0_for_any,
      "protocol": "tcp|udp|icmp|any",
      "action": "drop",
      "enabled": true,
      "comment": "Description of why this suspicious traffic should be blocked",
      "tcp_flags": tcp_flag_value_if_applicable,
      "tcp_flags_mask": tcp_flag_mask_if_applicable,
      "icmp_type": icmp_type_if_applicable,
      "icmp_code": icmp_code_if_applicable
    }
  ]
}

IMPORTANT: 
- Generate ONLY ONE filter rule in the filters array
- The rule should have action "drop" to block suspicious traffic
- Focus on the most critical security threat identified
- Your response must be valid JSON that can be parsed directly.`

	switch analyzeType {
	case "security":
		return basePrompt + `

Focus on SECURITY-ORIENTED filtering:
- Identify the MOST CRITICAL security threat from the traffic patterns
- Generate ONE drop rule to block the most suspicious activity
- Consider port scanning, brute force attacks, or unusual connection patterns
- Prioritize threats that could lead to system compromise`

	case "performance":
		return basePrompt + `

Focus on PERFORMANCE-ORIENTED filtering:
- Identify the biggest performance bottleneck or resource waster
- Generate ONE drop rule to block bandwidth-consuming or unnecessary traffic
- Consider reducing overhead from repetitive or malicious connections
- Focus on traffic that impacts system performance most`

	default:
		return basePrompt + `

Provide BALANCED analysis:
- Identify the most significant threat considering both security and performance
- Generate ONE drop rule that provides maximum protection benefit
- Balance security threat mitigation with system performance`
	}
}

// callOpenAI 调用 OpenAI 兼容 API
func (a *AIFilterGenerator) callOpenAI(systemPrompt, userPrompt string, maxTokens int, requireJSON bool) (*AITextResponse, error) {
	var responseFormat *OpenAIResponseFormat
	if requireJSON {
		responseFormat = &OpenAIResponseFormat{Type: "json_object"}
	}

	request := OpenAIRequest{
		Model:          a.config.Model,
		Temperature:    a.config.Temperature,
		MaxTokens:      maxTokens,
		ResponseFormat: responseFormat,
		Messages: []OpenAIMessage{
			{
				Role:    "system",
				Content: systemPrompt,
			},
			{
				Role:    "user",
				Content: userPrompt,
			},
		},
	}

	if a.config.Debug {
		fmt.Println("=== OpenAI API Request ===")
		reqJson, _ := json.MarshalIndent(request, "", "  ")
		fmt.Println(string(reqJson))
		fmt.Println("=========================")
		fmt.Println()
	}

	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	req, err := http.NewRequest("POST", a.config.OpenAIEndpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", a.config.APIKey))

	if a.config.Debug {
		fmt.Printf("=== HTTP Request Details ===\n")
		fmt.Printf("Provider: %s\n", a.config.Provider)
		fmt.Printf("URL: %s\n", a.config.OpenAIEndpoint)
		fmt.Printf("Method: POST\n")
		fmt.Printf("Content-Type: application/json\n")
		fmt.Printf("Authorization: Bearer %s...\n", a.config.APIKey[:min(10, len(a.config.APIKey))])
		fmt.Printf("Body Length: %d bytes\n", len(jsonData))
		fmt.Printf("Timeout: %v\n", a.client.Timeout)
		fmt.Println("============================")
		fmt.Println()
	}

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call OpenAI API: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %v", err)
	}

	if a.config.Debug {
		fmt.Printf("=== HTTP Response Details ===\n")
		fmt.Printf("Status: %s\n", resp.Status)
		fmt.Printf("Content-Length: %d bytes\n", len(body))
		fmt.Printf("Raw Response Body:\n%s\n", string(body))
		fmt.Println("=============================")
		fmt.Println()
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OpenAI API error: %s - %s", resp.Status, string(body))
	}

	var openaiResp OpenAIResponse
	if err := json.Unmarshal(body, &openaiResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %v", err)
	}

	if openaiResp.Error != nil {
		return nil, fmt.Errorf("OpenAI API error: %s", openaiResp.Error.Message)
	}

	if len(openaiResp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in OpenAI response")
	}

	return &AITextResponse{
		Content:    openaiResp.Choices[0].Message.Content,
		TokensUsed: openaiResp.Usage.TotalTokens,
		Provider:   a.config.Provider,
	}, nil
}

func (a *AIFilterGenerator) callAnthropic(systemPrompt, userPrompt string, maxTokens int) (*AITextResponse, error) {
	request := AnthropicRequest{
		Model:       a.config.Model,
		System:      systemPrompt,
		Messages:    []AnthropicMessage{{Role: "user", Content: userPrompt}},
		Temperature: a.config.Temperature,
		MaxTokens:   maxTokens,
	}

	if a.config.Debug {
		fmt.Println("=== Anthropic API Request ===")
		reqJSON, _ := json.MarshalIndent(request, "", "  ")
		fmt.Println(string(reqJSON))
		fmt.Println("=============================")
		fmt.Println()
	}

	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal anthropic request: %v", err)
	}

	req, err := http.NewRequest("POST", a.config.OpenAIEndpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create anthropic request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Api-Key", a.config.APIKey)
	req.Header.Set("Anthropic-Version", a.config.AnthropicVersion)

	if a.config.Debug {
		fmt.Printf("=== Anthropic HTTP Request Details ===\n")
		fmt.Printf("Provider: %s\n", a.config.Provider)
		fmt.Printf("URL: %s\n", a.config.OpenAIEndpoint)
		fmt.Printf("Method: POST\n")
		fmt.Printf("Anthropic-Version: %s\n", a.config.AnthropicVersion)
		fmt.Printf("X-Api-Key Configured: %t\n", strings.TrimSpace(a.config.APIKey) != "")
		fmt.Printf("Body Length: %d bytes\n", len(jsonData))
		fmt.Printf("Timeout: %v\n", a.client.Timeout)
		fmt.Println("======================================")
		fmt.Println()
	}

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call anthropic API: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read anthropic response: %v", err)
	}

	if a.config.Debug {
		fmt.Printf("=== Anthropic HTTP Response Details ===\n")
		fmt.Printf("Status: %s\n", resp.Status)
		fmt.Printf("Content-Length: %d bytes\n", len(body))
		fmt.Printf("Raw Response Body:\n%s\n", string(body))
		fmt.Println("=======================================")
		fmt.Println()
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Anthropic API error: %s - %s", resp.Status, string(body))
	}

	var anthropicResp AnthropicResponse
	if err := json.Unmarshal(body, &anthropicResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal anthropic response: %v", err)
	}

	if anthropicResp.Error != nil {
		return nil, fmt.Errorf("Anthropic API error: %s", anthropicResp.Error.Message)
	}

	var contentParts []string
	for _, block := range anthropicResp.Content {
		if block.Type == "text" && strings.TrimSpace(block.Text) != "" {
			contentParts = append(contentParts, block.Text)
		}
	}
	if len(contentParts) == 0 {
		return nil, fmt.Errorf("no text content in anthropic response")
	}

	return &AITextResponse{
		Content:    strings.Join(contentParts, "\n"),
		TokensUsed: anthropicResp.Usage.InputTokens + anthropicResp.Usage.OutputTokens,
		Provider:   a.config.Provider,
	}, nil
}

func (a *AIFilterGenerator) callAIModel(systemPrompt, userPrompt string, maxTokens int, requireJSON bool) (*AITextResponse, error) {
	switch a.config.Provider {
	case AIProviderAnthropic:
		return a.callAnthropic(systemPrompt, userPrompt, maxTokens)
	default:
		return a.callOpenAI(systemPrompt, userPrompt, maxTokens, requireJSON)
	}
}

// min 辅助函数
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// parseAIResponse 解析AI响应
func (a *AIFilterGenerator) parseAIResponse(response *AITextResponse) (*AIFilterResponse, error) {
	content := response.Content

	if a.config.Debug {
		fmt.Println("=== AI Response Content Parsing ===")
		fmt.Printf("Original Content:\n%s\n", content)
		fmt.Println("===================================")
		fmt.Println()
	}

	// 尝试解析JSON响应
	var aiResponse struct {
		Analysis    string       `json:"analysis"`
		Suggestions []string     `json:"suggestions"`
		Filters     []FilterRule `json:"filters"`
	}

	// 清理响应内容，移除可能的markdown标记
	content = strings.TrimSpace(content)
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

	if a.config.Debug {
		fmt.Println("=== Cleaned Content for JSON Parsing ===")
		fmt.Printf("Cleaned Content:\n%s\n", content)
		fmt.Println("========================================")
		fmt.Println()
	}

	if err := json.Unmarshal([]byte(content), &aiResponse); err != nil {
		if a.config.Debug {
			fmt.Printf("=== JSON Parsing Error ===\n")
			fmt.Printf("Error: %v\n", err)
			fmt.Printf("Content that failed to parse:\n%s\n", content)
			fmt.Println("=========================")
			fmt.Println()
		}
		return &AIFilterResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to parse AI response as JSON: %v\nRaw response: %s", err, content),
		}, nil
	}

	if a.config.Debug {
		fmt.Println("=== Successfully Parsed AI Response ===")
		fmt.Printf("Analysis: %s\n", aiResponse.Analysis)
		fmt.Printf("Suggestions Count: %d\n", len(aiResponse.Suggestions))
		fmt.Printf("Filters Count: %d\n", len(aiResponse.Filters))
		for i, filter := range aiResponse.Filters {
			fmt.Printf("Filter %d: %+v\n", i+1, filter)
		}
		fmt.Println("======================================")
		fmt.Println()
	}

	return &AIFilterResponse{
		Success:     true,
		Filters:     aiResponse.Filters,
		Analysis:    aiResponse.Analysis,
		Suggestions: aiResponse.Suggestions,
		TokensUsed:  response.TokensUsed,
	}, nil
}

// GenerateFilters 生成过滤器
func (a *AIFilterGenerator) GenerateFilters(objs *connTrackerObjects, req AIFilterRequest) (*AIFilterResponse, error) {
	// 首先校验配置
	if err := a.ValidateConfig(); err != nil {
		return &AIFilterResponse{
			Success: false,
			Error:   fmt.Sprintf("Configuration validation failed: %v", err),
		}, nil
	}

	if a.config.Debug {
		fmt.Println("=== AI Filter Generation Debug Mode ===")
		fmt.Printf("Request: %+v\n", req)
		fmt.Println()
	}

	// 生成连接摘要
	connectionData, err := a.generateConnectionSummary(objs, req.IncludeICMP, req.IncludeTCP, req.IncludeStats)
	if err != nil {
		return &AIFilterResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to generate connection summary: %v", err),
		}, nil
	}

	if a.config.Debug {
		fmt.Println("=== Generated Connection Summary ===")
		fmt.Println(connectionData)
		fmt.Println("=====================================")
		fmt.Println()
	}

	// 生成系统提示词
	systemPrompt := a.generateSystemPrompt(req.AnalyzeType)

	// 如果有自定义提示词，添加到系统提示词中
	if req.CustomPrompt != "" {
		systemPrompt += "\n\nAdditional Instructions:\n" + req.CustomPrompt
	}

	if a.config.Debug {
		fmt.Println("=== Generated System Prompt ===")
		fmt.Println(systemPrompt)
		fmt.Println("===============================")
		fmt.Println()
	}

	userPrompt := fmt.Sprintf("Analyze the following network connection data and generate appropriate filter rules. Remember to respond ONLY with valid JSON:\n\n%s", connectionData)

	// 调用 AI API
	aiResp, err := a.callAIModel(systemPrompt, userPrompt, 2000, true)
	if err != nil {
		return &AIFilterResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to call AI API: %v", err),
		}, nil
	}

	if a.config.Debug {
		fmt.Println("=== AI Text Response ===")
		fmt.Printf("Provider: %s\n", aiResp.Provider)
		fmt.Printf("Tokens Used: %d\n", aiResp.TokensUsed)
		fmt.Printf("Content:\n%s\n", aiResp.Content)
		fmt.Println("========================")
		fmt.Println()
	}

	// 解析AI响应
	aiFilterResp, err := a.parseAIResponse(aiResp)
	if err != nil {
		return &AIFilterResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to parse AI response: %v", err),
		}, nil
	}

	if a.config.Debug {
		fmt.Println("=== Final AI Filter Response ===")
		finalJson, _ := json.MarshalIndent(aiFilterResp, "", "  ")
		fmt.Println(string(finalJson))
		fmt.Println("===============================")
		fmt.Println()
	}

	return aiFilterResp, nil
}
