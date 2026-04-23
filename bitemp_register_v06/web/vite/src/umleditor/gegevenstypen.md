# Custom Gegevenstypen — Ontwerp voor Schema-API en Editor

Dit document beschrijft het ontwerp voor **custom gegevenstypen** (datatypes) in het bitemporele register.
Het dient als specificatie voor zowel de Go backend (schema-API) als de React frontend (metamodel-editor).

---

## Doel

Custom gegevenstypen voegen domeinspecifieke semantiek, validatie en presentatie toe bovenop de primitieve types (string, integer, number, boolean). Voorbeelden: NL-postcode, BSN, IBAN, percentage.

Ze worden gedefinieerd op metamodel-niveau en zijn herbruikbaar over alle representatietypen heen.

---

## Schema-API contract

### Response-structuur

Het `/schema` endpoint krijgt een extra top-level key `datatypes` naast de bestaande `types`:

```json
{
  "versie": "v1",
  "datatypes": [ ... ],
  "types": [ ... ]
}
```

### Datatype-object

Elk datatype is een JSON-object met de volgende structuur:

```json
{
  "naam": "NLPostcode",
  "description": "Nederlandse postcode (4 cijfers + 2 letters)",
  "basistype": "string",
  "format": "nl-postcode",
  "validatie": {
    "pattern": "^[1-9][0-9]{3}\\s?[A-Za-z]{2}$",
    "minLength": 6,
    "maxLength": 7,
    "voorbeelden": ["1234 AB", "9999ZZ"],
    "foutmelding": "Voer een geldige postcode in (bijv. 1234 AB)",
    "regels": []
  },
  "normalisatie": "uppercase_letters",
  "weergave": {
    "placeholder": "1234 AB",
    "inputMask": "0000 AA",
    "prefix": "",
    "suffix": ""
  }
}
```

### Velden in detail

#### Basisvelden

| Veld | Type | Verplicht | Beschrijving |
|---|---|---|---|
| `naam` | string | ja | Unieke naam van het gegevenstype (PascalCase, bijv. `NLPostcode`, `BSN`) |
| `description` | string | ja | Mensleesbare beschrijving van wat het type inhoudt |
| `basistype` | string | ja | Het onderliggende primitieve type: `"string"`, `"integer"`, `"number"`, `"boolean"` |
| `format` | string | ja | Unieke format-identifier (kebab-case, bijv. `"nl-postcode"`, `"bsn"`). Dit is de sleutel waarmee velden naar dit datatype verwijzen |

#### Validatie-object

| Veld | Type | Verplicht | Beschrijving |
|---|---|---|---|
| `pattern` | string | nee | Reguliere expressie waaraan de waarde moet voldoen (JSON Schema / ECMA-262 compatible) |
| `minLength` | integer | nee | Minimale lengte (alleen bij basistype `"string"`) |
| `maxLength` | integer | nee | Maximale lengte (alleen bij basistype `"string"`) |
| `minimum` | number | nee | Minimale waarde (alleen bij basistype `"integer"` of `"number"`) |
| `maximum` | number | nee | Maximale waarde (alleen bij basistype `"integer"` of `"number"`) |
| `multipleOf` | number | nee | Waarde moet een veelvoud zijn van dit getal (bijv. `0.01` voor 2 decimalen) |
| `voorbeelden` | string[] | nee | Array van geldige voorbeeldwaarden (voor documentatie en testing) |
| `foutmelding` | string | nee | Standaard foutmelding bij validatiefout (i.p.v. een generieke melding) |
| `regels` | ValidatieRegel[] | nee | Array van complexe validatieregels die niet in een regex passen |

#### ValidatieRegel-object

Voor validaties die complexer zijn dan een regex (wiskundige checks, checksums, cross-field validatie):

| Veld | Type | Verplicht | Beschrijving |
|---|---|---|---|
| `naam` | string | ja | Mensleesbare naam van de regel (bijv. `"11-proef"`, `"IBAN-checksum"`) |
| `type` | string | ja | Type regel: `"checksum"`, `"formula"`, `"function"` (zie hieronder) |
| `expressie` | string | ja | De expressie of functienaam die de validatie beschrijft |
| `description` | string | nee | Toelichting op de werking van de regel |

