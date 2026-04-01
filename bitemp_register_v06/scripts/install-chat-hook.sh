#!/bin/sh
# Installeer de pre-commit hook voor Copilot Chat export.
# Draai dit script vanuit de repo-root in een POSIX shell:
#   sh bitemp_register_v06/scripts/install-chat-hook.sh
# Gebruik op Windows PowerShell liever:
#   powershell -ExecutionPolicy Bypass -File bitemp_register_v06/scripts/install-chat-hook.ps1

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
    echo "Fout: niet in een git repo."
    exit 1
fi

HOOK_SRC="$REPO_ROOT/bitemp_register_v06/scripts/pre-commit-chat-export"
HOOK_DST="$REPO_ROOT/.git/hooks/pre-commit"

if [ ! -f "$HOOK_SRC" ]; then
    echo "Fout: $HOOK_SRC niet gevonden."
    exit 1
fi

if [ -f "$HOOK_DST" ]; then
    # Check of onze hook al geïnstalleerd is
    if grep -q "pre-commit-chat-export" "$HOOK_DST"; then
        echo "Hook is al geïnstalleerd in $HOOK_DST"
        exit 0
    fi
    echo "Er bestaat al een pre-commit hook. Voeg deze regel toe aan $HOOK_DST:"
    echo "  $HOOK_SRC"
    exit 0
fi

# Normaliseer naar LF zodat Git hooks ook op Windows via Git Bash betrouwbaar draaien.
tr -d '\r' < "$HOOK_SRC" > "$HOOK_DST"
chmod +x "$HOOK_DST"
echo "Pre-commit hook geïnstalleerd: $HOOK_DST"
