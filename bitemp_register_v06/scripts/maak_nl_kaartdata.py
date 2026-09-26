#!/usr/bin/env python3
"""maak_nl_kaartdata.py — kaartdata voor de vorm `nl-map` (gemeente als stip op de kaart van NL).

Haalt bij PDOK (open data, geen sleutel nodig):
  - de provinciegrenzen (CBS gebiedsindelingen, gegeneraliseerd) → vereenvoudigd tot SVG-paden;
  - per gemeente het middelpunt (Locatieserver, type gemeente) en de CBS-code (GM0344);
  - per gemeente de woonplaatsen (Locatieserver, type woonplaats): wie een gemeentenaam na een
    fusie niet kent, kent de plaatsen erin meestal wel.
en schrijft één JSON (standaard web/vite/src/vormen/data/nl-kaart.json) in een eigen vlak:
x/y in de viewBox, met een eenvoudige projectie (lengtegraad × cos 52,2°). Nauwkeurig genoeg voor
een stip op een kaartje; geen GIS.

Opnieuw draaien na een gemeentelijke herindeling (1 januari):
  python3 scripts/maak_nl_kaartdata.py [--jaar 2026] [--uit pad]
"""
import argparse
import json
import math
import os
import re
import sys
import urllib.parse
import urllib.request

LS = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free"
CBS = "https://api.pdok.nl/cbs/gebiedsindelingen/ogc/v1/collections/provincie_gegeneraliseerd/items"

# Projectievlak: NL ligt ruwweg tussen 3,3–7,3 °O en 50,7–53,6 °N.
LON0, LAT0, LAT_MID = 3.30, 53.60, 52.2
SCHAAL = 100.0  # eenheden per graad (na cos-correctie)
KX = math.cos(math.radians(LAT_MID))


def projecteer(lon, lat):
    return round((lon - LON0) * KX * SCHAAL, 2), round((LAT0 - lat) * SCHAAL, 2)


def haal(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def locatieserver(fq, fl):
    """Alle documenten van een type; de Locatieserver geeft maximaal 100 rijen per verzoek."""
    docs, start = [], 0
    while True:
        q = urllib.parse.urlencode({"q": "*:*", "fq": fq, "fl": fl, "rows": 100, "start": start})
        r = haal(f"{LS}?{q}")["response"]
        docs += r["docs"]
        start += 100
        if start >= r["numFound"] or not r["docs"]:
            return docs


def punt(wkt):
    m = re.match(r"POINT\(([-\d.]+) ([-\d.]+)\)", wkt or "")
    return (float(m.group(1)), float(m.group(2))) if m else None


def vereenvoudig(punten, tol):
    """Douglas-Peucker op een lijst (x, y)."""
    if len(punten) < 3:
        return punten
    (x1, y1), (x2, y2) = punten[0], punten[-1]
    dx, dy = x2 - x1, y2 - y1
    lengte = math.hypot(dx, dy) or 1e-12
    maxd, idx = 0.0, 0
    for i in range(1, len(punten) - 1):
        x, y = punten[i]
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / lengte
        if d > maxd:
            maxd, idx = d, i
    if maxd <= tol:
        return [punten[0], punten[-1]]
    return vereenvoudig(punten[: idx + 1], tol)[:-1] + vereenvoudig(punten[idx:], tol)


def vereenvoudig_ring(punten, tol):
    """Gesloten ring (begin = eind): splits op het verste punt van het begin; anders heeft de
    referentielijn lengte nul en klapt Douglas-Peucker de hele ring in."""
    if len(punten) < 4:
        return punten
    x0, y0 = punten[0]
    k = max(range(len(punten)), key=lambda i: (punten[i][0] - x0) ** 2 + (punten[i][1] - y0) ** 2)
    return vereenvoudig(punten[: k + 1], tol)[:-1] + vereenvoudig(punten[k:], tol)


def ring_naar_pad(ring, tol):
    pts = vereenvoudig_ring([projecteer(lon, lat) for lon, lat in ring], tol)
    if len(pts) < 4:
        return ""
    return "M" + "L".join(f"{x:g},{y:g}" for x, y in pts) + "Z"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jaar", type=int, default=2026, help="jaarcode van de provinciegrenzen")
    ap.add_argument("--tol", type=float, default=0.6, help="vereenvoudiging in viewBox-eenheden")
    ap.add_argument("--uit", default=os.path.join(os.path.dirname(__file__), "..", "web", "vite", "src", "vormen", "data", "nl-kaart.json"))
    a = ap.parse_args()

    # Provincies (valt terug op het jaar ervoor als het jaar nog niet gepubliceerd is).
    features = []
    for jaar in (a.jaar, a.jaar - 1, a.jaar - 2):
        d = haal(f"{CBS}?f=json&limit=50&jaarcode={jaar}")
        features = d.get("features", [])
        if features:
            print(f"provincies: {len(features)} (jaarcode {jaar})")
            break
    provincies = []
    for f in features:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        pad = "".join(ring_naar_pad(p[0], a.tol) for p in polys if p)
        naam = f["properties"].get("statnaam") or f["properties"].get("naam") or ""
        provincies.append({"naam": naam, "pad": pad})
    provincies.sort(key=lambda p: p["naam"])

    gemeenten = {}
    for d in locatieserver("type:gemeente", "gemeentecode,gemeentenaam,centroide_ll"):
        p = punt(d.get("centroide_ll"))
        if not p:
            continue
        code = "GM" + d["gemeentecode"].zfill(4)
        x, y = projecteer(*p)
        gemeenten[code] = {"naam": d["gemeentenaam"], "x": x, "y": y, "woonplaatsen": []}
    print(f"gemeenten: {len(gemeenten)}")

    for d in locatieserver("type:woonplaats", "woonplaatsnaam,gemeentecode"):
        code = "GM" + str(d.get("gemeentecode", "")).zfill(4)
        if code in gemeenten and d.get("woonplaatsnaam"):
            gemeenten[code]["woonplaatsen"].append(d["woonplaatsnaam"])
    for g in gemeenten.values():
        g["woonplaatsen"] = sorted(set(g["woonplaatsen"]))
    print(f"woonplaatsen: {sum(len(g['woonplaatsen']) for g in gemeenten.values())}")

    alle_x = [g["x"] for g in gemeenten.values()]
    alle_y = [g["y"] for g in gemeenten.values()]
    uit = {
        "bron": "PDOK: CBS gebiedsindelingen (provincie_gegeneraliseerd) en Locatieserver (gemeente, woonplaats); scripts/maak_nl_kaartdata.py",
        "projectie": {"lon0": LON0, "lat0": LAT0, "latMid": LAT_MID, "schaal": SCHAAL},
        "viewBox": [0, 0, round(max(alle_x) + 12), round(max(alle_y) + 12)],
        "provincies": provincies,
        "gemeenten": dict(sorted(gemeenten.items())),
    }
    os.makedirs(os.path.dirname(os.path.abspath(a.uit)), exist_ok=True)
    with open(a.uit, "w", encoding="utf-8", newline="\n") as f:
        json.dump(uit, f, ensure_ascii=False, separators=(",", ":"))
    print(f"geschreven: {a.uit} ({os.path.getsize(a.uit) // 1024} kB)")


if __name__ == "__main__":
    sys.exit(main())
