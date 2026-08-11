# ============================================================
# Stage 1 — 编译
# ============================================================
FROM golang:1.22 AS builder

ENV CGO_ENABLED=1
ENV GOPROXY=https://goproxy.cn,direct

RUN apt-get update && apt-get install -y --no-install-recommends \
    clang llvm libbpf-dev libelf-dev zlib1g-dev pkg-config make gcc g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN go install github.com/cilium/ebpf/cmd/bpf2go@latest

COPY . /Monitor
WORKDIR /Monitor

RUN printf '\nreplace (\n\tgithub.com/Internet-Architecture-and-Security/PacketScope/modules/Analyzer/Monitor/base => ./base\n\tgithub.com/Internet-Architecture-and-Security/PacketScope/modules/Analyzer/Monitor/server => ./server\n)\n' >> go.mod

RUN go mod tidy && go mod download

RUN cd ./base && go mod tidy && go build -o ../baserun ./baserun.go ./main.go ./ReadBTFandGetItsMember.go ./TransUtilSec.go ./translateJSON.go

RUN make && make server

# ============================================================
# Stage 2 — 运行时
# ============================================================
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    libbpf1 libelf1t64 zlib1g libpq5 postgresql postgresql-contrib postgresql-client \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

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
