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

### Voorgesteld codegen-inputformaat (v3 — vereenvoudigd)

De `jsonTag` en `bunTag` waarden zijn **volledig afleidbaar** uit het metatype, de veldrol en het Go-type (zie afleidingsregels hieronder). Ze zijn daarom uit het inputformaat verwijderd.

Evenzo zijn de plumbing-velden (`id`, `{ent}_id`, `rel_id`, `versie`, `opvoer`, `afvoer`, `datum`) en bun-relatievelden (`ParentX`, `Data`, `Aanvang`, `Einde`) altijd identiek per metatype. Die hoeven **niet** als input: de code generator voegt ze automatisch toe op basis van metatype + geSubtype + isMaterieel.

Daarnaast zijn `tabelnaam`, `idKolom`, `heeftPFK`, `relatieveAutoincrement`, `entiteitIDKolom`, `bovenliggendTypenaam` en `goNaam` allemaal afleidbaar uit de typenaam en het metatype (zie afleidbaarheidstabel).

Het inputformaat bevat alleen wat **niet afleidbaar** is:

```json
{
  "versie": "v3",
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
      "weergave": { "placeholder": "1234 AB", "inputMask": "0000 AA" }
    },
    {
      "naam": "BSN",
      "description": "Burgerservicenummer (9 cijfers, 11-proef)",
      "basistype": "string",
      "format": "bsn",
      "validatie": {
        "pattern": "^[0-9]{9}$",
        "foutmelding": "Voer een geldig BSN in (9 cijfers, 11-proef)",
        "regels": [
          { "naam": "11-proef", "type": "checksum", "expressie": "(9*d1 + 8*d2 + 7*d3 + 6*d4 + 5*d5 + 4*d6 + 3*d7 + 2*d8 - 1*d9) % 11 == 0" }
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
    }
  ],
  "entiteiten": [
    {
      "typenaam": "A",
      "description": "Entiteit A",
      "isMaterieel": true,
      "kleur": "#bfdbfe",
      "meervoud": "as",
      "gegevenselementen": [
        {
          "naam": "U",
          "description": "Gegevenselement U bij A",
          "meervoud": "a-us",
          "momentvoorkomen": "enkelvoudig",
          "velden": [
            { "naam": "aaa", "goType": "string" },
            { "naam": "bbb", "goType": "*bool" }
          ]
        },
        {
          "naam": "V",
          "description": "Gegevenselement V bij A",
          "meervoud": "a-vs",
          "momentvoorkomen": "meervoudig",
          "velden": [
            { "naam": "ccc", "goType": "string" },
            { "naam": "ddd", "goType": "*string" },
            { "naam": "eee", "goType": "*string" },
            { "naam": "fff", "goType": "float64" },
            { "naam": "ggg", "goType": "ABCEnum", "enum": "ABCEnum" },
            { "naam": "datum", "goType": "*Date" }
          ]
        },
        {
          "naam": "W",
          "description": "Gegevenselement W bij A (materieel)",
          "meervoud": "a-ws",
          "momentvoorkomen": "enkelvoudig",
          "isMaterieel": true,
          "velden": [
            { "naam": "float", "goType": "float64" },
            { "naam": "heel", "goType": "int" }
          ]
        }
      ],
      "relaties": [
        {
          "naam": "Rel_A_B",
          "description": "Relatie tussen A en B",
          "meervoud": "rel-a-bs",
          "momentvoorkomen": "meervoudig",
          "isMaterieel": true,
          "doelEntiteit": "B",
          "velden": [
            { "naam": "soort", "goType": "RelABSoort", "enum": "RelABSoort" }
          ]
        }
      ]
    },
    {
      "typenaam": "B",
      "description": "Entiteit B",
      "isMaterieel": true,
      "kleur": "#fde68a",
      "meervoud": "bs",
      "gegevenselementen": [
        {
          "naam": "X",
          "description": "Gegevenselement X bij B",
          "meervoud": "b-xs",
          "momentvoorkomen": "enkelvoudig",
          "velden": [
            { "naam": "fff", "goType": "string" },
            { "naam": "ggg", "goType": "string" }
          ]
        },
        {
          "naam": "Y",
          "description": "Gegevenselement Y bij B",
          "meervoud": "b-ys",
          "momentvoorkomen": "enkelvoudig",
          "velden": [
            { "naam": "hhh", "goType": "string" }
          ]
        }
      ]
    }
  ]
}
```

