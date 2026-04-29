# Taal als core-aspect van het register

> Status: **ontwerpvoorstel** — nog niet geïmplementeerd.
> Versie: v0.1 (april 2026)
> Verwante documenten: [materiele_tijd.md](materiele_tijd.md), [ONTWERP_DATA_PATTERN.md](ONTWERP_DATA_PATTERN.md), [docs/common-ground-analyse-meertaligheid-tijdreizen.md](docs/common-ground-analyse-meertaligheid-tijdreizen.md), [afgeleide-velden.md](afgeleide-velden.md).

Dit document beschrijft hoe **taal** als orthogonaal aspect aan de core van het bitemporeel register kan worden toegevoegd, naar analogie van het bestaande `IsMaterieel`-aspect. Het is bedoeld voor een collega-architect of -developer die het ontwerp later moet kunnen begrijpen, beoordelen en implementeren zonder achtergrondkennis van de discussies die eraan voorafgingen.

---

## 1. Probleemstelling

Bij het modelleren van *talige content* (titels, beschrijvingen, omschrijvingen, namen, trefwoorden) staat een ontwerper steeds voor dezelfde vraag:

> Is taal een **eigenschap van data** (een dimensie naast tijd, te behandelen als cross-cutting concern), of is taal een **modelkeuze per register** (uit te werken in een eigen `Taalvariant`-entiteit zoals in het bijbehorende kennis-model)?

Het kennis-model in [docs/Model files (V3)/v0.1.2.4 kennis2 V3.json](docs/Model%20files%20%28V3%29/v0.1.2.4%20kennis2%20V3.json) maakt de tweede keuze: een expliciete `KennisartikelTaalvariant` clustert per taal de titel en de secties. Dat is een geldige keuze, maar het levert herhaalde modelleringspatronen op zodra meertaligheid in meerdere domeinen voorkomt — Land, Plaats, Trefwoord, Sectie, Beschrijving, Toelichting, Foutmelding, enzovoort. Elke keer ontstaat opnieuw een mini-cluster met dezelfde mechaniek (taalcode + content + uniciteit-per-taal), gemodelleerd in het domein in plaats van afgehandeld door het platform.

Dit voorstel bekijkt of taal — net als formele tijd, materiële tijd en (in de toekomst) autorisatie — als **platformaspect** kan worden behandeld dat door de MetaRegistry wordt aangestuurd, codegen wordt afgehandeld en door de generieke handlers/GraphQL-laag automatisch wordt ondersteund.

---

## 2. Achtergrond: drie typen "taligheid"

Voordat we een aspect toevoegen, is het belangrijk drie wezenlijk verschillende vormen van "data + taal" te onderscheiden, want ze vragen om verschillende behandelingen. Deze indeling komt onder meer terug in W3C ITS 2.0, het Wikidata-datamodel (monolingual vs multilingual text) en in het verschil tussen Drupal *field-level translation* en AEM *language copies*.

| Aard | Wat het is | Voorbeeld | Geschikte aanpak |
|---|---|---|---|
| **Vertaling** | Inhoudelijk equivalente content in meerdere talen; één canonieke betekenis. | Artikel-titel "Bitemporeel Register" / "Bitemporal Register". | Taal als dimensie op _Data (`taal`-veld in PK). |
| **Officiële naam** | Per taal een **eigen, gelijkwaardig officieel** rechtsfeit; niet "vertaling" maar parallelle waarheden. | "Leeuwarden" (nl) / "Ljouwert" (fy); "Brussel" (nl) / "Bruxelles" (fr). | Taal als dimensie op _Data, **maar geen fallback** tussen talen — elke waarde staat op zichzelf. |
| **Auteursvariant** | Per taal redactioneel onafhankelijke inhoud met eigen lifecycle, structuur en publicatiestatus. | Een kennisartikel waarvan NL 5 secties heeft, EN 4, en DE nog in review staat. | Domein-modellering met een eigen `Taalvariant`-entiteit. |

**Inzicht**: een platformaspect `IsTalig` lost (1) en (2) elegant op. Voor (3) blijft een expliciete `Taalvariant`-entiteit de juiste keuze, omdat per-taal lifecycle en per-taal structuurverschil niet generiek door een _Data-veld kunnen worden gemodelleerd. Het kennis-diagram is dus geen "tegenvoorbeeld" maar een legitieme aanvullende constructie.

