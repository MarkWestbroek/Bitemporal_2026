# Roundtrip Engineering — MetaRegistry ↔ V3 JSON ↔ Editor

> **Status**: eerste versie, 2026-03-29

---

## 1. Doel

Het model wordt op vier plekken gerepresenteerd, en deze moeten volledig synchroon blijven:

| Laag | Locatie | Formaat |
|---|---|---|
| **Code** | MetaRegistry + Go structs | Go-typen, tags, metadata |
| **V3 JSON** | Export via `GET /api/schema/model` | `V3Model` JSON |
| **DB** | `schema_versies` tabel | Opgeslagen V3 JSON |
| **Editor** | ReactFlow UML-editor | Nodes, edges, posities |

Roundtrip engineering garandeert dat wijzigingen in de editor terug in code landen (via codegen) en wijzigingen in code correct in de editor verschijnen (via V3 export).

---

## 2. EditorLayout — layoutmetadata in de MetaRegistry

Elke `TypeMeta`-entry heeft een optioneel `Layout *EditorLayout` veld dat de UML-editor layout beschrijft:

```go
type EditorLayout struct {
    Positie          *V3Positie // node-positie in de editor
    EdgeID           string     // persistente edge-id (entiteit→GE/relatie)
    SourceHandle     string     // handle op de bron-zijde van de owner-edge
    TargetHandle     string     // handle op de doel-zijde van de owner-edge
    DoelEdgeID       string     // alleen relaties: edge-id naar doel-entiteit
    DoelSourceHandle string     // alleen relaties: handle op relatie (uitgaand naar doel)
    DoelTargetHandle string     // alleen relaties: handle op doel-entiteit (inkomend)
}
```

### Waarom in de MetaRegistry?

- **Single source of truth**: alle metadata over een representatietype — inclusief layout — staat op één plek.
- **Geen drift**: als de editor posities wijzigt, worden deze via codegen teruggeschreven naar de MetaRegistry.
- **Geen reflection nodig**: de V3 exporter leest Layout direct uit TypeMeta, zonder tags of conventies.

### Wat staat waar?

| Layoutgegeven | TypeMeta.Layout | Aparte registry |
|---|---|---|
| Entiteit-positie | ✅ `Positie` | — |
| GE/relatie-positie | ✅ `Positie` (op de hub-entry) | — |
| Edge-id + handles (entiteit→GE) | ✅ `EdgeID`, `SourceHandle`, `TargetHandle` | — |
| Edge-id + handles (relatie→doel) | ✅ `DoelEdgeID`, `DoelSourceHandle`, `DoelTargetHandle` | — |
| Referentielijst-instantie positie | — | `ReferentielijstInstantieRegistry` |
| Enum-positie | — | `EnumEditorLayouts` |
| Custom datatype positie | — | `DatatypeRegistry` (veld `Positie`) |

---

## 3. Aanvullende registries voor editor-layout

### ReferentielijstInstantieRegistry

Referentielijst-instanties (bijv. Landenlijst, EuLidstaten) zijn records, geen types. Hun editor-positie staat daarom niet in TypeMeta maar in een apart register:

```go
var ReferentielijstInstantieRegistry = map[string]ReferentielijstInstantieInfo{}

type ReferentielijstInstantieInfo struct {
    Naam         string
    Omschrijving string
    Layout       *EditorLayout
}
```

### EnumEditorLayouts

Enums worden dynamisch verzameld uit de Go-types, maar hun editor-positie is apart:

```go
var EnumEditorLayouts = map[string]*EditorLayout{}
```

### DatatypeRegistry

Custom datatypes (NLPostcode, BSN) hebben al een `Positie *V3Positie` veld in hun `V3Datatype` struct.

---

## 4. V3 Exporter — flow van MetaRegistry naar JSON

`ExportMetaRegistryToV3()` in `v3_exporter.go` bouwt een `V3Model` op:

