package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/packetscope/metrics/pkg/bpf_engine"
	"github.com/packetscope/metrics/pkg/server"
)

func main() {
	log.Println("Starting bpf engine...")
	engine, err := bpf_engine.NewEngine()
	if err != nil {
		log.Fatalf("Failed to initialize BPF engine: %v", err)
	}
	defer engine.Close()

	log.Println("BPF engine started successfully, all probes attached")

	aggMap := engine.AggMap()

	mux := http.NewServeMux()
	wsHandler := func(w http.ResponseWriter, r *http.Request) {
		server.WsHandler(w, r, engine, aggMap)
	}
	// 同时注册根路径（前端兼容）和 /ws 路径
	mux.HandleFunc("/", wsHandler)
	mux.HandleFunc("/ws", wsHandler)

	port := os.Getenv("METRICS_PORT")
	if port == "" {
		port = "8020"
	}
	addr := ":" + port

	srv := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("Starting websocket server on %s (also /ws)", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	stopper := make(chan os.Signal, 1)
	signal.Notify(stopper, os.Interrupt, syscall.SIGTERM)
	<-stopper

	log.Println("Shutting down gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}
	log.Println("Done.")
}
