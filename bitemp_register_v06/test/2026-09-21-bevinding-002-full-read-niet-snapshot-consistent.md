# Testbevinding 002 — `/full`-read is niet consistent op het formele leesmoment

| Veld | Waarde |
|---|---|
| Datum | 2026-09-21 |
| Gevonden in | loadtest sc 33 (lezen terwijl er geregistreerd wordt), direct na de merge van `main` + `fix/enkelvoudige-hub-afvoer` in `chore/be-code-review` |
| Test | `TestLoadNpLoc` ([regressie_load_test.go](../regressie_load_test.go)), `LOAD_SCENARIO=33`, standaardinstellingen (1 schrijver, 12 lezers, kleine seed) |
| Ernst | **Hoog.** De opgeslagen data is correct, maar een lezer kan een antwoord krijgen dat op géén enkel moment de werkelijke toestand van het register was. Voor een bitemporeel register is "wat gold er op het moment van lezen" de kern van de belofte |
| Status | **Open, geparkeerd tot na de merge van `chore/be-code-review` naar `main`** (besluit Mark, 2026-09-21). Oorzaak vastgesteld, richting gekozen, nog niet gebouwd |
| Gemeld door | Claude-sessie (BE-review, 2026-09-21) |

## Waarneming

Ongeveer 1% van de `GET /full/natuurlijk_personen/{id}`-requests faalt op de verwachting
"er is een actieve naam met actieve data", uitsluitend terwijl een schrijver op dat moment dezelfde
NP corrigeert:

```
3827 requests · fouten 10 (0,26%) · alle 10 op stap «NP full» (720 requests)
json-pad "namen[afvoer=null].data[afvoer=null].achternaam" niet gevonden
```

Het `namen`-deel van zo'n antwoord:

```json
[{"natuurlijkpersoon_id":5,"rel_id":1,"opvoer":"2026-01-01T10:00:00.00001Z",
  "data":[{"rel_id":1,"versie":1,"achternaam":"Meijer",
           "opvoer":"2026-01-01T10:00:00.00001Z","afvoer":"2026-01-02T00:00:00.000024Z"}]}]
```

De hub (rel 1) staat als **actief** in het antwoord (geen `afvoer`), maar zijn data is al
**afgevoerd**, en de nieuwe hub met de nieuwe naam ontbreekt. Volgens dit antwoord heeft de persoon
op dit moment geen naam. Dat is nooit waar geweest: vóór de correctie gold "Meijer", erna de nieuwe
naam.

## Analyse

- De schrijver doet alles in **één transactie** (`RegistreerCore`): oude hub afvoeren, diens data
  afvoeren, nieuwe hub + data opvoeren. Dat is atomair en correct; na afloop is de invariant
  (precies één actieve hub met één actief data-record) intact. **De data is dus goed.**
- De lezer bouwt `/full` op uit **meerdere losse queries** (entiteit, hubs, data per hub), zonder
  transactie. Postgres draait standaard in `READ COMMITTED`: elke query ziet de stand van het
  moment waarop díe query start. Commit de schrijver tússen de hub-query en de data-query van de
  lezer, dan komen de hubs uit de oude wereld en de data uit de nieuwe. Dit heet een *torn read*
  of leesscheefheid.
- Het is **geen regressie van de merge**. Het lezen is nooit op één moment gefixeerd geweest. Het
  bleef onzichtbaar omdat vóór `fix/enkelvoudige-hub-afvoer` de oude data bij "Wijzigen" stil
  actief bleef: de lezer vond dan altijd nog íets actiefs. Nu de engine oude data correct afsluit,
  wordt de scheefheid zichtbaar.
- Het raakt vermoedelijk **alle samengestelde reads**: `/full/{padnaam}` (lijst en detail), de
  publicatieweergave, en GraphQL-queries die hub + data in aparte stappen laden. Alleen
  `/full/natuurlijk_personen/{id}` is gemeten.
- **Ook bij tijdreizen (`?t=`) speelt het**, in mildere vorm: het peilmoment ligt dan vast, maar een
  registratie met een tijdstip vóór `t` die pas tíjdens het lezen commit, kan tussen twee queries
  in beeld komen. Dat kan ook in klokmodus, omdat het tijdstip bij de start van de registratie
  wordt gezet en de registratie pas bij de commit zichtbaar wordt (zie het aandachtspunt verderop).
  De momentopname per opvraging lost ook dit op voor één opvraging.

