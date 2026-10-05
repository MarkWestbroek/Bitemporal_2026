#!/usr/bin/env bash
# update.sh — app.omnium-ide.nl bijwerken naar de images op Docker Hub (VPS_DEPLOYMENT.md §11).
#
# Draait op de VPS in /srv/omnium, als de deploy-gebruiker. Volgorde: backup (backup.sh),
# pull, herstart van api + render-svc + frontend, en een smoke-test (/version, API-Version-header,
# één render). Postgres, MinIO en OpenFTV blijven staan.
#
#   ./update.sh            # alle drie de services naar :latest (of wat .env in *_IMAGE zet)
#   ./update.sh --no-backup
#
# Rollback: zet FRONTEND_IMAGE/API_IMAGE/RENDER_IMAGE in .env op de vorige versie-tag en draai
# dit script opnieuw (DOCKER_RELEASE.md §4.4).
set -euo pipefail

STACK_DIR="${STACK_DIR:-/srv/omnium}"
cd "$STACK_DIR"
COMPOSE="docker compose -f $STACK_DIR/docker-compose.vps.yml --env-file $STACK_DIR/.env"

if [ "${1:-}" != "--no-backup" ]; then
  echo "── backup"
  "$STACK_DIR/backup.sh"
fi

echo "── huidige stand"
curl -s http://127.0.0.1:8083/version; echo

echo "── pull"
$COMPOSE pull api render-svc frontend

echo "── herstart api, render-svc, frontend"
$COMPOSE up -d --force-recreate api render-svc frontend

echo "── wachten op de API"
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8083/version >/dev/null; then break; fi
  sleep 2
done

echo "── smoke-test"
curl -s http://127.0.0.1:8083/version; echo
curl -sI http://127.0.0.1:8083/version | grep -i '^API-Version' || echo "(geen API-Version-header)"
curl -s -X POST http://127.0.0.1:8083/api/render/svg -H 'Content-Type: application/json' \
  -d '{"taal":"v3","model":{"versie":"1","entiteiten":[{"typenaam":"A"}]}}' | head -c 80; echo

echo "── API-log (dbsetup, devtools-regel)"
docker logs bitemp-go-api-06 --tail 40 2>&1 | grep -E '\[dbsetup\]|devtools|listening|Listening|error|fout' || docker logs bitemp-go-api-06 --tail 10

$COMPOSE ps --format "table {{.Service}}\t{{.Image}}\t{{.Status}}"
