#!/usr/bin/env python3
"""maak_uitleg_correctie.py — een replay die de tekst van bestaande uitleg (entiteit Uitleg) vervangt.

`Tekst` is een meervoudig GE (één rij per taal). Een tekst wijzigen = de oude rij afvoeren en een
nieuwe opvoeren, in één registratie; de oude blijft in de historie (FORMULIERDEFINITIES.md §2.5).
Dit script zoekt per code + taal de actuele rij op bij een instantie (/full/uitleggen, openbaar) en
schrijft de replay met de echte id's/rel_id's van die instantie. Afspelen met speel_replay_af.py.

Invoer: een JSON-lijst [{ "code": "vorm-nl-map", "taal": "nl", "tekst": "…", "titel": "" }, …].
Een taal die er nog niet is, wordt alleen opgevoerd.

    python3 scripts/maak_uitleg_correctie.py --bron https://pf.common-ground-lab.nl \\
        --wijzigingen wijzigingen.json --uit "replay files/registraties-replay-correctie-uitleg-….json"
"""
import argparse
import json
import sys
import urllib.request


def actueel(lijst):
    return [x for x in (lijst or []) if x and not x.get("afvoer")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bron", required=True, help="basis-URL van de instantie, bv. https://pf.common-ground-lab.nl")
    ap.add_argument("--wijzigingen", required=True, help="JSON-bestand met [{code, taal, tekst, titel?}]")
    ap.add_argument("--uit", required=True)
    ap.add_argument("--opmerking", default="Uitleg bijgewerkt")
    a = ap.parse_args()

    with urllib.request.urlopen(f"{a.bron.rstrip('/')}/full/uitleggen?size=1000", timeout=60) as r:
        uitleggen = json.load(r)["uitleggen"]
    op_code = {}
    for u in uitleggen:
        if u.get("afvoer"):
            continue
        meta = [d for h in actueel(u.get("uitleg_metas")) for d in actueel(h.get("data"))]
        if meta and meta[-1].get("code"):
            op_code[meta[-1]["code"]] = u

    wijzigingen = json.load(open(a.wijzigingen, encoding="utf-8"))
    per_uitleg = {}
    for w in wijzigingen:
        u = op_code.get(w["code"])
        if not u:
            sys.exit(f"geen actieve uitleg met code {w['code']!r} op {a.bron}")
        regels = per_uitleg.setdefault(w["code"], [])
        for hub in actueel(u.get("uitleg_teksten")):
            data = actueel(hub.get("data"))
            if data and data[-1].get("taal") == w["taal"]:
                regels.append({"afvoer": {"tekst": {"uitleg_id": u["id"], "rel_id": hub["rel_id"]}}})
        regels.append({"opvoer": {"tekst": {"uitleg_id": u["id"], "taal": w["taal"], "titel": w.get("titel", ""), "tekst": w["tekst"]}}})

    entries = [{
        "registratietype": "registratie", "request_path": "/registratie/", "request_method": "POST",
        "description": f"Uitleg '{code}': tekst ({', '.join(w['taal'] for w in wijzigingen if w['code'] == code)})",
        "expected_response_code": 201,
        "request_body": {"registratie": {"registratietype": "registratie", "opmerking": f"{a.opmerking}: {code}"}, "wijzigingen": regels},
    } for code, regels in per_uitleg.items()]
    uit = {"version": 1, "source": "scripts/maak_uitleg_correctie.py",
           "description": f"{a.opmerking}. Met de id's van {a.bron}; alleen daar afspelen.",
           "count": len(entries), "entries": entries}
    json.dump(uit, open(a.uit, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=2)
    for e in entries:
        print(e["description"], "-", len(e["request_body"]["wijzigingen"]), "wijzigingen")
    print("->", a.uit)


if __name__ == "__main__":
    main()
