# Chat: Open source libraries for custom form definitions

- **Datum**: 2026-04-09 02:02
- **Sessie-ID**: `46d32eeb-fd34-4fd9-b806-b45d122a035b`
- **Berichten**: 10

---

## 🧑 User

in de backlog hebben we | F1 | Iteratie 2: custom formulierdefinities in JSON | Forms plan 02 |

1. Kun je een overzicht geven van wat er aan open source componenten / libraries zijn die custom formulierdefinities mogelijk maken?
- ik zou dit in de DB op willen slaan, net als de schema's. Ze moeten op een entiteit + onderliggende GE's en RELs werken, zoals nu de inhoud editor, maar dan is de layout vrij te bepalen.
- Er moet een formaat voor de te editen velden zijn (en enkel of meervoudige weergavestijlen).

2. Niet in de backlog (moet ergens nog een plaatsje krijgen):
- custom views op data ten behoeve van publicatie; dat is eigenlijk een kleine publicatie-site
  - een custom view tabel met gekozen velden (kiezen en volgorde veranderen; eventueel weergave format zelf bepalen)
  - zoeken en filteren binnen die velden (ook als de lijst lang is, dus niet alleen binnen de geladen rijen)
  - daarna door naar een detailpagina die ook customizable is: dat kan via html met veldinserts via logische paden in de beschikbare data. Een beetje zoals we de CEL expressies hebben opgebouwd: NatuurlijkPersoon.Bereikbaarheid.Locatie.Adres.straat (oid)

3. een voorwaarde om dit goed te kunnen doen is misschien nog om de gegevenstypen uit te breiden met meer betekenisvolle typen. BIjv. LangeTekst voor opmerkingen en KorteTekst voor namen e.d. AN40 (alfanumeriek max 40 tekens) heb ik ook wel gebruikt, maar is al wat dieper de techniek in. Zijn hier standaarden voor bedacht?

  Wil je dit documenteren in 1 de backlog 2 een uitgebreid plan?

---

## 🤖 Assistant

Let me first explore the existing plans and codebase to understand the current state, then research the open source landscape.  Now let me research the open source landscape for form builders and data publication/view components.  Now let me research data type standards and publication view patterns.  Let me read the current backlog context and the existing datatype registries to finalize the plan. Now I have all the context needed. Let me create the comprehensive plan. Here is the synthesized plan covering all three questions:

---

## Plan: Custom Formulieren, Publicatie-views & Betekenisvolle Gegevenstypen

Drie samenhangende uitbreidingen voor de v06 content editor, gebaseerd op uitgebreid onderzoek van de codebase én externe libraries/standaarden.

---

### Q1 — Overzicht Open Source Formulierlibraries

| Library | Stars | Licentie | Aanpak | Past bij v06? |
|---------|-------|----------|--------|---------------|
| **JSON Forms** (@eclipsesource/jsonforms) | 2.7k | MIT | Dual-schema: JSON Schema (data) + UI Schema (layout) | **BESTE FIT** — UI Schema = formulierdefinitie, los van data |
| **RJSF** (@rjsf/core) | 15.7k | Apache 2.0 | JSON Schema + uiSchema, 10+ theme packages | Populair, maar eerder afgewezen (Option A, Forms plan 01) |
| **form.io** (@formio/js) | 2.1k | MIT | Component-based JSON, drag-and-drop builder | Zwaarder; eigen component-model, minder flexibel met Utrecht |
| **json-editor** | 4.9k | MIT | JSON Schema → HTML form | Maintenance mode, vanilla JS, niet React-native |
| **Formbricks** | 12k | AGPL | Survey platform | Niet geschikt voor data-formulieren |

**Aanbeveling**: Adopteer het **UI Schema concept** van JSON Forms, maar bouw het in de bestaande custom renderer-architectuur (react-hook-form + Utrecht componenten). Definieer een eigen `FormDefinitie` JSON-schema met layout-elementen (`groep`, `rij`, `veld`, `conditioneel`), opgeslagen in DB of als JSON-bestand. De `<CustomFormulier>` component rendert dit met bestaande `SchemaFormField.jsx` als field renderer. Hiermee vermijden we de overhead van een volledige externe library terwijl we wél het bewezen dual-schema patroon overnemen.

