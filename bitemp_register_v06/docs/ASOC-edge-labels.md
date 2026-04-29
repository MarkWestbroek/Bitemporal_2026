# ASOC edge-labels — ontwerp

**Status:** ontwerp · niet geïmplementeerd
**Scope:** alleen UI/adapter-laag (`web/vite/src/`). Geen wijzigingen in V3 JSON, codegen of backend.
**Verwante docs:** [ASOC.md](ASOC.md), [`shared/asoc.js`](../web/vite/src/shared/asoc.js)

## 1. Probleemstelling

In het ASOC-patroon wordt een relatie op het diagram getekend als drie edges
(bron → anker, anker → doel, anker ╌ REL) plus een anker-node en een
relatie-node. De labels op die edges (kardinaliteiten en richtingsnamen) zijn
nu verspreid opgeslagen op meerdere plekken:

| Wat                  | Single source (V3)            | Werkkopie in editor                            |
|----------------------|-------------------------------|-------------------------------------------------|
| `bronKardinaliteit`  | `rel.bronKardinaliteit`       | `doelEdge.data.kardinaliteit` (B-zijde-label)  |
| `doelKardinaliteit`  | `rel.doelKardinaliteit`       | `ankerEdge.data.kardinaliteit` (A-zijde-label) |
| `naamLabelHeen`      | `rel.naamLabelHeen`           | `relNode.data.naamLabelHeen`                   |
| `naamLabelTerug`     | `rel.naamLabelTerug`          | `relNode.data.naamLabelTerug`                  |

### Observaties

1. **Spiegel-conventie is impliciet**. In `types.js` (`v3ModelNaarEditor.js`,
   `adapters.js`) staat de UML-conventie als comment: "label nabij bron-entiteit
   toont `bronKardinaliteit`, want UML zegt: hoeveel bron-instanties doen mee aan
   één relatie-instantie". Maar omdat de edge `bron → anker` heet, eindigt
   `bronKardinaliteit` paradoxaal genoeg op `doelEdge` (B-zijde). Dat is de
   spiegel-conventie — maar nergens centraal geborgd.

2. **Round-trip risico**. Bij elke export wordt de waarde van
   `doelEdge.data.kardinaliteit` teruggepropageerd naar `rel.bronKardinaliteit`.
   Bij elke import omgekeerd. Eén bug in één van de drie codepaden
   (`adapters.js`, `v3ModelNaarEditor.js`, `types.js`) levert silent data-loss
   op (zie `ASOC.md` § "Single source of truth toepassen").

3. **Inconsistente naamlabels**. `naamLabelHeen`/`naamLabelTerug` worden alleen
   in `DetailsPanel.jsx` getoond/bewerkt op de **relatie-node** (en op
   GE-edges + dependency-edges). Op de anker-edges zelf zijn ze niet
   bewerkbaar/zichtbaar — dat is correct, maar de bewerkingsplek is daarmee
   asymmetrisch met de plek waar ze gerenderd worden (op de edge).

4. **`types.js` reconstrueert `momentvoorkomen` uit `bronKardinaliteit`**
   (regel 827) — een afgeleid veld dat bij een refactor (zie [ASOC.md](ASOC.md)
   "TODO: detect ASOC via isAsoc(rel) instead of edge-scanning") verdwijnt.

## 2. Doel

Eén canonieke opslagplek voor de vier velden — de **relatie-node** — waarbij
alle edges hun label **lezen vanuit de relatie-node** (via `relId`). Geen
duplicatie meer in `edge.data.kardinaliteit`.

## 3. Voorgestelde oplossing

### 3.1 Data-model (in-editor)

| Veld                  | Locatie                          | Bron-of-truth                    |
|-----------------------|----------------------------------|----------------------------------|
| `bronKardinaliteit`   | `relNode.data.bronKardinaliteit` | V3 `rel.bronKardinaliteit`       |
| `doelKardinaliteit`   | `relNode.data.doelKardinaliteit` | V3 `rel.doelKardinaliteit`       |
| `naamLabelHeen`       | `relNode.data.naamLabelHeen`     | V3 `rel.naamLabelHeen`           |
| `naamLabelTerug`      | `relNode.data.naamLabelTerug`    | V3 `rel.naamLabelTerug`          |
| `directioneel`        | `relNode.data.directioneel`      | V3 `rel.directioneel`            |

`edge.data.kardinaliteit` op anker-edges wordt **afgeschaft als opslag** en
herinterpreteerd als pure renderhint (computed) — of nog liever, helemaal
verwijderd uit `edge.data` en in de edge-renderer berekend uit `relNode`.

### 3.2 Spiegel-conventie expliciet maken

Toevoegen aan [`shared/asoc.js`](../web/vite/src/shared/asoc.js):

```js
/**
 * UML-conventie: een multipliciteit aan een edge-uiteinde geeft aan
 * hoeveel instanties van de náábije klasse meedoen aan één instantie
 * van de andere klasse. Voor het ASOC-patroon betekent dat:
 *
 *   bron ───[bronKard]── ◇ ──[doelKard]─── doel
 *
 * Het label nabij `bron` toont `bronKardinaliteit`. Dat klopt ook
 * intuïtief in collapsed-vorm (`bron ── REL ── doel`).
 *
 * @param {Relatie} rel
 * @returns {{bron: string, doel: string}}
 */
export function edgeLabels(rel) {
  return {
    bron: rel.bronKardinaliteit || "0..*",
    doel: rel.directioneel ? "" : (rel.doelKardinaliteit || "0..*"),
  };
}
```

Alle render- en exportcode roept `edgeLabels(rel)` aan in plaats van de
mapping zelf te interpreteren.

### 3.3 Edge-renderer

