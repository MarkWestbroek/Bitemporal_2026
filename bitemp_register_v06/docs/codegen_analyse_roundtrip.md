# Codegen analyse & roundtrip-plan

**Datum:** 2026-03-30 (bijgewerkt 2026-03-31)  
**Status:** ✅ Roundtrip volledig gevalideerd — 14/14 bestanden identiek  
**Zie ook:** [`docs/CODEGEN.md`](CODEGEN.md) voor de volledige handleiding.

**Doel:** De codegen (`cmd/codegen/`) moet letterlijk dezelfde code genereren als de hand-geschreven code, zodat een volledige roundtrip mogelijk is.

## Roundtrip-workflow

```
1. Code staat er (hand-geschreven of eerder gegenereerd)
2. Exporteer het V3-model:  GET /api/schema/model/code?domein=np-loc
3. Bewaar het V3.1-model in de database (schema_versies) of op bestand
4. Genereer code:  go run ./cmd/codegen --input model.json --mode additive --prefix np_loc --domein np-loc
5. Diff gegenereerde code met echte code
6. Fix afwijkingen en ga naar stap 1
```

## Huidige staat codegen

### Bestandsstructuur

7 bronbestanden in `cmd/codegen/`:

| Bestand | Doel |
|---------|------|
| `main.go` | CLI entry point, flags, V3 laden & valideren, dispatch naar generators |
| `conventions.go` | Naamconventies, `DerivedType` metadata, struct field helpers |
| `gen_structs.go` | `modellen_entiteiten.go` + `modellen_ge_rel.go` (structs) |
| `gen_registry.go` | `metaregistry.go` (TypeMeta entries, standalone of additive) |
| `gen_methods.go` | `modellen_methods.go` (interface methods + GeefOnderliggendeGE's) |
| `gen_input.go` | `modellen_input.go` (platte _Input structs voor registratie-API) |
| `gen_datatypes.go` | `datatype_registry.go` (V3Datatype entries) |

### 6 gegenereerde output-bestanden

| Output | Generator |
|--------|-----------|
| `{prefix}_modellen_entiteiten.go` | `generateEntiteiten()` |
| `{prefix}_modellen_ge_rel.go` | `generateGeRel()` |
| `{prefix}_modellen_methods.go` | `generateMethods()` |
| `{prefix}_modellen_input.go` | `generateInput()` |
| `{prefix}_metaregistry.go` | `generateMetaRegistry()` / `generateMetaRegistryAdditive()` |
| `{prefix}_datatype_registry.go` | `generateDatatypeRegistry()` / `generateDatatypeRegistryAdditive()` |

### Wat correct werkt

- Entiteiten, GE's (hub+data pattern), relaties — struct generatie
- Materiële plumbing (Aanvang/Einde) op entiteit- en hub-niveau
- Enum type-declaraties (`type X string; const (...)`) + `schema:"enum=X"` tags
- Afgeleide velden in MetaRegistry entries
- Standalone en additive mode (via `--mode`)
- V3 model validatie (PascalCase, snake_case, doelEntiteit referenties)
- `--prefix` voor bestandsnamen
- Wrapper-unwrapping (API-response met `"model"` veld)
- Input structs (_Input) voor registratie-API

## Gaps — wat ontbreekt of afwijkt

Hieronder alle geïdentificeerde gaps, in volgorde van criticiteit voor de roundtrip.

### Gap 1: `Domein` veld ontbreekt in MetaRegistry entries — ✅ OPGELOST

**Probleem:** Alle hand-geschreven entries zetten `Domein: "register"` of `Domein: "np-loc"`. De codegen schrijft dit nergens in `writeEntiteitEntry()`, `writeHubEntry()`, `writeRelHubEntry()`, `writeDataEntry()`, `writeAanvangEindeEntry()`.

**Referentie:** `model/register_metaregistry.go:15` → `Domein: "register"`

**Impact:** Zonder `Domein` werkt de V3 export-filtering per domein niet, wat de roundtrip breekt.

**Oplossing:** Nieuw `--domein` CLI-flag. Alle `write*Entry()` functies krijgen een `domein` parameter en schrijven `Domein: "..."`.

### Gap 2: `schema:"datatype:X"` tag ontbreekt op content-velden — ✅ OPGELOST

**Probleem:** `V3Veld.Datatype` is beschikbaar in het V3-model maar wordt nooit verwerkt in `contentField()` (conventions.go:291). Alleen `schema:"enum=X"` wordt gegenereerd.

**Referentie:** Hand-geschreven `model/np_loc_modellen_ge_rel.go:46` → `schema:"datatype:BSN"`

**Impact:** Schema-API kent geen custom datatypes → frontend validatie/rendering breekt.

**Oplossing:** In `contentField()`, als `v.Datatype != ""`, toevoegen: `schema:"datatype:X"`.

### Gap 3: `$ref` tag ontbreekt op content-velden — ✅ OPGELOST

**Probleem:** `V3Veld.Ref` (`json:"$ref"`) wordt niet verwerkt in `contentField()`. Referentielijst-koppelingen missen.

**Referentie:** Hand-geschreven velden met `schema:"ref:LandenlijstLand"` e.d.

**Oplossing:** In `contentField()`, als `v.Ref != ""`, toevoegen: `schema:"ref:X"`.

### Gap 4: Enum registry generatie ontbreekt — ✅ OPGELOST

**Probleem:** Er is geen `gen_enum_registry.go`. De codegen genereert wel enum type-declaraties (in `gen_structs.go`) maar NIET de `EnumWaarden["X"]` map-entries of `EnumEditorLayouts["X"]` entries die de schema-API nodig heeft.

**Referentie:** `model/register_enum_registry.go` → `initRegisterEnumRegistry()` met `EnumWaarden["ReferentielijstAdrestype"] = []string{...}` en `EnumEditorLayouts["X"] = &EditorLayout{...}`

**Impact:** Enum waarden niet vindbaar door schema-API/frontend.

**Oplossing:** Nieuw output-bestand `{prefix}_enum_registry.go` met:
- Named init function `init{Prefix}EnumRegistry()`
- `EnumWaarden["X"] = []string{...}` voor elke V3Enum
- `EnumEditorLayouts["X"] = &EditorLayout{Positie: &V3Positie{X, Y}}` (wanneer positie beschikbaar)

### Gap 5: `Layout` / `EditorLayout` ontbreekt in MetaRegistry entries — ✅ OPGELOST

**Probleem:** Elke hand-geschreven MetaRegistry entry heeft `Layout: &EditorLayout{Positie: &V3Positie{X, Y}, EdgeID: "...", SourceHandle: "...", TargetHandle: "..."}`. De codegen negeert alle V3 positie/edge-velden.

**Referentie:** `model/register_metaregistry.go:18` → `Layout: &EditorLayout{Positie: &V3Positie{X: 1260, Y: -240}}`

**V3 invoervelden beschikbaar:**
- `V3Entiteit.Positie` → `V3Positie{X, Y}`
- `V3Gegevenselement.Positie`, `.ID`, `.SourceHandle`, `.TargetHandle`
- `V3Relatie.Positie`, `.ID`, `.SourceHandle`, `.TargetHandle`, `.DoelID`, `.DoelSourceHandle`, `.DoelTargetHandle`

**Impact:** Editor round-trips verliezen alle layout-informatie.

**Oplossing:** Alle `write*Entry()` functies lezen positie/edge-velden en schrijven `Layout: &EditorLayout{...}`.

### Gap 6: Additive mode genereert `func init()` i.p.v. named function — ✅ OPGELOST

**Probleem:** Hand-geschreven code gebruikt named functions: `initRegisterMetaRegistry()`, `initNpLocMetaRegistry()`, etc. Deze worden centraal aangeroepen in `metaregistry_plumbing.go`. De codegen genereert een kale `func init()`.

**Impact:** Init-volgorde problemen. Niet consistent met bestaande conventie.

**Oplossing:** 
- MetaRegistry: genereer `func init{Prefix}MetaRegistry()` 
- Datatype registry: genereer `func init{Prefix}DatatypeRegistry()`
- Enum registry: genereer `func init{Prefix}EnumRegistry()`
- De gebruiker voegt de aanroepen handmatig toe aan `metaregistry_plumbing.go` (of daar komt ook tooling voor).

### Gap 7: ReferentielijstInstanties niet verwerkt — ✅ OPGELOST

**Probleem:** V3Model heeft `ReferentielijstInstanties []V3ReferentielijstInstantie` maar de codegen leest/verwerkt deze niet. De hand-geschreven code vult `ReferentielijstInstantieRegistry` (in np_loc_metaregistry.go).

**Oplossing:** Nieuwe sectie in `gen_registry.go` (of apart bestand) die `ReferentielijstInstantieRegistry["X"] = ...` entries genereert.

### Gap 8: Datatype `Domein` en `Positie` ontbreken — ✅ OPGELOST

**Probleem:** `V3Datatype` heeft `Domein` en `Positie` velden; `writeDatatypeEntry()` in `gen_datatypes.go` schrijft ze niet.

**Referentie:** `model/register_datatype_registry.go` → zet `Domein: "register"` en `Positie: &V3Positie{...}`

**Oplossing:** Toevoegen in `writeDatatypeEntry()`.

### Gap 9: Meervoud vs Padnaam conflatie — ✅ OPGELOST

**Probleem:** `deriveEntiteit()` zet `Padnaam` en `Meervoud` beide op `ent.Meervoud`. In de hand-geschreven code verschilt dit soms (bijv. `"natuurlijk personen"` display vs `"natuurlijk_personen"` URL).

**Huidig V3-formaat:** Heeft maar één `meervoud` veld per entiteit/GE.

**Oplossing:** 
- Optie A: V3-formaat uitbreiden met apart `padnaam` veld
- Optie B: `Padnaam` altijd afleiden als snake_case van `Meervoud` (spaties → underscores)

## Referentie: hand-geschreven bestanden per domein

### Register-domein (`model/register_*`)
- `register_modellen_entiteiten.go` — Referentielijst struct
- `register_modellen_ge_rel.go` — GE/relatie structs (Referentielijstnaam, etc.)
- `register_modellen_methods.go` — Interface methods
- `register_metaregistry.go` — `initRegisterMetaRegistry()`
- `register_enum_registry.go` — `initRegisterEnumRegistry()`
- `register_datatype_registry.go` — `initRegisterDatatypeRegistry()`

### NP-Loc domein (`model/np_loc_*`)
- `np_loc_modellen_entiteiten.go`
- `np_loc_modellen_ge_rel.go`
- `np_loc_modellen_methods.go`
- `np_loc_metaregistry.go` — `initNpLocMetaRegistry()`
- `np_loc_enum_registry.go` — `initNpLocEnumRegistry()`
- `np_loc_datatype_registry.go` — `initNpLocDatatypeRegistry()`

## Volgende stappen

1. Fix alle 9 gaps in de codegen
2. Definieer V3 JSON voor RegisterDomein (4 GE's: Naam, Omschrijving, Code, Schema)
3. Genereer RegisterDomein code via codegen
4. Roundtrip-test: exporteer np-loc model → genereer → diff met hand-geschreven code
5. Itereer tot diff leeg is (of alleen verwachte volgorde-verschillen bevat)
