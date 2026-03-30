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

### Domeinfiltering

Bij `--domein register`:
- Entiteiten met `domein: "register"` of leeg domein worden gegenereerd
- Entiteiten met een ander domein (bijv. `"np-loc"`) worden overgeslagen

Bij `--domein np-loc`:
- Idem, maar dan voor `"np-loc"`
- Register-entiteiten (Land, Referentielijst) worden overgeslagen — die zitten al in het register-domein
- Enums die niet meer gerefereerd worden na filtering, worden ook verwijderd

---

## 5. Roundtrip-verificatie

Stappen om te verifiëren dat de roundtrip 100% klopt:

```sh
# 1. Exporteer V3 JSON (zonder BOM)
$output = go run ./cmd/export_v3 --domein register 2>&1
[System.IO.File]::WriteAllText("$PWD\export_register.json", ($output -join "`n"), [System.Text.UTF8Encoding]::new($false))

$output = go run ./cmd/export_v3 --domein np-loc 2>&1
[System.IO.File]::WriteAllText("$PWD\export_np_loc.json", ($output -join "`n"), [System.Text.UTF8Encoding]::new($false))

# 2. Genereer code naar temp directory
mkdir _tmp_roundtrip
go run ./cmd/codegen --input export_register.json --mode additive --domein register --prefix register --output _tmp_roundtrip
go run ./cmd/codegen --input export_np_loc.json --mode additive --domein np-loc --prefix np_loc --output _tmp_roundtrip

# 3. Vergelijk met SHA256 hash
$files = Get-ChildItem _tmp_roundtrip -Filter *.go
foreach ($f in $files) {
    $modelFile = Join-Path model $f.Name
    $genHash = (Get-FileHash $f.FullName -Algorithm SHA256).Hash
    $modelHash = (Get-FileHash $modelFile -Algorithm SHA256).Hash
    if ($genHash -eq $modelHash) { Write-Output "IDENTIEK: $($f.Name)" }
    else { Write-Output "VERSCHIL: $($f.Name)" }
}
```

Verwacht resultaat: **14/14 IDENTIEK** (7 register + 7 np-loc bestanden).

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

### Stap 3: Registreer de init-functies

Voeg de init-aanroepen toe in `model/metaregistry_plumbing.go`:

```go
func init() {
    initRegisterMetaRegistry()
    initRegisterDatatypeRegistry()
    initRegisterEnumRegistry()
    initNpLocMetaRegistry()
    initHrMetaRegistry()          // ← nieuw
    initHrDatatypeRegistry()      // ← nieuw
    initHrEnumRegistry()          // ← nieuw
}
```

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

### Hoe werkt de PowerShell BOM-workaround?

PowerShell 5.1 schrijft standaard UTF-16 LE BOM bij `>` redirect. Go's JSON parser herkent dat niet. Gebruik `[System.IO.File]::WriteAllText()` met `UTF8Encoding($false)` voor BOM-loze output.
