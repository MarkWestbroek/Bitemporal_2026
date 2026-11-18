# Sorteren via de index — ontwerp

Datum: 18-11-2026. Status: **ontwerp, niet gebouwd.** Mark vroeg (18-11) om eerst een ontwerp.
Hoort bij het indexwerk (`docs/INDEXEN.md`) en bij `dynql/sortering.go`.

## Waarom

Een lijst sorteren op een veld van een gegevenselement (GE) is nu traag op een grote tabel. De
meting van FUNDAMENT met het zaakmodel (102.000 zaken, 16 gelijktijdige gebruikers): alle zaken
op startdatum, eerste 50, kost 4,5 seconde; per zaaktype 0,5 seconde.

De oorzaak is de vorm van de query. De sorteerwaarde is een subquery per entiteit:

```sql
SELECT z.* FROM zaak z WHERE <z actief> [AND <filter>]
ORDER BY (SELECT MAX(d.startdatum) FROM zaak_zaaklooptijd h JOIN zaak_zaaklooptijd_data d ON …
          WHERE h.zaak_id = z.id AND <h actief> AND <d actief>) DESC NULLS LAST, z.id
LIMIT 50
```

PostgreSQL moet de subquery voor elke entiteit uitrekenen voordat het de eerste 50 kan geven. De
index op `startdatum` (mark `register.sorteerbaar`) helpt daar niet bij.

## Voorstel

Voor het eenvoudige geval begint de query bij de `_Data`-tabel en loopt de index in volgorde af:

```sql
SELECT z.* FROM zaak_zaaklooptijd_data d
JOIN zaak_zaaklooptijd h ON h.zaak_id = d.zaak_id AND h.rel_id = d.rel_id AND <h actief>
JOIN zaak z ON z.id = d.zaak_id AND <z actief>
WHERE <d actief> AND d.startdatum IS NOT NULL [AND <filter op z>]
ORDER BY d.startdatum DESC, z.id
LIMIT 50 OFFSET …
```

PostgreSQL leest dan de index achterstevoren, zoekt per rij de hub en de entiteit op en stopt na
50 treffers. Het filter blijft dezelfde `EXISTS` op de entiteit.

### Wanneer deze vorm

Alleen als alle voorwaarden gelden; anders blijft de huidige vorm:

1. Precies één sorteersleutel (de id volgt altijd als laatste).
2. De sleutel is een veld op de `_Data`-tabel van een GE of relatie die **enkelvoudig** en
   **niet materieel** is. Dan is er per entiteit hooguit één actief record, en is de join gelijk
   aan `MIN`/`MAX`. Een meervoudig GE geeft meerdere rijen per entiteit; een enkelvoudig
   materieel GE kan meerdere formeel actieve voorkomens hebben (opvolging, 27-10-2026).
3. Het veld heeft een index: mark `register.sorteerbaar` of `register.zoeksleutel`, of `uniek`.
   Zonder index wint de nieuwe vorm niets.

### Entiteiten zonder waarde

De huidige regel: een entiteit zonder waarde staat achteraan, in beide richtingen. In de nieuwe
vorm komen die entiteiten niet uit de join. Ze vormen een tweede deel, gesorteerd op id:

```sql
SELECT z.* FROM zaak z WHERE <z actief> [AND <filter>]
AND NOT EXISTS (<actief record met een waarde>) ORDER BY z.id LIMIT … OFFSET …
```

De lader vraagt eerst het eerste deel. Is de pagina daarmee vol, dan is het klaar (het gewone
geval). Zo niet, dan vult hij aan uit het tweede deel; voor de juiste offset is dan één telling
van het eerste deel nodig. `d.startdatum IS NOT NULL` in het eerste deel maakt ook dat
`DESC NULLS LAST` geen probleem is: een gewone index achterstevoren geeft `NULLS FIRST`.

### Geen schemawijziging

De bestaande index `(kolom)` volstaat. De id als tweede sleutel lost PostgreSQL op met een
incrementele sortering binnen gelijke waarden. Een index `(kolom, entiteit_id)` zou die stap
sparen; pas doen als een meting het vraagt.

## Proefmeting

Op een wegwerpdatabase (PostgreSQL 17.5, één gebruiker, nagebouwde tabellen met 102.000 zaken,
2% zonder looptijd, 10% met een oude versie, 20 zaaktypen). Dit is geen meting op het register.

| Vraag | Huidige vorm | Nieuwe vorm |
|---|---|---|
| alle zaken op startdatum, eerste 50 | 351 ms | 0,4 ms |
| idem, tiende pagina (offset 450) | niet gemeten | 1,4 ms |
| zaken van één zaaktype (5%) op startdatum, eerste 50 | 13,7 ms | 3,6 ms |
| één zaak (filter op identificatie) met sortering | 0,06 ms | 0,04 ms |
| tweede deel: zaken zonder looptijd, eerste 50 | n.v.t. | 0,6 ms |

- Bij het zeldzame filter kiest de planner zelf de weg vanaf het filter, in beide vormen.
- Het script staat niet in de repo; de vragen zijn de twee vormen hierboven, uitgeschreven.

## Risico's

- **Verkeerde plankeuze bij een zeldzaam filter met een `LIMIT`.** PostgreSQL kan de index in
  volgorde aflopen terwijl bijna geen rij aan het filter voldoet, en leest dan de hele index. In
  de proef ging het goed. De noodrem `GRAPHQL_KLASSIEK_LADEN=1` zou ook deze vorm uitzetten.
- **Veel oude versies.** De index is niet partieel en bevat ook afgevoerde versies; die worden
  gelezen en weggefilterd. Bij een register met veel historie per record wordt de winst kleiner.
- **Twee vormen voor één functie.** De uitkomst moet gelijk zijn. De test vergelijkt beide
  vormen op dezelfde gegevens, zoals `TestLadenOpSelectie` dat doet voor het laden.

## Bouwstappen

1. `sortering.go`: herken het eenvoudige geval; bouw de query vanaf `_Data` in `dbLader.LaadLijst`.
2. Het tweede deel (zonder waarde) en het aanvullen van de pagina.
3. Test: beide vormen vergelijken (oplopend, aflopend, filter, peiltijdstip, paginering over de
   grens van de twee delen), en een `EXPLAIN` die de indexscan aantoont.
4. Meten op het register met zaken (FUNDAMENT).

Geschat: een halve dag bouwen en testen. Geen schemawijziging, geen rebuild.

## Open vragen voor Mark

- Bouwen na de hermeting van de punten 2 tot en met 4, of meteen?
- Sorteren op een eigen kolom van de entiteit of op een meervoudig GE blijft de oude vorm. Is
  dat voor de loadtest genoeg?
