#!/usr/bin/env python3
"""
Genereer replay-bestand voor de extra CG Portfolio data uit de SharePoint export.

Leest:
  - uitgebreid.txt (tab-separated SharePoint export)
  - 4. Intake Portfolio Common Ground 2.replay (zonder gemeenten).json (voor naam→initiatief_id mapping)

Genereert:
  - 7. Extra data CG Portfolio.replay.json  (replay voor NIEUWE GEs: Beoordeling + Etalage)
  - 7b. Extra data CG Portfolio - updates.sql (SQL UPDATEs voor extra velden op BESTAANDE records)

Gebruik:
  cd docs/ontwerpgedachten/CG PF/Replay files
  python generate_extra_data_replay.py
"""

import json
import os
import re
import sys
from collections import OrderedDict
from datetime import datetime, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EXTRA_DATA_DIR = os.path.join(SCRIPT_DIR, "..", "Extra-data")
EXTRA_DATA_FILE = os.path.join(EXTRA_DATA_DIR, "uitgebreid.txt")
REPLAY_4_FILE = os.path.join(
    SCRIPT_DIR,
    "4. Intake Portfolio Common Ground 2.replay (zonder gemeenten).json",
)
OUTPUT_REPLAY = os.path.join(
    SCRIPT_DIR, "7. Extra data CG Portfolio.replay.json"
)
OUTPUT_SQL = os.path.join(
    SCRIPT_DIR, "7b. Extra data CG Portfolio - updates.sql"
)

# ── Kolom-indices (0-gebaseerd) in uitgebreid.txt ──────────────────────
COL_SP_ID = 1
COL_NAAM = 4
COL_IDENTIFICATIE = 7
COL_VERVANGT = 22        # Vervangtditproductouderesoftware
COL_OBSTAKELS = 24       # Obstakels
COL_CHECK_ZILVER = 26    # Checkcategoriezilver
COL_FASE_CG = 27         # Fase CG portfolio
COL_VERWACHT_READY = 28  # Wanneerwordtverwachtdathetinitia
COL_SCORE_WENDB = 29     # OData_16 = score wendbaarheid
COL_SCORE_DIENST = 30    # OData_18 = score dienstverlening
COL_SCORE_REGIE = 31     # OData_22 = score regie op gegevens
COL_MAAND_ZILVER = 36    # Maandzilver
COL_MAAND_GOUD = 37      # Maandgoud
COL_REDENATIE_ZILVER = 39
COL_REDENATIE_GOUD = 40
COL_ETALAGE_L1 = 43      # Etalagelevel1
COL_ETALAGE_L2 = 44      # Etalagelevel2
COL_GOUD_NIET = 46       # Goudnietgehaald
COL_REDEN_GOUD_NIET = 47 # Redenatiegoudnietgehaald
COL_AANMELDING = 50       # Aanmeldingsdatum

# ── Naam-aliassen: SharePoint-naam → replay productnaam ────────────────
NAME_ALIASES = {
    "zaakregister": "een zaakregister",
    # "oneground", "openinschrijving" en "mijnomgeving-as-a-service"
    # zitten niet in replay 4 (andere / nieuwe initiatieven)
}


def normalize_name(name):
    """Normaliseer naam: smart quotes → ASCII, lowercase, strip."""
    n = name.lower().strip()
    # Unicode smart quotes → ASCII
    n = n.replace("\u2018", "'").replace("\u2019", "'")
    n = n.replace("\u201c", '"').replace("\u201d", '"')
    return n

# ── CGPortfolioFase mapping ────────────────────────────────────────────
FASE_MAP = {
    "brons": "Brons",
    "zilver": "Zilver",
    "goud": "Goud",
    "niet gecontroleerd": "NietGecontroleerd",
}

# ── Bijdragetype mapping (voor SQL updates van scores) ─────────────────
BIJDRAGE_TYPES = {
    COL_SCORE_WENDB: "Wendbaarheid",
    COL_SCORE_DIENST: "Dienstverlening",
    COL_SCORE_REGIE: "Regie op gegevens",
}


# ═══════════════════════════════════════════════════════════════════════
# Hulpfuncties
# ═══════════════════════════════════════════════════════════════════════

def col(row, idx):
    """Veilig kolom ophalen, leeg als index buiten bereik."""
    return row[idx].strip() if idx < len(row) else ""