## Reproductie

1. Suite-editor → *Load & performance* → sc 33 → *Loadtest starten* (standaardinstellingen).
2. Of: `LOAD_SCENARIO=33 go test -tags integration -run '^TestLoadNpLoc$' -v -count=1 .`
3. Verwacht: enkele fouten op «NP full», steeds met een actieve hub waarvan de enige data een
   `afvoer` heeft. Het aantal wisselt per run (timing); op de kleine seed 5 tot 10 van 720.

## Twee dingen die niet door elkaar moeten lopen

Uit het gesprek van 2026-09-21; dit onderscheid bepaalt de oplossing.

- **A. Afgeleide actuele toestand.** Het register schrijft bij elke registratie, correctie en
  ongedaanmaking de actuele toestand weg als afgeleide `opvoer`/`afvoer` in de records. Daardoor is
  "geef de actuele stand" een goedkope query op `afvoer IS NULL`, zonder tijdreislogica. **Dit
  blijft zo.**
- **B. Opvragen op een tijdstip.** Dat is een tijdreisquery, ook als het tijdstip 0,02 s oud is.
  Als élke opvraging een tijdreis wordt, lijdt de performance. **Dat willen we niet.**

De oplossing moet dus de scheefheid wegnemen **zonder** van een actuele opvraging een tijdreis te
maken.

## Gekozen richting: één momentopname per opvraging

Een opvraagtransactie bestaat wel degelijk. Postgres bewaart van elke rij meerdere versies en
bepaalt per query welke versie zichtbaar is. Standaard (`READ COMMITTED`) kiest **elke query** een
eigen momentopname; daar komt de scheefheid vandaan. In een read-only transactie met
isolatieniveau `REPEATABLE READ` kiest Postgres bij de eerste query **één** momentopname en houdt
die vast voor alle volgende queries van die transactie.

```go
tx, err := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
// alle queries van deze ene opvraging via tx; aan het eind tx.Commit() (of Rollback: gelijkwaardig bij read-only)
```

- De queries zelf veranderen **niet**: nog steeds goedkoop, op `afvoer IS NULL` (A blijft intact).
  Ze kijken alleen allemaal naar dezelfde versie van de database.
- Kosten: een `BEGIN` en een `COMMIT` per opvraging. Zo'n transactie blokkeert geen schrijvers,
  wordt zelf nooit geblokkeerd en kan niet op een serialisatiefout stuklopen (dat kan alleen bij
  schrijvende transacties). De momentopname wordt milliseconden vastgehouden.
- Verwachting: geen meetbaar verschil in doorvoer. **Meten, niet aannemen:** sc 32 (alleen lezen)
  en sc 33 (lezen onder schrijflast) vóór en na, op de dikke seed.

### Aanvulling: het antwoord zegt wat er gelezen is

Lees binnen dezelfde momentopname ook het hoogste zichtbare registratie-id
(`SELECT max(id) FROM registratie`) en geef dat mee in het antwoord (header, bv.
`X-Register-Stand: <registratie-id>`, eventueel met het bijbehorende tijdstip). De client weet dan
"dit is de stand tot en met registratie N" en kan die later met een **echte** tijdreis (`?t=N`)
reproduceren. Kost één lichte query; het filteren blijft op de afgeleide velden. Dit is wat er
overblijft van het eerdere idee "elke read een expliciet formeel leesmoment": wel **benoemen**,
niet **erop filteren**.

## Overwogen en afgevallen

| Idee | Waarom niet |
|---|---|
| **Elke read filtert op een expliciet moment t** (eerste voorstel in deze bevinding) | Maakt van elke opvraging een tijdreis (B); precies wat we niet willen. Teruggetrokken |
| **Na het lezen de geldigheden vergelijken met het opvraagmoment; "verdacht dichtbij" → opnieuw opvragen** | Betrapt alleen scheefheid die sporen achterlaat in het resultaat. Is er tussen twee queries iets afgevoerd zónder opvolger, dan geeft de tweede query niets terug en valt er niets te vergelijken. In de synthetische tijdmodus loopt het registratietijdstip niet gelijk met de klok, dus "dichtbij" betekent daar niets. Blijft een vermoeden met herkansing, geen garantie |
| **Bij het lezen in de mutatietabel kijken of er een registratie gaande is; dan wachten, fout geven, of wachten-met-timeout** | Een lopende registratie is voor andere sessies **onzichtbaar tot de commit**; in de tabellen valt dus niet te zien dat er iets gaande is. Het kan alleen via locks, en dan worden het lezers die op schrijvers wachten: kost doorvoer en geeft nieuwe kansen op deadlocks. De rijversies van Postgres bestaan juist om dat te vermijden |
| **Optimistische variant: hoogste registratie-id van deze entiteit vóór en na de opvraging lezen; verschilt het → opnieuw** | Sluitend en zonder locks, dus een bruikbare terugvaloptie. Maar twee extra queries per opvraging en herkansingen onder schrijflast, waar de transactie nul extra queries kost |
| **De verwachting in sc 32 versoepelen** | Dan verdwijnt de melding, niet het probleem |

