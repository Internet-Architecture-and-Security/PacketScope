#!/bin/bash
set -e

MONITOR_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "INFO: $1"; }
log_success() { echo -e "${GREEN}SUCCESS: $1${NC}"; }
log_error() { echo -e "${RED}ERROR: $1${NC}"; }
log_warn() { echo -e "${YELLOW}WARN: $1${NC}"; }

check_cmd() {
    if ! command -v "$1" &> /dev/null; then
        log_error "Command $1 not found"
        return 1
    fi
    return 0
}

detect_os() {
    [ -f /etc/debian_version ] && echo "debian" && return
    [ -f /etc/redhat-release ] && echo "centos" && return
    echo "unknown"
}

install_deps_debian() {
    log_info "Installing Debian/Ubuntu dependencies..."
    sudo apt-get update -y && sudo apt-get install -y \
        clang llvm libbpf-dev linux-tools-common linux-tools-$(uname -r) \
        linux-headers-$(uname -r) libelf-dev zlib1g-dev build-essential golang-go make \
        wget git build-essential gcc g++ postgresql postgresql-contrib libpq-dev
}

install_deps_centos() {
    log_info "Installing CentOS/RHEL dependencies... - AI generated and not tested."
    sudo yum install -y \
        clang llvm libbpf-devel kernel-tools kernel-devel \
        elfutils-libelf-devel zlib-devel gcc make g++ wget git 
    if ! check_cmd go; then
        curl -sL https://dl.google.com/go/go1.25.10.linux-amd64.tar.gz -o /tmp/go.tar.gz
        sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf /tmp/go.tar.gz
        export PATH="$PATH:/usr/local/go/bin"
    fi
}

install_postgres() {
    local os=$1
    log_info "Installing and configuring PostgreSQL..."
    
    if [ "$os" = "debian" ]; then
        # Install PostgreSQL
        if ! check_cmd psql; then
            sudo apt-get install -y postgresql postgresql-contrib libpq-dev
        fi
        sudo systemctl enable postgresql && sudo systemctl start postgresql
        
    elif [ "$os" = "centos" ]; then
        # Install PostgreSQL 15
        if ! check_cmd psql; then
            sudo yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm
            sudo yum install -y postgresql15-server postgresql15-contrib postgresql15-devel
            sudo /usr/pgsql-15/bin/postgresql-15-setup initdb
        fi
        sudo systemctl enable postgresql-15 && sudo systemctl start postgresql-15
        
    else
        log_warn "Unknown OS, assuming PostgreSQL is already installed"
    fi
    
    # Configure PostgreSQL - common settings
    log_info "Configuring PostgreSQL databases and user..."
    
    # Set password for postgres user (matches database.go default)
    sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'password';"
    
    # Create tcxprober database for packet data (PostgreSQL compatible way)
    if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw tcxprober; then
        sudo -u postgres psql -c "CREATE DATABASE tcxprober;"
    fi
    
    # Create functioninfo database for function call data
    if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw functioninfo; then
        sudo -u postgres psql -c "CREATE DATABASE functioninfo;"
    fi
    
    log_success "PostgreSQL configuration completed."
}

main() {
    echo "========================================"
    echo "  PacketScope Monitor One-Click Install"
    echo "========================================"

    os=$(detect_os)
    log_info "Detected OS: $os"

    case "$os" in
        "debian") install_deps_debian ;;
        "centos") install_deps_centos ;;
        *) log_warn "Unknown OS, please install clang/llvm/libbpf/golang manually" ;;
    esac

    check_cmd go || { log_error "Go not installed"; exit 1; }
    check_cmd clang || { log_error "Clang not installed"; exit 1; }

    echo "Set go proxy for faster downloads in China"
    echo "Please disable this for foreign users."
    echo "You can shut this shell before that change your configuration..."
    export GOPROXY=https://goproxy.cn,direct

    # go mod install
    go mod tidy

    log_info "Installing bpf2go..."
    go install github.com/cilium/ebpf/cmd/bpf2go@latest

    install_postgres "$os"

    log_info "Building with Make..."
    make prepare
    make -C "$MONITOR_DIR"
    make server
    chmod +x analyzer qserver baserun 2>/dev/null || true

    echo "========================================"
    log_success "Installation completed!"
    echo "========================================"
    echo "Binaries: analyzer, qserver, baserun"
    echo "Usage: sudo ./analyzer (requires root for eBPF)"
    echo ""
    echo "Database configuration:"
    echo "  - Databases: tcxprober, functioninfo"
    echo "  - User: postgres"
    echo "  - Password: password"
    echo "  - Host: localhost (PG_HOST)"
    echo "  - Port: 5432 (PG_PORT)"
}

main "$@"
