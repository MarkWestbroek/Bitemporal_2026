"""gbo_model.py — het canoniek model (V3) + api-profiel als bron voor alles.

Levert:
  - het GraphQL-SDL (GBO-projectie van het model),
  - de padtabel: registerpad (ENT.GE.veld) -> GBO-veldsleutels (ParentType.field),
  - resolutie van een naïef pad uit Toegangsspraak ("Persoon.naam") naar het
    registerpad ("Persoon.Naam"), zoals metamodel.js dat in de editor doet.

Gebruik als module (compiler.py, mapper.py, pdp_odre.py) of los:
  python scripts/gbo_model.py   -> schrijft bundel/schema.graphql en bundel/padtabel.json
"""
import json
import os

HIER = os.path.dirname(os.path.abspath(__file__))
MAP = os.path.normpath(os.path.join(HIER, ".."))
MODEL_PAD = os.path.join(MAP, "model", "gbo-persoon — v3-model.json")
PROFIEL_PAD = os.path.join(MAP, "model", "api-profiel.json")

SCALARS = {"string": "String", "integer": "Int", "number": "Float", "boolean": "Boolean"}
ROOT_TYPES = {"Query", "Mutation", "Subscription"}


def lees(pad):
    with open(pad, encoding="utf-8") as f:
        return json.load(f)


class GboModel:
    def __init__(self, model=None, profiel=None):
        self.model = model or lees(MODEL_PAD)
        self.profiel = profiel or lees(PROFIEL_PAD)
        self.entiteiten = {e["typenaam"]: e for e in self.model["entiteiten"]}

    # ── naamgeving (de GBO-projectie van het model) ──────────────────────────
    def ge_type(self, ent, ge):
        if self.profiel.get("typenaamStijl") == "dynql":
            return f"{ent['typenaam']}_{ge['naam']}"
        return ge["naam"]

    @staticmethod
    def ge_veld(ge):
        rt = ge.get("runtime", {})
        if ge.get("momentvoorkomen") == "meervoudig":
            return rt.get("padnaam") or ge.get("meervoud") or ge["naam"].lower()
        return rt.get("veldnaam") or ge["naam"].lower()

    def root_veld(self, ent):
        for r in self.profiel["root"]:
            if r["entiteit"] == ent["typenaam"]:
                return r
        return None

    # ── SDL ─────────────────────────────────────────────────────────────────
    def sdl(self):
        regels = ["type Query {"]
        for r in self.profiel["root"]:
            args = ", ".join(f"{k}: {v}" for k, v in r.get("args", {}).items())
            regels.append(f"  {r['veld']}({args}): {r['entiteit']}" if args else f"  {r['veld']}: {r['entiteit']}")
        regels.append("}")
        for ent in self.model["entiteiten"]:
            regels += ["", f"type {ent['typenaam']} {{"]
            for ge in ent.get("gegevenselementen", []):
                t = self.ge_type(ent, ge)
                argdef = self.profiel.get("argumenten", {}).get(f"{ent['typenaam']}.{ge['naam']}", {})
                args = ", ".join(f"{k}: {v}" for k, v in argdef.items())
                rt = f"[{t}!]" if ge.get("momentvoorkomen") == "meervoudig" else t
                regels.append(f"  {self.ge_veld(ge)}({args}): {rt}" if args else f"  {self.ge_veld(ge)}: {rt}")
            regels.append("}")
            for ge in ent.get("gegevenselementen", []):
                regels += ["", f"type {self.ge_type(ent, ge)} {{"]
                for v in ge.get("velden", []):
                    s = SCALARS.get(v.get("type"), "String") + ("!" if v.get("verplicht") else "")
                    regels.append(f"  {v['naam']}: {s}")
                regels.append("}")
        return "\n".join(regels) + "\n"

    # ── padtabel: registerpad -> sleutels ───────────────────────────────────
    def padtabel(self):
        tabel = {}
        for ent in self.model["entiteiten"]:
            r = self.root_veld(ent)
            tabel[ent["typenaam"]] = {
                "soort": "entiteit",
                "root": f"Query.{r['veld']}" if r else None,
                "betrokkeneArg": r.get("betrokkene") if r else None,
            }
            for ge in ent.get("gegevenselementen", []):
                gepad = f"{ent['typenaam']}.{ge['naam']}"
                t = self.ge_type(ent, ge)
                tabel[gepad] = {
                    "soort": "gegevenselement",
                    "edge": f"{ent['typenaam']}.{self.ge_veld(ge)}",
                    "type": t,
                    "leaves": [f"{t}.{v['naam']}" for v in ge.get("velden", [])],
                    "args": list(self.profiel.get("argumenten", {}).get(gepad, {}).keys()),
                }
                for v in ge.get("velden", []):
                    tabel[f"{gepad}.{v['naam']}"] = {"soort": "veld", "leaf": f"{t}.{v['naam']}", "parent": gepad}
        return tabel

    # ── resolutie van naïeve paden ───────────────────────────────────────────
    def resolveer(self, pad):
        """'Persoon.naam' / 'Persoon.inkomens' / 'Persoon.Adres.plaats' -> registerpad."""
        delen = pad.split(".")
        ent = next((e for e in self.model["entiteiten"] if e["typenaam"].lower() == delen[0].lower()), None)
        if not ent:
            raise KeyError(f"onbekende entiteit in pad {pad!r}")
        uit = [ent["typenaam"]]
        if len(delen) == 1:
            return uit[0]
        ge = next((g for g in ent.get("gegevenselementen", [])
                   if delen[1].lower() in {g["naam"].lower(), self.ge_veld(g).lower(),
                                            (g.get("meervoud") or "").lower(),
                                            (g.get("runtime", {}).get("veldnaam") or "").lower()}), None)
        if not ge:
            raise KeyError(f"onbekend gegevenselement {delen[1]!r} in {pad!r}")
        uit.append(ge["naam"])
        if len(delen) > 2:
            veld = next((v for v in ge.get("velden", []) if v["naam"].lower() == delen[2].lower()), None)
            if not veld:
                raise KeyError(f"onbekend veld {delen[2]!r} in {pad!r}")
            uit.append(veld["naam"])
        return ".".join(uit)


if __name__ == "__main__":
    m = GboModel()
    os.makedirs(os.path.join(MAP, "bundel"), exist_ok=True)
    with open(os.path.join(MAP, "bundel", "schema.graphql"), "w", encoding="utf-8") as f:
        f.write(m.sdl())
    with open(os.path.join(MAP, "bundel", "padtabel.json"), "w", encoding="utf-8") as f:
        json.dump(m.padtabel(), f, ensure_ascii=False, indent=2)
    print(m.sdl())
    print(json.dumps(m.padtabel(), ensure_ascii=False, indent=1))
