# CEL-evaluatie in de frontend (JavaScript)

## Aanleiding

Bij het gebruik van afgeleide velden in de v06-frontend kwam de vraag op of het verstandig zou zijn om in de browser een **volledige CEL-evaluator** te bouwen of in te bouwen, in plaats van de huidige **zelfgebouwde subset-evaluator** in `web/vite/src/shared/celEvaluator.js`.

Dit document vat die afweging samen, inclusief een korte marktverkenning naar bestaande JavaScript-libraries.

---

## Korte conclusie

**Ja, er zijn libraries.**

**Ja, we zouden relatief eenvoudig kunnen overstappen op een library.**

Maar voor de huidige use-case in dit project is een volledige CEL-implementatie in de frontend **waarschijnlijk zwaarder dan nodig**. De huidige subset-evaluator past goed bij de MetaRegistry- en schema-gedreven architectuur, is veilig, klein en goed beheersbaar.

De beste koers is daarom nu:

1. **de huidige subset behouden**,
2. **gericht uitbreiden** als er echt nieuwe expressiebehoeften ontstaan,
3. en pas bij duidelijk complexere afleidingsregels een overstap naar een externe library overwegen.

---

## Huidige situatie in v06

De frontend gebruikt momenteel een compacte evaluator in:

- `web/vite/src/shared/celEvaluator.js`

Deze evaluator ondersteunt bewust alleen de CEL-subset die we nu nodig hebben voor afgeleide velden en weergaven, zoals:

- string-, number-, bool- en `null`-literals
- directe veldreferenties, zoals `bsn`
- geneste padreferenties, zoals `Naam.roepnaam`
- operators zoals `+`, `==`, `!=`, `&&`, `||`, `!`
- de ternary-operator `cond ? a : b`
- haakjes voor groepering

Belangrijk is ook dat deze evaluator **geen `eval()`** en **geen `Function()`** gebruikt. Hij werkt met een **eigen tokenizer + recursive-descent parser**, en is daarmee expliciet veiliger en voorspelbaarder dan een “string naar JavaScript” aanpak.

Op 2026-04-04 is lokaal gecontroleerd dat deze file ongeveer **14.118 bytes** groot is als bronbestand. Dat is functioneel erg compact voor wat hij doet.

---

## Hoe moeilijk is een volledige CEL-evaluator zelf bouwen?

### Het korte antwoord

**Een parser bouwen is nog wel te doen; een goede CEL-implementatie bouwen is aanzienlijk moeilijker.**

### Waarom dat zo is

Wat “volledig” betekent bij CEL is meer dan alleen wat extra operators toevoegen. Een complete of bijna-complete evaluator moet onder andere goed omgaan met:

- correcte operator-precedentie
- short-circuiting van `&&` en `||`
- `null`-gedrag en truthiness
- lijst- en map-literals
- indexering (`foo["bar"]`)
- membership (`in`)
- ingebouwde functies en macros, zoals:
  - `has(...)`
  - `size(...)`
  - `all(...)`
  - `exists(...)`
  - `exists_one(...)`
  - `filter(...)`
  - `map(...)`
- nette foutmeldingen en syntaxvalidatie
- gedrag dat zoveel mogelijk overeenkomt met de CEL-specificatie en/of backend-implementaties zoals `cel-go`

De **echte moeilijkheid zit dus niet vooral in de parser**, maar in de **semantiek en compatibiliteit**:

- wanneer is iets `null`?
- wat doe je met ontbrekende velden?
- hoe streng is typevergelijking?
- hoe wil je foutmeldingen tonen in de UI?
- hoe voorkom je subtiele verschillen tussen frontend- en backend-evaluatie?

### Praktische inschatting

Voor dit project zou ik de moeite ongeveer zo inschatten:

| Optie | Moeilijkheid | Indicatie |
|---|---:|---|
| Kleine subset uitbreiden | laag | minuten tot enkele uren per operator/feature |
| Vrij complete eigen evaluator | middel/hoog | meerdere dagen tot ruim een week |
| Bestaande library integreren | laag/middel | eerder enkele uren dan dagen |

Met andere woorden: **een volledige eigen evaluator is geen “middagje werk”** als je hem degelijk wilt maken.

---

## Zijn daar libraries voor?

Ja. Er zijn meerdere JavaScript/TypeScript-libraries die CEL of CEL-achtige evaluatie aanbieden.

Op 2026-04-04 zijn onder meer de volgende packages bekeken:

