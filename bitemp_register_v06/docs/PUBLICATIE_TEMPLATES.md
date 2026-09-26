# Detail-templates van de publicatiepagina

Naslag voor het `template_tekst`-veld van een **WeergaveDefinitie** (GE `DetailTemplate`). Het
template bepaalt de detailpagina van één entiteit in `publicatie.html#/t/<type>/<id>`.

Code: `web/vite/src/publicatie/PublicatieDetail.jsx` (renderen, Markdown),
`web/vite/src/publicatie/publicatieUtils.js` (veldpaden, filters, voorwaarden, GraphQL-query) en
`web/vite/src/publicatie/graphqlPaden.js` (paden afstemmen op het schema).
Tests: `node --test src/publicatie/publicatieUtils.test.js src/publicatie/graphqlPaden.test.js`.

## Hoe het werkt

1. De paden in het template worden afgestemd op het GraphQL-schema (zie onder).
2. De pagina leest alle veldpaden uit het template (`extractVeldpaden`) en bouwt daaruit **één
   GraphQL-query** (`buildGraphQLQuery`). Alleen wat in het template staat, wordt opgehaald.
3. Eerst worden de **voorwaardelijke blokken** verwerkt (`verwerkVoorwaarden`), daarna de
   **placeholders** ingevuld.
4. Het resultaat is Markdown en wordt omgezet naar HTML (een eigen, beperkte omzetter, zie onder).

Zonder detail-template valt de pagina terug op REST (`/full/<type>/<id>`) en toont alle velden.

## Placeholders: `{{veldpad}}`

| Vorm | Betekenis |
|---|---|
| `{{producten.naam}}` | veld `naam` van het (actuele) GE `producten` |
| `{{producten.data.naam}}` | hetzelfde; `data` wordt overgeslagen (GraphQL voegt hub en data samen) |
| `{{initiatief_domeinen.weergavenaam}}` | meervoudig: alle waarden, gescheiden door `, ` |
| `{{initiatief_organisaties.organisatie.organisatienamen.naam}}` | door relaties heen navigeren |
| `{{initiatief_gemeenten[rol=Realiseert].weergavenaam}}` | eerst filteren op `rol`, dan navigeren |

- Een leeg of ontbrekend veld wordt een lege tekst.
- Een `|` in een waarde wordt geëscaped, zodat Markdown-tabellen heel blijven.
- **Filter `[veld=waarde]`**: vergelijkt exact, óf na omzetting naar enum-naam. `[rol=Maakt gebruik van]`
  en `[rol=Maakt_gebruik_van]` zijn dus gelijk (`filterWaardeGelijk`). Gebruik bij voorkeur de echte
  waarde. Zie `graphql-enum-handling.md`.

## Paden worden afgestemd op het GraphQL-schema

GraphQL kent **veldnamen**, geen klassenamen, en vraagt elke stap expliciet. Het juiste pad naar de
naam van een gekoppelde gemeente is dus:

```
{{initiatief_gemeenten[rol=Realiseert].gemeente.gemeentegegevens.naam}}
```

Omdat template-auteurs vaak denken zoals in de CEL-expressie van een weergavenaam
(`GemeenteGegevens.naam`), legt de pagina elk pad eerst naast het schema
(`graphqlPaden.js`, `normaliseerTemplatePaden`; schema via introspectie, één keer per bezoek).
Per segment:

1. exacte veldnaam, of dezelfde naam met andere hoofdletters (`Producten` → `producten`);
2. **klassenaam van een GE** → het veld van dat type (`GemeenteGegevens` → `gemeentegegevens`,
   `Organisatienaam` → `organisatienamen`);
3. **één overgeslagen stap** wordt ingevoegd als die eenduidig is:
   `initiatief_gemeenten.GemeenteGegevens.naam` → `….gemeente.gemeentegegevens.naam`, en
   `….gemeente.naam` → `….gemeente.gemeentegegevens.naam`. `aanvang`, `einde`, `data` en
   `gerelateerde_*` tellen niet mee. Bij meer dan één kandidaat (bv. `organisatie.naam`: zowel
   `organisatienamen` als `organisatiecontactgegevens` hebben `naam`) wordt niet geraden.

Een pad dat niet bestaat, wordt **leeg** (in een voorwaarde: onwaar) en staat als waarschuwing in de
browserconsole. Vroeger liet één onbekend veld de hele GraphQL-query mislukken, en dan bleef de hele
detailpagina leeg.

Tip: schrijf in een template bij voorkeur het volledige pad; dat werkt ook zonder normalisatie.
De GraphiQL-pagina (`/graphql/playground`) toont welke velden er zijn.

## Voorwaardelijke blokken: labels bij lege velden weglaten

```
{{#if veldpad}} … {{/if}}                   alleen als veldpad een waarde heeft
{{#if veldpad}} … {{else}} … {{/if}}        anders het tweede deel
{{#unless veldpad}} … {{/unless}}           alleen als veldpad leeg is
```

