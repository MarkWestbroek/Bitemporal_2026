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

## 4. Naamconventies

### Referentiekader: NL.gov API Design Rules

Dit project richt zich op de Nederlandse overheid (Common Ground / VNG). De [NLGov REST API Design Rules](https://logius-standaarden.github.io/API-Design-Rules/) (Logius-standaard, v2.1.0) stellen verplichte (MUST) en aanbevolen (SHOULD) regels voor naamgeving:

| Regel | Kracht | Domein | Eis |
|-------|--------|--------|-----|
| `/core/path-segments-kebab-case` | MUST | URL-paden | Alleen lowercase letters, cijfers, hyphens (`-`) |
| `/core/query-keys-camel-case` | MUST | Query-parameters | lower camelCase |
| `/core/naming-collections` | MUST | URL collecties | Meervoud zelfstandig naamwoord |
| `/core/naming-resources` | MUST | URL resources | Zelfstandig naamwoord (geen werkwoord) |
| `/core/interface-language` | SHOULD | Interface-taal | Nederlands, tenzij officieel Engels glossarium |
| `/core/nested-child` | SHOULD | Kind-resources | Geneste URI's voor child-resources |

### Gevolgen voor vier naamruimten

We onderscheiden vier naamruimten met elk hun eigen conventie:

| Naamruimte | Conventie | Door wie bepaald | Voorbeeld |
|------------|-----------|-----------------|-----------|
| **Go** (types, velden) | PascalCase | Go-conventie | `Persoon`, `Adres`, `RelPersoonAdres` |
| **Database** (tabellen, kolommen) | snake_case | PostgreSQL-conventie | `persoon`, `adres`, `rel_persoon_adres` |
| **URL-paden** | **kebab-case, meervoud** | NL.gov API Design Rules | `/personen`, `/adressen`, `/relaties-persoon-adres` |
| **JSON** (veldnamen, query-keys) | **camelCase** | NL.gov API Design Rules | `persoonId`, `relId`, `aanvangDatum` |

> **N.B.**: De huidige v06-code gebruikt nog snake_case voor URL-paden en JSON-velden. Dit wordt bij de migratie naar het codegen-formaat omgezet naar kebab-case resp. camelCase.

### Structuurnaamgeving (NIEUW — API Design Rules-conform)

Gegeven een entiteit `E` (bijv. Persoon) met gegevenselement `G` (bijv. Adres):

| Concept | Go-type | Tabelnaam (DB) | JSON-veld | URL-pad (collectie) |
|---------|---------|----------------|-----------|---------------------|
| Entiteit | `E` | `e` | `e` | **`{meervoud}`** ← expliciet geconfigureerd |
| GE-hub | `E_G` | `e_g` | `g` | **`{meervoud}`** ← expliciet geconfigureerd |
| GE-data | `E_G_Data` | `e_g_data` | `eGData` | `{kebab(tabelnaam)}` |
| GE-input | `E_G_Input` | — | (platte velden) | — |
| GE-aanvang | `E_G_Aanvang` | `e_g_aanvang` | `eGAanvang` | `{kebab(tabelnaam)}` |
| GE-einde | `E_G_Einde` | `e_g_einde` | `eGEinde` | `{kebab(tabelnaam)}` |
| ENT-aanvang | `E_Aanvang` | `e_aanvang` | `eAanvang` | `{kebab(tabelnaam)}` |
| ENT-einde | `E_Einde` | `e_einde` | `eEinde` | `{kebab(tabelnaam)}` |
| Relatie-hub | `Rel_E_F` | `rel_e_f` | `relEF` | **`{meervoud}`** ← expliciet geconfigureerd |
| Relatie-data | `Rel_E_F_Data` | `rel_e_f_data` | `relEFData` | `{kebab(tabelnaam)}` |
| Relatie-input | `Rel_E_F_Input` | — | (platte velden) | — |

**Key insight**: `{meervoud}` is NIET afleidbaar en moet expliciet in de codegen-input staan (zie §4.3).

### Nederlandse meervoudsvormen: configureren, niet afleiden

Nederlandse meervouden kennen te veel uitzonderingen voor algoritmische afleiding:

| Enkelvoud | Meervoud | Patroon |
|-----------|----------|---------|
| regel | regels | +s |
| bos | bossen | verdubbeling + en |
| knop | knoppen | verdubbeling + en |
| knoop | knopen | +en |
| persoon | personen | +en |
| koe | koeien | +ien |
| kind | kinderen | +eren |
| adres | adressen | verdubbeling + en |
| registratie | registraties | +s |
| wijziging | wijzigingen | +en |

**Besluit**: het meervoud van elke collectie-resource wordt **expliciet geconfigureerd** in de codegen-input, niet afgeleid. De conventie-engine laat `Padnaam` (= collectie-pad in kebab-case meervoud) dus **niet** automatisch invullen.

> Bovendien: ook de **enkelvoudsnaam** in het URL-pad kan afwijken van de Go-typenaam, bijv. Go-type `Rel_Persoon_Adres` → URL-pad enkelvoud `relatie-persoon-adres`, meervoud `relaties-persoon-adres`.

### Veldnaamconventies

| Context | DB/Go-patroon | JSON-patroon (camelCase) |
|---------|---------------|--------------------------|
| ENT FK-kolom in GE/REL-tabellen | `{e}_id` (snake_case) | `{e}Id` |
| Secundaire FK (relaties) | `{f}_id` | `{f}Id` |
| Relatieve ID | `rel_id` | `relId` |
| Versie PK (_Data, _Aanvang, _Einde) | `versie` | `versie` |
| Opvoer/afvoer (afgeleid) | `opvoer`, `afvoer` | `opvoer`, `afvoer` |
| Materieel datum | `datum` | `datum` |

> **N.B.**: Enkelvoudige Nederlandse woorden (opvoer, afvoer, datum, versie) zijn in camelCase identiek aan snake_case. De impact is vooral bij samengestelde namen zichtbaar (bijv. `a_id` → `aId`).

### Rolnaam-patronen (in OnderliggendeGegevenselementen)

| Parent | Kind-type | Rolnaam (Go) | JSONRolnaam (camelCase) |
|--------|-----------|-------------|--------------------------|
| ENT | GE-hub | `{G}s` (meervoud Go-veldnaam) | `{g}s` |
| ENT | REL-hub | `Rel{E}{F}s` | `rel{E}{F}s` |
| ENT | Aanvang-plumbing | `Aanvang` | `aanvang` |
| ENT | Einde-plumbing | `Einde` | `einde` |
| Hub | Data | `Data` | `data` |
| Hub | Aanvang (materieel) | `Aanvang` | `aanvang` |
| Hub | Einde (materieel) | `Einde` | `einde` |

### Impactanalyse huidige code (v06) → API Design Rules

#### URL-paden: snake_case → kebab-case

| Huidig (v06) | Nieuw (kebab-case) | Opmerking |
|--------------|-------------------|-----------|
| `/as` | `/as` | Geen change (geen underscore) |
| `/bs` | `/bs` | Idem |
| `/a_us` | `/a-us` | underscore → hyphen |
| `/a_vs` | `/a-vs` | idem |
| `/a_ws` | `/a-ws` | idem |
| `/b_xs` | `/b-xs` | idem |
| `/b_ys` | `/b-ys` | idem |
| `/rel_a_bs` | `/rel-a-bs` | idem |
| `/a_aanvang` | `/a-aanvang` | idem |
| `/a_einde` | `/a-einde` | idem |
| `/a_u_data` | `/a-u-data` | idem |
| `/rel_a_b_data` | `/rel-a-b-data` | idem |
| `/a_w_aanvang` | `/a-w-aanvang` | idem |
| `/rel_a_b_aanvang` | `/rel-a-b-aanvang` | idem |

In een echt domeinmodel worden de collectie-paden menselijk leesbaar, bijv.:
- `/personen`, `/adressen`, `/relaties-persoon-adres`

#### JSON-velden: snake_case → camelCase

| Context | Huidig | Nieuw |
|---------|--------|-------|
| FK-veld | `a_id` | `aId` |
| Relatieve ID | `rel_id` | `relId` |
| Rolnaam relatie | `rel_abs` | `relABs` |
| GE-data referentie | `a_u_data` | `aUData` |
| Aanvang/einde | `a_aanvang` | `aAanvang` |
| Enkelvoudige velden | `opvoer`, `datum` | `opvoer`, `datum` (ongewijzigd) |

> **Impact**: JSON-tags op alle structs moeten worden aangepast. De schema-API response verandert mee. De frontend leest veldnamen uit de schema-API, dus die past zich automatisch aan — mits de frontend geen hardcoded veldnamen bevat.

#### Scope van de wijzigingen

| Laag | Wat wijzigt | Automatisch? |
|------|------------|-------------|
| MetaRegistry `Padnaam` | kebab-case waarden | Ja, via codegen |
| MetaRegistry `Veldnaam` | camelCase waarden | Ja, via codegen |
| Struct JSON-tags | camelCase | Ja, via codegen |
| Route-registratie | Dynamisch uit `Padnaam` | Nee, geen aanpassing nodig |
| Handlers | Dynamisch uit MetaRegistry | Nee, geen aanpassing nodig |
| Schema-API | Dynamisch uit structs + MetaRegistry | Nee, geen aanpassing nodig |
| Frontend | Leest uit schema-API | Nee, als er geen hardcoded namen zijn |
| Database (tabellen/kolommen) | **Niet wijzigen** | N.v.t. — DB blijft snake_case |
| Postman/tests | Handmatig bijwerken | Ja |

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

### Voorgesteld codegen-inputformaat (v2 — API Design Rules-conform)

Hieronder het bijgewerkte JSON-formaat dat als input kan dienen voor het genereren van alle 5 bestanden.
Ten opzichte van v1 zijn de volgende wijzigingen:
- **`meervoud`** (padnaam) is verplicht en expliciet geconfigureerd (niet afleidbaar)
- **`datatypes`** sectie toegevoegd voor custom gegevenstypen
- JSON-veldnamen zijn **camelCase** conform `/core/query-keys-camel-case`
- URL-padnamen zijn **kebab-case meervoud** conform `/core/path-segments-kebab-case`

```json
{
  "versie": "v2",
  "datatypes": [
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
    },
    {
      "naam": "BSN",
      "description": "Burgerservicenummer (9 cijfers, 11-proef)",
      "basistype": "string",
      "format": "bsn",
      "validatie": {
        "pattern": "^[0-9]{9}$",
        "minLength": 9,
        "maxLength": 9,
        "foutmelding": "Voer een geldig BSN in (9 cijfers, 11-proef)",
        "regels": [
          {
            "naam": "11-proef",
            "type": "checksum",
            "expressie": "(9*d1 + 8*d2 + 7*d3 + 6*d4 + 5*d5 + 4*d6 + 3*d7 + 2*d8 - 1*d9) % 11 == 0"
          }
        ]
      },
      "weergave": { "placeholder": "123456782", "inputMask": "000000000" }
    }
  ],
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
      "meervoud": "as",
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
      "meervoud": "a-us",
      "tabelnaam": "a_u",
      "idKolom": "rel_id",
      "heeftPFK": true,
      "relatieveAutoincrement": true,
      "entiteitIDKolom": "a_id",
      "velden": [
        {
          "naam": "aId",
          "goNaam": "A_ID",
          "goType": "int",
          "jsonTag": "\"aId\"",
          "bunTag": "\"a_id,pk\"",
          "verplicht": true
        },
        {
          "naam": "relId",
          "goNaam": "Rel_ID",
          "goType": "int",
          "jsonTag": "\"relId\"",
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
        { "naam": "aId", "goNaam": "A_ID", "goType": "int", "bunTag": "\"a_id,pk\"" },
        { "naam": "relId", "goNaam": "Rel_ID", "goType": "int", "bunTag": "\"rel_id,pk\"" },
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
| `datatypes[]` | Custom gegevenstypen met validatie en weergave | Nieuw (uit gegevenstypen.md / UML-editor) |
| `enums[]` | Enum type-definities met Go const-namen | Nieuw (niet in GetSchema) |
| `types[].velden[]` | Structuurvelden met Go-types en bun/json-tags | Uitbreiding van GetSchema |
| `types[].bunRelatieVelden[]` | Bun has-many/belongs-to relaties | Nieuw (niet in GetSchema) |
| `types[].meervoud` | URL-padnaam (kebab-case meervoud) | Nieuw — verplicht, niet afleidbaar |
| `types[].dataTypenaam` | Link van hub naar _Data type | Nieuw |
| `types[].geSubtype` | hub/data/aanvang/einde classificatie | Al in GetSchema |
| `types[].onderliggende[]` | Hiërarchie voor GeefOnderliggende | Al in GetSchema |

### Wat is afleidbaar via naamconventies?

Veel waarden zijn **conventie-gebaseerd afleidbaar** uit de typenaam en de naamconventies in §4. Een code generator kan met minimale input werken als hij de conventies kent.

**Let op**: het `meervoud` (= padnaam) is **niet afleidbaar** via conventies, omdat Nederlandse meervoudsvorming onregelmatig is (zie §4). Dit veld **moet** altijd expliciet worden opgegeven in de codegen-input.

| Waarde | Afleidbaar? | Conventie | Voorbeeld |
|--------|-------------|-----------|-----------|
| Tabelnaam | ✅ ja | `snake_case(typenaam)` | `A_U` → `a_u` |
| Bun alias | ✅ ja | = tabelnaam | `alias:a_u` |
| JSON veldnaam | ✅ ja | `camelCase(veldnaam)` | `a_id` → `aId` |
| **Padnaam (meervoud)** | ❌ **nee** | Onregelmatig NL meervoud | `persoon` → `personen` (niet `persoons`) |
| FK-kolomnaam | ✅ ja | `snake_case(entiteitsnaam) + _id` | A → `a_id` |
| Data-typenaam | ✅ ja | `{hub}_Data` | `A_U` → `A_U_Data` |
| Aanvang-typenaam | ✅ ja | `{type}_Aanvang` | `A` → `A_Aanvang` |
| Factory | ✅ ja | `func() Representatie { return &{Type}{} }` | `&A_U{}` |
| Bun has-many join (ENT→hub) | ✅ ja | `join:id={ent_id_kolom}` | `join:id=a_id` |
| Bun has-many join (hub→data) | ✅ ja | `join:{ent_id_kolom}={ent_id_kolom},join:rel_id=rel_id` | `join:a_id=a_id,join:rel_id=rel_id` |

→ Bij strikte naleving van de conventies volstaat een **vereenvoudigd** inputformaat met alleen:
- Entiteiten + hun GEs/relaties (naam, description, kleur, isMaterieel, momentvoorkomen)
- Per GE/relatie: de inhoudsvelden (naam, Go-type, bun-type-override, enum-ref, verplicht)
- **Meervoudsnaam** per type (expliciet, niet afleidbaar)
- Enum-definities
- Relatie-specifieke info (secundaire entiteit)
- Custom gegevenstypen (datatypes) met validatie- en weergaveregels

De rest (tabelnaam, FK-kolommen, bun-tags, factories, methoden) is afleidbaar.

### Samenvatting

| Bron | Geschiktheid als codegen-input |
|------|-------------------------------|
| GetSchema API response | **Onvoldoende**: mist Go-types, bun-tags, enum-definities, padnaam, relatie-joins |
| MetaRegistry (intern) | **Bijna voldoende**: mist Go-types en bun-tags voor de struct-velden zelf |
| Voorgesteld codegen-formaat (v2) | **Volledig**: alle informatie expliciet aanwezig, inclusief datatypes en meervouden |
| Vereenvoudigd formaat + conventies | **Volledig**: minimale input, conventies vullen de rest aan — mits `meervoud` expliciet |

De aanbeveling is om het **vereenvoudigd formaat** te gebruiken als input voor de code generator, met een conventie-engine die de afleidbare waarden invult. Dit minimaliseert de complexiteit van de input en maximaliseert de onderhoudbaarheid. Het meervoud (padnaam) is de belangrijkste waarde die **niet** door de conventie-engine kan worden afgeleid.

---

## 6. Gegevenstypen — custom datatypes met validatie

### Context

Naast de standaard Go/JSON-basistypes (string, int, bool, time.Time) heeft het register behoefte aan **domeinspecifieke gegevenstypen** met eigen validatie, normalisatie en weergave-instructies. Denk aan BSN (met 11-proef), NL-postcode, IBAN, percentage, etc.

Deze specificatie is gebaseerd op `gegevenstypen.md` uit het UML-editor project (`D:\Git\UML-editor\gegevenstypen.md`), dat de frontend-kant al beschrijft. Hier documenteren we de integratie met het Go-register.

### Ontwerp

Gegevenstypen worden gemodelleerd als **formele Go-types** met een eigen registry, analoog aan de MetaRegistry. Ze worden:

1. Als aparte `DatatypeRegistry` naast de MetaRegistry geplaatst
2. Beschikbaar gesteld via de schema-API (`/schema` response krijgt een `datatypes` array)
3. Gerefereerd vanuit struct-velden via een `schema:"format=..."` tag

De frontend leest de datatypes uit de schema-API en past validatie, normalisatie en weergave toe op basis van het `format` veld.

### Go-structuren

```go
// DatatypeRegistry is de lijst van alle geregistreerde gegevenstypen
var DatatypeRegistry = []Datatype{
    NLPostcodeDatatype,
    BSNDatatype,
    // ...
}

// Datatype beschrijft een domeinspecifiek gegevenstype
type Datatype struct {
    Naam        string              `json:"naam"`        // PascalCase identifier, bijv. "NLPostcode"
    Description string              `json:"description"` // Mensleesbare beschrijving
    Basistype   string              `json:"basistype"`   // "string" | "integer" | "number" | "boolean"
    Format      string              `json:"format"`      // kebab-case identifier, bijv. "nl-postcode"
    Validatie   *DatatypeValidatie  `json:"validatie,omitempty"`
    Normalisatie string             `json:"normalisatie,omitempty"` // comma-separated: "uppercase_letters,trim"
    Weergave    *DatatypeWeergave   `json:"weergave,omitempty"`
}

// DatatypeValidatie bevat validatieregels voor een gegevenstype
type DatatypeValidatie struct {
    Pattern      string           `json:"pattern,omitempty"`      // regex
    MinLength    *int             `json:"minLength,omitempty"`
    MaxLength    *int             `json:"maxLength,omitempty"`
    Minimum      *float64         `json:"minimum,omitempty"`
    Maximum      *float64         `json:"maximum,omitempty"`
    MultipleOf   *float64         `json:"multipleOf,omitempty"`
    Voorbeelden  []string         `json:"voorbeelden,omitempty"`
    Foutmelding  string           `json:"foutmelding,omitempty"`
    Regels       []ValidatieRegel `json:"regels,omitempty"`
}

// ValidatieRegel beschrijft een complexe validatieregel (checksum, formule of functie)
type ValidatieRegel struct {
    Naam      string `json:"naam"`      // bijv. "11-proef"
    Type      string `json:"type"`      // "checksum" | "formula" | "function"
    Expressie string `json:"expressie"` // formule of functienaam
}

// DatatypeWeergave beschrijft weergave-instructies voor de frontend
type DatatypeWeergave struct {
    Placeholder string `json:"placeholder,omitempty"`
    InputMask   string `json:"inputMask,omitempty"`
    Prefix      string `json:"prefix,omitempty"`
    Suffix      string `json:"suffix,omitempty"`
}
```

### Referentie vanuit struct-velden

Een struct-veld refereert naar een gegevenstype via de `schema` tag:

```go
type Persoon_Data struct {
    // ...
    BSN      string `json:"bsn"      bun:"bsn"      schema:"format=bsn"`
    Postcode string `json:"postcode"  bun:"postcode"  schema:"format=nl-postcode"`
}
```

De schema-API leest de `schema` tag en koppelt het veld aan het bijbehorende gegevenstype uit de DatatypeRegistry. De frontend ontvangt daarmee automatisch de validatie- en weergaveregels.

### Schema-API uitbreiding

De `/schema` response wordt uitgebreid met een `datatypes` array:

```json
{
  "types": [ ... ],
  "datatypes": [
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
    },
    {
      "naam": "BSN",
      "description": "Burgerservicenummer (9 cijfers, 11-proef)",
      "basistype": "string",
      "format": "bsn",
      "validatie": {
        "pattern": "^[0-9]{9}$",
        "regels": [{ "naam": "11-proef", "type": "checksum", "expressie": "..." }],
        "foutmelding": "Voer een geldig BSN in (9 cijfers, 11-proef)"
      },
      "weergave": { "placeholder": "123456782" }
    }
  ]
}
```

### Validatiefuncties: Go en JavaScript

Complexe validatieregels met `type: "function"` (bijv. IBAN mod97) vereisen implementaties in **zowel Go als JavaScript**. Er moet een functieregister bestaan in beide talen:

| Taal | Locatie | Voorbeeld |
|------|---------|-----------|
| Go | `model/datatype_validatie.go` | `func BSN11Proef(waarde string) bool` |
| JavaScript | `web/vite/src/validatie/regels.js` | `export function bsn_11proef(waarde) { ... }` |

De functienaam in de `expressie` van een `ValidatieRegel` moet exact matchen met de geregistreerde functie in beide talen.

### Codegen-impact

In het codegen-inputformaat (§5) is de `datatypes` sectie nu opgenomen. De code generator:
1. Genereert de `DatatypeRegistry` variabele met alle gedefinieerde gegevenstypen
2. Genereert de Go validatiefuncties (skeleton) voor regels met `type: "function"`
3. Voegt `schema:"format=..."` tags toe aan struct-velden die een custom datatype gebruiken
4. Genereert de JavaScript validatiefuncties (skeleton) in `web/vite/src/validatie/`

### Beslissingen

| Vraag | Beslissing | Motivatie |
|-------|-----------|-----------|
| Waar plaatsen? | `model/datatypes.go` + `model/datatypes_registry.go` | Analoog aan model/metaregistry split |
| Referentie vanuit velden? | `schema:"format=..."` tag | Minimale impact op bestaande tags |
| String of apart Go-type? | Velden blijven `string`/`int`/etc. in Go | Validatie is runtime, niet compile-time |
| Schema-API contract? | `datatypes` array in `/schema` response | Frontend leest validatie/weergave hieruit |
| Normalisatie waar? | Frontend (JS) vóór versturen, Go bij ontvangst | Beide kanten normaliseren voor consistentie |