**Regeltypen:**

| Type | Gebruik | Expressie-formaat |
|---|---|---|
| `checksum` | Wiskundige check op de cijfers van de waarde | Formule met `d1..dN` als individuele cijfers. Bijv. `"(9*d1 + 8*d2 + ... - 1*d9) % 11 == 0"` |
| `formula` | Wiskundige formule op de numerieke waarde | Expressie met `value` als variabele. Bijv. `"value >= 0 && value <= 100"` |
| `function` | Verwijzing naar een bekende validatiefunctie | Functienaam die zowel frontend als backend kennen. Bijv. `"iban_mod97_check"` |

> **Convention**: de `function`-type regels verwijzen naar benoemde functies die in zowel de Go-backend als de JavaScript-frontend geïmplementeerd moeten zijn. Dit is een bewuste koppeling: wanneer je een nieuw function-type toevoegt, moet je de implementatie in beide lagen toevoegen.

#### Normalisatie

| Waarde | Effect |
|---|---|
| `"uppercase_letters"` | Letters in de invoer worden naar hoofdletters geconverteerd |
| `"lowercase"` | Gehele invoer naar kleine letters |
| `"trim"` | Witruimte aan begin en eind verwijderen |
| `"strip_spaces"` | Alle spaties verwijderen |
| `"strip_dashes"` | Alle streepjes verwijderen |

Meerdere normalisaties kunnen gecombineerd worden met komma-scheiding: `"trim,uppercase_letters"`.

#### Weergave-object

Stuurt hoe de frontend het invoerveld rendert:

| Veld | Type | Verplicht | Beschrijving |
|---|---|---|---|
| `placeholder` | string | nee | Placeholder-tekst in het invoerveld |
| `inputMask` | string | nee | Invoermasker: `0` = cijfer, `A` = letter, `*` = willekeurig teken. Spaties en andere tekens zijn letterlijk |
| `prefix` | string | nee | Tekst die vóór het invoerveld wordt getoond (bijv. `"€"`) |
| `suffix` | string | nee | Tekst die ná het invoerveld wordt getoond (bijv. `"%"`) |

---

## Voorbeelden van custom gegevenstypen

### NLPostcode

```json
{
  "naam": "NLPostcode",
  "description": "Nederlandse postcode (4 cijfers + 2 letters)",
  "basistype": "string",
  "format": "nl-postcode",
  "validatie": {
    "pattern": "^[1-9][0-9]{3}\\s?[A-Za-z]{2}$",
    "minLength": 6,
    "maxLength": 7,
    "voorbeelden": ["1234 AB", "9999ZZ"],
    "foutmelding": "Voer een geldige postcode in (bijv. 1234 AB)"
  },
  "normalisatie": "uppercase_letters",
  "weergave": {
    "placeholder": "1234 AB",
    "inputMask": "0000 AA"
  }
}
```

### BSN (Burgerservicenummer)

```json
{
  "naam": "BSN",
  "description": "Burgerservicenummer (9 cijfers, 11-proef)",
  "basistype": "string",
  "format": "bsn",
  "validatie": {
    "pattern": "^[0-9]{9}$",
    "minLength": 9,
    "maxLength": 9,
    "voorbeelden": ["123456782"],
    "foutmelding": "Voer een geldig BSN in (9 cijfers, 11-proef)",
    "regels": [
      {
        "naam": "11-proef",
        "type": "checksum",
        "expressie": "(9*d1 + 8*d2 + 7*d3 + 6*d4 + 5*d5 + 4*d6 + 3*d7 + 2*d8 - 1*d9) % 11 == 0",
        "description": "De gewogen som van alle cijfers moet deelbaar zijn door 11. Let op: het laatste cijfer wordt afgetrokken (factor -1), niet opgeteld."
      }
    ]
  },
  "weergave": {
    "placeholder": "123456782",
    "inputMask": "000000000"
  }
}
```

### Percentage

```json
{
  "naam": "Percentage",
  "description": "Percentage (0–100, max 2 decimalen)",
  "basistype": "number",
  "format": "percentage",
  "validatie": {
    "minimum": 0,
    "maximum": 100,
    "multipleOf": 0.01,
    "voorbeelden": [0, 50, 99.99, 100],
    "foutmelding": "Voer een percentage in tussen 0 en 100"
  },
  "weergave": {
    "suffix": "%"
  }
}
```

