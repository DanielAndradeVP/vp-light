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

cleanup
npm run dev
cleanup