| Library | Opmerking | Bundlephobia min+gzip | Dependencies |
|---|---|---:|---:|
| `cel-js` | vrij complete featurelijst, o.a. macros en custom functions | **41.1 kB** | 2 |
| `@marcbachmann/cel-js` | lightweight, zero dependencies | **24.1 kB** | 0 |
| `@bufbuild/cel` | evaluator uit het Buf-ecosysteem | **23.8 kB** | 1 |

### Opvallend bij `cel-js`

Volgens de package-informatie ondersteunt `cel-js` onder andere:

- bool, string, int, double, list, map, `null`
- `&&`, `||`, `!`
- `==`, `!=`, `<`, `<=`, `>`, `>=`, `in`
- dot- en index-notation
- macros zoals `has`, `size`, `all`, `exists`, `filter`, `map`
- custom functions

Dat is dus beduidend rijker dan onze huidige subset.

---

## Voordelen van een library

Een externe CEL-library heeft duidelijke voordelen:

### 1. Meer spec-coverage
Je krijgt in één keer veel meer CEL-functionaliteit dan wij nu zelf ondersteunen.

### 2. Minder eigen parserlogica
Je hoeft minder zelf te onderhouden op het niveau van tokenizing, parsing en evaluatie.

### 3. Meer voorspelbaarheid voor geavanceerde expressies
Als gebruikers of codegen straks complexere regels gaan maken, is een library daar vaak beter op voorbereid.

### 4. Mogelijke syntaxvalidatie en hergebruik
Sommige libraries bieden parse-resultaten of AST-hergebruik, wat nuttig kan zijn als we later expressies willen valideren of cachen.

---

## Nadelen ten opzichte van onze huidige subset-evaluator

Daar staan wel een paar wezenlijke nadelen tegenover.

### 1. Grotere bundle
Onze huidige evaluator is klein en doelgericht. Een library van **24–41 kB gzip** is voor deze use-case relatief fors.

Dat is niet onoverkomelijk, maar wel een echte afweging in een frontend die verder vooral metadata en visualisaties toont.

### 2. Meer functionaliteit dan we nu nodig hebben
Voor afgeleide weergaven gebruiken we nu vooral simpele regels zoals:

```cel
bsn + (ingezetene ? " ingezetene" : "")
```

Daar is een volledige CEL-engine eigenlijk **overkill** voor.

### 3. Context-mapping blijft toch project-specifiek
Ook met een library moeten wij nog steeds zelf de brug bouwen tussen onze frontend-data en de evaluator-context, bijvoorbeeld:

- platgeslagen GE-items
- klassenaam-aliassen
- MetaRegistry-gedreven typenamen
- hub/data-subtype-specifieke variabelen

Met andere woorden: een library lost de **parser/evaluator** op, maar niet de **integratie met onze architectuur**.

### 4. Minder controle over gedrag en foutmeldingen
Onze eigen evaluator doet precies wat wij willen, op de manier die bij onze UI past. Een library kan andere keuzes maken in:

- null-handling
- foutmeldingen
- permissiviteit/strictheid
- afwijkingen ten opzichte van `cel-go`

Dat hoeft geen probleem te zijn, maar het is wel iets dat je in de praktijk vaak moet afstemmen.

### 5. Extra dependency-risico
Elke dependency brengt risico mee:

- onderhoud stopt
- breaking changes
- security advisories
- onverwachte incompatibiliteiten met Vite/build tooling

Dat risico is klein, maar niet nul.

---

## Specifiek voor dit project: waarom de subset nu goed past

De v06-frontend is nadrukkelijk **MetaRegistry-gedreven** en **schema-gedreven**. Afleidingsregels zijn hierin vooral bedoeld voor:

- compacte weergaveteksten
- eenvoudige conditionele labels
- lichte afleiding op bestaande velden

Dat zijn precies de gevallen waarin een kleine, veilige subset-evaluator sterk is:

- eenvoudig te begrijpen
- eenvoudig te debuggen
- makkelijk gericht uit te breiden
- weinig runtime-overhead
- geen zware afhankelijkheid nodig

De recente uitbreiding met booleans en logische operators laat ook zien dat we de subset **goed incrementeel kunnen laten meegroeien**.

---

## Wanneer een library wél logisch wordt

Een overstap naar een volwaardige library wordt interessanter als we structureel één of meer van de volgende dingen willen:

