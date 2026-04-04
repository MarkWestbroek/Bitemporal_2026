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
