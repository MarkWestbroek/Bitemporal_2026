"""pdp_opa.py — de PDP-kant met OPA (Docker-image openpolicyagent/opa).

Voor elke query in queries/*.json:
  1. mapper.py maakt het AuthZEN-request (veldrecords),
  2. OPA evalueert data.ftv.graphql.response in twee bundels:
       pj    = PJ's vaste Rego + gegenereerde rules/*.rego   (roundtrip ODRL -> Rego)
       data  = data-gedreven Rego + data.json (regels als data, met index)
  3. beide beslissingen worden vergeleken.
Met --bench draait `opa bench` per bundel op één query.

Gebruik: python scripts/pdp_opa.py [--bench]
"""
import glob
import json
import os
import subprocess
import sys
import time

from gbo_model import MAP
from mapper import map_request

OPA_IMAGE = "openpolicyagent/opa:latest"


def opa(args, cwd):
    win = os.path.normpath(cwd)
    cmd = ["docker", "run", "--rm", "-v", f"{win}:/w", "-w", "/w", OPA_IMAGE] + args
    env = dict(os.environ, MSYS_NO_PATHCONV="1")
    p = subprocess.run(cmd, capture_output=True, text=True, env=env, encoding="utf-8")
    if p.returncode != 0:
        raise RuntimeError(p.stderr or p.stdout)
    return p.stdout


BUNDELS = {
    "pj": ["-d", "bundel/pj/ftv/graphql.rego", "-d", "bundel/pj/rules", "-d", "bundel/pj/data.json"],
    "data": ["-d", "bundel/data/ftv/graphql.rego", "-d", "bundel/data/nlgov/cond.rego", "-d", "bundel/data/data.json"],
}


def evalueer(bundel, request_pad):
    uit = opa(["eval", "-i", request_pad, "--format", "json", "data.ftv.graphql.response"] + BUNDELS[bundel], MAP)
    return json.loads(uit)["result"][0]["expressions"][0]["value"]


def bench(bundel, request_pad):
    uit = opa(["bench", "-i", request_pad, "--benchmem=false", "--format", "json", "data.ftv.graphql.decision"] + BUNDELS[bundel], MAP)
    j = json.loads(uit)
    return j["T"] / j["N"]  # ns per evaluatie (Go-benchmark: totale tijd / iteraties)


def main():
    sdl = open(os.path.join(MAP, "bundel", "schema.graphql"), encoding="utf-8").read()
    os.makedirs(os.path.join(MAP, "bundel", "requests"), exist_ok=True)
    resultaten = []
    for qpad in sorted(glob.glob(os.path.join(MAP, "queries", "*.json"))):
        naam = os.path.basename(qpad)[:-5]
        q = json.load(open(qpad, encoding="utf-8"))
        req = map_request(sdl, q["body"], q["subject"], q.get("context"))
        rpad = f"bundel/requests/{naam}.authzen.json"  # posix: pad ín de container
        with open(os.path.join(MAP, rpad), "w", encoding="utf-8") as f:
            json.dump(req, f, ensure_ascii=False, indent=2)
        rij = {"query": naam, "records": len(req["resource"]["properties"]["graphql"]["fields"])}
        for b in BUNDELS:
            r = evalueer(b, rpad)
            rij[b] = r["decision"]
            if not r["decision"]:
                rij[f"{b}_denied"] = r["context"]["graphql"]["denied_fields"]
        rij["gelijk"] = rij["pj"] == rij["data"]
        resultaten.append(rij)
        print(f"{naam:24s} records={rij['records']:2d}  pj={str(rij['pj']):5s} data={str(rij['data']):5s} "
              f"{'OK' if rij['gelijk'] else 'VERSCHIL'}  {rij.get('data_denied', '')}")
    if "--bench" in sys.argv:
        for b in BUNDELS:
            ns = bench(b, "bundel/requests/inkomens-2024.authzen.json")
            print(f"opa bench {b:5s} inkomens-2024: {ns/1000:.0f} µs per evaluatie")
    with open(os.path.join(MAP, "bundel", "requests", "_resultaten_opa.json"), "w", encoding="utf-8") as f:
        json.dump(resultaten, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