- lijst- en map-operaties in afleidingsregels
- expressies met `has`, `size`, `exists`, `filter`, `map`, `all`
- meer geavanceerde validatieregels in de frontend
- user-authored expressies met veel variatie
- nauwere functionele aansluiting op CEL-gedrag elders in het ecosysteem

Pas als dat echt de kant wordt waar het model en de editor naartoe groeien, is een library waarschijnlijk de betere investering.

---

## Aanbevolen koers

### Korte termijn
Blijf bij de huidige evaluator in `celEvaluator.js` en breid die alleen uit waar het project daar direct baat bij heeft.

### Middellange termijn
Als het aantal CEL-features merkbaar groeit, maak dan een korte proof of concept met bijvoorbeeld:

- `@marcbachmann/cel-js` als lichte kandidaat
- of `cel-js` als kandidaat met bredere featuredekking

### Lange termijn
Als afleidingsregels bedrijfskritisch of erg complex worden, is het zelfs te overwegen om afleiding meer **backend-first** te maken, zodat frontend en backend niet elk hun eigen interpretatie van dezelfde regel hoeven te onderhouden.

---

## Eindoordeel

Voor de huidige v06-situatie is de bestaande aanpak **verdedigbaar en verstandig**:

- **veilig**
- **klein**
- **goed genoeg voor de huidige afleidingsregels**
- **makkelijk incrementeel uit te breiden**

Een volledige CEL-library is dus zeker mogelijk, maar op dit moment vooral interessant als de expressies duidelijk ambitieuzer worden dan de huidige weergave- en labelregels.

---

## Wijzigingshistorie

### 2026-05-12 — Lijstoperaties, lambda-scoping en `berekenWeergaveveld`

De evaluator is uitgebreid met:

**Tokenizer**
- Nieuwe token-types: `>=`, `<=`, `>`, `<`, `[`, `]`, `,`

**Parser**
- `parsePostfix`-lus voor method-calls en veldtoegang: `.field`, `.method(args)`, `[key]`
- Lambda-argumenten: `filter(x, pred)` syntax

**Evaluate**
- `index`: array-indexering (`list[n]`)
- `methodcall`: `filter(var, pred)`, `map(var, expr)`, `exists(var, pred)`, `all(var, pred)`, `size()` op array/string
- `gt` / `gte` / `lt` / `lte`: numerieke en string-vergelijkingen
- Lambda-scoping: `innerCtx = { ...ctx, [node.varName]: item }` per iteratie-element
- Case-insensitive identifier-lookup: `leesWaardeCaseOngevoelig(bron, sleutel)`

**`bouwCelContext` uitbreiding**
Naast enkelvoudige toegang via `ctx[klassenaam] = actiefItem` worden nu ook meervoudige GE-lijsten beschikbaar gesteld via `ctx[group.rolnaam] = actiefItems[]`. Hierdoor werken expressies als:
```cel
Trefwoordtaalvarianten.filter(t, t.taal == "nl")[0].woord
```

**`berekenWeergaveveld` — geëxporteerde gedeelde utility**
De functie `berekenWeergaveveld(entity, typeMeta, typeMetaByTypenaam)` is verplaatst van een lokale definitie in `RepresentatieTabel.jsx` naar een geëxporteerde functie in `celEvaluator.js`. Hierdoor is de functie herbruikbaar in:

- `RepresentatieTabel.jsx` — weergave-kolom in de lijst
- `NieuwEntiteitPagina.jsx` — labels in de secondaire-entiteit dropdown (nieuw formulier)
- `IndexSchemaPage.jsx` — labels in de secondaire-entiteit dropdown (index / tijdlijn-pagina)

**Secondaire-entiteit dropdown met weergavelabels**
De `secondaireInfo`-structuur is uitgebreid met een `labels`-map (`{ id: weergave }`):
- `NieuwEntiteitPagina.jsx`: switcht van flat endpoint naar `/full/{padnaam}` om nested GE-data op te halen voor label-berekening
- `IndexSchemaPage.jsx`: doet na de secondaire-ids fetch een extra `/full/`-fetch als het doeltype weergavevelden heeft
- `ActionFormParts.jsx`: toont `${label} (${id})` als label beschikbaar is, anders alleen `id`

Betrokken bestanden: `celEvaluator.js`, `RepresentatieTabel.jsx`, `NieuwEntiteitPagina.jsx`, `IndexSchemaPage.jsx`, `ActionFormParts.jsx`, `RegistratieActieBox.jsx`, `RepresentatieActieBox.jsx`