Dit ontwerp richt zich op (1) en (2). Voor (3) verandert er niets: bestaande modellen blijven werken zoals ze zijn.

---

## 3. Patronen uit de praktijk

Ter verantwoording van de keuze: in de wereld bestaan grofweg vier terugkerende patronen voor taligheid in datamodellen.

1. **Translation-table / sidecar** — `(entity_id, lang_code, fields…)`. Drupal `*_field_data`, Django `django-parler`, Rails `globalize`, Laravel `spatie/laravel-translatable`. API-conventie: `Accept-Language` (RFC 9110) of `?lang=nl`.
2. **Language-variant entity** — een eigen domein-object per talige versie, met eigen workflow. AEM Language Copies, Sitecore Language Versions, Strapi locales (entry-level), DITA `xml:lang`.
3. **Field-level locale tag** — de waarde zelf is talig: `{ "@value": "Nederland", "@language": "nl" }`. RDF/SKOS `skos:prefLabel "Nederland"@nl`, JSON-LD `@language`, Wikidata *monolingual text*, schema.org `inLanguage`, CIDOC-CRM `E33_Linguistic_Object`. Dit is de standaard in de linked-data wereld.
4. **Locale als formele dimensie** — taal als eigen as naast tijd, met fallback-keten en formatting. Unicode CLDR/LDML, ICU ResourceBundles.

Het voorstel hieronder combineert (1) en (3): structureel als translation-table-met-PK-extensie (past bij het Hub + _Data-patroon van v06), conceptueel als language-tagged value (de waarde *is* talig, niet "een vertaling").

### Standaarden om aan te haken

| Standaard | Rol |
|---|---|
| **BCP 47 / RFC 5646** | Formaat van de taalcode (`nl`, `nl-BE`, `fy-NL`, `nl-Latn-NL`). |
| **ISO 639-1/2/3** | Onderliggende taalcodes (BCP 47 bouwt hierop). |
| **ISO 3166** | Regio-deel van BCP 47. |
| **Unicode CLDR / LDML** | Locale-data, plural rules, formatting. |
| **W3C ITS 2.0** | Markeren van wat vertaalbaar is en wat niet. |
| **HTTP `Accept-Language` / `Content-Language`** (RFC 9110) | Content negotiation in de API. |
| **SKOS / JSON-LD `@language`** | Conceptueel referentiemodel (waarde + taaltag). |

---

## 4. Kernvoorstel

### 4.1 Een nieuw platformaspect: `IsTalig`

Naar analogie van `IsMaterieel` krijgt `TypeMeta` een nieuw boolean veld `IsTalig`. Wanneer een GE- of relatie-type `IsTalig: true` heeft:

- Krijgt het bijbehorende `_Data`-record een veld `taal` (BCP 47-string, FK naar de centrale `Taal`-referentielijst).
- Wordt `taal` opgenomen in de **PK van _Data**: `(ent_id, rel_id, versie, taal)`.
  > Strikt genomen blijft `versie` autoincrement per `(ent_id, rel_id, taal)`. Zie 5.2.
- Verandert de uniciteits­semantiek: "enkelvoudig op tijdstip *t*" wordt "enkelvoudig op tijdstip *t* **per taal**".
- Wordt de generieke handler/GraphQL/REST automatisch met een taal-parameter en fallback-keten uitgebreid.

`IsTalig` mag op de drie metatypes worden gezet die _Data hebben: `gegevenselement` en `relatie`. Op `entiteit`-niveau heeft het geen plumbing-impact (een entiteit zelf heeft geen content-veld), wel kan het in de UI als hint dienen voor "deze entiteit bevat talige onderliggende GE's".

### 4.2 Een nieuw classificatieveld: `TaligheidsAard`

Om onderscheid (1) vs (2) uit hoofdstuk 2 vast te leggen, krijgt `TypeMeta` een tweede veld:

```go
type TaligheidsAard string

const (
    TaligheidsAardVertaling     TaligheidsAard = "vertaling"      // (1) — content equivalent, fallback toegestaan
    TaligheidsAardOfficieleNaam TaligheidsAard = "officiele_naam" // (2) — gelijkwaardige rechtsfeiten, geen fallback
    // (3) wordt niet via dit aspect gemodelleerd — gebruik een Taalvariant-entiteit.
)
```

