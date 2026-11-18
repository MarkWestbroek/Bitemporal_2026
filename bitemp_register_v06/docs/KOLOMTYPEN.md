# Kolomtypen: als het model verandert en de kolom niet

Een register krijgt zijn tabellen uit de MetaRegistry. Bij de start en bij een rebuild doet
`dbsetup` drie dingen met een tabel die al bestaat:

| Situatie | Wat `dbsetup` doet |
|---|---|
| Het model heeft een veld dat de tabel nog niet heeft | de kolom toevoegen (`ensureNieuweKolommen`) |
| De tabel heeft een kolom die het model niet meer kent | laten staan; `NOT NULL` eraf (`ensureVervallenKolommenNullable`) |
| Een kolom heeft een ander type dan het model | **niets omzetten, wel melden** (`meldKolomtypeAfwijkingen`, sinds 18-11-2026) |

Dit document gaat over de derde regel.

## Wat er misgaat

Verandert een veld in het model van tekst naar tijdstip, ja/nee of getal, dan blijft de
tekstkolom staan onder code die een ander type verwacht.

- Lezen en schrijven gaan meestal nog goed, doordat PostgreSQL en bun omzetten. Daardoor valt
  het niet op.
- De waarden staan als tekst opgeslagen. Vergelijken, sorteren en filteren werken dan op tekst
  (`"10"` komt vóór `"9"`), en een index op zo'n kolom is een index op tekst.
- Nieuwe waarden kunnen in een andere tekstvorm landen dan de oude. Een tijdstip dat eerst als
  `2026-11-05T00:14:51Z` is ingevoerd, wordt na de typewijziging als `2026-11-08 14:40:33+00:00`
  weggeschreven (gezien op cg-test, 18-11). Als tekst sorteert de tweede vorm vóór de eerste,
  ook als het moment later is.

Gevonden op cg-test (FUNDAMENT, 18-11-2026): vijf kolommen in de domeinen inrichting en parkeren
waren `varchar`, terwijl het model uit het Studio-project `time.Time`, `*bool` en `*int` zegt.

## De melding

Bij elke start staat er per afwijkende kolom één regel in het logboek:

```
[dbsetup] LET OP: kolom uitrol_uitrolverloop_data.gestart_op is varchar in de database, het model
verwacht timestamptz; omzetten: ALTER TABLE "uitrol_uitrolverloop_data" ALTER COLUMN "gestart_op"
TYPE timestamptz USING "gestart_op"::timestamptz
```

- De controle vergelijkt het type dat bun voor het veld zou aanmaken met `udt_name` uit
  `information_schema.columns`, teruggebracht tot één naam per soort (`varchar` en `text` zijn
  hetzelfde, `timestamptz` en `timestamp` niet).
- Een type dat de controle niet kent (een array, een eigen enum) wordt niet vergeleken, zodat
  het geen valse melding geeft.
- Vervallen kolommen en nog ontbrekende kolommen tellen niet mee.
- De start gaat altijd door. Mislukt de controle zelf, dan staat er een waarschuwing.
- Op een verse database van alle domeinen in deze repo geeft de controle geen enkele melding.

## Omzetten

De melding geeft het statement. Omzetten is een bewuste handeling van de beheerder, niet iets
dat de start doet, om drie redenen:

- een waarde die niet past (lege tekst, `ja` in plaats van `true`) laat de omzetting falen;
- `ALTER COLUMN TYPE` herschrijft de tabel onder een exclusief slot;
- de andere kant op (van tijdstip naar tekst) is niet altijd zonder verlies.

Werkwijze, in lijn met `CLAUDE.md` (SQL in één transactie, controles vooraf en achteraf):

1. Vooraf: de kolom bestaat en is tekst; elke gevulde waarde past in het doeltype.
2. Omzetten met `USING <kolom>::<type>`.
3. Achteraf: evenveel gevulde waarden, dezelfde waarden, het verwachte type.

De formele historie (`registratie`, `wijziging`) verandert niet: alleen de opslagvorm van de
waarde wordt anders, niet wanneer of door welke registratie hij is vastgelegd.

Voorbeeld: `docs/migraties/2026-11-18-cg-test-kolomtypen.sql` zet zes kolommen van cg-test om
(versie 2: vijf uit de eerste opgave plus één die de controle bij de start van api 0.28.0 meldde).
De eerste versie brak op het cluster af op haar eigen controle vooraf: 14 tijdstippen hadden de
vorm `2026-11-08 14:40:33+00:00`. Dat bevestigt wat hierboven staat: de API schreef een
`time.Time` in een andere tekstvorm naar de tekstkolom dan de oudere rijen hadden. Het is getest op nagebouwde tabellen met dezelfde kolommen en aantallen (58 en 392 rijen):
een goede run, een tweede run op al omgezette kolommen (breekt af) en een run met één waarde die
niet past (breekt af, niets gewijzigd). Het is niet op het cluster gedraaid.

## Verwant: de kolomnaam van datumvelden

Een veld van type `Date` krijgt een kolom met de veldnaam zoals hij in JSON staat
(`"uitgebrachtOp"`), andere velden de snake_case-naam (`uitgebracht_op`). Gaat een veld van tekst
naar datum, dan verandert dus ook de kolomnaam: er komt een nieuwe datumkolom bij en de oude
tekstkolom blijft als vervallen kolom staan. Dat geeft geen melding van deze controle, want de
API gebruikt de nieuwe kolom en die heeft het goede type. Zie BACKLOG §43.

## Verwant: de codegen

Een extern V3-model zonder `goType` waarin `type`/`format` het gegevenstype tegenspreken, geeft
sinds 18-11-2026 een validatiefout in de codegen (`docs/CODEGEN.md` §4). Dat voorkomt dat een
veld ongemerkt als tekst wordt gegenereerd; deze controle vangt wat er al in de database staat.