## Aandachtspunt bij tijdreizen dicht bij nu (hoort bij B, niet bij deze fix)

In klokmodus wordt het registratietijdstip aan het **begin** van de registratie gezet, maar de
registratie wordt pas zichtbaar bij de **commit**. Een tijdreis naar een moment van een fractie
geleden kan daardoor later een ander antwoord geven: een trage registratie met een eerder tijdstip
moest nog committen. Het gevoel dat "heel dicht tegen nu" verdacht is, klopt dus, maar geldt voor
**tijdreizen**, niet voor de actuele opvraging. Mogelijke regels voor later: tijdreizen naar
`t > nu − marge` weigeren of markeren als voorlopig; of het tijdstip pas vlak vóór de commit
zetten. Apart beoordelen; niet nodig om bevinding 002 te sluiten.

## Plan van aanpak (na de merge)

1. **Inventariseren** welke handlers een samengesteld antwoord uit meerdere queries opbouwen:
   `/full/{padnaam}` (detail en lijst, `handlers/full_handlers.go`: 7 `Relation()`-ladingen plus de
   formele-tijdcache), de publicatieweergave, GraphQL-queries (`dynql/query_resolvers.go`), en
   enkelvoudige reads die daarna nog iets bijladen.
2. **Eén helper**, bv. `metLeesMomentopname(ctx, db, func(tx bun.Tx) error)`, die de transactie
   opent, het registratie-id van de stand leest en afsluit. Handlers geven `tx` door in plaats van
   `db` (`bun.IDB` dekt beide, dus de queryfuncties hoeven nauwelijks te veranderen).
3. **Header** `X-Register-Stand` zetten vanuit die helper.
4. **Gerichte test** die de scheefheid afdwingt: tussen twee queries van één opvraging een commit
   laten plaatsvinden (haak in de helper of een tweede verbinding in de test) en borgen dat het
   antwoord volledig oud óf volledig nieuw is.
5. **Meten** met sc 32 en sc 33 op de dikke seed, vóór en na; resultaten in
   `docs/REGRESSIETEST.md` (referentiecijfers).
6. Let op de **connectiepool** (bevinding 001): een opvraging houdt één verbinding vast voor de
   duur van de read. Dat is nu feitelijk ook zo, maar controleer sc 33 met 100 lezers.

## Acceptatiecriteria na fix

- Sc 33 met standaardinstellingen: **0 fouten** op «NP full», in ten minste 10 opeenvolgende runs.
- Zelfde met meerdere schrijvers op de dikke seed (`npTot=2000`, 6 schrijvers, 16 lezers).
- De gerichte test uit stap 4 slaagt, en faalt aantoonbaar zonder de transactie.
- Geen meetbare terugval in de lees-p95 van sc 32 (referentie: ~23 ms op 2000 NP's, ~2100 req/s).
- De queries filteren nog steeds op de afgeleide velden; er is geen tijdreislogica in het actuele
  leespad bijgekomen (A blijft intact).
- Het antwoord noemt de stand (registratie-id), en een tijdreis naar die stand geeft hetzelfde
  antwoord.
- De inventarisatie uit stap 1 is vastgelegd, met per read of hij is aangepast.

## Verwant

- `test/2026-09-18-bevinding-001-…` (connectiepool): één verbinding per read-transactie telt mee
  in `DB_MAX_OPEN_CONNS`.
- `docs/plans/2026-09-21 Merge-notitie — …` §3D: de fix die dit zichtbaar maakte.
- Nog open uit dezelfde sessie: de hub-guard (`controleerBovenliggendeHubActief`) geeft `500` bij
  opvoer onder een niet-actieve hub; hoort `409` of `422` te zijn (zie `handlers/db_conflict.go`
  voor het patroon).