Dit formaat beschrijft **alleen de domeinkennis**: welke entiteiten bestaan er, welke GE's en relaties hebben ze, en welke inhoudsvelden zitten daarin. De volledige Go-structuren (structs, tags, plumbing, MetaRegistry entries) worden door de code generator afgeleid.

### Afleidingsregels voor tags

De code generator leidt alle struct tags af op basis van het metatype en het Go-type van het veld.

#### jsonTag-regels

| Situatie | Regel | Voorbeeld |
|----------|-------|-----------|
| Value-type (string, int, float64, enum) | `json:"{snake_case(naam)}"` | `Aaa string` → `json:"aaa"` |
| Pointer-type (*bool, *string, *Date, *time.Time) | `json:"{snake_case(naam)},omitempty"` | `Bbb *bool` → `json:"bbb,omitempty"` |
| Slice-type ([]A_U, []A_U_Data) | `json:"{snake_case(rolnaam)},omitempty"` | `Us []A_U` → `json:"us,omitempty"` |
| Versie int64 | `json:"versie,omitempty"` | Altijd omitempty |
| Parent-relatie (*A, *B) | `json:"-"` | Altijd verborgen |

> **NB**: wanneer we overgaan naar camelCase conform de API Design Rules, wordt `snake_case(naam)` vervangen door `camelCase(naam)`. De afleidingslogica blijft identiek; alleen de case-conversie verandert.

#### bunTag-regels

| Situatie | Regel | Voorbeeld |
|----------|-------|-----------|
| Entiteit PK (ID) | `bun:"id,pk"` | Vast |
| FK naar eigen entiteit | `bun:"{ent_id_kolom},pk"` | `A_ID` → `bun:"a_id,pk"` |
| Rel_ID op **hub** | `bun:"rel_id,pk,autoincrement"` | Relatieve autoincrement |
| Rel_ID op **data/aanvang/einde** | `bun:"rel_id,pk"` | Geen autoincrement |
| Versie op **data/aanvang/einde** | `bun:"versie,pk,autoincrement"` | Versie-autoincrement |
| Opvoer / Afvoer | *(geen bun tag)* | Plumbing, niet in DB |
| `*Date` velden | `bun:"{snake_case(naam)},type:date"` | `Datum *Date` → `bun:"datum,type:date"` |
| Overige inhoudsvelden | *(geen bun tag)* | Bun leidt kolomnaam af uit Go-veldnaam |
| Input structs | *(nooit bun tags)* | Input is JSON-only |

#### bunRelatieVeld-regels

| Relatie | bunTag | jsonTag |
|---------|--------|---------|
| ENT → hub/aanvang/einde | `bun:"rel:has-many,join:id={ent_id_kolom}"` | `json:"{rolnaam},omitempty"` |
| Hub → ParentX | `bun:"rel:belongs-to,join:{ent_id_kolom}=id,on_delete:cascade"` | `json:"-"` |
| Hub → Data/Aanvang/Einde | `bun:"rel:has-many,join:{ent_id_kolom}={ent_id_kolom},join:rel_id=rel_id"` | `json:"{rolnaam},omitempty"` |

#### goNaam-regels

| Situatie | Regel | Voorbeeld |
|----------|-------|-----------|
| Regulier veld | `PascalCase(naam)` | `aaa` → `Aaa`, `soort` → `Soort` |
| ID op entiteit | `ID` | Vast |
| FK naar entiteit | `{ENT}_ID` | `A_ID`, `B_ID` |
| Rel_ID | `Rel_ID` | Vast |
| Versie | `Versie` | Vast |

#### Plumbing-velden per metatype (automatisch toegevoegd)

| Metatype | Automatische velden |
|----------|-------------------|
| Entiteit | `ID`, `Opvoer`, `Afvoer` + bun-relaties naar onderliggende hubs/aanvang/einde |
| Hub | `{Ent}_ID`, `Rel_ID`, `ParentX`, `Opvoer`, `Afvoer`, `Data` + optioneel `Aanvang`/`Einde` (als isMaterieel) |
| Data | `{Ent}_ID`, `Rel_ID`, `Versie`, `Opvoer`, `Afvoer` |
| Aanvang/Einde | `{Ent}_ID`, (`Rel_ID` als GE/rel), `Versie`, `Datum`, `Opvoer`, `Afvoer` |
| Input | `{Ent}_ID`, `Rel_ID`, inhoudsvelden uit Data + `Aanvang`/`Einde` (als isMaterieel) |

