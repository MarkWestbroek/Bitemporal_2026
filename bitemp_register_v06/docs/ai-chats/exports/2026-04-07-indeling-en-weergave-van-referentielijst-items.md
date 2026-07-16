# Chat: Indeling en weergave van referentielijst-items

- **Datum**: 2026-04-07 22:56
- **Sessie-ID**: `cf01fe3c-dcb0-4cbb-9b30-17daff07e89a`
- **Berichten**: 21

---

## 🧑 User

zou je aan de inhoud pagina twee dingen kunnen doen?
1. de ENT-en indelen op domein
2. ook een view op de referentielijst-items in elk domein kunnen toevoegen?

---

## 🤖 Assistant


```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```
De inhoudspagina is nu per domein gegroepeerd, en de referentielijst-items zijn als aparte views toegevoegd.## ✅ Aangepast op de inhoudspagina

Ik heb dit doorgevoerd in :

1. **ENT-en nu ingedeeld per domein**
   - de navigatie links is nu gegroepeerd op 
   - per domein zie je een aparte sectie met **ENT-en**

2. **Referentielijst-items per domein toegevoegd**
   - per domein is nu ook een sectie **Referentielijst-items**
   - die zijn klikbaar en openen gewoon hun eigen tabel/view in de inhoud-editor

### Extra
- de startpagina van de inhoud-editor toont nu ook een **overzichtskaart per domein**
- op de detailpagina staat nu ook een badge met het **domein** en, waar relevant, **Referentielijst-item**

### Gewijzigde bestanden
- `web/vite/src/context/SchemaContext.jsx`
- `web/vite/src/components/editor/EditorNavigatie.jsx`
- `web/vite/src/editor/main.jsx`
- `web/vite/src/pages/InhoudEditorPage.jsx`
- `docs/inhoud-editor-handleiding.md`

---

## 🔎 Verificatie

De frontend-build is net succesvol gecontroleerd:

- task: `vite: build (v06)`
- resultaat: **geslaagd**
- bewijs: `✓ 466 modules transformed` en `✓ built in 1.81s`

> Je kunt nu  even verversen om het direct te zien.

---

## 🧑 User

In de inhoud.html hebben we nu een lijst gemeenten (reflijstitem subtype) van 342 stuks. Dat werkt niet meer met een dropdownlist (want deze haalt alleen de eerste 100 ofzo op).

Hoe zouden we dat interfacetechnisch het beste oplossen? Als de lijst langer is dynamisch een ander component kiezen of het type component configureren ergens in de metadata van het veld?

---

## 🤖 Assistant

Goede vraag. Laat me eerst even kijken hoe het huidige ref-veld gerenderd wordt en waar de limiet zit. Goed punt. Hier is de analyse en aanbeveling:

## Huidige situatie

1. **-velden** (zoals ) worden wél door de schema-API geëxporteerd als , maar ** doet er nog niets mee** — het  property wordt niet gelezen
2. **Enum-velden** renderen als  (HTML dropdown) — dit werkt voor korte lijsten
3. **API paginering**:  in  — dus ook als je  stuurt, krijg je max 100 terug
4. **Geen autocomplete-library** in de huidige dependencies

## Aanbeveling: hybride aanpak

**Beide** opties combineren:

### 1. Smart default op basis van lijstgrootte (geen config nodig)

```
≤ 30 items   →  gewone <select> dropdown
> 30 items   →  combobox met zoekfunctie (typeahead)
```

Dit is het meest pragmatisch: de meeste ref-lijsten (domein, API-standaard, rol) zijn klein en werken prima als dropdown. Alleen grote lijsten (gemeenten, landen) krijgen automatisch een zoekbaar component.

### 2. Metadata-override voor uitzonderingen

Voeg een optioneel `widget`-hint toe in de schema-tag:

```go
Land  int  `json:"land" schema:"ref:LandenlijstLand,widget:combobox"`
```

Of in de MetaRegistry (als je het op type-niveau wilt sturen i.p.v. veld-niveau). Dit is handig als je bijv. een lijst van 25 items toch als combobox wilt weergeven, of andersom.

### 3. Component-keuze: **Downshift** (aanbevolen)