Dit veld stuurt het gedrag van de fallback-keten (zie 6.3): voor `vertaling` mag de query terugvallen op een andere taal als de gevraagde taal ontbreekt; voor `officiele_naam` niet — dan retourneert de API ofwel niets ofwel alle officiële namen, afhankelijk van de query.

### 4.3 Wat verandert er aan de hub?

**Niets.** Net als bij materiële tijd blijft de hub het stabiele anker. De taal leeft in `_Data`, omdat een hub-instantie ("dit gegevenselement is gekoppeld aan deze entiteit") zelf taal-onafhankelijk is. Verschillende _Data-versies van dezelfde hub kunnen verschillende talen hebben.

Dit is consistent met het Hub + _Data-patroon: structurele identiteit op de hub, content (incl. taal) op _Data.

---

## 5. Database-structuur

### 5.1 Voorbeeld: Trefwoord wordt talig

In het kennis-model bestaat `Trefwoord` als referentielijst-item, met een GE `Trefwoord` dat `woord` en `taal` als velden heeft. Met `IsTalig: true` op de GE wordt `taal` geen handmatig veld meer, maar plumbing.

**Vóór** (handmatig zoals in het kennis-model):

```sql
CREATE TABLE trefwoord_data (
    ent_id  INTEGER NOT NULL REFERENCES trefwoord(id),
    rel_id  INTEGER NOT NULL,
    versie  SERIAL,
    woord   TEXT,
    taal    TEXT,                     -- handmatig veld
    PRIMARY KEY (ent_id, rel_id, versie)
);
```

**Na** (met `IsTalig: true`):

```sql
CREATE TABLE trefwoord_data (
    ent_id  INTEGER NOT NULL REFERENCES trefwoord(id),
    rel_id  INTEGER NOT NULL,
    versie  INTEGER NOT NULL,         -- autoincrement per (ent_id, rel_id, taal), niet meer SERIAL globaal
    taal    TEXT NOT NULL,            -- platform-veld, BCP 47
    woord   TEXT,
    PRIMARY KEY (ent_id, rel_id, versie, taal)
);
CREATE INDEX trefwoord_data_taal_idx ON trefwoord_data (taal);
```

Equivalent voor materiële plumbing: als een talig type óók materieel is, zit de aanvang/einde nog steeds op de **hub**, niet op _Data. De materiële tijdlijn is taal-onafhankelijk. Een plaatsnaam "Leeuwarden"/"Ljouwert" geldt over dezelfde materiële periode; alleen de waarden verschillen per taal.

### 5.2 Versie-autoincrement

Bij niet-talige _Data is `versie` een relatieve autoincrement binnen `(ent_id, rel_id)`. Bij talige _Data wordt dit **per taal**: een nieuwe `nl`-versie krijgt een onafhankelijke nummering van de `en`-versies. Dit voorkomt "gaten" in de versie-reeks per taal en sluit aan bij de mentale model dat elke taal zijn eigen geschiedenis heeft.

Concreet: na `(1, 1, v=1, nl)`, `(1, 1, v=2, nl)`, `(1, 1, v=1, en)` is de eerstvolgende `nl`-correctie `v=3`, en de eerstvolgende `en`-correctie `v=2`.

### 5.3 De `Taal`-referentielijst

Er komt één centrale referentielijst-entiteit `Taal` in een platform-domein (bijv. `register_taal`). Deze bevat:

| Veld | Type | Toelichting |
|---|---|---|
| `code` | `string` (BCP 47) | PK / business key, bijv. `nl`, `nl-BE`, `fy-NL`. |
| `iso_639_1` | `string` | Tweeletter-code waar van toepassing. |
| `iso_639_3` | `string` | Drieletter-code (volledig dekkend). |
| `endoniem` | `IsTalig: true` GE | Hoe de taal zichzelf noemt: `Nederlands`@nl, `English`@en, `Frysk`@fy. *Recursief talig — de referentielijst gebruikt het aspect zelf!* |
| `exoniem` | `IsTalig: true` GE | Naam in andere talen. |
| `richting` | enum `ltr`/`rtl` | Voor frontend-rendering. |

De recursie (de `Taal`-referentielijst gebruikt zelf `IsTalig`) is een goede stresstest voor het ontwerp en sluit aan bij hoe Wikidata, CLDR en SKOS dit modelleren.

