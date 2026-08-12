#!/bin/sh
set -e

echo "PacketScope Analyzer-Monitor starting..."

# Detect default network interface (override with IFACE env var)
IFACE="${IFACE:-$(ip -br route show default | awk '{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}')}"
IFACE="${IFACE:-eth0}"
echo "Using network interface: $IFACE"

# Wait for PostgreSQL (separate container on host network)
echo "Waiting for PostgreSQL at ${PG_HOST}:${PG_PORT}..."
until pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" >/dev/null 2>&1; do
    sleep 1
done
echo "PostgreSQL is ready."

# Create databases if needed
psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -c "ALTER USER $PG_USER WITH PASSWORD '$PG_PASSWORD';" 2>/dev/null || true
createdb -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" "$PG_DBNAME_PACKET" 2>/dev/null || echo "DB $PG_DBNAME_PACKET exists"
createdb -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" "$PG_DBNAME_FUNCTION" 2>/dev/null || echo "DB $PG_DBNAME_FUNCTION exists"

# Start analyzer
./analyzer -iface "$IFACE" &
echo "analyzer started (PID $!)"

# Start qserver
./qserver &
echo "qserver started (PID $!)"

wait
