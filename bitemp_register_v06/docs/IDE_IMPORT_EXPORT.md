# IDE Import/Export & Domein-tracking

> **Aangemaakt**: 2026-07-14
> **Scope**: IDE import/export dialogen, domein-bewuste PB-boom, domein-tracking in registraties

---

## 1. Overzicht

De IDE ondersteunt nu een volledige import/export workflow met domein-bewustzijn:

| Feature | Bestanden | Status |
|---------|-----------|--------|
| Diagrammen onder domeinen in PB-boom | `ProjectBrowser.jsx` | ✅ |
| Import-dialoog (bestand/API + domeinfilter) | `ImportDialog.jsx`, `IdePage.jsx`, `adapters.js` | ✅ |
| Rechtsklik import/export op domein | `BrowserContextMenu.jsx`, `ProjectBrowser.jsx` | ✅ |
| Export naar database (IdeBestand) | `ExportDialog.jsx`, `IdePage.jsx` | ✅ |
| Domein-tracking in registraties (backend) | `model_plumbing.go`, `registration_handlers.go`, `createtables.go` | ✅ |
| Backfill bestaande registraties | `cmd/backfill_registratie_domeinen/` | ✅ |
| API domein-filter op registraties | `full_handlers.go` | ✅ |
| GraphQL domeinen veld | `dynql/type_builder.go` | ✅ |
| Frontend domein-badges + filter | `RegistratieReplayPage.jsx` | ✅ |

---

## 2. Diagrammen in de Project Browser

### Gedrag

- Diagrammen met een `domein` property verschijnen als **📐 Diagrammen** subfolder onder de bijbehorende domeinmap.
- Diagrammen **zonder** domein verschijnen in de root 📐 Diagrammen map.
- Nieuw diagram aanmaken via rechtsklik op een domeinmap → het diagram krijgt automatisch dat domein.

### Implementatie

In `ProjectBrowser.jsx` → `buildTree()`:

```javascript
// Per domein: domein-specifieke diagrammen als child
const domeinDiagrammen = Object.values(diagrams).filter(d => d.domein === domein);
if (domeinDiagrammen.length > 0) {
  domeinNode.children.push({
    id: `diagrams_${domein}`,
    name: "Diagrammen",
    nodeType: "diagrams",
    children: domeinDiagrammen.map(d => ({
      id: `diagram_${d.id}`, name: d.naam || d.id,
      nodeType: "diagram", diagramId: d.id,
    })),
  });
}

// Root: alleen diagrammen zonder domein
const overallDiagrammen = Object.values(diagrams).filter(d => !d.domein);
```

---

## 3. Import-dialoog

### Bestand: `web/vite/src/ide/ImportDialog.jsx`

Een modal dialoog (~300 regels) met de volgende opties:

| Optie | Beschrijving |
|-------|-------------|
| **Bron** | 📂 Uit bestand / 🌐 Vanuit API |
| **API sub-opties** | Uit code (MetaRegistry), Nieuwste DB versie, Specifieke versie (met versietabel) |
| **Domeinfilter** | Dropdown: alle domeinen of specifiek domein |
| **Import-modus** | Vervang alles / Merge domein (alleen bij domeinfilter actief) |

### Import flow

1. Gebruiker selecteert bron + domein + modus
2. Bij bestand: file wordt gelezen en geparsed (IDE of V3 formaat)
3. Bij API: fetch naar het juiste endpoint:
   - `GET /api/schema/model/code` (code/MetaRegistry)
   - `GET /api/schema/model` (nieuwste DB)
   - `GET /api/schema/model/{id}` (specifieke versie)
4. Callback `onImport(json, { format, domein, modus, versieLabel, bronLabel })` wordt aangeroepen
5. `IdePage.jsx` → `handleImportResult()`:
   - **Merge**: vervangt alleen elementen van het geselecteerde domein (via `mergeStoreDomein()`)
   - **Vervang**: laadt volledig model (via `loadModel()`)
   - **Auto-diagram**: maakt automatisch een diagram aan met posities uit het V3-model

### Domein helpers in `adapters.js`

```javascript
// Filter store data op domein
export function filterStoreByDomein(storeData, domein) { ... }

// Merge: verwijder oud domein, voeg nieuw domein toe
export function mergeStoreDomein(bestaandState, nieuwStoreData, domein) { ... }
```

