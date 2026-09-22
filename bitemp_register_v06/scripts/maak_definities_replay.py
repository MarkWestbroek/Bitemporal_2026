#!/usr/bin/env python3
"""Exporteer de actuele WeergaveDefinities en FormulierDefinities van een instantie als replaybestand.

Leest `/full/weergave_definities` en `/full/formulier_definities` (anoniem leesbaar) en schrijft
per definitie één registratie met alleen de **actuele** stand (niet-afgevoerde data-versie per GE,
anders de laatste). De historie wordt bewust niet nagespeeld: het doel is een schone instantie
(bv. pf.common-ground-lab.nl) dezelfde kolomkoppen, detailweergave en formulierlayout te geven.

Het formaat volgt `replay files/registraties-replay-init-standaard-weergavedefinities.json`:
hub-veldnamen (niet `_data`), zodat de registratielogica hub + data zelf aanmaakt.

    python3 scripts/maak_definities_replay.py --bron http://<nas>:8086 \
        --uit "replay files/registraties-replay-init-definities-<bron>-<datum>.json"
"""

from __future__ import annotations

import argparse
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# Per definitietype: lijst-pad, sleutel in de response, hub-naam en GE-json-naam → opvoer-sleutel.
TYPEN = [
    {
        "pad": "weergave_definities",
        "sleutel": "weergave definities",
        "hub": "weergavedefinitie",
        "fk": "weergavedefinitie_id",
        "label": "WeergaveDefinitie",
        "ges": {
            "weergave_definitie_metas": "weergavedefinitie_meta",
            "weergave_definitie_tabel_configs": "tabelconfig",
            "weergave_definitie_detail_templates": "detailtemplate",
        },
        "aanvang": "weergavedefinitie_aanvang",
    },
    {
        "pad": "formulier_definities",
        "sleutel": "formulier definities",
        "hub": "formulierdefinitie",
        "fk": "formulierdefinitie_id",
        "label": "FormulierDefinitie",
        "ges": {
            "formulier_definitie_metas": "formulierdefinitie_meta",
            "formulier_definitie_layouts": "layout",
        },
        "aanvang": "formulierdefinitie_aanvang",
    },
]

# Technische velden die de registratielogica zelf zet.
TECHNISCH = {"rel_id", "versie", "opvoer", "afvoer"}


def haal(bron: str, pad: str) -> dict:
    with urllib.request.urlopen(f"{bron.rstrip('/')}/full/{pad}?page=1&size=1000", timeout=30) as r:
        return json.load(r)


def actuele_data(hubs: list) -> dict | None:
    """Actuele data-versie over alle hubs van één GE: eerst niet-afgevoerd, anders de laatste."""
    kandidaten = [d for h in hubs or [] for d in (h.get("data") or [])]
    if not kandidaten:
        return None
    actueel = [d for d in kandidaten if not d.get("afvoer")]
    return (actueel or kandidaten)[-1]


def entry_voor(t: dict, ent: dict, tijdstip: str) -> dict:
    id_ = ent["id"]
    wijzigingen = [{"opvoer": {t["hub"]: {"id": id_}}}]
    doeltype = "?"
    for ge, opvoer_sleutel in t["ges"].items():
        data = actuele_data(ent.get(ge))
        if data is None:
            continue
        doeltype = data.get("doeltype", doeltype)
        velden = {k: v for k, v in data.items() if k not in TECHNISCH}
        velden[t["fk"]] = id_
        wijzigingen.append({"opvoer": {opvoer_sleutel: velden}})
    for a in ent.get("aanvang") or []:
        if not a.get("afvoer"):
            wijzigingen.append({"opvoer": {t["aanvang"]: {t["fk"]: id_, "datum": a["datum"]}}})
            break
    return {
        "registratietype": "registratie",
        "tijdstip": tijdstip,
        "request_path": "/registratie/",
        "request_method": "POST",
        "description": f"{t['label']} voor {doeltype}",
        "request_body": {
            "registratie": {
                "id": 0,
                "opmerking": f"{t['label']} {id_} voor ENT {doeltype} (actuele stand, geëxporteerd)",
                "registratietype": "registratie",
                "tijdstip": "0001-01-01T00:00:00Z",
            },
            "wijzigingen": wijzigingen,
        },
        "expected_response_code": 201,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--bron", required=True, help="basis-URL van de instantie, bv. http://nas:8086")
    ap.add_argument("--uit", required=True, type=Path, help="doelbestand (.json)")
    ap.add_argument("--omschrijving", default="", help="extra tekst voor het description-veld")
    args = ap.parse_args()

    nu = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    entries = []
    for t in TYPEN:
        for ent in sorted(haal(args.bron, t["pad"]).get(t["sleutel"]) or [], key=lambda e: e["id"]):
            if not ent.get("afvoer"):
                entries.append(entry_voor(t, ent, nu))

    replay = {
        "version": 1,
        "exported_at": nu,
        "source": "export://maak_definities_replay.py",
        "description": (
            "Actuele WeergaveDefinities en FormulierDefinities (alleen de geldende versie per GE, "
            "geen historie). Laad na de referentietabellen. " + args.omschrijving
        ).strip(),
        "count": len(entries),
        "entries": entries,
    }
    args.uit.write_text(json.dumps(replay, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(entries)} registraties → {args.uit}")


if __name__ == "__main__":
    main()
