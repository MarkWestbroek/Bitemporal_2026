#!/bin/bash
# devloop-entrypoint.sh — Beheert de API lifecycle met automatische herstart.
#
# Het script start de API binary en herstart deze automatisch wanneer
# de binary exit code 42 retourneert (= rebuild voltooid, herstart gewenst).
# Elke andere exit code stopt de container.

set -e

echo "=== Devloop entrypoint ==="
echo "Werkdirectory: $(pwd)"
echo "Go versie: $(go version)"
echo "DEVLOOP=$DEVLOOP"

# Initieel: zorg dat de binary er is
if [ ! -f /app/bitemp-go-api ]; then
    echo "Geen binary gevonden, compileren..."
    cd /app
    CGO_ENABLED=0 go build -o /app/bitemp-go-api .
fi

# Restart loop
while true; do
    echo ""
    echo "=== API starten ($(date -Iseconds)) ==="
    set +e
    /app/bitemp-go-api
    EXIT_CODE=$?
    set -e

    if [ "$EXIT_CODE" -eq 42 ]; then
        echo ""
        echo "=== Exit code 42: rebuild voltooid, API herstarten... ==="
        continue
    else
        echo ""
        echo "=== API gestopt met exit code $EXIT_CODE ==="
        exit $EXIT_CODE
    fi
done