---

## 4. Rechtsklik import/export op domein

- **Rechtsklik op domeinmap** → "📂 Importeer domein…" / "💾 Exporteer domein…"
- Import: opent `ImportDialog` met domein pre-ingevuld
- Export: opent `ExportDialog` met domein pre-geselecteerd

Geïmplementeerd in:
- `BrowserContextMenu.jsx` → MENU_ITEMS: `importeerDomein`, `exporteerDomein`
- `ProjectBrowser.jsx` → `handleContextAction`: `case "importeerDomein"` / `case "exporteerDomein"`
- `IdePage.jsx` → callbacks `handleImportDomein(domein)`, `handleExportDomein(domein)`

---

## 5. Export naar database

### ExportDialog uitbreiding

- **Bestemming** radio: "📁 Lokaal bestand" / "🗄 Database (IdeBestand)"
- Extra velden bij database: `beschrijving` en `tags`
- Callback signature: `onExport(format, filename, domein, bestemming, { beschrijving, tags })`

### Database upload flow (IdePage.jsx)

```javascript
if (bestemming === "database") {
  const formData = new FormData();
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
  formData.append("file", blob, filename);
  formData.append("naam", filename);
  formData.append("categorie", format === "ide" ? "ide_snapshot" : "model_snapshot");
  // ...
  await fetch(`${apiBase()}/api/bestanden/upload`, { method: "POST", body: formData });
}
```

---

## 6. Domein-tracking in registraties

### 6a. Backend — Registratie struct

```go
// model/model_plumbing.go — Registratie struct
Domeinen []string `json:"domeinen,omitempty" bun:"domeinen,array,type:text[]"`
```

### 6b. Domein-derivatie in handler

In `handlers/registration_handlers.go` → `RegistreerMetNieuweAanpak()`:

```go
// Na de wijzigingen-loop: afleiden van domeinen uit MetaRegistry
domeinSet := make(map[string]struct{})
for _, w := range request.Wijzigingen {
    repNaam := ""
    if w.Opvoer != nil { repNaam = w.Opvoer.Representatienaam }
    else if w.Afvoer != nil { repNaam = w.Afvoer.Representatienaam }
    if meta, ok := model.MetaRegistry.GetTypeMeta(repNaam); ok && meta.Domein != "" {
        domeinSet[meta.Domein] = struct{}{}
    }
}
// Gesorteerd opslaan
sort.Strings(domeinen)
request.Registratie.Domeinen = domeinen
```

### 6c. Database index

```sql
CREATE INDEX IF NOT EXISTS idx_registratie_domeinen ON registratie USING GIN(domeinen)
```

Compatibiliteit bestaande DB's:
- Bij startup wordt `registratie.domeinen` eerst genormaliseerd naar `TEXT[]`.
- Als de kolom nog `varchar`/`text` was, wordt die veilig geconverteerd (lege waarde → `NULL`, comma-separated waarden → array).
- Pas daarna wordt de GIN-index aangemaakt.

### 6d. API filter

```
GET /full/registraties?domein=np_loc
```

Implementatie: `WHERE domeinen @> ARRAY[?]::text[]` (PostgreSQL array containment).

### 6e. GraphQL

```graphql
type Registratie {
  # ... bestaande velden ...
  domeinen: [String]  # Afgeleide domeinen: unieke set van TypeMeta.Domein per wijziging
}
```

### 6f. Backfill script

```sh
go run ./cmd/backfill_registratie_domeinen
```

Vult `domeinen` in voor bestaande registraties waar het veld `NULL` is, door per registratie de wijzigingen te bekijken en domeinen af te leiden via MetaRegistry.

---

## 7. Frontend domein-badges

### RegistratieReplayPage.jsx

- **Domein-filter dropdown**: bovenaan de pagina in de controls-balk. Selecteer een domein om te filteren; reset naar "Alle domeinen" om alles te zien.
- **Domein-badges**: per registratie worden de domeinen getoond als gekleurde "pill" badges.
- **Klikbare badges**: klik op een badge om direct te filteren op dat domein.
- **Kleurberekening**: hash-gebaseerd (stabiele kleur per domeinnaam) uit een palet van 10 kleuren.

