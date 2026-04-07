#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


VELDEN = {
    "bron_id": "ID",
    "begintijd": "Begintijd",
    "naam": "Wat is de naam van het initiatief dat je wilt aanmelden?",
    "producttype": "Wat voor type product is het initiatief?",
    "componenten": "Indien een toepassing, welke componenten zijn hierin opgenomen?",
    "parallel": "Indien het initiatief software betreft, is het parallel te gebruiken naast de bestaande software die het moet vervangen?",
    "pitch": "Indien een toepassing, pitch je product. Waarom zouden anderen moeten mee doen met de ontwikkeling of waarom zouden andere gemeenten jouw product moeten implementeren",
    "domeinen": "In welk domein(en) past het initiatief?",
    "organisatie_types": "Welk type organisaties zijn betrokken?",
    "gemeenten_realisatie": "Welke gemeenten zijn aangesloten bij de realisatie van dit initiatief?",
    "gemeenten_gebruik": "Welke gemeenten maken gebruik van dit initiatief?",
    "leveranciers": "Welke leveranciers zijn betrokken?",
    "startdatum": "Wat is de startdatum van het initiatief",
    "ready_for_use": "Wanneer wordt verwacht dat het initiatief ready for use  is? Of sinds wanneer is het initiatief ready for use? (Let er op dat dit na de startdatum is)",
    "contact_organisatie": "Welke organisatie wordt aangehouden als contact organisatie?",
    "po_naam": "Wie is de PO (product owner) van dit initiatief? (en dus contactpersoon)",
    "po_email": "Wat is het emailadres van de PO?",
    "website": "Op welke website kunnen we meer info over het initiatief vinden? (Kan ook link naar groepspagina op commonground.nl zijn)",
    "git_repo": "Wat is de Gitlhub of Gitlab omgeving van het initiatief?",
    "omschrijving": "Wat is een korte omschrijving van het product?",
    "wendbaarheid_schaal": "Hoeverre draagt het initiatief volgens jou bij aan de wendbaarheid van gemeenten? \n(Een wendbare gemeente kan makkelijker inspringen op maatschappelijke opgaven)\n1 is geen vier is maximaal",
    "wendbaarheid_toelichting": "Geef een korte toelichting op je beoordeling van de vorige vraag",
    "dienstverlening_schaal": "In hoeverre draagt het volgens jou bij aan betere dienstverlening van gemeenten? \n(1 is geen bijdrage, 4 is maximaal)",
    "dienstverlening_toelichting": "Geef een korte toelichting op jouw antwoord de vorige vraag",
    "regie_schaal": "In hoeverre draagt het bij aan regie op gegevens voor inwoners?\n(zie https://www.digitaleoverheid.nl/overzicht-van-alle-onderwerpen/regie-op-gegevens/vraag-en-antwoord/als-ik-regie-heb-over-mijn-g...",
    "regie_toelichting": "Geef een korte toelichting op jouw antwoord bij de vorige vraag",
    "planning_info": "Waar staat informatie over de planning? Voeg indien mogelijk de link toe.",
    "lagen": "Op welke laag of op welke lagen bevindt dit initiatief zich",
    "api_standaarden": "Welke API-standaarden zijn toegepast? (zie ook https://www.gemmaonline.nl/wiki/Wat_is_een_standaard)",
    "fase": "In welke fase bevindt het initiatief zich?",
    "tegenaan_gelopen": "Waar zijn jullie tegenaan gelopen? In zowel ontwikkeling en waar van toepassing bij de implementatie. Noem de een tot drie grootste punten.",
    "vragen": "Zijn er nog vragen naar aanleiding van dit intakeformulier?",
}

GENORMALISEERDE_VELDEN = {}

PLACEHOLDERS = {
    "",
    "-",
    "--",
    "nvt",
    "n.v.t.",
    "geen",
    "nog geen",
    "x",
    "test",
    "anonymous",
    "onbekend",
    "komt nog",
    "later aan te vullen",
    "kom ik later op terug",
    "nog in te vullen",
    "nog in te vullen (harvey)",
}

PRODUCTTYPE_MAP = OrderedDict(
    {
        "component": "Component",
        "toepassing": "Toepassing",
        "platform": "Toepassing",
        "standaard": "Standaard",
    }
)

FASE_MAP = OrderedDict(
    {
        "idee": "Idee",
        "initiatie": "Verkenning",
        "verkenning": "Verkenning",
        "realisatie": "Realisatie",
        "opschaling": "InGebruik",
        "doorontwikkeling": "InGebruik",
        "beheer": "InGebruik",
        "in gebruik": "InGebruik",
    }
)

LAAG_MAP = OrderedDict(
    {
        "hosting en infrastructuur": "Hosting en infrastructuur",
        "laag 5": "Laag 5",
        "laag 4": "Laag 4",
        "laag 3": "Laag 3",
        "laag 2": "Laag 2",
        "laag 1": "Laag 1",
        "interactie": "Laag 5",
        "bedrijfsprocessen": "Laag 4",
        "procesinrichting": "Laag 4",
        "integratie": "Laag 3",
        "connectiviteit": "Laag 3",
        "toegang tot data": "Laag 2",
        "api": "Laag 2",
        "opslag en archivering": "Laag 1",
    }
)

