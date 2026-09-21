#!/usr/bin/env python3
"""genereer-load-seed.py — maakt een dik, synthetisch replay-bestand voor np-loc.

Doel: de database vullen met veel data die NIET netjes op een rij staat, als
begintoestand voor load- en performancetests (zie docs/REGRESSIETEST.md, Loadtests).

Per natuurlijk persoon (NP) één registratie met persoonsidentificatie (BSN met
11-proef), naam, burgerschap, naamgebruik, aanvang en soms partnernaam; per locatie
(LOC) één registratie met adres (gemeente uit de CBS-lijst), BAG-locatie en aanvang;
daarna per NP een woonadres-link naar een locatie. NP- en LOC-registraties staan
door elkaar; links komen daarna in willekeurige volgorde. Alles is herhaalbaar via
--seed.

Gebruik:
  python scripts/genereer-load-seed.py --np 2000
  python scripts/genereer-load-seed.py --np 500 --seed 7 --uit "replay files/x.json"

Afspelen als seed (samen met de gemeentelijst, die het adres nodig heeft):
  REGRESSIE_SEEDS="replay files/registraties-replay-init-gemeenten-cbs-2026.json;replay files/registraties-replay-load-np-loc-2000.json"

Het gegenereerde bestand hoort niet in git (.gitignore: replay files/registraties-replay-load-*.json).
"""
import argparse
import datetime as dt
import json
import os
import random
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HIER)
GEMEENTEN_STANDAARD = os.path.join(APP, "replay files", "registraties-replay-init-gemeenten-cbs-2026.json")

VOORNAMEN = ["Lena", "Joris", "Sanne", "Daan", "Fleur", "Bram", "Noor", "Sem", "Eva", "Luuk", "Iris", "Milan",
             "Tess", "Finn", "Lotte", "Jesse", "Anna", "Thijs", "Julia", "Ruben", "Emma", "Lars", "Sofie", "Timo",
             "Mila", "Sven", "Roos", "Kai", "Nina", "Max", "Zoë", "Gijs", "Lieke", "Niels", "Femke", "Koen",
             "Maud", "Pim", "Isa", "Stijn"]
ACHTERNAMEN = ["Jansen", "de Vries", "van den Berg", "van Dijk", "Bakker", "Janssen", "Visser", "Smit", "Meijer",
               "de Boer", "Mulder", "de Groot", "Bos", "Vos", "Peters", "Hendriks", "van Leeuwen", "Dekker",
               "Brouwer", "de Wit", "Dijkstra", "Smits", "de Graaf", "van der Meer", "van der Linden", "Kok",
               "Jacobs", "de Haan", "Vermeulen", "van den Heuvel", "van der Veen", "van den Broek", "de Bruijn",
               "de Bruin", "van der Heijden", "Schouten", "van Beek", "Willems", "van Vliet", "van de Ven",
               "Hoekstra", "Maas", "Verhoeven", "Koster", "van Dam", "van der Wal", "Prins", "Blom", "Huisman",
               "Peeters", "de Jong", "Kuipers", "van Veen", "Post", "Kramer", "van Wijk", "Timmermans", "Groen"]
STRATEN = ["Lindelaan", "Kerkstraat", "Dorpsstraat", "Molenweg", "Schoolstraat", "Stationsstraat", "Beukenlaan",
           "Rivierstraat", "Julianastraat", "Wilhelminalaan", "Nieuwstraat", "Hoofdstraat", "Parallelweg",
           "Sportlaan", "Industrieweg", "Meidoornstraat", "Eikenlaan", "Zandweg", "Kanaalstraat", "Havenkade"]
NAAMGEBRUIK = ["EigenNaam", "PartnerNaam", "EigenNaam-PartnerNaam", "PartnerNaam-EigenNaam"]


def splits_achternaam(volledig):
    delen = volledig.split(" ")
    if len(delen) == 1:
        return "", delen[0]
    return " ".join(delen[:-1]), delen[-1]


def bsn(rng, gebruikt):
    """Synthetische BSN die aan de 11-proef voldoet (som d_i*(9-i) voor i<8, min d_8, deelbaar door 11)."""
    while True:
        cijfers = [rng.randint(1, 9)] + [rng.randint(0, 9) for _ in range(7)]
        som = sum(c * (9 - i) for i, c in enumerate(cijfers))
        controle = som % 11
        if controle == 10:
            continue
        s = "".join(map(str, cijfers)) + str(controle)
        if s not in gebruikt:
            gebruikt.add(s)
            return s


def postcode(rng):
    while True:
        letters = "".join(rng.choice("ABCDEFGHJKLMNPRSTUVWXYZ") for _ in range(2))
        if letters not in ("SA", "SD", "SS"):
            return "%d%s" % (rng.randint(1000, 9999), letters)


def datum(rng, van_jaar, tot_jaar):
    d = dt.date(rng.randint(van_jaar, tot_jaar), rng.randint(1, 12), rng.randint(1, 28))
    return d.isoformat()


def lees_gemeenten(pad):
    with open(pad, encoding="utf-8") as f:
        rb = json.load(f)
    ids = []
    for e in rb["entries"]:
        for w in e["request_body"]["wijzigingen"]:
            g = w.get("opvoer", {}).get("gemeente")
            if g and "id" in g:
                ids.append(int(g["id"]))
    if not ids:
        raise SystemExit("geen gemeente-id's gevonden in " + pad)
    return ids