### IBAN

```json
{
  "naam": "IBAN",
  "description": "Internationaal bankrekeningnummer (ISO 13616)",
  "basistype": "string",
  "format": "iban",
  "validatie": {
    "pattern": "^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$",
    "minLength": 15,
    "maxLength": 34,
    "voorbeelden": ["NL91ABNA0417164300"],
    "foutmelding": "Voer een geldig IBAN in",
    "regels": [
      {
        "naam": "IBAN-checksum",
        "type": "function",
        "expressie": "iban_mod97_check",
        "description": "IBAN mod-97 controle conform ISO 13616: verplaats de eerste 4 tekens naar het einde, vervang letters door getallen (A=10, B=11, ...), en controleer of het resultaat modulo 97 gelijk is aan 1."
      }
    ]
  },
  "normalisatie": "strip_spaces,uppercase_letters",
  "weergave": {
    "placeholder": "NL91ABNA0417164300",
    "inputMask": "AA00 AAAA 0000 0000 00"
  }
}
```

### Emailadres

```json
{
  "naam": "Email",
  "description": "E-mailadres",
  "basistype": "string",
  "format": "email",
  "validatie": {
    "pattern": "^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$",
    "maxLength": 254,
    "voorbeelden": ["jan@voorbeeld.nl"],
    "foutmelding": "Voer een geldig e-mailadres in"
  },
  "normalisatie": "trim,lowercase",
  "weergave": {
    "placeholder": "naam@domein.nl"
  }
}
```

---

## Referentie vanuit velden

Een veld in een representatietype verwijst naar een custom datatype via het `format` veld:

```json
{
  "naam": "postcode",
  "type": "string",
  "format": "nl-postcode",
  "verplicht": true,
  "description": "Postcode van het adres"
}
```

Het `type` veld bevat altijd het primitieve basistype. Het `format` veld is de koppeling naar het custom datatype. Dit sluit aan bij de bestaande OAS 3.1 conventie in de schema-API.

**Lookup-volgorde** in de frontend:
1. Zoek in `datatypes` array naar een entry met matching `format`
2. Zo gevonden: gebruik diens validatie, normalisatie en weergave
3. Zo niet gevonden: behandel als primitief type met het format als hint (bijv. `"date"`, `"date-time"`)

---

## Go-kant: voorgestelde structuren

### DatatypeRegistry

```go
// Datatype beschrijft een herbruikbaar gegevenstype met validatie en weergave.
type Datatype struct {
    Naam         string            `json:"naam"`
    Description  string            `json:"description"`
    Basistype    string            `json:"basistype"`
    Format       string            `json:"format"`
    Validatie    DatatypeValidatie `json:"validatie"`
    Normalisatie string            `json:"normalisatie,omitempty"`
    Weergave     DatatypeWeergave  `json:"weergave,omitempty"`
}

type DatatypeValidatie struct {
    Pattern     string            `json:"pattern,omitempty"`
    MinLength   *int              `json:"minLength,omitempty"`
    MaxLength   *int              `json:"maxLength,omitempty"`
    Minimum     *float64          `json:"minimum,omitempty"`
    Maximum     *float64          `json:"maximum,omitempty"`
    MultipleOf  *float64          `json:"multipleOf,omitempty"`
    Voorbeelden []string          `json:"voorbeelden,omitempty"`
    Foutmelding string            `json:"foutmelding,omitempty"`
    Regels      []ValidatieRegel  `json:"regels,omitempty"`
}

type ValidatieRegel struct {
    Naam        string `json:"naam"`
    Type        string `json:"type"`        // "checksum", "formula", "function"
    Expressie   string `json:"expressie"`
    Description string `json:"description,omitempty"`
}

type DatatypeWeergave struct {
    Placeholder string `json:"placeholder,omitempty"`
    InputMask   string `json:"inputMask,omitempty"`
    Prefix      string `json:"prefix,omitempty"`
    Suffix      string `json:"suffix,omitempty"`
}
```

### Registratie

