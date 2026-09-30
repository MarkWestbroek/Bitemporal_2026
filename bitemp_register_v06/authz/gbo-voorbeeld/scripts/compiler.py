"""compiler.py — ODRL (NLGov) + canoniek model -> policybundel voor de PDP.

Invoer : beleid/gbo-persoon.odrl.json (uit Toegangsspraak), model + api-profiel.
Uitvoer:
  bundel/data/data.json      regels als data (GBO-referentiemodel §8.6) + index
                             by_field / by_type, plus PIP-data (toestemming,
                             autorisaties) — draait met bundel/data/ftv/graphql.rego
  bundel/pj/rules/*.rego     dezelfde regels als Rego-modules in PJ's stijl
                             (slides 15–16) — draait met bundel/pj/ftv/graphql.rego
  bundel/pj/data.json        alleen de PIP-data
  bundel/regels.json         de tussenvorm (registerpad, covers, condities) voor
                             pdp_odre.py, dat de ODRL-constraints zelf evalueert

Afbeeldingsregels (profielkeuze van de compiler, geen ODRL-beperking):
  target entiteit            -> covers_fields [root-veld]        (root erft nooit)
  target GE, zonder arg-cond -> covers_fields [edge] + covers_types [GE-type]
  target GE, mét arg-cond    -> covers_fields [edge]             (args zitten op de edge)
  target "alle gegevens van GE" (AssetCollection/alle) -> covers_types [GE-type]
  target veld                -> covers_fields [leaf]
"""
import json
import os
import re

from gbo_model import MAP, GboModel

ODRL_PAD = os.path.join(MAP, "beleid", "gbo-persoon.odrl.json")
PIP_DATA = {
    "toestemming": {"00000001000000000001": ["999990019"], "00000002000000000002": ["999990019"]},
    "autorisaties": {"naam-en-adres": ["00000001000000000001"]},
}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def operand_id(x):
    return x["@id"] if isinstance(x, dict) else x


def compileer(odrl, model: GboModel):
    tabel = model.padtabel()
    profiel = model.profiel
    regels = {}
    for perm in odrl.get("permission", []):
        naam = perm.get("nlgov:regelnaam") or perm["target"]["uid"]
        rid = slug(naam)
        target = perm["target"]
        # Een begrip "X zijn: alle gegevens van <GE>" is een AssetCollection met
        # `source` = het gegevenselement; dat betekent: de velden ervan.
        alle = target.get("@type") == "AssetCollection"
        uid = target["source"] if alle else target["uid"]
        pad = model.resolveer(uid.split("nlgov:register:", 1)[1])
        info = tabel[pad]

        condities = []
        # assignee-refinement -> subjectcondities
        for r in perm.get("assignee", {}).get("refinement", []) or []:
            condities.append({"leftOperand": operand_id(r["leftOperand"]), "operator": r["operator"],
                              "rightOperand": r["rightOperand"]})
        # constraints -> veld-/PIP-condities
        heeft_arg = False
        for c in perm.get("constraint", []) or []:
            lo = operand_id(c["leftOperand"])
            cc = {"leftOperand": lo, "operator": c["operator"], "rightOperand": c.get("rightOperand")}
            if lo.startswith("nlgov:bestaat:"):
                cc["voor"] = operand_id(c.get("nlgov:voor", "nlgov:betrokkene"))
                ent = pad.split(".")[0]
                cc["arg"] = tabel[ent]["betrokkeneArg"]
                heeft_arg = True
            elif lo.startswith("nlgov:aanvraag:"):
                alias = profiel.get("aliassen", {}).get(lo.split("nlgov:", 1)[1], {})
                cc["arg"] = alias.get("arg", lo.rsplit(":", 1)[1])
                if alias.get("kwantor"):
                    cc["kwantor"] = alias["kwantor"]
                heeft_arg = True
            condities.append(cc)

        covers_fields, covers_types = [], []
        if info["soort"] == "entiteit":
            covers_fields = [info["root"]]
        elif info["soort"] == "gegevenselement":
            if alle:
                covers_types = [info["type"]]
            elif heeft_arg:
                covers_fields = [info["edge"]]
            else:
                covers_fields = [info["edge"]]
                covers_types = [info["type"]]
        else:
            covers_fields = [info["leaf"]]
        regels[rid] = {"regelnaam": naam, "registerpad": pad, "alle": alle,
                       "covers_fields": covers_fields, "covers_types": covers_types, "conditions": condities}
    return regels


