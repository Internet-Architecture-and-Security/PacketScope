FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV CGO_ENABLED=1

# Go proxy configuration
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=sum.golang.google.cn

# Install system dependencies + PostgreSQL (aligned with install.sh)
RUN apt-get update && apt-get install -y \
    clang \
    llvm \
    libbpf-dev \
    linux-tools-common \
    linux-tools-generic \
    linux-headers-generic \
    libelf-dev \
    zlib1g-dev \
    build-essential \
    golang-go \
    make \
    wget \
    git \
    gcc \
    g++ \
    postgresql \
    postgresql-contrib \
    postgresql-client \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN go version

# Copy module source
COPY . /Monitor
WORKDIR /Monitor

# Add replace directives for local sub-modules before dependency resolution
RUN printf '\nreplace (\n\tgithub.com/Internet-Architecture-and-Security/PacketScope/modules/Analyzer/Monitor/base => ./base\n\tgithub.com/Internet-Architecture-and-Security/PacketScope/modules/Analyzer/Monitor/server => ./server\n)\n' >> go.mod

# Install Go dependencies
RUN go mod tidy
RUN go mod download

# Install bpf2go for eBPF code generation
RUN go install github.com/cilium/ebpf/cmd/bpf2go@latest

# Build baserun tool (compile only, not run — it needs host kernel BTF at runtime)
RUN cd ./base && go mod tidy && go build -o ../baserun ./baserun.go ./main.go ./ReadBTFandGetItsMember.go ./TransUtilSec.go ./translateJSON.go

# Build eBPF programs and binaries using checked-in vmlinux.h / kProberFunc.bpf.c
RUN make && make server

# Configure PostgreSQL environment variables
ENV PG_HOST=localhost \
    PG_PORT=5432 \
    PG_USER=postgres \
    PG_PASSWORD=password \
    PG_DBNAME_PACKET=tcxprober \
    PG_DBNAME_FUNCTION=functioninfo \
    PG_SSLMODE=disable

RUN chmod +x /Monitor/entrypoint.sh /Monitor/analyzer /Monitor/qserver /Monitor/baserun

ENTRYPOINT ["/Monitor/entrypoint.sh"]
