#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() {
  "$PROJECT_ROOT/tools/kill-dev-ports.sh" || true
}

trap cleanup EXIT INT TERM

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
fi

cd "$PROJECT_ROOT"

# Algumas sessões de desenvolvimento definem esta variável para executar o
# Electron como Node.js. O VP Light precisa do runtime completo do Electron.
unset ELECTRON_RUN_AS_NODE

if command -v olad >/dev/null 2>&1 && ! pgrep -x olad >/dev/null 2>&1; then
  olad --daemon
fi

cleanup
npm run dev
cleanup
