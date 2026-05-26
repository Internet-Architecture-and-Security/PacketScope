package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// BaseRun performs the same actions as the original baserun.py:
// - ensure .cache directory exists
// - remove .cache/FunctionInfo.db and .cache/PacketInfo.db if present
// - remove ./.cache/btf.json (force)
// - run `bpftool -j btf dump file /sys/kernel/btf/vmlinux` and write stdout to ./.cache/btf.json
// Returns an error on failure.
func BaseRun() error {
	cacheDir := ".cache"
	if err := ensureCache(cacheDir); err != nil {
		return err
	}
	batchDir := "kbatch"
	// remove specific DB files if they exist
	_ = removeIfExists(filepath.Join(cacheDir, "FunctionInfo.db"))
	_ = removeIfExists(filepath.Join(cacheDir, "PacketInfo.db"))

	// remove existing btf.json (like `rm -f ./.cache/btf.json`)
	_ = removeIfExists(filepath.Join(cacheDir, "btf.json"))
	_ = removeIfExists(filepath.Join(batchDir, "vmlinux.h"))
	// create output file with O_EXCL behavior (like Python 'x')
	outPath := filepath.Join(cacheDir, "btf.json")
	outFilenewPath := filepath.Join(batchDir, "vmlinux.h")
	outFile, err := os.OpenFile(outPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("create output file failed: %w", err)
	}
	defer outFile.Close()

	outFilenew, err := os.OpenFile(outFilenewPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("create output file failed: %w", err)
	}
	defer outFilenew.Close()

	// run bpftool and write stdout into the file
	cmd := exec.Command("bpftool", "-j", "btf", "dump", "file", "/sys/kernel/btf/vmlinux")
	cmd.Stdout = outFile
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("bpftool command failed: %w", err)
	}
	bpftoolCmd := exec.Command("bpftool", "btf", "dump", "file", "/sys/kernel/btf/vmlinux", "format", "c")
	bpftoolCmd.Stdout = outFilenew
	bpftoolCmd.Stderr = os.Stderr
	if err := bpftoolCmd.Run(); err != nil {
		return fmt.Errorf("bpftool command failed: %w", err)
	}
	return nil
}

func ensureCache(dir string) error {
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create cache dir %s: %w", dir, err)
		}
	}
	return nil
}

func removeIfExists(path string) error {
	if _, err := os.Stat(path); err == nil {
		if err := os.Remove(path); err != nil {
			return fmt.Errorf("failed to remove %s: %w", path, err)
		}
	}
	return nil
}