GEMEENTE_ALIASES = OrderedDict(
    {
        "den bosch": "'s-Hertogenbosch",
        "s hertogenbosch": "'s-Hertogenbosch",
        "s-hertogenbosch": "'s-Hertogenbosch",
        "den haag": "'s-Gravenhage",
        "s gravenhage": "'s-Gravenhage",
        "s-gravenhage": "'s-Gravenhage",
        "fryske marren": "De Fryske Marren",
        "de fryske marren": "De Fryske Marren",
        "sud west friesland": "Súdwest-Fryslân",
        "sudwest friesland": "Súdwest-Fryslân",
        "sudwest fryslan": "Súdwest-Fryslân",
        "súdwest fryslan": "Súdwest-Fryslân",
        "sudwest-fryslan": "Súdwest-Fryslân",
        "sud west fryslan": "Súdwest-Fryslân",
        "utrechts heuvelrug": "Utrechtse Heuvelrug",
        "utrechtseheuvelrug": "Utrechtse Heuvelrug",
        "meersen": "Meerssen",
        "meijerijstad": "Meierijstad",
    }
)

DOMEIN_RULES = OrderedDict(
    {
        "Burgerzaken": [r"burgerzaken"],
        "Sociaal Domein": [r"sociaal\s*domein"],
        "Ruimtelijke ordening": [r"ruimtelijke\s*ordening"],
        "Bedrijfsvoering (HR, ICT, Finance, facilitair, inkoop)": [r"bedrijfsvoering", r"\bhr\b", r"\bict\b", r"finance", r"facilitair", r"inkoop"],
        "Dienstverlening": [r"dienstverlening"],
        "(Lokale) belastingen": [r"belasting"],
        "Fysieke leefomgeving": [r"fysieke\s+leefomgeving", r"fysieke\s+omgeving"],
        "Bestuur": [r"bestuur"],
        "Openbare orde en veiligheid": [r"openbare\s+orde\s+en\s+veiligheid"],
        "Overkoepelend / randvoorwaardelijk voor CG": [r"overkoepelend", r"randvoorwaardelijk"],
    }
)

API_RULES = OrderedDict(
    {
        "ZGW API": [r"\bzgw\b", r"zaakgericht\s*werk", r"zaakgerichtwerk"],
        "REST API": [r"\brest\b", r"restful"],
        "Notificaties API": [r"notificatie(?:s)?\s*api", r"\bnc\b"],
        "StUF-ZKN": [r"stuf[-\s]?zkn", r"zaak- en documentservices", r"regie- en zaakservices"],
        "StUF-FIN": [r"stuf[-\s]?fin"],
        "StUF-DCR": [r"stuf[-\s]?dcr", r"document creatie"],
        "StUF": [r"\bstuf\b"],
        "Haal Centraal BRP Personen API": [r"haal\s*centraal.*brp.*personen", r"brp personen bevragen api", r"haalcentraal.*brp", r"haal centraal brp"],
        "Haal Centraal BRP Bewoning API": [r"brp bewoning api"],
        "Documenten API": [r"documenten api", r"\bdrc\b"],
        "Objecten API": [r"objecten api"],
        "Objecttypen API": [r"objecttype(?:n)? api"],
        "Catalogi API": [r"catalogi api", r"catalogus opvragen api", r"\bztc\b"],
        "Zaken API": [r"zaken api", r"\bzrc\b"],
        "Besluiten API": [r"besluiten api"],
        "Autorisaties API": [r"autorisaties api", r"\bac\b"],
        "Klanten API": [r"klanten api"],
        "Contactmomenten API": [r"contactmomenten api"],
        "Klantinteracties API": [r"klantinteracties api"],
        "NL API Strategie": [r"nl[-\s]?api strategie"],
        "OpenAPI": [r"openapi"],
        "JSON:API": [r"json:api"],
        "OAuth 2.0": [r"oauth\s*2", r"\boauth\b", r"oidc", r"openid connect"],
        "SAML": [r"\bsaml\b"],
        "JWT": [r"\bjwt\b"],
        "BAG API": [r"bag bevragen api", r"\bbag api\b"],
        "BRK API": [r"brk bevragen api", r"\bbrk api\b"],
        "KVK / Handelsregister API": [r"\bkvk\b", r"handelsregister"],
        "DSO API": [r"\bdso\b", r"aandeslagmetdeomgevingswet", r"omgevingswet"],
        "CMIS": [r"\bcmis\b"],
        "MDTO": [r"\bmdto\b"],
        "OData": [r"\bodata\b"],
        "DROP": [r"\bdrop\b"],
        "PDOK services": [r"\bpdok\b"],
        "OGC API Features": [r"ogc api.?features", r"ogc-?api"],
        "SensorThings API": [r"sensorthings"],
        "DCAT-AP NL": [r"dcat-?ap\s*nl"],
        "GeoJSON": [r"geojson"],
        "WFS": [r"\bwfs\b"],
        "WMS": [r"\bwms\b"],
        "WMTS": [r"\bwmts\b"],
        "NLX": [r"\bnlx\b"],
        "HAVEN": [r"\bhaven\b"],
        "DigiD": [r"digid"],
        "eHerkenning": [r"eherkenning", r"e-herkenning"],
        "CloudEvents profiel": [r"cloud\s*events", r"nl-gov profiel"],
        "SDG API / SDG-plus": [r"\bsdg\b"],
        "Webhook": [r"webhook"],
        "Alfresco Public API": [r"alfresco public api"],
    }
)

