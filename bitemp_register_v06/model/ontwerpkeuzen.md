# Ontwerpkeuzen — model/ en codegeneratie

## 1. Scheiding gegenereerde vs. handmatige code

### Principe
Het bitemporale register is **domein-agnostisch**: dezelfde engine (handlers, routes, dbsetup, schema-API) kan elk domeinmodel bedienen, zolang de domeinstructuren worden uitgedrukt in Go-structs + MetaRegistry-entries.

### Welke bestanden zijn te genereren uit een UML/domeinmodel?

| # | Bestand | Inhoud | Genereerbaar? |
|---|---------|--------|---------------|
| 1 | `modellen_entiteiten.go` | Entiteitstructs (A, B, ...) met Bun-relaties | Ja |
| 2 | `modellen_ge_rel.go` | Hub-, _Data-, _Aanvang/_Einde-structs + enum-types | Ja |
| 3 | `modellen_methods.go` | `GeefOnderliggendeGegevenselementen()` + interface-methoden (GetID, Get/SetOpvoer, ...) | Ja |
| 4 | `modellen_input.go` | _Input-structs + hun interface-methoden | Ja |
| 5 | `metaregistry.go` | De volledige MetaRegistry | Ja (+ handmatige aanvullingen als kleur) |

### Welke bestanden zijn NIET domein-specifiek?

| Bestand | Inhoud |
|---------|--------|
| `model_plumbing.go` | Interfaces (Representatie, FormeleRepresentatie, ...), Wijziging, Registratie |
| `metaregistry_plumbing.go` | TypeMeta struct, constanten, MetaRegistryType, helpers |
| `date.go`, `equal.go`, `representatie_string.go` | Utilities |
| Alles in `handlers/`, `routes/`, `dbsetup/` | Volledig generiek, geen model-referenties |

### Geverifieerd: geen hard-coded model-referenties buiten model/ (productie)

| Directory | Status |
|-----------|--------|
| `handlers/*.go` (excl. tests) | **Schoon** — volledig via MetaRegistry |
| `routes/*.go` (excl. tests) | **Schoon** |
| `dbsetup/*.go` | **Schoon** |
| `main.go` | **Schoon** |
| `graph/` (GraphQL) | Hard-coded — inherent aan gqlgen; apart vraagstuk |

Testbestanden bevatten uiteraard concrete A/B/U/V-referenties; dat is verwacht.

---

## 2. GeefOnderliggendeGegevenselementen: genereren vs. dynamisch (reflect)

### Afweging

| Optie | Hoe | Voordelen | Nadelen |
|-------|-----|-----------|---------|
| **A. Genereren** | Go-template emit per type een concrete methode | Max performance, type-veilig, compiler checkt alles | Extra build-stap; sync met MetaRegistry nodig |
| **B. Dynamisch (reflect)** | Eenmalige generieke functie, field lookup via Rolnaam | Nul generatie; altijd consistent | Reflect-overhead per call; complexere foutafhandeling |
| **C. Hybride (reflect + cache)** | Eenmalig reflect-offsets cachen bij init | Eenmalig reflect-cost, daarna snel | Meer setup-complexiteit |

### Keuze: **Optie A — genereren**

Redenen:
1. **Performance**: wordt aangeroepen bij elke GET full-entity en elke registratie-call, recursief (entiteit → hub → data/aanvang/einde).
2. **Type-veiligheid**: mismatch struct ↔ methode wordt compile-time gevangen.
3. **Past bij de visie**: als structs en MetaRegistry al gegenereerd worden, is één extra template triviaal.
4. **Eenvoud**: het patroon is 100% repetitief en afleidbaar uit `OnderliggendeGegevenselementen` in MetaRegistry.

### Patroon per type

**Entiteiten** (bijv. A):
```
for elk kind in OnderliggendeGegevenselementen:
    for i := range self.{Rolnaam}:
        if self.{Rolnaam}[i].{EntiteitIDKolom} == 0:
            self.{Rolnaam}[i].{EntiteitIDKolom} = self.ID
        append(result, {Doeltype, &self.{Rolnaam}[i]})
```

