# GraphQL Enum Handling — Analyse en Oplossing

> Datum: 16 april 2026
> Status: **Opgelost** — enum cache-bug gefixt, gedrag gedocumenteerd

## Probleem

Alle enum-velden (o.a. `rol`, `fase`, `organisatietype`) retourneerden `null` in GraphQL-responses, terwijl de data wél correct in de database en in de Go-structs stond.

## Root Cause: enum cache collision

### De fout

De pipeline voor het opbouwen van GraphQL-veldtypes is:

```
struct-veld (reflect)
  → schemaTypeVoorReflectType()   → goType="string", format=""
  → resolveEnumWaarden()          → ["Realiseert", "Maakt gebruik van"]
  → goTypeToGraphQL(goType, ...)  → makeEnumType("string", [...])
```

`schemaTypeVoorReflectType()` retourneerde voor **alle** string-based custom types (Gemeenterol, Fase, Organisatietype, etc.) dezelfde `goType = "string"`, omdat de functie naar het `reflect.Kind()` kijkt (= `string`) en niet naar de Go-typenaam.

In `makeEnumType(name, values)` wordt het resultaat gecachet in `enumTypeCache[name]`. Doordat `name` altijd `"string"` was:

1. Het **eerste** enum-type dat verwerkt werd (bijv. `Fase`) registreerde `enumTypeCache["string"]` met waarden `["Idee ...", "Initiatie ...", ...]`
2. Alle **volgende** enum-types (Gemeenterol, Organisatietype, etc.) kregen dezelfde `Fase`-enum terug uit de cache
3. Bij serialisatie zocht `graphql-go` de waarde `"Realiseert"` op in de `Fase`-enum → niet gevonden → `null`

### Visueel

```
Vóór fix:

  Gemeenterol.rol   →  goType="string"  →  enumTypeCache["string"] = FaseEnum  →  null
  Fase.fase         →  goType="string"  →  enumTypeCache["string"] = FaseEnum  →  OK (toevallig)
  Organisatietype   →  goType="string"  →  enumTypeCache["string"] = FaseEnum  →  null

Na fix:

  Gemeenterol.rol   →  enumGoType="Gemeenterol"  →  enumTypeCache["Gemeenterol"] = GemeenterolEnum  →  OK
  Fase.fase         →  enumGoType="Fase"          →  enumTypeCache["Fase"] = FaseEnum                →  OK
  Organisatietype   →  enumGoType="Organisatietype" → enumTypeCache["Organisatietype"] = ...         →  OK
```

### De fix (field_builder.go, `fieldsVoorMeta`)

```go
// Vóór fix:
gqlType := goTypeToGraphQL(goType, format, enumValues)

// Na fix:
enumGoType := goType
if len(enumValues) > 0 {
    ft := f.Type
    for ft.Kind() == reflect.Ptr {
        ft = ft.Elem()
    }
    if ft.Name() != "" && ft.Name() != "string" {
        enumGoType = ft.Name()
    }
}
gqlType := goTypeToGraphQL(enumGoType, format, enumValues)
```

De werkelijke Go-typenaam (bijv. `"Gemeenterol"`) wordt nu als key gebruikt voor de enum-cache, zodat elke enum-type een unieke entry krijgt.

## Enum-serialisatie en het underscore-probleem

### Hoe graphql-go enums serialiseert

De GraphQL-spec vereist dat enum-waarden alleen `[_A-Za-z0-9]` bevatten — spaties, koppeltekens en andere tekens zijn verboden. Onze `sanitizeEnumValue()` vervangt spaties door underscores:

```
"Maakt gebruik van"  →  "Maakt_gebruik_van"   (enum key/naam)
"Realiseert"         →  "Realiseert"           (ongewijzigd)
```

De `makeEnumType()` bouwt een enum als:

```go
valueMap["Maakt_gebruik_van"] = &graphql.EnumValueConfig{
    Value:       "Maakt gebruik van",    // de originele Go-waarde
    Description: "Maakt gebruik van",
}
```

Men zou verwachten dat `graphql-go` bij serialisatie de `Value` retourneert. Maar de `Serialize()`-methode van `graphql-go` doet dit:

```go
// graphql-go/graphql v0.8.1 — definition.go:1007
func (gt *Enum) Serialize(value interface{}) interface{} {
    // ...
    if enumValue, ok := gt.getValueLookup()[v]; ok {
        return enumValue.Name   // ← retourneert de NAAM, niet de VALUE
    }
    return nil
}
```