### Entiteiten
```
TypeMeta (Metatype == Entiteit)
  → V3Entiteit.Positie  ← meta.Layout.Positie
  → V3Entiteit.Gegevenselementen[]
      → V3Gegevenselement.Positie      ← childMeta.Layout.Positie
      → V3Gegevenselement.ID           ← childMeta.Layout.EdgeID
      → V3Gegevenselement.SourceHandle ← childMeta.Layout.SourceHandle
      → V3Gegevenselement.TargetHandle ← childMeta.Layout.TargetHandle
  → V3Entiteit.Relaties[]
      → V3Relatie.Positie          ← childMeta.Layout.Positie
      → V3Relatie.ID               ← childMeta.Layout.EdgeID
      → V3Relatie.SourceHandle     ← childMeta.Layout.SourceHandle
      → V3Relatie.TargetHandle     ← childMeta.Layout.TargetHandle
      → V3Relatie.DoelID           ← childMeta.Layout.DoelEdgeID
      → V3Relatie.DoelSourceHandle ← childMeta.Layout.DoelSourceHandle
      → V3Relatie.DoelTargetHandle ← childMeta.Layout.DoelTargetHandle
```

### Referentielijst-instanties
```
ReferentielijstInstantieRegistry[systeemnaam]
  → V3ReferentielijstInstantie.Naam
  → V3ReferentielijstInstantie.Omschrijving
  → V3ReferentielijstInstantie.Positie ← info.Layout.Positie
```

### Enums
```
EnumWaarden[goType] → V3Enum.Waarden
EnumEditorLayouts[goType] → V3Enum.Positie
```

> Gebruik voor enum-velden bij voorkeur altijd een **genoemde enum-ref** zoals `schema:"enum=RelABSoort"` of `schema:"enum=ABCEnum"`.
> Inline waardenlijsten zoals `schema:"enum=LTT|LAT|LTA"` zijn legacy, maar verliezen editor-metadata zoals de enum-nodepositie bij een roundtrip.

### Datatypes
```
DatatypeRegistry[] → V3Datatype.Positie (reeds direct in struct)
```

---

## 5. Editor import/export

### Editor → V3 JSON (opslaan)
De editor exporteert nodes en edges naar V3 JSON via `editorNaarV3Model.js`. Posities, edge-IDs en handles worden direct uit de ReactFlow-state gehaald en in de V3-structuur geschreven.

### V3 JSON → Editor (laden)
`v3ModelNaarEditor.js` leest de V3 JSON en maakt ReactFlow nodes + edges aan op basis van de positie- en handle-gegevens.

Daarbij worden ook de aparte `referentielijstInstanties` opnieuw als nodes opgebouwd, plus de korte binding-edges naar relaties met subtype `referentielijst_items`. Daardoor blijven de visuele koppelingen naar bijvoorbeeld `Landenlijst` en `AdellijkeTitels` behouden na opslaan en opnieuw laden.

> Sinds 2026-04-04 bewaart V3 voor deze binding ook expliciet de editor-metadata `instantieId`, `instantieSourceHandle` en `instantieTargetHandle` op de relatie. Daardoor overleeft nu niet alleen de semantische koppeling (`referentielijstInstantie`), maar ook de gekozen `use`-lijnroute/handle-posities een JSON save-load roundtrip.

### V3 JSON → Code (codegen)
De codegenerator (`cmd/codegen/`) leest het V3 JSON en genereert:
- Go structs (`gen_structs.go`)
- MetaRegistry entries (`gen_registry.go`) inclusief `Layout`-velden
- Database DDL

Layout-gegevens in V3 JSON worden doorgegeven aan `EditorLayout` in de gegenereerde MetaRegistry — zo is de cirkel rond.

---

## 6. Domeinfiltering

Omdat meerdere domeinen (AB-testmodel, NP-Locatie) naast elkaar in dezelfde MetaRegistry bestaan, ondersteunt de V3 exporter filtering op domein via het `Domein`-veld in TypeMeta:

```go
type TypeMeta struct {
    // ...
    Domein string // bijv. "np-loc", "ab"
    // ...
}
```

Bij export kan een domeincode worden meegegeven om alleen types uit dat domein te exporteren. Dit voorkomt dat het AB-testmodel en het NP-Locatie model door elkaar in de V3 JSON terechtkomen.

---

## 7. Custom datatypes op velden

Velden in _Data structs kunnen verwijzen naar custom datatypes (NLPostcode, BSN) via de `schema` tag:

```go
Postcode NLPostcode `json:"postcode" schema:"datatype:NLPostcode"`
Bsn      BSN        `json:"bsn" schema:"datatype:BSN"`
```

> Gebruik hier bewust **geen** `enum=NLPostcode` of `enum=BSN`: custom datatypes en enumeraties zijn aparte concepten in het V3 model.

