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

Stip op land (28-09): het middelpunt van een gemeente is dat van het hele vlak, water inbegrepen,
en valt bij gemeenten met veel water in zee of het IJsselmeer (Terschelling, Urk, Hoorn,
Vlissingen, …). Ligt de stip niet op land, dan het middelpunt van de woonplaats met dezelfde naam,
anders van de woonplaats die het dichtst bij het middelpunt ligt; valt dat punt (door de vereenvoudigde kust) buiten land, dan het
dichtstbijzijnde punt net binnen de kust.

Caribisch Nederland (28-09): Bonaire, Sint Eustatius en Saba in kaders linksboven in zee (zoals
op de meeste kaarten van NL), elk kader met een eigen schaal. Omtrek: Natural Earth (10m, map
subunits, publiek domein). Codes: de fictieve CBS-gemeentecodes 9001, 9002 en 9003 (GM9001–GM9003).

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
NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_map_subunits.geojson"

# Caribisch Nederland: code, naam, (lon, lat) om het eiland in Natural Earth te herkennen, woonplaatsen.
BES = [
    ("GM9001", "Bonaire", (-68.27, 12.20), ["Kralendijk", "Rincon"]),
    ("GM9002", "Sint Eustatius", (-62.97, 17.49), ["Oranjestad"]),
    ("GM9003", "Saba", (-63.23, 17.63), ["The Bottom", "Windwardside", "St. Johns", "Zion's Hill", "Hell's Gate"]),
]
# Kaders in de viewBox (linksboven is zee, tot y≈100): titelregels, eiland, [x, y, breedte, hoogte].
# Eén eiland per kader, elk met een eigen schaal (anders wordt Saba een puntje); de naam links,
# het eiland rechts over de volle hoogte.
KADERS = [
    (["Bonaire"], "GM9001", [4, 4, 70, 40]),
    (["Saba"], "GM9003", [4, 48, 70, 24]),
    (["Sint", "Eustatius"], "GM9002", [4, 76, 70, 24]),
]
TITELBREEDTE, MARGE = 30, 3

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


def ringen_van_pad(pad):
    return [[tuple(map(float, q.split(","))) for q in deel.rstrip("Z").split("L")] for deel in pad.split("M") if deel]


def binnen(x, y, ring):
    c = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def zwaartepunt(pts):
    """Zwaartepunt van een veelhoek (niet het gemiddelde van de hoekpunten)."""
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        k = x1 * y2 - x2 * y1
        a += k
        cx += (x1 + x2) * k
        cy += (y1 + y2) * k
    if abs(a) < 1e-9:
        return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
    return cx / (3 * a), cy / (3 * a)


def op_land(x, y, ringen):
    return any(binnen(x, y, r) for r in ringen)


def naar_land(x, y, ringen, marge=0.8):
    """Het dichtstbijzijnde punt op land, met wat marge van de kust (de stip heeft een straal):
    kandidaten in steeds grotere kringen rond (x, y); de eerste kring met punten op land wint,
    en daarin het punt dat het verst van de kust ligt (tot `marge`)."""
    def randafstand(px, py):
        best = float("inf")
        for ring in ringen:
            for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
                dx, dy = x2 - x1, y2 - y1
                t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / ((dx * dx + dy * dy) or 1e-12)))
                best = min(best, math.hypot(x1 + t * dx - px, y1 + t * dy - py))
        return best
    for straal in [0.4 * k for k in range(1, 40)]:
        kring = [(x + straal * math.cos(2 * math.pi * i / 24), y + straal * math.sin(2 * math.pi * i / 24)) for i in range(24)]
        op = [q for q in kring if op_land(*q, ringen)]
        if op:
            return max(op, key=lambda q: min(randafstand(*q), marge))
    return x, y