---

## 6. Semantiek: uniciteit, fallback, tijdreizen

### 6.1 Uniciteit

| Multipliciteit (UML) | Niet-talig | Talig |
|---|---|---|
| `enkelvoudig` | Maximaal één actuele _Data-versie per `(ent_id, rel_id)` op tijdstip *t*. | Maximaal één actuele _Data-versie per `(ent_id, rel_id, taal)` op tijdstip *t*. |
| `meervoudig` | Meerdere actuele _Data-versies toegestaan per `(ent_id, rel_id)` op *t*. | Meerdere per `(ent_id, rel_id, taal)`; talen zijn altijd onafhankelijk. |

De afvoer-bij-opvoer-logica (zie [materiele_tijd.md](materiele_tijd.md) §2.1) wordt parametrisch over de taal: bij opvoer van een nieuwe `nl`-versie van een enkelvoudig talig GE wordt alleen de vorige `nl`-versie afgevoerd, niet `en` of `de`.

### 6.2 Materiële + talige interactie

Een GE kan tegelijk materieel en talig zijn (`IsMaterieel: true, IsTalig: true`). De plumbing blijft gescheiden:

- **Materieel** zit op de **hub** (`_Aanvang`, `_Einde`).
- **Talig** zit op **_Data** (`taal`-veld in PK).

Dit is bewuste asymmetrie: materialiteit is een eigenschap van de associatie (de koppeling geldt vanaf… tot…), taligheid is een eigenschap van de inhoud (deze versie spreekt taal X). Een talige correctie raakt de materiële tijdlijn niet, en omgekeerd. Dit voorkomt dat een vertaalslag de materiële geldigheid herstart.

### 6.3 Fallback-keten

Per request is er een **gevraagde taal** (uit `Accept-Language`, `?lang=`, of GraphQL-argument) en een **fallback-keten**. De server bepaalt de keten als:

```
[gevraagde_taal, …gevraagde_taal_zonder_regio, …register_default, …platform_default("*")]
```

Voorbeeld: `Accept-Language: nl-BE, en;q=0.8` op een register met default `nl` levert keten `[nl-BE, nl, en, nl, *]` (gededupliceerd: `[nl-BE, nl, en, *]`).

**Belangrijk**:

- Voor `TaligheidsAard = vertaling` past de query de keten toe en retourneert de eerste match.
- Voor `TaligheidsAard = officiele_naam` is de keten **niet** van toepassing. Dan zijn er twee modi:
  - `?lang=fy-NL&strict=true` → alleen records met die taal, of leeg.
  - `?lang=*` of geen `lang` → alle officiële namen worden geretourneerd (een lijst, geen scalair).

De `*`-waarde aan het eind van de keten is een wildcard: een record met `taal = NULL` (of de literal `*`) geldt voor alle talen. Dit is bruikbaar voor talen-onafhankelijke waarden in een overigens talige _Data (bijv. een numeriek of code-veld dat samen met talige content in dezelfde _Data zit). Aanbeveling: vermijd dit door `IsTalig: true` alleen toe te kennen aan _Data's die *daadwerkelijk* talige inhoud bevatten — als er gemengde velden zijn, splits de GE.

### 6.4 Tijdreizen × taal

Het register kent al twee assen (formele tijd `t_f`, materiële tijd `t_m`); taal wordt de **derde dimensie**. Volgorde van toepassen in queries (vastgelegd in handler en GraphQL-resolver):

1. **Formele snapshot** op `t_f` — bepaal welke wijzigingen tot `t_f` zijn doorgevoerd, leid daaruit `opvoer`/`afvoer` af.
2. **Materiële filter** op `t_m` — selecteer hub-instanties waarvan `aanvang ≤ t_m ≤ einde` (waar van toepassing).
3. **Taal-filter** op `lang` — pas de fallback-keten toe op de overlevende _Data-records.

Deze volgorde is essentieel: een talige fallback mag nooit een formeel/materieel zicht overschrijden. De API documenteert dit expliciet.

---

## 7. Impact op MetaRegistry

Toevoegingen aan `TypeMeta` in `model/metaregistry_plumbing.go`:

