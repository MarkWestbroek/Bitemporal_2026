

`/memories/session/plan.md` is intern geheugen van Copilot — niet zichtbaar in je project. Ik plaats het plan als bestand in je project. 

Read memory [](file:///c%3A/Users/User/AppData/Roaming/Code/User/workspaceStorage/bd7369b1bbc69ce74c0be4cc5556817c/GitHub.copilot-chat/memory-tool/memories/NDU5NGQwMWUtOWI4Ny00MGU4LWEzNTYtZGFiNDA4YWY3YTdm/plan.md)

Nu schrijf ik dit naar een bestand in je project: 



Ik heb geen tool beschikbaar om bestanden aan te maken in je workspace. Hier is de volledige inhoud — kopieer het naar `bitemp_register_v06/docs/implementatieplan-referentielijsten.md` (of een andere locatie naar keuze):

```markdown
# Implementatieplan: Referentielijsten Refactoring — Klasse vs Instantie

> **Status**: plan, v1  
> **Datum**: 2026-03-29  
> **Scope**: Go backend + V3 JSON format + UML Editor  
> **Doel**: Landenlijst (concrete struct) refactoren naar generieke Referentielijst-klasse; RegisterReferentielijst verwijderen; GE's voor naam/omschrijving toevoegen; referentielijst-instanties correct modelleren in V3 JSON, MetaRegistry, DB en Editor.

---

## TL;DR

De huidige implementatie behandelt elke referentielijst (Landenlijst) als aparte Go-struct/klasse. Dit is conceptueel fout: er hoort één generieke **Referentielijst**-klasse te zijn, waarvan Landenlijst, EU_Lidstaten, etc. **instanties** (records) zijn. De `RegisterReferentielijst`-systeemtabel gaat op in de Referentielijst-entiteit zelf. Naam en beschrijving worden GE's. De V3 JSON krijgt een `referentielijstInstanties`-sectie. De editor krijgt instantie-nodes.

---

## Huidige staat (wat er is)

### Go model
- **`RegisterReferentielijst`** struct in `ref_modellen_entiteiten.go` → systeemtabel met `id, typenaam, naam, beschrijving, is_materieel`
- **`Landenlijst`** struct → entiteit met `id, opvoer, afvoer` + relatie naar `Landenlijst_Land`, + `Landenlijst_Aanvang/Einde`
- **`Land`** struct → referentielijst_item entiteit
- **`Landenlijst_Land`** struct → referentielijst_items relatie (hub + _Data)
- **`Landcode`**, **`Landnaam`** → GE's van Land (hub + _Data)
- Alle ref_* bestanden: `ref_modellen_entiteiten.go`, `ref_modellen_ge_rel.go`, `ref_modellen_input.go`, `ref_modellen_methods.go`

### MetaRegistry (np_loc_metaregistry.go)
- 12 entries: Landenlijst, Land, Landenlijst_Land, Landcode, Landnaam, + hun _Data, _Aanvang, _Einde entries
- `Landenlijst` heeft `EntiteitSubtype: "referentielijst"`
- `Land` heeft `EntiteitSubtype: "referentielijst_item"`
- `Landenlijst_Land` heeft `RelatieSubtype: "referentielijst_items"`

### V3 JSON format (v3_format.go)
- `V3Entiteit` en `V3Relatie` missen `entiteitSubtype`/`relatieSubtype` velden
- *Geen* concept van referentielijst-instanties in V3 JSON struct
- `metamodel_v3.json` bevat geen referentielijst-gerelateerde types

### DB setup (createtables.go)
- `syncReferentielijstRegister()` loopt over MetaRegistry, filtert op `EntiteitSubtype == "referentielijst"`, en UPSERTt naar `register_referentielijst` tabel

### Editor
- Editor KAN subtypes lezen/schrijven (`entiteitSubtype`, `relatieSubtype`)
- `maakReferentielijstSet()` maakt 3-node template aan (reflijst + item + items-relatie)
- Geen concept van instantie-nodes

### Routes
- Referentielijst-entiteiten worden gescheiden geroute onder `/referentielijsten/...`
- Items en relaties krijgen gewone routes

---

## Doelarchitectuur (wat het moet worden)

### Conceptueel model

```
Referentielijst (generieke entiteit-KLASSE, één Go struct)
  ├── Referentielijstnaam (GE, hub+data)
  ├── Referentielijstomschrijving (GE, hub+data)
  ├── Referentielijst_Aanvang (materieel, indien IsMaterieel)
  ├── Referentielijst_Einde (materieel, indien IsMaterieel)
  │
  └── Per-instantie relaties (elk een eigen Go struct):
      ├── LandenlijstLand (relatie → Land, gebonden aan instantie "Landenlijst")
      ├── EULidstatenLand (relatie → Land, gebonden aan instantie "EULidstaten")
      └── ...

Instanties (records in register_referentielijst tabel):
  ├── Landenlijst (id=1, systeemnaam="Landenlijst")
  ├── EULidstaten (id=2, systeemnaam="EULidstaten")
  └── ...
```

### DB tabel `register_referentielijst`

| Kolom | Type | Betekenis |
|-------|------|-----------|
| id | int PK autoincrement | Instantie-ID |
| systeemnaam | text UNIQUE | Stabiele identifier voor sync/routing |
| opvoer | timestamptz | Formele tijd |
| afvoer | timestamptz | Formele tijd |

Naam en beschrijving leven in GE-tabellen (referentielijstnaam, referentielijstnaam_data, referentielijstomschrijving, referentielijstomschrijving_data).

### V3 JSON formaat (uitbreiding)

```json
{
  "versie": "v3",
  "referentielijstInstanties": [
    {
      "systeemnaam": "Landenlijst",
      "naam": "Landen",
      "omschrijving": "Een lijst van alle landen",
      "positie": { "x": 100, "y": 200 }
    }
  ],
  "entiteiten": [
    {
      "typenaam": "Referentielijst",
      "entiteitSubtype": "referentielijst",
      "isMaterieel": true,
      "gegevenselementen": [
        { "naam": "Referentielijstnaam", "velden": [{"naam": "Naam", "type": "string"}] },
        { "naam": "Referentielijstomschrijving", "velden": [{"naam": "Omschrijving", "type": "string"}] }
      ],
      "relaties": [
        {
          "naam": "LandenlijstLand",
          "relatieSubtype": "referentielijst_items",
          "doelEntiteit": "Land",
          "referentielijstInstantie": "Landenlijst"
        }
      ]
    },
    {
      "typenaam": "Land",
      "entiteitSubtype": "referentielijst_item",
      "gegevenselementen": [
        { "naam": "Landcode", "velden": [{"naam": "Code", "type": "string"}] },
        { "naam": "Landnaam", "velden": [{"naam": "Naam", "type": "string"}] }
      ]
    }
  ]
}
```

### Naamconventies

| Oud | Nieuw | Reden |
|-----|-------|-------|
| `Landenlijst` (struct) | `Referentielijst` (struct) | Wordt generieke klasse |
| `RegisterReferentielijst` (struct) | **VERWIJDERD** | Opgegaan in Referentielijst |
| `Landenlijst_Land` | `LandenlijstLand` | Naamconventie: geen underscores in gewone klassen |
| `Landenlijst_Land_Data` | `LandenlijstLand_Data` | _Data is systeemsuffix |
| `Landenlijst_Aanvang` | `Referentielijst_Aanvang` | Generiek geworden |
| `Landenlijst_Einde` | `Referentielijst_Einde` | Generiek geworden |
| `ref_modellen_*.go` | *inhoud verplaatst naar* `np_loc_modellen_*.go` | Referentielijsten zijn first-class citizens van het model |

### MetaRegistry nieuwe velden in TypeMeta

```go
ReferentielijstInstantie string // alleen voor referentielijst_items relaties: systeemnaam van de gebonden instantie (bijv. "Landenlijst")
```

---

## Implementatiestappen

### Fase A: V3 JSON format & Go structs (geen dependencies)

**A1. V3 format Go structs uitbreiden** — `model/v3_format.go`
- Voeg `EntiteitSubtype string` toe aan `V3Entiteit` met json tag `"entiteitSubtype,omitempty"`
- Voeg `RelatieSubtype string` toe aan `V3Relatie` met json tag `"relatieSubtype,omitempty"`
- Voeg `ReferentielijstInstantie string` toe aan `V3Relatie` met json tag `"referentielijstInstantie,omitempty"`
- Voeg `V3ReferentielijstInstantie` struct toe:
  ```
  Systeemnaam  string
  Naam         string
  Omschrijving string
  Positie      *V3Positie
  ```
- Voeg `ReferentielijstInstanties []V3ReferentielijstInstantie` toe aan `V3Model`

**A2. MetaRegistry plumbing uitbreiden** — `model/metaregistry_plumbing.go`
- Voeg `ReferentielijstInstantie string` veld toe aan `TypeMeta` struct
- Documenteer: "systeemnaam van de gebonden referentielijst-instantie; alleen voor RelatieSubtype == referentielijst_items"

### Fase B: Go model refactoring (structs) — *depends on A*

**B1. Nieuwe generieke structs aanmaken**
Werk in `np_loc_modellen_entiteiten.go`:
- Voeg `Referentielijst` struct toe:
  - bun table: `register_referentielijst`
  - Velden: `ID int (pk)`, `Systeemnaam string (unique)`, `Opvoer *time.Time`, `Afvoer *time.Time`
  - Relaties: `Referentielijstnamen []Referentielijstnaam`, `Referentielijstomschrijvingen []Referentielijstomschrijving`, `Aanvang []Referentielijst_Aanvang`, `Einde []Referentielijst_Einde`
  - Items-relaties als gewone bun has-many relaties: `LandenlijstLanden []LandenlijstLand`, etc. (per model specifiek)
  - N.B.: de struct groeit per model met elke nieuwe items-relatie — consistent met hoe NP velden heeft per GE
- Voeg `Referentielijst_Aanvang` struct toe (was `Landenlijst_Aanvang`, nu generiek):
  - bun table: `referentielijst_aanvang`
  - Velden: `Referentielijst_ID int (pk)`, `Versie int64 (pk, autoincrement)`, `Datum *Date`, `Opvoer`, `Afvoer`
- Voeg `Referentielijst_Einde` struct toe (analog)

**B2. Nieuwe GE structs aanmaken**
Werk in `np_loc_modellen_ge_rel.go`:
- `Referentielijstnaam` (hub): `Referentielijst_ID, Rel_ID, ParentReferentielijst, Opvoer, Afvoer, Data []Referentielijstnaam_Data`
- `Referentielijstnaam_Data`: `Referentielijst_ID, Rel_ID, Versie, Naam string, Opvoer, Afvoer`
- `Referentielijstomschrijving` (hub): analoog
- `Referentielijstomschrijving_Data`: analoog, veld `Omschrijving string`

**B3. Items-relatie hernoemen**
In `np_loc_modellen_ge_rel.go`:
- Hernoem `Landenlijst_Land` → `LandenlijstLand`
  - Wijzig FK: `Landenlijst_ID` → `Referentielijst_ID`, bun column `referentielijst_id`
  - Wijzig bun relation: `ParentLandenlijst *Landenlijst` → `ParentReferentielijst *Referentielijst`
- Hernoem `Landenlijst_Land_Data` → `LandenlijstLand_Data`
  - Wijzig FK: `Landenlijst_ID` → `Referentielijst_ID`, bun column `referentielijst_id`
- Hernoem `Landenlijst_Land_Input` → `LandenlijstLand_Input`
  - Wijzig `Landenlijst_ID` → `Referentielijst_ID`

**B4. Bestaande Land-structs behouden**
- `Land`, `Landcode`, `Landnaam`, `Landcode_Data`, `Landnaam_Data`, `Land_Aanvang`, `Land_Einde` → verplaats van `ref_modellen_*.go` naar `np_loc_modellen_*.go` (entiteiten resp. ge_rel bestanden)
- Geen inhoudelijke wijzigingen

**B5. Interface-methoden (methods)**
In `np_loc_modellen_methods.go`:
- Voeg methods toe voor: `Referentielijst`, `Referentielijst_Aanvang`, `Referentielijst_Einde`, `Referentielijstnaam`, `Referentielijstnaam_Data`, `Referentielijstomschrijving`, `Referentielijstomschrijving_Data`
- Hernoem bestaande methods voor: `LandenlijstLand` (was `Landenlijst_Land`), `LandenlijstLand_Data`
- Verplaats bestaande methods voor Land, Landcode, Landnaam, etc. van `ref_modellen_methods.go` naar `np_loc_modellen_methods.go`
- `GeefOnderliggendeGegevenselementen()` op Referentielijst implementeren:
  - Retourneert Referentielijstnaam, Referentielijstomschrijving, Aanvang, Einde **plus alle items-relaties** (LandenlijstLand, etc.)
  - Items-relaties zijn **gewone onderliggende relaties** van Referentielijst met de constraint dat de primaire FK (referentielijst_id) altijd hetzelfde instantie-ID heeft
  - Ze zijn zelfstandige MetaRegistry-entries met eigen routes, maar staan WEL in OnderliggendeGegevenselementen
  - Dit werkt correct omdat de full-entity handler filtert op de FK van het specifieke record (bijv. referentielijst_id=3 voor Landenlijst)
  - Cosmetisch: de full-response bevat lege arrays voor items-relaties van andere instanties — consistent met hoe ongebruikte GE's altijd lege arrays zijn

**B6. Input structs**
In `np_loc_modellen_input.go`:
- Verplaats `Landcode_Input`, `Landnaam_Input` van `ref_modellen_input.go`
- Hernoem `Landenlijst_Land_Input` → `LandenlijstLand_Input`, wijzig FK veld

**B7. Opruimen ref_modellen_* bestanden**
- Verwijder: ref_modellen_entiteiten.go, ref_modellen_ge_rel.go, `ref_modellen_methods.go`, `ref_modellen_input.go`
- Alle inhoud is nu in np_loc_* bestanden

### Fase C: MetaRegistry refactoring — *depends on B*

**C1. Referentielijst-entry vervangen** — np_loc_metaregistry.go
- Verwijder `MetaRegistry["Landenlijst"]` entry
- Voeg `MetaRegistry["Referentielijst"]` toe:
  - Typenaam: "Referentielijst"
  - EntiteitSubtype: EntiteitSubtypeReferentielijst
  - Tabelnaam: "register_referentielijst"
  - IsMaterieel: true (of false, ontwerpkeuze)
  - OnderliggendeGegevenselementen: Referentielijstnaam, Referentielijstomschrijving, Aanvang, Einde, **plus alle items-relaties** (LandenlijstLand, etc.)
  - Factory/DBFactory wijzen naar &Referentielijst{}
- Items-relaties staan WEL in OnderliggendeGegevenselementen van Referentielijst. Ze zijn tegelijkertijd zelfstandige MetaRegistry entries met eigen routes. Dit is consistent met hoe bijv. Bereikbaarheid onder NatuurlijkPersoon staat maar ook een eigen entry heeft.

**C2. GE-entries toevoegen**
- `MetaRegistry["Referentielijstnaam"]` — hub GE entry
- `MetaRegistry["Referentielijstnaam_Data"]` — data GE entry
- `MetaRegistry["Referentielijstomschrijving"]` — hub GE entry
- `MetaRegistry["Referentielijstomschrijving_Data"]` — data GE entry
- Alle met BovenliggendTypenaam / EntiteitIDKolom: "referentielijst_id"

**C3. Aanvang/Einde entries hernoemen**
- `MetaRegistry["Landenlijst_Aanvang"]` → `MetaRegistry["Referentielijst_Aanvang"]`
- `MetaRegistry["Landenlijst_Einde"]` → `MetaRegistry["Referentielijst_Einde"]`
- EntiteitIDKolom: "referentielijst_id"
- BovenliggendTypenaam: "Referentielijst"

**C4. Items-relatie entry hernoemen + nieuw veld**
- `MetaRegistry["Landenlijst_Land"]` → `MetaRegistry["LandenlijstLand"]`
- Wijzig EntiteitIDKolom: "referentielijst_id"
- Voeg toe: `ReferentielijstInstantie: "Landenlijst"` (systeemnaam van gebonden instantie)
- Update Klassenaam, Tabelnaam etc.
- Idem voor `MetaRegistry["Landenlijst_Land_Data"]` → `MetaRegistry["LandenlijstLand_Data"]`

**C5. Land-entries behouden, evt. kleiner**
- `MetaRegistry["Land"]`, `MetaRegistry["Landcode"]`, etc. — inhoudelijk ongewijzigd, alleen verplaatst

### Fase D: Database setup — *depends on C*

**D1. Table creation aanpassen** — `dbsetup/createtables.go`
- Verwijder aparte `RegisterReferentielijst` tabel-creatie (die komt nu via MetaRegistry-driven `createModelTables`)
- Update `syncReferentielijstRegister()`:
  - Haal instanties uit V3 JSON (of een `ReferentielijstInstanties` configuratie)
  - Voor elke instantie: INSERT register_referentielijst (id, systeemnaam, opvoer=now) ON CONFLICT (systeemnaam) DO NOTHING
  - Na insert: INSERT initiële waarden in Referentielijstnaam / Referentielijstomschrijving hub+data tabellen (als bootstrap)
- De `register_referentielijst` tabel wordt nu aangemaakt via `createModelTables` (vanuit MetaRegistry), niet meer apart

**D2. DDL-generatie check** — `dbsetup/createmodeltables.go`
- Controleer dat `register_referentielijst` tabel correct wordt gegenereerd door bestaande DDL-logica:
  - `id` PK (autoincrement? nee: handmatig beheerd via sync)
  - Hmm, of WEL autoincrement, en systeemnaam als aparte unique kolom
  - `systeemnaam` UNIQUE constraint
- Het table-creation-pad voor Referentielijst moet ook de GE-tabellen (referentielijstnaam, referentielijstnaam_data, etc.) aanmaken
- Triggers voor relatieve autoincrement op de GE hub/data tabellen

**D3. Instantie-sync herschrijven**
- Bron van instantie-definities: ofwel V3 model JSON (bij import), ofwel een configuratiebron
- Bij opstart: lees bekende instanties en synchroniseer naar `register_referentielijst`
- Dit vervangt de oude `syncReferentielijstRegister()` die MetaRegistry-entries van subtype "referentielijst" synchte

### Fase E: V3 exporter/importer — *depends on A, C*

**E1. V3 exporter aanpassen** — `model/v3_exporter.go`
- Bij export van entiteiten: schrijf `entiteitSubtype` veld (als niet-leeg)
- Bij export van relaties: schrijf `relatieSubtype` en `referentielijstInstantie` velden (als niet-leeg)
- Voeg export van `referentielijstInstanties` sectie toe: loop over bekende instanties (uit DB of configuratie)

**E2. V3 importer (schema API)** — check of parsing al subtypes leest
- De Go JSON-unmarshalling van V3Entiteit/V3Relatie leest nu automatisch de nieuwe velden (na A1)
- Check `cmd/codegen/` parsers: moeten ook de nieuwe velden lezen

**E3. Schema API** — `handlers/schema_handler.go` (of equivalent)
- De schema-API die metadata retourneert aan de frontend moet subtypes en instantie-info meesturen
- Check of dit automatisch werkt via MetaRegistry reflection

### Fase F: Routes — *depends on C*

**F1. addroutes_helper.go aanpassen**
- `addReferentielijstRoutes()`: werkt nu op basis van "Referentielijst" entry (één entry i.p.v. per type)
- Items-relaties (LandenlijstLand) worden nog steeds als aparte routes geregistreerd (via addMetaRegistryRoutes)
- Check: skip-logica in `addMetaRegistryRoutes()` die referentielijst-subtypes overslaat — is Referentielijst de enige die geskipt wordt?
- Referentielijst_item types (Land) → krijgen gewone routes OF gescheiden routes, afhankelijk van ontwerkkeuze

**F2. Endpoint `/referentielijsten`**
- `GET /referentielijsten` → retourneert lijst van alle instanties (query register_referentielijst tabel)
- `GET /referentielijsten/:systeemnaam` → retourneert specifieke instantie met GE's
- `GET /full/referentielijsten/:systeemnaam` → retourneert instantie + geneste GE's
- Het `:systeemnaam` veld vervangt de oude padnaam-gebaseerde routing

### Fase G: Editor wijzigingen — *parallel met E, F*

**G1. V3 model types uitbreiden** — `uml-editor/src/metamodel/types.js`
- Voeg `V3ReferentielijstInstantie` definitie toe
- Update `editorNaarV3Model()` om `referentielijstInstanties` sectie te exporteren
- Update `referentielijstInstantie` veld op relatie-export

**G2. Editor → V3 import** — `uml-editor/src/metamodel/v3ModelNaarEditor.js`
- Parseer `referentielijstInstanties` uit V3 JSON
- Maak instantie-nodes aan (nieuw node-type of speciaal gerenderd entiteit-node)
- Maak edges aan van items-relaties naar hun gebonden instantie

**G3. Nieuw node-type: ReferentielijstInstantie** — `uml-editor/src/components/nodes/`
- Nieuwe React-component (of variant van EntiteitNode):
  - Label: `«referentielijst»` + instantienaam (bijv. "Landenlijst")
  - Velden: naam, omschrijving (editeerbaar)
  - Kleur: aangepast (bijv. ambervariant)
  - Geen stereotype "«entiteit»" maar "«referentielijst»" of specifiek label
- Edge: van items-relatie node naar instantie node (visueel de binding)

**G4. handleAddReferentielijstSet() uitbreiden**
- Naast 3-node template, ook optioneel een instantie-node aanmaken
- Of: aparte knop "Referentielijst-instantie toevoegen"

**G5. NodeEditPanel uitbreiden**
- Instantie-node editing: systeemnaam, naam, omschrijving
- Items-relatie node: dropdown om gebonden instantie te kiezen

### Fase H: Verificatie

**H1. Go compilatie**
- `cd bitemp_register_v06 && go build Git.` — moet foutloos compileren

**H2. Go tests**
- `go test Git.` — alle bestaande tests moeten slagen
- Specifiek: `model/metamodel_test.go` controleert MetaRegistry-integriteit
- Specifiek: check of routes_test.go de nieuwe Referentielijst-entry vindt

**H3. Database**
- Start API server, controleer dat `register_referentielijst` tabel correct wordt aangemaakt
- Controleer dat GE-tabellen (referentielijstnaam, referentielijstnaam_data, etc.) bestaan
- Controleer dat instantie-sync werkt (Landenlijst record aanwezig)

**H4. API tests**
- `GET /referentielijsten` → retourneert Landenlijst
- `GET /referentielijsten/Landenlijst` → retourneert detail
- Registreer een Land, koppel via LandenlijstLand

**H5. Editor round-trip**
- Export V3 JSON vanuit editor → check dat referentielijstInstanties sectie aanwezig is
- Import V3 JSON in editor → check dat instantie-nodes correct worden weergegeven
- Check dat items-relatie edge naar instantie correct wordt getekend

**H6. Vite build**
- `npm run build` in `web/vite/` — moet foutloos bouwen

---

## Relevante bestanden

### Te wijzigen
- `model/v3_format.go` — V3 struct uitbreidingen (A1)
- `model/metaregistry_plumbing.go` — TypeMeta nieuw veld (A2)
- `model/np_loc_modellen_entiteiten.go` — Referentielijst struct + Aanvang/Einde (B1)
- `model/np_loc_modellen_ge_rel.go` — Referentielijstnaam, Referentielijstomschrijving, LandenlijstLand hernoemen (B2, B3, B4)
- `model/np_loc_modellen_methods.go` — interface methods (B5)
- `model/np_loc_modellen_input.go` — input structs (B6)
- `model/np_loc_metaregistry.go` — alle MetaRegistry entries (C1-C5)
- `model/v3_exporter.go` — subtypes en instanties exporteren (E1)
- `dbsetup/createtables.go` — sync herschrijven (D1, D3)
- `dbsetup/createmodeltables.go` — DDL check (D2)
- `routes/addroutes_helper.go` — route-registratie (F1, F2)
- `uml-editor/src/metamodel/types.js` — V3 types + export (G1)
- `uml-editor/src/metamodel/v3ModelNaarEditor.js` — import (G2)
- `uml-editor/src/metamodel/editorNaarV3Model.js` — export (als apart bestand)
- `uml-editor/src/components/MetamodelEditor.jsx` — instantie handling (G4)
- `uml-editor/src/components/panels/NodeEditPanel.jsx` — instantie editing (G5)

### Te verwijderen
- `model/ref_modellen_entiteiten.go` — inhoud verplaatst (B7)
- `model/ref_modellen_ge_rel.go` — inhoud verplaatst (B7)
- `model/ref_modellen_methods.go` — inhoud verplaatst (B7)
- `model/ref_modellen_input.go` — inhoud verplaatst (B7)

### Te raadplegen (referentie)
- `model/metaregistry.go` — bestaande MetaRegistry structuur als voorbeeld
- `model/modellen_entiteiten.go` — A/B entiteit structs als patroon
- `model/modellen_ge_rel.go` — hub+data patroon als voorbeeld
- `model/np_loc_modellen_entiteiten.go` — NP/Locatie structs als patroon
- `Referentielijsten.md` — UML diagrammen, ontwerpkeuzen

---

## Beslissingen

1. **Tabel `register_referentielijst` hergebruiken**: de tabel behoudt zijn naam maar wordt nu de entiteit-tabel voor Referentielijst (was aparte systeemtabel). Kolommen wijzigen: `typenaam` → `systeemnaam`, `naam`/`beschrijving`/`is_materieel` worden verwijderd (gaan naar GE's resp. MetaRegistry).
2. **`systeemnaam` als stabiele identifier**: elk referentielijst-record heeft een immutable systeemnaam die gebruikt wordt voor V3 JSON sync, routing, en binding van items-relaties.
3. **Items-relaties staan WEL in OnderliggendeGegevenselementen van Referentielijst**: ze zijn gewone onderliggende relaties, met de constraint dat de primaire FK altijd hetzelfde instantie-ID heeft. Ze zijn tegelijk zelfstandige MetaRegistry-entries met eigen routes. Dit is consistent met hoe bijv. Bereikbaarheid onder NatuurlijkPersoon staat. De full-entity handler filtert op FK → lege arrays voor items-relaties van andere instanties, consistent met bestaand gedrag.
4. **`is_materieel` is klasse-eigenschap**: geldt voor ALLE referentielijst-instanties uniform. Staat in MetaRegistry, niet per-record.
5. **Naamconventie doorgevoerd**: geen underscores in gewone klasse-namen (LandenlijstLand i.p.v. Landenlijst_Land). Systeemsuffixen (_Data, _Aanvang, _Einde) behouden underscores.
6. **Scope-afbakening**: codegenerator (cmd/codegen/) wordt NIET in dit plan aangepast. Dat is een vervolgstap nadat de handmatige constructie werkt.

---

## Openstaande overwegingen

1. **Instantie-ID management**: `systeemnaam` voor lookup, `id` wordt autoincrement. Bij match op systeemnaam wordt bestaand record met zijn id hergebruikt. ✅ Besloten.
2. **Cross-model referentielijsten**: nu buiten scope, maar structuur moet dit niet blokkeren (d.w.z. geen hardcoded model-afhankelijkheid in de Referentielijst-structs). Toekomstige iteratie.
3. **Bootstrap GE-data**: directe INSERT voor bootstrap bij eerste sync. ✅ Besloten.
4. **Items-relatie FK constraint**: `referentielijst_id` in bijv. `landenlijst_land` is altijd het ID van de Landenlijst-instantie. Nu via applicatielogica afgedwongen; in toekomstige iteratie evt. DB CHECK constraint.


## Referentielijsten — Ontwerp & Ontwerpkeuzen
Fase 0 is toegevoegd aan het plan. Samenvatting van wat er moet veranderen in Referentielijsten.md:

| Sectie | Wat achterloopt |
|---|---|
| §2 Subtypes + diagrammen | Klasse/instantie onderscheid mist; LandenlijstLand naamconventie; items-relaties als onderliggend |
| §3 Systeemtabel | Wordt entiteit-tabel; kolommen wijzigen (`systeemnaam`, opvoer/afvoer); sync-bron wordt V3 JSON |
| §3+ (nieuw) | GE's Referentielijstnaam + Referentielijstomschrijving |
| §6 V3 JSON | `referentielijstInstanties` sectie + `referentielijstInstantie` op relaties |
| §8 Naamconventie | Geen underscores in gewone klassen (PascalCase aaneengeschreven) |
| §9 MetaRegistry | `ReferentielijstInstantie` veld; items-relaties in OnderliggendeGegevenselementen |
| §11 Fasen | Verwijzing naar implementatieplan |
| (nieuw) Beslissingen | Alle 6 beslissingen + openstaande overwegingen |

Bij implementatie pak ik dit als eerste stap op. Wil je nu naar implementatie switchen?


```
Plak dit in `bitemp_register_v06/docs/implementatieplan-referentielijsten.md` (of een pad naar keuze). Daarna kun je het plan altijd terugvinden, ook als Copilot crasht of de sessie verloren gaat.Plak dit in `bitemp_register_v06/docs/implementatieplan-referentielijsten.md` (of een pad naar keuze). Daarna kun je het plan altijd terugvinden, ook als Copilot crasht of de sessie verloren gaat.
```

## error met oude tabellen

### Oorzaak
Bij het starten van de API server faalde de FK-constraint creatie omdat de oude database nog tabellen had van vóór de refactoring. De `IfNotExists()` clause in bun voorkomt dat bestaande tabellen worden herschepd, waardoor de oude kolomnamen (`landenlijst_id`) bleven bestaan terwijl de nieuwe code `referentielijst_id` verwachtte.

N.B. `admin drop tables enabled: true` in de logoutput schakelt alleen de HTTP DELETE endpoint in — het dropt NIET automatisch tabellen bij het opstarten.

### Oplossing: DB migratie `ensureReferentielijstRefactorMigrated()`
Nieuwe functie in `dbsetup/createmodeltables.go`, aangeroepen aan het begin van `createModelTables()`, vóór alle tabelcreatie. De migratie is idempotent (veilig om meerdere keren uit te voeren) en voert de volgende stappen uit:

| # | Actie | Details |
|---|-------|---------|
| 1 | `register_referentielijst`: kolom hernoemen | `typenaam` → `systeemnaam` |
| 1b | `register_referentielijst`: kolommen toevoegen | `opvoer TIMESTAMPTZ`, `afvoer TIMESTAMPTZ` |
| 1c | `register_referentielijst`: legacy kolommen verwijderen | DROP `naam`, `beschrijving`, `is_materieel` |
| 2 | Tabel hernoemen | `landenlijst_aanvang` → `referentielijst_aanvang` |
| 2b | Kolom hernoemen | `referentielijst_aanvang.landenlijst_id` → `referentielijst_id` |
| 3 | Tabel hernoemen | `landenlijst_einde` → `referentielijst_einde` |
| 3b | Kolom hernoemen | `referentielijst_einde.landenlijst_id` → `referentielijst_id` |
| 4 | Kolom hernoemen | `landenlijst_land.landenlijst_id` → `referentielijst_id` |
| 5 | Kolom hernoemen | `landenlijst_land_data.landenlijst_id` → `referentielijst_id` |
| 6 | Tabel droppen | `DROP TABLE IF EXISTS landenlijst CASCADE` |

Alle stappen gebruiken `IF EXISTS` / `IF NOT EXISTS` checks, zodat op een verse database niets gebeurt.

---

## Implementatiestatus

| Fase | Onderdeel | Status |
|------|-----------|--------|
| 0 | Documentatie (Referentielijsten.md) | ✅ Compleet |
| A1 | V3 format Go structs | ✅ Compleet |
| A2 | MetaRegistry plumbing (TypeMeta) | ✅ Compleet |
| B | Go model refactoring (structs, methods, input) | ✅ Compleet |
| C | MetaRegistry entries | ✅ Compleet |
| D | Database setup + migratie | ✅ Compleet |
| E | V3 exporter + codegen | ✅ Compleet |
| F | Routes | ✅ Compleet |
| G | UML Editor (types, import, nodes, toolbar, editing) | ✅ Compleet |
| H | Verificatie (build, tests, vite build) | ✅ Compleet |
| — | DB migratie oude tabellen | ✅ Compleet |

---

## API Endpoints voor referentielijsten

### Overzicht referentielijsten
| Methode | Endpoint | Beschrijving |
|---------|----------|--------------|
| GET | `/referentielijsten` | Overzicht van alle referentielijst-instanties (uit `register_referentielijst` tabel) |

### Referentielijst-entiteit (generiek)
| Methode | Endpoint | Beschrijving |
|---------|----------|--------------|
| GET | `/referentielijsten/referentielijsten` | Lijst van alle Referentielijst-records |
| GET | `/referentielijsten/referentielijsten/:id` | Detail van één Referentielijst |
| POST | `/referentielijsten/referentielijsten` | Nieuw Referentielijst-record aanmaken |
| GET | `/full/referentielijsten/referentielijsten` | Volledige (expanded) lijst met geneste GE's |
| GET | `/full/referentielijsten/referentielijsten/:id` | Volledige detail met geneste GE's |
| POST | `/full/referentielijsten/referentielijsten` | Volledig record aanmaken met geneste GE's |

### GE's van Referentielijst (standaard routes)
| Methode | Endpoint | Beschrijving |
|---------|----------|--------------|
| GET | `/referentielijstnamen` | Alle Referentielijstnaam hubs |
| GET | `/referentielijstnamen/:id` | Specifieke Referentielijstnaam hub |
| GET | `/referentielijstomschrijvingen` | Alle Referentielijstomschrijving hubs |
| GET | `/referentielijstomschrijvingen/:id` | Specifieke Referentielijstomschrijving hub |
| GET | `/referentielijstnaam_data` | Alle Referentielijstnaam data records |
| GET | `/referentielijstomschrijving_data` | Alle Referentielijstomschrijving data records |

### Materiële plumbing
| Methode | Endpoint | Beschrijving |
|---------|----------|--------------|
| GET | `/referentielijst_aanvang` | Alle aanvangrecords van Referentielijst |
| GET | `/referentielijst_einde` | Alle einderecords van Referentielijst |
| GET | `/land_aanvang` | Alle aanvangrecords van Land |
| GET | `/land_einde` | Alle einderecords van Land |

### Land (referentielijst_item)
| Methode | Endpoint | Beschrijving |
|---------|----------|--------------|
| GET | `/landen` | Lijst van alle landen |
| GET | `/landen/:id` | Detail van één land |
| POST | `/landen` | Nieuw land aanmaken |
| GET | `/full/landen` | Volledige lijst met geneste GE's |
| GET | `/full/landen/:id` | Volledig detail met geneste GE's |

### GE's van Land
| Methode | Endpoint | Beschrijving |
|---------|----------|--------------|
| GET | `/landcodes` | Alle Landcode hubs |
| GET | `/landnamen` | Alle Landnaam hubs |
| GET | `/landcode_data` | Alle Landcode data records |
| GET | `/landnaam_data` | Alle Landnaam data records |

### Items-relatie: LandenlijstLand
| Methode | Endpoint | Beschrijving |
|---------|----------|--------------|
| GET | `/landenlijst_landen` | Alle LandenlijstLand koppelrecords |
| GET | `/landenlijst_landen/:id` | Specifiek koppelrecord |
| POST | `/landenlijst_landen` | Nieuw koppelrecord aanmaken |
| GET | `/landenlijst_land_data` | Alle LandenlijstLand data records |

### Registratie (formele tijd)
| Methode | Endpoint | Beschrijving |
|---------|----------|--------------|
| POST | `/registreer` | Registratie van wijzigingen (opvoer/afvoer) op alle types |