def caribisch_nederland():
    """Kaders met de eilanden, en de drie openbare lichamen als 'gemeenten' met x/y in hun kader."""
    eilanden = {}
    for f in haal(NE)["features"]:
        if f["properties"].get("SUBUNIT") != "Caribbean Netherlands":
            continue
        for poly in f["geometry"]["coordinates"]:
            ring = poly[0]
            lon = sum(p[0] for p in ring) / len(ring)
            lat = sum(p[1] for p in ring) / len(ring)
            code = min(BES, key=lambda b: (b[2][0] - lon) ** 2 + (b[2][1] - lat) ** 2)[0]
            eilanden.setdefault(code, []).append(ring)
    kaders, gemeenten = [], {}
    for regels, code, (kx, ky, kb, kh) in KADERS:
        ringen = eilanden.get(code, [])
        if not ringen:
            continue
        # Eigen schaal: het eiland passend in het deel rechts van de naam, over de volle hoogte.
        cosk = math.cos(math.radians(sum(p[1] for r in ringen for p in r) / sum(len(r) for r in ringen)))
        xs = [p[0] * cosk for r in ringen for p in r]
        ys = [p[1] for r in ringen for p in r]
        vx, vy = kx + TITELBREEDTE, ky + MARGE
        vb, vh = kb - TITELBREEDTE - MARGE, kh - 2 * MARGE
        schaal = min(vb / (max(xs) - min(xs)), vh / (max(ys) - min(ys)))
        ox = vx + (vb - (max(xs) - min(xs)) * schaal) / 2
        oy = vy + (vh - (max(ys) - min(ys)) * schaal) / 2

        def proj(lon, lat):
            return (round(ox + (lon * cosk - min(xs)) * schaal, 2), round(oy + (max(ys) - lat) * schaal, 2))

        paden = []
        for ring in ringen:
            pts = [proj(lon, lat) for lon, lat in ring]
            paden.append("M" + "L".join(f"{x:g},{y:g}" for x, y in pts) + "Z")
        # De stip: het zwaartepunt van het grootste stuk; ligt dat buiten het eiland (grillige
        # vorm), dan het omtrekpunt dat er het dichtst bij ligt.
        pts = [proj(lon, lat) for lon, lat in max(ringen, key=len)]
        mx, my = zwaartepunt(pts)
        if not binnen(mx, my, pts):
            mx, my = min(pts, key=lambda p: (p[0] - mx) ** 2 + (p[1] - my) ** 2)
        naam, plaatsen = next((b[1], b[3]) for b in BES if b[0] == code)
        gemeenten[code] = {"naam": naam, "x": round(mx, 2), "y": round(my, 2), "woonplaatsen": sorted(plaatsen), "kader": naam}
        kaders.append({"titel": naam, "regels": regels, "kader": [kx, ky, kb, kh], "pad": "".join(paden)})
    return kaders, gemeenten


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jaar", type=int, default=2026, help="jaarcode van de provinciegrenzen")
    ap.add_argument("--tol", type=float, default=0.3, help="vereenvoudiging in viewBox-eenheden")
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

    plaatspunten = {}  # gemeentecode → [(naam, x, y)]
    for d in locatieserver("type:woonplaats", "woonplaatsnaam,gemeentecode,centroide_ll"):
        code = "GM" + str(d.get("gemeentecode", "")).zfill(4)
        if code in gemeenten and d.get("woonplaatsnaam"):
            gemeenten[code]["woonplaatsen"].append(d["woonplaatsnaam"])
            p = punt(d.get("centroide_ll"))
            if p:
                plaatspunten.setdefault(code, []).append((d["woonplaatsnaam"], *projecteer(*p)))
    for g in gemeenten.values():
        g["woonplaatsen"] = sorted(set(g["woonplaatsen"]))
    print(f"woonplaatsen: {sum(len(g['woonplaatsen']) for g in gemeenten.values())}")

    # Stip op land: zie de uitleg bovenaan.
    land = [r for p in provincies for r in ringen_van_pad(p["pad"])]
    verplaatst = []
    for code, g in gemeenten.items():
        if op_land(g["x"], g["y"], land):
            continue
        # Doel: de woonplaats met de naam van de gemeente, anders de woonplaats die het dichtst
        # bij het middelpunt ligt (bij een eiland ligt die op het eiland, niet op de vaste wal).
        plaatsen = plaatspunten.get(code, [])
        zelfde = [p for p in plaatsen if p[0].lower() == g["naam"].lower()]
        dichtst = sorted(plaatsen, key=lambda p: (p[1] - g["x"]) ** 2 + (p[2] - g["y"]) ** 2)
        keus = (zelfde or dichtst or [None])[0]
        doel = (keus[1], keus[2]) if keus else (g["x"], g["y"])
        # De kust is vereenvoudigd: ook een kustplaats kan er net buiten vallen. Dan naar het
        # dichtstbijzijnde punt net binnen de kust.
        x, y = doel if op_land(*doel, land) else naar_land(*doel, land)
        x, y = round(x, 2), round(y, 2)
        if not op_land(x, y, land):  # op de rand: na afronden net in het water
            x, y = (round(v, 2) for v in naar_land(x, y, land))
        g["x"], g["y"] = x, y
        verplaatst.append(f"{g['naam']} → {keus[0] if keus else 'de kust'}")
    print(f"stip naar land verplaatst: {len(verplaatst)}: " + "; ".join(verplaatst))

    alle_x = [g["x"] for g in gemeenten.values()]
    alle_y = [g["y"] for g in gemeenten.values()]
    kaders, bes = caribisch_nederland()
    gemeenten.update(bes)
    print(f"Caribisch Nederland: {len(bes)} eilanden in {len(kaders)} kaders")
    uit = {
        "bron": "PDOK: CBS gebiedsindelingen (provincie_gegeneraliseerd) en Locatieserver (gemeente, woonplaats); Caribisch Nederland: Natural Earth; scripts/maak_nl_kaartdata.py",
        "projectie": {"lon0": LON0, "lat0": LAT0, "latMid": LAT_MID, "schaal": SCHAAL},
        "viewBox": [0, 0, round(max(alle_x) + 12), round(max(alle_y) + 12)],
        "provincies": provincies,
        "kaders": kaders,
        "gemeenten": dict(sorted(gemeenten.items())),
    }
    os.makedirs(os.path.dirname(os.path.abspath(a.uit)), exist_ok=True)
    with open(a.uit, "w", encoding="utf-8", newline="\n") as f:
        json.dump(uit, f, ensure_ascii=False, separators=(",", ":"))
    print(f"geschreven: {a.uit} ({os.path.getsize(a.uit) // 1024} kB)")


if __name__ == "__main__":
    sys.exit(main())
