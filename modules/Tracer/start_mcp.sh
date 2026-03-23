#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ -d ".venv" ]; then
  source .venv/bin/activate
fi

python3 -m pip install -r requirements.txt

export TRACER_MCP_TRANSPORT="${TRACER_MCP_TRANSPORT:-sse}"
export TRACER_MCP_HOST="${TRACER_MCP_HOST:-0.0.0.0}"
export TRACER_MCP_PORT="${TRACER_MCP_PORT:-8011}"
export TRACER_MCP_HTTP_PATH="${TRACER_MCP_HTTP_PATH:-/mcp}"

exec python3 app/mcp/server.py
