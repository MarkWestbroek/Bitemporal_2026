# REST CRUD per padnaam (Fase 2)

Status: DELETE en PATCH werkend; ETag follow-up.
Datum: 2026-04-29

Deze laag biedt generieke REST CRUD-endpoints **per padnaam** bovenop dezelfde
`RegistreerCore`-engine die ook `POST /registratie/` gebruikt. Eén audit-pad,
één transactiemodel, één foutbehandeling.

## Endpoints

| Methode | Pad                          | Doel                                                              |
|---------|------------------------------|-------------------------------------------------------------------|
| GET     | `/{padnaam}`                 | Lijst (paginering)                                                |
| GET     | `/{padnaam}/:id`             | Eén record                                                        |
| POST    | `/{padnaam}`                 | Insert                                                            |
| **DELETE** | `/{padnaam}/:id`         | Bitemporeel afvoeren (entiteit / niet-PFK GE/REL)                 |
| GET     | `/full/{padnaam}/:id`        | Entiteit met geneste GE's/RELs                                    |
| **PATCH**  | `/full/{padnaam}/:id`     | JSON Merge Patch (RFC 7396) op onderliggende GE's/RELs            |

## DELETE-semantiek

`DELETE /{padnaam}/:id` vertaalt intern naar een `Registratie` met één
`Afvoer`-wijziging en delegeert naar `RegistreerCore`. Audit-trail en
transactiegedrag zijn identiek aan `POST /registratie/`.

PFK-types (GE/REL `_Data` met composite key `(ent_id, rel_id, versie)`)
worden afgewezen met **400** — gebruik daar `POST /registratie/` met een
expliciete `Afvoer`-wijziging.

## PATCH-semantiek (Merge Patch op /full/...)

### Body-format

Hybride wrapper — beide zijn geldig:

```jsonc
// Variant A (mét ENT-wrapper, identiek aan /registratie wijziging-payload):
{ "natuurlijkpersoon": { "namen": { "voornaam": "Jan-Piet" } } }

// Variant B (zonder wrapper, server wrapt zelf):
{ "namen": { "voornaam": "Jan-Piet" } }
```

ENT-velden zelf zijn **niet patchable** — alleen onderliggende GE's, relaties
en de plumbing-GE's `aanvang`/`einde`. Een veld op ENT-niveau dat geen
`JSONRolnaam` is van een onderliggend GE/REL geeft **400**.

`id` in de payload is optioneel; URL-id is leidend. Mismatch → **409**.

### Modus

Querystring `?modus=registratie|correctie` (default `registratie`).

| Modus           | `rel_id` per GE/REL  | Engine-gedrag                                                     |
|-----------------|---------------------|-------------------------------------------------------------------|
| `registratie`   | weglaten (genegeerd → melding) | Engine genereert nieuwe id en sluit voorgaande versie automatisch af. |
| `correctie`     | **verplicht**       | Engine corrigeert exact die versie (afvoer + opvoer).             |

Item met alleen `rel_id` zonder verdere velden in `correctie` = no-op (melding,
geen fout). Lege effectieve patch (na meldingen) → **400**.

### Voorbeelden

```jsonc
// PATCH /full/natuurlijk_personen/123 (default: modus=registratie)
{
  "namen": { "voornaam": "Jan-Piet", "achternaam": "De Vries" },
  "burgerschappen": [{ "land": "NL" }]
}
```

```jsonc
// PATCH /full/natuurlijk_personen/123?modus=correctie
{
  "namen": {
    "rel_id": 7,                  // verplicht in correctie
    "voornaam": "Jan-Piet"        // velden die in nieuwe versie anders zijn
  }
}
```

### Response-format

```jsonc
{
  "message": "Registratie verwerkt",
  "registratie_id": 502,
  "tijdstip": "2026-04-29T13:45:12.345Z",
  "modus": "registratie",
  "meldingen": [
    "rol \"namen\": rel_id in payload genegeerd (modus=registratie genereert nieuwe id)"
  ]
}
```