API_IGNORE_PATTERNS = [
    r"^$",
    r"^-+$",
    r"^n\.?v\.?t\.?$",
    r"^geen$",
    r"^nog geen$",
    r"^x$",
    r"^test$",
    r"^anonymous$",
    r"^alle$",
    r"^api-standaarden$",
    r"forms\\.office\\.com",
    r"wordt nog toegevoegd",
    r"momenteel verkennen",
]


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\u00a0", " ")
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = re.sub(r"\s+", " ", text).strip()
    return text.strip(" ;,")


def normalize_key(value: str) -> str:
    return re.sub(r"\s+", " ", clean_text(value).lower())


for logical_name, bron_label in VELDEN.items():
	GENORMALISEERDE_VELDEN[logical_name] = normalize_key(bron_label)


def is_placeholder(value: Any) -> bool:
    text = normalize_key(clean_text(value))
    if not text:
        return True
    return text in PLACEHOLDERS


def parse_iso_timestamp(value: Any) -> str | None:
    text = clean_text(value)
    if not text:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
        except ValueError:
            continue
    return None


def parse_date(value: Any) -> str | None:
    text = clean_text(value)
    if not text:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def split_tokens(value: Any, separators: str) -> list[str]:
    text = clean_text(value)
    if not text:
        return []
    tokens = [clean_text(part) for part in re.split(separators, text)]
    return [token for token in tokens if not is_placeholder(token)]


def split_text_parts(value: Any, *, split_on_commas: bool = False) -> list[str]:
    text = clean_text(value)
    if not text or is_placeholder(text):
        return []
    text = text.replace("•", ";").replace("|", ";").replace(" + ", ",")
    result: list[str] = []
    current: list[str] = []
    depth = 0
    separators = {";", "\n"}
    if split_on_commas:
        separators.add(",")

    for char in text:
        if char == "(":
            depth += 1
        elif char == ")" and depth > 0:
            depth -= 1

        if char in separators and depth == 0:
            token = clean_text("".join(current))
            if token and not is_placeholder(token):
                result.append(token)
            current = []
            continue
        current.append(char)

    token = clean_text("".join(current))
    if token and not is_placeholder(token):
        result.append(token)
    return unique_preserve_order(result)


def extract_domeinen(value: Any) -> list[str]:
    return unique_preserve_order(split_text_parts(value, split_on_commas=True))


def extract_api_standaarden(value: Any) -> list[str]:
    text = clean_text(value)
    if not text or is_placeholder(text):
        return []
    if text.startswith("http://") or text.startswith("https://"):
        return [text]
    return unique_preserve_order(split_text_parts(text, split_on_commas=True))


def extract_named_items(value: Any) -> list[str]:
    return unique_preserve_order(split_text_parts(value, split_on_commas=True))


def looks_like_name_token(token: str) -> bool:
    parts = [part for part in re.split(r"\s+", token) if part]
    if not parts or len(parts) > 6:
        return False
    allowed_lowercase = {"de", "den", "der", "van", "het", "ter", "ten", "aan", "op", "en", "'s"}
    for part in parts:
        if part.lower() in allowed_lowercase:
            continue
        if not re.match(r"^[A-ZÀ-Ý'`][A-Za-zÀ-ÿ'`.-]*$", part):
            return False
    return True


def normalize_gemeente_token(token: str) -> str:
    token = re.sub(r"\s*\(.*?\)", "", token)
    token = re.sub(r"^(gemeente|gemeenten)\s+", "", token, flags=re.IGNORECASE)
    return clean_text(token)


def extract_gemeenten(value: Any) -> list[str]:
    blacklist = {
        "via",
        "productie",
        "ontwikkelaar",
        "ontwikkelaars",
        "interesse",
        "opschalen",
        "gebruiken",
        "gebruikt",
        "gebruik",
        "klanten",
        "gemeentes",
        "gemeenten",
        "enige",
        "directe",
        "alleen",
        "nog",
        "geen",
    }
    result: list[str] = []
    for token in extract_named_items(value):
        token = normalize_gemeente_token(token)
        lowered = normalize_key(token)
        if not token or any(word in lowered for word in blacklist):
            continue
        if re.search(r"\d", token) or "http" in lowered or "www." in lowered:
            continue
        if len(token) > 60:
            continue
        if looks_like_name_token(token):
            result.append(token)
    return unique_preserve_order(result)


def unique_preserve_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        key = normalize_key(item)
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(clean_text(item))
    return result


def canonical_producttype(raw: Any) -> tuple[str, str]:
    text = clean_text(raw)
    lowered = normalize_key(text)
    for needle, target in PRODUCTTYPE_MAP.items():
        if needle in lowered:
            return target, text
    return text or "Toepassing", text


def canonical_fase(raw: Any) -> tuple[str, str]:
    text = clean_text(raw)
    lowered = normalize_key(text)
    for needle, target in FASE_MAP.items():
        if needle in lowered:
            return target, text
    return text or "Verkenning", text


def canonical_cglaag(raw: Any) -> tuple[str, str]:
    text = clean_text(raw)
    lowered = normalize_key(text)
    for needle, target in LAAG_MAP.items():
        if needle in lowered:
            return target, text
    return "", text


