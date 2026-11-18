# Façade fase 1 — technisch ontwerp (lezen op Open Zaak + Open Object)

> Datum: 18-11-2026 · Sessie: FACADE (Claude) · Status: **ontwerp, groen licht van Mark (18-11)**
> Hoort bij: [2026-11-13 Façade-API op Common Ground-registers (verkenning)](2026-11-13%20Façade-API%20op%20Common%20Ground-registers%20(verkenning).md)
> Model: het zaakmodel van AI-INRICHTEN in de ZGW-vorm (domeinen catalogus, zaken, documenten,
> besluiten). Het staat voorlopig ongecommit in de Fundament-repo.

## 1. Doel van fase 1

Alleen lezen, met dezelfde voorkant als een gegenereerd register:

- GraphQL: `full_<padnaam>`, `<padnaam>`, `full_<padnaam>_list`, plus de geneste en omgekeerde
  relaties;
- persisted queries (`documentId`);
- REST: `GET /full/<padnaam>/:id` en de lijst.

De bronnen zijn Open Zaak (Zaken- en Catalogi-API) en Open Object (Objecten-API). De join loopt
van `ZaakobjectVerwijzing.objectIri` naar het object.

Buiten fase 1:
- schrijven, het capaciteitsprofiel in de OpenAPI en het logboek (fase 2);
- het opvraaglog (fase 3);
- de DbBron (fase 4).

## 2. Wat de code nu doet (main, e97d2473)

- **Het schema.** `dynql.BuildSchema` bouwt het hele schema uit de globale `model.MetaRegistry`.
  Een domein bestaat in de API alleen als gegenereerde code in pakket `model`
  (CODEGEN §12).
- **Geneste GE's** hebben geen eigen resolver: ze lezen uit de map die de full-resolver levert.
- **Elke leesresolver** (full, lijst, full-lijst, omgekeerd, forward) werkt in drie stappen:
  1. een `bun`-query die een gegenereerde struct vult: `meta.Factory()` of `SliceFactory()`, met
     `addOnderliggendeRelations` en `laadHubKinderenNaQuery`;
  2. de struct omzetten naar een map en platslaan (`entityToMap`, `flattenEntityMap`);
  3. verrijken en snoeien: weergavenamen, afgeleide velden, afgeleide relaties, en de PEP
     (toegangsbeleid).
- **Persisted queries** lezen `QueryDefinitie` uit het configuratiedomein in de eigen database.

## 3. De naad: een Lader in plaats van een Bron die maps levert

Alleen **stap 1** gaat achter een interface. Stap 2 en 3 blijven gedeeld, zodat flatten, PEP,
weergavenamen en afgeleide velden voor de façade precies zo werken als in het register.

```go
// dynql/lader.go
type Lader interface {
    // Eén entiteit met alle onderliggende GE's/relaties, als gevulde struct (meta.Factory()).
    // nil, nil = niet gevonden.
    LaadEen(ctx context.Context, meta model.TypeMeta, id any, peil time.Time) (any, error)
    // Een pagina entiteiten (meta.SliceFactory()), met het filter-argument zoals GraphQL het geeft.
    LaadLijst(ctx context.Context, meta model.TypeMeta, v LijstVraag) (any, error)
    // De id's van bron-entiteiten die via relatie rel naar doelID wijzen (omgekeerde relatie).
    BronIDs(ctx context.Context, rev ReverseRelationInfo, doelID any, limit int, peil time.Time) ([]any, error)
}

type LijstVraag struct {
    Filter        any        // ruw filter-argument (<Typenaam>Filter)
    Peil          time.Time
    Limit, Offset int
    Volledig      bool       // full_..._list: met onderliggende elementen
    Sortering     []Sortering // leeg = op id; gevuld door BACKEND (sorteren op GE-veld, 18-11)
}
```

Afspraken met BACKEND (18-11):
- **Peil in `BronIDs`.** De omgekeerde en de forward-resolver lezen nu altijd de actuele stand,
  ook bij een peiltijdstip. Dat is een bestaand gebrek, en de interface legt het niet vast. De
  `dbLader` mag het peil voorlopig negeren.
- **`Sortering` staat er alvast in.** BACKEND bouwt het sorteren op een GE-veld in `LijstVraag`
  en de `dbLader`, ná de verhuizing.
