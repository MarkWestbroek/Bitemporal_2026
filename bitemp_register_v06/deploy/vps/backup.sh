#!/usr/bin/env bash
# backup.sh — nachtelijke backup van Omnium: Postgres-dump + MinIO-bestanden.
#
# Schrijft naar $BACKUP_DIR/<datum>/ en bewaart de laatste $KEEP dagen.
# De NAS haalt deze map op (TrueNAS → Rsync Task, pull over SSH): de VPS hoeft
# dus nooit een verbinding naar huis te openen.
#
# KEEP staat bewust laag: schijfruimte is op een VPS de schaarse bron (een dag
# bevat de hele MinIO-tar), terwijl de NAS de lange historie al bewaart. Drie
# dagen lokaal is genoeg om een mislukte of half overgekomen pull op te vangen.
# Bewaar je géén kopie elders, zet KEEP dan hoger.
#
# Cron (als gebruiker omnium):  0 3 * * *  /srv/omnium/backup.sh >> /srv/omnium/backups/backup.log 2>&1
# Let op: de minimal Ubuntu-image van mijn.host heeft géén cron — eerst
# `sudo apt -y install cron rsync` (rsync voor de pull vanaf de NAS of een laptop). De tar draait met --user zodat minio.tgz van
# omnium is en niet van root (de rsync-pull vanaf de NAS leest als omnium).
set -euo pipefail

STACK_DIR="${STACK_DIR:-/srv/omnium}"
BACKUP_DIR="${BACKUP_DIR:-/srv/omnium/backups}"
KEEP="${KEEP:-3}"
COMPOSE="docker compose -f $STACK_DIR/docker-compose.vps.yml --env-file $STACK_DIR/.env"

# shellcheck disable=SC1091
set -a; . "$STACK_DIR/.env"; set +a

stamp="$(date +%Y-%m-%dT%H-%M-%S)"
dest="$BACKUP_DIR/$stamp"
mkdir -p "$dest"

echo "[$stamp] postgres → $dest/postgres.dump"
$COMPOSE exec -T postgres pg_dump -U "$POSTGRES_USER" -d "${POSTGRES_DB:-bitemp_go_db_v06}" -Fc \
  > "$dest/postgres.dump"

echo "[$stamp] minio → $dest/minio.tgz"
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$(basename "$STACK_DIR")_bitemp_minio_data":/data:ro \
  -v "$dest":/out \
  alpine:3.21 tar czf /out/minio.tgz -C /data .

cp "$STACK_DIR/.env" "$dest/env.txt"   # de secrets horen bij de data; de NAS is een vertrouwde plek
echo "postgres=$(stat -c %s "$dest/postgres.dump") minio=$(stat -c %s "$dest/minio.tgz")" > "$dest/manifest.txt"

# Retentie: alleen de nieuwste $KEEP mappen bewaren.
ls -1d "$BACKUP_DIR"/20* 2>/dev/null | sort | head -n -"$KEEP" | xargs -r rm -rf
echo "[$stamp] klaar"