`getValueLookup()` is een map van `Value → *EnumValueDefinition`. Dus:

1. Input: Go-waarde `"Maakt gebruik van"`
2. Lookup: vindt `EnumValueDefinition{ Name: "Maakt_gebruik_van", Value: "Maakt gebruik van" }`
3. Return: `enumValue.Name` = `"Maakt_gebruik_van"` ← **gesanitizede naam!**

Dit is conform de [GraphQL-spec](https://spec.graphql.org/October2021/#sec-Enums): enum-waarden zijn identifiers, geen strings.

### Gevolg voor templates

Een template-filter als `{{initiatief_gemeenten[rol=Realiseert].weergavenaam}}` werkt correct, want `"Realiseert"` bevat geen spaties en wordt niet gesanitized.

Maar `{{initiatief_gemeenten[rol=Maakt gebruik van].weergavenaam}}` zou falen, want in de GraphQL-response staat `"Maakt_gebruik_van"` (met underscores).

### Oplossingsstrategieën

#### Strategie 1: graphql.String i.p.v. enum-types (eenvoudig, aanbevolen)

Gebruik `graphql.String` als GQL-type voor enum-velden, zodat de originele Go-waarde ongewijzigd doorkomt:

```
GraphQL response: "rol": "Maakt gebruik van"   ← origineel
Template filter:  [rol=Maakt gebruik van]       ← match!
```

**Voordelen:**
- Geen transformatie, waarden komen 1-op-1 door
- Templates werken met de werkelijke domeinwaarden
- Schema-API (niet GraphQL) kan nog steeds de enum-waarden tonen voor formuliervalidatie

**Nadelen:**
- GraphQL-introspectie toont geen geldige waarden voor het veld
- Geen server-side validatie van enum-waarden bij mutations

#### Strategie 2: Originele waarden in template-matching (alternatief)

Houd enum-types, maar laat de template-engine `[rol=Maakt_gebruik_van]` matchen. Dit vereist dat template-auteurs de gesanitizede waarden kennen.

**Nadeel:** verwarrend voor domeingebruikers, want de waarde in de DB is `"Maakt gebruik van"`.

#### Strategie 3: Custom serialize (niet aanbevolen)

Override de `Serialize()` methode om `Value` te retourneren i.p.v. `Name`. Dit schendt de GraphQL-spec en kan GraphQL-clients verwarren.

### Huidige keuze

Voorlopig blijft de huidige implementatie (enum-types met sanitized namen) behouden. Zodra templates met spatie-enums nodig zijn, is **Strategie 1** het eenvoudigst te implementeren: vervang in `goTypeToGraphQL()` de enum-aanmaak door `graphql.String`:

```go
func goTypeToGraphQL(goType string, format string, enumValues []string) graphql.Output {
    // Strategie 1: geen GQL enums, gebruik String
    // if len(enumValues) > 0 {
    //     return graphql.String
    // }
    // ... rest
}
```

De schema-API (`/api/schema/model`) blijft de enum-waarden tonen via de V3-veldmeta, zodat de frontend nog steeds dropdown-lijsten kan bouwen.

## Relatie met andere systemen

| Systeem | Enum-weergave | Bron |
|---------|---------------|------|
| **Database** | `"Maakt gebruik van"` (origineel) | Go type alias + Bun |
| **REST API** (`/full/...`) | `"Maakt gebruik van"` (origineel) | JSON marshal van Go struct |
| **Schema API** (`/api/schema/model`) | Enum-waarden als array in veldmeta | V3 JSON exporter |
| **GraphQL** | `"Maakt_gebruik_van"` (gesanitized) | graphql-go enum Serialize |
| **Frontend formulieren** | Dropdown met originele waarden | Schema API |
| **Template [key=value] filter** | Moet matchen met GraphQL-response | PublicatieDetail |

## Betrokken bestanden

| Bestand | Rol |
|---------|-----|
| `dynql/field_builder.go` | `fieldsVoorMeta()` — fix voor enum cache collision |
| `dynql/scalars.go` | `makeEnumType()`, `sanitizeEnumValue()`, `goTypeToGraphQL()` |
| `dynql/type_builder.go` | `buildObjectType()` — merget data-velden in hub-type |
| `model/*_enum_registry.go` | Registratie van enum-waarden per domein |
| `model/*_modellen_ge_rel.go` | Go type-aliassen (bijv. `type Gemeenterol string`) |
