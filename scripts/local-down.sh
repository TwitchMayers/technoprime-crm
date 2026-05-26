#!/usr/bin/env bash
set -euo pipefail

kill_by_pid_file() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && ps -p "$pid" >/dev/null 2>&1; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

kill_by_pid_file /tmp/gamecrm_shop.pid
kill_by_pid_file /tmp/gamecrm_frontend.pid
kill_by_pid_file /tmp/gamecrm_backend.pid

pkill -f "shop/node_modules/.bin/next dev" 2>/dev/null || true
pkill -f "frontend/node_modules/.bin/next dev" 2>/dev/null || true
pkill -f "backend/node_modules/.bin/nest start --watch" 2>/dev/null || true
pkill -f "backend/dist/src/main" 2>/dev/null || true

echo "Stopped local app processes."