| Optie | Pro | Con |
|---|---|---|
| HTML `<datalist>` | Geen dependency | Nauwelijks te stylen, geen lazy loading |
| **Downshift** | Headless, lichtgewicht (~7kB), a11y-first, past bij Utrecht DS | Zelf CSS schrijven |
| react-select | Alles out-of-the-box | Zwaar (~30kB), eigen styling die botst met Utrecht DS |
| Custom  + lijst | Geen deps | Veel a11y-werk, wiel opnieuw uitvinden |

Downshift past het best: headless (dus je behoudt Utrecht DS-classes), klein, goede ARIA-ondersteuning.

### 4. API-aanpassing nodig

Voor 342 gemeenten wil je niet alles client-side laden. Twee opties:

**a) Server-side zoekendpoint** (schaalbaarst):
```
GET /api/{padnaam}/zoek?q=amst&size=20
```
De combobox stuurt bij elke toetsaanslag (debounced) een query. Dit schaalt ook naar 10.000+ items.

**b) Verhoog maxSize voor ref-lijstfetches** (simpelst voor nu):
Voeg een aparte handler/parameter toe die  toestaat voor referentielijst-items, of een  flag. Voor 342 gemeenten is client-side filteren prima.

### Samenvattend implementatieplan

| Stap | Waar | Wat |
|---|---|---|
| 1 |  | `npm install downshift` |
| 2 |  | Lees , fetch items, render als  of combobox afhankelijk van count |
| 3 | Go schema tag | Optioneel: `widget:combobox` hint parseren in `reflectedVeldenVoorMeta()` |
| 4 |  | Search-endpoint of hogere maxSize voor ref-type fetches |
| 5 |  | Debounced search bij server-side filtering |

Wil je dat ik een van deze stappen ga implementeren? Of wil je eerst over de aanpak sparren?

---

## 🧑 User

Heeft NL design system een dergelijk component in het assortiment?

---

## 🤖 Assistant

