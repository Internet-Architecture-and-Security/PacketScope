FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV CGO_ENABLED=1

# Go proxy configuration
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=sum.golang.google.cn

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    make \
    build-essential \
    golang-go \
    gcc \
    g++ \
    clang \
    llvm \
    libbpf-dev \
    linux-headers-generic \
    linux-tools-generic \
    linux-tools-common \
    bpfcc-tools \
    libbpf-tools \
    iproute2 \
    net-tools \
    tcpdump \
    libelf-dev \
    zlib1g-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN go version

# Copy module source
COPY . /Calculator
WORKDIR /Calculator

# Install Go dependencies
RUN go mod tidy
RUN go mod download

# Install bpf2go for eBPF code generation
RUN go install github.com/cilium/ebpf/cmd/bpf2go@latest

# Build
RUN make

# Default WebSocket port
ENV METRICS_PORT=8020

EXPOSE 8020

CMD ["./metrics"]