- **Het filter is SQL-gebonden** (EXISTS-subqueries). Een lader krijgt het ruwe filterobject en
  **weigert** met een fout wat hij niet kan, nooit stil.
- **Pakketglobalen** (typeCache, filter-caches, relatie-indexen): twee schema's met
  verschillende opties in één proces zitten elkaar in de weg. Voor een eigen binary is dat geen
  probleem; tests met nep-laders bouwen daarom één schema per testbinary.
- **Fouten.** GraphQL kent geen 501: de fout krijgt
  `extensions.code = "niet_ondersteund_door_register"`. REST geeft wel 501.
- **Geen tabellen voor de zaakdomeinen:** dat gaat via het bestaande mechanisme
  `gebouwde_domeinen`, niet via een nieuwe optie per type.
- **Volgorde:** FACADE verhuist eerst de laadcode naar de `dbLader`; daarna bouwt BACKEND de
  sortering (stap 3 van het indexwerk).
- **Zaakdomeinen:** er is geen besluit dat ze in deze repo komen. De façade genereert ze lokaal,
  commit ze niet, en meldt codegen-fouten aan BACKEND.

- `dbLader` is de huidige code, ongewijzigd verplaatst. `BuildSchema(db)` blijft bestaan en
  gebruikt hem.
- **Nieuw:** `BuildSchemaMet(db, Opties{Laders map[string]Lader})`, met de typenaam als sleutel.
  Een type zonder lader krijgt de `dbLader`. Zo leest de façade de zaaktypen via de API, en
  configuratie (QueryDefinitie) en het logboek gewoon uit zijn eigen database.
- **Ook nodig:** `laadWeergavenamenBatch` en `voegAfgeleideRelatiesToe` lezen de database
  rechtstreeks. Voor een type met een lader gaan ze via `LaadLijst` met een id-filter, of ze
  slaan het type over in fase 1. Dat zie ik bij het bouwen.
- **Geen mutaties voor typen met een lader.** De typed mutations (`wijzig<X>` …) en de generieke
  `registreer` weigeren zo'n type, met een fout met `extensions.code =
  "niet_ondersteund_door_register"` (de voorloper van het capaciteitsprofiel uit fase 2).
- **Extra velden:** `Opties.ExtraVelden map[string]graphql.Fields` voegt per typenaam
  façade-velden toe, zoals `object` op ZaakobjectVerwijzing (§10.3).
- **Omvang in dynql:** één nieuw bestand (`lader.go`), `dbLader` als verhuizing van bestaande
  code, en in vijf resolvers de regel die laadt. Geen wijziging in typen, filter-SQL of PEP.

Waarom geen `Bron` die kant-en-klare maps levert (verkenning §4.1)? Dan moet de façade flatten,
weergavenamen en PEP zelf nadoen, en lopen die twee uit elkaar. Met een gevulde struct blijft er
één pad.

## 4. Pakket `facade/` en `cmd/facade`

```
bitemp_register_v06/
  facade/
    binding/        binding CM ↔ register (§5): laden + valideren tegen de MetaRegistry
    zgw/            client Zaken/Catalogi-API (JWT-ZGW), paginering, batching
    objecten/       client Objecten-API (Token), ?date= / ?registrationDate=
    apilader.go     implementeert dynql.Lader voor alle typen uit de binding
    idmap.go        id ↔ (register, uuid), tabel in de façade-database (§6)
    iri.go          IRI ↔ URL via de prefixtabel (besluit Mark 18-11, vorm c)
  cmd/facade/
    main.go         database (configuratie + idmap; later het logboek), BuildSchemaMet,
                    GraphQL + documentId, GET /full/...