`MetamodelEdge.jsx` ontvangt straks geen `data.kardinaliteit` meer, maar leest
het label uit de relatie-node via `relId`:

```jsx
const rel = useElement(data.relId);
const { bron, doel } = edgeLabels(rel);
const label = data.zijde === "bron" ? bron : doel;
```

Vergt: anker-edges krijgen extra `data.relId` + `data.zijde` (`"bron" | "doel"`)
in plaats van `data.kardinaliteit`.

### 3.4 DetailsPanel

In de relatie-node-tab van [`DetailsPanel.jsx`](../web/vite/src/ide/DetailsPanel.jsx) (huidig
~regel 896, 911) blijft het bewerken van `naamLabelHeen`/`naamLabelTerug` /
`bronKardinaliteit`/`doelKardinaliteit` ongewijzigd. Op edge-tabs (anker-edges)
worden deze velden **read-only** met een knop "→ bewerk in relatie-node".

### 3.5 Migratie van bestaande layouts

Omdat `edge.data.kardinaliteit` historisch werd gebruikt, voegen we een
migratie-stap toe in [`useModelStore.js`](../web/vite/src/store/useModelStore.js)
bij `loadModel()`:

```js
function migrateAsocEdges(state) {
  for (const diagram of Object.values(state.diagrams || {})) {
    for (const edge of diagram.edges || []) {
      if (!edge.data?.kardinaliteit || !edge.data?.relId) continue;
      const rel = state.elements[edge.data.relId];
      if (!rel) continue;
      // Spiegel-conventie: doelEdge → bronKard, ankerEdge → doelKard
      if (edge.data.zijde === "bron" && !rel.data.bronKardinaliteit) {
        rel.data.bronKardinaliteit = edge.data.kardinaliteit;
      }
      if (edge.data.zijde === "doel" && !rel.data.doelKardinaliteit) {
        rel.data.doelKardinaliteit = edge.data.kardinaliteit;
      }
      delete edge.data.kardinaliteit;
    }
  }
}
```

Idempotent: bij een tweede load doet hij niets.

### 3.6 Cleanup `types.js`

Conform de TODO in [ASOC.md](ASOC.md):

1. ASOC-detectie via `isAsoc(rel)` in plaats van edge-scanning op
   `isAssociation`/`isAssociationClassLink`.
2. `momentvoorkomen` niet meer reconstrueren uit `bronKardinaliteit`, maar
   direct lezen uit `relNode.data.momentvoorkomen` (single source).
3. `bronKardinaliteit`/`doelKardinaliteit` niet meer uit edge-data lezen, maar
   uit `relNode.data` (na migratie).

## 4. Impact-lijst

| Bestand                                                       | Wijziging                                                |
|---------------------------------------------------------------|----------------------------------------------------------|
| `web/vite/src/shared/asoc.js`                                 | + `edgeLabels(rel)` helper                               |
| `web/vite/src/store/adapters.js` (regel ~386–424)             | edge-aanmaak: `data.relId`+`data.zijde` ipv `kardinaliteit` |
| `web/vite/src/store/adapters.js` (regel ~1004)                | export: lees `bron/doelKardinaliteit` direct van relNode |
| `web/vite/src/store/useModelStore.js`                         | + `migrateAsocEdges()` in `loadModel`                    |
| `web/vite/src/umleditor/components/edges/MetamodelEdge.jsx`  | label-resolver: `useElement(relId)` + `edgeLabels()`      |
| `web/vite/src/umleditor/metamodel/types.js` (regel ~821–846)  | cleanup: lees direct van relNode, gebruik `isAsoc`       |
| `web/vite/src/umleditor/metamodel/v3ModelNaarEditor.js` (~395–470) | edge-aanmaak: `data.relId`+`data.zijde`           |
| `web/vite/src/ide/DetailsPanel.jsx`                           | edge-tab op anker-edges: read-only met deeplink           |

**Niet gewijzigd:**
- `umleditor/import/importMermaid.js`, `importPlantUML.js`, `rawuml.js`:
  schrijven naar `rel.bronKardinaliteit`/`doelKardinaliteit` direct (al
  conform).
- V3 JSON-formaat: ongewijzigd. `rel.bronKardinaliteit` etc. blijven de
  serialisatie-bron.

## 5. Tests

Toevoegen onder `web/vite/src/__tests__/`:

1. `asoc_edge_labels.test.js` — `edgeLabels(rel)` met
   directioneel/niet-directioneel, default-fallbacks, lege strings.
2. `asoc_migration.test.js` — `migrateAsocEdges()` op een legacy-store
   met `edge.data.kardinaliteit`: assert dat na migratie de waarden op
   `relNode.data` staan en `edge.data.kardinaliteit` weg is. Idempotent
   bij tweede aanroep.
3. Uitbreiden `v3_kennis_import.test.js`: assert dat na import
   `bronKardinaliteit`/`doelKardinaliteit` op de relatie-elements staan
   en niet op anker-edges.

## 6. Open punten

1. **`directioneel` op edge of node?** — Voorstel: behouden op
   `relNode.data.directioneel` (al zo); edge-renderer leest het ook van daar.
2. **Edge-handles bij Ververs ASOC** (zie `ASOC.md` "Bekende beperkingen") —
   buiten scope; aparte issue.
3. **Backwards compat** — vóór migratie geëxporteerde IDE-JSON-bestanden
   blijven werken zolang `migrateAsocEdges()` actief is. Na ≥1 publicatie-cyclus
   kan de migratie verwijderd worden (apart issue noteren).

## 7. Akkoordmoment

Dit document is een ontwerpvoorstel. Implementatie pas na expliciet akkoord
van de gebruiker.
