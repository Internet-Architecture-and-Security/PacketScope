# ============================================================
# Stage 1 — 编译
# ============================================================
FROM golang:1.22 AS builder

ENV CGO_ENABLED=1
ENV GOPROXY=https://goproxy.cn,direct

RUN apt-get update && apt-get install -y --no-install-recommends \
    clang llvm libbpf-dev libelf-dev zlib1g-dev pkg-config make gcc g++ \
    && rm -rf /var/lib/apt/lists/*

RUN go install github.com/cilium/ebpf/cmd/bpf2go@latest

COPY . /Calculator
WORKDIR /Calculator

RUN go mod tidy && go mod download && make

# ============================================================
# Stage 2 — 运行时
# ============================================================
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    libbpf1 libelf1t64 zlib1g ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /Calculator/metrics /Calculator/metrics

WORKDIR /Calculator

ENV METRICS_PORT=8020
EXPOSE 8020

CMD ["./metrics"]