```go
type TypeMeta struct {
    // ... bestaande velden ...

    IsMaterieel     bool           // bestaand
    IsTalig         bool           // NIEUW: schakelt taal-plumbing in op _Data
    TaligheidsAard  TaligheidsAard // NIEUW: vertaling | officiele_naam
    TalenVeld       string         // NIEUW (optioneel): kolomnaam, default "taal"
}
```

Per register komt er een configuratie-entry:

```go
type RegisterTaalConfiguratie struct {
    DefaultTaal       string   // bijv. "nl"
    ToegestaneTalen   []string // bijv. ["nl", "en", "fy-NL"] — leeg = alles toegestaan
    FallbackKeten     []string // optionele override van de standaardketen
}
```

Deze configuratie hangt onder het `configuratie`-domein en wordt door handlers/GraphQL geconsulteerd.

### Helpers

```go
// GetTaal pakt de gevraagde taal uit Gin-context (querystring, header, default).
func GetTaal(c *gin.Context, meta TypeMeta) string

// FallbackKeten bouwt de keten op basis van request + register-config.
func FallbackKeten(gevraagd string, cfg RegisterTaalConfiguratie) []string

// SelecteerTaligData past de fallback toe op een lijst _Data-records.
func SelecteerTaligData[T HeeftTaal](records []T, keten []string, aard TaligheidsAard) []T
```

`HeeftTaal` is een interface die door codegen wordt geïmplementeerd op talige _Data-types:

```go
type HeeftTaal interface {
    GetTaal() string
    SetTaal(string)
}
```

---

## 8. Impact op codegen

In `cmd/codegen/`:

1. **V3-formaat uitbreiden** (`model/v3_format.go`):
   - `V3Entiteit`/`V3GE`/`V3Relatie` krijgen `IsTalig bool` en `TaligheidsAard string`.
   - `V3Veld` krijgt `Vertaalbaar bool` (default `true` als parent `IsTalig`); dit is voor de toekomstige fijnere granulariteit (ITS 2.0-stijl) maar wordt initieel niet gebruikt.
2. **Generatie**:
   - Voor elk `IsTalig: true` GE/REL voegt codegen een `taal` veld toe aan de gegenereerde `_Data`-struct (Go-tag `json:"taal" bun:"taal,pk"`).
   - De PK-comment in `dbsetup` wordt uitgebreid met `, taal`.
   - De `GetTaal()`/`SetTaal()`-methoden worden gegenereerd op `_Data`-types (in `*_modellen_methods.go`).
   - Het `MetaRegistry`-entry voor het type krijgt `IsTalig: true` en de gekozen `TaligheidsAard`.
