"""valideer-odrl.py — een ODRL-beleid (Turtle) tegen de SHACL-kern, met de vocabulaire erbij.

De kern (odrl22-kern.shacl.ttl) gebruikt sh:class: een waarde moet haar rdf:type in de data hebben
(odrl:eq is een odrl:Operator, odrl:PartyCollection een subklasse van odrl:Party). Die types staan
in de ODRL-vocabulaire, niet in het beleid. Dit script voegt beleid en vocabulaire samen en valideert
met pyshacl, ook de shapes zelf (meta-SHACL) en met sh:sparql aan.

    python valideer-odrl.py beleid.odrl.ttl --vocab ODRL22.ttl [--vocab apnl-plaatsvervanger.ttl]

ODRL22.ttl is de W3C-vocabulaire (https://www.w3.org/ns/odrl/2/ODRL22.ttl); niet in de repo.
Exitcode 0 als het beleid conform is, anders 1. Vereist pyshacl (getest met 0.40.2).
"""
import argparse
import sys
from pathlib import Path

from pyshacl import validate
from rdflib import Graph

HIER = Path(__file__).resolve().parent


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("beleid", nargs="+", help="ODRL in Turtle (een of meer bestanden)")
    ap.add_argument("--vocab", action="append", default=[], help="vocabulaire om toe te voegen (herhaalbaar)")
    ap.add_argument("--shapes", default=str(HIER / "odrl22-kern.shacl.ttl"))
    args = ap.parse_args()

    shapes = Graph().parse(args.shapes)
    goed = True
    for bestand in args.beleid:
        data = Graph().parse(bestand)
        for v in args.vocab:
            data.parse(v)
        conform, _, tekst = validate(data, shacl_graph=shapes, meta_shacl=True, advanced=True)
        print(f"{bestand}: {'conform' if conform else 'NIET conform'}")
        if not conform:
            print(tekst)
            goed = False
    return 0 if goed else 1


if __name__ == "__main__":
    sys.exit(main())
