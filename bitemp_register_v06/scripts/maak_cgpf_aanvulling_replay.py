#!/usr/bin/env python3
"""
maak_cgpf_aanvulling_replay.py — nieuwe intake-aanmeldingen (uit de Forms/Power BI-export als
.xlsx) omzetten naar een replay-bestand, als aanvulling op replay 4.

Verschil met maak_cgpf_portfolio_replay.py (replay 4): die seedt alle organisaties en personen
opnieuw vanaf id 1. Deze aanvulling hergebruikt de bestaande organisaties, personen en
contactpersoon-koppelingen uit replay 4/5 (op naam) en geeft alleen nieuwe organisaties en
personen een id ná het hoogste bestaande. Elk initiatief krijgt bovendien een Aanmeldstatus
(CG-model 24-09-2026): standaard `geaccepteerd`, of `in_behandeling` voor de id's uit
--in-behandeling (bv. een testaanmelding).

Gebruik:
  pip install openpyxl
  python3 scripts/maak_cgpf_aanvulling_replay.py \
    "docs/CG PF/Extra-data/2026-09-23 Aanmelden portfolio.xlsx" \
    "replay files/registraties-replay-init-intake-aanvulling-2026-09-23.json" \
    --vanaf 129 --in-behandeling 143

De referentielijsten (gemeenten, domeinen, API-standaarden) en de bestaande organisaties en
personen komen uit docs/CG PF/Replay files/ (replay 1–5). Vereist: een backend met
Initiatief.Aanmeldstatus. Afspelen ná replay 1–7 (zie docs/CG PF/Replay files/README.md).
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import maak_cgpf_portfolio_replay as g  # noqa: E402

REPLAY_DIR = Path(__file__).resolve().parent.parent / "docs" / "CG PF" / "Replay files"
REPLAY4 = "4. Intake Portfolio Common Ground 2.replay (zonder gemeenten) CLEANED.json"
REPLAY5 = "5. PO email naar Persoon.Contactgegevens 2026.replay - zonder piet en test.json"

# Aliassen voor de aanvulling van 23-09-2026: varianten van bestaande organisaties/personen uit
# replay 4 (op naam), en rolvermeldingen tussen haakjes. Sleutel = normalize_key(ruwe token).
EXTRA_ORG_ALIASES = {
    "ase cloud services bv": "ASE Cloud Services",
    "ase cloud services b.v.": "ASE Cloud Services",
    "progresity (wij)": "Progresity",
    "progresity b.v": "Progresity",
    "progresity b.v.": "Progresity",
    "forus (platform)": "Stichting Forus",
    "pinkroccade (haal centraal)": "PinkRoccade",
    "logius (digid)": "Logius",
    "bng (bankkoppeling)": "BNG",
    "ver.id (id-wallets)": "Ver.ID",
}
# Tokens die de heuristiek voor een organisatie aanziet maar het niet zijn; ze blijven als
# tekst bewaard in Initiatiefinfo.informatie ("Leverancier: …").
GEEN_ORGANISATIE = {
    "authentik (sso).", "authentik (sso)",
    "oa. crow (imbor-standaard)",
    "samen met deelnemende gemeenten en indirect de kennispartners",
    "norminsituut bomen (handboek bomen) en rioned (gwsw).", "norminsituut bomen (handboek bomen) en rioned (gwsw)",
}
PERSOON_ALIASES = {
    "alain van zwol (ceo)": "Alain van Zwol",
    "alain van zwol, ceo / aims-eigenaar": "Alain van Zwol",
}


def pas_aliassen_toe(rijen: list[dict[str, Any]]) -> None:
    """Aliassen in de generator registreren en de PO-naam / contactorganisatie per rij opschonen."""
    g.ORG_ALIASES.update(EXTRA_ORG_ALIASES)
    orig_is_org = g.is_org_like_token
    g.is_org_like_token = lambda token: g.normalize_key(token) not in GEEN_ORGANISATIE and orig_is_org(token)
    for r in rijen:
        naam = g.normalize_key(r.get("po_naam") or "")
        if naam in PERSOON_ALIASES:
            r["po_naam"] = PERSOON_ALIASES[naam]
        org = g.normalize_key(r.get("contact_organisatie") or "")
        if org.startswith("ase cloud services"):
            r["contact_organisatie"] = "ASE Cloud Services"  # ook de variant met adres en KvK


# ── invoer ─────────────────────────────────────────────────────────────────────

def lees_xlsx(pad: Path) -> list[dict[str, Any]]:
    """Rijen als dict {VELDEN-label → waarde}. De kolomkoppen in de .xlsx zijn de volledige
    vraagteksten; VELDEN bevat voor één vraag een afgekapte versie ("..."), daarom matchen op
    voorvoegsel. Datums worden tekst (YYYY-MM-DD / ISO), getallen tekst."""
    try:
        import openpyxl  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise SystemExit("openpyxl ontbreekt: pip install openpyxl") from exc

    ws = openpyxl.load_workbook(pad, read_only=True, data_only=True).worksheets[0]
    rijen = list(ws.iter_rows(values_only=True))
    koppen = [g.normalize_key(str(k)) if k is not None else "" for k in rijen[0]]

    def kolom_voor(label: str) -> int | None:
        doel = g.normalize_key(label).rstrip(".")
        for i, kop in enumerate(koppen):
            if kop == doel or kop.startswith(doel):
                return i
        return None

    kolommen = {label: kolom_voor(label) for label in g.VELDEN.values()}
    ontbrekend = [label[:40] for label, i in kolommen.items() if i is None]
    if ontbrekend:
        raise SystemExit(f"kolommen niet gevonden in {pad.name}: {ontbrekend}")

    uit = []
    for rij in rijen[1:]:
        if rij[kolommen[g.VELDEN["bron_id"]]] is None:
            continue
        record = {}
        for label, i in kolommen.items():
            v = rij[i]
            if isinstance(v, datetime):
                v = v.strftime("%Y-%m-%dT%H:%M:%S") if label == g.VELDEN["begintijd"] else v.strftime("%Y-%m-%d")
            elif v is not None and not isinstance(v, str):
                v = str(v)
            record[label] = v
        uit.append(record)
    return uit


# ── bestaande organisaties / personen uit replay 4 en 5 ────────────────────────

def lees_bestaand(replay_dir: Path) -> dict[str, Any]:
    d = json.loads((replay_dir / REPLAY4).read_text(encoding="utf-8-sig"))
    orgs: OrderedDict[str, int] = OrderedDict()
    personen: OrderedDict[str, int] = OrderedDict()
    koppelingen: set[tuple[int, int]] = set()
    for entry in d["entries"]:
        for w in entry["request_body"]["wijzigingen"]:
            o = w.get("opvoer", {})
            if "organisatienaam" in o:
                orgs.setdefault(g.clean_text(o["organisatienaam"]["naam"]), o["organisatienaam"]["organisatie_id"])
            if "persoonnaam" in o:
                personen.setdefault(g.clean_text(o["persoonnaam"]["naam"]), o["persoonnaam"]["persoon_id"])
            if "contactpersoon" in o:
                koppelingen.add((o["contactpersoon"]["organisatie_id"], o["contactpersoon"]["persoon_id"]))
    emails: dict[int, str] = {}
    p5 = replay_dir / REPLAY5
    if p5.exists():
        for entry in json.loads(p5.read_text(encoding="utf-8-sig"))["entries"]:
            for w in entry["request_body"]["wijzigingen"]:
                o = w.get("opvoer", {}).get("persoonscontactgegevens")
                if o and o.get("email"):
                    emails[o["persoon_id"]] = o["email"]
    return {"organisaties": orgs, "personen": personen, "koppelingen": koppelingen, "emails": emails,
            "max_org": max(orgs.values()), "max_persoon": max(personen.values())}


# ── seed hermappen: bestaand hergebruiken, nieuw ná het hoogste id ─────────────

def hermap_seed(seed: dict[str, Any], bestaand: dict[str, Any]) -> dict[str, Any]:
    org_lookup = g.build_lookup(bestaand["organisaties"])
    nieuwe_orgs: OrderedDict[str, int] = OrderedDict()
    volgende_org = bestaand["max_org"] + 1
    org_ids: OrderedDict[str, int] = OrderedDict()
    for naam in seed["organisaties"]:
        bestaand_id = g.find_reference_id(g.normalize_org_token(naam), org_lookup, g.ORG_ALIASES)
        if bestaand_id is None:
            bestaand_id = volgende_org
            nieuwe_orgs[naam] = bestaand_id
            volgende_org += 1
        org_ids[naam] = bestaand_id
    seed["organisaties"] = org_ids
    seed["organisaties_lookup"] = {**org_lookup, **g.build_lookup(org_ids)}

    persoon_lookup = g.build_lookup(bestaand["personen"])
    nieuwe_personen: OrderedDict[str, int] = OrderedDict()
    volgende_persoon = bestaand["max_persoon"] + 1
    persoon_ids: OrderedDict[str, int] = OrderedDict()
    for key in seed["personen"]:
        naam = seed["persoon_meta"][key]["naam"]
        bestaand_id = g.find_reference_id(naam, persoon_lookup)
        if bestaand_id is None:
            bestaand_id = volgende_persoon
            nieuwe_personen[key] = bestaand_id
            volgende_persoon += 1
        persoon_ids[key] = bestaand_id
    seed["personen"] = persoon_ids
    seed["nieuwe_organisaties"] = nieuwe_orgs
    seed["nieuwe_personen"] = nieuwe_personen
    return seed


def bouw_seed_entries(seed: dict[str, Any], bestaand: dict[str, Any], tijd: datetime) -> list[dict[str, Any]]:
    entries = []
    ts = lambda t: t.isoformat().replace("+00:00", "Z")  # noqa: E731

    wijz = []
    for naam, oid in seed["nieuwe_organisaties"].items():
        wijz.append(g.request_change("organisatie", {"id": oid}))
        wijz.append(g.request_change("organisatienaam", {"organisatie_id": oid, "naam": naam}))
    if wijz:
        entries.append(g.request_entry(ts(tijd), "Aanvulling intake: nieuwe organisaties", wijz))
        tijd += timedelta(seconds=1)

    wijz = []
    for key, pid in seed["nieuwe_personen"].items():
        meta = seed["persoon_meta"][key]
        wijz.append(g.request_change("persoon", {"id": pid}))
        wijz.append(g.request_change("persoonnaam", {"persoon_id": pid, "naam": meta["naam"]}))
        email = g.clean_text(meta.get("email"))
        if "@" in email and not g.is_placeholder(email):
            wijz.append(g.request_change("persoonscontactgegevens", {"persoon_id": pid, "email": email}))
    if wijz:
        entries.append(g.request_entry(ts(tijd), "Aanvulling intake: nieuwe personen (PO) met e-mail", wijz))
        tijd += timedelta(seconds=1)

    wijz = []
    gezien = set(bestaand["koppelingen"])
    for org_key, persoon_key in seed["contactpersoon_links"]:
        org_naam = next((n for n in seed["organisaties"] if g.normalize_key(n) == org_key), None)
        pkey = next((k for k in seed["personen"] if g.normalize_key(k) == persoon_key), None)
        if org_naam is None or pkey is None:
            continue
        paar = (seed["organisaties"][org_naam], seed["personen"][pkey])
        if paar in gezien:
            continue
        gezien.add(paar)
        wijz.append(g.request_change("contactpersoon", {"organisatie_id": paar[0], "persoon_id": paar[1], "rol": "PO"}))
    if wijz:
        entries.append(g.request_entry(ts(tijd), "Aanvulling intake: contactpersonen (PO)", wijz))
    return entries


# ── hoofdprogramma ─────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("xlsx", type=Path)
    ap.add_argument("output", type=Path)
    ap.add_argument("--vanaf", type=int, default=129, help="alleen rijen met ID >= dit nummer (default 129)")
    ap.add_argument("--in-behandeling", type=int, nargs="*", default=[], help="initiatief-id's die 'in_behandeling' krijgen i.p.v. 'geaccepteerd'")
    ap.add_argument("--replay-dir", type=Path, default=REPLAY_DIR)
    args = ap.parse_args()

    rijen = [g.canonicalize_row(r) for r in lees_xlsx(args.xlsx)]
    rijen = [r for r in rijen if int(r.get("bron_id") or 0) >= args.vanaf]
    if not rijen:
        raise SystemExit("geen rijen vanaf dat id")
    pas_aliassen_toe(rijen)

    bestaand = lees_bestaand(args.replay_dir)
    # collect_seed_data zoekt de referentie-replays naast source_path: geef de replay-map door.
    seed = g.collect_seed_data(rijen, args.replay_dir / "x.json")
    for soort, extern in seed["externally_seeded"].items():
        if not extern:
            raise SystemExit(f"referentie-replay voor {soort} niet gevonden in {args.replay_dir}")
    seed = hermap_seed(seed, bestaand)

    tijden = [g.parse_iso_timestamp(r.get("begintijd")) for r in rijen]
    geparsed = [datetime.fromisoformat(t.replace("Z", "+00:00")) for t in tijden if t]
    vroegst = min(geparsed) if geparsed else datetime.now(timezone.utc)

    entries = bouw_seed_entries(seed, bestaand, vroegst - timedelta(minutes=10))
    initiatieven = g.build_initiatief_entries(rijen, seed, vroegst)
    in_behandeling = set(args.in_behandeling)
    for entry in initiatieven:
        wijz = entry["request_body"]["wijzigingen"]
        iid = wijz[0]["opvoer"]["initiatief"]["id"]
        if iid in in_behandeling:
            status = {"initiatief_id": iid, "status": "in_behandeling",
                      "toelichting": "Aanmelding via het formulier, nog niet beoordeeld."}
        else:
            status = {"initiatief_id": iid, "status": "geaccepteerd",
                      "toelichting": "Aanmelding via het formulier, geaccepteerd bij het inlezen van de aanvulling."}
        wijz.append(g.request_change("aanmeldstatus", status))
    entries.extend(initiatieven)

    ids = [e["request_body"]["wijzigingen"][0]["opvoer"]["initiatief"]["id"] for e in initiatieven]
    replay = {
        "version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": f"xlsx://{args.xlsx.name}",
        "generator": "scripts/maak_cgpf_aanvulling_replay.py",
        "description": (
            f"Aanvulling op replay 4: intake-aanmeldingen id {min(ids)}–{max(ids)} uit de Forms-export van "
            f"{args.xlsx.name}. Hergebruikt bestaande organisaties/personen uit replay 4/5 (op naam); nieuwe "
            f"organisaties vanaf id {bestaand['max_org'] + 1}, nieuwe personen vanaf {bestaand['max_persoon'] + 1}. "
            f"Elk initiatief krijgt een Aanmeldstatus: geaccepteerd, behalve {sorted(in_behandeling) or 'geen'} "
            f"(in_behandeling). Afspelen ná replay 1–7 op een backend met Initiatief.Aanmeldstatus."
        ),
        "count": len(entries),
        "aanvulling": {
            "initiatieven": ids,
            "in_behandeling": sorted(in_behandeling),
            "nieuwe_organisaties": seed["nieuwe_organisaties"],
            "nieuwe_personen": {seed["persoon_meta"][k]["naam"]: v for k, v in seed["nieuwe_personen"].items()},
            "hergebruikte_organisaties": {n: i for n, i in seed["organisaties"].items() if n not in seed["nieuwe_organisaties"]},
        },
        "entries": entries,
    }
    args.output.write_text(json.dumps(replay, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"initiatieven: {ids}")
    print(f"in behandeling: {sorted(in_behandeling)}")
    print(f"nieuwe organisaties ({len(seed['nieuwe_organisaties'])}): {dict(seed['nieuwe_organisaties'])}")
    print(f"hergebruikt: {replay['aanvulling']['hergebruikte_organisaties']}")
    print(f"nieuwe personen ({len(seed['nieuwe_personen'])}): {replay['aanvulling']['nieuwe_personen']}")
    print(f"entries: {len(entries)} → {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
