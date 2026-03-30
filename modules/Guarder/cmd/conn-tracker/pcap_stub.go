//go:build !pcap
// +build !pcap

package main

import (
	"encoding/json"
	"net/http"
)

// PCAPAnalysisRequest PCAP分析请求
type PCAPAnalysisRequest struct {
	CustomPrompt string `json:"custom_prompt,omitempty"`
	AnalyzeType  string `json:"analyze_type"`
}

// PCAPAnalysisResponse PCAP分析响应
type PCAPAnalysisResponse struct {
	Success     bool         `json:"success"`
	Analysis    string       `json:"analysis,omitempty"`
	Threats     []ThreatInfo `json:"threats,omitempty"`
	Statistics  interface{}  `json:"statistics,omitempty"`
	Suggestions []string     `json:"suggestions,omitempty"`
	Error       string       `json:"error,omitempty"`
}

// ThreatInfo 威胁信息
type ThreatInfo struct {
	Severity    string `json:"severity"`
	Type        string `json:"type"`
	Description string `json:"description"`
	SourceIP    string `json:"source_ip,omitempty"`
	TargetIP    string `json:"target_ip,omitempty"`
	TargetPort  uint16 `json:"target_port,omitempty"`
}

// PCAPAnalyzer PCAP分析器（存根版本）
type PCAPAnalyzer struct {
	aiGenerator *AIFilterGenerator
}

// NewPCAPAnalyzer 创建PCAP分析器
func NewPCAPAnalyzer(aiGenerator *AIFilterGenerator) *PCAPAnalyzer {
	return &PCAPAnalyzer{
		aiGenerator: aiGenerator,
	}
}

// AnalyzePCAPFile 分析PCAP文件（存根）
func (pa *PCAPAnalyzer) AnalyzePCAPFile(filePath string, req PCAPAnalysisRequest) (*PCAPAnalysisResponse, error) {
	return &PCAPAnalysisResponse{
		Success: false,
		Error:   "PCAP analysis is not available. Please build with 'go build -tags pcap' and ensure libpcap-dev is installed.",
	}, nil
}

// AnalyzePCAPData 分析PCAP数据（存根）
func (pa *PCAPAnalyzer) AnalyzePCAPData(data []byte, req PCAPAnalysisRequest) (*PCAPAnalysisResponse, error) {
	return pa.AnalyzePCAPFile("", req)
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

	resp := PCAPAnalysisResponse{
		Success: false,
		Error:   "PCAP analysis is not available in this build. Please build with 'go build -tags pcap' and ensure libpcap-dev is installed.",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