def parse_us_date(val):
    """Parse US-stijl datum '3/11/2024 11:00:00 PM' → 'YYYY-MM-DD' of None."""
    if not val:
        return None
    # Formaat: M/D/YYYY H:MM:SS AM/PM
    for fmt in ("%m/%d/%Y %I:%M:%S %p", "%m/%d/%Y"):
        try:
            dt = datetime.strptime(val, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_iso_date(val):
    """Parse ISO-stijl of NL-stijl datum → 'YYYY-MM-DD' of None."""
    if not val:
        return None
    # ISO 8601: YYYY-MM-DD
    if re.match(r"^\d{4}-\d{2}-\d{2}$", val):
        return val
    # NL stijl: DD-MM-YYYY
    m = re.match(r"^(\d{2})-(\d{2})-(\d{4})$", val)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return None


def parse_us_datetime_to_date(val):
    """Parse US-datetime (aanmeldingsdatum) → 'YYYY-MM-DD' of None."""
    return parse_us_date(val)


def parse_bool_ja(val):
    """'ja'/'Ja' → True, 'nee'/'Nee' → False, anders None."""
    if not val:
        return None
    v = val.strip().lower()
    if v == "ja":
        return True
    if v == "nee":
        return False
    return None


def parse_score(val):
    """Numerieke score 1–4, of None."""
    if not val:
        return None
    try:
        n = int(val)
        if 1 <= n <= 4:
            return n
    except ValueError:
        pass
    return None


def is_valid_fase(val):
    """Check of val een geldige CGPortfolioFase waarde is."""
    return val.strip().lower() in FASE_MAP if val else False


def is_valid_etalage(val):
    """Alleen echte etalage waarden accepteren (geen spillover-tekst)."""
    if not val:
        return False
    v = val.strip()
    # Bekende geldige waarden
    if v in ("Platform dienstverlening", "Nee"):
        return True
    # Korte waarden die er uitzien als classificatie
    if len(v) < 60 and not v.startswith("http") and not v.startswith("["):
        return True
    return False


def sql_escape(val):
    """Escape single quotes voor SQL."""
    if val is None:
        return "NULL"
    return "'" + val.replace("'", "''") + "'"


# ═══════════════════════════════════════════════════════════════════════
# Stap 1: Bouw naam→initiatief_id mapping uit replay 4
# ═══════════════════════════════════════════════════════════════════════

def load_replay_mapping():
    """Lees replay 4 en bouw {naam_lower: initiatief_id} mapping."""
    with open(REPLAY_4_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    mapping = {}  # genoramliseerde naam → initiatief_id
    for entry in data["entries"]:
        rb = entry.get("request_body", {})
        init_id = None
        naam = None
        for wij in rb.get("wijzigingen", []):
            opvoer = wij.get("opvoer", {})
            if "initiatief" in opvoer:
                init_id = opvoer["initiatief"].get("id")
            if "product" in opvoer:
                naam = opvoer["product"].get("naam", "").strip()
        if init_id and naam:
            mapping[normalize_name(naam)] = init_id

    return mapping


# ═══════════════════════════════════════════════════════════════════════
# Stap 2: Lees en fix de SharePoint-export
# ═══════════════════════════════════════════════════════════════════════

def load_extra_data():
    """Lees uitgebreid.txt, fix CRLF-breuken, dedup op SP_ID."""
    with open(EXTRA_DATA_FILE, "r", encoding="utf-8") as f:
        raw_lines = f.readlines()

    # Fix CRLF-gebroken regels
    fixed = []
    current = ""
    for line in raw_lines[1:]:  # skip header
        if re.match(r"^0\t\d+\t", line):
            if current:
                fixed.append(current)
            current = line.rstrip("\n").rstrip("\r")
        else:
            current += " " + line.rstrip("\n").rstrip("\r")
    if current:
        fixed.append(current)

    # Dedup op SharePoint ID (col 1)
    seen = set()
    rows = []
    for line in fixed:
        cols = line.split("\t")
        sp_id = cols[COL_SP_ID] if len(cols) > COL_SP_ID else ""
        if sp_id and sp_id not in seen:
            seen.add(sp_id)
            rows.append(cols)

    return rows


# ═══════════════════════════════════════════════════════════════════════
# Stap 3: Match extra data op initiatief_id
# ═══════════════════════════════════════════════════════════════════════

def match_rows(rows, mapping):
    """Koppel data-rij aan initiatief_id via productnaam matching.
    Returns: [(initiatief_id, cols), ...], unmatched: [naam, ...]
    """
    matched = []
    unmatched = []

    for cols in rows:
        naam = col(cols, COL_NAAM)
        key = normalize_name(naam)

        # Direct match
        iid = mapping.get(key)

        # Alias match
        if not iid and key in NAME_ALIASES:
            iid = mapping.get(NAME_ALIASES[key])

        if iid:
            matched.append((iid, cols))
        else:
            unmatched.append(naam)

    return matched, unmatched


# ═══════════════════════════════════════════════════════════════════════
# Stap 4: Genereer replay-entries voor NIEUWE GEs
# ═══════════════════════════════════════════════════════════════════════

def build_replay_entries(matched_rows):
    """Bouw replay entries voor Beoordeling en Etalage opvoer."""
    entries = []

    for iid, cols in sorted(matched_rows, key=lambda x: x[0]):
        naam = col(cols, COL_NAAM)
        wijzigingen = []

        # ── Beoordeling ────────────────────────────────────────────
        fase_raw = col(cols, COL_FASE_CG)
        has_beoordeling = is_valid_fase(fase_raw)

        if has_beoordeling:
            fase = FASE_MAP[fase_raw.lower()]
            beoordeling = OrderedDict()
            beoordeling["initiatief_id"] = iid
            beoordeling["fase_cg_portfolio"] = fase

            # datum_zilver
            dz = parse_us_date(col(cols, COL_MAAND_ZILVER))
            if dz:
                beoordeling["datum_zilver"] = dz

            # datum_goud
            dg = parse_us_date(col(cols, COL_MAAND_GOUD))
            if dg:
                beoordeling["datum_goud"] = dg

            # check_zilver
            cs = parse_bool_ja(col(cols, COL_CHECK_ZILVER))
            if cs is not None:
                beoordeling["check_zilver"] = cs

            # redenatie_zilver
            rz = col(cols, COL_REDENATIE_ZILVER)
            if rz and len(rz) < 2000:
                beoordeling["redenatie_zilver"] = rz

            # redenatie_goud
            rg = col(cols, COL_REDENATIE_GOUD)
            if rg and len(rg) < 2000:
                beoordeling["redenatie_goud"] = rg

            # goud_niet_gehaald
            gn = parse_bool_ja(col(cols, COL_GOUD_NIET))
            if gn is not None:
                beoordeling["goud_niet_gehaald"] = gn

            # redenatie_goud_niet_gehaald
            rgn = col(cols, COL_REDEN_GOUD_NIET)
            if rgn and len(rgn) < 2000:
                beoordeling["redenatie_goud_niet_gehaald"] = rgn

            wijzigingen.append({"opvoer": {"beoordeling": beoordeling}})

        # ── Etalage ────────────────────────────────────────────────
        l1 = col(cols, COL_ETALAGE_L1)
        l2 = col(cols, COL_ETALAGE_L2)
        has_etalage = is_valid_etalage(l1) or is_valid_etalage(l2)

        if has_etalage:
            etalage = OrderedDict()
            etalage["initiatief_id"] = iid
            if is_valid_etalage(l1):
                etalage["level1"] = l1
            if is_valid_etalage(l2):
                etalage["level2"] = l2
            wijzigingen.append({"opvoer": {"etalage": etalage}})

        # ── Maak registratie-entry als er wijzigingen zijn ─────────
        if wijzigingen:
            ge_labels = []
            if has_beoordeling:
                ge_labels.append(f"beoordeling ({fase})")
            if has_etalage:
                ge_labels.append("etalage")

            entry = OrderedDict()
            entry["registratietype"] = "registratie"
            entry["tijdstip"] = "2026-04-16T00:00:00Z"
            entry["request_path"] = "/registratie/"
            entry["request_method"] = "POST"
            entry["request_body"] = OrderedDict()
            entry["request_body"]["registratie"] = OrderedDict([
                ("id", 0),
                (
                    "opmerking",
                    f"Extra data initiatief_id={iid} | naam={naam} | "
                    + ", ".join(ge_labels),
                ),
                ("registratietype", "registratie"),
                ("tijdstip", "0001-01-01T00:00:00Z"),
            ])
            entry["request_body"]["wijzigingen"] = wijzigingen
            entry["expected_response_code"] = 201
            entry["expected_response_body"] = None
            entries.append(entry)

    return entries


# ═══════════════════════════════════════════════════════════════════════
# Stap 5: Genereer SQL UPDATEs voor extra velden op bestaande records
# ═══════════════════════════════════════════════════════════════════════

def build_sql_updates(matched_rows):
    """Bouw SQL UPDATE statements voor extra velden op bestaande _Data records."""
    statements = []

    for iid, cols in sorted(matched_rows, key=lambda x: x[0]):
        naam = col(cols, COL_NAAM)
        row_sqls = []

        # ── Planning: obstakels + verwacht_ready_datum ─────────────
        obst = col(cols, COL_OBSTAKELS)
        vrd_raw = col(cols, COL_VERWACHT_READY)
        vrd = parse_iso_date(vrd_raw)

        if obst and len(obst) < 2000:
            row_sqls.append(
                f"UPDATE initiatief_planning_data "
                f"SET obstakels = {sql_escape(obst)} "
                f"WHERE initiatief_id = {iid} AND rel_id = 1;"
            )
        if vrd:
            row_sqls.append(
                f"UPDATE initiatief_planning_data "
                f"SET verwacht_ready_datum = {sql_escape(vrd)}::date "
                f"WHERE initiatief_id = {iid} AND rel_id = 1;"
            )

        # ── Product: vervangt_ouder_product ────────────────────────
        vp = parse_bool_ja(col(cols, COL_VERVANGT))
        if vp is not None:
            row_sqls.append(
                f"UPDATE initiatief_product_data "
                f"SET vervangt_ouder_product = {str(vp).lower()} "
                f"WHERE initiatief_id = {iid} AND rel_id = 1;"
            )

        # ── Bijdrage: score per bijdragetype ───────────────────────
        for score_col, bijdrage_type in BIJDRAGE_TYPES.items():
            score = parse_score(col(cols, score_col))
            if score is not None:
                row_sqls.append(
                    f"UPDATE initiatief_bijdrage_data bd "
                    f"SET score = {score} "
                    f"FROM initiatief_bijdrage b "
                    f"WHERE bd.initiatief_id = b.initiatief_id "
                    f"  AND bd.rel_id = b.rel_id "
                    f"  AND b.initiatief_id = {iid} "
                    f"  AND bd.type_bijdrage = {sql_escape(bijdrage_type)};"
                )

        # ── Initiatiefinfo: aanmeldingsdatum ───────────────────────
        aanm = parse_us_datetime_to_date(col(cols, COL_AANMELDING))
        if aanm:
            row_sqls.append(
                f"UPDATE initiatief_initiatiefinfo_data "
                f"SET aanmeldingsdatum = {sql_escape(aanm)}::date "
                f"WHERE initiatief_id = {iid} AND rel_id = 1;"
            )

        if row_sqls:
            statements.append(
                f"-- initiatief_id={iid} ({naam})\n"
                + "\n".join(row_sqls)
            )

    return statements


# ═══════════════════════════════════════════════════════════════════════
# Stap 6: Schrijf output-bestanden
# ═══════════════════════════════════════════════════════════════════════

def write_replay(entries, unmatched):
    """Schrijf replay JSON."""
    replay = OrderedDict()
    replay["version"] = 1
    replay["exported_at"] = datetime.now(timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%S.%fZ"
    )
    replay["source"] = "generated://generate_extra_data_replay.py"
    replay["schema_source"] = (
        "Extra data uit SharePoint PowerBI export (uitgebreid.txt)"
    )
    replay["schema_model"] = OrderedDict([
        ("naam", "CG Portfolio extra data"),
        ("versie", "v3"),
    ])
    replay["count"] = len(entries)
    replay["known_gaps"] = [
        "Alleen NIEUWE GE's (Beoordeling, Etalage) worden via replay opvoerd.",
        "Extra velden op BESTAANDE records (obstakels, verwacht_ready_datum, "
        "vervangt_ouder_product, score, aanmeldingsdatum) staan in het "
        "bijbehorende SQL-bestand (7b).",
        f"{len(unmatched)} initiatieven uit de bron konden niet gematcht "
        f"worden op een bestaand initiatief: {', '.join(unmatched)}.",
        "Corrupt-rij-data (door CRLF-kolomverschuivingen) wordt gefilterd "
        "via veldvalidatie.",
    ]
    replay["entries"] = entries

    with open(OUTPUT_REPLAY, "w", encoding="utf-8") as f:
        json.dump(replay, f, indent=2, ensure_ascii=False)

    return OUTPUT_REPLAY


def write_sql(statements, unmatched):
    """Schrijf SQL update-bestand."""
    header = """\
-- ═══════════════════════════════════════════════════════════════════════
-- Extra data CG Portfolio - UPDATE statements voor bestaande records
-- ═══════════════════════════════════════════════════════════════════════
--
-- Gegenereerd door: generate_extra_data_replay.py
-- Bron: uitgebreid.txt (SharePoint PowerBI export)
--
-- Dit script vult extra velden aan op bestaande _Data records:
--   - initiatief_planning_data: obstakels, verwacht_ready_datum
--   - initiatief_product_data: vervangt_ouder_product
--   - initiatief_bijdrage_data: score (per bijdragetype via JOIN op hub)
--   - initiatief_initiatiefinfo_data: aanmeldingsdatum
--
-- Voer dit uit NADAT:
--   1. De migratie-SQL (20260611_...) is gedraaid (nieuwe kolommen)
--   2. Replay 4 is afgespeeld (bestaande records)
--   3. Replay 7 is afgespeeld (nieuwe GE's: beoordeling, etalage)
--
-- Let op: deze UPDATEs werken direct op de _Data records en omzeilen
-- de bitemporale audittrail (geen registratie/wijziging). Dit is
-- acceptabel voor initiële data-import.
--
-- Database: bitemp_go_db_v06
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

"""
    footer = """
COMMIT;
"""

    with open(OUTPUT_SQL, "w", encoding="utf-8") as f:
        f.write(header)
        f.write("\n\n".join(statements))
        f.write("\n")
        f.write(footer)

    return OUTPUT_SQL


# ═══════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════

def main():
    print("═" * 60)
    print("  CG Portfolio Extra Data → Replay + SQL generator")
    print("═" * 60)

    # 1. Mapping uit replay 4
    mapping = load_replay_mapping()
    print(f"\n✓ Replay 4 geladen: {len(mapping)} productnamen → initiatief_id")

    # 2. Extra data laden
    rows = load_extra_data()
    print(f"✓ Extra data geladen: {len(rows)} unieke rijen (na CRLF-fix + dedup)")

    # 3. Matchen
    matched, unmatched = match_rows(rows, mapping)
    print(f"✓ Gematcht: {len(matched)}/{len(rows)}")
    if unmatched:
        print(f"  ⚠ Niet gematcht ({len(unmatched)}): {', '.join(unmatched)}")

    # 4. Replay entries
    entries = build_replay_entries(matched)
    beoordeling_count = sum(
        1 for e in entries
        for w in e["request_body"]["wijzigingen"]
        if "beoordeling" in w.get("opvoer", {})
    )
    etalage_count = sum(
        1 for e in entries
        for w in e["request_body"]["wijzigingen"]
        if "etalage" in w.get("opvoer", {})
    )
    print(f"\n✓ Replay entries: {len(entries)}")
    print(f"  - Beoordelingen: {beoordeling_count}")
    print(f"  - Etalages: {etalage_count}")

    # 5. SQL updates
    sql_stmts = build_sql_updates(matched)
    print(f"✓ SQL update-blokken: {len(sql_stmts)}")

    # 6. Schrijf bestanden
    replay_path = write_replay(entries, unmatched)
    sql_path = write_sql(sql_stmts, unmatched)

    print(f"\n{'─' * 60}")
    print(f"Output:")
    print(f"  Replay: {os.path.basename(replay_path)}")
    print(f"  SQL:    {os.path.basename(sql_path)}")
    print(f"{'─' * 60}")
    print()
    print("Volgorde van uitvoering:")
    print("  1. SQL migratie: dbsetup/migrations/20260611_...sql")
    print("  2. Start backend (maakt nieuwe tabellen aan)")
    print("  3. Replay 7 afspelen (beoordeling + etalage opvoer)")
    print("  4. SQL 7b uitvoeren (extra velden op bestaande records)")


if __name__ == "__main__":
    main()
