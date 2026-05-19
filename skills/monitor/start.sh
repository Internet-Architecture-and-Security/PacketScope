#!/usr/bin/env bash
# PacketScope Monitor MCP Server Startup Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default configuration
export MONITOR_MCP_NAME="${MONITOR_MCP_NAME:-packetscope-monitor}"
export MONITOR_MCP_HOST="${MONITOR_MCP_HOST:-127.0.0.1}"
export MONITOR_MCP_PORT="${MONITOR_MCP_PORT:-8012}"
export MONITOR_API_URL="${MONITOR_API_URL:-http://localhost:8010}"
export MONITOR_MCP_TRANSPORT="${MONITOR_MCP_TRANSPORT:-stdio}"

echo "Starting PacketScope Monitor MCP Server..."
echo "  Server Name: $MONITOR_MCP_NAME"
echo "  Monitor API: $MONITOR_API_URL"
echo "  Transport: $MONITOR_MCP_TRANSPORT"
if [ "$MONITOR_MCP_TRANSPORT" = "http" ]; then
    echo "  Host: $MONITOR_MCP_HOST"
    echo "  Port: $MONITOR_MCP_PORT"
fi
echo ""

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 not found"
    exit 1
fi

# Check and install dependencies
if [ ! -f .deps_installed ]; then
    echo "Installing dependencies..."
    pip3 install -r requirements.txt
    touch .deps_installed
fi

# Run the server
echo "Starting MCP server..."
exec python3 "$SCRIPT_DIR/mcp_server.py"
