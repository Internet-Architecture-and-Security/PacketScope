#!/usr/bin/env bash
# PacketScope Monitor MCP Server - HTTP Mode Startup Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 设置环境变量
export MONITOR_MCP_NAME="${MONITOR_MCP_NAME:-packetscope-monitor}"
export MONITOR_MCP_HOST="${MONITOR_MCP_HOST:-127.0.0.1}"
export MONITOR_MCP_PORT="${MONITOR_MCP_PORT:-8012}"
export MONITOR_API_URL="${MONITOR_API_URL:-http://localhost:8010}"
# 不需要设置 transport，fastmcp 会根据配置自动选择

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║        PacketScope Monitor MCP Server                      ║"
echo "║                      HTTP Mode                             ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  Server Name: $MONITOR_MCP_NAME"
echo "  Monitor API: $MONITOR_API_URL"
echo "  Listening on: http://$MONITOR_MCP_HOST:$MONITOR_MCP_PORT"
echo ""
echo "MCP客户端配置参考 (config.http.json):"
echo "{"
echo "  \"mcpServers\": {"
echo "    \"packetscope-monitor\": {"
echo "      \"url\": \"http://$MONITOR_MCP_HOST:$MONITOR_MCP_PORT/sse\""
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