```

**Domeinen in de build:**
- register en ide-bestanden (verplicht, CODEGEN §12);
- configuratie (QueryDefinitie);
- de vier zaakdomeinen.

Gebouwd met `scripts/bouw-domeinen.ps1`, of met een build-tag. De zaakdomeinen krijgen **geen
tabellen** in de façade-database. Dat gaat via `gebouwde_domeinen`, het bestaande mechanisme
(advies BACKEND).

**REST in fase 1:**
- `GET /full/<padnaam>/:id` en `GET /full/<padnaam>` doen intern een GraphQL-aanroep op het
  façade-schema. Dat is één pad, en geen tweede naad in `handlers/`.
- De volledige REST-familie (CRUD per GE, `/registratie`) komt in fase 2 mee met het schrijven.

## 5. Binding (tijdelijk een bestand, later uit de Studio)

Fase 0 (OAS als M1 en kruisverbanden in de Studio) is er nog niet. Fase 1 werkt daarom met een
bindingbestand `facade/binding/zgw.json`, in een vorm die later 1-op-1 uit de kruisverbanden te
genereren is:

```json
{
  "registers": {
    "openzaak":  {"soort": "zgw",      "basis": "${OPENZAAK_URL}",  "auth": "jwt-zgw"},
    "objecten":  {"soort": "objecten", "basis": "${OBJECTEN_URL}",  "auth": "token"}
  },
  "iri": [{"prefix": "${IRI_BASIS}/id/object/", "register": "objecten", "resource": "objects"}],
  "typen": {
    "Zaak": {
      "register": "openzaak", "resource": "zaken/api/v1/zaken",
      "velden": {
        "ZaakIdentificatie.zaakidentificatie": "identificatie",
        "ZaakLooptijd.startdatum": "startdatum"
      },
      "relaties": {
        "ZaakZaaktype": {"veld": "zaaktype"},
        "ZaakRol":      {"omgekeerd": "zaken/api/v1/rollen", "filter": "zaak"},
        "ZaakStatus":   {"omgekeerd": "zaken/api/v1/statussen", "filter": "zaak"}
      },
      "filters": {"ZaakIdentificatie.zaakidentificatie": "identificatie", "ZaakZaaktype": "zaaktype"}
    }
  }
}
```

- Bij het starten valideert de façade het bestand tegen de MetaRegistry. Elk CM-pad moet bestaan;
  een onbekend pad is een startfout.
- `filters` is de pushdown-lijst. Een GraphQL-filter op een veld dat er niet in staat, geeft een
  duidelijke fout (verkenning §4.1). Er wordt niet in geheugen gefilterd.
- De exacte veld- en padnamen liggen pas vast na de rebuild van het zaakmodel (melding van
  AI-INRICHTEN). Tot dan volgt de binding `zaakmodel-v3.json`.

## 6. Identiteit in fase 1

De gegenereerde structs hebben int-id's (uuid voor entiteiten is een aparte backlogbeslissing).
Daarom bevat de façade-database een tabel `facade_id (id bigserial, register, soort, uuid,
UNIQUE(register, soort, uuid))`:

- elke uuid die de façade leest, krijgt bij de eerste keer een vast id;
- `full_zaak(id: 17)` → uuid → `GET /zaken/{uuid}`;
- GE- en relatie-voorkomens (rol, status, …) krijgen ook een id uit deze tabel, met hun eigen uuid
  (eis "id per voorkomen", zaakmodel-voorstel §3).
- Een object uit de Objecten-API heeft het voorkomen (object-uuid, index). Daarvoor gebruikt de
  façade de `index` als relatief id, zonder tabel.

Dit vervalt grotendeels als het platform uuid als entiteit-id krijgt.

## 7. Tijd

| Register | `peiltijdstip` (formeel) | `geldigOp` (materieel) |
|---|---|---|
| Objecten-API | `?registrationDate=` (dagprecisie: de datum van het peiltijdstip) | `?date=` |
| Zaken, Catalogi | nee | nee |

- In fase 1 geeft een tijdreisargument op een register dat het niet kent een fout
  (`niet_ondersteund_door_register`). Het argument uit het schema halen is fase 2
  (capaciteitsprofiel).
- Bij de Catalogi zou `datumGeldigheid` kunnen dienen als `geldigOp` voor zaaktype; dat volgt
  later.

## 8. Prestatie

- **Batching:** per GraphQL-laag één verzoek per register. Omgekeerde relaties (rollen en
  statussen van n zaken) gaan als `?zaak__in=` als de API het kent, anders parallel met een
  plafond.
- **Cache:** een korte cache per verzoek (de context), nog geen notificatie-invalidatie.
- **Meting:** het aantal API-calls per GraphQL-verzoek komt in het log, als basis voor fase 4.

## 9. Testen

- **Eenheidstests:** `httptest`-servers die Zaken-, Catalogi- en Objecten-antwoorden naspelen (in
  de vorm van de OAS), met de binding en de Lader eromheen.
- **dynql:** de bestaande tests blijven groen met de `dbLader`. Een extra test bouwt een schema met
  een nep-Lader.
- **Integratie:** een echte Open Zaak + Objecten-API in tijdelijke containers, of lezend op het
  eigen cluster. Dat beslist Mark (§10).

## 9a. Stand van de bouw (18-11)

| Onderdeel | Stand |
|---|---|
| Lader-naad in dynql (`lader.go`) | klaar, commit a602d7a3; daarna ook de weergavenamen via de lader |
| `PeilOpgegeven(ctx)`, `NietOndersteund` (code in GraphQL-extensions), `ZetLaders` | klaar |
| `facade/iri.go` | klaar (alleen bekende basis + uuid) |
| `facade/idmap.go` | geheugenvariant klaar; de PostgreSQL-variant komt in `cmd/facade` |
| `facade/binding.go` + `binding/zgw-zaakmodel.json` | klaar voor Zaak, Rol, Zaaktype, Statustype, Roltype; validatie tegen de MetaRegistry |
| `facade/client.go` | JWT-ZGW/Token, paginering (`next`), alleen URL's onder de eigen basis |
| `facade/apilader.go` | LaadEen/LaadIDs/LaadLijst/BronIDs; filter alleen `eq` + `and` via `filters`; status als materiële relatie met opvolging; IRI-velden |
| `cmd/facade`, REST `/full`, veld `object` op ZaakobjectVerwijzing | nog te doen |

Wat de bouw opleverde:

- **`omgekeerdFilter`** in de binding: voor `gerelateerde_*` op een relatie die in het object
  zelf staat (zaak.zaaktype), de query-parameter waarmee het register de bronnen zoekt.
- **Typeverschillen** tussen register en CM worden recht gezet waar het eenvoudig is: een getal
  naar tekst, of tekst naar een getal (`pasAan`, een vangrail).
  - Gevonden: `statustypeVolgnummer` was tekst in het zaakmodel en is een geheel getal in ZGW.
  - Oorzaak (AI-INRICHTEN): alle velden stonden als `"type": "string"`, en codegen leidt het
    Go-type af uit `type`/`format`, niet uit het gegevenstype.
  - Hersteld op 18-11: 36 velden zijn nu integer, boolean of date(-time). Met die typen laadt
    de façade de ZGW-antwoorden zonder omzetting.
- **Codegen.** Een enum dat domeinen delen, wordt in elk gebruikend domein opnieuw gegenereerd
  (`Vertrouwelijkheidaanduiding`). Gemeld aan BACKEND; lokaal opgevangen met een noodgreep.
- **Tests:** `facade/apilader_test.go`, met een nagespeeld Open Zaak (gepagineerd, controle op de
  autorisatieheader), rechtstreeks en via het GraphQL-schema. De tests slaan over zonder het
  lokaal gegenereerde zaakmodel.
- **Karakteriseringstest:** een query die niet in de golden staat (een type dat erbij kwam), telt
  niet als verschil.

## 10. Open punten

1. **Testomgeving** (Mark): lokaal in containers, of lezend op het cluster `commonground`? Voor
   het laatste zijn een JWT-ZGW-client en een Objecten-token van FUNDAMENT nodig, met alleen
   leesrechten.
2. **Zaakdomeinen in `model/`** (BACKEND, AI-INRICHTEN): gegenereerd op main door een rebuild, of
   eerst alleen op deze branch? Tot dan genereer ik ze lokaal en commit ik ze niet.
3. **Waar de join naartoe gaat.** Het zaakmodel heeft geen entiteit voor het object, want
   zaakobject is alleen een IRI (besluit 18-11). Mijn voorstel voor fase 1:
   - Op `ZaakobjectVerwijzing` komt één façade-veld bij: `object: JSON`.
   - Het veld wordt alleen opgehaald als de afnemer erom vraagt. De façade zoekt de IRI op in de
     prefixtabel, haalt het record uit de Objecten-API en geeft `{objecttype, index, startAt,
     data}` terug. Een IRI zonder bekend prefix geeft `null`.
   - Peilen gaat met de `peiltijdstip`/`geldigOp` van de query, voor zover de Objecten-API die
     kent.
   - Het veld komt via `Opties.ExtraVelden` in `BuildSchemaMet`, niet in het CM. Een getypte
     variant (een CM-entiteit per objecttype) kan later, als Mark een objecttype kiest.