De V3 exporter leest deze tag en zet het `Datatype`-veld in `V3Veld`:

```json
{ "naam": "postcode", "goType": "string", "datatype": "NLPostcode" }
```

De frontend en codegenerator gebruiken deze referentie om validatieregels en weergave-hints uit het corresponderende `V3Datatype`-object te halen.

---

## 8. V3 model-uitbreidingen (2026-04 / 2026-05)

### 8.1 Benoemde diagrammen — `Diagrammen` (A4-rev)

Het V3 model bevat nu een optioneel `diagrammen`-veld dat **benoemde diagrammen** uit de IDE exporteert en importeert. Dit sluit de roundtrip-cirkel ook voor IDE-layout: IDE → V3 → IDE.

**Go-types** (in `model/v3_format.go`):

```go
type V3Model struct {
    // ...
    Diagrammen []V3Diagram `json:"diagrammen,omitempty"`
}

type V3Diagram struct {
    ID     string          `json:"id"`
    Naam   string          `json:"naam"`
    Domein string          `json:"domein,omitempty"`
    Nodes  []V3DiagramNode `json:"nodes"`
    Edges  []V3DiagramEdge `json:"edges"`
}

type V3DiagramNode struct {
    ElementID string   `json:"elementId"`
    X         float64  `json:"x"`
    Y         float64  `json:"y"`
    Width     *float64 `json:"width,omitempty"`
    Height    *float64 `json:"height,omitempty"`
}
```

**Regels:**
- Het **Overzicht**-diagram (`overzicht`) is **afgeleid** en wordt nooit geëxporteerd of geïmporteerd. Overzicht wordt bij import altijd opnieuw opgebouwd vanuit de positie-metadata in de entiteiten/GE's/relaties.
- Benoemde diagrammen (niet `overzicht`) worden volledig serialiseerd inclusief node-posities, edge-IDs en handles.
- Codegen en MetaRegistry kennen `Diagrammen` niet — het veld wordt transparant doorgegeven bij JSON-roundtrips.

**Adapter-flow:**
```
storeNaarV3Model():  diagrams (store) → v3Model.diagrammen  (skip overzicht)
v3ModelNaarStore():  v3Model.diagrammen → diagrams (store)  (skip overzicht)
```

---

### 8.2 Verplaatsbare edge-labels — `V3LabelOffsets` (B5)

Associatie- en compositie-edges kunnen twee optionele naam-labels dragen:
`naamLabelHeen` (richting bron→doel) en `naamLabelTerug` (richting doel→bron).
Beide labels zijn nu **op het canvas versleepbaar**; hun offset ten opzichte van de standaard-positie wordt opgeslagen.

**Go-types** (in `model/v3_format.go`):

```go
type V3DiagramEdge struct {
    ID           string          `json:"id"`
    Source       string          `json:"source"`
    Target       string          `json:"target"`
    SourceHandle string          `json:"sourceHandle,omitempty"`
    TargetHandle string          `json:"targetHandle,omitempty"`
    LabelOffsets *V3LabelOffsets `json:"labelOffsets,omitempty"`
    Animated     bool            `json:"animated,omitempty"`
}

type V3LabelOffsets struct {
    Heen  *V3Offset `json:"heen,omitempty"`
    Terug *V3Offset `json:"terug,omitempty"`
}

type V3Offset struct {
    X float64 `json:"x"`
    Y float64 `json:"y"`
}
```

**UI-gedrag** (in `MetamodelEdge.jsx`):
- `naamLabelHeen` verschijnt met een ▶-markering; `naamLabelTerug` met ◀.
- Slepen verplaatst het label; de offset wordt zoom-gecorrigeerd via `getViewport().zoom`.
- Dubbelklik reset de offset naar de standaard-positie.
- Offsets worden persistent opgeslagen in `e.data.labelOffsets` in de store en geserialiseerd via de adapter.

**Adapter-flow:**
```
storeNaarV3Model():  e.data.labelOffsets → v3DiagEdge.labelOffsets  (alleen als ≠ {0,0})
v3ModelNaarStore():  v3DiagEdge.labelOffsets → e.data.labelOffsets
```

**Open follow-ups:** editor-v2 (`uml-editor/`) leest/schrijft `labelOffsets` nog niet; DB-publicatie en MetaRegistry roundtrip zijn nog niet gekoppeld.

