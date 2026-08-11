# ============================================================
# Stage 1 — 编译
# ============================================================
FROM golang:1.22-alpine AS builder

ENV CGO_ENABLED=1
ENV GOPROXY=https://goproxy.cn,direct

RUN apk add --no-cache clang llvm libbpf-dev elfutils-dev zlib-dev pkgconfig make gcc musl-dev linux-headers

RUN go install github.com/cilium/ebpf/cmd/bpf2go@latest

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN make deps && make

# ============================================================
# Stage 2 — 运行时（~40MB）
# ============================================================
FROM alpine:3.21

RUN apk add --no-cache libbpf elfutils-libelf zlib libc6-compat iproute2 curl ca-certificates

COPY --from=builder /app/conn-tracker /app/conn-tracker

WORKDIR /app
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -sf http://localhost:8080/api/stats || exit 1

CMD ["./conn-tracker", "-iface", "eth0", "-interval", "5", "-api", ":8080"]
