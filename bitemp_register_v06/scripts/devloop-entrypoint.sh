#!/bin/bash
# devloop-entrypoint.sh — Beheert de API lifecycle met automatische herstart.
#
# Het script start de API binary en herstart deze automatisch wanneer
# de binary exit code 42 retourneert (= rebuild voltooid, herstart gewenst).
#
# Crash-detectie: als de binary binnen CRASH_THRESHOLD_SECONDS stopt
# (niet exit 42), wordt model/ hersteld vanuit _baseline/model/ en
# de binary opnieuw gebouwd. Dit voorkomt dat een fout in gegenereerde
# code de container permanent onbruikbaar maakt.
#
# Elke andere exit code na een succesvolle langlopende start stopt de container.

set -e

CRASH_THRESHOLD_SECONDS=${CRASH_THRESHOLD_SECONDS:-10}

echo "=== Devloop entrypoint ==="
echo "Werkdirectory: $(pwd)"
echo "Go versie: $(go version)"
echo "DEVLOOP=$DEVLOOP"
echo "Crash threshold: ${CRASH_THRESHOLD_SECONDS}s"

# Initieel: zorg dat de binary er is
if [ ! -f /app/bitemp-go-api ]; then
    echo "Geen binary gevonden, compileren..."
    cd /app
    CGO_ENABLED=0 go build -tags devtools -o /app/bitemp-go-api .
fi

# rollback_en_herbouw — herstelt model/ vanuit baseline en bouwt opnieuw.
rollback_en_herbouw() {
    echo ""
    echo "=== CRASH GEDETECTEERD: model rollback vanuit baseline ==="

    if [ -d /app/_baseline/model ]; then
        echo "Baseline gevonden, model herstellen..."
        rm -rf /app/model
        cp -R /app/_baseline/model /app/model
        echo "Model hersteld vanuit _baseline/model/"

        echo "Binary hercompileren met hersteld model..."
        cd /app
        if CGO_ENABLED=0 go build -tags devtools -o /app/bitemp-go-api .; then
            echo "Herbouw succesvol — API wordt herstart met baseline-model"
            return 0
        else
            echo "FOUT: herbouw na rollback ook mislukt — container stopt"
            return 1
        fi
    else
        echo "Geen _baseline/model/ gevonden — kan niet herstellen"
        return 1
    fi
}

# Restart loop
while true; do
    echo ""
    echo "=== API starten ($(date -Iseconds)) ==="
    START_TIME=$(date +%s)
    set +e
    /app/bitemp-go-api
    EXIT_CODE=$?
    set -e
    END_TIME=$(date +%s)
    RUNTIME=$((END_TIME - START_TIME))

    if [ "$EXIT_CODE" -eq 42 ]; then
        echo ""
        echo "=== Exit code 42: rebuild voltooid, API herstarten... ==="
        continue
    fi

    # Crash-detectie: als de binary binnen de drempel stopt, rollback en herstart.
    if [ "$RUNTIME" -lt "$CRASH_THRESHOLD_SECONDS" ]; then
        echo ""
        echo "=== API crashte na ${RUNTIME}s (< ${CRASH_THRESHOLD_SECONDS}s drempel), exit code $EXIT_CODE ==="
        if rollback_en_herbouw; then
            echo "=== Herstart na rollback... ==="
            continue
        else
            echo "=== Rollback mislukt, container stopt ==="
            exit $EXIT_CODE
        fi
    fi

    echo ""
    echo "=== API gestopt met exit code $EXIT_CODE (na ${RUNTIME}s) ==="
    exit $EXIT_CODE
done
