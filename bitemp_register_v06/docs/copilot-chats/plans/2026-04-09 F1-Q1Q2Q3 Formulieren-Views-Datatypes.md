# Plan: Custom Formulieren, Publicatie-views & Betekenisvolle Gegevenstypen

**Datum**: 2026-04-09  
**Backlog item**: F1 — Iteratie 2: custom formulierdefinities in JSON  
**Status**: Fase A geïmplementeerd

---

## Overzicht

Drie samenhangende uitbreidingen voor de v06 content editor:

1. **Q1 — Open source formulierlibraries**: Overzicht & aanbeveling voor custom formulierdefinities (JSON-gestuurd)
2. **Q2 — Custom data views voor publicatie**: Configureerbare tabel- en detailweergaven
3. **Q3 — Betekenisvolle gegevenstypen**: Uitbreiding V3Datatype met semantische typen + MIM-standaard

---

## Q1 — Overzicht Open Source Formulierlibraries

### Onderzochte libraries

| Library | Stars | Licentie | Aanpak | Past bij v06? |
|---------|-------|----------|--------|---------------|
| **JSON Forms** (@eclipsesource/jsonforms) | 2.7k | MIT | Dual-schema: data-schema + UI Schema | **BESTE FIT** conceptueel |
| **RJSF** (@rjsf/core) | 15.7k | Apache 2.0 | JSON Schema + uiSchema | Eerder afgewezen (Forms plan 01) |
| **form.io** (@formio/js) | 2.1k | MIT | Component-based JSON, drag-and-drop | Té zwaar, eigen component-model |
| **json-editor** | 4.9k | MIT | JSON Schema → HTML | Maintenance mode |
| **Formbricks** | 12k | AGPL | Survey platform | Niet geschikt |

### Beslissing

**Adopteer het UI Schema concept** van JSON Forms, maar bouw in de bestaande custom renderer-architectuur (react-hook-form + NL Design System / Utrecht). Bewust NIET de volledige JSON Forms library — te veel overhead.

Concreet:
- `FormulierDefinitie` JSON-schema geïnspireerd op JSON Forms UI Schema
- Opslaan in DB (nieuwe tabel) of JSON-bestand
- `<CustomFormulier>` React component rendert op basis van definitie + schema-API
- Hergebruik `SchemaFormField.jsx` als field renderer

---

## Q2 — Custom Views op Data (Publicatie)

### Concept

Configureerbare weergaven:
1. **Tabelweergave** — veldselectie, volgorde, sortering, breedte via ViewDefinitie JSON  
2. **Zoek/Filter** — server-side `GET /api/search/{type}?q=&velden=`
3. **Detail-pagina** — template met veldinserts via CEL-paden

### Data Grid

Blijf bij **@tanstack/react-table** (al in gebruik), uitbreiden met column visibility + server-side filtering.

---

## Q3 — Betekenisvolle Gegevenstypen

### Relevante standaarden

| Standaard | Scope | Relevant voor |
|-----------|-------|---------------|
| **MIM** (Geonovum) | NL overheidsstandaard | AN, AN{n}, CharacterString, N{n,m}, Date, Boolean |
| **ISO 11179** | Internationaal | Metadata registries, classificatie gegevenstypes |
| **OAS 3.1 Format Registry** | API | date, date-time, email, uri, uuid, int32, int64 |
| **Stelsel van Basisregistraties** | NL overheid | BSN, postcode, KvK-nummer |

### Geïmplementeerde presentatietypen (Fase A)

| Naam | Basistype | Format | Weergave |
|------|-----------|--------|----------|
| KorteTekst | string | — | maxLength: 255 |
| LangeTekst | string | — | widget: textarea, multiline: true |
| AN40 | string | — | maxLength: 40 |
| AN200 | string | — | maxLength: 200 |
| Geheel | integer | int32 | — |
| Decimaal | number | double | decimalen: 2 |
| Bedrag | number | double | widget: currency, prefix: €, decimalen: 2 |
| Percentage | number | double | suffix: %, decimalen: 1 |
| Datum | string | date | placeholder: JJJJ-MM-DD |
| DatumTijd | string | date-time | placeholder: JJJJ-MM-DDThh:mm |
| Jaar | integer | — | min/maxLength: 4 |
| JaNee | boolean | — | widget: checkbox |
| IBAN | string | iban | domein: financieel, inputMask |
| KvKNummer | string | kvk-nummer | domein: register, inputMask |

---

## Gewijzigde bestanden (Fase A)

### Backend (Go)

| Bestand | Wijziging |
|---------|-----------|
| `model/v3_format.go` | V3Weergave uitgebreid met Widget, Prefix, Suffix, Multiline, Decimalen |
| `model/presentatie_datatype_registry.go` | **NIEUW** — 14 presentatie-datatypes (MIM-gebaseerd) |
| `model/metaregistry_plumbing.go` | `initPresentatieDatatypeRegistry()` toegevoegd aan init-keten |
| `handlers/viz_schema_handler.go` | `MaakVizSchemaDatatypesHandler()` handler toegevoegd |
| `main.go` | Route `GET /api/viz/schema/datatypes` geregistreerd |

### Frontend (React)

| Bestand | Wijziging |
|---------|-----------|
| `context/SchemaContext.jsx` | Parallel fetch van datatypes endpoint; `datatypeByNaam` lookup |
| `components/editor/SchemaFormField.jsx` | Widget-rendering op basis van weergave-hints (textarea, prefix/suffix, decimalen, maxLength) |

### Nieuw API-endpoint

`GET /api/viz/schema/datatypes` → retourneert alle V3Datatypes uit DatatypeRegistry incl. weergave-hints.

Response voorbeeld:
```json
{
  "versie": "v1",
  "datatypes": [
    {
      "naam": "Bedrag",
      "description": "Geldbedrag in euro's, 2 decimalen.",
      "basistype": "number",
      "format": "double",
      "weergave": {
        "widget": "currency",
        "prefix": "€",
        "decimalen": 2
      }
    }
  ]
}
```

---

## Implementatiefasen

### Fase A: Betekenisvolle Gegevenstypen ✅ DONE

1. ✅ V3Weergave struct uitgebreid
2. ✅ Presentatietypen in DatatypeRegistry
3. ✅ API-endpoint `/api/viz/schema/datatypes`
4. ✅ SchemaFormField widget-rendering
5. ✅ Go build + test + Vite build geslaagd

### Fase B: Custom Formulierdefinities (toekomstig)

1. FormulierDefinitie JSON-schema (layout: groep, rij, veld, conditioneel)
2. Go struct + DB tabel of JSON-opslag
3. `<CustomFormulier>` React component
4. Conditionele zichtbaarheid
5. CRUD API voor FormulierDefinities

### Fase C: Custom Views voor Publicatie (toekomstig)

1. ViewDefinitie JSON-schema (kolommen, filters)
2. Server-side zoek-endpoint
3. TanStack Table uitbreiden met column visibility + filtering
4. Detail-pagina template renderer
