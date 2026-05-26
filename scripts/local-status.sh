#!/usr/bin/env bash
set -euo pipefail

echo "Ports:"
lsof -nP -iTCP:3000 -sTCP:LISTEN || true
lsof -nP -iTCP:3001 -sTCP:LISTEN || true
lsof -nP -iTCP:4000 -sTCP:LISTEN || true

echo
echo "Health checks:"
echo -n "shop   : "
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/ || true
echo -n "crm    : "
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/login || true
echo -n "backend: "
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/health || true

echo
echo "Docker:"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