### Structuur van het formaat

| Sectie | Doel |
|--------|------|
| `datatypes[]` | Custom gegevenstypen met validatie en weergave |
| `enums[]` | Enum type-definities met Go const-namen |
| `entiteiten[]` | Top-level entiteiten met kleur, meervoud, isMaterieel |
| `entiteiten[].gegevenselementen[]` | GE's met naam, meervoud, momentvoorkomen, inhoudsvelden |
| `entiteiten[].relaties[]` | Relaties met naam, meervoud, doelEntiteit, inhoudsvelden |

### Wat is afleidbaar via naamconventies?

Vrijwel alles is afleidbaar. De onderstaande tabel somt op wat de conventie-engine afleidt en wat expliciet opgegeven moet worden.

| Waarde | Afleidbaar? | Conventie / bron | Voorbeeld |
|--------|-------------|------------------|-----------|
| Tabelnaam | ✅ | `snake_case(typenaam)` | `A_U` → `a_u` |
| Bun alias | ✅ | = tabelnaam | `alias:a_u` |
| **jsonTag** | ✅ | Zie afleidingsregels hierboven | `Aaa string` → `json:"aaa"` |
| **bunTag** | ✅ | Zie afleidingsregels hierboven | `A_ID int` → `bun:"a_id,pk"` |
| **bunRelatieVelden** | ✅ | Vast patroon per metatype | ENT→hub: `rel:has-many,...` |
| **goNaam** | ✅ | `PascalCase(naam)` + vaste namen voor plumbing | `aaa` → `Aaa` |
| **Plumbing-velden** | ✅ | Vast per metatype (zie tabel hierboven) | Hub krijgt altijd {Ent}_ID, Rel_ID, etc. |
| idKolom | ✅ | `id` (ent), `rel_id` (hub), `versie` (data/aanv/einde) | — |
| heeftPFK | ✅ | `metatype != entiteit` | — |
| relatieveAutoincrement | ✅ | `metatype != entiteit` | — |
| entiteitIDKolom | ✅ | `snake_case(parent_ent) + _id` | A → `a_id` |
| Data-typenaam | ✅ | `{hub}_Data` | `A_U` → `A_U_Data` |
| Aanvang/Einde-typenaam | ✅ | `{type}_Aanvang` / `{type}_Einde` | `A` → `A_Aanvang` |
| Factory/SliceFactory | ✅ | `func() Representatie { return &{Type}{} }` | `&A_U{}` |
| FK-kolomnaam | ✅ | `snake_case(entiteitsnaam) + _id` | A → `a_id` |
| Bun join-clausules | ✅ | Vast patroon op basis van entiteitIDKolom | `join:id=a_id` |
| Input-struct | ✅ | Hub-velden + Data-inhoudsvelden + Aanvang/Einde (als materieel) | — |
| **Padnaam (meervoud)** | ❌ | Onregelmatig NL meervoud | `persoon` → `personen` |

→ Het v3 codegen-inputformaat hierboven bevat **alleen wat niet afleidbaar is**:
- Entiteiten + hun GEs/relaties (naam, description, kleur, isMaterieel, momentvoorkomen)
- Per GE/relatie: de **inhoudsvelden** (naam + goType; optioneel enum-ref)
- **Meervoudsnaam** per type (expliciet, niet afleidbaar)
- Enum-definities
- Relatie-specifieke info (doelEntiteit)
- Custom gegevenstypen (datatypes) met validatie- en weergaveregels

Al het andere (tabelnaam, FK-kolommen, alle struct tags, plumbing-velden, bun-relaties, factories, MetaRegistry entries, Input-structs) wordt door de conventie-engine afgeleid.

### Samenvatting

| Bron | Geschiktheid als codegen-input |
|------|-------------------------------|
| GetSchema API response | **Onvoldoende**: mist Go-types, enum-definities, meervouden |
| MetaRegistry (intern) | **Bijna voldoende**: mist Go-types voor de inhoudsvelden |
| Codegen-formaat v3 (hierboven) | **Volledig + minimaal**: alleen domeinkennis, rest afgeleid |