**Hubs** (bijv. A_U, Rel_A_B):
```
for elk kind in OnderliggendeGegevenselementen:
    for i := range self.{Rolnaam}:
        if self.{Rolnaam}[i].{EntiteitIDKolom} == 0:
            self.{Rolnaam}[i].{EntiteitIDKolom} = self.{EntiteitIDKolom}
        if self.{Rolnaam}[i].Rel_ID == 0:
            self.{Rolnaam}[i].Rel_ID = self.Rel_ID
        append(result, {Doeltype, &self.{Rolnaam}[i]})
```

---

## 3. Bestandsorganisatie model/

### Huidig (v06, na herordening)

| Bestand | Wat staat erin |
|---------|---------------|
| `modellen_entiteiten.go` | ENT-structs + materiële plumbing structs (A_Aanvang, etc.) — alleen structs, geen methoden |
| `modellen_ge_rel.go` | Hub-structs, _Data-structs, _Aanvang/_Einde hub-plumbing structs, enum-types — alleen structs, geen methoden |
| `modellen_methods.go` | Alle interface-methoden + GeefOnderliggendeGegevenselementen op ENTs en hubs |
| `modellen_input.go` | _Input-structs — alleen structs, geen methoden |
| `metaregistry.go` | MetaRegistry map |

### Nieuw: methoden geconsolideerd in `modellen_methods.go`

De kleine interface-methoden (GetID, Metatype, ClearID, Get/SetOpvoer, Get/SetAfvoer, String) zijn **getters/setters** — mechanische uitbreiding van struct-attributen. Ze horen logisch bij de gegenereerde methode-file.

`GeefOnderliggendeGegevenselementen()` is de enige **functionele** methode, maar ook volledig afleidbaar.

→ Alle methoden op domeintypen (ENT + GE/REL + Data + Aanvang/Einde) staan samen in `modellen_methods.go`.

De structs zelf (zonder methoden) staan in:
- `modellen_entiteiten.go` — ENT-structs
- `modellen_ge_rel.go` — hub-, _Data-, _Aanvang/_Einde-structs, enum-types
- `modellen_input.go` — _Input-structs

---

## 4. Naamconventies (gedestilleerd uit huidige code)

### Structuurnaamgeving

Gegeven een entiteit `E` met gegevenselement `G` (en optioneel relatie `Rel_E_F`):

| Concept | Go-type | Tabelnaam | JSON-veld | URL-pad |
|---------|---------|-----------|-----------|---------|
| Entiteit | `E` | `e` | `e` | `es` |
| GE-hub | `E_G` | `e_g` | `g` | `e_gs` |
| GE-data | `E_G_Data` | `e_g_data` | `e_g_data` | `e_g_data` |
| GE-input | `E_G_Input` | — | (platte velden) | — |
| GE-aanvang (materieel) | `E_G_Aanvang` | `e_g_aanvang` | `e_g_aanvang` | `e_g_aanvang` |
| GE-einde (materieel) | `E_G_Einde` | `e_g_einde` | `e_g_einde` | `e_g_einde` |
| ENT-aanvang | `E_Aanvang` | `e_aanvang` | `e_aanvang` | `e_aanvang` |
| ENT-einde | `E_Einde` | `e_einde` | `e_einde` | `e_einde` |
| Relatie-hub | `Rel_E_F` | `rel_e_f` | `rel_e_f` | `rel_e_fs` |
| Relatie-data | `Rel_E_F_Data` | `rel_e_f_data` | `rel_e_f_data` | `rel_e_f_data` |
| Relatie-input | `Rel_E_F_Input` | — | (platte velden) | — |

### Veldnaamconventies

| Context | Patroon |
|---------|---------|
| ENT FK-kolom in GE/REL-tabellen | `{e}_id` (snake_case van entiteitsnaam) |
| Secundaire FK (relaties) | `{f}_id` |
| Relatieve ID | `rel_id` (altijd) |
| Versie PK (_Data, _Aanvang, _Einde) | `versie` (altijd) |
| Opvoer/afvoer (afgeleid) | `opvoer`, `afvoer` |
| Materieel datum | `datum` (in _Aanvang/_Einde types) |

### Rolnaam-patronen (in OnderliggendeGegevenselementen)

