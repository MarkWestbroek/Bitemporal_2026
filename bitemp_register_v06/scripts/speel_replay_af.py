#!/usr/bin/env python3
"""speel_replay_af.py — speel replay-bestanden af op een draaiende instantie, als admin.

Elke entry uit `entries[]` gaat met zijn `request_method` naar `request_path` (meestal
`POST /registratie/`). Per entry: HTTP-status en, bij plaatshouders, de toegekende id's.
Stopt bij de eerste fout (tenzij --doorgaan). Alleen de standaardbibliotheek, dus ook bruikbaar
op de VPS zonder pip.

Inloggen: POST /api/auth/login met ADMIN_USERNAME / ADMIN_PASSWORD uit de omgeving of uit een
.env-bestand (--env-file). Het wachtwoord wordt nooit getoond. Gebruik https: het login-cookie is
`Secure` en gaat over http niet mee (zie docs/VPS_DEPLOYMENT.md).

Voorbeeld (op de VPS):
  python3 /srv/omnium-pf/src/bitemp_register_v06/scripts/speel_replay_af.py \\
      --host https://pf.common-ground-lab.nl --env-file /srv/omnium-pf/.env \\
      "/srv/omnium-pf/src/bitemp_register_v06/replay files/registraties-replay-init-apistandaarden-soap-2026-09-26.json"

--droog toont alleen wat er zou gebeuren.
"""
import argparse
import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.request


def lees_env(pad):
    uit = {}
    with open(pad, encoding="utf-8") as f:
        for regel in f:
            regel = regel.strip()
            if not regel or regel.startswith("#") or "=" not in regel:
                continue
            k, v = regel.split("=", 1)
            uit[k.strip()] = v.strip().strip('"').strip("'")
    return uit


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("bestanden", nargs="+", help="replay-bestand(en), in volgorde")
    ap.add_argument("--host", required=True, help="basis-URL, bv. https://pf.common-ground-lab.nl")
    ap.add_argument("--env-file", help=".env met ADMIN_USERNAME en ADMIN_PASSWORD")
    ap.add_argument("--doorgaan", action="store_true", help="niet stoppen bij een fout")
    ap.add_argument("--droog", action="store_true", help="niets versturen")
    a = ap.parse_args()

    env = dict(os.environ)
    if a.env_file:
        env.update(lees_env(a.env_file))
    host = a.host.rstrip("/")

    replays = []
    for pad in a.bestanden:
        with open(pad, encoding="utf-8") as f:
            d = json.load(f)
        replays.append((pad, d))
        print(f"• {os.path.basename(pad)}: {len(d.get('entries', []))} entry/entries — {d.get('description', '')[:120]}")
    if a.droog:
        return 0

    gebruiker, wachtwoord = env.get("ADMIN_USERNAME"), env.get("ADMIN_PASSWORD")
    if not gebruiker or not wachtwoord:
        print("ADMIN_USERNAME/ADMIN_PASSWORD ontbreken (omgeving of --env-file)", file=sys.stderr)
        return 2
    if not host.startswith("https://") and "localhost" not in host and "127.0.0.1" not in host:
        print("waarschuwing: geen https — het Secure-cookie gaat dan niet mee", file=sys.stderr)

    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def verstuur(methode, pad, body):
        req = urllib.request.Request(host + pad, method=methode, data=json.dumps(body).encode("utf-8"),
                                     headers={"Content-Type": "application/json"})
        try:
            with opener.open(req, timeout=120) as r:
                return r.status, r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", "replace")

    status, _ = verstuur("POST", "/api/auth/login", {"gebruikersnaam": gebruiker, "wachtwoord": wachtwoord})
    if status != 200:
        print(f"inloggen mislukt: HTTP {status}", file=sys.stderr)
        return 1
    print("ingelogd als admin")

    fouten = 0
    for pad, d in replays:
        for i, e in enumerate(d.get("entries", []), 1):
            status, tekst = verstuur(e.get("request_method", "POST"), e["request_path"], e["request_body"])
            verwacht = e.get("expected_response_code") or 201
            extra = ""
            try:
                ids = json.loads(tekst).get("toegekendeIds")
                if ids:
                    extra = f" toegekend: {ids}"
            except (ValueError, AttributeError):
                pass
            ok = status == verwacht
            print(f"  {'✓' if ok else '✗'} {os.path.basename(pad)} #{i} {e.get('description', '')[:70]} → HTTP {status}{extra}")
            if not ok:
                fouten += 1
                print("    " + tekst[:600].replace("\n", " "))
                if not a.doorgaan:
                    return 1
    return 1 if fouten else 0


if __name__ == "__main__":
    sys.exit(main())
