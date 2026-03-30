package main

import (
    "encoding/json"
    "fmt"
    "log"
    "net"
    "net/http"
    "strings"
    "sync"

    "github.com/karma/conn-tracker/pkg/bpf"
)

type APIServer struct {
    objs          *connTrackerObjects
    filterManager *FilterManager
    aiGenerator   *AIFilterGenerator
    pcapAnalyzer  *PCAPAnalyzer
    mu            sync.RWMutex
}

func NewAPIServer(objs *connTrackerObjects) *APIServer {
    filterManager := NewFilterManager(objs.FilterMap)

    aiConfig := AIFilterConfig{
        OpenAIEndpoint: "https://api.openai.com/v1/chat/completions",
        Model:          "gpt-3.5-turbo",
        Temperature:    0.7,
    }
    aiGenerator := NewAIFilterGenerator(aiConfig)
    pcapAnalyzer := NewPCAPAnalyzer(aiGenerator)

    return &APIServer{
        objs:          objs,
        filterManager: filterManager,
        aiGenerator:   aiGenerator,
        pcapAnalyzer:  pcapAnalyzer,
    }
}

func (s *APIServer) Start(addr string) error {
    http.HandleFunc("/api/connections", s.handleConnections)
    http.HandleFunc("/api/icmp", s.handleICMP)
    http.HandleFunc("/api/stats", s.handleStats)
    http.HandleFunc("/api/filters", s.handleFilterRules)
    http.HandleFunc("/api/filters/", s.handleFilterRule)
    http.HandleFunc("/api/ai/config", s.handleAIConfig)
    http.HandleFunc("/api/ai/status", s.handleAIStatus)
    http.HandleFunc("/api/ai/generate", s.handleAIGenerate)
    http.HandleFunc("/api/ai/analyze", s.handleAIAnalyze)
    http.HandleFunc("/api/pcap/analyze", s.handlePCAPAnalyze)

    fs := http.FileServer(http.Dir("./frontend"))
    http.Handle("/", fs)

    log.Printf("Starting API server on %s", addr)
    log.Printf("Web interface available at http://%s", addr)
    return http.ListenAndServe(addr, nil)
}