| Parent | Kind-type | Rolnaam (Go) | JSONRolnaam |
|--------|-----------|-------------|-------------|
| ENT | GE-hub | `{G}s` (meervoud Go-veldnaam) | `{g}s` |
| ENT | REL-hub | `Rel{E}{F}s` | `rel_{e}_{f}s` |
| ENT | Aanvang-plumbing | `Aanvang` | `aanvang` |
| ENT | Einde-plumbing | `Einde` | `einde` |
| Hub | Data | `Data` | `data` |
| Hub | Aanvang (materieel) | `Aanvang` | `aanvang` |
| Hub | Einde (materieel) | `Einde` | `einde` |

---

## 5. Codegeneratie-input: formaat en analyse GetSchema API

### Vraag
Bevat de bestaande GetSchema API-response (`/schema`) voldoende informatie om als input te dienen voor een code generator die de 5 gegenereerde bestanden kan produceren?

### Antwoord: **Nee, maar het is een goed vertrekpunt**

De GetSchema API is ontworpen voor de **frontend** (formuliervelden, types, hiërarchie) en bevat daarom JSON/presentatie-gericht metadata. Een code generator voor **Go-broncode** heeft daarnaast Go-specifieke informatie nodig die de schema-API bewust niet blootstelt.

### Gap-analyse: wat ontbreekt er?

| Aspect | GetSchema levert | Codegen heeft nodig | Gap? |
|--------|-----------------|---------------------|------|
| Veldtype | JSON-type (string, integer, number, boolean) | Go-type (`int`, `int64`, `float64`, `*bool`, `*Date`, `RelABSoort`) | **Ja**: mapping is lossy; `int` vs `int64`, pointer vs value, custom types |
| Veld-format | OAS-achtig (date, date-time, float64) | Volledige Go-typereference | **Ja**: `*Date` vs `time.Time` niet te onderscheiden |
| Bun struct-tags | Niet aanwezig | `bun:"a_id,pk"`, `bun:"versie,pk,autoincrement"`, `bun:"datum,type:date"` | **Ja**: volledig afwezig |
| Bun relatie-tags | Niet aanwezig | `bun:"rel:has-many,join:id=a_id"`, `bun:"rel:belongs-to,..."` | **Ja**: nodig voor ENT- en hub-structs |
| Bun table/alias | tabelnaam is er | Maar `alias:` tag ontbreekt (nodig om dubbele underscores te vermijden) | **Deels** |
| Enum Go-definities | Enum-waarden als strings | Go type-naam (`RelABSoort`), const-namen (`RelABSoortLTT`), const-waarden | **Ja** |
| Pointer vs value | Deels: verplicht/omitempty | Niet precies genoeg (`*bool` vs `bool`, `*string` vs `string`) | **Ja** |
| Padnaam (URL) | Niet in response | Nodig voor MetaRegistry | **Ja** |
| Kleur | Aanwezig | Aanwezig | Nee |
| Factory/SliceFactory | Niet relevant | Afleidbaar uit typenaam | Nee |
| GeefOnderliggende | OnderliggendeGegevenselementen is er | Volledig afleidbaar mits EntiteitIDKolom + Rolnaam beschikbaar | Nee |
| _Input veldcombinatie | Niet expliciet | Welke hub-velden + data-velden combineren in Input | **Deels**: afleidbaar via onderliggende Data-type |

### Voorgesteld codegen-inputformaat

Hieronder een JSON-formaat dat als input kan dienen voor het genereren van alle 5 bestanden.
Het breidt de schema-API uit met Go-specifieke metadata.

