#!/bin/bash
set -e

# Install kernel-matching tools at runtime (matching install.sh's linux-tools-$(uname -r))
KVER=$(uname -r)
echo "Installing linux-tools and linux-headers for kernel $KVER..."
(apt-get update -qq 2>/dev/null && apt-get install -y -qq \
    linux-tools-"$KVER" \
    linux-headers-"$KVER" \
    2>/dev/null) || echo "WARNING: kernel-specific packages for $KVER not available, using generic tools"

# Re-generate BTF data for the host kernel (requires /sys/kernel/btf/vmlinux)
echo "Running baserun to generate host-kernel BTF data..."
./baserun 2>/dev/null && { echo "Rebuilding eBPF programs with host-kernel BTF..."; make && make server; } || echo "WARNING: baserun failed, using pre-built binaries"

# Configure PostgreSQL to trust local connections for initialization
sed -i 's/host\s\+all\s\+all\s\+127.0.0.1\/32\s\+scram-sha-256/host all all 127.0.0.1\/32 trust/' /etc/postgresql/16/main/pg_hba.conf
sed -i 's/host\s\+all\s\+all\s\+::1\/128\s\+scram-sha-256/host all all ::1\/128 trust/' /etc/postgresql/16/main/pg_hba.conf

# Start PostgreSQL
service postgresql start

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to start..."
until pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" >/dev/null 2>&1; do
    sleep 1
done
echo "PostgreSQL is ready."

# Configure user password
psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -c "ALTER USER $PG_USER WITH PASSWORD '$PG_PASSWORD';" 2>/dev/null || true

# Create databases if they don't exist
createdb -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" "$PG_DBNAME_PACKET" 2>/dev/null || echo "Database $PG_DBNAME_PACKET already exists"
createdb -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" "$PG_DBNAME_FUNCTION" 2>/dev/null || echo "Database $PG_DBNAME_FUNCTION already exists"

# Restore pg_hba.conf to use password auth for security
sed -i 's/host\s\+all\s\+all\s\+127.0.0.1\/32\s\+trust/host all all 127.0.0.1\/32 scram-sha-256/' /etc/postgresql/16/main/pg_hba.conf
sed -i 's/host\s\+all\s\+all\s\+::1\/128\s\+trust/host all all ::1\/128 scram-sha-256/' /etc/postgresql/16/main/pg_hba.conf
service postgresql reload

# Detect default network interface (override with IFACE env var)
IFACE="${IFACE:-$(ip -br route show default | awk '{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}')}"
IFACE="${IFACE:-eth0}"
echo "Using network interface: $IFACE"

# Start analyzer in background
./analyzer -iface "$IFACE" &
ANALYZER_PID=$!

# Start qserver in background
./qserver &
QSERVER_PID=$!

# Wait for either process to exit
wait -n $ANALYZER_PID $QSERVER_PID
