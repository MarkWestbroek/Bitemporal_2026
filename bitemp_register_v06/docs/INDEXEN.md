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
| 4 | Aanwijzing in het model: MARKs `register.zoeksleutel`, `register.sorteerbaar` | gebouwd (18-11), zie [Marks](#marks-zoeksleutel-en-sorteerbaar) |
| 5 | Script voor bestaande registers (`CREATE INDEX CONCURRENTLY`) | nog niet gebouwd |

## Welke indexen er zijn

### Uit het model afgeleid (`dbsetup/indexen.go`)

`ModelIndexDefinities()` loopt de MetaRegistry af en levert twee soorten:

| Soort | Waar | Vorm | Dient |
|---|---|---|---|
| `doel` | elke relatie-hub | `(doel_id, bron_id)` | de omgekeerde relatie: "welke bronnen wijzen naar dit record" (`gerelateerde_<bron>` in GraphQL) |
| `uniek` | de `_Data`-tabel van een GE met een veld `uniek=<bereik>` | `(kolom, entiteit-id)`, naam `…_zoek` | de uniekheidscontrole bij elke opvoer (`handlers/registration_uniek.go`, `bezetDoor`) én het filter van een lijst op dat veld |

- Geen van beide vraagt een aanwijzing in het model. De doelkant volgt uit het bestaan van de
  relatie, de unieke index uit de bestaande eigenschap `uniek` van het veld.
- `uniek` blijft een eigenschap van het veld en wordt geen MARK: het is een regel van het model,
  geen afstemming.
- De unieke index is een gewone index en géén `UNIQUE`-constraint. De regel zelf bewaakt
  de engine (422), omdat het bereik `domein` of `register` over meerdere tabellen gaat en omdat de
  entiteit en de hub ook actief moeten zijn.
- **De unieke index is niet partieel (sinds api 0.30.0).** In 0.28.0 en 0.29.0 was hij
  `WHERE afvoer IS NULL`. Het filter van een lijst vraagt echter altijd "actief op het
  leesmoment": `opvoer <= t AND (afvoer IS NULL OR afvoer > t)`. Daaruit volgt niet
  `afvoer IS NULL`, dus PostgreSQL mocht de index niet gebruiken en las bij elke zoekvraag op
  bijvoorbeeld een zaakidentificatie de hele tabel. Gevonden met de meting op het zaakmodel
  (18-11). Op proefdata (102.000 rijen): 3,5 ms met de partiële index (volledige scan), 0,06 ms
  met de gewone. Een uniek veld is daarmee vanzelf een zoeksleutel; een mark is er niet voor
  nodig. De index heet nu `ix_<tabel>_<kolom>_zoek`, dezelfde naam als bij de mark.
- **Bestaand register:** bij de start komt de nieuwe index erbij en gaat de oude
  `ix_<tabel>_<kolom>_uniek` weg, in die volgorde en alleen als het aanmaken lukte. Niets doen.
- De doel-index is niet partieel. Zo dient hij ook een vraag op een peiltijdstip, die juist
  afgevoerde rijen nodig heeft.
- Namen: `ix_<tabel>_<kolom>_<soort>`. PostgreSQL kapt namen af op 63 tekens; een langere naam
  wordt daarom zelf ingekort met een hash erachter, zodat twee lange namen niet samenvallen.

`CreateTables` maakt ze aan met `CREATE INDEX IF NOT EXISTS`, na de enkelvoudig-invariant. Een
index die mislukt geeft een waarschuwing en blokkeert de start niet. Een tabel die niet bestaat
(domein niet gebouwd) wordt stil overgeslagen. Een bestaand register krijgt de indexen dus vanzelf
bij de eerstvolgende start; op een grote tabel blokkeert dat aanmaken schrijvers, en daarvoor is
het script van stap 5 bedoeld (`IndexDefinitie.SQL(true)` geeft het statement met `CONCURRENTLY`).

### Marks: zoeksleutel en sorteerbaar

Een index op een gewone waardekolom volgt niet uit het model zelf: of er op een veld gezocht of
gesorteerd wordt, hangt van het gebruik af en kan per omgeving verschillen. Die aanwijzing is
daarom een **MARK** (MDA-markering, plan `docs/plans/2026-11-18 MARKs — markeringen op het model
(plan).md`) en geen eigenschap van het veld. De Studio levert de geldende marks als bijlage
naast het V3-model:

```json
"marks": {
  "context": ["loadtest"],
  "marks": [
    { "doel": { "soort": "veld", "uuid": "1111…" }, "soort": "register.zoeksleutel", "waarde": true },
    { "doel": { "soort": "veld", "uuid": "2222…" }, "soort": "register.sorteerbaar", "waarde": true }
  ]
}
```

De weg van mark naar index:

| Stap | Waar | Wat |
|---|---|---|
| 1 | Studio, sidecar `/export/v3` | de geldende marks voor de gekozen context, als `marks` naast `model` |
| 2 | `handlers/rebuild_uit_project.go` | stuurt de marks van het project mee en zet de bijlage als sleutel `marks` in het kale model |
| 3 | `cmd/codegen` (`model.PasRegisterMarksToe`) | zoekt per mark het veld op zijn uuid en zet `zoeksleutel` / `sorteerbaar` in de schema-tag van de `_Data`-struct |
| 4 | `dbsetup/indexen.go` | maakt per gemarkeerd veld de index `ix_<tabel>_<kolom>_zoek` op `(kolom, entiteit-id)` |

- Beide marksoorten geven dezelfde index. Hij is niet partieel, zodat ook een vraag op een
  peiltijdstip hem gebruikt.
- De index dient het **filter** (`eq`, `in`, bereik) en, sinds 18-11-2026, het **sorteren** in
  het eenvoudige geval (zie §Sorteren op de waarde zelf).
- Een mark waarvan de uuid niet in het model staat, op iets anders dan een veld, of zonder
  ja/nee-waarde: een waarschuwing in de uitvoer van de codegen, en de bouw gaat door.
- `register.tekstzoeken` is gereserveerd en wordt nog niet gelezen. Andere naamruimten gaan
  ongelezen mee.
- Een extern V3-bestand (niet uit de Studio) kan dezelfde bijlage dragen, als sleutel `marks` in
  het model of naast `model` in de envelop. De velden met een mark hebben dan een `uuid` nodig.
- Een mark weghalen haalt de index niet weg: `dbsetup` maakt aan en ruimt niet op.
- Getest met het zaakmodel in een proefkopie: `zoeksleutel` op `Rol.RolNatuurlijkPersoon.bsn` en
  `sorteerbaar` op `Zaak.ZaakLooptijd.startdatum` geven de schema-tags en de twee indexen. Niet
  getest: de hele keten vanaf een Studio-project op een draaiend register.

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

## Lezen: alleen wat gevraagd is, en omgekeerde relaties per lijst (18-11-2026)

Aanleiding: de meting van FUNDAMENT op het register met zaken (102.000 zaken, 16 gelijktijdige
gebruikers; de database stond op 2,0 van 2 CPU). Naast de index hierboven bleek het aantal
SQL-vragen per GraphQL-verzoek de oorzaak. Twee wijzigingen in `dynql/selectie.go`:

- **Groepen op selectie.** Een full-query laadde altijd alle onderliggende gegevenselementen en
  relaties van een entiteit. Voor Zaak zijn dat 14 groepen, ongeveer 25 tot 30 SQL-vragen per
  verzoek, ook als de query er vijf selecteert. De resolver leest nu de selectie en laadt alleen
  die groepen. Alles laden gebeurt nog als de query een afgeleid veld, een afgeleide relatie of
  een extra veld vraagt (die rekenen met andere groepen), als er een toegangsbeleid actief is
  (een regel kan van elk veld afhangen) en bij `geldigOp`.
- **Omgekeerde relaties gebundeld.** `gerelateerde_<bron>` werd per ouder opgelost: per ouder
  één vraag voor de id's en dan de hele bron-entiteit. Nu doet de eerste rij van een lijst het
  voor alle rijen: één vraag voor de paren (doel, bron), met de grens per doel, en één lading
  van de bronnen. De volgorde binnen één doel is nu vast (oplopend op bron-id); die was
  onbepaald.
- Forward-relaties (`zaak_zaaktypen { zaaktype { … } }`) laden nog per voorkomen; wel alleen de
  gevraagde groepen.
- **Noodrem:** `GRAPHQL_KLASSIEK_LADEN=1` zet beide uit (het gedrag tot en met api 0.29.0).

Bewijs dat het antwoord gelijk blijft: `TestLadenOpSelectie` (tag `integration`) draait 346
deelselecties op np-loc twee keer, klassiek en nieuw: 0 verschillen, 2225 tegen 693 SQL-vragen.
`TestLaderKarakterisering` (volledige selectie, 210 queries) is ongewijzigd groen. Niet gemeten:
het effect op het register met zaken onder belasting; dat meet FUNDAMENT na de uitrol.

## Sorteren op de waarde zelf (18-11-2026)

Ontwerp en proefmeting: `docs/plans/2026-11-18 Sorteren via de index — ontwerp.md`. Code:
`dynql/sortering.go` (onderaan) en `dbLader.LaadLijst`.

- **Wanneer.** De lijst heeft precies één sorteersleutel `<GE of relatie>.<veld>`, en dat GE is
  enkelvoudig en niet materieel. Per entiteit is er dan hooguit één actief record.
- **Hoe.** Eerst één vraag voor de id's van de pagina: de entiteit gejoind met het actieve
  record, gesorteerd op de kolom zelf en dan de id. Daarna laadt de lader die entiteiten op id.
  Met een index op de kolom (`uniek`, mark `register.zoeksleutel` of `register.sorteerbaar`)
  loopt PostgreSQL de index in volgorde af en stopt na de pagina.
- **Zonder waarde achteraan.** Entiteiten zonder actief record of met een lege waarde komen
  niet uit de join. Zij vormen een tweede deel, op id, dat de pagina aanvult als het eerste
  deel op is. De regel is dus dezelfde als in de subquery-vorm, in beide richtingen.
- **Ook zonder index.** De join-vorm geldt ook voor een veld zonder index: PostgreSQL sorteert
  dan één keer in plaats van per entiteit een subquery uit te rekenen. Het ontwerp eiste een
  index; de proef liet zien dat dat niet nodig is.
- **Ja/nee-velden.** De subquery-vorm kan niet op een ja/nee-veld sorteren (`MIN`/`MAX` bestaat
  daar niet voor in PostgreSQL; de vraag gaf een fout). De join-vorm kan het wel.
- **Noodrem:** `GRAPHQL_KLASSIEK_LADEN=1` zet ook deze vorm uit.

### Veel gelijke waarden (18-11-2026, na de meting op het register)

FUNDAMENT mat api 0.30.0 op het register met zaken (373.726 zaken, 16 gebruikers). Zoeken op
identificatie ging van 301 naar 2,4 ms. Sorteren op startdatum werd niet sneller, en binnen één
zaaktype veel trager (823 ms werd ruim 10 s, met time-outs). Twee oorzaken, beide hersteld:

- **De tweede sorteersleutel kwam niet uit de index.** 270.790 zaken hadden dezelfde
  startdatum. De query sorteerde op `startdatum DESC, zaak.id ASC` en de index stond alleen op
  `(startdatum)`: PostgreSQL moest de hele groep met die datum lezen om de eerste 50 te vinden.
  Herstel: de index is `(kolom, entiteit-id)`, en de query sorteert op de waarde en de
  entiteit-id uit dezelfde tabel, **beide in dezelfde richting**. Eén index kan `(waarde ASC,
  id ASC)` en `(waarde DESC, id DESC)` leveren, niet `(waarde DESC, id ASC)`. Daarom volgt de
  id nu de richting van de laatste sleutel, in alle sorteervormen (ook de subquery-vorm, zodat
  de volgorde niet van de vorm afhangt). Dat is een zichtbare wijziging: aflopend sorteren
  geeft bij gelijke waarden de hoogste id eerst.
- **Met een filter liep de planner de index op de waarde af** en toetste het filter per rij;
  bij een zaaktype met 1% van de zaken gooide hij 99% weg. Herstel: met een filter gaat deel 1
  via een gematerialiseerde CTE: eerst de entiteiten die aan het filter voldoen met hun
  waarde, dan sorteren. Dat kost evenveel als de subquery-vorm bij een smal filter en minder
  bij een breed filter. De index op de waarde wordt met een filter dus niet gebruikt om te
  sorteren.

Een bestaande index `…_zoek` met alleen de waarde (api 0.30.0) wordt bij de start weggehaald
en opnieuw aangemaakt met de entiteit-id erbij.

Proef op nagebouwde tabellen (373.000 zaken, 72% op één datum, één gebruiker, eerste 50
aflopend op startdatum; geen meting op het register):

| Vraag | api 0.30.0 | Hersteld |
|---|---|---|
| alle zaken | 309 ms (2,1 miljoen pagina's gelezen) | 0,3 ms (400) |
| alle zaken, tiende pagina | (als boven) | 0,7 ms |
| zaken van één zaaktype (1%) | 250 ms (2,2 miljoen) | 23 ms (34.000); subquery-vorm: 20 ms |
| zaken van de helft van de zaaktypen | niet gemeten | 140 ms |

De eerdere proef hieronder had de datums gelijk gespreid; daardoor viel dit niet op.

Proefmeting (nagebouwde tabellen, 102.000 zaken, één gebruiker; geen meting op het register):

| Vraag | Subquery-vorm | Join-vorm |
|---|---|---|
| alle zaken op startdatum, eerste 50, met index | 351 ms | 0,4 ms |
| idem, zonder index | 351 ms | 40 ms |
| zaken van één zaaktype (5%) op startdatum, eerste 50 | 13,7 ms | 3,6 ms |

Bewijs dat de volgorde gelijk blijft: `TestSorterenOpWaarde` (tag `integration`) draait op
np-loc 382 sorteervragen twee keer, met de noodrem en zonder: oplopend, aflopend, pagina's over
de grens tussen de twee delen, een offset voorbij het eerste deel, een filter, een
peiltijdstip en de full-lijst. 0 verschillen; 220 vragen gingen via de join-vorm. Np-loc is
klein (zes personen): de test bewijst de volgorde, niet de snelheid.

## Zoektabellen (19-11-2026)

Ontwerp en besluiten: `docs/plans/2026-11-18 Zoekdefinities — zoektabellen als inrichting
(ontwerp).md`. Code: `dynql/zoektabel.go`; de haak in `handlers/registration_core.go`
(`VoorCommit`); aansluiting in `main.go`. Test: `TestZoektabel` (tag `integration`).

**Waarvoor.** Een lijst "binnen één relatie, gesorteerd op één veld van een gegevenselement"
(zaken van een zaaktype op startdatum) kan geen index gebruiken: de relatie en het veld staan in
verschillende tabellen. PostgreSQL moet dan alle entiteiten van dat doel met hun waarde ophalen
voordat het de eerste pagina kan kiezen. Een zoektabel zet doel, waarde en entiteit bij elkaar
in één tabel met één index.

**Instellen: een `ZoekDefinitie`.** Registerdata in het configuratiedomein (inrichting), zoals
een `QueryDefinitie`. Er is geen rebuild en geen herstart nodig; het type heeft de gewone
registratie-API, REST-routes en GraphQL.

| Gegevenselement | Velden | |
|---|---|---|
| `ZoekdefinitieNaam` | `naam`, `beschrijving` | voor beheer en het log |
| `ZoekdefinitiePad` | `binnen`, `sorteerveld` | `Zaak.zaak_zaaktypen` en `Zaak.zaaklooptijd.startdatum`, in de namen van het GraphQL-schema |
| `ZoekdefinitieStatus` | `status` (`concept`, `actief`, `inactief`), `reden` | materieel: "actief vanaf …" kan vooruit |

```json
{ "registratie": { "registratietype": "registratie" }, "wijzigingen": [
  { "opvoer": { "zoekdefinitie": { "id": 1, "aanvang": "2026-11-19" } } },
  { "opvoer": { "zoekdefinitienaam": { "zoekdefinitie_id": 1, "naam": "zaken-per-zaaktype-op-startdatum" } } },
  { "opvoer": { "zoekdefinitiepad": { "zoekdefinitie_id": 1,
      "binnen": "Zaak.zaak_zaaktypen", "sorteerveld": "Zaak.zaaklooptijd.startdatum" } } },
  { "opvoer": { "zoekdefinitiestatus": { "zoekdefinitie_id": 1, "status": "actief", "aanvang": "2026-11-19" } } } ] }
```

Voorwaarden: de relatie en het gegevenselement hangen aan dezelfde entiteit; het
gegevenselement is enkelvoudig en niet materieel; de doel-id van de relatie staat in de hub. Een
definitie die daar niet aan voldoet, wordt overgeslagen met een regel in het log
(`zoekdefinitie … overgeslagen: …`); de registratie zelf wordt niet geweigerd, want de
registratiecode kent de zoektabellen niet.

**Inrichten in stappen.**

1. Neem de namen uit de GraphQL-vraag die je wilt versnellen. Uit
   `zaken(filter: { zaak_zaaktypen: { zaaktype_id: { eq: 9 } } }, sorteer: [{ veld:
   "zaaklooptijd.startdatum" }])` volgt `binnen` = `Zaak.zaak_zaaktypen` en `sorteerveld` =
   `Zaak.zaaklooptijd.startdatum`. `Zaak` is de typenaam van de entiteit, niet de naam van de
   lijst.
2. Registreer de zoekdefinitie (het voorbeeld hierboven), als beheerder. Kies een `id` die nog
   niet bestaat.
3. Kijk in het log van de API. Direct na de registratie staat er een regel
   `zoektabellen: zk_… (naam): … — vullen`, of `zoekdefinitie … overgeslagen: <reden>` als een
   pad niet klopt.
4. Volg het vullen in de database: `SELECT tabel, status, gevuld_tot_id, melding FROM
   zoektabel_stand`. `gevuld_tot_id` loopt op tot de hoogste entiteit-id; daarna wordt de status
   `gevuld`. Vanaf dat moment gebruikt de API de zoektabel.
5. Controleer het gebruik met het queryplan van de vraag in `pg_stat_statements`: de vraag
   leest dan `FROM "zk_…"`.
6. Uitzetten: registreer een status `inactief`, of voer de definitie af
   (`DELETE /zoek_definities/<id>`). De zoektabel wordt niet meer gelezen en na vijf minuten
   weggegooid. Tijdelijk uitzetten zonder iets te registreren kan met de noodrem
   `GRAPHQL_KLASSIEK_LADEN=1`, maar die zet ook het laden op selectie en het snelle sorteren
   uit.
7. Een andere relatie of een ander sorteerveld is een nieuwe zoekdefinitie. Elke zoektabel
   kost schrijftijd bij elke registratie die de entiteit raakt, en schijfruimte.

**De zoektabel.** `zk_<id van de definitie>_<hash>` met `doel_id`, `waarde`, `entiteit_id`,
`rel_id`, `opvoer`, `afvoer`, en de index `(doel_id, waarde, entiteit_id)`. De hash in de naam
maakt van een gewijzigd pad een nieuwe tabel. `opvoer` en `afvoer` zijn de doorsnede van de
geldigheid van de entiteit, het relatievoorkomen, de GE-hub en het datarecord; de leesregel is
dus dezelfde als op elke tabel, ook met een peiltijdstip. Een rij met een lege `opvoer` (een
ongedaan gemaakte opvoer) telt niet mee. De zoektabel is plumbing: geen `wijziging`-rijen, geen
registratie, altijd herbouwbaar uit de brontabellen.

**De stand: `zoektabel_stand`.** Eén rij per zoektabel met de definitie, de paden en de status:

| Status | Lezen | Bijhouden |
|---|---|---|
| `vullen` | nee | ja |
| `gevuld` | ja, als de definitie nu actief is | ja |
| `uitfaseren` | nee | ja, tot hij na vijf minuten wordt weggegooid |
| `fout` | nee | nee; wordt bij het volgende afstemmen opnieuw gevuld |

**Afstemmen.** Bij de start, elke minuut, en direct na een registratie in het
configuratiedomein vergelijkt de API de zoekdefinities met de stand: aanmaken en vullen wat
gewenst is (nu actief, of later actief), uitfaseren en opruimen wat niet meer gewenst is. Het
vullen loopt op de achtergrond in groepen van 500 entiteiten en hervat na een herstart.

**Bijhouden.** De registratiecode biedt een haak vlak voor de commit (`handlers.VoorCommit`);
de zoektabellen melden zich daarop aan. Voor elke entiteit die de registratie heeft geraakt
(ook via een ongedaanmaking of correctie) worden de rijen verwijderd en opnieuw afgeleid, onder
een slot per entiteit. Opvoer, afvoer, correctie, ongedaanmaking en replay lopen zo langs
dezelfde code.

**De zoektabel staat het register niet in de weg** (besluit Mark, 18-11-2026; de
afhankelijkheid loopt van zoektabel naar register). De haak draait in een savepoint. Mislukt
het bijhouden, of duurt het wachten op een slot langer dan 200 ms, dan slaagt de registratie
toch, gaat de zoektabel naar `fout` en volgt het lezen de gewone weg tot hij opnieuw is gevuld.

**Lezen.** `LaadLijst` gebruikt een zoektabel als: het filter precies één voorwaarde is (de
doel-id van de relatie `eq` één waarde), de enige sorteersleutel het sorteerveld is, er geen
toegangsbeleid actief is en de noodrem `GRAPHQL_KLASSIEK_LADEN` uit staat. De id's van de
pagina komen dan uit de zoektabel; de entiteiten worden daarna op id geladen. Entiteiten zonder
waarde staan niet in de zoektabel en vullen de pagina aan via de gewone weg. In elk ander geval
volgt de vraag de gewone weg. Twee voorkomens van de relatie naar hetzelfde doel geven twee
rijen; de leesvraag ontdubbelt lopend over de index.

**Grenzen.** Eén relatie en één sorteerveld per definitie; alleen `eq` op één doel, zonder
extra filtervoorwaarden; alleen een enkelvoudig, niet-materieel gegevenselement; alleen
GraphQL-lijsten. Een rebuild of `DeleteTables` kent de zoektabellen niet: ze blijven staan tot
het afstemmen ze opruimt of opnieuw vult.

**Bewijs.** `TestZoektabel` registreert op np-loc een zoekdefinitie (personen binnen een
locatie, op achternaam) en draait in zeven fasen 42 lijstvragen twee keer, via de gewone weg en
via de zoektabel: na het vullen, na een nieuwe waarde, een eerste waarde, een nieuwe relatie,
een ongedaanmaking, het afvoeren van een entiteit, en op een peiltijdstip van vóór de
wijzigingen. 0 verschillen; alle vragen gingen via de zoektabel. Daarna: leegmaken en opnieuw
vullen geeft dezelfde rijen, en na het afvoeren van de definitie faseert de tabel uit en wordt
hij opgeruimd. Np-loc is klein: de test bewijst de uitkomst, niet de snelheid.

Proef op nagebouwde tabellen (373.000 zaken, 100 zaaktypen, één gebruiker; geen meting op het
register):

| Vraag | Gewone weg (api 0.30.1) | Zoektabel |
|---|---|---|
| zaken van één zaaktype op startdatum, eerste 50 | 23 ms, 34.000 pagina's | 0,05 ms, 34 pagina's |
| idem, tiende pagina | (als boven) | 0,3 ms, 500 pagina's |

Daar komt in beide gevallen het laden van de 50 entiteiten bij. De zoektabel was 30 MB. Niet
gemeten: het register onder gelijktijdige belasting, de kosten per registratie, en het vullen
op een groot register terwijl er geschreven wordt.

## Vervolg

- **Zoektabellen: vervolg.** Versie 1 is gebouwd (§Zoektabellen). Open: een mark als bron
  van zoek- en querydefinities; een weigering (422) bij het registreren van een ongeldige
  definitie; `in` en extra filtervoorwaarden; de zoektabel ook gebruiken voor een lijst
  binnen een doel zonder sortering.
- **Stap 3.**
  - *GraphQL, gebouwd:* het argument `sorteer` op de lijst-queries (`dynql/sortering.go`,
    uitleg in `docs/dynamische-graphql-laag.md` §Sorteren). Exact filteren kon GraphQL al
    (`eq`, `in`, ook op de doel-id van een eigen relatie). In de algemene vorm is de
    sorteerwaarde een subquery per entiteit; een index op de waardekolom versnelt dat niet. Het
    eenvoudige geval gaat sinds 18-11-2026 via een join en gebruikt de index wel (§Sorteren op
    de waarde zelf).
  - *REST, gedeeltelijk:* de lijst en de `/full`-lijst van een entiteit hadden geen `ORDER BY`,
    zodat paginering niet stabiel was. Ze sorteren nu altijd op id (na een eventuele `?sort=`).
  - *REST, open:* filteren en sorteren op een GE-veld. De code daarvoor zit in `dynql`, en
    `dynql` gebruikt `handlers`; andersom kan dus niet zonder het filter en de sortering naar een
    gedeeld pakket te verhuizen. Ook de vorm in de URL is een keuze. Tot dan is "alle zaken van
    zaaktype X, gesorteerd op startdatum" alleen via GraphQL te vragen.
- **Sorteren met een index: de andere gevallen.** Het eenvoudige geval is gebouwd (§Sorteren
  op de waarde zelf). Meer sleutels, een meervoudig of materieel GE en een eigen kolom van de
  entiteit houden de subquery-vorm. Pas uitbreiden als een meting het vraagt.
- **Stap 5.** Een script dat `ModelIndexDefinities` afloopt met `CONCURRENTLY`, voor registers
  met veel data waar de start niet mag blokkeren.