def canonical_schaal(raw: Any) -> str:
    if raw is None or raw == "":
        return ""
    text = clean_text(raw)
    match = re.search(r"([1-4])", text)
    if match:
        return f"Schaal {match.group(1)}"
    return text


def request_change(veldnaam: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {"opvoer": {veldnaam: payload}}


def request_entry(tijdstip: str, opmerking: str, wijzigingen: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "registratietype": "registratie",
        "tijdstip": tijdstip,
        "request_path": "/registratie/",
        "request_method": "POST",
        "request_body": {
            "registratie": {
                "id": 0,
                "opmerking": opmerking,
                "registratietype": "registratie",
                "tijdstip": "0001-01-01T00:00:00Z",
            },
            "wijzigingen": wijzigingen,
        },
        "expected_response_code": 201,
        "expected_response_body": None,
    }


def to_code(prefix: str, index: int) -> str:
    return f"{prefix}{index:03d}"


def load_schema_meta(schema_path: Path) -> dict[str, Any]:
    if not schema_path.exists():
        return {}
    try:
        return json.loads(schema_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def canonicalize_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized_row = {normalize_key(key): value for key, value in row.items()}
    result = {}
    for logical_name, normalized_key in GENORMALISEERDE_VELDEN.items():
        result[logical_name] = normalized_row.get(normalized_key)
    return result


def build_reference_map(items: list[str]) -> OrderedDict[str, int]:
    ordered = OrderedDict()
    for item in sorted(unique_preserve_order(items), key=lambda value: normalize_key(value)):
        ordered[item] = len(ordered) + 1
    return ordered


def load_reference_map_from_replay(replay_path: Path, data_key: str, id_field: str, name_field: str) -> OrderedDict[str, int]:
    references: OrderedDict[str, int] = OrderedDict()
    if not replay_path.exists():
        return references
    try:
        replay = json.loads(replay_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return references

    for entry in replay.get("entries", []):
        wijzigingen = entry.get("request_body", {}).get("wijzigingen", [])
        for wijziging in wijzigingen:
            payload = wijziging.get("opvoer", {}).get(data_key)
            if not isinstance(payload, dict):
                continue
            naam = clean_text(payload.get(name_field))
            ref_id = payload.get(id_field)
            if naam and isinstance(ref_id, int):
                references.setdefault(naam, ref_id)
    return references


def build_lookup(reference_map: OrderedDict[str, int]) -> dict[str, int]:
    return {normalize_key(naam): ref_id for naam, ref_id in reference_map.items()}


def find_reference_id(value: str, lookup: dict[str, int], aliases: dict[str, str] | None = None) -> int | None:
    key = normalize_key(value)
    if not key:
        return None
    if key in lookup:
        return lookup[key]
    if key.endswith(".") and key[:-1] in lookup:
        return lookup[key[:-1]]
    if aliases:
        alias_target = aliases.get(key)
        if alias_target:
            return lookup.get(normalize_key(alias_target))
        if key.endswith("."):
            alias_target = aliases.get(key[:-1])
            if alias_target:
                return lookup.get(normalize_key(alias_target))
    return None


def match_domeinen(raw_value: Any, seed_data: dict[str, Any]) -> tuple[list[int], list[str]]:
    lookup = seed_data["domeinen_lookup"]
    tokens = extract_domeinen(raw_value)
    matched_ids: list[int] = []
    seen_ids: set[int] = set()
    overig: list[str] = []
    normalized_tokens = {normalize_key(token) for token in tokens}

    if {"sociaal", "domein"}.issubset(normalized_tokens):
        sociaal_id = find_reference_id("Sociaal Domein", lookup)
        if sociaal_id is not None and sociaal_id not in seen_ids:
            matched_ids.append(sociaal_id)
            seen_ids.add(sociaal_id)

    for token in tokens:
        lowered = normalize_key(token)
        if lowered in {"sociaal", "domein"} and {"sociaal", "domein"}.issubset(normalized_tokens):
            continue

        direct_id = find_reference_id(token, lookup)
        if direct_id is not None:
            if direct_id not in seen_ids:
                matched_ids.append(direct_id)
                seen_ids.add(direct_id)
            continue

        matched = False
        for canonical_name, patterns in DOMEIN_RULES.items():
            if any(re.search(pattern, lowered, flags=re.IGNORECASE) for pattern in patterns):
                domein_id = find_reference_id(canonical_name, lookup)
                if domein_id is not None and domein_id not in seen_ids:
                    matched_ids.append(domein_id)
                    seen_ids.add(domein_id)
                matched = True
                break

        if not matched and token and not is_placeholder(token):
            overig.append(token)

    return matched_ids, unique_preserve_order(overig)


def match_api_standaarden(raw_value: Any, seed_data: dict[str, Any]) -> tuple[list[int], list[str]]:
    text = clean_text(raw_value)
    if not text or is_placeholder(text):
        return [], []

    lookup = seed_data["api_standaarden_lookup"]
    matched_ids: list[int] = []
    seen_ids: set[int] = set()
    normalized = normalize_key(text)

    for canonical_name, patterns in API_RULES.items():
        if any(re.search(pattern, normalized, flags=re.IGNORECASE) for pattern in patterns):
            standaard_id = find_reference_id(canonical_name, lookup)
            if standaard_id is not None and standaard_id not in seen_ids:
                matched_ids.append(standaard_id)
                seen_ids.add(standaard_id)

    overig: list[str] = []
    for token in extract_api_standaarden(raw_value):
        lowered = normalize_key(token)
        if any(re.search(pattern, lowered, flags=re.IGNORECASE) for pattern in API_IGNORE_PATTERNS):
            continue
        if any(re.search(pattern, lowered, flags=re.IGNORECASE) for patterns in API_RULES.values() for pattern in patterns):
            continue
        overig.append(token)

    if not matched_ids and not overig and text:
        if not any(re.search(pattern, normalized, flags=re.IGNORECASE) for pattern in API_IGNORE_PATTERNS):
            overig.append(text)

    return matched_ids, unique_preserve_order(overig)


def match_gemeenten(raw_value: Any, role: str, seed_data: dict[str, Any]) -> tuple[list[dict[str, Any]], list[str]]:
    lookup = seed_data["gemeenten_lookup"]
    aliases = seed_data["gemeente_aliases"]
    relaties: list[dict[str, Any]] = []
    seen_relations: set[tuple[int, str]] = set()
    overig: list[str] = []

    for token in extract_named_items(raw_value):
        normalized_token = normalize_gemeente_token(token)
        if not normalized_token or is_placeholder(normalized_token):
            continue

        direct_id = find_reference_id(normalized_token, lookup, aliases)
        if direct_id is not None:
            rel_key = (direct_id, role)
            if rel_key not in seen_relations:
                relaties.append({"gemeente_id": direct_id, "rol": role})
                seen_relations.add(rel_key)
            continue

        parts = [
            normalize_gemeente_token(part)
            for part in re.split(r"\s+(?:en|/|&|of)\s+", normalized_token)
            if normalize_gemeente_token(part)
        ]

        matched_any = False
        if len(parts) > 1:
            for part in parts:
                part_id = find_reference_id(part, lookup, aliases)
                if part_id is not None:
                    rel_key = (part_id, role)
                    if rel_key not in seen_relations:
                        relaties.append({"gemeente_id": part_id, "rol": role})
                        seen_relations.add(rel_key)
                    matched_any = True
                elif looks_like_name_token(part) and not is_placeholder(part):
                    overig.append(part)
            if matched_any:
                continue

        if looks_like_name_token(normalized_token):
            overig.append(normalized_token)

    return relaties, unique_preserve_order(overig)


def collect_seed_data(rows: list[dict[str, Any]], source_path: Path | None = None) -> dict[str, Any]:
    gemeenten: list[str] = []
    domeinen: list[str] = []
    api_standaarden: list[str] = []
    organisaties: OrderedDict[str, dict[str, str]] = OrderedDict()
    personen: OrderedDict[str, dict[str, str]] = OrderedDict()
    contactpersoon_links: OrderedDict[str, tuple[str, str]] = OrderedDict()

    for row in rows:
        gemeenten.extend(extract_gemeenten(row.get("gemeenten_realisatie")))
        gemeenten.extend(extract_gemeenten(row.get("gemeenten_gebruik")))
        domeinen.extend(extract_domeinen(row.get("domeinen")))
        api_standaarden.extend(extract_api_standaarden(row.get("api_standaarden")))

        contact_org = clean_text(row.get("contact_organisatie"))
        if contact_org and not is_placeholder(contact_org):
            role = "Gemeente" if "gemeente" in normalize_key(contact_org) else ""
            organisaties.setdefault(normalize_key(contact_org), {"naam": contact_org, "rol": role})

        for leverancier in extract_named_items(row.get("leveranciers")):
            key = normalize_key(leverancier)
            existing = organisaties.setdefault(key, {"naam": leverancier, "rol": "Leverancier"})
            if not existing.get("rol"):
                existing["rol"] = "Leverancier"

        po_naam = clean_text(row.get("po_naam"))
        po_email = clean_text(row.get("po_email"))
        if po_naam and not is_placeholder(po_naam):
            person_key = normalize_key(f"{po_naam}|{po_email}")
            personen.setdefault(person_key, {"naam": po_naam, "email": po_email})

            if contact_org and not is_placeholder(contact_org):
                link_key = normalize_key(f"{contact_org}|{po_naam}|{po_email}")
                contactpersoon_links.setdefault(link_key, (normalize_key(contact_org), person_key))

    base_dir = source_path.parent if source_path else None
    externe_gemeenten = load_reference_map_from_replay(base_dir / "Gemeenten CBS 2026.replay.json", "gemeentegegevens", "gemeente_id", "naam") if base_dir else OrderedDict()
    externe_domeinen = load_reference_map_from_replay(base_dir / "Domeinen vast 2026.replay.json", "domeingegevens", "domein_id", "naam") if base_dir else OrderedDict()
    externe_api_standaarden = load_reference_map_from_replay(base_dir / "API standaarden rationalisatie 2026.replay.json", "naam", "apistandaard_id", "naam") if base_dir else OrderedDict()

    gemeenten_map = externe_gemeenten or build_reference_map(gemeenten)
    domeinen_map = externe_domeinen or build_reference_map(domeinen)
    api_standaarden_map = externe_api_standaarden or build_reference_map(api_standaarden)

    return {
        "gemeenten": gemeenten_map,
        "gemeenten_lookup": build_lookup(gemeenten_map),
        "gemeente_aliases": GEMEENTE_ALIASES,
        "domeinen": domeinen_map,
        "domeinen_lookup": build_lookup(domeinen_map),
        "api_standaarden": api_standaarden_map,
        "api_standaarden_lookup": build_lookup(api_standaarden_map),
        "externally_seeded": {
            "gemeenten": bool(externe_gemeenten),
            "domeinen": bool(externe_domeinen),
            "api_standaarden": bool(externe_api_standaarden),
        },
        "organisaties": OrderedDict(
            (info["naam"], index)
            for index, info in enumerate(
                sorted(organisaties.values(), key=lambda item: normalize_key(item["naam"])),
                start=1,
            )
        ),
        "organisatie_meta": {
            info["naam"]: info
            for info in sorted(organisaties.values(), key=lambda item: normalize_key(item["naam"]))
        },
        "personen": OrderedDict(
            (f"{info['naam']}|{info['email']}", index)
            for index, info in enumerate(
                sorted(personen.values(), key=lambda item: normalize_key(f"{item['naam']}|{item['email']}")),
                start=1,
            )
        ),
        "persoon_meta": {
            f"{info['naam']}|{info['email']}": info
            for info in sorted(personen.values(), key=lambda item: normalize_key(f"{item['naam']}|{item['email']}"))
        },
        "contactpersoon_links": list(contactpersoon_links.values()),
    }


def build_seed_entries(seed_data: dict[str, Any], start_time: datetime) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    timestamp = start_time

    gemeente_changes: list[dict[str, Any]] = []
    for naam, gemeente_id in seed_data["gemeenten"].items():
        gemeente_changes.append(request_change("gemeente", {"id": gemeente_id}))
        gemeente_changes.append(
            request_change(
                "gemeentegegevens",
                {"gemeente_id": gemeente_id, "naam": naam, "code": to_code("GM", gemeente_id)},
            )
        )
    if gemeente_changes and not seed_data["externally_seeded"].get("gemeenten"):
        entries.append(request_entry(timestamp.isoformat().replace("+00:00", "Z"), "Seed referentielijst Gemeente", gemeente_changes))
        timestamp += timedelta(seconds=1)

    domein_changes: list[dict[str, Any]] = []
    for naam, domein_id in seed_data["domeinen"].items():
        domein_changes.append(request_change("domein", {"id": domein_id}))
        domein_changes.append(
            request_change(
                "domeingegevens",
                {"domein_id": domein_id, "naam": naam, "omschrijving": f"Geimporteerd uit portfolio intake: {naam}"},
            )
        )
    if domein_changes and not seed_data["externally_seeded"].get("domeinen"):
        entries.append(request_entry(timestamp.isoformat().replace("+00:00", "Z"), "Seed referentielijst Domein", domein_changes))
        timestamp += timedelta(seconds=1)

    api_changes: list[dict[str, Any]] = []
    for naam, standaard_id in seed_data["api_standaarden"].items():
        api_changes.append(request_change("apistandaard", {"id": standaard_id}))
        api_changes.append(request_change("naam", {"apistandaard_id": standaard_id, "naam": naam}))
    if api_changes and not seed_data["externally_seeded"].get("api_standaarden"):
        entries.append(request_entry(timestamp.isoformat().replace("+00:00", "Z"), "Seed referentielijst ApiStandaard", api_changes))
        timestamp += timedelta(seconds=1)

    organisatie_changes: list[dict[str, Any]] = []
    for naam, organisatie_id in seed_data["organisaties"].items():
        meta = seed_data["organisatie_meta"][naam]
        organisatie_changes.append(request_change("organisatie", {"id": organisatie_id}))
        organisatie_changes.append(request_change("organisatienaam", {"organisatie_id": organisatie_id, "naam": meta["naam"]}))
        if meta.get("rol"):
            organisatie_changes.append(
                request_change(
                    "organisatierol",
                    {"organisatie_id": organisatie_id, "type": meta["rol"]},
                )
            )
    if organisatie_changes:
        entries.append(request_entry(timestamp.isoformat().replace("+00:00", "Z"), "Seed organisaties uit portfolio intake", organisatie_changes))
        timestamp += timedelta(seconds=1)

    persoon_changes: list[dict[str, Any]] = []
    for person_key, persoon_id in seed_data["personen"].items():
        meta = seed_data["persoon_meta"][person_key]
        persoon_changes.append(request_change("persoon", {"id": persoon_id}))
        persoon_changes.append(request_change("persoonnaam", {"persoon_id": persoon_id, "naam": meta["naam"]}))
    if persoon_changes:
        entries.append(request_entry(timestamp.isoformat().replace("+00:00", "Z"), "Seed personen uit portfolio intake", persoon_changes))
        timestamp += timedelta(seconds=1)

    contactpersoon_changes: list[dict[str, Any]] = []
    for organisatie_key, person_key in seed_data["contactpersoon_links"]:
        organisatie_meta = next((naam for naam in seed_data["organisaties"] if normalize_key(naam) == organisatie_key), "")
        persoon_meta_key = next((key for key in seed_data["personen"] if normalize_key(key) == person_key), "")
        if not organisatie_meta or not persoon_meta_key:
            continue
        contactpersoon_changes.append(
            request_change(
                "contactpersoon",
                {
                    "organisatie_id": seed_data["organisaties"][organisatie_meta],
                    "persoon_id": seed_data["personen"][persoon_meta_key],
                    "rol": "PO",
                },
            )
        )
    if contactpersoon_changes:
        entries.append(request_entry(timestamp.isoformat().replace("+00:00", "Z"), "Seed contactpersonen uit portfolio intake", contactpersoon_changes))

    return entries


def make_note(row: dict[str, Any], producttype_raw: str, fase_raw: str, lagen_raw: str) -> str:
    parts = [
        f"Portfolio intake bron_id={row.get('bron_id')}",
        f"naam={clean_text(row.get('naam'))}",
    ]
    contact_org = clean_text(row.get("contact_organisatie"))
    po_naam = clean_text(row.get("po_naam"))
    po_email = clean_text(row.get("po_email"))
    if contact_org:
        parts.append(f"contactorganisatie={contact_org}")
    if po_naam:
        parts.append(f"po={po_naam}")
    if po_email:
        parts.append(f"po_email={po_email}")
    if producttype_raw:
        parts.append(f"bron_producttype={producttype_raw}")
    if fase_raw:
        parts.append(f"bron_fase={fase_raw}")
    if lagen_raw:
        parts.append(f"bron_lagen={lagen_raw}")
    return " | ".join(parts)


def build_initiatief_entries(rows: list[dict[str, Any]], seed_data: dict[str, Any], fallback_start: datetime) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    fallback_index = 0

    for row in rows:
        initiatief_id = int(row.get("bron_id") or 0)
        if initiatief_id <= 0:
            continue

        row_tijdstip = parse_iso_timestamp(row.get("begintijd"))
        if row_tijdstip is None:
            row_tijdstip = (fallback_start + timedelta(minutes=fallback_index)).isoformat().replace("+00:00", "Z")
        fallback_index += 1

        producttype, producttype_raw = canonical_producttype(row.get("producttype"))
        fase, fase_raw = canonical_fase(row.get("fase"))
        cglaag, lagen_raw = canonical_cglaag(row.get("lagen"))

        wijzigingen: list[dict[str, Any]] = [request_change("initiatief", {"id": initiatief_id})]

        startdatum = parse_date(row.get("startdatum"))
        if startdatum:
            wijzigingen.append(request_change("initiatief_aanvang", {"initiatief_id": initiatief_id, "datum": startdatum}))

        planningsinfo = clean_text(row.get("planning_info"))
        if planningsinfo or startdatum or parse_date(row.get("ready_for_use")) or clean_text(row.get("tegenaan_gelopen")):
            wijzigingen.append(
                request_change(
                    "planning",
                    {
                        "initiatief_id": initiatief_id,
                        "planningsinfo": planningsinfo,
                        "startdatum": startdatum,
                        "ready_for_use": parse_date(row.get("ready_for_use")),
                        "waar_tegenaan_gelopen": clean_text(row.get("tegenaan_gelopen")),
                        "fase": fase,
                    },
                )
            )

        omschrijving_parts = [clean_text(row.get("omschrijving"))]
        componenten = clean_text(row.get("componenten"))
        parallel = clean_text(row.get("parallel"))
        if componenten and not is_placeholder(componenten):
            omschrijving_parts.append(f"Componenten: {componenten}")
        if parallel and not is_placeholder(parallel):
            omschrijving_parts.append(f"Parallel gebruik: {parallel}")

        product_payload = {
            "initiatief_id": initiatief_id,
            "naam": clean_text(row.get("naam")),
            "omschrijving": " | ".join(part for part in omschrijving_parts if part),
            "pitch": clean_text(row.get("pitch")),
            "website": clean_text(row.get("website")),
            "git_repo": clean_text(row.get("git_repo")),
            "type": producttype,
        }
        if cglaag:
            product_payload["CG_laag"] = cglaag
        wijzigingen.append(request_change("product", product_payload))

        bijdrage_specs = [
            ("Wendbaarheid", canonical_schaal(row.get("wendbaarheid_schaal")), clean_text(row.get("wendbaarheid_toelichting"))),
            ("Dienstverlening", canonical_schaal(row.get("dienstverlening_schaal")), clean_text(row.get("dienstverlening_toelichting"))),
            ("Regie", canonical_schaal(row.get("regie_schaal")), clean_text(row.get("regie_toelichting"))),
        ]
        for bijdrage_type, schaal, toelichting in bijdrage_specs:
            if not schaal and not toelichting:
                continue
            wijzigingen.append(
                request_change(
                    "bijdrage",
                    {
                        "initiatief_id": initiatief_id,
                        "type_bijdrage": bijdrage_type,
                        "schaal": schaal,
                        "toelichting": toelichting,
                    },
                )
            )

        matched_domeinen, overige_domeinen = match_domeinen(row.get("domeinen"), seed_data)
        for domein_id in matched_domeinen:
            wijzigingen.append(request_change("initiatiefdomein", {"initiatief_id": initiatief_id, "domein_id": domein_id}))
        if overige_domeinen:
            wijzigingen.append(
                request_change(
                    "anderdomein",
                    {"initiatief_id": initiatief_id, "domein": "; ".join(overige_domeinen)},
                )
            )

        gemeente_relaties: list[dict[str, Any]] = []
        overige_gemeenten: list[str] = []
        for raw_value, rol in (
            (row.get("gemeenten_realisatie"), "Realiseert"),
            (row.get("gemeenten_gebruik"), "Maakt gebruik van"),
        ):
            relaties, overig = match_gemeenten(raw_value, rol, seed_data)
            for relatie in relaties:
                if relatie not in gemeente_relaties:
                    gemeente_relaties.append(relatie)
            overige_gemeenten.extend(overig)

        for relatie in gemeente_relaties:
            wijzigingen.append(
                request_change(
                    "initiatiefgemeente",
                    {
                        "initiatief_id": initiatief_id,
                        "gemeente_id": relatie["gemeente_id"],
                        "rol": relatie["rol"],
                    },
                )
            )
        overige_gemeenten = unique_preserve_order(overige_gemeenten)
        if overige_gemeenten:
            wijzigingen.append(
                request_change(
                    "andersdangemeente",
                    {"initiatief_id": initiatief_id, "andersDanGemeente": "; ".join(overige_gemeenten)},
                )
            )

        matched_api_standaarden, overige_api_standaarden = match_api_standaarden(row.get("api_standaarden"), seed_data)
        for standaard_id in matched_api_standaarden:
            wijzigingen.append(
                request_change(
                    "initiatiefapistandaard",
                    {"initiatief_id": initiatief_id, "apistandaard_id": standaard_id},
                )
            )
        if overige_api_standaarden:
            wijzigingen.append(
                request_change(
                    "andereapistandaard",
                    {"initiatief_id": initiatief_id, "api_standaard": "; ".join(overige_api_standaarden)},
                )
            )

        entries.append(
            request_entry(
                row_tijdstip,
                make_note(row, producttype_raw, fase_raw, lagen_raw),
                wijzigingen,
            )
        )

    return entries


def build_replay(source_rows: list[dict[str, Any]], schema_meta: dict[str, Any], source_path: Path, schema_path: Path) -> dict[str, Any]:
    seed_data = collect_seed_data(source_rows, source_path)

    row_times = [parse_iso_timestamp(row.get("begintijd")) for row in source_rows]
    parsed_times = [datetime.fromisoformat(value.replace("Z", "+00:00")) for value in row_times if value]
    earliest_time = min(parsed_times) if parsed_times else datetime.now(timezone.utc)
    seed_start = earliest_time - timedelta(minutes=10)

    entries = build_seed_entries(seed_data, seed_start)
    entries.extend(build_initiatief_entries(source_rows, seed_data, earliest_time))

    schema_label = clean_text(schema_meta.get("naam")) or schema_path.name
    schema_version = clean_text(schema_meta.get("versie")) or "onbekend"

    return {
        "version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": f"json://{source_path}",
        "schema_source": f"json://{schema_path}",
        "schema_model": {"naam": schema_label, "versie": schema_version},
        "count": len(entries),
        "generated_reference_counts": {
            "gemeenten": len(seed_data["gemeenten"]),
            "domeinen": len(seed_data["domeinen"]),
            "api_standaarden": len(seed_data["api_standaarden"]),
            "organisaties": len(seed_data["organisaties"]),
            "personen": len(seed_data["personen"]),
        },
        "known_gaps": [
            "Initiatief heeft in cgpf 0.3.7/0.4.4 nog geen uitgewerkte relationele koppeling naar Organisatie voor alle betrokken organisaties; contactorganisaties en leveranciers worden daarom nog steeds als losse seed-entiteiten opgevoerd.",
            "De huidige MetaRegistry gebruikt dezelfde request-key 'contactgegevens' voor Organisatie_Contactgegevens en Persoon_Contactgegevens; deze generator laat die records daarom bewust weg uit het replay-bestand.",
            "Bronwaarden voor producttype, fase en CG-laag zijn rijker dan de huidige enums. De generator normaliseert die waarden en bewaart de ruwe bronwaarde in registratie.opmerking.",
            "Voor gemeente, domein en API-standaard geldt nu: match op de referentielijst => REL opvoeren; geen match => opslaan in het bijbehorende overig-GE (`anderdomein`, `andersdangemeente`, `andereapistandaard`).",
            "Wanneer de losse seed-replays voor gemeenten, domeinen en API-standaarden aanwezig zijn, gebruikt de generator die als bron en worden die referenties niet opnieuw in dit replay-bestand geseed.",
        ],
        "entries": entries,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Zet de CG portfolio intake-JSON om naar een draft replay-bestand voor /registratie/.")
    parser.add_argument("source_json", type=Path, help="Pad naar Intake Portfolio Common Ground 1.json")
    parser.add_argument("schema_json", type=Path, help="Pad naar een CGPF schema-export, bijvoorbeeld CGPF 0.4.4.json")
    parser.add_argument("output_json", type=Path, help="Pad voor het replay JSON-bestand")
    args = parser.parse_args()

    rows = [canonicalize_row(row) for row in json.loads(args.source_json.read_text(encoding="utf-8"))]
    schema_meta = load_schema_meta(args.schema_json)
    replay = build_replay(rows, schema_meta, args.source_json, args.schema_json)

    args.output_json.write_text(json.dumps(replay, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"rows={len(rows)}")
    print(f"entries={replay['count']}")
    print(f"output={args.output_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())