# ============================================================
# Stage 1 — 编译
# ============================================================
FROM golang:1.25-alpine AS builder

ENV CGO_ENABLED=1
ENV GOPROXY=https://goproxy.cn,direct

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && apk add --no-cache clang llvm libbpf-dev elfutils-dev zlib-dev pkgconfig make gcc musl-dev linux-headers libpq-dev

RUN go install github.com/cilium/ebpf/cmd/bpf2go@latest

COPY . /Monitor
WORKDIR /Monitor

RUN printf '\nreplace (\n\tgithub.com/Internet-Architecture-and-Security/PacketScope/modules/Analyzer/Monitor/base => ./base\n\tgithub.com/Internet-Architecture-and-Security/PacketScope/modules/Analyzer/Monitor/server => ./server\n)\n' >> go.mod

RUN go mod tidy && go mod download

RUN cd ./base && go mod tidy && go build -o ../baserun ./baserun.go ./main.go ./ReadBTFandGetItsMember.go ./TransUtilSec.go ./translateJSON.go

RUN make && make server

# ============================================================
# Stage 2 — 运行时（~55MB，不含 PostgreSQL）
# ============================================================
FROM alpine:3.21

RUN apk add --no-cache libbpf elfutils-libelf zlib libc6-compat libpq postgresql-client

COPY --from=builder /Monitor/analyzer    /Monitor/analyzer
COPY --from=builder /Monitor/qserver     /Monitor/qserver
COPY --from=builder /Monitor/baserun     /Monitor/baserun
COPY --from=builder /Monitor/entrypoint.sh /Monitor/entrypoint.sh

RUN chmod +x /Monitor/entrypoint.sh /Monitor/analyzer /Monitor/qserver /Monitor/baserun

ENV PG_HOST=localhost \
    PG_PORT=5432 \
    PG_USER=postgres \
    PG_PASSWORD=password \
    PG_DBNAME_PACKET=tcxprober \
    PG_DBNAME_FUNCTION=functioninfo \
    PG_SSLMODE=disable

EXPOSE 8010

ENTRYPOINT ["/Monitor/entrypoint.sh"]
