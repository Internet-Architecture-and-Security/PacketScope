# 定义Go模块名称和BPF程序名称
MODULE=packetscope-analyzer
BPF_BATCH_PROGRAM=kProberFunc
BPF_TCX_PROGRAM=tcxProber

# 定义编译器和编译选项
CLANG=clang
LLVM_STRIP=llvm-strip
ARCH=$(shell uname -m | sed 's/x86_64/x86/')
SYS_ARCH=$(shell uname -m)
BPF_CFLAGS=-O2 -g -Wall -Werror -target bpf -D__TARGET_ARCH_$(ARCH) -c

# 默认目标
all: ./kbatch/$(BPF_BATCH_PROGRAM)_bpfel.go ./tcxprober/$(BPF_TCX_PROGRAM)_bpfel.go analyzer server
	
prepare: ./base/baserun.go ./base/main.go ./base/ReadBTFandGetItsMember.go ./base/TransUtilSec.go ./base/translateJSON.go
    go mod tidy
	cd ./base && go mod tidy && go build -o ../baserun ./baserun.go ./main.go ./ReadBTFandGetItsMember.go ./TransUtilSec.go ./translateJSON.go
	./baserun

server: ./server/main.go ./server/database.go ./server/sockets.go
	cd ./server && go mod tidy && go build -o ../qserver ./main.go ./database.go ./sockets.go

# 使用bpf2go编译BPF程序
./kbatch/$(BPF_BATCH_PROGRAM)_bpfel.go: ./kbatch/$(BPF_BATCH_PROGRAM).bpf.c ./kbatch/vmlinux.h
	go run github.com/cilium/ebpf/cmd/bpf2go -cc $(CLANG) -cflags "$(BPF_CFLAGS)" -no-strip -go-package kbatch -output-dir ./kbatch $(BPF_BATCH_PROGRAM) ./kbatch/$(BPF_BATCH_PROGRAM).bpf.c

./tcxprober/$(BPF_TCX_PROGRAM)_bpfel.go: ./tcxprober/$(BPF_TCX_PROGRAM).bpf.c
	go run github.com/cilium/ebpf/cmd/bpf2go -cc $(CLANG) -cflags "$(BPF_CFLAGS)" -no-strip -go-package tcxprober -output-dir ./tcxprober $(BPF_TCX_PROGRAM) ./tcxprober/$(BPF_TCX_PROGRAM).bpf.c -- -I/usr/include/$(SYS_ARCH)-linux-gnu

# 构建根目录main.go
analyzer: ./kbatch/$(BPF_BATCH_PROGRAM)_bpfel.go ./tcxprober/$(BPF_TCX_PROGRAM)_bpfel.go
	go build -o ./analyzer ./main.go

# 清理生成的文件
clean:
	rm -f ./kbatch/$(BPF_BATCH_PROGRAM) ./kbatch/$(BPF_BATCH_PROGRAM)_bpfel.go ./kbatch/$(BPF_BATCH_PROGRAM)_bpfel.o ./kbatch/$(BPF_BATCH_PROGRAM)_bpfeb.go ./kbatch/$(BPF_BATCH_PROGRAM)_bpfeb.o
	rm -f ./tcxprober/$(BPF_TCX_PROGRAM) ./tcxprober/$(BPF_TCX_PROGRAM)_bpfel.go ./tcxprober/$(BPF_TCX_PROGRAM)_bpfel.o ./tcxprober/$(BPF_TCX_PROGRAM)_bpfeb.go ./tcxprober/$(BPF_TCX_PROGRAM)_bpfeb.o
	rm -f ./analyzer

# 安装依赖
deps:
	go mod tidy

.PHONY: all build clean deps