---

### 8.3 Annotaties op het canvas — `V3Notitie` en `V3Constraint` (C8)

Twee nieuwe annotatie-types zijn toegevoegd aan het V3 model:

| Type | UML-analogie | Visueel | Scope-edges |
|------|-------------|---------|-------------|
| `V3Notitie` | UML Note | Gele post-it | Geen |
| `V3Constraint` | UML Constraint | Lichtblauwe rounded-rect | Altijd zichtbaar (niet verbergbaar) |

**Go-types** (in `model/v3_format.go`):

```go
type V3Model struct {
    // ...
    Notities    []V3Notitie    `json:"notities,omitempty"`
    Constraints []V3Constraint `json:"constraints,omitempty"`
}

type V3Notitie struct {
    ID      string     `json:"id"`
    Tekst   string     `json:"tekst"`
    Domein  string     `json:"domein,omitempty"`
    Positie *V3Positie `json:"positie,omitempty"`
    Kleur   string     `json:"kleur,omitempty"`
    Breedte *float64   `json:"breedte,omitempty"`
    Hoogte  *float64   `json:"hoogte,omitempty"`
}

type V3Constraint struct {
    ID        string     `json:"id"`
    Naam      string     `json:"naam,omitempty"`
    Expressie string     `json:"expressie"`
    Taal      string     `json:"taal,omitempty"`   // "ocl", "cel", "tekst"
    Domein    string     `json:"domein,omitempty"`
    Positie   *V3Positie `json:"positie,omitempty"`
    Breedte   *float64   `json:"breedte,omitempty"`
    Hoogte    *float64   `json:"hoogte,omitempty"`
    ScopeRefs []string   `json:"scopeRefs,omitempty"`
}
```

**Store-representatie:** Notities en constraints leven als eigen element-types in de IDE-store:
- `type: "notitie"` — `data.tekst`, `data.positie`, `data.kleur`, `data.breedte`, `data.hoogte`
- `type: "constraint"` — `data.expressie`, `data.taal`, `data.positie`, `data.breedte`, `data.hoogte`

**Scope-edges van constraints** worden geserialiseerd als `structuralEdges` met `data.kind === "scope"` (source = constraint-ID, target = element-typenaam). Bij V3-export worden ze omgezet naar `scopeRefs`; bij V3-import teruggevormd naar structurele edges. Scope-edges zijn semantisch altijd zichtbaar.

**Codegen-transparantie:** Codegen en MetaRegistry kennen `Notities` en `Constraints` niet — ze worden uitsluitend als visuele/documentatie-annotaties behandeld.

**Status (2026-04-30):** Datalaag volledig geïmplementeerd en getest (`v3_b5_c8_roundtrip.test.js`). UI-rendering (canvas-nodes, palette-items) staat nog open.

---

### 8.4 Overzicht V3 model-structuur (volledig)

```json
{
  "versie": "v1.0",
  "naam": "Mijn model",
  "domeinen":    [ { "naam", "versie", "beschrijving", "kleur", "prefix" } ],
  "datatypes":   [ { "naam", "basistype", "format", "validatie", "weergave" } ],
  "enums":       [ { "goType", "waarden": [{ "constNaam", "waarde" }] } ],
  "entiteiten":  [ {
    "typenaam", "erft", "isAbstract", "isMaterieel",
    "gegevenselementen": [ { "naam", "naamLabelHeen", "naamLabelTerug",
                              "id", "sourceHandle", "targetHandle", ... } ],
    "relaties":          [ { "naam", "doelEntiteit", "directioneel",
                              "naamLabelHeen", "naamLabelTerug", ... } ]
  } ],
  "diagrammen":  [ {                           // ← A4-rev (2026-04)
    "id", "naam", "domein",
    "nodes": [ { "elementId", "x", "y", "width?", "height?" } ],
    "edges": [ { "id", "source", "target",
                 "sourceHandle?", "targetHandle?",
                 "labelOffsets?": { "heen?": {"x","y"}, "terug?": {"x","y"} } } ]  // ← B5
  } ],
  "notities":    [ { "id", "tekst", "positie", "kleur" } ],    // ← C8
  "constraints": [ { "id", "naam", "expressie", "taal",        // ← C8
                     "positie", "scopeRefs": ["TypeA", "TypeB"] } ]
}
```
