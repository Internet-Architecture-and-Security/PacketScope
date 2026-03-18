#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ -d ".venv" ]; then
  source .venv/bin/activate
fi

python3 -m pip install -r requirements.txt
export PYTHONPATH="$ROOT_DIR:${PYTHONPATH:-}"
exec python3 app/api/http_server.py