def registratie(opmerking, wijzigingen):
    return {
        "request_method": "POST",
        "request_path": "/registratie/",
        "expected_response_code": 201,
        "request_body": {
            "registratie": {"id": 0, "opmerking": opmerking, "registratietype": "registratie",
                            "tijdstip": "0001-01-01T00:00:00Z"},
            "wijzigingen": [{"opvoer": w} for w in wijzigingen],
        },
    }


def maak_np(rng, i, bsns):
    voornaam = rng.choice(VOORNAMEN)
    tussen, achter = splits_achternaam(rng.choice(ACHTERNAMEN))
    w = [
        {"natuurlijkpersoon": {"id": i}},
        {"persoonsidentificatie": {"natuurlijkpersoon_id": i, "bsn": bsn(rng, bsns), "ingezetene": rng.random() < 0.95}},
        {"naam": {"natuurlijkpersoon_id": i, "voorletters": voornaam[0] + ".", "roepnaam": voornaam,
                  "tussenvoegsel": tussen, "achternaam": achter}},
        {"burgerschap": {"natuurlijkpersoon_id": i, "landcode": "NL", "nationaliteit": "Nederlandse"}},
    ]
    if rng.random() < 0.4:
        _, partner = splits_achternaam(rng.choice(ACHTERNAMEN))
        w.append({"partnernaam": {"natuurlijkpersoon_id": i, "achternaam": partner}})
        w.append({"naamgebruik": {"natuurlijkpersoon_id": i, "naamgebruik": rng.choice(NAAMGEBRUIK)}})
    else:
        w.append({"naamgebruik": {"natuurlijkpersoon_id": i, "naamgebruik": "EigenNaam"}})
    w.append({"natuurlijkpersoon_aanvang": {"natuurlijkpersoon_id": i, "datum": datum(rng, 1935, 2008)}})
    return registratie("Synthetische NatuurlijkPersoon NP=%d (load-seed)" % i, w)


def maak_loc(rng, i, gemeenten):
    gemeente = rng.choice(gemeenten)
    w = [
        {"locatie": {"id": i}},
        {"adres": {"locatie_id": i, "straatnaam": rng.choice(STRATEN), "huisnummer": str(rng.randint(1, 250)),
                   "postcode": postcode(rng), "gemeente": gemeente}},
        {"baglocatie": {"locatie_id": i, "adresaanduiding": "%04d%012d" % (gemeente, i)}},
        {"locatie_aanvang": {"locatie_id": i, "datum": datum(rng, 1960, 2024)}},
    ]
    return registratie("Synthetische Locatie LOC=%d (load-seed)" % i, w)


def maak_link(rng, np_id, loc_id):
    w = [
        {"bereikbaarheid": {"natuurlijkpersoon_id": np_id, "locatie_id": loc_id, "soort": "Woonadres"}},
        {"bereikbaarheid_aanvang": {"natuurlijkpersoon_id": np_id, "datum": datum(rng, 2005, 2026)}},
    ]
    return registratie("Synthetische woonadres-link NP=%d -> LOC=%d (load-seed)" % (np_id, loc_id), w)


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--np", type=int, default=2000, help="aantal natuurlijke personen (en locaties)")
    p.add_argument("--loc", type=int, default=0, help="aantal locaties (default: gelijk aan --np)")
    p.add_argument("--seed", type=int, default=42, help="seed voor herhaalbaarheid")
    p.add_argument("--gemeenten", default=GEMEENTEN_STANDAARD, help="CBS-gemeenten-replay om geldige gemeente-id's uit te halen")
    p.add_argument("--uit", default="", help="uitvoerbestand (default: replay files/registraties-replay-load-np-loc-<np>.json)")
    a = p.parse_args()

    aantal_loc = a.loc or a.np
    rng = random.Random(a.seed)
    gemeenten = lees_gemeenten(a.gemeenten)
    bsns = set()

    # NP's en LOC's door elkaar, daarna de links in willekeurige volgorde.
    volgorde = [("np", i) for i in range(1, a.np + 1)] + [("loc", i) for i in range(1, aantal_loc + 1)]
    rng.shuffle(volgorde)
    entries = []
    for soort, i in volgorde:
        entries.append(maak_np(rng, i, bsns) if soort == "np" else maak_loc(rng, i, gemeenten))
    links = list(range(1, a.np + 1))
    rng.shuffle(links)
    for np_id in links:
        entries.append(maak_link(rng, np_id, rng.randint(1, aantal_loc)))

    uit = a.uit or os.path.join(APP, "replay files", "registraties-replay-load-np-loc-%d.json" % a.np)
    bestand = {
        "version": 1,
        "exported_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "source": "scripts/genereer-load-seed.py --np %d --loc %d --seed %d" % (a.np, aantal_loc, a.seed),
        "count": len(entries),
        "notes": [
            "Synthetische load-seed voor np-loc: %d NP's, %d locaties, %d woonadres-links; NP/LOC door elkaar." % (a.np, aantal_loc, a.np),
            "BSN's voldoen aan de 11-proef; adres.gemeente verwijst naar de CBS-gemeentelijst (speel die eerst af).",
            "Herhaalbaar: zelfde --seed geeft hetzelfde bestand.",
        ],
        "entries": entries,
    }
    with open(uit, "w", encoding="utf-8") as f:
        json.dump(bestand, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("geschreven: %s (%d entries, %.1f MB)" % (uit, len(entries), os.path.getsize(uit) / 1e6))
    return 0


if __name__ == "__main__":
    sys.exit(main())
