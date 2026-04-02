#!/bin/bash
# start.sh
# Check for root privileges
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (or use sudo)"
  exit
fi

# Determine script directory to find the bin
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BIN_PATH="${SCRIPT_DIR}/../bin/metrics"

if [ ! -f "$BIN_PATH" ]; then
    echo "Executable not found at ${BIN_PATH}. Building..."
    cd "${SCRIPT_DIR}/.." && go build -o bin/metrics ./cmd/metrics
fi

echo "Starting Metrics Core (eBPF)..."
exec "${BIN_PATH}"