"Een waarde hebben" = niet leeg, geen lege lijst, niet `false`. De voorwaarde is een **veldpad** met
dezelfde syntax als een placeholder (filters inbegrepen) en wordt vanzelf in de GraphQL-query
meegenomen. Blokken mogen genest worden en over meerdere regels lopen.

Voorbeeld — één regel per gegeven, alleen als het gegeven er is:

```
{{#if producten.website}}- **Website:** [{{producten.website}}]({{producten.website}})
{{/if}}{{#if producten.git_repo}}- **Git:** [{{producten.git_repo}}]({{producten.git_repo}})
{{/if}}
```

Zet het regeleinde **binnen** het blok (vóór `{{/if}}`); dan laat een weggevallen blok geen lege
regel achter.

**Geen CEL.** De voorwaarde is geen CEL-expressie: vergelijken (`==`), rekenen en `&&`/`||` kan
(nog) niet. Wel te combineren door te nesten (`{{#if a}}{{#if b}}…{{/if}}{{/if}}` = a én b). CEL in
templates vraagt dat de querybouwer de velden uit de expressie haalt; dat is een mogelijke uitbreiding.

## Markdown die werkt

| Markdown | Opmerking |
|---|---|
| `#`, `##`, `###` | koppen |
| `**vet**`, `*cursief*` | |
| `- item` | opsomming (elke regel een `-`) |
| GFM-tabellen | kopregel + `| --- |`-regel; **minstens twee kolommen** |
| `[tekst](url)` | `http(s):`, `mailto:`, `/pad` en **kale domeinen** (`openwoo.app` → `https://openwoo.app`, `normaliseerLink`); andere URL's blijven platte tekst |
| lege regel | nieuwe alinea |

Let op: een enkel regeleinde wordt alleen een `<br>` tussen gewone tekst; na een link of vóór vette
tekst niet. Gebruik voor losse regels een opsomming.

## Data via opgeslagen documenten (`query` en `detailQuery`)

*Sinds 24 september 2026.* De publicatiepagina haalt haar data standaard via REST op
(`/full/<padnaam>`, alles) en met een ad-hoc GraphQL-query voor het detail. Met twee sleutels in
`tabel_config_json` van de WeergaveDefinitie loopt dat via **opgeslagen documenten**
(QueryDefinitie, `documentId` op `/graphql/query`; zie `docs/dynamische-graphql-laag.md`
§ Uitvoeren op naam):

```json
{ "kolommen": [ … ], "rijenPerPagina": 25,
  "query": "publieke-initiatieven",
  "detailQuery": "publiek-initiatief-detail" }
```

- **`query`** — de lijst. Het document moet `$limit` en `$offset` accepteren en een lijst
  teruggeven; de pagina bladert in stappen van 100 tot een korte pagina en houdt zoeken,
  sorteren en pagineren in de browser zoals voorheen. Het vaste deel van het document bepaalt
  wat er überhaupt te zien is (bij Initiatief: alleen `aanmeldstatus = geaccepteerd`).
- **`detailQuery`** — één record, met `$id`. **De selectie ligt vast in het document**, dus het
  document moet alle paden bevatten die het detail-template gebruikt, inclusief de hops
  (`initiatief_organisaties.organisatie.contactpersonen.persoon.persoonnamen.naam`). Een pad
  dat niet in het document zit blijft leeg. Wijzig je het template, controleer dan het
  document (`POST /graphql/valideer` toetst alleen de syntaxis tegen het schema, niet of alle
  template-paden erin zitten).
- Ontbreekt een sleutel, dan geldt het oude gedrag voor dat deel.

De veldpaden in de kolommen (`producten.data.naam`) blijven werken: GraphQL slaat hub en data
plat, en `resolveVeldpad` (`publicatie/publicatieData.js`) accepteert beide vormen.

Voor Initiatief staan de twee documenten in
`replay files/registraties-replay-init-querydefinitie-publieke-initiatieven.json` en de
verwijzing in `replay files/registraties-replay-correctie-initiatief-tabelconfig-query-2026-09-24.json`.

## Een template wijzigen op een instantie

Een template is data. Wijzig het met een **correctie** op het bestaande `detailtemplate`-GE
(`rel_id` van de actuele hub), niet met een nieuwe WeergaveDefinitie. Voorbeeld:
`replay files/registraties-replay-correctie-initiatief-detailtemplate-2026-09-22.json`.

## Bekende beperkingen (september 2026)

- GraphQL gaf tot 22-09-2026 **alle datum- en tijdvelden als `null`** (datum-scalars kenden geen
  tekst; de resolvers zetten entiteiten via JSON om). Opgelost in `dynql/scalars.go`.
- Enum-waarden kwamen tot 22-09-2026 met underscores (`Laag_5`); zie `graphql-enum-handling.md`.

Zie ook [`FORMULIERDEFINITIES.md`](FORMULIERDEFINITIES.md) voor de invoerkant (FormulierDefinitie, widgets).
