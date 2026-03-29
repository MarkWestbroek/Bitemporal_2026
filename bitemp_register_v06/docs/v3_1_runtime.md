# V3.1 Runtime Extensie

## Doel

Het V3 modelformaat was oorspronkelijk bedoeld als modeldefinitie voor codegen en de UML-editor. Frontends (content editor, formulieren) hadden echter ook runtime/deployment-specifieke metadata nodig: welke REST-paden, tabelnamen en kolommen horen bij welk type? Die informatie zat alleen in de MetaRegistry (Go) en de oudere `viz/schema`-API.

V3.1 voegt een `runtime`-sectie toe aan het V3-formaat, zodat de model-API (`/api/schema/model`) nu de **single source of truth** is voor zowel modeldefinitie als runtime-metadata.

## Wijzigingen

### Nieuw type: `V3Runtime`

**Bestand:** `model/v3_format.go`

```go
type V3Runtime struct {
    Veldnaam               string `json:"veldnaam,omitempty"`
    Padnaam                string `json:"padnaam,omitempty"`
    Tabelnaam              string `json:"tabelnaam,omitempty"`
    IDKolom                string `json:"idKolom,omitempty"`
    HeeftPFK               bool   `json:"heeftPFK,omitempty"`
    EntiteitIDKolom        string `json:"entiteitIDKolom,omitempty"`
    Klassenaam             string `json:"klassenaam,omitempty"`
    RelatieveAutoincrement bool   `json:"relatieveAutoincrement,omitempty"`
}
```

| Veld | Bron (MetaRegistry) | Betekenis |
|------|---------------------|-----------|
| `veldnaam` | `TypeMeta.Veldnaam` | JSON-veldnaam in REST requests (bijv. `"a"`, `"u"`, `"rel_a_b"`) |
| `padnaam` | `TypeMeta.Padnaam` | URL-padsegment voor REST-routes (bijv. `"as"`, `"a-us"`) |
| `tabelnaam` | `TypeMeta.Tabelnaam` | Database-tabelnaam (bijv. `"a"`, `"a_u"`) |
| `idKolom` | `TypeMeta.IDKolom` | Naam van de primaire sleutelkolom (bijv. `"id"`, `"rel_id"`) |
| `heeftPFK` | `TypeMeta.HeeftPFK` | Samengestelde sleutel? (bijv. `(a_id, rel_id)`) |
| `entiteitIDKolom` | `TypeMeta.EntiteitIDKolom` | FK-kolom naar parent-entiteit (bijv. `"a_id"`) |
| `klassenaam` | `TypeMeta.Klassenaam` | Korte weergavenaam zonder entiteitsprefix |
| `relatieveAutoincrement` | `TypeMeta.RelatieveAutoincrement` | Relatieve auto-increment binnen parent |

### Toegevoegd aan: `V3Entiteit`, `V3Gegevenselement`, `V3Relatie`

Elk van deze drie types heeft nu een `Runtime *V3Runtime` veld (JSON: `"runtime,omitempty"`).

### Uitbreiding: `V3Veld`

Drie nieuwe velden voor frontend-rendering:

| Veld | JSON | Betekenis |
|------|------|-----------|
| `Type` | `"type"` | OAS 3.1 type: `"string"`, `"integer"`, `"number"`, `"boolean"` |
| `Format` | `"format"` | OAS 3.1 format: `"date"`, `"date-time"`, `"float32"`, `"float64"`, ... |
| `Verplicht` | `"verplicht"` | `true` als het veld niet optioneel is (geen pointer-type, geen omitempty) |

### Exporter uitbreiding

**Bestand:** `model/v3_exporter.go`

Nieuwe functies:
- `runtimeVanMeta(meta TypeMeta) *V3Runtime` — bouwt een `V3Runtime` uit de MetaRegistry, retourneert `nil` als alles leeg is.
- `oasTypeVoorGoType(t reflect.Type) (string, string)` — converteert Go reflect.Type naar OAS 3.1 type+format. Analoog aan `schemaTypeVoorReflectType()` in `viz_schema_handler.go`, maar in het model package.

Aangepaste functies:
- `extractContentFields()` — vult nu `Type`, `Format`, `Verplicht` op elk `V3Veld`.
- `ExportMetaRegistryToV3()` (entiteit-loop) — zet `Runtime` op elke `V3Entiteit`.
- `v3GegevenseElementVanMeta()` — zet `Runtime` op elk `V3Gegevenselement`.
- `v3RelatieVanMeta()` — zet `Runtime` op elke `V3Relatie`.

## Backward compatibiliteit

- Alle nieuwe JSON-velden gebruiken `omitempty` — als ze niet gevuld zijn, verschijnen ze niet in de JSON.
- De UML-editor en codegen negeren onbekende velden (standaard `json.Unmarshal` gedrag).
- Het `runtime`-blok verschijnt alleen bij exports vanuit de MetaRegistry (niet bij opgeslagen modeldefinities in de DB, tenzij ze met runtime waren opgeslagen).
- Bestaande tests blijven ongewijzigd groen.

## Voorbeeld JSON output

```json
{
  "typenaam": "A",
  "description": "Entiteit A",
  "isMaterieel": true,
  "meervoud": "as",
  "runtime": {
    "veldnaam": "a",
    "padnaam": "as",
    "tabelnaam": "a",
    "idKolom": "id",
    "klassenaam": "A"
  },
  "gegevenselementen": [
    {
      "naam": "U",
      "meervoud": "a-us",
      "momentvoorkomen": "enkelvoudig",
      "runtime": {
        "padnaam": "a-us",
        "tabelnaam": "a_u",
        "idKolom": "rel_id",
        "heeftPFK": true,
        "entiteitIDKolom": "a_id",
        "relatieveAutoincrement": true
      },
      "velden": [
        {
          "naam": "tekst",
          "goType": "string",
          "type": "string",
          "verplicht": true
        }
      ]
    }
  ]
}
```

## Tests

**Bestand:** `model/v3_exporter_test.go`

| Test | Controleert |
|------|-------------|
| `TestExportMetaRegistryToV3_RuntimeVelden` | Runtime aanwezig op entiteit A en GE U, met gevulde padnaam, tabelnaam, idKolom, heeftPFK, entiteitIDKolom |
| `TestExportMetaRegistryToV3_VeldTypeFormat` | Elk inhoudsveld van GE U heeft een OAS type |
| `TestExportMetaRegistryToV3_RelatieRuntime` | Relaties onder A hebben runtime met padnaam en tabelnaam |

## Toekomstig gebruik

Met V3.1 kan de content editor (en eventuele andere frontends) overstappen van de oudere `viz/schema`-API naar de model-API (`/api/schema/model/code`). Het `runtime`-blok bevat alle informatie die nodig is voor:
- Dynamische REST-aanroepen (padnaam → URL)
- Formulier-rendering (type/format → input widget, verplicht → required)
- Tabelweergave (veldnaam, klassenaam → headers)
- Database-context (tabelnaam, idKolom, heeftPFK → debug/admin info)