Ja, NL Design System heeft de **[Select Combobox](https://nldesignsystem.nl/select-combobox/)** — precies dit patroon:

> *"Biedt de mogelijkheid om één optie te selecteren, waarbij de getoonde opties kunnen worden gefilterd door tekst in een invoerveld in te voeren."*

Oftewel: autocomplete / typeahead.

## Status

Het component heeft status **"Help Wanted"** (stap vóór Community). Dat betekent:

- Er is **geen kant-en-klaar NL DS React-component** in `@utrecht/component-library-react` of 
- Er zijn wel **community-implementaties** bij Utrecht ([Storybook](https://nl-design-system.github.io/utrecht/storybook/?path=/docs/css_css-combobox--docs) / [GitHub](https://github.com/nl-design-system/utrecht/tree/main/components/combobox)) — maar dat is **alleen CSS**, geen React-component
- Er zijn **design tokens en class names** gedefinieerd, waarmee je een custom component kunt stylen conform NL DS

## Praktische opties voor ons

| Optie | Hoe | Effort |
|---|---|---|
| **A. Utrecht CSS + Downshift** | Gebruik de `utrecht-combobox` CSS-classes met [Downshift](https://www.downshift-js.com/) als headless React-controller. Sluit naadloos aan op de bestaande Utrecht-tokens. | Klein (7kB dep, eigen JSX-wrapper) |
| **B. react-select + Utrecht CSS** | Zoals Open Formulieren doet ([voorbeeld](https://github.com/open-formulieren/formio-renderer/tree/daa0545aedb48f56c1a9830de62fde3c3e4d23b0/src/components/forms/Select)):  met custom styling via Utrecht-tokens. | Mid (~30kB dep, styling-overrides) |
| **C. Native `<datalist>`** | Simpelste oplossing:  + `<datalist>`. Nul dependencies. | Minimaal, maar slecht te stylen en beperkte UX |

**Aanbeveling**: optie **A** (Utrecht CSS + Downshift). Past het beste bij het huidige project:
- Je gebruikt al `@utrecht/component-library-css` dus de combobox-classes zijn er al
- Downshift is headless → je schrijft gewoon JSX met Utrecht-classes, net als de rest van 
- Goede ARIA/a11y-support out-of-the-box (volgt het [W3C APG combobox-patroon](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/) dat NL DS ook refereert)
- Lichtgewicht (~7kB gzipped)

Wil je dat ik deze aanpak ga implementeren?

---

## 🧑 User

ja, graag!

---

## 🤖 Assistant

Now let me understand the full ref field flow — schema API output, data endpoints, and how existing forms work. Now let me check the Utrecht CSS combobox classes and look at the current action form parts for secondary entity selects:   Now let me check the API base URL used by the frontend and look at how the CG gemeenten are structured:  Now let me check how the Gemeente type looks as a referentielijst-item — what fields does it have in the Go model and what "weergavenaam" does it expose:  Good — I see the Gemeente type has an  with `weergavenaam` using CEL expression . Now let me look at the GemeenteGegevens_Data struct to understand the actual fields:  Let me trace where the dropdown with 100-item limit actually occurs:   Now let me see how routes are registered and understand the full data path:  

---

## 🧑 User

Should we have a 'count API' on referencelists? Or config it?

---

## 🧑 User

ja, graag

---

## 🤖 Assistant

Let me read the schema handler to understand the current response structure:  Now let me look at the model code handler that returns the schema w/ model: Now let me find the  function: Now I have the full picture. Let me check all the relevant places I need to edit, then look at the  to understand how  requests work: Now I have all the context. Let me now see the  and  again quickly plus check the route definitions to know what pattern to use for the search endpoint:    Now I have full understanding. Let me also check the secondaire-ids route registration: Now I have everything. Time to implement. Let me plan the approach:

1. **Schema API**: Add `ItemCount` to `vizSchemaTypeDTO` — filled only for `referentielijst_item` entiteiten
2. **Search in list handler**: Add `?q=` param to  that does ILIKE search on text columns
3. **Frontend `RefCombobox`**: Downshift-based combobox with Utrecht CSS  
4. **Integrate in **: When  exists, render RefCombobox instead of plain input
5. **Integrate in **: Same

Let me start building:   First, add `ItemCount` to the schema DTO and populate it for referentielijst-item types: 
```

```
Now I need to populate the `ItemCount` in . This needs DB access. Let me check if the schema handler has access to DB:    The schema handler doesn't access DB directly. And  is a pure function. The cleanest approach is to do the count at the endpoint level. Let me check where the `/api/schema/model/code` endpoint is called — it uses  which calls . 

Instead of pushing DB into the pure function, I'll add a separate function that enriches the type DTOs with item counts, called from the endpoint handlers. The schema handler currently has no DB import. Adding a context-dependent count call requires the DB connection, which is tracked in  via the  var. Let me add the enrichment function at the bottom of the schema handler, and call it from both the  and the :   
```

```
Now add the enrichment function and update the schema endpoints to use it. Let me add it right before :   
```

```
Now let me read the  to see where to call the enrichment: 
```

```
Now let me also enrich the schema/model/code endpoint. Let me read that handler: Let me find all callers of : I need to add context to  and call enrichment there. Let me also check the imports in that file: Now add  import and modify  to accept context and call enrichment: 
```

```
Now I need to check whether that first caller also has  in scope. Let me verify: Good,  is already in scope there. Now let me check the second caller:  Both callers look correct. Now let me check for compile errors: Schema API is done. Now let me add the `?q=` search parameter to the list handler. Let me read :  I need to add `?q=` search functionality. Let me look at how Bun models map their columns to understand what reflection I can use:  Now let me look at a model struct to understand the bun tags:   Good. The bun tags use the format  etc. I need to extract string column names from the model struct using reflection. Let me add the search functionality to : 
```

```
Now I need to add the  helper function. Let me add it before or after the handler:   
```

```
Now I also need to update the Count query to apply the same filter when  is present. Let me check:   The count query also needs to respect the search filter. Let me fix that:   
```

```
Good. Now let me build the frontend. First let me read the current  and  to understand the exact patterns:  Now let me read  to see how  works:  Now let me understand the SchemaContext to see what data  provides:   Good,  gives access to  and . Now let me check where  is used:  Good. Now let me check how the editor component gets the :    Now I have all the context to build the `RefCombobox` component and integrate it. Let me also check the  structure in the schema API:    Now I understand the full picture. The `vizSchemaTypeDTO` has  with  for the `weergavenaam`. The `Gemeente` type has  with `weergavenaam` CEL expression. The combobox needs to display these weergavenamen.

But wait — the actual list endpoint returns raw entities, not with afgeleide velden evaluated. Let me check what the API actually returns for gemeenten. Let me look at how the full entities are fetched to understand the response shape for referentielijst_items:     Let me check what the Gemeente struct looks like and what the list endpoint returns:  I realize the  search on the entity table won't work well for referentielijst_items because the data (naam, code) lives in child tables. Let me look at the secondaire-IDs handler for a better pattern, then create a dedicated referentielijst search endpoint:     Good. Now let me check how the full entity handler works for referentielijst_items, and think about a practical, lightweight approach for the combobox. 

The real issue is: the combobox needs  pairs. For Gemeente,  is in `gemeente` table and /`code` are in `gemeentegegevens_data`. Let me create a dedicated lightweight handler for this. Let me check the metaregistry for unterliggende gegevenselementen of Gemeente:   I need a more practical approach. The  on the entity table isn't useful for referentielijst_items since data lives in child tables. Let me create a dedicated referentielijst-opties handler that queries the data table directly. Let me first check what GESubtype constants exist:    Now let me create the referentielijst options handler:   Now let me fix the size parsing — I wrote it poorly. Let me clean it up:    
```

```
Now let me register this route. Let me check where routes are registered:      
```

```
Now let me check for compile errors:    Let me do a quick build check:     Clean build. Now let me create the frontend `RefCombobox` component:     Let me check the existing component directory structure for the editor:       Now let me understand the AfgeleideVelden schema structure in the frontend. The schema API returns  with  for the display name. Let me check how the frontend currently uses these:       Let me look at  to see how displays labels:         Now I have a clear picture. Let me create the `RefCombobox` component:    Now let me verify that  is exported:       Good. Now let me integrate the RefCombobox into :      
```

```
Now add the ref-field handling in 
```

```
Now add the ref-field handling in  before the default case:      
```

```
Now integrate in :       
```

```
Now add the ref-field handling in , right after the  block and before the `boolean` check:        
```

```
Now let me build and test:        There's a test failure. Let me look at the test:           The test is asserting a field  on `A_V_Data`. Let me check if this is a pre-existing failure:            This looks like a pre-existing test failure, not caused by my changes (since  returns immediately when ). Let me verify:  

---

## 🧑 User

@agent Continue: "Continue to iterate?"

---

## 🤖 Assistant

 — **New** dedicated endpoint  that returns  pairs by querying the data table directly
-  — Registered new route

**Frontend:**
-  — **New** Downshift-based combobox with smart switching: client-side filter for ≤30 items, debounced server search for larger lists. Evaluates `weergavenaam` CEL expression for display labels.
-  — Renders  when  is present
-  — Same ref-field integration in 

**Note:** The test failure in  is pre-existing — `A_V_Data` no longer has a  field.

---

## 🧑 User

shall we fix this test issue then? Note: The test failure in TestMaakVizSchemaHandler_GeeftSchemaTerug is pre-existing — A_V_Data no longer has a datum field.

---

## 🤖 Assistant


```

```
Nice milestone: the outdated assertion is aligned with the current model now. I’m re-running the Go tests.
```

```

```

```

```

```

```

```
## ✅ Test issue fixed

I updated  to match the **current** generated model:

- removed the outdated expectation for 
- kept date-format coverage by asserting 
- kept `A_V_Data` coverage via an existing field (`ccc`)
- removed the stale field-description expectation that no longer matches the current schema output

### Verification
I re-ran:

```sh
go test ./...
```

and it now passes with evidence:

- 
- 
- 

If you want, I can also tighten this test a bit further so it better reflects the generated-schema contract going forward.

---

## 🧑 User

how would you tighten it?

---

## 🤖 Assistant

## How I’d tighten the test

I’d make  assert **stable schema behavior**, not fragile generated-field details.

### Better focus
Instead of checking fields that may move between `_Data`, `_Aanvang`, or `_Input`, I’d keep it centered on:

1. **core response contract**
   - `200 OK`
   - 
   -  not empty

2. **representative type coverage**
   - one entiteit: `A`
   - one data GE: `A_U_Data`
   - one materieel/date type: `A_W_Aanvang`
   - one relatie: `Rel_A_B_Data`

3. **schema semantics**
   - booleans map to `boolean`
   - ints map to `integer`
   - floats map to `number`
   - date fields map to  + 
   - enums expose their allowed values

### What I’d avoid
- asserting fields that are only present due to current codegen shape
- assuming every field has a description
- tying the test to one exact internal struct split if that split may evolve

### Example stronger assertions
Keep checks like:

- `A.id -> integer`
- `A.us -> A_U + array`
- `A_U_Data.bbb -> boolean`
- `A_W_Aanvang.datum -> string/date`
- `Rel_A_B_Data.soort -> enum ["LTT","LAT","LTA"]`

### Optional improvement
I’d also add tiny helper assertions such as:

- `assertTypeExists("Rel_A_B")`
- `assertFieldHasEnum("Rel_A_B_Data", "soort", ...)`
- `assertFieldHasFormat("A_W_Aanvang", "datum", "date")`

That makes the test easier to read and less brittle.

---

If you want, I can refactor that test into this cleaner form now.

---

## 🧑 User

i understand. Sound like a good plan. Do you want to change that?

---

## 🤖 Assistant

## Recommendation

**Yes — I would change it**, but only as a small cleanup.

Right now the test is fixed and **passing**. The current evidence is:

```sh
go test ./...
```

with result:
- 
- 
- 

So there is **no urgent need**.

### Why still refactor it?
A small cleanup would make the test:

- **less brittle** against future codegen/model reshuffles
- **clearer** about the actual schema contract
- easier to maintain when fields move between `_Data`, `_Aanvang`, and `_Input`

### My suggestion
If you want, I’d do a **light refactor only**:
- add small helper assertions
- keep the same coverage intent
- avoid fragile assumptions about descriptions or exact generated placement

So: **not necessary for correctness, but worthwhile for maintainability**.

If you want, I can do that refactor now.

---

## 🧑 User

yes please

---

## 🤖 Assistant


```

```

```

```
The test is now cleaner and aimed at the stable schema contract. I’m running the full Go suite once more.## ✅ Done

I refactored  to be **less brittle** by:

- introducing small helper assertions:
  - 
  - 
  - 
  - 
- focusing the test on the **stable schema contract**
  - response version
  - representative type existence
  - boolean / integer / number / date mappings
  - enum exposure for `Rel_A_B_Data.soort`

### Verification
I re-ran:

```sh
go test ./...
```

and it passes:

- 
- 
- 
- 

So the cleanup is in and verified.Now let me look at the model code handler that returns the schema w/ model: Now let me find the  function: Now I have the full picture. Let me check all the relevant places I need to edit, then look at the  to understand how  requests work: Now I have all the context. Let me now see the  and  again quickly plus check the route definitions to know what pattern to use for the search endpoint:    Now I have full understanding. Let me also check the secondaire-ids route registration: Now I have everything. Time to implement. Let me plan the approach:

1. **Schema API**: Add `ItemCount` to `vizSchemaTypeDTO` — filled only for `referentielijst_item` entiteiten
2. **Search in list handler**: Add `?q=` param to  that does ILIKE search on text columns
3. **Frontend `RefCombobox`**: Downshift-based combobox with Utrecht CSS  
4. **Integrate in **: When  exists, render RefCombobox instead of plain input
5. **Integrate in **: Same

Let me start building:   First, add `ItemCount` to the schema DTO and populate it for referentielijst-item types: 
```

```
Now I need to populate the `ItemCount` in . This needs DB access. Let me check if the schema handler has access to DB:    The schema handler doesn't access DB directly. And  is a pure function. The cleanest approach is to do the count at the endpoint level. Let me check where the `/api/schema/model/code` endpoint is called — it uses  which calls . 

Instead of pushing DB into the pure function, I'll add a separate function that enriches the type DTOs with item counts, called from the endpoint handlers. The schema handler currently has no DB import. Adding a context-dependent count call requires the DB connection, which is tracked in  via the  var. Let me add the enrichment function at the bottom of the schema handler, and call it from both the  and the :   
```

```
Now add the enrichment function and update the schema endpoints to use it. Let me add it right before :   
```

```
Now let me read the  to see where to call the enrichment: 
```

```
Now let me also enrich the schema/model/code endpoint. Let me read that handler: Let me find all callers of : I need to add context to  and call enrichment there. Let me also check the imports in that file: Now add  import and modify  to accept context and call enrichment: 
```

```
Now I need to check whether that first caller also has  in scope. Let me verify: Good,  is already in scope there. Now let me check the second caller:  Both callers look correct. Now let me check for compile errors: Schema API is done. Now let me add the `?q=` search parameter to the list handler. Let me read :  I need to add `?q=` search functionality. Let me look at how Bun models map their columns to understand what reflection I can use:  Now let me look at a model struct to understand the bun tags:   Good. The bun tags use the format  etc. I need to extract string column names from the model struct using reflection. Let me add the search functionality to : 
```

```
Now I need to add the  helper function. Let me add it before or after the handler:   
```

```
Now I also need to update the Count query to apply the same filter when  is present. Let me check:   The count query also needs to respect the search filter. Let me fix that:   
```

```
Good. Now let me build the frontend. First let me read the current  and  to understand the exact patterns:  Now let me read  to see how  works:  Now let me understand the SchemaContext to see what data  provides:   Good,  gives access to  and . Now let me check where  is used:  Good. Now let me check how the editor component gets the :    Now I have all the context to build the `RefCombobox` component and integrate it. Let me also check the  structure in the schema API:    Now I understand the full picture. The `vizSchemaTypeDTO` has  with  for the `weergavenaam`. The `Gemeente` type has  with `weergavenaam` CEL expression. The combobox needs to display these weergavenamen.

But wait — the actual list endpoint returns raw entities, not with afgeleide velden evaluated. Let me check what the API actually returns for gemeenten. Let me look at how the full entities are fetched to understand the response shape for referentielijst_items:     Let me check what the Gemeente struct looks like and what the list endpoint returns:  I realize the  search on the entity table won't work well for referentielijst_items because the data (naam, code) lives in child tables. Let me look at the secondaire-IDs handler for a better pattern, then create a dedicated referentielijst search endpoint:     Good. Now let me check how the full entity handler works for referentielijst_items, and think about a practical, lightweight approach for the combobox. 

The real issue is: the combobox needs  pairs. For Gemeente,  is in `gemeente` table and /`code` are in `gemeentegegevens_data`. Let me create a dedicated lightweight handler for this. Let me check the metaregistry for unterliggende gegevenselementen of Gemeente:   I need a more practical approach. The  on the entity table isn't useful for referentielijst_items since data lives in child tables. Let me create a dedicated referentielijst-opties handler that queries the data table directly. Let me first check what GESubtype constants exist:    Now let me create the referentielijst options handler:   Now let me fix the size parsing — I wrote it poorly. Let me clean it up:    
```

```
Now let me register this route. Let me check where routes are registered:      
```

```
Now let me check for compile errors:    Let me do a quick build check:     Clean build. Now let me create the frontend `RefCombobox` component:     Let me check the existing component directory structure for the editor:       Now let me understand the AfgeleideVelden schema structure in the frontend. The schema API returns  with  for the display name. Let me check how the frontend currently uses these:       Let me look at  to see how displays labels:         Now I have a clear picture. Let me create the `RefCombobox` component:    Now let me verify that  is exported:       Good. Now let me integrate the RefCombobox into :      
```

```
Now add the ref-field handling in  before the default case:      
```

```
Now integrate in :       
```

```
Now add the ref-field handling in , right after the  block and before the `boolean` check:        
```

```
Now let me build and test:        There's a test failure. Let me look at the test:           The test is asserting a field  on `A_V_Data`. Let me check if this is a pre-existing failure:            This looks like a pre-existing test failure, not caused by my changes (since  returns immediately when ). Let me verify:  

---