```go
// DatatypeRegistry bevat alle custom gegevenstypen, analoog aan MetaRegistry.
var DatatypeRegistry = []Datatype{
    {
        Naam:        "NLPostcode",
        Description: "Nederlandse postcode (4 cijfers + 2 letters)",
        Basistype:   "string",
        Format:      "nl-postcode",
        // ...
    },
    // ...
}
```

### Struct-tag referentie

Een struct-veld verwijst naar een custom datatype via de bestaande `schema` tag:

```go
type Adres struct {
    Postcode string `json:"postcode" schema:"format=nl-postcode" schema_desc:"Postcode van het adres"`
    // ...
}
```

De schema-handler leest de `schema` tag, extraheert het format, en neemt dat op in de schema-API response.

---

## Ontwerpkeuzes

| Aspect | Keuze | Reden |
|---|---|---|
| **Referentie** | Via `format` veld op het attribuut | Sluit aan bij OAS 3.1 conventie; `type` blijft het primitieve basistype, `format` specificeert de semantiek. Backwards compatible: bestaande types zonder custom format werken ongewijzigd |
| **Scheiding type/format** | `type` = primitief, `format` = custom | De frontend kan altijd terugvallen op het primitieve type als het custom type onbekend is |
| **Validatie: pattern** | Regex (JSON Schema / ECMA-262) | Universeel uitvoerbaar in Go, JavaScript en elke andere taal zonder extra dependencies |
| **Validatie: regels** | Array van benoemde regels | Voor complexe validaties (11-proef, IBAN checksum) die niet in een regex passen. Elke regel is zelfbeschrijvend met naam en description |
| **Regel expressie-type** | `checksum` / `formula` / `function` | Checksum voor cijfer-gebaseerde proeven, formula voor wiskundige grenzen, function voor complexe benoemde validaties |
| **Function-type koppeling** | Benoemde functie in frontend én backend | Bewuste koppeling: bij een nieuw function-type moet de implementatie in beide lagen worden toegevoegd. Dit voorkomt een eigen expressie-taal |
| **Normalisatie** | Benoemde operaties, komma-gescheiden | Eenvoudig, uitbreidbaar, geen ambigu gedrag. Frontend past normalisatie toe bij invoer (on-blur), backend bij opslag |
| **Weergave** | Declaratief object | Frontend bepaalt zelf het invoercomponent; de weergave-hints zijn suggesties, geen harde vereisten |
| **Voorbeelden** | Array van geldige waarden | Dient als documentatie, kan gebruikt worden voor automatische tests, en kan in de editor als tooltip worden getoond |
| **Foutmelding** | Per datatype | Domeinspecifieke foutmeldingen zijn veel nuttiger dan generieke "ongeldige invoer" meldingen |

---

## Visuele representatie in de editor

Custom datatypes worden in de metamodel-editor weergegeven als een apart bloktype:

```
┌──────────────────────────┐
│  «gegevenstype»          │
│  NLPostcode              │
├──────────────────────────┤
│  basis: string           │
│  format: nl-postcode     │
├──────────────────────────┤
│  pattern: ^[1-9]...      │
│  minLength: 6            │
│  maxLength: 7            │
├──────────────────────────┤
│  🔗 uppercase_letters    │
│  📝 "1234 AB"            │
└──────────────────────────┘
```

Bij velden in entiteit-/GE-/relatie-nodes wordt het format getoond achter het type:

```
  postcode : string «nl-postcode»
```

---

## Validatiebibliotheek (JavaScript)

De validatielogica is geïmplementeerd als **framework-onafhankelijke** JavaScript-modules in `src/validatie/`. Deze modules bevatten geen React-dependencies en zijn direct herbruikbaar in andere projecten (bijv. de bitemporele data-view-en-edit frontend).

### Architectuur

```
src/validatie/
├── index.js         ← Publieke API (herexport)
├── valideer.js      ← Hoofdfunctie: valideer(waarde, datatype, opties)
├── normaliseer.js   ← Normalisatiefuncties (trim, uppercase, strip, etc.)
└── regels.js        ← Validatieregels: checksum, formula, function
```

### Publieke API

