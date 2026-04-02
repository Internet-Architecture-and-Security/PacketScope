package test

import (
	"os"
	"testing"

	"github.com/packetscope/metrics/pkg/bpf_engine"
)

// TestBPFEngine ensures that the BPF program compiles and loads correctly.
func TestBPFEngine(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("Skipping BPF test because it requires root privileges")
	}

	engine, err := bpf_engine.NewEngine()
	if err != nil {
		t.Fatalf("Expected BPF engine to load, but got error: %v", err)
	}
	defer engine.Close()

	// Try reading one event or timeout
	// Note: Without real traffic that triggers the hook, we might not get an event easily
	// We just test if it initialized and attached properly without crashing.
	t.Log("BPF engine successfully loaded and attached to complete the TDD cycle.")
}
