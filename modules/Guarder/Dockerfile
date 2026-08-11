# ============================================================
# Stage 1 — 编译
# ============================================================
FROM golang:1.22 AS builder

ENV CGO_ENABLED=1
ENV GOPROXY=https://goproxy.cn,direct

RUN apt-get update && apt-get install -y --no-install-recommends \
    clang llvm libbpf-dev libelf-dev zlib1g-dev pkg-config \
    linux-headers-generic make gcc g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

RUN go install github.com/cilium/ebpf/cmd/bpf2go@latest

COPY . .
RUN make deps && make

# ============================================================
# Stage 2 — 运行时（只带二进制 + 必要 .so）
# ============================================================
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    libbpf1 libelf1t64 zlib1g iproute2 net-tools tcpdump curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/conn-tracker /app/conn-tracker

WORKDIR /app
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -sf http://localhost:8080/api/stats || exit 1

CMD ["./conn-tracker", "-iface", "eth0", "-interval", "5", "-api", ":8080"]
