# Afgeleide velden (Derived Fields)

Afgeleide velden zijn velden waarvan de waarde niet direct wordt opgeslagen, maar **berekend** wordt uit andere velden — vergelijkbaar met *derived attributes* (`/attribuut`) in UML-klassendiagrammen.

## Inhoudsopgave

- [Concepten](#concepten)
- [Twee niveaus van afleidingen](#twee-niveaus-van-afleidingen)
- [V3 metamodel JSON-structuur](#v3-metamodel-json-structuur)
- [Ondersteunde afleidingstalen](#ondersteunde-afleidingstalen)
- [CEL syntax en voorbeelden](#cel-syntax-en-voorbeelden)
- [Visuele weergave in de UML-editor](#visuele-weergave-in-de-uml-editor)
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

### 2. Entiteit-niveau (over gegevenselementen heen)

Op entiteit-niveau kunnen afgeleide velden worden gedefinieerd die verwijzen naar velden **uit verschillende onderliggende gegevenselementen en relaties**. Dit is typisch voor samengestelde weergavewaarden.

```json
{
  "afgeleideVelden": [
    {
      "naam": "weergavenaam",
      "description": "Samengestelde weergavenaam van de persoon",
      "goType": "string",
      "afleidingsregelTaal": "cel",
      "afleidingsregel": "Naam.roepnaam != null ? Naam.roepnaam : Naam.voorletters + (Naam.tussenvoegsel != null ? ' ' + Naam.tussenvoegsel : '') + ' ' + Naam.achternaam"
    }
  ]
}
```

De **padvorm** `GegevensElement.veld` (bijv. `Naam.roepnaam`) maakt duidelijk uit welk GE het bronveld komt.

## V3 metamodel JSON-structuur

### Veld-niveau property's

| Property              | Type    | Standaard | Beschrijving                                       |
|-----------------------|---------|-----------|---------------------------------------------------|
| `afgeleid`            | boolean | `false`   | Markering dat het veld afgeleid is                |
| `afleidingsregelTaal` | string  | `"cel"`   | De expressietaal van de afleidingsregel           |
| `afleidingsregel`     | string  | `""`      | De expressie waarmee de waarde wordt berekend     |

### Entiteit-niveau `afgeleideVelden[]`

| Property              | Type   | Standaard | Beschrijving                                       |
|-----------------------|--------|-----------|---------------------------------------------------|
| `naam`                | string | verplicht | Naam van het afgeleide veld (snake_case)           |
| `description`         | string | `""`      | Omschrijving van het afgeleide veld               |
| `goType`              | string | `"string"`| Go-type van de berekende waarde                   |
| `afleidingsregelTaal` | string | `"cel"`   | De expressietaal                                   |
| `afleidingsregel`     | string | verplicht | De expressie                                       |

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
      "afleidingsregel": "Naam.roepnaam != null ? Naam.roepnaam : Naam.voorletters + (Naam.tussenvoegsel != null ? ' ' + Naam.tussenvoegsel : '') + ' ' + Naam.achternaam"
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

#### Weergavenaam (huidige implementatie)

```cel
Naam.roepnaam != null
  ? Naam.roepnaam
  : Naam.voorletters
    + (Naam.tussenvoegsel != null ? " " + Naam.tussenvoegsel : "")
    + " " + Naam.achternaam
```

Levert bijv. `"Mark"` (als roepnaam ingevuld) of `"M.W. de Vries"` (als alleen voorletters en achternaam).

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

#### Nationaliteit-samenvatting (meervoudig GE)

```cel
Burgerschap.landcode + " (" + Burgerschap.nationaliteit + ")"
```

Levert bijv. `"NL (Nederlandse)"`.

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

| Locatie                 | Weergave                                              |
|-------------------------|-------------------------------------------------------|
| Entiteitnode (canvas)   | `/weergavenaam` in oranje, cursief, onder de velden   |
| GE/Relatienode (canvas) | `/veldnaam` met oranje `/` prefix                     |
| NodeEditPanel (sidebar) | Checkbox `/`, details-paneel met taal + regel          |
| V3 JSON export          | `afgeleideVelden[]` op entiteit, `afgeleid: true` op veld |

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

## Codestructuur en bestanden

### Metamodel-definities

| Bestand | Rol |
|---------|-----|
| `metamodel_v3.json` | Productie V3-model met afgeleide velden op NatuurlijkPersoon |
| `uml-editor/src/metamodel/types.js` | `AFLEIDINGSTALEN` constante, factory-functies `maakLeegVeld()` en `maakLeegAfgeleidVeld()`, V3-export (`veldNaarV3()`, `editorNaarV3Model()`) en import (`schemaResponseNaarEditor()`) |

### Converters

| Bestand | Rol |
|---------|-----|
| `web/vite/src/v3ModelNaarEditor.js` | V3 JSON → editor-formaat converter (de versie die door de v06 Vite-app wordt gebruikt). Mapped `afgeleid`, `afleidingsregelTaal`, `afleidingsregel` op veldniveau en `afgeleideVelden[]` op entiteitniveau. |
| `uml-editor/src/metamodel/v3ModelNaarEditor.js` | Zelfde converter voor standalone editor-gebruik |

**Let op:** er bestaan twee kopieën van de converter. Bij wijzigingen moeten **beide** worden bijgewerkt.

### UI-componenten

| Bestand | Rol |
|---------|-----|
| `uml-editor/src/components/panels/NodeEditPanel.jsx` | Edit-paneel met: afgeleid-checkbox per veld, afleidingstaal-selector, afleidingsregel-textarea, en een aparte sectie "Afgeleide velden (entiteit)" met CRUD |
| `uml-editor/src/components/nodes/EntiteitNode.jsx` | Oranje `/` prefix en cursieve weergave van afgeleide velden in de entiteitnode |
| `uml-editor/src/components/nodes/GegevensElementNode.jsx` | Oranje `/` prefix bij afgeleide velden in GE-nodes |
| `uml-editor/src/components/nodes/RelatieNode.jsx` | Oranje `/` prefix bij afgeleide velden in relatie-nodes |

## Toekomstige doorontwikkeling

1. **Code-generatie**: afgeleide velden vertalen naar berekende Go-methoden op de entiteit-struct, zodat de API ze automatisch meelevert bij GET-responses.
2. **MetaRegistry-integratie**: afgeleide velden opnemen in de MetaRegistry zodat handlers en schema-API ze kunnen exposeren.
3. **Frontend-weergave**: afgeleide velden weergeven in de data-tabellen en tijdlijnvisualisatie (bijv. weergavenaam als kolom in de entiteitenlijst).
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
