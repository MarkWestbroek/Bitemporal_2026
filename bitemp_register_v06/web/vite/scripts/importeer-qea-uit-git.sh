#!/usr/bin/env bash
# importeer-qea-uit-git.sh — "complete import via git": haal de git-checkout met het
# EA-bestand bij (fast-forward) en zet het pakket met de node-sidecar in een
# serverproject. Bedoeld om door de Go-api of een cron/webhook te worden
# aangeroepen; handmatig kan ook.
#
#   scripts/importeer-qea-uit-git.sh <repo-dir> <pad/naar/model.qea binnen de repo> \
#       --pakket "Model / Zandbak MW" --project <id> [--api …] [--map "…"] [--droog] …
#
# Alles na de eerste twee argumenten gaat door naar importeer-qea.mjs (zie daar).
# Auth via OMNIUM_TOKEN of OMNIUM_GEBRUIKER/OMNIUM_WACHTWOORD in de omgeving.
set -euo pipefail

REPO="${1:?repo-dir}"
QEA="${2:?pad naar .qea binnen de repo}"
shift 2

if [ ! -d "$REPO/.git" ] && ! git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1; then
  echo "FOUT: $REPO is geen git-checkout" >&2
  exit 1
fi
git -C "$REPO" pull --ff-only --quiet
COMMIT="$(git -C "$REPO" rev-parse --short HEAD)"
echo "git: $REPO @ $COMMIT" >&2

cd "$(dirname "$0")/.."
exec node --import ./test/register-aliases.mjs scripts/importeer-qea.mjs --qea "$REPO/$QEA" "$@"
