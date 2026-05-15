# Gegevenstypen & Validatie

> **Canoniek referentiedocument** voor alle gegevenstypen (geïmplementeerd én gepland) en de bijbehorende validatie-architectuur.
> Backlog-status: [BACKLOG_UITVOERING_INCREMENTEN.md](BACKLOG_UITVOERING_INCREMENTEN.md) — A.1 (typering) en A.2 (validatie).

## Gegevenstypen-catalogus

Overzicht van alle gegevenstypen in het `gegevenstypen`-domein. Geïmplementeerde types zijn te vinden in [`model/gegevenstypen_datatype_registry.go`](../model/gegevenstypen_datatype_registry.go) en [`model/datatype_aliases_extra.go`](../model/datatype_aliases_extra.go).

**Statussen:** ✅ Geïmplementeerd · 🔄 Gepland (backlog A.1) · ⚠️ Bewust overgeslagen

Types met een **function-regel** (mod-97, mod-11, 11-proef, geo-bereik) zijn uitgewerkt in [§ Checksum-algoritmen en function-regels](#checksum-algoritmen-en-function-regels) verderop.

| Categorie | Type | OAS-format | Validatie | Status |
|-----------|------|------------|-----------|--------|
| Tekst | `KorteTekst` | — | max 255 tekens | ✅ |
| Tekst | `LangeTekst` | — | geen max | ✅ |
| Tekst | `AN40` | — | max 40 tekens | ✅ |
| Tekst | `AN200` | — | max 200 tekens | ✅ |
| Numeriek | `Geheel` | `int32` | — | ✅ |
| Numeriek | `Decimaal` | `double` | — | ✅ |
| Numeriek | `Bedrag` | `double` | — | ✅ |
| Numeriek | `Percentage` | `double` | 0 ≤ x ≤ 100 (formula-regel) | ✅ |
| Tijdgerelateerd | `Datum` | `date` | `^\d{4}-\d{2}-\d{2}$` | ✅ |
| Tijdgerelateerd | `DatumTijd` | `date-time` | — | ✅ |
| Tijdgerelateerd | `Jaar` | — | 4 cijfers | ✅ |
| Tijdgerelateerd | `Duur` | `duration` | ISO 8601 P-prefix | ✅ |
| Tijdgerelateerd | `DatumIncompleet` | `date-incomplete` | `^(\d{4}\|\d{4}-\d{2}\|\d{4}-\d{2}-\d{2})$` | 🔄 |
| Boolean | `JaNee` | `boolean` | — | ✅ |
| Identificatie (NL) | `BSN` | `bsn` | 9 cijfers + 11-proef (function-regel) | ✅ |
| Identificatie (NL) | `KvKNummer` | `kvk-nummer` | 8 cijfers | ✅ |
| Identificatie (NL) | `RSIN` | `rsin` | 9 cijfers + 11-proef (rechtspersonen; zelfde als BSN) | 🔄 |
| Identificatie (NL) | `Vestigingsnummer` | `vestigingsnummer` | 12 cijfers, geen checksum | 🔄 |
| Identificatie (NL) | `NLPostcode` | `nl-postcode` | `^[1-9][0-9]{3}\s?[A-Za-z]{2}$` | ✅ |
| Financieel | `IBAN` | `iban` | ISO 13616 + mod-97 (function-regel) | ✅ |
| Financieel | `EUBTWNummer` | `eu-vat` | 2-letter landcode + 2–12 alfanumeriek | ✅ |
| Financieel | `Loonheffingsnummer` | `loonheffing-nl` | `^\d{9}L\d{2}$` | ✅ |
| Fiscaal | `TIN` | `tin` | ISO 3166-1 α-2 + 1–20 alfanumeriek | ✅ |
| Communicatie | `Emailadres` | `email` | RFC 5322 (vereenvoudigd) | ✅ |
| Communicatie | `Telefoonnummer` | `phone` | E.164 / NL-vast/mobiel | ✅ |
| Communicatie | `URL` | `uri` | `^https?://` | ✅ |
| Communicatie | `UrlHttps` | `uri-https` | `^https://` | ✅ |
| Visueel | `Kleur` | `color-hex` | `^#([0-9A-Fa-f]{3,6,8})$` | ✅ |
| Geo | `GeoPunt` | `geo-point` | `lat,lng` bereikcheck (function-regel) | ✅ |
| Geo | `GeoLijn` | `geo-linestring` | GeoJSON LineString, min 2 punten | 🔄 |
| Geo | `GeoVlak` | `geo-polygon` | GeoJSON Polygon, gesloten ring | 🔄 |
| Bestanden | `Bestand` | `file-ref` | UUID-formaat; FK naar filestore | 🔄 |
| Zorg | `AGBCode` | `agb-code` | 8 cijfers (Vektis/Agb) | ✅ |
| Zorg | `BIGNummer` | `big-nummer` | 11 cijfers (CIBG) | ✅ |
| Overheid (NL) | `OIN` | `oin` | 20 cijfers (Logius/DigiKoppeling) | ✅ |
| Reisdocumenten | `Kenteken` | `kenteken` | RDW: 6 alfanumeriek in 3 groepen met koppeltekens | ✅ |
| Reisdocumenten | `Paspoortnummer` | `passport-nl` | 9 alfanumeriek (ICAO Doc 9303) | ✅ |
| Reisdocumenten | `Rijbewijsnummer` | `rijbewijs-nl` | 10 cijfers (CBR/RDW), geen publieke checksum | ✅ |
| BAG / WOZ | `BAGPandID` | `bag-pand-id` | 16 cijfers (gem.code 4 + typecode 10 + volgnr 10) | ✅ |
| BAG / WOZ | `BAGVBOID` | `bag-vbo-id` | 16 cijfers (objecttypecode 01) | ✅ |
| BAG / WOZ | `BAGNummeraanduidingID` | `bag-nummeraanduiding-id` | 16 cijfers (objecttypecode 20) | ✅ |
| BAG / WOZ | `BAGLigplaatsID` | `bag-ligplaats-id` | 16 cijfers (objecttypecode 02); zelfde patroon als `BAGPandID` | 🔄 |
| BAG / WOZ | `BAGStandplaatsID` | `bag-standplaats-id` | 16 cijfers (objecttypecode 03) | 🔄 |
| BAG / WOZ | `WOZObjectnummer` | `woz-objectnummer` | 12 cijfers (gem.code 4 + volgnr 8) | ✅ |
| Kadaster | `KadastraleAanduiding` | — | Composiet: gemeentenaam/CBS-code + sectieletter + perceelnr; geen enkelvoudige regex | ⚠️ Bewust overgeslagen |
| Overheid (Int.) | `OIDCode` | `oid` | Punt-gescheiden integers (ISO/IEC 9834) | ✅ |
| Overheid (Int.) | `BGT-identificatiecode` | — | Objecttype-afhankelijk; onrijp formaat, geen stabiele regex | ⚠️ Bewust overgeslagen |
| Overheid (Int.) | `UOI-code` | — | In ontwikkeling bij Geonovum/Kadaster (per 2026-05 niet gepubliceerd) | ⚠️ Bewust overgeslagen |
| Internationaal | `ISBN10` | `isbn-10` | 9+1 digits (of X), mod-11 (function-regel) | ✅ |
| Internationaal | `ISBN13` | `isbn-13` | 13 digits (978/979 prefix), EAN-13 mod-10 (checksum-regel) | ✅ |
| Internationaal | `LEI` | `lei` | ISO 17442: 20 chars, ISO 7064 mod-97 (function-regel) | ✅ |

---

## Validatie-architectuur

> **Status**: 🟢 R1+R2 geleverd 2026-05-14. Backlog-anker: A.2 / B27.

## Doel

Datadriven, **datadriven** validatie van waarden tegen `V3Datatype`-definities — zonder dat het toevoegen van een nieuw datatype of een nieuwe regel een Go-codewijziging vereist. De modelleur bouwt het model in de IDE; de runtime past het toe.

## Architectuur in één plaatje

```
┌────────────────────────────────────────────────────────────────┐
│  MetaRegistry (DatatypeRegistry: []V3Datatype)                 │
│  ───────────────────────────────────────                       │
│  Domein "gegevenstypen" (canoniek, handmatig)                  │
│    BSN, IBAN, NLPostcode, Emailadres, URL, Telefoonnummer,     │
│    GeoPunt, Kleur, Bedrag, Percentage, ...                     │
│       ↑ overschrijft duplicaten uit register/cg/financieel/    │
│         extra via `registreerOfVervangDatatype`                │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  ValideerWaarde(datatypeNaam, waarde, pad)                     │
│    1. lengte (Min/MaxLength)                                   │
│    2. pattern (regex, gecached)                                │
│    3. regels (V3Validatie.Regels[]):                           │
│         type "checksum" → evalueerChecksum (env: d1..dN)       │
│         type "formula"  → evalueerFormula  (env: value/Num/Int)│
│         type "function" → dispatch in `validatieFuncties`      │
│           ├─ "iban_mod97"    (mod-97 met letter→cijfer)        │
│           ├─ "lei_mod97"     (ISO 7064 LEI, geen herplaatsing) │
│           ├─ "isbn10_mod11"  (mod-11, X-digit ondersteuning)   │
│           ├─ "geo_range"     (lat/lng bereikcheck)             │
│           └─ "bsn_11proef"   (legacy alias voor BSN)           │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  ValidatieResultaat { Fouten[], Waarschuwingen[] }             │
│    │                                                           │
│    └─ BuildProblemDetails(res, instance) → ProblemDetails      │
│         (RFC 9457 + NL API Strategie `invalidParams[]`)        │
└────────────────────────────────────────────────────────────────┘
```

## R1 — generieke regel-evaluator

**Probleem (vóór refactor)**: `model/validation.go` had een hardgecodeerde map
`builtinValidators map[string]func{"BSN":validerenBSN, "IBAN":validerenIBAN, ...}`.
Dat koppelt validatie aan de Go-typenaam — een modelleur die in de IDE een nieuw type
toevoegt kreeg geen validatie zonder een PR + redeploy.

**Oplossing**: alle validatie loopt nu via `V3Validatie.Regels[]`, een lijst van `V3Regel`
{Naam, Type, Expressie}. Drie regel-types:

| Type | Expressie-vorm | Env | Voorbeeld |
|---|---|---|---|
| `checksum` | Go-stijl boolean expressie over `d1..dN`, `n` | per cijfer in de waarde | `(9*d1 + 8*d2 + ... - 1*d9) % 11 == 0` (BSN) |
| `formula` | Boolean expressie over `value`, `valueNum`, `valueInt` | de hele waarde | `valueNum >= 0 && valueNum <= 100` (Percentage) |
| `function` | Functienaam | n.v.t. | `iban_mod97`, `geo_range` |

De expressie-evaluator (`model/regels_eval.go`) is **pure stdlib**: parsing via
`go/parser`, eigen recursieve AST-walker over `ast.Expr`. Geen externe expressie-engine
nodig (geen `expr-lang/expr`, geen `cel-go`). Dit houdt de dependency-footprint klein
en geeft de modelleur vertrouwde Go-syntax. Ondersteunde operatoren:
`+ - * / %  ==  !=  <  <=  >  >=  &&  ||  !  ( )`. Literals: int, float, string. Geen
function-calls of indexing — bewust minimaal en safe (geen side effects mogelijk).

Geparseerde expressies worden gecached (`sync.RWMutex` + map).

### Frontend-pariteit

De frontend-evaluator in [`web/vite/src/umleditor/validatie/regels.js`](../web/vite/src/umleditor/validatie/regels.js)
volgt exact hetzelfde patroon (`evalueerChecksum`, `evalueerFormula`, function-dispatch).
Een regel die in V3 staat werkt dus zowel server-side (in `RegistreerCore`) als
client-side (in de UML-editor preview).

### Function-dispatch (escape hatch)

Soms past een regel niet in een eenvoudige expressie — IBAN mod-97 vereist letter→cijfer
mapping (A=10..Z=35), GeoPunt vereist `,`-parsing. Voor die gevallen is er
`validatieFuncties map[string]ValidatieFunctie`. Modelleur zet `Type:"function",
Expressie:"iban_mod97"`; de Go-zijde levert de implementatie. Uitbreiding via
`RegistreerValidatieFunctie(naam, fn)`.

Onbekende functienamen leiden tot een **waarschuwing** (niet een blocker), zodat een
modelleur die een functienaam typo't niet de hele registratie-API blokkeert.

## R2 — `gegevenstypen`-domein

**Probleem (vóór refactor)**: algemene types waren verspreid over vier bestanden:
`register_datatype_registry.go` (BSN, NLPostcode, KvKNummer, KorteTekst, ...),
`cg_datatype_registry.go` (URL, Emailadres, Telefoonnummer), `financieel_datatype_registry.go`
(IBAN), `extra_datatype_registry.go` (Kleur, Duur, GeoPunt). Een BSN heeft niets met
"register" of "financieel" te maken — het is een algemeen gegevenstype.

**Oplossing**: nieuw bestand [`model/gegevenstypen_datatype_registry.go`](../model/gegevenstypen_datatype_registry.go)
met de canonieke set, alle entries `Domein: "gegevenstypen"`. Wordt als **laatste** in
`init()` aangeroepen. Helper `registreerOfVervangDatatype` doet *laatste-wint-op-Naam*:
oudere duplicates uit codegen-bestanden worden vervangen, posities (UML-editor layout)
worden uit de oude entry overgenomen zodat de visualisatie niet verspringt.

De codegen-bestanden hoeven **niet** aangepast te worden; ze blijven werken maar worden
overschreven door de canonieke versie. Wanneer codegen later het V3-bron-model herwerkt
en types met `Domein:"gegevenstypen"` schrijft, is dat geen breaking change.

In de schema-export (`v3_exporter.go`, `datatypeDomeinScore`) is `"gegevenstypen"` als
universeel-acceptabel domein toegevoegd, naast de legacy `"register"`-fallback. Daarmee
blijven types als BSN en NLPostcode beschikbaar in alle domein-specifieke schema-exports.

## R1.5 — RFC 9457 + NL API Strategie problem-details

Validatiefouten worden nu als `application/problem+json` teruggegeven, conform
[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) en de [NL API Strategie ADR
foutafhandeling](https://gitdocumentatie.logius.nl/publicatie/api/adr/) (zie ook UK
Government API guidance, die op dezelfde RFC bouwt).

`ProblemDetails`-payload:

```json
{
  "type": "https://api.bitemporeel/problemen/validatie",
  "title": "Validatiefout",
  "status": 422,
  "detail": "2 veldfout(en) gevonden tijdens validatie",
  "instance": "/registratie/natuurlijk_personen",
  "code": "validation_error",
  "invalidParams": [
    { "name": "wijzigingen[0].voornaam", "code": "max-length",
      "reason": "Waarde is te lang (maximaal 40 tekens)", "value": "Lange..." },
    { "name": "wijzigingen[1].bsn",      "code": "checksum",
      "reason": "Waarde voldoet niet aan 11-proef", "value": "111222334" }
  ]
}
```

`ValidatieFout` → `InvalidParam` mapping:

| ValidatieFout | InvalidParam | Toelichting |
|---|---|---|
| `Veld` | `name` | volledig pad (`wijzigingen[0].voornaam`) |
| `Code` | `code` | korte code (`pattern`, `min-length`, `checksum`, `function`, ...) |
| `Bericht` | `reason` | mensleesbare reden (NL) |
| `Waarde` | `value` | (afgekapte) waarde t.b.v. debugging |

In `RegistreerError.Problem` wordt het door `RegistreerCore` gevuld; de Gin-adapter
zet `Content-Type: application/problem+json` en serialiseert. Voor niet-validatie-
fouten houden we de bestaande `{"error": "..."}`-vorm (backwards-compat).

## Wat is *niet* gedaan in R1+R2

- **R3 (TypeMeta.Velden + reflectie-cache)** — eigen taak. De walker doet vandaag per
  request volledige `reflect.Type`-traversal. Optimalisatie: eenmalig
  `reflect.Type → []{path, datatype, fieldIndex}` cachen via `sync.Map`. Apart te plannen.
- **R4 (per-veld `Validatieregels` op TypeMeta)** — vereist een uitbreiding van zowel
  `TypeMeta` als de V3-export. Apart in te plannen samen met B4 (CEL-engine voor
  cross-veld regels).
- **Codegen-bron herwerken naar `Domein:"gegevenstypen"`** — niet noodzakelijk dankzij
  het dedupe-mechanisme. Bij een toekomstige rebuild van het V3-bron-model is het wel
  schoner om dat te doen.

## Tests

- [model/regels_eval_test.go](../model/regels_eval_test.go) — basis-operatoren,
  BSN-checksum, formula, function-registratie, onbekende-functie, ProblemDetails-mapping.
- [model/validation_test.go](../model/validation_test.go) — BSN, IBAN, NLPostcode,
  Emailadres, Kleur, GeoPunt + walker-test.

```sh
cd bitemp_register_v06
go test ./model/... -run "TestEvalueer|TestValideer|TestBuildProblem"
```

---

## Checksum-algoritmen en function-regels

### ISBN-10 — `isbn10_mod11`

Variant vóór 2007. Bestaat uit 9 datacijfers + 1 controlecijfer (0-9 **of** de letter X = 10).

**Formule** (gewogen som modulo 11):

$$\text{Som} = 10 \cdot d_1 + 9 \cdot d_2 + \cdots + 2 \cdot d_9 + d_{10}$$

$$\text{Som} \bmod 11 = 0$$

Omdat $d_{10}$ de waarde X (=10) kan hebben, is dit niet in een `checksum`-expressie te schrijven (de evaluator slaat niet-cijferkarakers over). Geïmplementeerd als **function-regel** `isbn10_mod11` in [`model/regels_eval.go`](../model/regels_eval.go).

Geldige voorbeelden: `"0306406152"`, `"048665088X"`.

### ISBN-13 — `checksum`-expressie (EAN-13 mod-10)

Actuele standaard. Altijd 13 cijfers, begint met prefix 978 of 979. Controlecijfer via het EAN-13 algoritme (gewichten afwisselend 1 en 3, modulo 10).

**Expressie** (in V3Datatype `Regels[]`):

```
(d1 + 3*d2 + d3 + 3*d4 + d5 + 3*d6 + d7 + 3*d8 + d9 + 3*d10 + d11 + 3*d12 + d13) % 10 == 0
```

Verificatie met `"9780306406157"`: som = 9 + 21 + 8 + 0 + 3 + 0 + 6 + 12 + 0 + 18 + 1 + 15 + 7 = **100** → 100 % 10 = 0 ✓

Geen Go-functie nodig; de generieke `evalueerChecksum`-evaluator volstaat.

### LEI — `lei_mod97` (ISO 17442 + ISO 7064 mod-97)

Legal Entity Identifier: 20 alfanumerieke tekens (18 vrij + 2 numerieke controlecijfers). Uitgifte via GLEIF-erkende Local Operating Units (LOU's).

**Structuur:**

| Positie | Inhoud                          |
|---------|----------------------------------|
| 1-4     | LOU-prefix (alfanumeriek)       |
| 5-18    | Entiteitsspecifieke code        |
| 19-20   | Numerieke controlecijfers       |

**Algoritme** (ISO 7064 Mod-97,10 — zelfde principe als IBAN, maar zónder herplaatsing):

1. Converteer alle letters naar hun numerieke waarde: A = 10, B = 11, …, Z = 35.
2. Behandel de volledige 20-teken reeks als één groot getal.

$$\text{Reeks} \bmod 97 = 1$$

Geïmplementeerd als **function-regel** `lei_mod97` in [`model/regels_eval.go`](../model/regels_eval.go).

Gesynthetiseerde testwaarde: `"AAAAAAAAAAAAAAAAAA26"` — 18 ×  A (=10) + checksum 26 geeft na conversie een reeks waarvan mod 97 = 1 (geverifieerd bij implementatie).