### Beschikbare domeinen

De dropdown wordt gevuld uit twee bronnen:
1. **Schema API** (`/api/viz/schema`): alle domeinen uit de MetaRegistry types
2. **Registratie data**: domeinen uit de geladen registraties (progressief)

---

## 8. Bestandsoverzicht

### Nieuw

| Bestand | Doel |
|---------|------|
| `web/vite/src/ide/ImportDialog.jsx` | Import modal dialoog |
| `cmd/backfill_registratie_domeinen/main.go` | Backfill script domeinen |
| `docs/IDE_IMPORT_EXPORT.md` | Dit document |

### Gewijzigd

| Bestand | Wijziging |
|---------|-----------|
| `web/vite/src/ide/ProjectBrowser.jsx` | buildTree + handleContextAction + props |
| `web/vite/src/ide/BrowserContextMenu.jsx` | MENU_ITEMS uitgebreid |
| `web/vite/src/ide/ExportDialog.jsx` | Bestemming radio + extra velden |
| `web/vite/src/pages/IdePage.jsx` | ImportDialog wiring, export DB, domein callbacks |
| `web/vite/src/store/adapters.js` | filterStoreByDomein, mergeStoreDomein |
| `web/vite/src/pages/RegistratieReplayPage.jsx` | Domein-badges, filter, kleuren |
| `model/model_plumbing.go` | Domeinen veld op Registratie |
| `handlers/registration_handlers.go` | Domein-derivatie logica |
| `handlers/full_handlers.go` | ?domein= query parameter |
| `dbsetup/createtables.go` | GIN index op domeinen |
| `dynql/type_builder.go` | domeinen veld op RegistratieType |

---

## 9. V3 model-uitbreidingen die de import/export raken (A4-rev, B5, C8)

De volgende uitbreidingen zijn toegevoegd aan het V3-formaat en worden verwerkt door de
`storeNaarV3Model()` en `v3ModelNaarStore()` adapters:

### Benoemde diagrammen (A4-rev)

Bij V3-export (`storeNaarV3Model`) worden alle benoemde diagrammen — inclusief node-posities
en edge-routes — geserialiseerd naar `v3Model.diagrammen[]`.
Het **Overzicht**-diagram wordt expliciet overgeslagen: dat is altijd afgeleid uit de
entiteit-posities en wordt niet als benoemd diagram opgeslagen.

Bij V3-import (`v3ModelNaarStore`) worden de `diagrammen` teruggezet als diagram-entries
in de store, inclusief hun nodes en edges.

> Het IDE-formaat (`_format: "ide-v1"`) bevat eveneens diagram-data, maar als uitgebreider
> snapshot (inclusief viewport en extra UI-state). Bij import van IDE-formaat worden
> diagrammen meegenomen via de IDE-snapshot; bij import van zuiver V3-formaat via
> `v3Model.diagrammen`.

### Verplaatsbare edge-labels (B5)

Elke edge in `v3Model.diagrammen[].edges[]` kan nu een optioneel `labelOffsets`-veld
bevatten met de verschuiving van `naamLabelHeen` en/of `naamLabelTerug` ten opzichte
van de standaard-positie:

```json
{
  "id": "e_A_A_U",
  "source": "A",
  "target": "A_U",
  "labelOffsets": {
    "heen":  { "x": 12, "y": -6 },
    "terug": { "x": -20, "y": 4 }
  }
}
```

Offsets worden alleen opgenomen als ze afwijken van nul. Bij import worden ze hersteld in
`e.data.labelOffsets` per diagramedge.

### Canvas-annotaties: notities & constraints (C8)

`storeNaarV3Model` exporteert notities en constraints naar respectievelijk
`v3Model.notities[]` en `v3Model.constraints[]`.

**Scope-edges** van constraints (structurele edges met `data.kind === "scope"`) worden
bij export omgezet naar `V3Constraint.scopeRefs` (array van element-typenamen).
Bij import (`v3ModelNaarStore`) worden ze teruggereconstrueerd als structurele edges.

Zie [roundtrip-engineering.md](roundtrip-engineering.md#83-annotaties-op-het-canvas--v3notitie-en-v3constraint-c8)
voor de volledige typedefinities.
