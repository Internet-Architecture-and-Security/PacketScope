#!/usr/bin/env bash
# PacketScope Tracer MCP Server - HTTP Mode Startup Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 设置环境变量
export TRACER_MCP_NAME="${TRACER_MCP_NAME:-packetscope-tracer}"
export TRACER_MCP_HOST="${TRACER_MCP_HOST:-127.0.0.1}"
export TRACER_MCP_PORT="${TRACER_MCP_PORT:-8013}"
export TRACER_API_URL="${TRACER_API_URL:-http://localhost:8000}"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║        PacketScope Tracer MCP Server                       ║"
echo "║                      HTTP Mode                             ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  Server Name: $TRACER_MCP_NAME"
echo "  Tracer API: $TRACER_API_URL"
echo "  Listening on: http://$TRACER_MCP_HOST:$TRACER_MCP_PORT"
echo ""
echo "MCP客户端配置参考 (config.http.json):"
echo "{"
echo "  \"mcpServers\": {"
echo "    \"packetscope-tracer\": {"
echo "      \"url\": \"http://$TRACER_MCP_HOST:$TRACER_MCP_PORT/sse\""
echo "    }"
echo "  }"
echo "}"
echo ""
echo "按 Ctrl+C 停止服务器"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 检查Python 3
if ! command -v python3 &> /dev/null; then
  echo "Error: python3 not found"
  exit 1
fi

# 检查并安装依赖
if [ ! -f .deps_installed ]; then
  echo "Installing dependencies..."
  pip3 install -r requirements.txt --break-system-packages
  touch .deps_installed
fi

# 运行服务器
exec python3 "$SCRIPT_DIR/mcp_server.py"