De aanbeveling is om het **v3 formaat** te gebruiken als input voor de code generator. Dit formaat bevat uitsluitend domeinkennis; de conventie-engine leidt alle structurele code af. Het meervoud (padnaam) is de belangrijkste niet-afleidbare waarde.

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

---

## 7. Schema-API, versioning en code-generatie workflow

### Context

Het v3 codegen-formaat (§5) is de minimale beschrijving van een registermodel. Tegelijkertijd heeft het draaiende register al een `/api/viz/schema` endpoint dat een frontend-gerichte view retourneert. De vraag is hoe deze twee zich verhouden, hoe het model te exposen/importeren, en hoe de code-generatie in het ontwikkelproces past.

### Relatie v3-formaat en huidige GetSchema

Het v3-formaat en de huidige `/api/viz/schema` response zijn **twee complementaire projecties** van dezelfde waarheid. Geen van beide is een superset van de ander:

| Aspect | `GET /api/viz/schema` (huidig) | v3 codegen-formaat (§5) |
|--------|-------------------------------|------------------------|
| Structuur | Plat: alle 22 types op één niveau | Hiërarchisch: entiteit → GE/rel |
| Veldtypen | JSON-typen (`integer`, `string`) + `format` | Go-typen (`int`, `*bool`, `float64`) |
| Enums | Inline op velden (`enum: ["LTT","LAT"]`) | Aparte sectie met Go const-namen |
| Meervoud/padnaam | Ontbreekt | Aanwezig |
| Datatypes | Ontbreekt | Aanwezig |
| goType/goNaam | Ontbreekt | Aanwezig (op inhoudsvelden) |
| Plumbing-velden | Expliciet (via reflectie) | Niet in input (afgeleid door conventie-engine) |
| Afleidbare metadata | Expliciet (tabelnaam, idKolom, etc.) | Niet in input (afgeleid) |

Beide zijn **afleidbaar uit v3 + de conventie-engine**: de huidige `/viz/schema` is wat reflectie + MetaRegistry opleveren voor de frontend; v3 is de minimale bron waaruit alles gegenereerd wordt.

### Twee schema-endpoints

| Endpoint | Methode | Doel |
|----------|---------|------|
| `GET /api/viz/schema` | GET | Bestaande frontend-view (JSON-types, gefilterde velden) — **ongewijzigd** |
| `GET /api/schema/model` | GET | Retourneert het actieve registermodel in v3-formaat plus response-metadata |
| `GET /api/schema/model/code` | GET | Retourneert expliciet de actuele code-toestand van het registermodel, onafhankelijk van de database |
| `GET /api/schema/model/:id` | GET | Retourneert een specifieke opgeslagen schema-versie uit de database |
| `POST /api/schema/model` | POST | Accepteert een nieuw v3-model als *proposed* versie, met wrapper-metadata van de inzender |

De `GET /api/schema/model` response bevat het v3-model onder `model`, plus metadata daaromheen. Daarbij betekent `bron` de herkomst van de API-response zelf (`database` of `metaregistry` fallback), `model_bron` de herkomst van het opgeslagen of ingediende model, en `model_versie` de semantische versie uit `model.versie`.

De endpoint `GET /api/schema/model/code` leest nooit uit `schema_versies`, maar exporteert altijd rechtstreeks uit de actuele code via de MetaRegistry/V3-exporter. De response gebruikt `bron="code"` en `model_bron="code"`. Optioneel kunnen de velden `model_naam`, `model_beschrijving`, `model_versie`, `build_versie`, `go_module`, `indiener` en `opmerking` voor deze code-export via environment variables worden meegegeven: `SCHEMA_CODE_MODEL_NAAM`, `SCHEMA_CODE_MODEL_BESCHRIJVING`, `SCHEMA_CODE_MODEL_VERSIE`, `SCHEMA_CODE_BUILD_VERSIE`, `SCHEMA_CODE_GO_MODULE`, `SCHEMA_CODE_INDIENER`, `SCHEMA_CODE_OPMERKING`.

