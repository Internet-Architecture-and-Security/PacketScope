# 定义Go模块名称和BPF程序名称
MODULE=packetscope-Calculator
BPF_METRICS_PROGRAM=metrics

# 定义编译器和编译选项
CLANG=clang
LLVM_STRIP=llvm-strip
ARCH=$(shell uname -m | sed 's/x86_64/x86/')
SYS_ARCH=$(shell uname -m)
BPF_CFLAGS=-O2 -g -Wall -Werror -target bpf -D__TARGET_ARCH_$(ARCH) -c

# 默认目标
all: ./pkg/bpf_engine/engine.go ./pkg/aggregation/aggregation.go ./pkg/server/websocket.go ./cmd/metrics/main.go
	go run github.com/cilium/ebpf/cmd/bpf2go -cc $(CLANG) -cflags "$(BPF_CFLAGS)" -no-strip -go-package bpf_engine -output-dir ./pkg/bpf_engine/ Bpf ./pkg/bpf_engine/metrics.c
	go build -o ./metrics ./cmd/metrics/main.go