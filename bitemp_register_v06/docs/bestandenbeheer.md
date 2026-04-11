# Bestandenbeheer (IDE Bestanden)

## Overzicht

Het IDE bestandenbeheer-systeem biedt:
- **Bitemporele opslag** van bestanden (metadata + inhoud) als `IdeBestand`-entiteiten
- **Hybride opslag**: kleine tekstbestanden inline in PostgreSQL, grote/binaire bestanden in MinIO
- **Auto-snapshots**: bij publicatie en rebuild wordt het model automatisch als snapshot opgeslagen
- **Preview**: syntax-highlighted weergave van JSON, YAML, XML, Go, SQL en Markdown bestanden
- **Upload/download**: via de IDE toolbar met drag-and-drop support

## Architectuur

### Domeinmodel: `IdeBestand`

Het domein `ide-bestanden` is gegenereerd via het codegen V3-pipeline (`ide_bestanden_model.json`).

| Representatie | Tabel | Beschrijving |
|---|---|---|
| `IdeBestand` | `idebestand` | Entiteit (materieel) |
| `IdeBestand_Meta` | `idebestand_meta` | Hub: metadata |
| `IdeBestand_Meta_Data` | `idebestand_meta_data` | Geversioned: naam, categorie, formaat, etc. |
| `IdeBestand_Inhoud` | `idebestand_inhoud` | Hub: inhoud |
| `IdeBestand_Inhoud_Data` | `idebestand_inhoud_data` | Geversioned: opslag_type, inline_inhoud/object_key, hash, grootte |
| `IdeBestand_Aanvang` | `idebestand_aanvang` | Materieel: aanvangdatum |
| `IdeBestand_Einde` | `idebestand_einde` | Materieel: einddatum |

### Enums

| Enum | Waarden |
|------|---------|
| `IdeBestandCategorie` | `model_snapshot`, `ide_snapshot`, `gegenereerde_code`, `import`, `export`, `documentatie`, `configuratie`, `overig` |
| `IdeBestandFormaat` | `json`, `yaml`, `xml`, `markdown`, `go_code`, `sql`, `tekst`, `binair`, `overig` |
| `IdeBestandOpslagType` | `inline`, `minio` |

### Opslagstrategie

| Conditie | Opslag | Veld |
|---|---|---|
| Tekstbestand ≤ 1 MB | Inline (PostgreSQL) | `inline_inhoud` |
| Binair of > 1 MB | MinIO object store | `object_key` |

## API Endpoints

### Bestanden-specifieke routes (custom)

| Methode | Pad | Beschrijving |
|---|---|---|
| `POST` | `/api/bestanden/upload` | Multipart upload (file + metadata) |
| `GET` | `/api/bestanden/:id/download` | Download als bestand |
| `GET` | `/api/bestanden/:id/preview` | JSON preview (max 2 MB, met syntax info) |

### Standaard MetaRegistry routes (automatisch)

De CRUD-routes voor IdeBestand entiteiten worden automatisch gegenereerd via de MetaRegistry:
- `GET /ide_bestanden` — lijst
- `GET /ide_bestanden/:id` — enkel record
- `GET /full/ide_bestanden` — entiteiten met geneste GE's
- etc.

## MinIO configuratie

MinIO draait als Docker service (zie `docker-compose.yml` en `docker-compose.devloop.yml`).

| Omgevingsvariabele | Default | Beschrijving |
|---|---|---|
| `MINIO_ENDPOINT` | `minio:9000` | MinIO server adres |
| `MINIO_ACCESS_KEY` | `minioadmin` | Access key |
| `MINIO_SECRET_KEY` | `minioadmin` | Secret key |
| `MINIO_BUCKET` | `ide-bestanden` | Bucket naam |
| `MINIO_USE_SSL` | `false` | SSL aan/uit |

MinIO is optioneel: als de verbinding mislukt, werkt de API verder met alleen inline opslag. De `filestore.Beschikbaar` boolean geeft aan of MinIO bereikbaar is.

### MinIO Admin UI

Beschikbaar op `http://localhost:9001` (in Docker compose).

## Auto-snapshots

Bij de volgende acties wordt automatisch een `IdeBestand` snapshot aangemaakt:

1. **Schema model publicatie** (`POST /api/schema/model`): slaat het gepubliceerde V3 model op als JSON snapshot met categorie `model_snapshot`
2. **Rebuild** (`POST /admin/rebuild/:password`): slaat het rebuild-model op als JSON snapshot met categorie `model_snapshot`

Snapshots draaien asynchroon (goroutine) zodat ze de hoofdrespons niet vertragen. Bij fouten wordt een WARN-melding naar stdout geschreven.

## Frontend componenten

### CodeEditor (uitgebreid)

`web/vite/src/components/editor/CodeEditor.jsx` ondersteunt nu:
- JSON, Markdown (bestaand)
- YAML, XML, Go, SQL (nieuw via PrismJS)
- Tekst (zonder highlighting)

### BestandViewer

`web/vite/src/components/editor/BestandViewer.jsx` — dispatcht op formaat:
- Markdown → `MarkdownWeergave` (HTML-preview)
- Overige → `CodeEditor` (readonly, syntax highlighted)

### BestandenPanel

`web/vite/src/ide/BestandenPanel.jsx` — IDE-panel met:
- Bestandenlijst gegroepeerd per categorie (links)
- Preview van geselecteerd bestand (rechts)
- Download-knop per bestand
- Herlaad-knop

### UploadDialog

`web/vite/src/ide/UploadDialog.jsx` — modal:
- Drag-and-drop of file select
- Metadata velden: naam, categorie, beschrijving, domein, tags, versie label
- Stuurt multipart POST naar `/api/bestanden/upload`

### IDE integratie

In `IdePage.jsx`:
- Toolbar: "🗄 Bestanden" knop opent het BestandenPanel als FlexLayout tab
- Toolbar: "⬆ Upload" knop opent het UploadDialog
- Factory: `COMP_BESTANDEN` → `BestandenPanel`

## Bestanden

### Backend (Go)

| Bestand | Beschrijving |
|---|---|
| `ide_bestanden_model.json` | V3 domeinmodel |
| `model/ide_bestanden_*.go` | 7 gegenereerde bestanden (structs, metaregistry, enums, etc.) |
| `filestore/minio_client.go` | MinIO client wrapper (Upload, Download, Verwijder, Bestaat, BerekenSHA256) |
| `handlers/bestanden_handlers.go` | Upload/download/preview handlers + RegistreerBestandSnapshot |
| `routes/addroutes.go` | Bestanden routes registratie |
| `handlers/schema_model_handler.go` | Auto-snapshot hook bij publicatie |
| `handlers/rebuild_handler.go` | Auto-snapshot hook bij rebuild |

### Frontend (React)

| Bestand | Beschrijving |
|---|---|
| `src/components/editor/CodeEditor.jsx` | Uitgebreid met YAML, XML, Go, SQL |
| `src/components/editor/BestandViewer.jsx` | Nieuw: formaat-gebaseerde viewer |
| `src/ide/BestandenPanel.jsx` | Nieuw: bestanden browser |
| `src/ide/UploadDialog.jsx` | Nieuw: upload dialog |
| `src/ide/layoutConfig.js` | COMP_BESTANDEN + openBestandenTab() |
| `src/pages/IdePage.jsx` | Toolbar knoppen + factory integratie |
