# Indexen uit het model

Een register krijgt zijn tabellen uit de MetaRegistry (`dbsetup`). Sinds 18-11-2026 geldt dat ook
voor de indexen: één functie leidt uit het model af welke indexen nodig zijn, en de start, de
rebuild en (later) een script voor bestaande registers gebruiken dezelfde lijst.

Dit is M1 → M0: het canonieke model bepaalt de index, de database voert hem uit. Een index
verandert nooit wat een vraag teruggeeft, alleen hoe snel.

## Stand

| Stap | Inhoud | Stand |
|---|---|---|
| 1 | Structurele indexen en de index bij unieke velden | gebouwd (18-11) |
| 2 | Meten op een opgeschaald np-loc | gedaan (18-11), zie [Meting](#meting-18-11-2026) |
| 3 | Sorteren op een veld en exact filteren, als functie | GraphQL: sorteren gebouwd (18-11); REST: alleen vaste volgorde op id, zie [Vervolg](#vervolg) |
| 4 | Aanwijzing in het model: MARKs `register.zoeksleutel`, `register.sorteerbaar` | wacht op de V3-bijlage `marks` |
| 5 | Script voor bestaande registers (`CREATE INDEX CONCURRENTLY`) | nog niet gebouwd |

## Welke indexen er zijn

### Uit het model afgeleid (`dbsetup/indexen.go`)

`ModelIndexDefinities()` loopt de MetaRegistry af en levert twee soorten:

| Soort | Waar | Vorm | Dient |
|---|---|---|---|
| `doel` | elke relatie-hub | `(doel_id, bron_id)` | de omgekeerde relatie: "welke bronnen wijzen naar dit record" (`gerelateerde_<bron>` in GraphQL) |
| `uniek` | de `_Data`-tabel van een GE met een veld `uniek=<bereik>` | `(kolom) WHERE afvoer IS NULL` | de uniekheidscontrole bij elke opvoer (`handlers/registration_uniek.go`, `bezetDoor`) |

- Geen van beide vraagt een aanwijzing in het model. De doelkant volgt uit het bestaan van de
  relatie, de unieke index uit de bestaande eigenschap `uniek` van het veld.
- `uniek` blijft een eigenschap van het veld en wordt geen MARK: het is een regel van het model,
  geen afstemming.
- De unieke index is een gewone, partiële index en géén `UNIQUE`-constraint. De regel zelf bewaakt
  de engine (422), omdat het bereik `domein` of `register` over meerdere tabellen gaat en omdat de
  entiteit en de hub ook actief moeten zijn.
- De doel-index is niet partieel. Zo dient hij ook een vraag op een peiltijdstip, die juist
  afgevoerde rijen nodig heeft.
- Namen: `ix_<tabel>_<kolom>_<soort>`. PostgreSQL kapt namen af op 63 tekens; een langere naam
  wordt daarom zelf ingekort met een hash erachter, zodat twee lange namen niet samenvallen.

`CreateTables` maakt ze aan met `CREATE INDEX IF NOT EXISTS`, na de enkelvoudig-invariant. Een
index die mislukt geeft een waarschuwing en blokkeert de start niet. Een tabel die niet bestaat
(domein niet gebouwd) wordt stil overgeslagen. Een bestaand register krijgt de indexen dus vanzelf
bij de eerstvolgende start; op een grote tabel blokkeert dat aanmaken schrijvers, en daarvoor is
het script van stap 5 bedoeld (`IndexDefinitie.SQL(true)` geeft het statement met `CONCURRENTLY`).

### Al langer aanwezig

| Index | Waar gemaakt | Dient |
|---|---|---|
| primaire sleutels | `createmodeltables.go` | ophalen op id; kinderen per entiteit |
| `ux_<tabel>_enkelvoudig_actief` (EXCLUDE, uitgesteld) | `createtables.go` | hooguit één actief record per enkelvoudig GE |
| `idx_wijziging_formele_lookup`, `idx_wijziging_registratie_id` | `createviews.go` | formeel tijdreizen |
| `idx_registratie_ongedaan_peil`, `idx_registratie_tijdstip` | `createviews.go` | formeel tijdreizen |
| `idx_registratie_domeinen` (GIN) | `createtables.go` | registraties per domein |

### Bewust niet gemaakt

- **`registratie.corrigeert_registratie_id`.** Geen enkele query zoekt op die kolom.
- **Waardekolommen in `_Data`** (zoeken, sorteren). Dat hangt van het gebruik af en komt met de
  MARKs van stap 4. Zonder functie die erop zoekt of sorteert (stap 3) heeft de index geen nut.

## Meting (18-11-2026)

Opzet: een eigen PostgreSQL 17.5 in Docker op de ontwikkel-pc, gevuld via de API met de seed van
`scripts/genereer-load-seed.py --np 20000`: 20.000 personen, 20.000 locaties en 20.000
woonadressen (relatie `bereikbaarheid`), samen 60.000 registraties en 397.000 wijzigingen.
De tijden zijn de uitvoertijd van één query volgens `EXPLAIN ANALYZE`, dus zonder netwerk en
zonder de rest van het verzoek. Het zijn enkele metingen, geen gemiddelden.

| Vraag | Rijen in de tabel | Zonder index | Met index |
|---|---|---|---|
| Bronnen bij één doel (omgekeerde relatie) | 20.000 (np-loc) | 0,53 ms | 0,27 ms |
| Bronnen bij één doel | 1.000.000 (synthetisch) | 14 ms | 0,07 ms |
| Uniekheidscontrole op één waarde | 20.000 (np-loc, kolom `bsn`) | 1,3 ms | 0,04 ms |
| Uniekheidscontrole op één waarde | 1.000.000 (synthetisch) | 16 ms | 0,02 ms |

Wat dit zegt:

- Zonder index groeit de tijd mee met de tabel, met index niet. Bij 20.000 rijen is het verschil
  klein; bij een miljoen is het een factor 200 tot 800.
- De uniekheidscontrole draait bij élke opvoer van een uniek veld. Een seed van 100.000 zaken met
  vier unieke identificaties doet de scan dus 400.000 keer, op een steeds grotere tabel.
- De omgekeerde relatie is in GraphQL één query per ouderrecord. Een lijst van 100 records met
  een omgekeerd veld doet de scan 100 keer.

Kosten, gemeten op de synthetische tabel van een miljoen rijen:

- Ruimte: de doel-index is 30 MB bij een tabel van 58 MB, even groot als de primaire sleutel.
- Schrijven: 100.000 rijen invoegen in één statement kostte 292 ms met de index en 97 ms zonder.
  Per rij is dat ongeveer 2 µs extra, tegenover 11 tot 17 ms voor een hele registratie via de API.

Grenzen van de meting:

- np-loc heeft geen enkel veld met `uniek`. De unieke index is daarom gemeten met de query van
  de uniekheidscontrole tegen de kolom `bsn`, met een tijdelijke index van dezelfde vorm, en niet
  via een echte registratie.
- De regels met een miljoen rijen zijn synthetische tabellen met dezelfde kolommen, gevuld met
  `generate_series`, vier bronnen per doel. De seed van 20.000 is wel via de API geregistreerd.
- Er is geen meting van de seed-snelheid met en zonder indexen. De seed met indexen deed
  60.000 registraties in 1013 s (17 ms per stuk); de eerdere seed van 6.000 zonder deze indexen
  deed er ongeveer 15 ms over. Die twee zijn niet onder gelijke omstandigheden gemeten.
- Geen meting onder gelijktijdige belasting.

Regressie: `TestRegressieNpLoc`, `TestAfgeleideRelatiesNpLoc` en `TestDatabaseproef` zijn groen
met de indexen erin.

## Vervolg

- **Stap 3.**
  - *GraphQL, gebouwd:* het argument `sorteer` op de lijst-queries (`dynql/sortering.go`,
    uitleg in `docs/dynamische-graphql-laag.md` §Sorteren). Exact filteren kon GraphQL al
    (`eq`, `in`, ook op de doel-id van een eigen relatie). De sorteerwaarde is een subquery per
    entiteit; een index op de waardekolom versnelt het sorteren in deze vorm niet. Sorteren dat
    wél een index gebruikt, vraagt een query die bij de `_Data`-tabel begint; dat hoort bij de
    MARK `register.sorteerbaar` (stap 4) en is nog niet ontworpen.
  - *REST, gedeeltelijk:* de lijst en de `/full`-lijst van een entiteit hadden geen `ORDER BY`,
    zodat paginering niet stabiel was. Ze sorteren nu altijd op id (na een eventuele `?sort=`).
  - *REST, open:* filteren en sorteren op een GE-veld. De code daarvoor zit in `dynql`, en
    `dynql` gebruikt `handlers`; andersom kan dus niet zonder het filter en de sortering naar een
    gedeeld pakket te verhuizen. Ook de vorm in de URL is een keuze. Tot dan is "alle zaken van
    zaaktype X, gesorteerd op startdatum" alleen via GraphQL te vragen.
- **Stap 4.** De aanwijzing komt als MARK in een bijlage `marks` naast het V3-model, per veld op
  uuid (`docs/plans/2026-11-18 MARKs — markeringen op het model (plan).md`). De codegen zet hem in
  de MetaRegistry; `ModelIndexDefinities` krijgt er dan de soorten `zoeksleutel` en `sorteerbaar`
  bij. `register.tekstzoeken` is gereserveerd voor zoeken op een deel van een tekst (ander
  indextype).
- **Stap 5.** Een script dat `ModelIndexDefinities` afloopt met `CONCURRENTLY`, voor registers
  met veel data waar de start niet mag blokkeren.
