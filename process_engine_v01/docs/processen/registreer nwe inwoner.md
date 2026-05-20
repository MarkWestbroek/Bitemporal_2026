# Proces: Registreer nieuwe inwoner

## Functionele omschrijving (origineel)

- check of locatie L bestaat: indien niet: ga naar ander proces, namelijk registreer locatie, dit proces wacht op de positieve uitkomst daarvan
- kijk of persoon niet al in de gemeente geregistreerd is of is geweest (bestaat als ENT)
- indien dat zo is: kijk of deze actueel geregistreerd is: zo ja: fout, want dan is ie al inwoner
- bestaat maar in het verleden: registreer nieuwe bereikbaarheid = feit dat de persoon nu in de gemeente op locatie L woont. Begindatum is vandaag. Einddatum is er niet. Type = woonadres.
- bestaat niet: registreer nieuwe inwoner + bereikbaarheid naar Locatie L zoals hierboven.

## Implementatie: `registreer_inwoner_v2.bpmn`

Bestand: `deployments/poc/registreer_inwoner_v2.bpmn` (BPMN 2.0, Operaton 2.1.0)

### Startformulier-variabelen

| Variabele | Type | Omschrijving |
|-----------|------|--------------|
| `register_id` | String | ID van het register (bijv. `hoofdregister`) |
| `locatie_id` | Integer | ID van de locatie in bitemp v06 |
| `np_id` | Integer | Gewenst ID van de NatuurlijkPersoon in bitemp v06 |
| `bsn` | String | BSN van de persoon (11-proef verplicht) |
| `voorletters` | String | Voorletters |
| `roepnaam` | String | Roepnaam |
| `tussenvoegsel` | String | Tussenvoegsel (optioneel) |
| `achternaam` | String | Achternaam |
| `geboortedatum` | String | Geboortedatum (YYYY-MM-DD) |
| `einde_datum` | String | Standaard einddatum NatuurlijkPersoon (bijv. 2099-12-31) |
| `ingezetene` | Boolean | Is de persoon een ingezetene? |
| `opmerking` | String | Vrije opmerking bij de registratie |

### Procesflow

```
[Start] → [check-locatie] → <locatie bestaat?>
                                  ↓ ja (default)       ↓ nee
                             [merge]       [CallActivity: registreer_locatie ⚠️]
                                ↓
                          [check-np] → <NP-status?>
         ┌─────────────────────┴──────────────────┬──────────────────────┐
         ↓ niet gevonden (default)    bestaat & actueel    bestaat & historisch
[registreer-np-bereikbaarheid]   [Error: AL_INWONER]  [registreer-bereikbaarheid]
         ↓                                                       ↓
     [COMPLETED]                                            [COMPLETED]
```

⚠️ **Let op**: de `registreer_locatie` CallActivity is nog **niet** gedeployed. De branch `locatie_bestaat=false` zal falen met `NullValueException` totdat dit sub-proces beschikbaar is.

### Worker-topics en hun rol

| Topic | Go-handler | Zet variabelen | Actie |
|-------|-----------|----------------|-------|
| `check-locatie` | `handleCheckEntiteit` | `locatie_bestaat`, `locatie_actueel` | GET `/full/locaties/{locatie_id}` |
| `check-np` | `handleCheckEntiteit` | `np_bestaat`, `np_actueel` | GET `/full/natuurlijk_personen/{np_id}` |
| `registreer-np-bereikbaarheid` | `handleRegistreer` → `bouwNPBereikbaarheidPayload` | `registratie_id`, `bitemp_status` | POST `/registratie/` — NP + BSN + Naam + Aanvang + Einde + Bereikbaarheid |
| `registreer-bereikbaarheid` | `handleRegistreer` → `bouwBereikbaarheidPayload` | `registratie_id`, `bitemp_status` | POST `/registratie/` — alleen Bereikbaarheid |
| `register-call` | `handleRegistreer` → `bouwInwonerPayload` | `registratie_id`, `bitemp_status` | POST `/registratie/` — alleen NP (v1-compat) |

### Gatewaylogica

**Gateway `locatie_bestaat`** (na `check-locatie`):
- Default (geen condition): `locatie_bestaat=true` → `Gateway_MergeLocatie` → door naar check-np
- Condition `${!locatie_bestaat}`: → `CallActivity_RegistreerLocatie` (⚠️ nog niet gedeployed)

**Gateway `np_status`** (na `check-np`):
- Default: `np_bestaat=false` → `registreer-np-bereikbaarheid`
- `${np_bestaat && np_actueel}`: → `EndEvent_AlInwoner` (BPMN Error `AL_INWONER`)
- `${np_bestaat && !np_actueel}`: → `registreer-bereikbaarheid`

### Operaton-provenance

Elke registratie aangemaakt via dit proces bevat:
```json
"bron": "operaton",
"bron_kenmerk": "<process-instance-id>"
```

### Smoke-test resultaten (2026-05-21)

Testcase: locatie_id=1 (bestaat), np_id=4300 (nieuw), BSN=430050100

| Stap | Resultaat |
|------|-----------|
| `check-locatie` (locaties/1) | `bestaat=true`, `actueel=true` |
| `check-np` (natuurlijk_personen/4300) | `bestaat=false` |
| `registreer-np-bereikbaarheid` | registratie_id=888, HTTP 201 |
| `bron`/`bron_kenmerk` in registratie | `operaton` / process-instance-id |
| Process state (Operaton) | `COMPLETED` |

Registratie 888 bevat 7 wijzigingen: NatuurlijkPersoon, Persoonsidentificatie (BSN 430050100, ingezetene=true), Naam (P.J. Pieter de Jong), NP_Aanvang (1990-06-15), NP_Einde (2099-12-31), Bereikbaarheid (soort=Woonadres, locatie_id=1), Bereikbaarheid_Aanvang (2026-05-21).

### BSN-validatie (11-proef)

BSN-formule: `9*d1 + 8*d2 + 7*d3 + 6*d4 + 5*d5 + 4*d6 + 3*d7 + 2*d8 - d9 ≡ 0 (mod 11)`

Testdata BSN `430050100`: 9×4 + 8×3 + 5×5 + 3×1 = 36+24+25+3 = 88 = 8×11 ✓

De bitemp v06 API valideert BSN bij opvoer via `B27` validatielaag (checksum-regel). Gebruik altijd een geldig BSN in testdata.
