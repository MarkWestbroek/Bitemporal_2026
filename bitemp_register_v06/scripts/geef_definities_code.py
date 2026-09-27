#!/usr/bin/env python3
"""Geef de FormulierDefinities en WeergaveDefinities van een BESTAANDE instantie hun `code`.

`code` (Meta-GE, sinds 2026-09-27) is een leesbare sleutel die op elke instantie gelijk is,
anders dan het id (lokaal is "Nieuwe organisatie" iets anders dan FD 3 op pf). Nieuwe
instanties krijgen hem via de init-replays; dit script maakt een replay voor een instantie
waar de definities er al staan:

  - per definitie uit CODES (op naam) zonder die code: een nieuwe versie van de meta mét code
    (alle andere velden ongewijzigd, rel_id erbij — zoals de formuliereditor opslaat);
  - per FormulierDefinitie waarvan de layout `"nieuwFormulier": "<id>"` bevat en die FD een
    code heeft (of krijgt): een nieuwe versie van de layout met de code i.p.v. het id.

Standaardweergaven (is_standaard) worden overgeslagen: WeergaveDefinitie 2 staat live in de
iframe op commonground.nl en blijft ongemoeid. De replay bevat de echte id's/rel_id's van
de bron en hoort dus alleen bij die instantie. Afspelen met scripts/speel_replay_af.py.

    python3 scripts/geef_definities_code.py --bron https://pf.common-ground-lab.nl \
        --uit "replay files/registraties-replay-codes-definities-pf-2026-09-27.json"
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.request
from datetime import datetime, timezone

# naam → code. Codes: kleine letters, cijfers en koppeltekens, niet alleen cijfers.
CODES = {
    "formulier": {
        "Initiatief voorbeeldformulier": "initiatief-voorbeeld",
        "Aanmelding initiatief": "aanmelding-initiatief",
        "Nieuwe organisatie": "nieuwe-organisatie",
        "Aanmelding initiatief (vormen)": "aanmelding-initiatief-vormen",
        "Aanmelding initiatief (vormen v2)": "aanmelding-initiatief-vormen-v2",
        "Voorbeeld: vormen": "voorbeeld-image-map",
        "Voorbeeld: klikbare afbeelding": "voorbeeld-image-map",
        "Voorbeeld: locatie met adreszoeker": "voorbeeld-adreszoeker",
        "Voorbeeld: persoon": "voorbeeld-persoon",
        "Voorbeeld: vormen (2)": "voorbeeld-vormen-2",
    },
    "weergave": {
        "Initiatief met vormen": "initiatief-met-vormen",
    },
}

TYPEN = {
    "formulier": {"pad": "formulier_definities", "sleutel": "formulier definities", "fk": "formulierdefinitie_id",
                  "metas": "formulier_definitie_metas", "meta": "formulierdefinitie_meta"},
    "weergave": {"pad": "weergave_definities", "sleutel": "weergave definities", "fk": "weergavedefinitie_id",
                 "metas": "weergave_definitie_metas", "meta": "weergavedefinitie_meta"},
}
WEG = {"versie", "opvoer", "afvoer"}


def haal(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)


def actueel(hubs):
    """(data, rel_id) van de laatst opgevoerde niet-afgevoerde hub (zoals shared/actueleData.js)."""
    levend = sorted((h for h in hubs or [] if not h.get("afvoer")), key=lambda h: h.get("opvoer") or "")
    for hub in reversed(levend):
        data = [d for d in hub.get("data") or [] if not d.get("afvoer")]
        if data:
            return max(data, key=lambda d: d.get("versie") or 0), hub.get("rel_id")
    return None, None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bron", required=True, help="basis-URL van de instantie (anoniem leesbaar)")
    ap.add_argument("--uit", required=True, help="pad van het replaybestand")
    args = ap.parse_args()
    bron = args.bron.rstrip("/")

    wijzigingen, beschrijving = [], []
    fd_code = {}  # FD-id → (bestaande of nieuwe) code
    fds = []
    for soort, t in TYPEN.items():
        for full in haal(f"{bron}/full/{t['pad']}?size=1000").get(t["sleutel"]) or []:
            if full.get("afvoer"):
                continue
            meta, rel_id = actueel(full.get(t["metas"]))
            if not meta:
                continue
            code = (meta.get("code") or "").strip() or CODES[soort].get(meta.get("naam"), "")
            if soort == "formulier":
                fds.append(full)
                if code:
                    fd_code[str(full["id"])] = code
            if not code or (meta.get("code") or "").strip() == code:
                continue
            if soort == "weergave" and meta.get("is_standaard") in (True, "true"):
                continue  # standaardweergave (live in de iframe) niet aanraken
            payload = {k: v for k, v in meta.items() if k not in WEG}
            payload["code"] = code
            payload["rel_id"] = rel_id
            wijzigingen.append({"opvoer": {t["meta"]: payload}})
            beschrijving.append(f"{soort} {full['id']} «{meta.get('naam')}» → {code}")

    # nieuwFormulier: id → code in de layouts
    for full in fds:
        layout, rel_id = actueel(full.get("formulier_definitie_layouts"))
        if not layout or not layout.get("layout_json"):
            continue
        nieuw = re.sub(r'("nieuwFormulier"\s*:\s*)"(\d+)"',
                       lambda m: m.group(1) + json.dumps(fd_code.get(m.group(2), m.group(2))), layout["layout_json"])
        if nieuw != layout["layout_json"]:
            payload = {k: v for k, v in layout.items() if k not in WEG}
            payload["layout_json"] = nieuw
            payload["rel_id"] = rel_id
            wijzigingen.append({"opvoer": {"layout": payload}})
            beschrijving.append(f"formulier {full['id']}: nieuwFormulier-id → code in de layout")

    nu = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    replay = {
        "version": 1, "exported_at": nu, "source": bron,
        "description": "Codes voor bestaande Formulier-/WeergaveDefinities (scripts/geef_definities_code.py). Alleen voor "
                       f"{bron}: bevat de id's en rel_id's van die instantie. " + "; ".join(beschrijving),
        "count": 1 if wijzigingen else 0,
        "entries": [{
            "registratietype": "registratie", "tijdstip": nu, "request_path": "/registratie/", "request_method": "POST",
            "description": "Codes voor definities",
            "request_body": {"registratie": {"registratietype": "registratie", "opmerking": "Leesbare code voor formulier- en weergavedefinities"},
                             "wijzigingen": wijzigingen},
            "expected_response_code": 201,
        }] if wijzigingen else [],
    }
    with open(args.uit, "w", encoding="utf-8", newline="\n") as f:
        json.dump(replay, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("\n".join(beschrijving) or "niets te doen", f"\n→ {args.uit}")


if __name__ == "__main__":
    main()
