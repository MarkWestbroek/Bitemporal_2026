# Afgeleide velden (Derived Fields)

Afgeleide velden zijn velden waarvan de waarde niet direct wordt opgeslagen, maar **berekend** wordt uit andere velden — vergelijkbaar met *derived attributes* (`/attribuut`) in UML-klassendiagrammen.

## Inhoudsopgave

- [Concepten](#concepten)
- [Twee niveaus van afleidingen](#twee-niveaus-van-afleidingen)
  - [isWeergaveVeld](#isweergaveveld)
- [V3 metamodel JSON-structuur](#v3-metamodel-json-structuur)
- [Ondersteunde afleidingstalen](#ondersteunde-afleidingstalen)
- [CEL syntax en voorbeelden](#cel-syntax-en-voorbeelden)
  - [CEL switch/case](#cel-switchcase-conditionele-toewijzing)
  - [Enum-velden](#enum-velden)
- [ExpressieEditor breakout-modal](#expressieeditor-breakout-modal)
- [Visuele weergave in de UML-editor](#visuele-weergave-in-de-uml-editor)
- [Opslag In Database En Roundtrip](#opslag-in-database-en-roundtrip)
- [Codestructuur en bestanden](#codestructuur-en-bestanden)
- [Toekomstige doorontwikkeling](#toekomstige-doorontwikkeling)

---

## Concepten

In een bitemporeel register worden gegevens geregistreerd op twee tijdsassen (formeel en materieel). Sommige waarden worden echter niet direct geregistreerd maar **afgeleid** uit andere geregistreerde waarden. Denk aan:

- Een **weergavenaam** die samengesteld is uit roepnaam, tussenvoegsel en achternaam
- Een **leeftijd** berekend uit de geboortedatum en de huidige datum
- Een **volledig adres** samengesteld uit straat, huisnummer, postcode en plaats

Afgeleide velden worden in het metamodel gedefinieerd met een **afleidingsregel** in een expressietaal, zodat de afleiding formeel beschreven is en machineleesbaar kan worden geëvalueerd.

## Twee niveaus van afleidingen

### 1. Veld-niveau (binnen een gegevenselement of relatie)

Een individueel veld in een GE of relatie kan als *afgeleid* worden gemarkeerd. Het veld verwijst dan alleen naar andere velden **binnen hetzelfde gegevenselement**.

```json
{
  "naam": "volledig_adres",
  "goType": "string",
  "afgeleid": true,
  "afleidingsregelTaal": "cel",
  "afleidingsregel": "straatnaam + ' ' + huisnummer + ', ' + postcode + ' ' + plaats"
}
```

### 2. Representatie-niveau (entiteit, GE-hub of relatie-hub)

Op representatie-niveau kunnen afgeleide velden worden gedefinieerd die verwijzen naar velden **uit onderliggende gegevenselementen en relaties**. Dit is typisch voor samengestelde weergavewaarden.

Afgeleide velden worden ondersteund op:
- **Entiteiten** — verwijzen naar velden in onderliggende GE's/relaties (bijv. `Naam.roepnaam`)
- **GE-hubs** — verwijzen naar velden in de hub's data-child (bijv. `Burgerschap_Data.nationaliteit`)
- **Relatie-hubs** — verwijzen naar velden in de relatie's data-child

```json
{
  "afgeleideVelden": [
    {
      "naam": "weergavenaam",
      "description": "Samengestelde weergavenaam van de persoon",
      "goType": "string",
      "afleidingsregelTaal": "cel",
      "afleidingsregel": "Naam.roepnaam != null ? Naam.roepnaam : Naam.voorletters + (Naam.tussenvoegsel != null ? ' ' + Naam.tussenvoegsel : '') + ' ' + Naam.achternaam",
      "isWeergaveVeld": true
    }
  ]
}
```

De **padvorm** `GegevensElement.veld` (bijv. `Naam.roepnaam`) maakt duidelijk uit welk GE het bronveld komt.

### isWeergaveVeld

Elk afgeleid veld kan een `isWeergaveVeld: true` vlag krijgen. Dit betekent dat het veld op visuele kaarten wordt getoond:

- **Entiteitskaart**: weergavevelden verschijnen onder het entiteitlabel
- **GE-kaarten**: weergavevelden verschijnen onder de korte samenvatting
- **Relatiekaarten**: idem

Meerdere weergavevelden worden gescheiden door ` | `.

Dit is herbruikbaar in zowel de Index- als de Tijdlijnvisualisatie.

## V3 metamodel JSON-structuur

### Veld-niveau property's

| Property              | Type    | Standaard | Beschrijving                                       |
|-----------------------|---------|-----------|---------------------------------------------------|
| `afgeleid`            | boolean | `false`   | Markering dat het veld afgeleid is                |
| `afleidingsregelTaal` | string  | `"cel"`   | De expressietaal van de afleidingsregel           |
| `afleidingsregel`     | string  | `""`      | De expressie waarmee de waarde wordt berekend     |

### Entiteit/GE/Relatie-niveau `afgeleideVelden[]`

| Property              | Type    | Standaard | Beschrijving                                       |
|-----------------------|---------|-----------|---------------------------------------------------|
| `naam`                | string  | verplicht | Naam van het afgeleide veld (snake_case)           |
| `description`         | string  | `""`      | Omschrijving van het afgeleide veld               |
| `goType`              | string  | `"string"`| Go-type van de berekende waarde                   |
| `afleidingsregelTaal` | string  | `"cel"`   | De expressietaal                                   |
| `afleidingsregel`     | string  | verplicht | De expressie                                       |
| `isWeergaveVeld`      | boolean | `false`   | Toon op visuele kaarten (Index/Tijdlijn)          |

### Compleet voorbeeld uit `metamodel_v3.json`

```json
{
  "typenaam": "NatuurlijkPersoon",
  "isMaterieel": true,
  "kleur": "#bfdbfe",
  "afgeleideVelden": [
    {
      "naam": "weergavenaam",
      "description": "Samengestelde weergavenaam van de persoon, afgeleid uit voornaam/tussenvoegsel/achternaam.",
      "goType": "string",
      "afleidingsregelTaal": "cel",
      "afleidingsregel": "Naam.roepnaam != null ? Naam.roepnaam : Naam.voorletters + (Naam.tussenvoegsel != null ? ' ' + Naam.tussenvoegsel : '') + ' ' + Naam.achternaam",
      "isWeergaveVeld": true
    }
  ],
  "gegevenselementen": [
    {
      "naam": "Naam",
      "velden": [
        { "naam": "voorletters", "goType": "string" },
        { "naam": "roepnaam",    "goType": "*string" },
        { "naam": "tussenvoegsel","goType": "*string" },
        { "naam": "achternaam",  "goType": "string" }
      ]
    }
  ]
}
```

## Ondersteunde afleidingstalen

| Waarde       | Naam                             | Opmerkingen                                  |
|--------------|----------------------------------|----------------------------------------------|
| `cel`        | CEL (Common Expression Language) | **Aanbevolen** — type-safe, Go-native        |
| `expr`       | Expr                             | Lightweight, Go-gebaseerd                    |
| `jsonlogic`  | JsonLogic                        | JSON-serialiseerbaar, platform-onafhankelijk |
| `pseudo`     | Pseudo-code                      | Vrije tekst, niet evalueerbaar               |

CEL is de standaard omdat het:
- een open standaard is van Google (gebruikt in o.a. Kubernetes, Firebase, GCP IAM)
- type-safe is en goed integreert met Go via `github.com/google/cel-go`
- een compacte, leesbare syntax heeft die dicht bij gangbare expressietalen staat

## CEL syntax en voorbeelden

### Basisprincipes

CEL (Common Expression Language) is een niet-Turing-complete expressietaal, ontworpen voor veilige evaluatie van regels. Er zijn geen side effects, loops of assignments mogelijk — alleen expressies die een waarde opleveren.

### Typen en literals

| Type     | Literals                          | Voorbeeld                     |
|----------|-----------------------------------|-------------------------------|
| `string` | `"tekst"`, `'tekst'`             | `"Hallo"`                     |
| `int`    | `42`, `-1`                        | `leeftijd + 1`                |
| `double` | `3.14`                            | `bedrag * 1.21`               |
| `bool`   | `true`, `false`                   | `actief == true`              |
| `null`   | `null`                            | `waarde != null`              |
| `list`   | `[1, 2, 3]`                       | `"NL" in landcodes`          |
| `map`    | `{"key": "value"}`               | `config.maxRetries`           |

### Operatoren

| Operator                    | Betekenis               | Voorbeeld                              |
|-----------------------------|-------------------------|----------------------------------------|
| `+`, `-`, `*`, `/`, `%`    | Rekenkundig             | `prijs * aantal`                       |
| `+`                         | String concatenatie     | `voornaam + " " + achternaam`          |
| `==`, `!=`                  | Gelijkheid              | `status == "actief"`                   |
| `<`, `<=`, `>`, `>=`       | Vergelijking            | `leeftijd >= 18`                       |
| `&&`, `\|\|`, `!`          | Logisch                 | `actief && !geblokkeerd`               |
| `? :`                       | Ternary / conditioneel  | `x > 0 ? x : -x`                      |
| `in`                        | Bevat (list/map)        | `"NL" in landcodes`                    |

### Null-handling

CEL ondersteunt null-checks, wat belangrijk is voor optionele velden (`*string`, `*bool` in Go):

```cel
// Null-safe conditie: gebruik roepnaam als die er is, anders voorletters
Naam.roepnaam != null ? Naam.roepnaam : Naam.voorletters
```

```cel
// Null-safe concatenatie met tussenvoegsel
Naam.voorletters + (Naam.tussenvoegsel != null ? " " + Naam.tussenvoegsel : "") + " " + Naam.achternaam
```

### String-functies

| Functie                          | Beschrijving                     | Voorbeeld                         |
|----------------------------------|----------------------------------|------------------------------------|
| `s.contains("sub")`             | Bevat substring                  | `naam.contains("Berg")`           |
| `s.startsWith("pre")`           | Begint met                       | `postcode.startsWith("10")`       |
| `s.endsWith("suf")`             | Eindigt met                      | `email.endsWith("@gov.nl")`       |
| `s.matches("regex")`            | Regex-match                      | `bsn.matches("^[0-9]{9}$")`      |
| `s.size()`                       | Lengte van de string             | `naam.size() > 0`                 |
| `string(x)`                     | Conversie naar string            | `string(huisnummer)`              |

### Voorbeelden voor bitemporeel register

#### Weergavenaam NatuurlijkPersoon (BRP-naamgebruik)

```cel
(Naam.roepnaam != null ? Naam.roepnaam : Naam.voorletters)
  + " "
  + (
      Naamgebruik.naamgebruik == "PartnerNaam"
        ? (Partnernaam.achternaam != null
            ? Partnernaam.achternaam
            : ((Naam.tussenvoegsel != null ? Naam.tussenvoegsel + " " : "") + Naam.achternaam))
        : Naamgebruik.naamgebruik == "EigenNaam-PartnerNaam"
          ? ((Naam.tussenvoegsel != null ? Naam.tussenvoegsel + " " : "") + Naam.achternaam)
            + (Partnernaam.achternaam != null ? "-" + Partnernaam.achternaam : "")
          : Naamgebruik.naamgebruik == "PartnerNaam-EigenNaam"
            ? (Partnernaam.achternaam != null ? Partnernaam.achternaam + "-" : "")
              + ((Naam.tussenvoegsel != null ? Naam.tussenvoegsel + " " : "") + Naam.achternaam)
            : ((Naam.tussenvoegsel != null ? Naam.tussenvoegsel + " " : "") + Naam.achternaam)
    )
```

Levert bijvoorbeeld:

- `EigenNaam` → `"Jan van den Berg"`
- `PartnerNaam` → `"Jan Jansen"`
- `EigenNaam-PartnerNaam` → `"Jan van den Berg-Jansen"`
- `PartnerNaam-EigenNaam` → `"Jan Jansen-van den Berg"`

> N.B. dit volgt het BRP-concept `naamgebruik`. In het huidige model is voor de partner alleen de `achternaam` gemodelleerd; een partner-`tussenvoegsel` kan dus pas worden meegenomen als dat veld later ook wordt toegevoegd.

#### Volledig adres (veld-niveau in GE Adres)

```cel
straatnaam + " " + huisnummer + ", " + postcode + " " + plaats
```

Levert bijv. `"Keizersgracht 100, 1015 AA Amsterdam"`.

#### Ingezetene-weergave (boolean naar tekst)

```cel
PersoonsIdentificatie.ingezetene != null && PersoonsIdentificatie.ingezetene
  ? "Ingezetene"
  : "Niet-ingezetene"
```

Voor GE-/hub-kaarten mag dit ook in de korte, platte vorm zonder prefix, omdat de UI
het actuele item direct in de CEL-context zet:

```cel
bsn + (ingezetene == true ? " ingezetene" : "")
```

Beide varianten werken nu ook met booleans en logische operatoren zoals `&&`, `||` en `!`.

#### Nationaliteit-samenvatting (GE-hub-niveau)

Op het GE-hub-niveau `NatuurlijkPersoon_Burgerschap` kan een afgeleide weergave worden gedefinieerd die velden uit de `_Data` child combineert:

```cel
Burgerschap_Data.nationaliteit + ' (' + Burgerschap_Data.landcode + ')'
```

Levert bijv. `"Nederlandse (NL)"`.

#### Leeftijdsberekening (als geboortedatum beschikbaar zou zijn)

```cel
// Pseudo — exacte datumfuncties hangen af van de CEL-omgeving
timestamp(now).getFullYear() - timestamp(geboortedatum).getFullYear()
```

> **Let op:** datum-/tijdfuncties zijn standaard beperkt in CEL. 
> Bij implementatie in Go kan de CEL-omgeving uitgebreid worden met custom functies via `cel.Function()`.

### CEL switch/case (conditionele toewijzing)

CEL heeft geen `switch`- of `case`-statement. Het equivalent is een keten van ternary-expressies:

```cel
veld == "Waarde1" ? resultaat1 :
veld == "Waarde2" ? resultaat2 :
standaard
```

Voorbeeld met naamgebruik-enum:

```cel
Naamgebruik.naamgebruik == "PartnerNaam" ? Partnernaam.achternaam :
Naamgebruik.naamgebruik == "EigenNaam"  ? Naam.achternaam :
Naam.achternaam
```

Elke `veld == "Waarde" ? ... :` is één "case". De laatste waarde zonder `?` is de default.

### Enum-velden

Velden met een `enumNaam` (bijv. `naamgebruik : NaamgebruikSoort`) vergelijk je met string literals:

```cel
status == "Actief"    // Juist: string vergelijking
status == Actief      // Fout: Actief wordt als variabele geïnterpreteerd
```

De enum-waarden zijn zichtbaar in de ExpressieEditor (zie hieronder) en worden met aanhalingstekens ingevoegd.



Bij afleidingstaal `"pseudo"` wordt de regel niet geëvalueerd maar alleen als documentatie opgeslagen. Dit is handig voor complexe afleidingen die (nog) niet in CEL uit te drukken zijn:

```
Als roepnaam gevuld is, gebruik roepnaam.
Anders: voorletters + eventueel tussenvoegsel + achternaam.
```

## Visuele weergave in de UML-editor

### UML-conventie

In UML worden afgeleide attributen geschreven als `/attribuutnaam : type`. De editor volgt deze conventie:

- Afgeleide velden krijgen een **oranje `/`** prefix (kleur `#f59e0b`)
- Velden worden weergegeven in **cursief** (italic)
- In het edit-paneel hebben ze een **oranje linkerborder**
- Het afgeleid-checkbox toont `/` als label (UML-notatie)

### Waar zichtbaar

| Locatie                        | Weergave                                                     |
|--------------------------------|--------------------------------------------------------------|
| Entiteitnode (canvas)          | `/weergavenaam` in oranje, cursief, onder de velden          |
| GE/Relatienode (canvas)        | `/veldnaam` met oranje `/` prefix (ook afgeleideVelden)      |
| NodeEditPanel (sidebar)        | Checkbox `/`, details-paneel met taal + regel + isWeergaveVeld |
| V3 JSON export                 | `afgeleideVelden[]` op entiteit/GE/relatie, `afgeleid: true` op veld |
| Index visueel (entiteitskaart) | Weergavevelden onder het label, gescheiden door ` \| `        |
| Index visueel (GE/rel-kaart)   | Weergavevelden onder de korte samenvatting                   |
| Tijdlijn visueel               | Idem als Index, op alle kaarttypes                           |

### Screenshot-beschrijving

In de entiteitnode op het canvas verschijnt een extra sectie (gescheiden door een lijn) met de afgeleide velden in cursief:

```
┌─────────────────────────────┐
│     NatuurlijkPersoon       │
├─────────────────────────────┤
│  bsn : string               │
│  ingezetene : *bool          │
│  voorletters : string        │
│  ...                         │
├─────────────────────────────┤
│  /weergavenaam : string      │  ← oranje, cursief
└─────────────────────────────┘
```

## Opslag In Database En Roundtrip

### Verwacht gedrag

Bij publicatie via de editor (`POST /api/schema/model`) moet het volgende roundtrip-veilig zijn:

- entiteit-niveau `afgeleideVelden[]`
- veld-niveau `afgeleid`
- veld-niveau `afleidingsregelTaal`
- veld-niveau `afleidingsregel`

Na refresh (editor laadt nieuwste versie via `GET /api/schema/versies` -> `GET /api/schema/model/:id`) moeten deze velden ongewijzigd terugkomen.

### Gevonden issue en fix (maart 2026)

Issue:

- Afgeleide velden verdwenen na publiceren + refresh, terwijl opslaan/laden via lokaal JSON-bestand wel werkte.

Root cause:

- In de backend ontbraken afgeleide-velden-property's in de Go V3-structuur, waardoor JSON bij `POST /api/schema/model` wel geaccepteerd werd maar afgeleide properties tijdens unmarshal wegvielen.

Fix:

- In [model/v3_format.go](model/v3_format.go) zijn toegevoegd:
  - `V3Entiteit.AfgeleideVelden []V3AfgeleidVeld`
  - `V3Veld.Afgeleid`
  - `V3Veld.AfleidingsregelTaal`
  - `V3Veld.Afleidingsregel`
  - nieuw type `V3AfgeleidVeld`

Validatie:

- End-to-end POST -> GET roundtrip getest: afgeleide velden blijven behouden in `schema_json` en komen terug in de editor.

### CORS/no-load fallback naar demo

Als editor v2 op `http://localhost:5174/viz/react/editor-v2.html` op `[demo]` blijft staan, is de oorzaak vaak geen modelverlies maar laadfout:

- De eerste DB-load gebruikt `GET /api/schema/versies`.
- Als die call door CORS wordt geblokkeerd, valt editor v2 terug op demo-model.

Daarom staat CORS-middleware nu vroeg in de routerregistratie (voor alle routes), zodat ook `/api/schema/versies` de juiste `Access-Control-Allow-Origin` header terugstuurt.

Checklist bij troubleshooting:

1. Controleer in console op `Failed to fetch` of CORS-fouten.
2. Controleer of de statusbadge `[DB #..]` of `[demo]` toont.
3. Verifieer endpoint handmatig: `GET /api/schema/versies` moet 200 geven en CORS-header bevatten voor `localhost:5174`.

## Codestructuur en bestanden

### Metamodel-definities

| Bestand | Rol |
|---------|-----|
| `metamodel_v3.json` | Productie V3-model met afgeleide velden op NatuurlijkPersoon |
| `uml-editor/src/metamodel/types.js` | `AFLEIDINGSTALEN` constante, factory-functies `maakLeegVeld()` en `maakLeegAfgeleidVeld()` (met `isWeergaveVeld`), `afgeleideVeldNaarV3()` helper, V3-export (`veldNaarV3()`, `editorNaarV3Model()`) en import (`schemaResponseNaarEditor()`) |

### Converters

| Bestand | Rol |
|---------|-----|
| `web/vite/src/v3ModelNaarEditor.js` | V3 JSON → editor-formaat converter (de versie die door de v06 Vite-app wordt gebruikt). Mapped `afgeleid`, `afleidingsregelTaal`, `afleidingsregel` op veldniveau en `afgeleideVelden[]` (met `isWeergaveVeld`) op entiteit-, GE- en relatieniveau. |
| `uml-editor/src/metamodel/v3ModelNaarEditor.js` | Zelfde converter voor standalone editor-gebruik |

**Let op:** er bestaan twee kopieën van de converter. Bij wijzigingen moeten **beide** worden bijgewerkt.

### UI-componenten

| Bestand | Rol |
|---------|-----|
| `uml-editor/src/components/panels/NodeEditPanel.jsx` | Edit-paneel met: afgeleid-checkbox per veld, afleidingstaal-selector, afleidingsregel-textarea, isWeergaveVeld-checkbox, en een aparte sectie "Afgeleide velden" (voor entiteit, GE en relatie) met CRUD. Bevat knop **✎ Bewerken** die de `ExpressieEditor` modal opent. |
| `uml-editor/src/components/panels/ExpressieEditor.jsx` | **Breakout-modal voor het bewerken van CEL/expr/jsonlogic-expressies.** Zie sectie [ExpressieEditor](#expressieeditor-breakout-modal) hieronder. |
| `ide/src/DetailsPanel.jsx` | IDE-versie van het edit-paneel: zelfde **✎ Bewerken** knop voor zowel veld-niveau als afgeleide-velden-niveau, via `ExpressieEditor` met context uit de model-store. |
| `uml-editor/src/components/nodes/EntiteitNode.jsx` | Oranje `/` prefix en cursieve weergave van afgeleide velden in de entiteitnode |
| `uml-editor/src/components/nodes/GegevensElementNode.jsx` | Oranje `/` prefix bij afgeleide velden in GE-nodes |
| `uml-editor/src/components/nodes/RelatieNode.jsx` | Oranje `/` prefix bij afgeleide velden in relatie-nodes |

---

## ExpressieEditor breakout-modal

De `ExpressieEditor` is een verplaatsbare popup-modal voor het bewerken van afleidingsregels. Hij is geïntegreerd in zowel de UML-editor (via `NodeEditPanel`) als de IDE-detailpaneel (via `DetailsPanel`).

### Functionaliteit

| Feature | Beschrijving |
|---------|--------------|
| **Syntax highlighting** | Prism.js met eigen CEL-grammatica (keywords, operators, strings, getallen, comments) |
| **Autocomplete** | Dropdown bij typen: suggereert velden uit de context (TypeNaam.veldnaam), max 10 items, gefilterd op het huidige woord |
| **Contextpaneel** | Rechterkolom toont alle beschikbare variabelen, gegroepeerd per brontype. Klikken voegt in op cursorpositie. |
| **Enum-waarden** | Velden met `enumNaam` tonen hun enum-waarden als aparte groep (`◇ EnumNaam`) met amber kleur. Klikken voegt `"Waarde"` in (inclusief aanhalingstekens). |
| **Validatie** | Lichtgewichte design-time validatie: controleert of `TypeNaam.veldnaam` patronen voorkomen in de contextlijst. Toont fouten als rood in de footer. |
| **Drag** | Modal verplaatsbaar via de header (cursor: grab). |
| **Hint-tekst** | Taalspecifieke hints, inclusief switch/case chained ternary voorbeeld voor CEL. |

### Context-berekening

De context (beschikbare variabelen) wordt automatisch berekend uit het grafiek-model:

**`berekenContextVelden(node, allNodes, edges)`** — voor UML-editor (React Flow):
- Eigen velden van het geselecteerde GE/entiteit → eenvoudige naam (`roepnaam`) + hidden alias (`Naam.roepnaam` voor validatie)
- Sibling-GEs van dezelfde parent → gekwalificeerde naam (`Naam.roepnaam`)
- Velden van de parent-entiteit zelf → gekwalificeerde naam

**`berekenContextVeldenFromStore(elementId, elements, structuralEdges)`** — voor IDE (Zustand store):
- Zelfde logica, maar leest uit de IDE model-store in plaats van React Flow nodes/edges

**Enum-waarden**: als een veld een `enumNaam` heeft, zoekt de context-builder automatisch de bijbehorende enum-node op en voegt de waarden toe als `{ soort: "enumwaarde", invoegTekst: '"Waarde"' }` entries.

**Validatie-alias**: eigen velden worden dubbel opgenomen — als `roepnaam` én als `Naam.roepnaam` (met `verborgen: true`). Daardoor zijn beide schrijfwijzen geldig in de validator, terwijl de alias niet in de UI-lijst verschijnt.

### Invoegen

| Wijze | Gedrag |
|-------|--------|
| Autocomplete-klik / Tab/Enter | Vervangt het huidige woord op cursor; voor enum: insert `"Waarde"` (met quotes) |
| Klik in contextpaneel | Voegt in op cursorpositie; voor enum: insert `"Waarde"` (met quotes) |

### Locatie in de code

```
web/vite/src/umleditor/components/panels/ExpressieEditor.jsx
web/vite/src/umleditor/styles/editor.css  (stijlen, incl. enum amber-tint)
```

### Geëxporteerde functies

```javascript
// Hoofd-component (default export)
export default function ExpressieEditor({ value, taal, onChange, onClose, contextVelden })

// Context helpers (named exports)
export function berekenContextVelden(node, allNodes, edges)
export function berekenContextVeldenFromStore(elementId, elements, structuralEdges)
```



### Frontend visualisatie

| Bestand | Rol |
|---------|-----|
| `web/vite/src/shared/celEvaluator.js` | CEL-evaluator met `evalueerWeergaveVeldenVoorItem()` — evalueert isWeergaveVelden voor GE/relatie items met correcte CEL-context (hub-aware) |
| `web/vite/src/components/index/IndexRepresentatieVisual.jsx` | Weergavevelden op entiteitskaart, GE-kaarten en relatiekaarten in de Index-visualisatie |
| `web/vite/src/components/tijdlijn/TijdlijnRepresentatiePaneel.jsx` | Weergavevelden op alle kaarten in de Tijdlijn-visualisatie |
| `web/vite/src/components/editor/EntiteitFormulier.jsx` | Inhoud-detailpagina: weergavevelden in meervoudige GE/relatie-tabellen + doelentiteit-resolutie voor cross-entiteit CEL-expressies |
| `web/vite/src/components/editor/RepresentatieTabel.jsx` | Weergavevelden als kolom in overzichtslijst van representaties |

### Go backend

| Bestand | Rol |
|---------|-----|
| `model/metaregistry_plumbing.go` | `AfgeleidVeld` struct met `IsWeergaveVeld bool` |
| `model/v3_format.go` | `V3AfgeleidVeld` met `IsWeergaveVeld`; `V3Gegevenselement` en `V3Relatie` met `AfgeleideVelden` |
| `handlers/viz_schema_handler.go` | Schema-API DTO met `isWeergaveVeld` in `afgeleideVelden` |
| `cmd/codegen/gen_registry.go` | Codegen `writeAfgeleideVelden()` helper voor entiteit, GE-hub en relatie-hub |

## Toekomstige doorontwikkeling

1. **Code-generatie**: afgeleide velden vertalen naar berekende Go-methoden op de entiteit-struct, zodat de API ze automatisch meelevert bij GET-responses.
2. ~~**MetaRegistry-integratie**~~: ✅ Gerealiseerd — afgeleide velden (met `isWeergaveVeld`) zitten in de MetaRegistry en worden via de schema-API geëxposeerd.
3. ~~**Frontend-weergave**~~: ✅ Gerealiseerd — weergavevelden worden getoond op entiteits-, GE- en relatiekaarten in zowel Index als Tijdlijn, gescheiden door ` | `. Vanaf april 2026 ook in de inhoud-detailpagina (meervoudige tabellen) met doelentiteit-resolutie voor cross-entiteit CEL-expressies.
4. **CEL-evaluatie in Go**: implementatie van een CEL-runtime

    ```go
    import "github.com/google/cel-go/cel"

    env, _ := cel.NewEnv(
        cel.Variable("Naam", cel.ObjectType("Naam")),
    )
    ast, iss := env.Compile(`Naam.roepnaam != null ? Naam.roepnaam : Naam.voorletters + " " + Naam.achternaam`)
    prg, _ := env.Program(ast)
    out, _, _ := prg.Eval(map[string]interface{}{
        "Naam": map[string]interface{}{
            "roepnaam":      "Mark",
            "voorletters":   "M.W.",
            "tussenvoegsel": nil,
            "achternaam":    "Westbroek",
        },
    })
    // out.Value() == "Mark"
    ```

5. **Validatie**: afleidingsregels valideren bij opslaan in de editor (syntax-check via CEL-compiler).

---

## Inhoud-detailpagina: weergavevelden in meervoudige tabellen (april 2026)

### Probleem

De inhoud-detailpagina (`EntiteitFormulier.jsx`) toonde meervoudige GE/relatie-records (zoals `InitiatiefDomein`, `InitiatiefOrganisatie`, `InitiatiefGemeente`) in een compacte tabel met alleen de ruwe veldwaarden: `rel_id`, `domein_id`, `rol`, etc. **Geen enkel afgeleid weergaveveld** was zichtbaar, waardoor de herkenbaarheid van records slecht was — een `rel_id` zegt niets over welk domein, welke gemeente of welke organisatie het betreft.

De root cause bestond uit twee lagen:

1. **Structureel**: de meervoudige tabel in `EntiteitFormulier.jsx` had überhaupt geen weergaveveld-kolom. De `actueleItems.map()` iteratie renderde alleen `inhoudsvelden` (ruwe data-velden), zonder enige CEL-evaluatie.

2. **Data**: de CEL-expressies op relatie-hubs verwijzen naar **doelentiteiten** die niet in de `/full/{padnaam}/{id}` API-response zitten. Voorbeeld: `InitiatiefDomein` heeft als CEL-expressie `Domein.DomeinGegevens.naam`, maar de full-entity response van een `Initiatief` bevat alleen de hub-records (met `domein_id`), niet de volledige `Domein`-entiteit met zijn `DomeinGegevens` GE.

### Contrast met andere pagina's

| Pagina | Weergaveveld zichtbaar? | Hoe? |
|--------|------------------------|------|
| Index-overzicht (`RepresentatieTabel.jsx`) | ✅ Ja | Roept `evalueerWeergaveVeldenVoorItem()` aan per rij |
| Tijdlijn (`TijdlijnRepresentatiePaneel.jsx`) | ✅ Ja | Idem, met correct plat-slaan en CEL-context |
| Index visueel (`IndexRepresentatieVisual.jsx`) | ✅ Ja | Idem |
| **Inhoud-detail** (`EntiteitFormulier.jsx`) | ❌ Nee (was) → ✅ Ja (nu) | Nieuw: weergave-kolom + doelentiteit-resolutie |

### Oplossing: drie wijzigingen in `EntiteitFormulier.jsx`

#### 1. Weergaveveld-kolom in meervoudige tabel

De meervoudige-tabel-rendering is uitgebreid met een `heeftWeergave`-check en een extra kolom:

```jsx
const heeftWeergave = safeArray(childMeta?.afgeleideVelden)
  .some((av) => av.isWeergaveVeld || av.weergaveVeld);

// In de thead:
{heeftWeergave && <th style={{ fontStyle: "italic" }}>weergave</th>}

// In elke tbody-rij:
const weergaveTekst = heeftWeergave
  ? berekenWeergaveVoorItem(childMeta, item, typeMetaByTypenaam, doelEntiteitCache)
  : null;

{heeftWeergave && (
  <td style={{ fontStyle: "italic", color: "var(--cg-donkergrijs)" }}>
    {weergaveTekst || "—"}
  </td>
)}
```

De kolom verschijnt **alleen** als het child-type minstens één `isWeergaveVeld: true` heeft. Records zonder berekend resultaat tonen "—".

#### 2. Doelentiteit-resolutie via `useEffect`

Een nieuw `useEffect` in de component:

1. Itereert over alle `onderliggende` child-types van de entiteit.
2. Filtert op relaties met `doelEntiteit` + `secondaireEntiteitIDKolom` + `isWeergaveVeld`.
3. Verzamelt unieke FK-IDs per doeltype (bijv. `Domein:5`, `Domein:8`).
4. Fetcht elke doelentiteit via `GET /full/{padnaam}/{id}`.
5. Slaat de child-GE-data plat (met `platSlaHubItems`) en berekent de doelentiteit's eigen `weergavenaam`.
6. Cachet alles in `doelEntiteitCache` state (`Map<"Typenaam:id", platgeslagenData>`).

```jsx
const [doelEntiteitCache, setDoelEntiteitCache] = useState({});

useEffect(() => {
  // Verzamel benodigde doelentiteit-fetches
  const teHalen = {}; // { Typenaam → Set<id> }
  // ... filter op doelEntiteit/secondaireEntiteitIDKolom/isWeergaveVeld ...
  // Fetch alle doelentiteiten parallel
  const fetches = [];
  for (const [doelTypenaam, ids] of Object.entries(teHalen)) {
    for (const doelId of ids) {
      fetches.push(
        fetch(`${baseUrl}/full/${doelPad}/${doelId}`)
          .then(r => r.json())
          .then(json => {
            // Platslaan child-GE's + berekenen weergavenaam
            nieuweCacheEntries[`${doelTypenaam}:${doelId}`] = platData;
          })
      );
    }
  }
  await Promise.all(fetches);
  setDoelEntiteitCache(prev => ({ ...prev, ...nieuweCacheEntries }));
}, [entity, typeMeta, ...]);
```

De fetch gebruikt een `AbortController` voor cleanup bij unmount.

#### 3. Verrijkte CEL-context via `berekenWeergaveVoorItem()`

Nieuwe helperfunctie die:

1. Eerst de standaard `evalueerWeergaveVeldenVoorItem()` probeert (voor eenvoudige expressies op eigen velden).
2. Als die leeg terugkomt en er doelentiteit-data in de cache is, een **verrijkte context** bouwt:
   - Alle velden van het platgeslagen item als root-keys.
   - De doelentiteit-data onder haar klassenaam (bijv. `{ Domein: { DomeinGegevens: { naam: "Dienstverlening" } } }`).
   - De typenaam als alias als die verschilt van de klassenaam.
3. De CEL-expressie opnieuw evalueert met deze verrijkte context.

### CEL-expressie audit (CG-domein)

| Relatie-type | CEL-expressie | Verwijst naar | Status |
|-------------|--------------|---------------|--------|
| `InitiatiefDomein` | `Domein.DomeinGegevens.naam` | Doelentiteit `Domein` → GE `DomeinGegevens` → veld `naam` | ✅ Opgelost via doelentiteit-fetch |
| `InitiatiefGemeente` | `Gemeente.weergavenaam + " - " + rol` | Doelentiteit `Gemeente` (met eigen afgeleide weergavenaam) + eigen veld `rol` | ✅ Opgelost (weergavenaam van Gemeente wordt meeberekend) |
| `InitiatiefAPIStandaard` | `ApiStandaard.Naam.naam` | Doelentiteit `ApiStandaard` → GE `Naam` → veld `naam` | ✅ Opgelost via doelentiteit-fetch |
| `InitiatiefOrganisatie` | **(niet gedefinieerd)** | — | ⚠️ Moet via UML-editor worden toegevoegd |

#### Andere entiteiten (NP/Loc-domein)

| Type | CEL-expressie | Status |
|------|--------------|--------|
| `Organisatie` | `Organisatienaam.naam` | ✅ Werkt (eigen GE, geen doelentiteit nodig) |
| `NatuurlijkPersoon` | `(Naam.roepnaam != null ? ...) + ' ' + Naam.achternaam` | ✅ Werkt (eigen GE's) |
| `Domein` | `DomeinGegevens.naam` | ✅ Werkt (eigen GE) |
| `Gemeente` | `GemeenteGegevens.naam + " (" + GemeenteGegevens.code + ")"` | ✅ Werkt (eigen GE) |
| `ApiStandaard` | `Naam.naam` | ✅ Werkt (eigen GE) |

### Patroon: twee soorten CEL-expressies

De implementatie onderscheidt nu twee patronen:

1. **Eigen-GE-expressies** (bijv. `Naam.roepnaam + " " + Naam.achternaam`): verwijzen naar GE's van de eigen entiteit of het eigen platgeslagen hub-item. Deze werken direct met `evalueerWeergaveVeldenVoorItem()`.

2. **Cross-entiteit-expressies** (bijv. `Domein.DomeinGegevens.naam`): verwijzen naar child-GE's van een **andere entiteit**, bereikbaar via de FK (`domein_id`). Deze vereisen doelentiteit-resolutie: de doelentiteit wordt apart gefetcht en in de CEL-context geïnjecteerd.

Het verschil wordt automatisch gedetecteerd door te kijken of de eerste evaluatie iets oplevert. Alleen als die leeg is én er een `doelEntiteit` gedefinieerd is, wordt de verrijkte context gebruikt.

### Visueel resultaat

Na de wijziging ziet de meervoudige tabel er zo uit:

```
 InitiatiefDomein (meervoudig) — 3 actueel

  rel_id   domein_id   weergave
  1        5           Dienstverlening
  2        8           Zaakgericht werken
  3        12          Gegevensmanagement
```

In plaats van alleen:

```
  rel_id   domein_id
  1        5
  2        8
  3        12
```

---

## Verdere technische afweging frontend-CEL

Voor een uitgebreidere afweging over:

- zelf een volledige CEL-evaluator bouwen,
- bestaande JavaScript-libraries,
- bundle-size en dependency-impact,
- en de voor- en nadelen ten opzichte van de huidige subset-aanpak,

zie ook:

- [`CEL-evaluatie-js.md`](./CEL-evaluatie-js.md)
