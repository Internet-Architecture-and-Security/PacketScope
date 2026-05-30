#!/usr/bin/env bash
# PacketScope Tracer MCP Server Startup Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default configuration
export TRACER_MCP_NAME="${TRACER_MCP_NAME:-packetscope-tracer}"
export TRACER_MCP_HOST="${TRACER_MCP_HOST:-127.0.0.1}"
export TRACER_MCP_PORT="${TRACER_MCP_PORT:-8013}"
export TRACER_API_URL="${TRACER_API_URL:-http://localhost:8000}"
export TRACER_MCP_TRANSPORT="${TRACER_MCP_TRANSPORT:-stdio}"

echo "Starting PacketScope Tracer MCP Server..."
echo "  Server Name: $TRACER_MCP_NAME"
echo "  Tracer API: $TRACER_API_URL"
echo "  Transport: $TRACER_MCP_TRANSPORT"
if [ "$TRACER_MCP_TRANSPORT" = "http" ] || [ "$TRACER_MCP_TRANSPORT" = "streamable-http" ]; then
    echo "  Host: $TRACER_MCP_HOST"
    echo "  Port: $TRACER_MCP_PORT"
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
    pip3 install --break-system-packages -r requirements.txt
    touch .deps_installed
fi

# Run the server
echo "Starting MCP server..."
exec python3 "$SCRIPT_DIR/mcp_server.py"