---

### Q2 — Custom Views op Data (Publicatie)

Drie niveaus:

1. **Configureerbare tabelweergave** — `ViewDefinitie` JSON met kolommen (veldpad, label, breedte, sorteerbaar, filterbaar). Veldpaden via bestaand CEL-pad systeem (`NatuurlijkPersoon.Bereikbaarheid.Locatie.Adres.straat`). Bouwt voort op **@tanstack/react-table** dat al in  zit — uitbreiden met column visibility + server-side filtering.

2. **Server-side zoek/filter** — Nieuw endpoint `GET /api/search/{type}?q=zoekterm&velden=...`. Server-side ILIKE over gespecificeerde velden voor zoeken over de volledige dataset (niet alleen geladen rijen). Bouwt voort op bestaand `?q=` patroon (F17).

3. **Detail-pagina template** — Markdown-achtig template met veldinserts: `{{voornaam}} {{achternaam}} woont op {{adres.straat}}`. Read-only publicatieweergave.

**Data grid keuze**: Blijf bij TanStack Table (27.9k stars, MIT,  zit — uitbreiden met column visibility + server-side filtering.

2. **Server-side zoek/filter** — Nieuw endpoint `GET /api/search/{type}?q=zoekterm&velden=...`. Server-side ILIKE over gespecificeerde velden voor zoeken over de volledige dataset (niet alleen geladen rijen). Bouwt voort op bestaand `?q=` patroon (F17).

3. **Detail-pagina template** — Markdown-achtig template met veldinserts: `{{voornaam}} {{achternaam}} woont op {{adres.straat}}`. Read-only publicatieweergave.

**Data grid keuze**: Blijf bij TanStack Table (27.9k stars, MIT, headless, al in gebruik). AG Grid (15.2k stars) is feature-rijker maar een extra zware dependency.

---

### Q3 — Betekenisvolle Gegevenstypen + Standaarden

**Relevante standaarden:**

| Standaard | Relevant voor |
|-----------|---------------|
| **MIM** (Metamodel Informatiemodellering, Geonovum) | **Meest relevant** — NL overheidsstandaard. Definieert AN, AN{n}, N{n}, CharacterString, Date etc. |
| **ISO 11179** | Metadata registries, Data Element Concepts — classificatie van gegevenstypes |
| **OAS 3.1 Format Registry** | Standaard formats: date, date-time, email, uri, uuid, int32 etc. |
| **Stelsel van Basisregistraties** | BSN, postcode, KvK-nummer — domeinspecifieke NL types |

**MIM gegevenstypes** (leidende standaard voor dit project):
- **AN** / **AN{n}** — alfanumeriek (max n tekens) → KorteTekst, AN40, AN200
- **CharacterString** — onbeperkte tekst → LangeTekst
- **N{n}** / **N{n,m}** — numeriek → Geheel, Decimaal
- **Date**, **DateTime**, **Year**, **Boolean**, **Integer**, **Real**

**Voorgestelde presentatietypen:**

| Naam | Basistype | Widget | Voorbeeld |
|------|-----------|--------|-----------|
| KorteTekst | string | `<input type="text">` | maxLength 255 |
| LangeTekst | string | `<textarea>` | multiline |
| AN40 | string | `<input maxlength="40">` | — |
| Bedrag | number | currency-input | prefix "€", 2 decimalen |
| Percentage | number | number-input | suffix "%" |
| Datum | string | datepicker | format "date" |
| Jaar | integer | number-input | 4-cijferig |
| JaNee | boolean | checkbox | — |

**Implementatie**: Breid `V3Weergave` struct uit met `Widget`, `Prefix`, `Suffix`, `Multiline`, `Decimalen` velden. Frontend leest deze via schema-API/datatypes endpoint.

---

### Implementatiefasen

**Fase A: Gegevenstypen (Q3)** — *onafhankelijk, kan als eerste*
1. Breid `V3Weergave` struct uit in 
2. Voeg presentatietypen toe aan DatatypeRegistry
3. Nieuw endpoint `/api/viz/schema/datatypes`
4. Pas  aan voor widget-type

**Fase B: Custom Formulierdefinities (Q1)** — *bouwt op A*
1. `FormDefinitie` JSON-schema ontwerpen
2. Go struct + DB tabel of JSON-opslag
3. `<CustomFormulier>` component + conditionele zichtbaarheid
4. CRUD API voor FormDefinities

**Fase C: Custom Views (Q2)** — *parallel met B*
1. `ViewDefinitie` JSON-schema
2. Server-side zoek-endpoint
3. TanStack Table column visibility + filtering
4. Detail-pagina template renderer

### Verificatie
1. `go build .` en `go test .` slagen na wijzigingen
2. Schema-API retourneert nieuwe velden (widget, prefix, suffix)
3. Nieuw `/api/viz/schema/datatypes` endpoint retourneert volledige DatatypeRegistry
4. Frontend rendert textarea voor LangeTekst, currency-input voor Bedrag
5. `npm run build` slaagt

### Scope
- **IN**: Datatypes uitbreiding, FormDefinitie schema-ontwerp, ViewDefinitie concept, backlog updates, plan document
- **UIT**: Drag-and-drop form builder (F9, apart item), volledige JSON Forms library adoptie
- **Beslissing**: MIM als leidende standaard voor gegevenstypeclassificatie

---

Wil je dat ik iets aanpas of uitbreid, of kan ik dit verwerken in de backlog en het plandocument?

---

## 🧑 User

Start implementation

---

## 🤖 Assistant

Now let me read the schema handler and SchemaFormField to understand the current integration points: Now let me read the current state of the files I need to modify:   Now let me also check the route registration in main.go and see if there are any existing datatype-related routes:  Good, I have all the context. Let me also check if there's an `abuvwxy_datatype_registry.go` file to understand the full pattern: Now I have everything. Let me set up the todo list and start implementing Fase A. 
```

```
Now create the presentation datatypes file. These are domain-agnostic base types, so they belong in their own file and should be initialized early in the init chain. Now register the new init function in the init chain in `metaregistry_plumbing.go`: 
```

```
Now create the datatypes handler and register the route:  Now let me find the end of the file to add the new handler:   
```

```
Now register the route in main.go:  
```

```
Now update SchemaFormField.jsx to use the new datatype weergave hints. Let me first read the full current component and understand how datatypes are currently consumed: Now let me check how the content editor pages currently fetch and use schema data — particularly whether the  field from the schema is available in the form field: Let me read the SchemaContext to understand how schema data is loaded and what's exposed to components:  I need to update the SchemaContext to also fetch datatypes, then update SchemaFormField to use the weergave hints. Let me add datatypes fetching to SchemaContext first: 
```

```
Now add the `datatypeByNaam` lookup and expose it in the context value:  
```

```
Now update the value and its Now update the value and its dependencies to include : 
```

```
Now update SchemaFormField.jsx to consume the datatypeByNaam lookup and render appropriate widgets based on the weergave hints:   Now I'll rewrite SchemaFormField to integrate datatype weergave hints. The key changes:
1. Import and use  to get 
2. Look up the datatype's weergave when  is set
3. Render `<textarea>` for multiline/textarea widget
4. Add prefix/suffix wrapping for currency/percentage
5. Use `decimalen` for step on number inputs 
```

```
Build succeeded. Now run the tests:   All tests pass. Now the Vite build:   Build succeeded. Now create the plan document:   Now let me find where the Frontend Content Editor section is to add new items:  Now I'll add the new items for Q2 (custom views) and Q3 (betekenisvolle datatypes) and mark Q3 as done:   
```

```
Fase A is complete. Here's a summary of all changes:

### Backend (Go)

- model/v3_format.go — Extended `V3Weergave` struct with `Widget`, `Prefix`, `Suffix`, `Multiline`, `Decimalen` fields
- model/presentatie_datatype_registry.go — **New file** with 14 MIM-based presentation datatypes (KorteTekst, LangeTekst, AN40, AN200, Geheel, Decimaal, Bedrag, Percentage, Datum, DatumTijd, Jaar, JaNee, IBAN, KvKNummer)
- model/metaregistry_plumbing.go — Added  call at the start of the init chain
- handlers/viz_schema_handler.go — Added  handler
-  — Registered  route

### Frontend (React)

- context/SchemaContext.jsx — Parallel fetch of datatypes endpoint; added  lookup to context
- components/editor/SchemaFormField.jsx — Widget rendering based on datatype weergave hints:  for multiline, prefix/suffix wrapping for currency/percentage,  from validation,  from decimalen

### Documentation

- docs/copilot-chats/plans/2026-04-09 F1-Q1Q2Q3 Formulieren-Views-Datatypes.md — Full plan document
- docs/BACKLOG.md — Added F19-F24 (3 completed, 3 new for Fase B/C)

All Go tests pass and Vite build succeeds. Fase B (Custom Formulierdefinities) and Fase C (Custom Views) are documented in the backlog for future implementation.

---

## 🧑 User

Moet ik / kan ik al iets testen of kun je door met fase B? Wel 1 opmerking daarbij:
> CRUD API voor FormDefinities
Aangezien we een mooi genereerbare bitemporeel register hebben, zou ik formulierdefinities (en later de schemadefinities ook refactoren) gewoon ook als bitemporele ENT met GE willen implementeren. Zodat wijzigingen meteen een periode hebben en traceerbaar / corrigeerbaar zijn etc. Daarna kunnen ook rechten worden toegewezen aan mensen, en die mensen (medewerkers, klanten) staan dan eveneens in een bitemporele tabellenstructuur.

Wat zou je zelf in formulierdefinitie willen opslaan? Dan kunnen we daar een ENT voor maken en de tabellen en API genereren. Schrijven gaat dan wel via registratie en lezen via de standaard GET endpoints (maar doorgaans steeds de FULL API's). Is het 1 platte tabel, of is er nog gestructureerde informatie?

Nu zit alles nog in 1 groot register, maar dat kan worden losgeweekt en in een apart register leven.

---

## 🤖 Assistant

**Testen Fase A**: De infrastructuur staat, maar er zijn nog geen velden in het model die de nieuwe presentatie-datatypes *gebruiken* (NLPostcode/BSN hadden al hun eigen weergave). Je kunt  testen om te zien of alle 14+ types terugkomen. Het visuele effect in de editor komt zodra velden een  of `"Bedrag"` krijgen — dat kan na of parallel aan Fase B.

---

**Fase B — FormDefinitie als bitemporele ENT**: helemaal mee eens, dat is architecturaal het schoonste. Mijn voorstel:

### Datamodel

**ENT: FormDefinitie** — met Aanvang/Einde (materiële tijd) + opvoer/afvoer via registratie

**GE: FormDefinitie_Meta** (enkelvoudig) — wijzigt bij naamswijziging of statusovergang:

| Veld | Type | Toelichting |
|------|------|-------------|
|  | string | "Standaard persoonsformulier" |
| `beschrijving` | string | Toelichting |
| `doeltype` | string | Typenaam van de doelentiteit, bijv. `"NatuurlijkPersoon"` |
|  | enum | `concept` / `actief` / `inactief` |
| `is_standaard` | bool | Standaardformulier voor dit doeltype |

**GE: FormDefinitie_Layout** (enkelvoudig) — wijzigt bij herschikking van het formulier:

| Veld | Type | Toelichting |
|------|------|-------------|
| `layout` | text (JSON) | De volledige layout-boom |

De split Meta/Layout zorgt ervoor dat een status-wijziging (`concept` → `actief`) een aparte wijziging is van een layout-herschikking. Beide zijn bitemporeel traceerbaar.

### Layout JSON-structuur

```json
{
  "type": "formulier",
  "elementen": [
    {
      "type": "groep",
      "label": "Persoonsgegevens",
      "elementen": [
        { "type": "veld", "veld": "voornaam" },
        { "type": "veld", "veld": "achternaam" },
        {
          "type": "rij",
          "elementen": [
            { "type": "veld", "veld": "geboortedatum", "breedte": "50%" },
            { "type": "veld", "veld": "geslacht", "breedte": "50%" }
          ]
        }
      ]
    },
    {
      "type": "conditioneel",
      "als": "geslacht == 'V'",
      "dan": [
        { "type": "veld", "veld": "meisjesnaam" }
      ]
    }
  ]
}
```

Element-types: `formulier` (root),  (section met label), `rij` (horizontal layout),  (verwijst naar schema-veldnaam), `conditioneel` (tonen/verbergen).

### Domein

Ik zou dit in een apart domein `"configuratie"` plaatsen — los van de inhoudelijke domeinen. Later kan dat een apart register worden.

### Wat dit oplevert

- CRUD via bestaande registratie-flow (geen nieuwe handler-logica)
- Tijdreizen op formulierdefinities (wie wijzigde de layout wanneer?)
- Correcties/terugdraaien via standaard afvoer-mechanisme
-  retourneert alles genest
- Frontend laadt de layout-JSON en rendert via `<CustomFormulier>`

Ga je akkoord met dit model? Dan genereer ik de ENT + GE structs, MetaRegistry entries, tabellen en we laten de bestaande codegen + route-registratie het werk doen.

---

## 🧑 User

ja, mee eens, wil je dit doen en (laten) bouwen?

---

## 🤖 Assistant

Let me first understand the codegen workflow and existing patterns to implement this correctly. Good findings. Let me check the exact v3 model structure for GEs and how codegen handles them: Now let me look at a complete example from the existing metamodel to understand how a whole entity is structured: Good. Now let me also quickly check how the codegen is run for an existing domain so I know the exact CLI flags: Now I have a full understanding. Let me create the v3 model JSON for the configuratie domain and run the codegen.  Codegen succeeded and auto-registered the init calls. Let me verify the generated files:  The codegen generated everything correctly. Let me verify the init chain was updated: Now build and test: All tests pass. Now let me build the frontend `<CustomFormulier>` component. First, let me understand the existing form component structure:  The FormDefinitie entity is now fully functional via the MetaRegistry — it'll auto-appear in the content editor with routes and handlers. Now let me build the `<CustomFormulierRenderer>` that renders a layout JSON into an actual form: Good. Now let me create the CustomFormulierRenderer component:  Now create a hook that fetches the active FormDefinitie for a given doeltype:  Now let me read the relevant parts of EntiteitFormulier to find the integration point: Let me read the key integration area in EntiteitFormulier:   Now let me read the CustomFormulierRenderer that was already created: Now let me check the existing SchemaContext to understand what's available (specifically  and lookups):  Let me check the current hooks directory structure: Good, the hook is there. Now let me integrate the custom form into EntiteitFormulier. I'll add a practical integration: when an active FormDefinitie layout exists for the current entity type, show a tab/toggle between the custom layout view and the default per-GE view. 
```

```
Now add the hook call and state for the custom layout mode. Let me read the state declarations area: 
```

```
Now I need to add the data flattening logic and the custom layout section. Let me find the right place — right after the  filter and before the return JSX:  Now I'll add the data flattening logic for the custom form layout right after the  filter. This collects all GE _Data field definitions and values into flat maps:   
```

```
Now add the toggle button and custom form render section in the JSX. Let me find the right place — after the header and before the per-GE sections:   Now I'll add the custom formulier toggle button and the custom layout section. I'll insert it right after the GE scroll-buttons section and before the per-GE rendering loop:   
```

```
Good. Now let me verify Vite can build this: Fix the import path in the hook — `hooks/` is directly under `src/`, same level as :   
```

```
Vite build succeeds. Now let me also run the Go tests to verify the backend is still solid:    All tests pass, Vite builds clean. Now let me update the docs. First, let me read the current BACKLOG.md:     Now I have a good understanding of the BACKLOG. Let me read the rest and then update it with the Fase B items: I have enough context. Now let me read the  to find the exact lines to update (F1, F2, F19-F24):   Now let me find the specific F1 and F19-F24 lines in BACKLOG.md:   Now update the BACKLOG with the Fase B implementation status:     
```

```
Now add the new F25-F30 items for what was built:      
```

```
Now create the detailed plan document for this fase:       Fase B is afgerond. Hier is wat er is gebouwd:

**Backend** (vorige sessie):
- `FormDefinitie` als bitemporale entiteit in het `configuratie`-domein via codegen
- 7 gegenereerde Go-bestanden: entiteit, GE's (Meta + Layout), enum (`concept/actief/inactief`), MetaRegistry entries
- Routes en handlers automatisch geregistreerd via het MetaRegistry-mechanisme

**Frontend** (deze sessie):
-  — rendert layout JSON (groep/rij/veld/conditioneel) recursief met 
-  — hook die de actieve FormDefinitie ophaalt voor een doeltype
-  — toggle "Custom formulier / Standaard weergave" bij actieve FormDefinitie; flatten GE-data naar een cross-GE read-only layout

**Docs**:
-  — F1/F2 op ✅, F25–F30 toegevoegd
-  — volledig plandocument

**Vervolgstappen** (F29, F30): editable cross-GE save in custom modus, en een visuele drag-and-drop layout-editor.

---

## 🧑 User

Dank. Wat ik over het hoofd gezien heb is het woord FormDefinitie: dat is een mix van Engels en NL. WIl je dat nog refactoren naar "FormulierDefinitie"?

Wil je daarna door naar de vervolgstappen?

---

## 🤖 Assistant

Now remove the old init calls from plumbing and update the model JSON:  
```

```
Now update the model JSON — rename all `FormDefinitie` to `FormulierDefinitie`: Good. Now run codegen:  Codegen succeeded and auto-added the new init calls. Let me verify:    Backend is clean. Now update the frontend files: The hook file needs renaming (both filename and contents). Let me also check the EntiteitFormulier imports:      Now I'll rename the hook file and update all frontend references. First, create the new file by renaming:      Now update the hook file contents — all `FormDefinitie` → `FormulierDefinitie` and `form_definitie` → `formulier_definitie`:   
```

```
Now update EntiteitFormulier.jsx:    
```

```
Now update the CustomFormulierRenderer comment:      
```

```
Now verify the Vite build:      Now update the docs —  and the plan doc:       Now update BACKLOG.md:       
```

```
Also update the earlier plan doc reference if it mentions FormDefinitie:  
```

```
Let me do a final sweep to make sure there are no remaining `FormDefinitie` references (without `Formulier` prefix) in active code:       Zero remaining references. Rename is complete.     Rename is volledig doorgevoerd — `FormDefinitie` → `FormulierDefinitie` overal:

- **Go backend**: codegen opnieuw gedraaid, 7 bestanden gegenereerd met nieuwe naam, build + tests OK
- **Frontend**: hook hernoemd naar , API-paden naar `/formulier_definities`, imports en destructuring in EntiteitFormulier bijgewerkt, Vite build OK
- **Docs**: BACKLOG.md, beide plan-documenten, alles bijgewerkt
- **Nul** resterende oude referenties (`(?<!Formulier)FormDefinitie` = 0 hits)

---

Nu de vervolgstappen. Laat me de twee openstaande items bekijken:

- **F29**: Custom formulier editable modus met cross-GE save (nu read-only)
- **F30**: Visuele FormulierDefinitie layout-editor (drag-and-drop) Laat me eerst de huidige architectuur analyseren om de cross-GE save uit te werken. Het kernprobleem: het custom formulier toont velden uit **meerdere GE's** tegelijk, maar de registratie-API verwacht per GE een aparte opvoer/afvoer.     

---
