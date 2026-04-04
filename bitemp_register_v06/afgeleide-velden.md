# Afgeleide velden (Derived Fields)

Afgeleide velden zijn velden waarvan de waarde niet direct wordt opgeslagen, maar **berekend** wordt uit andere velden — vergelijkbaar met *derived attributes* (`/attribuut`) in UML-klassendiagrammen.

## Inhoudsopgave

- [Concepten](#concepten)
- [Twee niveaus van afleidingen](#twee-niveaus-van-afleidingen)
  - [isWeergaveVeld](#isweergaveveld)
- [V3 metamodel JSON-structuur](#v3-metamodel-json-structuur)
- [Ondersteunde afleidingstalen](#ondersteunde-afleidingstalen)
- [CEL syntax en voorbeelden](#cel-syntax-en-voorbeelden)
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

### Verschil met pseudo-code

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
| `uml-editor/src/components/panels/NodeEditPanel.jsx` | Edit-paneel met: afgeleid-checkbox per veld, afleidingstaal-selector, afleidingsregel-textarea, isWeergaveVeld-checkbox, en een aparte sectie "Afgeleide velden" (voor entiteit, GE en relatie) met CRUD |
| `uml-editor/src/components/nodes/EntiteitNode.jsx` | Oranje `/` prefix en cursieve weergave van afgeleide velden in de entiteitnode |
| `uml-editor/src/components/nodes/GegevensElementNode.jsx` | Oranje `/` prefix bij afgeleide velden in GE-nodes |
| `uml-editor/src/components/nodes/RelatieNode.jsx` | Oranje `/` prefix bij afgeleide velden in relatie-nodes |

### Frontend visualisatie

| Bestand | Rol |
|---------|-----|
| `web/vite/src/shared/celEvaluator.js` | CEL-evaluator met `evalueerWeergaveVeldenVoorItem()` — evalueert isWeergaveVelden voor GE/relatie items met correcte CEL-context (hub-aware) |
| `web/vite/src/components/index/IndexRepresentatieVisual.jsx` | Weergavevelden op entiteitskaart, GE-kaarten en relatiekaarten in de Index-visualisatie |
| `web/vite/src/components/tijdlijn/TijdlijnRepresentatiePaneel.jsx` | Weergavevelden op alle kaarten in de Tijdlijn-visualisatie |

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
3. ~~**Frontend-weergave**~~: ✅ Gerealiseerd — weergavevelden worden getoond op entiteits-, GE- en relatiekaarten in zowel Index als Tijdlijn, gescheiden door ` | `.
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

## Verdere technische afweging frontend-CEL

Voor een uitgebreidere afweging over:

- zelf een volledige CEL-evaluator bouwen,
- bestaande JavaScript-libraries,
- bundle-size en dependency-impact,
- en de voor- en nadelen ten opzichte van de huidige subset-aanpak,

zie ook:

- [`CEL-evaluatie-js.md`](./CEL-evaluatie-js.md)