De endpoint `GET /api/schema/model/:id` leest altijd direct uit `schema_versies` en geeft daarom ook proposals, gearchiveerde versies en de huidige actieve versie terug, zolang het betreffende ID in de database bestaat. Er is voor deze route bewust geen fallback naar de MetaRegistry.

De endpoint `GET /api/schema/versies` retourneert per rij ook een `model_url`, zodat clients of tooling direct kunnen navigeren naar de volledige representatie van een specifieke schemaversie. Voor rijen met `status='proposed'` wordt aanvullend een `activeer_url` meegegeven, zodat de activatie-flow direct vanuit dezelfde lijst kan worden gestart.

Voor sneller zoeken ondersteunt `GET /api/schema/versies` ook query-parameters:
- `model_naam=<tekst>` voor case-insensitive filter op modelnaam (contains)
- `sort=id_desc|id_asc|model_naam_asc|model_naam_desc` voor sortering

Voor vindbaarheid bevat het top-level `model` ook `naam` en `beschrijving`. Deze worden naast het JSON-model expliciet opgeslagen in `schema_versies` als `model_naam` en `model_beschrijving`, zodat versies snel doorzoekbaar en herkenbaar zijn zonder eerst de volledige JSON te parsen.

Bij `POST /api/schema/model` is de request-body bij voorkeur van de vorm `{ "bron": "...", "indiener": "...", "model": { ... } }`. De velden `bron` en `indiener` horen dus bij de inzending, terwijl `model.versie` een eigenschap van het model zelf blijft.

### Schema-versioning in de database

Een `schema_versies` tabel slaat het volledige model op als JSON-blob:

```sql
CREATE TABLE schema_versies (
  id            SERIAL PRIMARY KEY,
    tijdstip      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    schema_json   JSONB NOT NULL,          -- het volledige v3-model
  bron          TEXT,                    -- bron van de inzending, bijv. "metaregistry" of "uml-editor"
  indiener      TEXT,                    -- naam of systeem van de indiener
  model_versie  TEXT,                    -- semantische versie uit model.versie
  model_naam    TEXT,                    -- herkenbare modelnaam uit model.naam
  model_beschrijving TEXT,               -- korte beschrijving uit model.beschrijving
    build_versie  TEXT,                     -- bijv. "v06-build-42" of git commit hash
    go_module     TEXT,                     -- bijv. "bitemp_register_v06"
    status        TEXT NOT NULL DEFAULT 'proposed',  -- proposed | active | archived
    opmerking     TEXT
);
```

**Lifecycle van een schemaversie:**

1. **Eerste deploy**: `INSERT ... status='active'` met het huidige model
2. **Nieuw voorstel** (via UML-editor of handmatig): `POST /api/schema/model` → `INSERT ... status='proposed'`
3. **Na succesvolle codegen + build + deploy**:
   - `UPDATE SET status='archived' WHERE status='active'`
  - `UPDATE SET status='active' WHERE id={nieuw}`
4. **Verworpen voorstel**: `UPDATE SET status='archived' WHERE id={voorstel}`

Het draaiende register levert bij `GET /api/schema/model` altijd de rij met `status='active'`.

### Code-generatie workflow

```
                           ┌──────────────┐
                           │  UML-editor  │
                           │  (browser)   │
                           └──┬───────┬───┘
                    [1] fetch │       │  [2] upload
                    GET model │       │  POST model
                              ▼       ▼
                        ┌──────────────────┐
                        │    Register      │
                        │   (draaiend)     │
                        │                  │
                        │  schema_versies  │
                        │  tabel (JSONB)   │
                        └────────┬─────────┘
                                 │
                    [3] fetch    │  GET model (of: lees bestand)
                                 │
                                 ▼
                        ┌──────────────────┐
                        │   model.json     │
                        │   (bestand)      │
                        └────────┬─────────┘
                                 │
                    [4] codegen  │  go run ./cmd/codegen --input model.json
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  gegenereerde    │
                        │  Go-bestanden    │
                        │  (model/*.go)    │
                        └────────┬─────────┘
                                 │
                    [5] build    │  go build ./... && go test ./...
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  nieuwe app      │
                        │  binary          │
                        └──────────────────┘
```

**Legenda pijlen**: alle pijlen zijn **dataflows** — ze tonen welke data waarheen stroomt. De nummering geeft de volgorde in het proces aan:

| Stap | Pijl | Dataflow | Beschrijving |
|------|------|----------|-------------|
| [1] | UML-editor → Register | HTTP GET response | De editor haalt het actieve model op in v3-formaat |
| [2] | UML-editor → Register | HTTP POST request body | De editor stuurt een bewerkt model terug als *proposed* versie |
| [3] | Register → model.json | HTTP GET response of file export | De developer haalt het model op als lokaal bestand |
| [4] | model.json → Go-bestanden | Code-generatie (file I/O) | De codegen CLI leest de JSON en schrijft `.go`-bestanden |
| [5] | Go-bestanden → binary | Compilatie (go build) | Go compiler bouwt de nieuwe applicatie |

Stappen [1] en [2] zijn **HTTP-calls vanuit de browser**. Stappen [3]–[5] zijn **lokale acties op de ontwikkelmachine**.

### Code generator als Go CLI tool

```
cmd/codegen/
├── main.go           -- entry point: leest JSON, roept generators aan
├── conventions.go    -- de conventie-engine (afleiding tags, plumbing, etc.)
├── gen_structs.go    -- genereert modellen_entiteiten.go + modellen_ge_rel.go
├── gen_methods.go    -- genereert modellen_methods.go
├── gen_input.go      -- genereert modellen_input.go
├── gen_registry.go   -- genereert metaregistry.go
└── templates/        -- Go text/template bestanden (optioneel)
```

**Starten:**

```sh
# Vanuit een geëxporteerd bestand:
go run ./cmd/codegen --input model.json --output model/

# Of rechtstreeks vanuit een draaiend register:
go run ./cmd/codegen --from-url http://localhost:8080/api/schema/model --output model/

# Daarna:
go build ./...
go test ./...
```

Dit is puur een **dev-tool** — het draait alleen op de ontwikkelmachine. De `cmd/codegen/` map wordt niet mee-gecompileerd in de server-binary (Go compileert alleen wat vanuit de server `main.go` bereikbaar is).

**Alternatief: `go generate`** (voor integratie in de build-pipeline):

```go
//go:generate go run ./cmd/codegen --input model.json --output .
```

### Delta-analyse (toekomst)

Bij een upgrade van het metamodel is het waardevol om een **delta** te bepalen tussen de huidige en de voorgestelde versie. Deze delta kan achterhalen of de upgrade breaking of non-breaking is:

| Wijziging | Impact | Voorbeeld |
|-----------|--------|-----------|
| Nieuw GE/relatie toegevoegd | Non-breaking | Nieuwe tabel, bestaande data ongewijzigd |
| Nieuw nullable veld toegevoegd | Non-breaking | Nieuwe kolom met NULL als default |
| Veld verwijderd | **Breaking** | Kolom met data verdwijnt |
| Veldtype gewijzigd | **Breaking** | Type-conversie nodig |
| Entiteit verwijderd | **Breaking** | Tabel met data verdwijnt |
| Meervoud/padnaam gewijzigd | Non-breaking (URL-wijziging) | Clients moeten updaten |

Dit kan later als aparte CLI tool (`cmd/schemadiff/`) naast `cmd/codegen/`, die twee v3-JSON's vergelijkt en een migratierapport genereert. Eventueel ook DDL-migratiescripts (`ALTER TABLE ADD COLUMN ...`).

### Beslissingen

| Vraag | Beslissing | Motivatie |
|-------|-----------|-----------|
| Canoniek formaat? | v3 (§5) is de source of truth | Minimaal, hiërarchisch, roundtrip-capable |
| Bestaande `/viz/schema`? | Blijft ongewijzigd als frontend-view | Backward compatible, andere projectie |
| Nieuw model-endpoint? | `GET/POST /api/schema/model` | Scheiding van concerns: model vs. view |
| Opslag in DB? | `schema_versies` tabel met JSONB | Eenvoudig, versioneerbaar, geen relationeel schema nodig |
| Wat opslaan per versie? | schema_json + build_versie + go_module + status + opmerking | Traceerbaarheid naar code |
| Codegen waar? | `cmd/codegen/` als Go CLI | Dev-only, niet in productie-binary |
| Codegen starten? | `go run ./cmd/codegen --input model.json` | Standaard Go tooling, geen externe dependencies |
| Delta-analyse? | Later als `cmd/schemadiff/` | Waardevol maar apart verhaal |