| Functie | Module | Beschrijving |
|---|---|---|
| `valideer(waarde, datatype, opties?)` | `valideer.js` | Hoofdvalidatie: normalisatie → type-check → lengte/bereik → pattern → regels |
| `zoekDatatype(format, datatypes)` | `valideer.js` | Zoek een datatype op basis van format-string |
| `valideerVeld(waarde, format, datatypes, opties?)` | `valideer.js` | Gecombineerd: lookup + valideer in één aanroep |
| `normaliseer(waarde, normSpec)` | `normaliseer.js` | Pas normalisatie-stappen toe (komma-gescheiden) |
| `beschikbareNormalisaties()` | `normaliseer.js` | Lijst beschikbare normalisatienamen |
| `voerRegelUit(waarde, regel)` | `regels.js` | Voer één validatieregel uit |
| `beschikbareFuncties()` | `regels.js` | Lijst geregistreerde benoemde validatiefuncties |

### Validatiestappen (in volgorde)

De `valideer()` functie doorloopt vijf stappen:

1. **Lege-waarde check** — Als het veld verplicht is en de waarde leeg, direct fout. Als het veld niet verplicht is en leeg, direct geldig.
2. **Normalisatie** — Pas de normalisatie-string toe (bijv. `"trim,uppercase_letters"`). Dit geeft de genormaliseerde waarde terug waar de rest van de validatie op werkt.
3. **Type-check** — Controleer of de waarde past bij het basistype: `integer` moet een geheel getal zijn, `number` een getal, `boolean` een boolean-waarde.
4. **Lengte / bereik** — `minLength`, `maxLength` voor strings; `minimum`, `maximum`, `multipleOf` voor getallen.
5. **Pattern** — Regex-match als `validatie.pattern` is opgegeven.
6. **Regels** — Complexe validaties (checksum, formula, function) worden als laatste uitgevoerd.

### Retourwaarde

```js
{
  geldig: boolean,        // true als alle checks slagen
  genormaliseerd: string, // de waarde na normalisatie
  fouten: string[]        // array van foutmeldingen (leeg als geldig)
}
```

### Hergebruik in de bitemporele data-frontend

De bibliotheek is ontworpen voor één import-pad:

```js
import { valideer, normaliseer, zoekDatatype, valideerVeld } from "../validatie";
```

**In een invoerformulier:**

```js
// Bij on-blur van een invoerveld:
const datatype = zoekDatatype(veld.format, alleDatatypes);
if (datatype) {
  const result = valideer(invoerwaarde, datatype, { verplicht: veld.verplicht });
  if (!result.geldig) {
    toonFouten(result.fouten);
  }
  // Sla de genormaliseerde waarde op:
  setVeldWaarde(result.genormaliseerd);
}
```

**Eenvoudiger, als je het format hebt:**

```js
const result = valideerVeld(invoerwaarde, "nl-postcode", alleDatatypes, { verplicht: true });
```

### Regeltypen en uitbreidbaarheid

**checksum** — Generiek geëvalueerd via `d1..dN` variabelen (individuele cijfers). Geen speciale implementatie nodig per checksum; de expressie uit het datatype-object wordt dynamisch geëvalueerd.

**formula** — Generiek geëvalueerd via `value` variabele. Geen speciale implementatie nodig.

**function** — Elke benoemde functie moet geregistreerd worden in `FUNCTION_REGISTRY` (in `regels.js`). Dit is een bewuste koppeling: het toevoegen van een nieuw function-type vereist implementatie in JavaScript + Go.

Huidige geregistreerde functies:
- `bsn_11proef` — BSN 11-proef (gewogen som van 9 cijfers)
- `iban_mod97_check` — IBAN mod-97 controle (ISO 13616)

### Test-invoer paneel

In de metamodel-editor is een **Test invoer** subschermpje beschikbaar (via de 🧪-knop in de toolbar). Dit paneel:

- Laat je een gegevenstype kiezen uit de datatypes op het canvas
- Toont het invoerveld met weergave-hints (placeholder, prefix, suffix)
- Valideert **live** bij elke toetsaanslag
- Toont de genormaliseerde waarde als die verschilt van de invoer
- Biedt voorbeeldwaarden als snelknoppen
- Toont de volledige foutmeldingen inclusief welke stap gefaald heeft

Dit paneel gebruikt exact dezelfde `valideer()` functie die in het data-invoerformulier hergebruikt wordt — geen aparte test-implementatie.
