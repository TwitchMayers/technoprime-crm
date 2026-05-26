#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ensure_listening() {
  local name="$1"
  local url="$2"
  local attempts=30

  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[ok] ${name} is up (${url})"
      return 0
    fi
    sleep 1
  done

  echo "[fail] ${name} did not start in time (${url})"
  return 1
}

start_if_needed() {
  local port="$1"
  local cmd="$2"
  local log_file="$3"
  local pid_file="$4"

  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[skip] port ${port} already in use"
    return 0
  fi

  nohup /bin/zsh -lc "$cmd" >"$log_file" 2>&1 &
  echo $! >"$pid_file"
  echo "[start] ${cmd}"
}

echo "[step] starting infrastructure (postgres, redis)"
docker compose up -d postgres redis >/dev/null

echo "[step] starting backend/frontend/shop"
start_if_needed 4000 "cd \"$ROOT_DIR/backend\" && npm run start:dev" "/tmp/gamecrm_backend.log" "/tmp/gamecrm_backend.pid"
start_if_needed 3001 "cd \"$ROOT_DIR/frontend\" && PORT=3001 npm run dev" "/tmp/gamecrm_frontend.log" "/tmp/gamecrm_frontend.pid"
start_if_needed 3000 "cd \"$ROOT_DIR/shop\" && PORT=3000 npm run dev" "/tmp/gamecrm_shop.log" "/tmp/gamecrm_shop.pid"

echo "[step] waiting for services"
ensure_listening "shop" "http://127.0.0.1:3000/"
ensure_listening "crm" "http://127.0.0.1:3001/login"
ensure_listening "backend" "http://127.0.0.1:4000/api/health"

cat <<EOF

Ready:
- Shop:    http://localhost:3000
- CRM:     http://localhost:3001/login
- Backend: http://localhost:4000/api/health

Logs:
- /tmp/gamecrm_shop.log
- /tmp/gamecrm_frontend.log
- /tmp/gamecrm_backend.log
EOF