```json
{
  "versie": "v1",
  "enums": [
    {
      "goType": "RelABSoort",
      "baseType": "string",
      "waarden": [
        { "constNaam": "RelABSoortLTT", "waarde": "LTT" },
        { "constNaam": "RelABSoortLAT", "waarde": "LAT" },
        { "constNaam": "RelABSoortLTA", "waarde": "LTA" }
      ]
    },
    {
      "goType": "ABCEnum",
      "baseType": "string",
      "waarden": [
        { "constNaam": "OptieA", "waarde": "Optie A" },
        { "constNaam": "OptieB", "waarde": "Optie B" },
        { "constNaam": "OptieC", "waarde": "Optie C" }
      ]
    }
  ],
  "types": [
    {
      "typenaam": "A",
      "description": "Entiteit A met materiele tijdlijn...",
      "metatype": "entiteit",
      "isMaterieel": true,
      "kleur": "#bfdbfe",
      "veldnaam": "a",
      "padnaam": "as",
      "tabelnaam": "a",
      "idKolom": "id",
      "heeftPFK": false,
      "relatieveAutoincrement": false,
      "entiteitIDKolom": "",
      "secondaireEntiteitIDKolom": "",
      "velden": [
        {
          "naam": "id",
          "goNaam": "ID",
          "goType": "int",
          "jsonTag": "\"id\"",
          "bunTag": "\"id,pk\"",
          "verplicht": true
        },
        {
          "naam": "opvoer",
          "goNaam": "Opvoer",
          "goType": "*time.Time",
          "jsonTag": "\"opvoer,omitempty\"",
          "bunTag": "",
          "verplicht": false,
          "isPlumbing": true
        },
        {
          "naam": "afvoer",
          "goNaam": "Afvoer",
          "goType": "*time.Time",
          "jsonTag": "\"afvoer,omitempty\"",
          "bunTag": "",
          "verplicht": false,
          "isPlumbing": true
        }
      ],
      "bunRelatieVelden": [
        {
          "goNaam": "Us",
          "goType": "[]A_U",
          "bunTag": "\"rel:has-many,join:id=a_id\"",
          "jsonTag": "\"us,omitempty\""
        },
        {
          "goNaam": "Vs",
          "goType": "[]A_V",
          "bunTag": "\"rel:has-many,join:id=a_id\"",
          "jsonTag": "\"vs,omitempty\""
        }
      ],
      "onderliggende": [
        { "rolnaam": "Us", "jsonRolnaam": "us", "doeltype": "A_U", "momentvoorkomen": "enkelvoudig" },
        { "rolnaam": "Vs", "jsonRolnaam": "vs", "doeltype": "A_V", "momentvoorkomen": "meervoudig" }
      ]
    },
    {
      "typenaam": "A_U",
      "description": "Hub voor gegevenselement U bij A",
      "metatype": "gegevenselement",
      "geSubtype": "hub",
      "isMaterieel": false,
      "dataTypenaam": "A_U_Data",
      "tabelnaam": "a_u",
      "idKolom": "rel_id",
      "heeftPFK": true,
      "relatieveAutoincrement": true,
      "entiteitIDKolom": "a_id",
      "velden": [
        {
          "naam": "a_id",
          "goNaam": "A_ID",
          "goType": "int",
          "jsonTag": "\"a_id\"",
          "bunTag": "\"a_id,pk\"",
          "verplicht": true
        },
        {
          "naam": "rel_id",
          "goNaam": "Rel_ID",
          "goType": "int",
          "jsonTag": "\"rel_id\"",
          "bunTag": "\"rel_id,pk,autoincrement\"",
          "verplicht": true
        }
      ],
      "bunRelatieVelden": [
        {
          "goNaam": "ParentA",
          "goType": "*A",
          "bunTag": "\"rel:belongs-to,join:a_id=id,on_delete:cascade\"",
          "jsonTag": "\"-\""
        },
        {
          "goNaam": "Data",
          "goType": "[]A_U_Data",
          "bunTag": "\"rel:has-many,join:a_id=a_id,join:rel_id=rel_id\"",
          "jsonTag": "\"data,omitempty\""
        }
      ],
      "onderliggende": [
        { "rolnaam": "Data", "jsonRolnaam": "data", "doeltype": "A_U_Data", "momentvoorkomen": "enkelvoudig" }
      ]
    },
    {
      "typenaam": "A_U_Data",
      "description": "Geversioned inhoud van A_U",
      "metatype": "gegevenselement",
      "geSubtype": "data",
      "tabelnaam": "a_u_data",
      "idKolom": "versie",
      "heeftPFK": true,
      "relatieveAutoincrement": true,
      "entiteitIDKolom": "a_id",
      "bovenliggendTypenaam": "A_U",
      "velden": [
        { "naam": "a_id", "goNaam": "A_ID", "goType": "int", "bunTag": "\"a_id,pk\"" },
        { "naam": "rel_id", "goNaam": "Rel_ID", "goType": "int", "bunTag": "\"rel_id,pk\"" },
        { "naam": "versie", "goNaam": "Versie", "goType": "int64", "bunTag": "\"versie,pk,autoincrement\"" },
        { "naam": "aaa", "goNaam": "Aaa", "goType": "string" },
        { "naam": "bbb", "goNaam": "Bbb", "goType": "*bool" }
      ]
    }
  ]
}
```

