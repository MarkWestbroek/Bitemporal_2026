# Replays voor het CG Portfolio — volgorde en vindplaats

Er zijn **twee** mappen met replays, en dat is verwarrend:

| Map | Wat |
|---|---|
| `docs/CG PF/Replay files/` (deze map) | de **bron**-replays van de portfolio-intake: referentielijsten, de intake zelf, correcties en extra data (1 t/m 7) |
| `bitemp_register_v06/replay files/` | de **platform**-replays: definities (weergave, formulier, query) en de kleine correcties/aanvullingen daarop |

Een verse instantie (desktop, NAS, VPS) wordt in deze volgorde gevuld. Elke stap staat los,
maar de volgorde doet ertoe: latere replays verwijzen naar id's uit eerdere.

| # | Bestand | Map | Vereist |
|---|---|---|---|
| 1 | `1. Gemeenten CBS 2026.replay.json` | bron | — |
| 2 | `2. Domeinen vast 2026.replay.json` | bron | — |
| 3 | `3. API standaarden rationalisatie 2026.replay.json` | bron | — |
| 4 | `4. Intake Portfolio Common Ground 2.replay (zonder gemeenten) CLEANED.json` | bron | 1–3 (85 initiatieven, id 37–128) |
| 5 | `5. PO email naar Persoon.Contactgegevens 2026.replay - zonder piet en test.json` | bron | 4 |
| 6 | `6. Persooncorrecties David en cleanup 2026.replay.json` | bron | 4 |
| 7 | `7. Extra data CG Portfolio.replay.json` | bron | 4 (beoordelingen) |
| 8 | `registraties-replay-init-weergave-en-formulierdefinities-nas-2026-09-22.json` | platform | — (WeergaveDefinities 1–4, FormulierDefinitie 1) |
| 9 | `registraties-replay-correctie-initiatief-detailtemplate-2026-09-22.json` | platform | 8 (template v0.2 met `{{#if}}`) |
| 10 | `registraties-replay-init-aanmeldstatus-geaccepteerd-cgpf-2026.json` | platform | 4, **en een backend met `Initiatief.Aanmeldstatus`** (CG-model 24-09-2026) |
| 11 | `registraties-replay-init-querydefinitie-publieke-initiatieven.json` | platform | backend met `QueryDefinitie` in losse GE's (23-09-2026) |
| 12 | `registraties-replay-correctie-initiatief-tabelconfig-query-2026-09-24.json` | platform | 8, 11, en een frontend van na 24-09-2026 |
| 13 | `registraties-replay-init-intake-aanvulling-2026-09-23.json` | platform | 4, 10 en een backend met `Aanmeldstatus`: de aanmeldingen 130–143 uit de Forms-export van 23-09-2026 (`Extra-data/2026-09-23 Aanmelden portfolio.xlsx`), 9 nieuwe organisaties (id 124–132) en 7 nieuwe personen (67–73), de rest hergebruikt; 143 (testaanmelding) op `in_behandeling`, de rest `geaccepteerd`. Gemaakt met `scripts/maak_cgpf_aanvulling_replay.py` |
| 14 | `registraties-replay-init-apistandaarden-aanvulling-2026-09-24.json` | platform | 3: referentielijst ApiStandaard + 49 GraphQL, 50 Besluiten API |
| 15 | `registraties-replay-correctie-apistandaarden-koppeling-2026-09-24.json` | platform | 4, 13, 14: tien initiatieven (38, 51, 52, 74, 79, 116, 127, 132, 140, 143) krijgen `InitiatiefAPIStandaard`-relaties voor standaarden die in de vrije tekst stonden (typo ZWG, OAS3, Objecttypes, kale 'Zaken; Documenten; …', ZGW-URL, GraphQL, 'Haal centraal' → BRP Personen); volledig gemapte restteksten afgevoerd, deels gemapte gecorrigeerd. Vereist een backend van na 24-09-2026 (GraphQL zonder peiltijdstip = actueel) |
| 16 | `registraties-replay-init-formulierdefinitie-aanmelding-initiatief-2026-09-24.json` | platform | frontend van na 24-09-2026 (nieuw-modus): FormulierDefinitie **2** "Aanmelding initiatief" (30 vragen van het MS Forms-aanmeldformulier als layout met `vasteWaarde`, `kopieerNaar`, vaste rijen en meerkeuze). Onafhankelijk van 1–15; kies het formulier op `/t/initiatieven/nieuw`. Vereist dat FormulierDefinitie-id 2 vrij is (anders het id in het bestand aanpassen) |

Stap 10 vóór 12: zonder aanmeldstatus is de publieke lijst leeg. Stap 13 na 10 (hergebruikt id's uit 4 en zet zelf de aanmeldstatus); 15 na 13 en 14. Stap 10 tegen een backend
zónder het GE `Aanmeldstatus` geeft een fout (`unsupported representatie key 'aanmeldstatus'`)
— eerst de nieuwe backend starten, dan afspelen.

## Vóór het afspelen

- **Instanties die de eerste QueryDefinitie-versie (23-09, met `Meta`-GE) hebben gedraaid**
  (de desktop): eerst `scripts/sql/2026-09-23-querydefinitie-losse-ges-opruimen.sql`, dan de
  nieuwe backend starten. `CreateTables` voegt geen kolommen toe aan bestaande tabellen.
- De backend maakt nieuwe tabellen bij de eerste start zelf aan; verder geen migratie.

## Afspelen

Via de replay-pagina van de frontend (`RegistratieReplayPage`) of per bestand met een lus over
`entries[].request_body` naar `POST /registratie/` (met `AUTH_ENABLED=true` als editor, cookie
van `/api/auth/login`). Bestand 5 heeft een UTF-8 BOM; lees het met `utf-8-sig`.

## Controle na afloop

```sh
# 85 geaccepteerde initiatieven via het opgeslagen document (98 na stap 13)
curl -s -X POST http://localhost:8082/graphql/query -H 'Content-Type: application/json' \
  -d '{"documentId":"publieke-initiatieven"}'
# één initiatief, met contactpersoon
curl -s -X POST http://localhost:8082/graphql/query -H 'Content-Type: application/json' \
  -d '{"documentId":"publiek-initiatief-detail","variables":{"id":39}}'
```

In het opstartlog van de API: `GraphQL uitvoeren op naam (documentId) aan; 2 actuele
QueryDefinitie(s)`, beide `geldig`. Deze volgorde is op 24-09-2026 op een lege database
doorlopen: alle 155 registraties 201, lijst 85 rijen, detail met contactpersoon.

Meer: `docs/VPS_DEPLOYMENT.md` §9, `docs/PUBLICATIE_TEMPLATES.md`,
`docs/dynamische-graphql-laag.md` § Uitvoeren op naam, en `replay-mapping.md` in deze map voor
hoe 4 t/m 7 uit de intake zijn afgeleid.
