# ============================================================
# Stage 1 — 编译
# ============================================================
FROM golang:1.22-alpine AS builder

ENV CGO_ENABLED=1
ENV GOPROXY=https://goproxy.cn,direct

RUN apk add --no-cache clang llvm libbpf-dev elfutils-dev zlib-dev pkgconfig make gcc musl-dev linux-headers

RUN go install github.com/cilium/ebpf/cmd/bpf2go@latest

COPY . /Calculator
WORKDIR /Calculator

RUN go mod tidy && go mod download && make

# ============================================================
# Stage 2 — 运行时（alpine，~30MB 基础）
# ============================================================
FROM alpine:3.21

RUN apk add --no-cache libbpf elfutils-libelf zlib libc6-compat

COPY --from=builder /Calculator/metrics /Calculator/metrics

WORKDIR /Calculator
ENV METRICS_PORT=8020
EXPOSE 8020

CMD ["./metrics"]