func (s *APIServer) handleConnections(w http.ResponseWriter, r *http.Request) {
    s.enableCORS(w, r)
    if r.Method == "OPTIONS" {
        return
    }

    s.mu.RLock()
    defer s.mu.RUnlock()

    connections, err := GetConnections(s.objs.ConnMap)
    if err != nil {
        http.Error(w, fmt.Sprintf("Error getting connections: %v", err), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(connections)
}

func (s *APIServer) handleICMP(w http.ResponseWriter, r *http.Request) {
    s.enableCORS(w, r)
    if r.Method == "OPTIONS" {
        return
    }

    s.mu.RLock()
    defer s.mu.RUnlock()

    icmpEntries, err := GetICMPEntries(s.objs.IcmpMap)
    if err != nil {
        http.Error(w, fmt.Sprintf("Error getting ICMP entries: %v", err), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(icmpEntries)
}

func (s *APIServer) handleStats(w http.ResponseWriter, r *http.Request) {
    s.enableCORS(w, r)
    if r.Method == "OPTIONS" {
        return
    }

    s.mu.RLock()
    defer s.mu.RUnlock()

    var stats bpf.PerfStats
    var key uint32 = 0

    if err := s.objs.PerfStatsMap.Lookup(&key, &stats); err != nil {
        stats = bpf.PerfStats{}
        log.Printf("Warning: Could not read stats from map: %v", err)
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(stats)
}

func (s *APIServer) handleAIConfig(w http.ResponseWriter, r *http.Request) {
    s.enableCORS(w, r)
    if r.Method == "OPTIONS" {
        return
    }

    switch r.Method {
    case "GET":
        config := struct {
            OpenAIEndpoint string  `json:"openai_endpoint"`
            Model          string  `json:"model"`
            Temperature    float64 `json:"temperature"`
            Debug          bool    `json:"debug"`
            Timeout        int     `json:"timeout"`
        }{
            OpenAIEndpoint: s.aiGenerator.config.OpenAIEndpoint,
            Model:          s.aiGenerator.config.Model,
            Temperature:    s.aiGenerator.config.Temperature,
            Debug:          s.aiGenerator.config.Debug,
            Timeout:        s.aiGenerator.config.Timeout,
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(config)

    case "POST":
        var config AIFilterConfig
        if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
            http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
            return
        }

        if config.OpenAIEndpoint == "" {
            config.OpenAIEndpoint = "https://api.openai.com/v1/chat/completions"
        }
        if config.Model == "" {
            config.Model = "gpt-3.5-turbo"
        }
        if config.Temperature == 0 {
            config.Temperature = 0.7
        }
        if config.Timeout == 0 {
            config.Timeout = 120
        }

        log.Printf("AI configuration updated: Model=%s, Timeout=%ds, Debug=%v",
            config.Model, config.Timeout, config.Debug)

        s.mu.Lock()
        s.aiGenerator = NewAIFilterGenerator(config)
        s.pcapAnalyzer = NewPCAPAnalyzer(s.aiGenerator)
        s.mu.Unlock()

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "AI configuration updated"})

    default:
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
    }
}

func (s *APIServer) handleAIStatus(w http.ResponseWriter, r *http.Request) {
    s.enableCORS(w, r)
    if r.Method == "OPTIONS" {
        return
    }

    if r.Method != "GET" {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    s.mu.RLock()
    isConfigured := s.aiGenerator.IsConfigured()
    hasAPIKey := strings.TrimSpace(s.aiGenerator.config.APIKey) != ""
    hasEndpoint := strings.TrimSpace(s.aiGenerator.config.OpenAIEndpoint) != ""
    hasModel := strings.TrimSpace(s.aiGenerator.config.Model) != ""
    s.mu.RUnlock()

    status := struct {
        IsConfigured bool `json:"is_configured"`
        HasAPIKey    bool `json:"has_api_key"`
        HasEndpoint  bool `json:"has_endpoint"`
        HasModel     bool `json:"has_model"`
    }{
        IsConfigured: isConfigured,
        HasAPIKey:    hasAPIKey,
        HasEndpoint:  hasEndpoint,
        HasModel:     hasModel,
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(status)
}

func (s *APIServer) handleAIGenerate(w http.ResponseWriter, r *http.Request) {
    s.enableCORS(w, r)
    if r.Method == "OPTIONS" {
        return
    }

    if r.Method != "POST" {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var req AIFilterRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
        return
    }

    if req.AnalyzeType == "" {
        req.AnalyzeType = "security"
    }
    if !req.IncludeICMP && !req.IncludeTCP && !req.IncludeStats {
        req.IncludeTCP = true
        req.IncludeICMP = true
        req.IncludeStats = true
    }

    s.mu.RLock()
    resp, err := s.aiGenerator.GenerateFilters(s.objs, req)
    s.mu.RUnlock()

    if err != nil {
        http.Error(w, fmt.Sprintf("Failed to generate filters: %v", err), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(resp)
}

func (s *APIServer) handleAIAnalyze(w http.ResponseWriter, r *http.Request) {
    s.enableCORS(w, r)
    if r.Method == "OPTIONS" {
        return
    }

    if r.Method != "POST" {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var req struct {
        CustomPrompt string `json:"custom_prompt,omitempty"`
        IncludeICMP  bool   `json:"include_icmp"`
        IncludeTCP   bool   `json:"include_tcp"`
        IncludeStats bool   `json:"include_stats"`
    }

    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
        return
    }

    if !req.IncludeICMP && !req.IncludeTCP && !req.IncludeStats {
        req.IncludeTCP = true
        req.IncludeICMP = true
        req.IncludeStats = true
    }

    s.mu.RLock()
    summary, err := s.aiGenerator.generateConnectionSummary(s.objs, req.IncludeICMP, req.IncludeTCP, req.IncludeStats)
    s.mu.RUnlock()

    if err != nil {
        http.Error(w, fmt.Sprintf("Failed to generate summary: %v", err), http.StatusInternalServerError)
        return
    }

    response := struct {
        Success bool   `json:"success"`
        Summary string `json:"summary"`
    }{
        Success: true,
        Summary: summary,
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

// 设置 CORS Header
func (s *APIServer) enableCORS(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

func formatIP(ip uint32) string {
    return net.IP{byte(ip), byte(ip >> 8), byte(ip >> 16), byte(ip >> 24)}.String()
}

func formatTCPFlags(flags uint8) string {
    var result []string
    if flags&(1<<1) != 0 {
        result = append(result, "SYN")
    }
    if flags&(1<<2) != 0 {
        result = append(result, "ACK")
    }
    if flags&(1<<3) != 0 {
        result = append(result, "FIN")
    }
    if flags&(1<<4) != 0 {
        result = append(result, "RST")
    }
    if flags&(1<<5) != 0 {
        result = append(result, "PSH")
    }
    if flags&(1<<6) != 0 {
        result = append(result, "URG")
    }
    if len(result) == 0 {
        return "NONE"
    }
    return strings.Join(result, "|")
}
