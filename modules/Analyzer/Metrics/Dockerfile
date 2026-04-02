# ---- Build stage ----
FROM golang:1.24-bookworm AS builder

ENV CGO_ENABLED=0
ENV GOPROXY=https://goproxy.cn,direct

# Install BPF build toolchain
RUN apt-get update && apt-get install -y --no-install-recommends \
    clang llvm libbpf-dev libelf-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# Cache Go module downloads
COPY go.mod go.sum ./
RUN go mod download

# Install bpf2go
RUN go install github.com/cilium/ebpf/cmd/bpf2go@latest

# Copy source
COPY . .

# Generate BPF bindings and build
RUN go generate ./pkg/bpf_engine/ebpf/
RUN go build -o /metrics ./cmd/metrics

# ---- Runtime stage ----
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libelf1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /metrics /usr/local/bin/metrics

EXPOSE 8020

# eBPF requires CAP_BPF + CAP_NET_ADMIN at minimum; typically run privileged
CMD ["metrics"]
