# Codegen — Handleiding & Workflow

**Datum:** 2026-03-31  
**Status:** Roundtrip volledig gevalideerd (14/14 bestanden identiek)

Dit document beschrijft de volledige werkwijze voor het genereren, exporteren en verifiëren van modelcode in het bitemporele register.

## Inhoudsopgave

1. [Architectuuroverzicht](#1-architectuuroverzicht)
2. [Domeinen](#2-domeinen)
3. [Export: code → V3 JSON](#3-export-code--v3-json)
4. [Codegen: V3 JSON → code](#4-codegen-v3-json--code)
5. [Roundtrip-verificatie](#5-roundtrip-verificatie)
6. [Nieuw domein toevoegen](#6-nieuw-domein-toevoegen)
7. [Bestaand model wijzigen](#7-bestaand-model-wijzigen)
8. [Cross-domein relaties](#8-cross-domein-relaties)
9. [Bestandsoverzicht](#9-bestandsoverzicht)
10. [Veelgestelde vragen](#10-veelgestelde-vragen)
11. [Greenfield test — domeinonafhankelijkheid bewezen](#11-greenfield-test--domeinonafhankelijkheid-bewezen)

---

## 1. Architectuuroverzicht

```
┌─────────────────┐      export_v3      ┌──────────────┐       codegen        ┌─────────────────┐
│   Go code       │ ──────────────────► │   V3 JSON    │ ───────────────────► │   Go code       │
│   (model/*.go)  │                     │   (.json)    │                      │   (model/*.go)  │
└─────────────────┘                     └──────────────┘                      └─────────────────┘
        │                                     │                                       │
        ▼                                     ▼                                       ▼
  MetaRegistry                          UML editor                              MetaRegistry
  (runtime)                             (bewerken)                              (runtime)
```

De drie representaties van het model:

| Laag | Formaat | Bron |
|------|---------|------|
| **Code** | Go structs + MetaRegistry | `model/*.go` bestanden |
| **V3 JSON** | Platform-onafhankelijk JSON schema | `cmd/export_v3` of `GET /api/schema/model/code` |
| **Editor** | Visueel UML-achtig | React frontend (leest/schrijft V3 JSON) |

De **roundtrip** is: code → V3 JSON → code, en moet identieke output opleveren.

---

## 2. Domeinen

Het model is opgedeeld in **domeinen**. Elk domein heeft een eigen set gegenereerde bestanden.

| Domein | Prefix | Beschrijving |
|--------|--------|-------------|
| `register` | `register_` | Basisregistratie: Referentielijst, Land, etc. |
| `np-loc` | `np_loc_` | Natuurlijke personen en locaties |

### Register is altijd nodig

Het register-domein bevat de kern-entiteiten (Referentielijst, Land, AdellijkeTitel) waar andere domeinen afhankelijkheden op hebben. Plumbing-types (interfaces, MetaRegistryType, constanten) staan in `metaregistry_plumbing.go` en zijn domein-onafhankelijk.

### Init-volgorde

De init-volgorde is vastgelegd in `metaregistry_plumbing.go`:

```go
func init() {
    initRegisterMetaRegistry()     // register eerst
    initRegisterDatatypeRegistry()
    initRegisterEnumRegistry()
    initNpLocMetaRegistry()        // daarna domein-specifiek
}
```

Register-entries moeten eerst bestaan, zodat andere domeinen via `VoegOnderliggendGEToe()` verwijzingen kunnen toevoegen aan register-scope entiteiten.

---

## 3. Export: code → V3 JSON

### CLI

```sh
# Exporteer register-domein (inclusief entities van andere domeinen die register nodig hebben)
go run ./cmd/export_v3 --domein register > export_register.json

# Exporteer np-loc domein (bevat ook register-entiteiten, nodig als context)
go run ./cmd/export_v3 --domein np-loc > export_np_loc.json

# Strict export: alleen het opgegeven domein (geen register-context)
go run ./cmd/export_v3 --domein np-loc --strict > export_np_loc_strict.json
```

### Flags

| Flag | Beschrijving |
|------|-------------|
| `--domein` | Filtert op domein. Register-entiteiten worden altijd mee-geëxporteerd (behalve met `--strict`). |
| `--strict` | Exporteer *alleen* het opgegeven domein. Nuttig voor analyse, niet voor codegen. |

### PowerShell BOM-workaround

PowerShell's `>` redirect schrijft een BOM. Gebruik:

```powershell
$output = go run ./cmd/export_v3 --domein register 2>&1
[System.IO.File]::WriteAllText("$PWD\export.json", ($output -join "`n"), [System.Text.UTF8Encoding]::new($false))
```

---

## 4. Codegen: V3 JSON → code

### CLI

```sh
# Vanuit bestand (aanbevolen voor reproduceerbare roundtrips)
go run ./cmd/codegen --input export_register.json \
  --mode additive --domein register --prefix register --output model/

# Vanuit draaiende API
go run ./cmd/codegen --from-url http://localhost:8082/api/schema/model/code \
  --mode additive --domein np-loc --prefix np_loc --output model/

# Vanuit specifiek DB-model (op ID)
go run ./cmd/codegen --from-url http://localhost:8082/api/schema/model/42 \
  --mode additive --domein np-loc --prefix np_loc --output model/
```

### Flags

| Flag | Default | Beschrijving |
|------|---------|-------------|
| `--input` | — | Pad naar V3 JSON bestand |
| `--from-url` | — | URL van draaiend register |
| `--output` | `model/` | Doeldirectory |
| `--mode` | `standalone` | `standalone` (overschrijft alles) of `additive` (voegt toe via init-functie) |
| `--domein` | — | Domeinnaam: filtert entiteiten, zet `TypeMeta.Domein` |
| `--prefix` | — | Bestandsnaam-prefix (bijv. `register` → `register_metaregistry.go`) |

### Modus: standalone vs. additive

| | Standalone | Additive |
|---|---|---|
| **Gebruik** | Volledig nieuw model | Toevoegen aan bestaand register |
| **MetaRegistry** | `var MetaRegistry = MetaRegistryType{...}` | `func initXxxMetaRegistry() { MetaRegistry["..."] = TypeMeta{...} }` |
| **Geschikt voor** | Eenmalige/test-generatie | **Productie** (register + np-loc naast elkaar) |

> **In productie gebruiken we altijd `additive` mode** voor beide domeinen.

### Gegenereerde bestanden (7 per domein)

| Bestand | Inhoud |
|---------|--------|
| `{prefix}_modellen_entiteiten.go` | Entiteit-structs + materiële plumbing (Aanvang/Einde) |
| `{prefix}_modellen_ge_rel.go` | GE hub-structs, _Data structs, relatie-structs, enum type-declaraties |
| `{prefix}_modellen_methods.go` | Interface-methoden (GetID, Metatype, etc.) + GeefOnderliggendeGE's |
| `{prefix}_modellen_input.go` | Platte _Input structs voor registratie-API |
| `{prefix}_metaregistry.go` | TypeMeta entries + ReferentielijstInstanties + VoegOnderliggendGEToe |
| `{prefix}_datatype_registry.go` | Custom datatypes (BSN, NLPostcode, etc.) |
| `{prefix}_enum_registry.go` | EnumWaarden + EnumEditorLayouts |

> Ook als een domein geen eigen datatypes of enums heeft, genereert additive mode bewust een **lege `initXxx...()` functie**. Zo blijft de centrale init-volgorde compileerbaar tijdens devloop rebuilds.

### Domeinfiltering

Bij `--domein register`:
- Entiteiten met `domein: "register"` of leeg domein worden gegenereerd
- Entiteiten met een ander domein (bijv. `"np-loc"`) worden overgeslagen

Bij `--domein np-loc`:
- Idem, maar dan voor `"np-loc"`
- Register-entiteiten (Land, Referentielijst) worden overgeslagen — die zitten al in het register-domein
- Enums die niet meer gerefereerd worden na filtering, worden ook verwijderd

### Validatieregels

De codegen valideert het V3 model voordat er code wordt gegenereerd. Bij fouten stopt het proces met een duidelijke foutmelding en exit code 1. Dit voorkomt dat ongeldige Go-code wordt gegenereerd die later pas bij compilatie faalt.

#### Entiteiten, GE's en relaties

| Veld | Regel | Voorbeeld goed | Voorbeeld fout |
|------|-------|----------------|----------------|
| `typenaam` | PascalCase, geen spaties | `ApiStandaard` | `Api Standaard` |
| `meervoud` | lowercase/snake_case | `api_standaarden` | `ApiStandaarden` |
| `momentvoorkomen` | `enkelvoudig` of `meervoudig` | `enkelvoudig` | `enkel` |
| `velden[].naam` | letters/cijfers/underscore | `CG_laag` | `CG laag` |
| `relaties[].doelEntiteit` | moet bestaan in `entiteiten` | `Gemeente` | `Onbekend` |

#### Enums

| Veld | Regel | Voorbeeld goed | Voorbeeld fout |
|------|-------|----------------|----------------|
| `goType` | PascalCase Go-identifier, geen spaties | `CGLaag` | `CG laag` |
| `goType` | uniek per model | — | twee enums met dezelfde `goType` |
| `waarden[].constNaam` | PascalCase Go-identifier | `CGLaagLaag5` | `CG laagLaag5` |
| `waarden[].constNaam` | uniek over alle enums | `SchaalWaarde1`, `SchaalWaarde2` | `SchaalWaarde`, `SchaalWaarde` |

> **Veelvoorkomende fout:** De UML-editor staat spaties toe in enum-namen (bijv. `"CG laag"`). Deze moeten vóór codegen worden aangepast naar PascalCase (bijv. `"CGLaag"`), inclusief de bijbehorende `constNaam`-waarden en veld-referenties (`"enum": "CGLaag"`).

> **Tip:** Numerieke enum-waarden (bijv. schaal 1–4) vereisen unieke `constNaam`-waarden. Gebruik een suffix per waarde: `SchaalWaarde1`, `SchaalWaarde2`, etc. — niet vier keer `SchaalWaarde`.

---

## 5. Roundtrip-verificatie

Stappen om te verifiëren dat de roundtrip 100% klopt:

```sh
# 1. Exporteer V3 JSON (zonder BOM)
$output = go run ./cmd/export_v3 --domein register 2>&1
[System.IO.File]::WriteAllText("$PWD\export_register.json", ($output -join "`n"), [System.Text.UTF8Encoding]::new($false))

$output = go run ./cmd/export_v3 --domein np-loc 2>&1
[System.IO.File]::WriteAllText("$PWD\export_np_loc.json", ($output -join "`n"), [System.Text.UTF8Encoding]::new($false))

# 2. Genereer code naar de centrale temp directory
New-Item -ItemType Directory -Force _temp/roundtrip | Out-Null
go run ./cmd/codegen --input export_register.json --mode additive --domein register --prefix register --output _temp/roundtrip
go run ./cmd/codegen --input export_np_loc.json --mode additive --domein np-loc --prefix np_loc --output _temp/roundtrip

# 3. Vergelijk met SHA256 hash
$files = Get-ChildItem _temp/roundtrip -Filter *.go
foreach ($f in $files) {
    $modelFile = Join-Path model $f.Name
    $genHash = (Get-FileHash $f.FullName -Algorithm SHA256).Hash
    $modelHash = (Get-FileHash $modelFile -Algorithm SHA256).Hash
    if ($genHash -eq $modelHash) { Write-Output "IDENTIEK: $($f.Name)" }
    else { Write-Output "VERSCHIL: $($f.Name)" }
}
```

Verwacht resultaat: **14/14 IDENTIEK** (7 register + 7 np-loc bestanden).

> Gebruik voor losse experimenten, tijdelijke JSON-exports en codegen-vergelijkingen voortaan bij voorkeur de centrale map `_temp/`, zodat de projectroot schoon blijft.

---

## 6. Nieuw domein toevoegen

Voorbeeld: toevoegen van domein `"hr"` (Human Resources).

### Stap 1: Maak het V3 model

Maak een JSON-bestand met de entiteiten, gegevenselementen, relaties en enums. Dit kan handmatig of via de UML-editor.

### Stap 2: Genereer code

```sh
go run ./cmd/codegen --input hr_model.json \
  --mode additive --domein hr --prefix hr --output model/
```

Dit genereert 7 bestanden: `hr_modellen_entiteiten.go`, `hr_metaregistry.go`, etc.

### Stap 3: Init-registratie (automatisch)

De codegen voert in `-mode additive` automatisch `ensureInitRegistration()` uit. Deze functie:
- Leest `metaregistry_plumbing.go` in de output-directory
- Controleert of init-calls voor het prefix al bestaan
- Voegt ze toe vóór `propageerDomeinNaarOnderliggende()` als ze ontbreken

Je hoeft dus **niets handmatig** te doen. Na codegen staan de volgende aanroepen automatisch in `init()`:

```go
func init() {
    // (eerder geladen domeinen staan hier al)
    // hr — domein-specifieke uitbreiding
    initHrEnumRegistry()
    initHrDatatypeRegistry()
    initHrMetaRegistry()

    propageerDomeinNaarOnderliggende()
}
```

> **Let op:** als de `init()` al calls bevatte voor het prefix (bijv. door een vorige codegen-run), worden ze niet gedupliceerd.

### Stap 4: Verifieer

```sh
go build ./...
go test ./...
```

---

## 7. Bestaand model wijzigen

### Via de UML-editor (aanbevolen)

1. Open de editor en bewerk het model visueel
2. Publiceer het model (POST naar `/api/schema/model`)
3. Genereer code:
   ```sh
   go run ./cmd/codegen --from-url http://localhost:8082/api/schema/model/code \
     --mode additive --domein np-loc --prefix np_loc --output model/
   ```
4. Bouw en test:
   ```sh
   go build ./...
   go test ./...
   ```

### Via V3 JSON bestand

1. Bewerk het JSON-bestand
2. Genereer code:
   ```sh
   go run ./cmd/codegen --input np_loc_model.json \
     --mode additive --domein np-loc --prefix np_loc --output model/
   ```
3. Bouw en test

### Handmatige wijzigingen

Voor kleine wijzigingen (extra veld, andere tag) kan je de gegenereerde bestanden direct aanpassen. Maar: bij de volgende codegen-run worden ze weer overschreven. Bewaar handmatige wijzigingen in apart niet-gegenereerde bestanden, of breng ze aan in het V3 model.

---

## 8. Cross-domein relaties

### VoegOnderliggendGEToe

Wanneer een domein (bijv. np-loc) een child-relatie heeft naar een register-entiteit (bijv. Referentielijst), gebruikt de codegen `VoegOnderliggendGEToe()`:

```go
// In initNpLocMetaRegistry():
VoegOnderliggendGEToe("Referentielijst", OnderliggendGegevenselement{
    Rolnaam: "LandenlijstLanden", JSONRolnaam: "landenlijst_landen",
    Doeltype: "LandenlijstLand", Momentvoorkomen: Meervoudig,
})
```

### Wanneer wordt VoegOnderliggendGEToe wél/niet gegenereerd?

| Situatie | Resultaat |
|----------|-----------|
| Referentielijst zit in **dezelfde** codegen-run (bijv. `--domein register`) | Relatie staat **inline** in OnderliggendeGegevenselementen → **geen** VoegOnderliggendGEToe |
| Referentielijst zit **niet** in de codegen-run (bijv. `--domein np-loc`) | Relatie wordt via **VoegOnderliggendGEToe** toegevoegd |

Dit voorkomt duplicaten in de MetaRegistry.

### referentielijst_items relaties

Referentielijst-items relaties (subtype `referentielijst_items`) zijn altijd kinderen van Referentielijst. Ze koppelen een referentielijst-instantie (bijv. "Landenlijst") aan een doel-entiteit (bijv. Land). De structuur is:

```
Referentielijst (register)
  └── LandenlijstLand (register, items-relatie)
        └── LandenlijstLand_Data (geversioned inhoud)
```

De `DoelEntiteit` (Land) kan in een ander domein leven — dat is de cross-domein dependency.

---

## 9. Bestandsoverzicht

### Codegen bronbestanden (`cmd/codegen/`)

| Bestand | Rol |
|---------|-----|
| `main.go` | CLI entry point, flags, V3 laden, validatie, dispatch |
| `conventions.go` | Naamconventies, `DerivedType`, struct field helpers, `codegenOptions` |
| `gen_structs.go` | Genereert entiteit-structs en GE/relatie-structs |
| `gen_registry.go` | Genereert MetaRegistry entries (standalone/additive) |
| `gen_methods.go` | Genereert interface-methoden en GeefOnderliggendeGE's |
| `gen_input.go` | Genereert _Input structs |
| `gen_datatypes.go` | Genereert DatatypeRegistry entries |
| `gen_enum_registry.go` | Genereert EnumWaarden + EnumEditorLayouts |

### Export bronbestanden (`cmd/export_v3/`)

| Bestand | Rol |
|---------|-----|
| `main.go` | CLI entry point, roept `ExportMetaRegistryToV3()` aan |

### Model bronbestanden (niet-gegenereerd)

| Bestand | Rol |
|---------|-----|
| `metaregistry_plumbing.go` | Interfaces, TypeMeta struct, constanten, `VoegOnderliggendGEToe`, `init()` |
| `model_plumbing.go` | Representatie/FormeleRepresentatie interfaces, helpers |
| `v3_format.go` | V3 JSON type-definities (V3Model, V3Entiteit, etc.) |
| `v3_exporter.go` | `ExportMetaRegistryToV3()` — MetaRegistry → V3 JSON |
| `v3_importer.go` | V3 JSON parsing en validatie |

### Model bronbestanden (gegenereerd per domein)

Patroon: `{prefix}_{bestand}.go` — bijv. `register_metaregistry.go`, `np_loc_modellen_entiteiten.go`

Zie [§4 Gegenereerde bestanden](#gegenereerde-bestanden-7-per-domein) voor de lijst.

---

## 10. Veelgestelde vragen

### Waarom additive mode en niet standalone?

Standalone overschrijft de hele MetaRegistry. Met meerdere domeinen (register + np-loc) wil je dat elk domein *toevoegt* aan de bestaande registry, niet vervangt. Additive mode genereert named init-functies die je centraal aanroept in de juiste volgorde.

### Waarom staat de init-volgorde in metaregistry_plumbing.go?

Go garandeert dat `var`-declaraties (MetaRegistry, DatatypeRegistry) klaar zijn vóór `init()`. Maar de *onderlinge* volgorde van init-functies tussen bestanden is niet gegarandeerd. Daarom roepen we ze expliciet aan vanuit één `init()` in `metaregistry_plumbing.go` — register eerst, dan de rest.

> **Sinds april 2026:** de `init()` in `metaregistry_plumbing.go` bevat zelf geen hardcoded domein-calls meer. Alle calls worden automatisch toegevoegd door `ensureInitRegistration()` als onderdeel van elke codegen-run in additive mode. Dit is gevalideerd via de [greenfield test](#11-greenfield-test--domeinonafhankelijkheid-bewezen).

### Wat als de roundtrip niet identiek is?

1. Controleer de V3 export: `go run ./cmd/export_v3 --domein X | python -m json.tool`
2. Controleer op duplicaten: zoek naar dubbele relaties met dezelfde naam
3. Vergelijk met `Compare-Object`:
   ```powershell
   Compare-Object (Get-Content model\file.go) (Get-Content _tmp\file.go)
   ```
4. Alle verschillen moeten verklaarbaar zijn — ofwel een bug in codegen/exporter, ofwel een handmatige wijziging die niet in het V3 model staat.

### Hoe voeg ik een veld toe aan een bestaand GE?

1. Voeg het veld toe in het V3 model (JSON of editor)
2. Genereer opnieuw met codegen
3. De struct krijgt automatisch het nieuwe veld, inclusief tags

### Welke veldnamen zijn gereserveerd?

De codegen genereert automatisch plumbing-velden in `_Data` structs. De volgende veldnamen zijn **gereserveerd** en mogen niet als inhoudsveld worden gebruikt:

| Veldnaam   | Type       | Reden                                            |
|------------|------------|--------------------------------------------------|
| `versie`   | `int64`    | Autoincrement PK voor data-versioning            |
| `rel_id`   | `int`      | FK naar parent hub                               |
| `opvoer`   | `*time.Time` | Formele tijd: opvoer                           |
| `afvoer`   | `*time.Time` | Formele tijd: afvoer                           |

Als een inhoudsveld dezelfde naam heeft als een systeemveld, wordt het **automatisch overgeslagen** met een waarschuwing (`⚠ veld "versie" in ... overgeslagen: conflicteert met systeemveld`). Hernoem het veld in de V3 JSON, bijvoorbeeld `versie` → `definitie_versie`.

### Unieke Veldnaam-afleiding voor GE hubs

Sinds juni 2026 detecteert de codegen automatisch wanneer twee GE-types (uit verschillende entiteiten) dezelfde korte Veldnaam zouden krijgen (bijv. "Meta" bij zowel FormulierDefinitie als WeergaveDefinitie). In dat geval wordt de volledige typenaam in lowercase gebruikt:

- `FormulierDefinitie_Meta` → Veldnaam `formulierdefinitie_meta` (i.p.v. `meta`)
- `WeergaveDefinitie_Meta` → Veldnaam `weergavedefinitie_meta`

GE-types zonder naamconflict behouden de korte Veldnaam (bijv. `layout`, `tabelconfig`).

### Custom datatypes

Domeinen kunnen eigen datatypes definiëren in de `datatypes`-array van de V3 JSON:

```json
{
  "naam": "Versie",
  "description": "Versienummer in formaat m.n.o.p (o en p optioneel).",
  "basistype": "string",
  "format": "versie",
  "validatie": { "pattern": "^\\d+\\.\\d+(\\.\\d+)?(\\.\\d+)?$" }
}
```

In gegenereerde structs krijgt het veld een `schema:"datatype:Versie"` tag. De frontend kan het format en de validatie uit de schema-API lezen.

### Hoe werkt de PowerShell BOM-workaround?

PowerShell 5.1 schrijft standaard UTF-16 LE BOM bij `>` redirect. Go's JSON parser herkent dat niet. Gebruik `[System.IO.File]::WriteAllText()` met `UTF8Encoding($false)` voor BOM-loze output.

### Replay-bestandsconventies

Replay files (`replay files/*.json`) bevatten registraties die via `POST /registratie/` worden ingeladen. Conventies:

1. **Hub-veldnamen gebruiken, niet `_data`-veldnamen.** Bij een eerste opvoer bestaat de hub nog niet; de registratielogica maakt automatisch zowel een hub- als een data-record aan. Gebruik dus `weergavedefinitie_meta` (niet `weergavedefinitie_meta_data`), `tabelconfig` (niet `weergavedefinitie_tabelconfig_data`), etc. De `_data`-veldnaam is alleen nodig bij low-level wijzigingen op een bestaand data-record.
2. **IDs beginnen bij 1** voor een verse database. Gebruik geen willekeurig hoge nummers (bijv. 9000+).
3. **Datum en tijdstip:** gebruik de actuele datum als aanvangsdatum voor standaard-definities. `exported_at` en `tijdstip` in ISO 8601.
4. **definitie_versie** invullen als het veld bestaat (bijv. `"0.1"`).
5. **Eén registratie per entitet-instantie:** elke entry in `entries[]` bevat de volledige set wijzigingen voor één entiteit (opvoer entiteit + GE hubs + aanvang).
6. **Adres -> Gemeente referentielijst:** in replaybestanden die op het nieuwe NP/Loc-adresmodel mikken, gebruik `adres.gemeente_id` (CBS-gemeentecode) als referentielink. `adres.plaats` geldt dan als legacy veld voor oudere modelversies.
7. **Synthetische schaalbestanden:** voor testdata met veel records (bijv. 50 NP's) gebruik hetzelfde patroon: per NP één registratie voor NP, één voor Locatie en één voor de woonadres-link, met 11-proef geldige synthetische BSN's.
8. **Batch-splitsing voor scenario-tests:** gebruik meerdere replaybestanden met aansluitende ID-ranges om stapsgewijs te seeden, bijvoorbeeld:
  - `registraties-replay-synth-50x-np-locatie-woonadres ID=1 tm 50.json`
  - `registraties-replay-synth-50x-np-locatie-woonadres ID=51 tm 100.json`
  - `registraties-replay-synth-50x-locatie-adres ID=101 tm 150.json` (alleen locaties/adressen, geen bereikbaarheid-links)

---

## 11. Greenfield test — domeinonafhankelijkheid bewezen

**Datum:** 7 april 2026  
**Status:** Geslaagd ✓

### Doel

Bewijzen dat de applicatie **volledig domeinonafhankelijk** is: je kunt alle prefixed domeinbestanden verwijderen, codegen draaien voor een willekeurig nieuw domein, en het systeem functioneert volledig — zonder enige handmatige aanpassing aan framework-code.

Dit is een fundamentele eigenschap van de architectuur: het framework (handlers, routes, schema-API, registratie-logica, frontend) is 100% meta-driven en heeft geen compile-time kennis van specifieke domeintypes nodig.

### Testopzet

#### Uitgangssituatie
Vier actieve domeinen met in totaal 30 prefixed bestanden:

| Prefix | Domein | Bestanden | Aard |
|--------|--------|-----------|------|
| `abuvwxy_` | abuvwxy | 7 | Test-/referentiemodel (A, B, Rel_A_B, etc.) |
| `register_` | register | 7 | Functioneel basisdomein (Referentielijst, Land, etc.) |
| `np_loc_` | np-loc | 8 | Nederlands locatiedomein |
| `cg_` | CG | 8 | CG Portfolio domein |

#### Gebruikte model
CG Portfolio V3 JSON (`docs/ontwerpgedachten/CG PF/Portfolio.v3.json`) — een eenvoudig maar representatief model:
- **5 entiteiten**: Initiatief, Organisatie, Persoon, Gemeente, Domein
- **9 gegevenselementen**: Planning, Product, Bijdrage, Naam×2, Contactgegevens×2, GemeenteGegevens, DomeinGegevens
- **5 enums**: OrganisatieType, Producttype, Fase, Schaal, Bijdragetype
- **5 datatypes**: Datum, URL, Email, Git_adres, Telefoonnummer
- **Geen relaties** — puur GE-gebaseerd model
- **Materiële entiteiten**: Initiatief, Organisatie, Persoon (met Aanvang/Einde)

### Stappen

#### Stap 1: Backup originele situatie
```bash
mkdir -p /tmp/greenfield_backup
tar czf /tmp/greenfield_backup/model.tar.gz model/
tar czf /tmp/greenfield_backup/baseline_model.tar.gz _baseline/model/
tar czf /tmp/greenfield_backup/routes.tar.gz routes/
```

#### Stap 2: Verwijder alle 30 prefixed files
```bash
rm model/abuvwxy_*.go model/cg_*.go model/np_loc_*.go model/register_*.go
rm _baseline/model/abuvwxy_*.go _baseline/model/cg_*.go _baseline/model/np_loc_*.go _baseline/model/register_*.go
```

#### Stap 3: Strip init() in metaregistry_plumbing.go
Alle domein-specifieke init-calls verwijderd uit `init()` in zowel `model/metaregistry_plumbing.go` als `_baseline/model/metaregistry_plumbing.go`:

```go
func init() {
    // Domein-specifieke init calls worden door codegen automatisch toegevoegd
    // via ensureInitRegistration(). Hier staat bewust niets hardcoded.
    propageerDomeinNaarOnderliggende()
}
```

#### Stap 4: Build met nul domeinen
```bash
go build -o /dev/null .
# Resultaat: COMPILEERT SUCCESVOL met 0 domeintypes
```

Dit bewees dat het framework géén compile-time afhankelijkheden heeft op domeincode.

#### Stap 5: Codegen CG-only
```bash
go run ./cmd/codegen \
  -input "docs/ontwerpgedachten/CG PF/Portfolio.v3.json" \
  -output model/ \
  -prefix cg \
  -domein portfolio \
  -mode additive
```

Resultaat:
- 8 bestanden gegenereerd (`cg_modellen_entiteiten.go`, `cg_metaregistry.go`, etc.)
- `ensureInitRegistration()` voegde automatisch de init-calls toe in `metaregistry_plumbing.go`

#### Stap 6: Build en start server
```bash
go build -o /dev/null .        # BUILD OK
DEVLOOP=true go run .          # Server start zonder panics
```

#### Stap 7: Verificatie

**Routes:** 153 routes dynamisch geregistreerd, inclusief:
- `/initiatieven`, `/organisaties`, `/personen`, `/gemeentes`, `/domeinen`
- `/full/initiatieven`, `/full/organisaties`, etc.
- `/initiatief_aanvang`, `/initiatief_einde`, `/bijdragen`, `/planningen`, `/producten`
- Alle standaard framework-routes (`/registraties`, `/wijzigingen`, `/api/schema/*`, etc.)

**Schema API** (`GET /api/schema/model/code`):
```
Totaal types: 35
Domeinen: ['portfolio']
Entiteiten (5): ['Domein', 'Gemeente', 'Initiatief', 'Organisatie', 'Persoon']
```

**Entiteitstructuur correct**:
```
Initiatief: 5 onderliggende
  - Initiatief_Planning (enkelvoudig) json=planningen
  - Initiatief_Product (enkelvoudig) json=producten
  - Initiatief_Bijdrage (meervoudig) json=bijdragen
  - Initiatief_Aanvang (enkelvoudig) json=aanvang
  - Initiatief_Einde (enkelvoudig) json=einde
Organisatie: 4 onderliggende
  - Organisatie_Naam (enkelvoudig) json=namen
  - Organisatie_Contactgegevens (enkelvoudig) json=contactgegevens
  - Organisatie_Aanvang (enkelvoudig) json=aanvang
  - Organisatie_Einde (enkelvoudig) json=einde
Persoon: 4 onderliggende
  - Persoon_Naam (enkelvoudig) json=namen
  - Persoon_Contactgegevens (enkelvoudig) json=contactgegevens
  - Persoon_Aanvang (enkelvoudig) json=aanvang
  - Persoon_Einde (enkelvoudig) json=einde
Gemeente: 1 onderliggende
  - GemeenteGegevens (enkelvoudig) json=gemeentegegevens
Domein: 1 onderliggende
  - DomeinGegevens (enkelvoudig) json=domeingegevens
```

**Full-entity endpoint**:
```bash
curl -s http://localhost:8082/full/initiatieven
# {"has_more":false,"initiatieven":[],"page":1,"size":20}
```
Lege lijst (geen data in DB), maar correcte response-structuur.

#### Stap 8: Herstel
```bash
tar xzf /tmp/greenfield_backup/model.tar.gz
tar xzf /tmp/greenfield_backup/baseline_model.tar.gz
go build -o /dev/null .   # BUILD OK — alle 30 files weer terug
```

### Gevonden en permanent gefixt

Tijdens de test werden twee hardcoded afhankelijkheden op domeincode blootgelegd en permanent opgelost:

#### 1. `routes/addroutes_helper.go` — hardcoded `model.Referentielijst`

**Was:**
```go
router.GET("/referentielijsten", handlers.MakeGetEntitiesHandler[model.Referentielijst]("Referentielijsten"))
```

**Werd:**
```go
refMeta, hasRef := model.MetaRegistry.GetTypeMeta("Referentielijst")
if !hasRef {
    return // geen referentielijsten in dit model
}
router.GET("/referentielijsten", handlers.MakeGetEntitiesByMetaHandler(refMeta))
```

Nu wordt de route alleen geregistreerd als het type `Referentielijst` in de MetaRegistry bestaat. Modellen zonder referentielijsten werken probleemloos.

#### 2. `model/REST request models.go` — dode code met ABUVWXY-types

De functies `AsA()`, `AsB()` en structs `OpvoerAfvoerA`, `OpvoerAfvoerB` bevatten hardcoded type-switches op `*A`, `*A_U`, `*B_X`, etc. Deze functies werden nergens meer gebruikt in v06 (de nieuwe generieke registratie-aanpak maakt ze overbodig) maar veroorzaakten compile-errors zonder het ABUVWXY-domein.

**Oplossing:** Verwijderd uit zowel `model/REST request models.go` als `_baseline/model/REST request models.go`.

### Samenvatting resultaten

| Aspect | Resultaat |
|--------|-----------|
| Build met 0 domeinen | ✓ Compileert zonder errors |
| Codegen CG-only (via CLI) | ✓ 8 bestanden gegenereerd |
| `ensureInitRegistration()` | ✓ Init-calls automatisch toegevoegd |
| Server start | ✓ 0 panics, 153 routes |
| Schema API | ✓ 35 types, 5 entiteiten, correct domein |
| Entity structure | ✓ Alle GEs, Aanvang/Einde correct genest |
| Full-entity endpoint | ✓ Correcte JSON-structuur |
| Referentielijsten afwezig | ✓ Geen crash, route wordt overgeslagen |
| Herstel naar origineel | ✓ Build OK met alle 30 bestanden |

### Conclusie

De applicatie is **volledig domeinonafhankelijk**. Je kunt:

1. Alle prefixed bestanden verwijderen
2. Codegen draaien voor een willekeurig V3 model
3. De server starten — alles werkt

Er is geen handmatige aanpassing nodig aan framework-code, routes, handlers, of de schema-API. Het enige dat nodig is, is een V3 JSON-model en één codegen-commando.

Dit bevestigt het ontwerpprincipe: **de MetaRegistry is de single source of truth**, en alle runtime-gedrag wordt daar dynamisch uit afgeleid.

### Aandachtspunt

De codegen genereert soms ongebruikte imports (`time`, `github.com/uptrace/bun`) in bestanden waar de betreffende types niet voorkomen. Dit is onschuldig maar vereist een `goimports`-stap na codegen. Overweeg `goimports` als automatische naverwerking in de codegen te integreren.