### Structuur van het formaat

| Sectie | Doel | Herkomst |
|--------|------|----------|
| `enums[]` | Enum type-definities met Go const-namen | Nieuw (niet in GetSchema) |
| `types[].velden[]` | Structuurvelden met Go-types en bun/json-tags | Uitbreiding van GetSchema |
| `types[].bunRelatieVelden[]` | Bun has-many/belongs-to relaties | Nieuw (niet in GetSchema) |
| `types[].padnaam` | URL-pad voor MetaRegistry | Nieuw (was al in MetaRegistry, niet in schema) |
| `types[].dataTypenaam` | Link van hub naar _Data type | Nieuw |
| `types[].geSubtype` | hub/data/aanvang/einde classificatie | Al in GetSchema |
| `types[].onderliggende[]` | Hiërarchie voor GeefOnderliggende | Al in GetSchema |

### Wat is afleidbaar via naamconventies?

Veel waarden zijn **conventie-gebaseerd afleidbaar** uit de typenaam en de naamconventies in §4. Een code generator kan met minimale input werken als hij de conventies kent:

| Waarde | Conventie | Voorbeeld |
|--------|-----------|-----------|
| Tabelnaam | `snake_case(typenaam)` | `A_U` → `a_u` |
| Bun alias | = tabelnaam | `alias:a_u` |
| JSON veldnaam | `snake_case(GE-naam)` | A_U → `u` (NB: afkortingsregel) |
| Padnaam | tabelnaam + `s` | `a_u` → `a_us` |
| FK-kolomnaam | `snake_case(entiteitsnaam) + _id` | A → `a_id` |
| Data-typenaam | `{hub}_Data` | `A_U` → `A_U_Data` |
| Aanvang-typenaam | `{type}_Aanvang` | `A` → `A_Aanvang` |
| Factory | `func() Representatie { return &{Type}{} }` | `&A_U{}` |
| Bun has-many join (ENT→hub) | `join:id={ent_id_kolom}` | `join:id=a_id` |
| Bun has-many join (hub→data) | `join:{ent_id_kolom}={ent_id_kolom},join:rel_id=rel_id` | `join:a_id=a_id,join:rel_id=rel_id` |

→ Bij strikte naleving van de conventies volstaat een **vereenvoudigd** inputformaat met alleen:
- Entiteiten + hun GEs/relaties (naam, description, kleur, isMaterieel, momentvoorkomen)
- Per GE/relatie: de inhoudsvelden (naam, Go-type, bun-type-override, enum-ref, verplicht)
- Enum-definities
- Relatie-specifieke info (secundaire entiteit)

De rest (tabelnaam, padnaam, FK-kolommen, bun-tags, factories, methoden) is afleidbaar.

### Samenvatting

| Bron | Geschiktheid als codegen-input |
|------|-------------------------------|
| GetSchema API response | **Onvoldoende**: mist Go-types, bun-tags, enum-definities, padnaam, relatie-joins |
| MetaRegistry (intern) | **Bijna voldoende**: mist Go-types en bun-tags voor de struct-velden zelf |
| Voorgesteld codegen-formaat | **Volledig**: alle informatie expliciet aanwezig |
| Vereenvoudigd formaat + conventies | **Volledig**: minimale input, conventies vullen de rest aan |

De aanbeveling is om het **vereenvoudigd formaat** te gebruiken als input voor de code generator, met een conventie-engine die de afleidbare waarden invult. Dit minimaliseert de complexiteit van de input en maximaliseert de onderhoudbaarheid.
