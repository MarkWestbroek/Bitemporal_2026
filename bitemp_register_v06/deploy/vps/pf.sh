#!/usr/bin/env bash
# pf.sh — de tweede Omnium-instantie (pf.common-ground-lab.nl) beheren op de VPS.
#
# Layout op de VPS:
#   /srv/omnium-pf/src   sparse checkout van dit repo (alleen bitemp_register_v06/)
#   /srv/omnium-pf/.env  geheimen (chmod 600), niet in git — zie .env.pf.example
#
#   ./pf.sh deploy [ref]   git bijwerken (of naar ref), images bouwen, (her)starten
#   ./pf.sh init           eenmalig: MinIO-bucket aanmaken
#   ./pf.sh ps|logs|down   gewone compose-commando's op dit project
#
# De images worden hier gebouwd (niet van Docker Hub): omnium-pf-api:<commit> en
# omnium-pf-frontend:<commit>. Zo raakt niets aan app.omnium-ide.nl, dat op
# :latest van Docker Hub draait. Zie docker-compose.pf.yml.
main() {
  set -euo pipefail
  local BASE=/srv/omnium-pf
  local SRC="$BASE/src"
  local COMPOSE="$SRC/bitemp_register_v06/deploy/vps/docker-compose.pf.yml"
  dc() { docker compose -p omnium-pf -f "$COMPOSE" --env-file "$BASE/.env" "$@"; }

  [ -f "$BASE/.env" ] || { echo "$BASE/.env ontbreekt" >&2; exit 1; }
  exec 9>"$BASE/.deploy.lock"; flock 9

  case "${1:-deploy}" in
    deploy)
      cd "$SRC"
      git fetch -q origin
      if [ -n "${2:-}" ]; then git checkout -q --detach "$2"; else git checkout -q main && git merge -q --ff-only origin/main; fi
      export PF_TAG; PF_TAG="$(git rev-parse --short=12 HEAD)"
      export BUILD_TIME; BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      echo "── pf @ $PF_TAG: $(git log -1 --format=%s)"
      dc build api frontend
      dc up -d --wait postgres minio api frontend
      docker image prune -f >/dev/null
      dc ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
      ;;
    init) dc --profile init up minio-init ;;
    ps|logs|down) local cmd="$1"; shift; dc "$cmd" "$@" ;;
    *) echo "gebruik: pf.sh deploy [ref] | init | ps | logs | down" >&2; exit 2 ;;
  esac
}
main "$@"
exit
