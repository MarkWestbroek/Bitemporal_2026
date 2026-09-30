"""pdp_odre.py — de PDP-kant met een native ODRL-evaluator (pyodre / ODRE).

Zelfde veldrecords (mapper.py), zelfde binding (bundel/regels.json, dus
covers_fields / covers_types), maar de condities worden NIET gecompileerd:
per gebonden regel gaat de oorspronkelijke ODRL-permission uit
beleid/gbo-persoon.odrl.json naar pyodre, dat de constraints evalueert.

Wat pyodre zelf niet kan en wat deze schil daarom doet:
  - binding van veldrecords aan regels (ODRL kent geen query-structuur),
  - assignee-refinement (pyodre leest alleen constraints op de regel),
  - NLGov-leftOperands: pyodre kent alleen odrl:dateTime; via zijn
    prefix-mapping + functies in de interpreter-namespace voegen we
    nlgov:aanvraag:*, nlgov:bestaat:toestemming toe (leest de context van het
    record dat wordt beoordeeld), plus xsd:boolean-casting.

Gebruik: python scripts/pdp_odre.py
"""
import glob
import json
import os
import time

import pyodre.python_interpreter as pi
from pyodre.odre import ODRE

from gbo_model import MAP
from mapper import map_request

NLGOV = "https://standaarden.overheid.nl/odrl/terms/"
CTX = {}  # per evaluatie: subject, field, pip, regel


# ── NLGov-leftOperands in pyodre's interpreter-namespace ──────────────────────
class Ontbreekt:
    """Een ontbrekend of schema-default argument vergelijkt altijd onwaar (deny)."""
    def __eq__(self, o): return False
    def __ne__(self, o): return False
    def __lt__(self, o): return False
    def __le__(self, o): return False
    def __gt__(self, o): return False
    def __ge__(self, o): return False


class Elk(list):
    """Lijstargument met 'elk'-kwantor: de vergelijking moet voor elk element gelden."""
    def __eq__(self, o): return all(x == o for x in self)
    def __ne__(self, o): return all(x != o for x in self)
    def __lt__(self, o): return all(x < o for x in self)
    def __le__(self, o): return all(x <= o for x in self)
    def __gt__(self, o): return all(x > o for x in self)
    def __ge__(self, o): return all(x >= o for x in self)


def _arg(naam):
    a = (CTX["field"].get("args") or {}).get(naam)
    if not a or a["origin"] == "schema-default":
        return Ontbreekt()
    return a["value"]


def nlgov_aanvraag_jaar():
    v = _arg("jaren")
    return v if isinstance(v, Ontbreekt) else Elk(v)


def nlgov_bestaat_toestemming():
    bsn = _arg(CTX["betrokkeneArg"])
    if isinstance(bsn, Ontbreekt):
        return False
    return bsn in CTX["pip"]["toestemming"].get(CTX["subject"]["id"], [])


def cast_boolean(n):
    return str(n).lower() == "true"


pi.nlgov_aanvraag_jaar = nlgov_aanvraag_jaar
pi.nlgov_bestaat_toestemming = nlgov_bestaat_toestemming
pi.cast_boolean = cast_boolean

odre = ODRE()
_it = odre._ODRE__interpreter
_it.add_prefix_mapping("nlgov_aanvraag_", NLGOV + "aanvraag:")
_it.add_prefix_mapping("nlgov_bestaat_", NLGOV + "bestaat:")
_it.add_prefix_mapping("nlgov_", NLGOV)


def refinement_ok(perm, subject, pip):
    for r in perm.get("assignee", {}).get("refinement", []) or []:
        lo = r["leftOperand"]["@id"]
        if lo == "nlgov:rol" and subject["properties"].get("role") != r["rightOperand"]:
            return False
        if lo == "nlgov:autorisatie" and subject["id"] not in pip["autorisaties"].get(r["rightOperand"], []):
            return False
    return True


def mini_policy(odrl, perm):
    """Eén permission als losstaand ODRL-document voor pyodre (zonder assignee)."""
    p = {k: v for k, v in perm.items() if k in ("target", "action", "constraint")}
    return json.dumps({"@context": odrl["@context"], "@type": "Set", "uid": "urn:eval", "permission": [p]})


def evalueer_regel(odrl, perm):
    if not perm.get("constraint"):
        return True
    uit = odre.enforce(mini_policy(odrl, perm))
    return NLGOV + "view" in uit


def beslis(odrl, regels, perms, req, pip, padtabel):
    gql = req["resource"]["properties"]["graphql"]
    subject = req["subject"]
    CTX.update(subject=subject, pip=pip)
    field_keys = {k for r in regels.values() for k in r["covers_fields"]}
    root_types = {"Query", "Mutation", "Subscription"}
    denied = []
    for f in gql["fields"]:
        if f["field"] == "__typename" or f["parentType"].startswith("__"):
            continue
        key = f"{f['parentType']}.{f['field']}"
        gebonden = [rid for rid, r in regels.items() if key in r["covers_fields"]]
        if not gebonden and f["leaf"] and not f.get("args") and key not in field_keys and f["parentType"] not in root_types:
            gebonden = [rid for rid, r in regels.items() if f["parentType"] in r["covers_types"]]
        ok = False
        for rid in gebonden:
            perm = perms[rid]
            if not refinement_ok(perm, subject, pip):
                continue
            ent = regels[rid]["registerpad"].split(".")[0]
            CTX.update(field=f, betrokkeneArg=padtabel[ent]["betrokkeneArg"])
            if evalueer_regel(odrl, perm):
                ok = True
                break
        if not ok:
            denied.append(".".join(f["path"]))
    return {"decision": gql["unverifiable"] is None and not denied and len(gql["fields"]) > 0, "denied_fields": denied}


def main():
    sdl = open(os.path.join(MAP, "bundel", "schema.graphql"), encoding="utf-8").read()
    odrl = json.load(open(os.path.join(MAP, "beleid", "gbo-persoon.odrl.json"), encoding="utf-8"))
    regels = json.load(open(os.path.join(MAP, "bundel", "regels.json"), encoding="utf-8"))
    padtabel = json.load(open(os.path.join(MAP, "bundel", "padtabel.json"), encoding="utf-8"))
    pip = json.load(open(os.path.join(MAP, "bundel", "pj", "data.json"), encoding="utf-8"))
    from compiler import slug
    perms = {slug(p["nlgov:regelnaam"]): p for p in odrl["permission"]}
    resultaten = []
    for qpad in sorted(glob.glob(os.path.join(MAP, "queries", "*.json"))):
        naam = os.path.basename(qpad)[:-5]
        q = json.load(open(qpad, encoding="utf-8"))
        req = map_request(sdl, q["body"], q["subject"], q.get("context"))
        beslis(odrl, regels, perms, req, pip, padtabel)  # opwarmen (context-cache van pyodre)
        t = time.perf_counter()
        n = 5
        for _ in range(n):
            r = beslis(odrl, regels, perms, req, pip, padtabel)
        ms = (time.perf_counter() - t) / n * 1000
        resultaten.append({"query": naam, "odre": r["decision"], "denied": r["denied_fields"], "ms": round(ms, 1)})
        print(f"{naam:24s} records={len(req['resource']['properties']['graphql']['fields']):2d}  odre={str(r['decision']):5s} {ms:6.1f} ms  {r['denied_fields']}")
    with open(os.path.join(MAP, "bundel", "requests", "_resultaten_odre.json"), "w", encoding="utf-8") as f:
        json.dump(resultaten, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