3. **Validatie (preflight)**:
   - `IsTalig: true` op een type zonder _Data (bijv. een entiteit zonder GE's) → waarschuwing, geen fout.
   - `IsTalig: true` met handmatig veld `taal` in de V3-input → fout: kies één of het ander.
   - Onbekende waarde voor `TaligheidsAard` → fout.

Voor het kennis-model concreet: de huidige handmatige `taal`-velden in `Trefwoord` en `KennisartikelTaalvariantTaal` kunnen verwijderd worden door op de relevante GE's `IsTalig: true` te zetten. De `Taal`-enum mag blijven bestaan als waardenvalidatie, maar wordt op termijn vervangen door de centrale `Taal`-referentielijst.

---

## 9. Impact op API-laag

### 9.1 REST

- Querystring: `?lang=fy-NL`. Meerdere talen niet ondersteund — gebruik `Accept-Language` met q-waarden.
- Header: `Accept-Language: nl-BE, nl;q=0.9, en;q=0.5`.
- Volgorde van precedence: explicit `?lang=` > `Accept-Language` > register-default > platform-default.
- Response-header: `Content-Language: <de daadwerkelijk geserveerde taal>` (RFC 9110-conform).
- Response-body bij talige velden: standaard scalair (de gekozen taal). Bij `?lang=*` of `TaligheidsAard = officiele_naam` zonder `?lang=`: een object `{ "nl": "...", "fy-NL": "..." }` of array — hier is een platform-keuze nodig (zie 11).
- Tijdreis-parameters blijven onafhankelijk: `?t=...` (formeel), `?peildatum=...` (materieel), `?lang=...` (talig).

### 9.2 GraphQL

In `dynql/`:

- Velden van talige _Data krijgen automatisch een `lang: String` argument met fallback-keten.
- Een directive `@lang(code: "nl-BE")` op een query-niveau zet de keten voor het hele subqueryblok.
- Bij `TaligheidsAard = officiele_naam` wordt het veld typisch `[String!]!` of een eigen type `MonolingualText { value: String, lang: String }` (analoog aan Wikidata).
- De `peiltijdstip`-parameter blijft bestaan, met dezelfde toepassingsvolgorde als REST.

### 9.3 OpenAPI

Per talig type wordt automatisch:

- De `lang`-querystring-parameter toegevoegd.
- De `Accept-Language`/`Content-Language`-headers gedocumenteerd.
- Het schema van talige velden uitgebreid met een `x-multilingual: true`-extensie (custom OAS-extensie ter herkenning door clients).

---

## 10. Impact op frontend

De frontend in `web/vite/` is schema-gedreven en kan dus generiek reageren op `IsTalig`-metadata uit de schema-API:

- Formuliervelden krijgen een talen-tabblad of -dropdown wanneer het bovenliggende type `IsTalig: true` is.
- De UML-editor toont talige GE's met een klein taal-icoontje (analoog aan het materieel-`MATERIEEL`-badge in het diagram).
- Het 3D Universum kan een taalfilter toevoegen aan de HUD.
- Het inhoud-editorvenster toont per veld de huidige taal en biedt een knop "vertaal naar…" die een nieuwe _Data-versie in een andere taal aanmaakt.

Niets hiervan is hardcoded per type — alles draait op de schema-API zoals de rest van de frontend.

---

## 11. Open ontwerpvragen

1. **Default response bij ontbrekende `lang`**: scalair-met-fallback (CMS-stijl, eenvoudig voor clients) of altijd object/array (linked-data-stijl, eerlijker)? Voorstel: scalair-met-fallback voor `vertaling`, object/array voor `officiele_naam`. Configureerbaar per register.
2. **Inhoudelijke gelijkheid bij `officiele_naam`**: moet de uniciteit hub-niveau worden (één Trefwoord-instantie heeft één `nl` én één `fy`), of mag elke taal een eigen hub hebben? Voorstel: één hub, meerdere _Data-rijen per taal. Sluit aan bij Hub + _Data.
3. **Granulariteit per veld**: ITS 2.0 staat toe dat sommige velden binnen een record vertaalbaar zijn en andere niet. Voorlopig geldt: `IsTalig` is een eigenschap van het hele _Data-record. Mocht gemengd nodig blijken, splits de GE.
4. **Validatie van toegestane talen**: harde whitelist per register, of vrije tekstinvoer met BCP 47-validatie? Voorstel: validatie tegen de `Taal`-referentielijst (die per register kan worden ingericht via een filter).
5. **Migratie van bestaande modellen** met handmatig `taal`-veld (zoals het kennis-model): codegen kan dit detecteren en optioneel automatisch converteren met een `--migrate-taal`-flag.
6. **Plural rules en formatting**: dit voorstel doet *geen* uitspraak over locale-formatting (datums, getallen, valuta). Dat blijft een presentation-concern (CLDR/ICU in de frontend), niet iets wat het register opslaat.
7. **Diff- en schemaversioning**: het toevoegen of weghalen van `IsTalig` is een **breaking change** in het databaseschema (PK verandert). De `schemadiff`-tool moet dit detecteren en een migratiepad genereren (impliciete `taal = register_default` voor bestaande rijen).

---

## 12. Wat blijft de Taalvariant-modellering doen?

Het kennis-model in [docs/Model files (V3)/v0.1.2.4 kennis2 V3.json](docs/Model%20files%20%28V3%29/v0.1.2.4%20kennis2%20V3.json) blijft onder dit voorstel volledig geldig en aanbevolen voor zijn use case. Een `KennisartikelTaalvariant` is op zijn plaats wanneer:

- Per taal verschillende *aantallen* of *typen* secties voorkomen.
- Per taal een eigen redactionele lifecycle bestaat (concept, review, gepubliceerd, ingetrokken).
- Per taal andere auteurs/verantwoordelijken gelden.
- Een taal als geheel kan worden afgevoerd zonder de andere talen te raken.

In dat geval is `KennisartikelTaalvariant` zelf **niet** `IsTalig` (de variant *is* de taal-context); wél kunnen de onderliggende GE's `KennisartikeltaalvariantTitel` en `Sectie` `IsTalig: false` houden, omdat hun taal afgeleid is uit de parent-variant.

Met andere woorden: er ontstaat een **keuze-as voor de modelleur**:

- Heb ik vooral *content met een taaltag* nodig? → `IsTalig: true` op de relevante GE's, geen Taalvariant-cluster.
- Heb ik *parallelle redactionele werelden* per taal nodig? → Een eigen `Taalvariant`-entiteit, met `IsTalig: false` op de onderliggende velden.
- Heb ik beide (zeldzaam, maar denkbaar)? → Taalvariant-cluster, en daarbinnen kunnen sommige GE's nog steeds `IsTalig: true` zijn voor sub-vertalingen (bijv. een citaat in een derde taal binnen een NL-tekst).

De documentatie van de UML-editor moet deze keuzehulp expliciet maken.

---

## 13. Vergelijking met bestaande v06-aspecten

| Aspect | Vlag | Plumbing | Tijddimensie | Configureerbaar per register |
|---|---|---|---|---|
| Formele tijd | (altijd aan) | Wijzigingen + Registratie | `t_f` | Nee — fundamenteel |
| Materiële tijd | `IsMaterieel` | `_Aanvang`, `_Einde` op hub | `t_m` | Per type |
| **Taal** *(voorstel)* | **`IsTalig`** | **`taal`-veld in PK van _Data** | **`lang`** | **Per type + per register** |
| Autorisatie *(toekomst)* | t.b.d. | Policy-evaluatie in middleware | n.v.t. | Per register |

Het patroon herhaalt zich: een **boolean opt-in op `TypeMeta`**, **plumbing op een vaste laag** (hub of _Data), **één extra request-parameter** in de API, **geen impact op niet-talige types**. Hiermee is `IsTalig` architectonisch consistent met wat het register al doet.

---

## 14. Roadmap (indicatief)

1. **Fase 1 — Modellering & metadata**: `TypeMeta` uitbreiden, V3-formaat uitbreiden, codegen-validatie toevoegen. Geen runtime-impact nog.
2. **Fase 2 — Codegen & DB**: codegen genereert het `taal`-veld; dbsetup past PK aan; centrale `Taal`-referentielijst toevoegen; helpers (`GetTaal`, `FallbackKeten`, `SelecteerTaligData`) implementeren.
3. **Fase 3 — REST + OpenAPI**: handlers respecteren `lang`/`Accept-Language`; OpenAPI-docs uitgebreid; `Content-Language`-header in responses.
4. **Fase 4 — GraphQL**: dynql voegt `lang`-argumenten en `@lang`-directive toe; `MonolingualText` type voor officiële namen.
5. **Fase 5 — Frontend & UML-editor**: schema-API levert `IsTalig`/`TaligheidsAard`; formulieren tonen taal-selectie; UML-editor toont taal-badge en biedt opt-in.
6. **Fase 6 — Migratie**: schemadiff detecteert taal-wijzigingen; migratie-flag in codegen voor bestaande modellen; documentatie in [docs/CODEGEN.md](docs/CODEGEN.md).

Elke fase is zelfstandig oplevering en regressie-testbaar.

---

## 15. Samenvatting

Dit voorstel introduceert **`IsTalig`** als platformaspect in v06, naar analogie van `IsMaterieel`. Het:

- Behandelt taal als **derde dimensie** naast formele en materiële tijd.
- Plaatst de plumbing op **_Data** (waar de inhoud zit), in tegenstelling tot materialiteit op de hub.
- Onderscheidt **vertaling** (met fallback) van **officiële naam** (zonder fallback) via `TaligheidsAard`.
- Sluit aan bij de standaarden BCP 47, RFC 9110 (`Accept-Language`/`Content-Language`), en conceptueel bij SKOS/JSON-LD's language-tagged values.
- Laat de bestaande `Taalvariant`-modellering (zoals in het kennis-model) ongemoeid voor use cases waar per-taal redactionele onafhankelijkheid nodig is.
- Past in het MetaRegistry-gedreven, schema-gedreven karakter van v06: één boolean opt-in stuurt codegen, handlers, GraphQL, OpenAPI en frontend automatisch aan.

Het gevolg is dat meertaligheid in nieuwe registers een **configuratiekeuze** wordt in plaats van een **modelleerklus** — net zoals dat met materiële tijd al het geval is.