# ── uitvoer A: data-gedreven bundel ──────────────────────────────────────────
def schrijf_data_bundel(regels):
    by_field, by_type = {}, {}
    rules = {}
    for rid, r in regels.items():
        rules[rid] = {"regelnaam": r["regelnaam"], "covers_fields": r["covers_fields"],
                      "covers_types": r["covers_types"], "conditions": r["conditions"]}
        for k in r["covers_fields"]:
            by_field.setdefault(k, []).append(rid)
        for t in r["covers_types"]:
            by_type.setdefault(t, []).append(rid)
    data = {"rules": rules, "by_field": by_field, "by_type": by_type, **PIP_DATA}
    with open(os.path.join(MAP, "bundel", "data", "data.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ── uitvoer B: PJ-stijl Rego-modules ─────────────────────────────────────────
def conditie_naar_rego(c):
    lo, op, ro = c["leftOperand"], c["operator"], c.get("rightOperand")
    if lo == "nlgov:rol" and op == "eq":
        return [f'subject.properties.role == {json.dumps(ro)}']
    if lo == "nlgov:autorisatie" and op == "eq":
        return [f'subject.id in autorisaties[{json.dumps(ro)}]']
    if lo.startswith("nlgov:bestaat:toestemming"):
        a = c["arg"]
        return [f"{a} := field.args.{a}.value", f'field.args.{a}.origin != "schema-default"',
                f"{a} in data.toestemming[subject.id]"]
    if lo.startswith("nlgov:aanvraag:"):
        a = c["arg"]
        rego_op = {"eq": "==", "neq": "!=", "lt": "<", "lteq": "<=", "gt": ">", "gteq": ">="}[op]
        regels = [f"{a} := field.args.{a}", f'{a}.origin != "schema-default"']
        if c.get("kwantor") == "elk":
            regels.append(f"every w in {a}.value {{ w {rego_op} {json.dumps(ro)} }}")
        else:
            regels.append(f"{a}.value {rego_op} {json.dumps(ro)}")
        return regels
    raise ValueError(f"onbekende conditie {c}")


def schrijf_pj_bundel(regels):
    d = os.path.join(MAP, "bundel", "pj", "rules")
    os.makedirs(d, exist_ok=True)
    for oud in os.listdir(d):
        os.remove(os.path.join(d, oud))
    for rid, r in regels.items():
        regels_rego = [x for c in r["conditions"] for x in conditie_naar_rego(c)]
        imports = ["import rego.v1", "import input.field", "import input.subject"]
        if any("autorisaties[" in x for x in regels_rego):
            imports.append("import data.autorisaties")
        body = [f'# Regel "{r["regelnaam"]}" — gegenereerd uit beleid/gbo-persoon.odrl.json',
                f"# target: nlgov:register:{r['registerpad']}{' (alle gegevens)' if r['alle'] else ''}",
                f'package rules["{rid}"]', ""] + imports + [""]
        if r["covers_fields"]:
            body.append(f"covers_fields := {json.dumps(r['covers_fields'])}".replace("[", "{").replace("]", "}"))
        if r["covers_types"]:
            body.append(f"covers_types := {json.dumps(r['covers_types'])}".replace("[", "{").replace("]", "}"))
        body += ["", "allow if {"] + [f"\t{x}" for x in regels_rego] + ["}", ""]
        with open(os.path.join(d, f"{rid}.rego"), "w", encoding="utf-8") as f:
            f.write("\n".join(body))
    with open(os.path.join(MAP, "bundel", "pj", "data.json"), "w", encoding="utf-8") as f:
        json.dump(PIP_DATA, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    model = GboModel()
    odrl = json.load(open(ODRL_PAD, encoding="utf-8"))
    regels = compileer(odrl, model)
    os.makedirs(os.path.join(MAP, "bundel", "data"), exist_ok=True)
    with open(os.path.join(MAP, "bundel", "regels.json"), "w", encoding="utf-8") as f:
        json.dump(regels, f, ensure_ascii=False, indent=2)
    with open(os.path.join(MAP, "bundel", "schema.graphql"), "w", encoding="utf-8") as f:
        f.write(model.sdl())
    with open(os.path.join(MAP, "bundel", "padtabel.json"), "w", encoding="utf-8") as f:
        json.dump(model.padtabel(), f, ensure_ascii=False, indent=2)
    schrijf_data_bundel(regels)
    schrijf_pj_bundel(regels)
    for rid, r in regels.items():
        print(f"{rid:28s} {r['registerpad']:18s} fields={r['covers_fields']} types={r['covers_types']} cond={len(r['conditions'])}")