`meldingen[]` bevat niet-fatale waarschuwingen die de client kan tonen aan
de gebruiker, maar de operatie wel hebben laten slagen.

## HTTP-foutcodes (PATCH + DELETE)

| Code | Naam                       | Wanneer in deze laag                                                                 |
|------|----------------------------|--------------------------------------------------------------------------------------|
| 200  | OK                         | PATCH/DELETE geslaagd; body bevat `registratie_id`, `tijdstip`, `meldingen[]`.       |
| 400  | Bad Request                | Ongeldige JSON; lege effectieve patch; verboden ENT-veld in patch; correctie zonder `rel_id`; onbekende modus; PFK-type in DELETE; meta-config ontbreekt op type. |
| 404  | Not Found                  | URL-id bestaat niet (DB-lookup levert zero-id record).                               |
| 409  | Conflict                   | Id in payload ≠ id in URL; resource al afgevoerd (DELETE).                           |
| 412  | Precondition Failed        | (Toekomstig, optioneel): `If-Match`-header mismatch.                                 |
| 500  | Internal Server Error      | DB-fout, transactiefout, engine-fout.                                                |

Codes die deze laag bewust **niet** gebruikt:

- 201 Created — alleen voor POST.
- 422 Unprocessable Entity — semantische body-fouten geven we als **400**, consistent met de rest van de codebase.
- 428 Precondition Required — niet verplicht maken in deze fase.

## Concurrency (ETag / If-Match) — ontwerp, follow-up

Bewust **niet geïmplementeerd in deze iteratie** om de PR scope-zuiver te
houden. Probleem: in een bitemporeel register is "laatste registratie van
deze entiteit" niet triviaal te bepalen — een wijziging refereert via
opvoer/afvoer naar representaties verspreid over meerdere onderliggende
GE-tabellen.

### Voorgesteld patroon (RFC 7232)

1. `GET /full/{padnaam}/:id` zet header `ETag: "reg-<n>"` waarin `n` de hoogste
   registratie-id is van een wijziging die een representatie van deze entiteit
   raakt (per onderliggende GE/REL: `MAX(registratie_id)` over `wijziging`-rijen
   waar opvoer/afvoer-id gelinkt is aan een representatie met deze `entiteit_id`).
2. Client bewaart de ETag.
3. PATCH stuurt `If-Match: "reg-<n>"`.
4. Server controleert binnen de transactie of de huidige hoogste registratie-id
   nog `n` is. Mismatch → **412 Precondition Failed**, client moet refreshen.
5. `If-Match` afwezig → check overslaan (geen breaking change voor bestaande clients).

### Waarom de DB-transactie alleen niet voldoende is

`BEGIN…COMMIT` in `RegistreerCore` beschermt tegen **interleaving binnen één
request**, maar niet tegen het volgende patroon:

```
T1 GET → versie X gezien
T2 GET → versie X gezien
T1 PATCH → registratie #500
T2 PATCH → registratie #501  ← T2 wist niet dat T1 ondertussen een wijziging publiceerde
```

Bitemporeel is niets verloren (audit-trail laat #500 én #501 zien) maar T2's
gebruiker had vermoedelijk anders besloten met kennis van T1's wijziging.

## Bestanden

- [handlers/crud_handlers.go](../handlers/crud_handlers.go) — `MakeDeleteEntityByMetaHandler`, `MakePatchFullEntityByMetaHandler`
- [handlers/wijziging_builder.go](../handlers/wijziging_builder.go) — pure functie `BouwWijzigingen`
- [handlers/wijziging_builder_test.go](../handlers/wijziging_builder_test.go) — unit tests (12 scenarios)
- [handlers/crud_handlers_test.go](../handlers/crud_handlers_test.go) — DELETE-tests (3 scenarios)
- [handlers/registration_core.go](../handlers/registration_core.go) — gedeelde engine (fase 0)
- [routes/addroutes_helper.go](../routes/addroutes_helper.go) — route-registratie
- [handlers/openapi_generator.go](../handlers/openapi_generator.go) — OpenAPI-paths inclusief PATCH/DELETE
