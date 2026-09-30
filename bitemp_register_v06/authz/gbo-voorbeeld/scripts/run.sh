#!/usr/bin/env bash
# Draait de hele keten van het GBO-voorbeeld. Vereist: node (voor de tekenaar en
# de Toegangsspraak-parser uit web/vite), python 3 met requirements.txt, en
# Docker (image openpolicyagent/opa:latest wordt bij de eerste run opgehaald).
#
#   python -m venv .venv && .venv/Scripts/pip install -r scripts/requirements.txt
#   PY=.venv/Scripts/python bash scripts/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PY:-python}"
export PYTHONIOENCODING=utf-8

echo "1. model -> diagram (dezelfde tekenaar als Studio en de render-API)"
node scripts/render_diagram.mjs
echo "2. Toegangsspraak -> ODRL (echte parser + exporter)"
node scripts/exporteer_odrl.mjs
echo "3. ODRL + model -> bundel (SDL, padtabel, regels als data, PJ-stijl Rego)"
"$PY" scripts/compiler.py
echo "4. PDP met OPA: PJ-bundel en data-bundel, alle queries, plus benchmark"
"$PY" scripts/pdp_opa.py --bench
echo "5. PDP met native ODRL-evaluator (pyodre)"
"$PY" scripts/pdp_odre.py
