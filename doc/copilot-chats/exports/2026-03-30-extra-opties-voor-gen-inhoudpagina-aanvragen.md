# Chat: Extra opties voor GEn inhoudpagina aanvragen

- **Datum**: 2026-03-30 20:33
- **Sessie-ID**: `5737e677-f7fd-4140-b9cb-1c472360bf48`
- **Berichten**: 14

---

## 🧑 User

kun je in de inhoudpagina (overzichten en formulieren) bij GEn wat extra opties maken?

# Bij enkelvoudige GE's:
1. Wijzigen (= afvoeren huidige; doet de registreer API vanzelf) en de nieuwe gegevens registreren (= nwe hub + data + evnt. aanvang/einde)
- gegevens moeten wel substantieel anders zijn. Als ze maar een klein beetje anders zijn, zou er een melding moeten komen met de vraag "wilt u niet eigenlijk corrigeren?"

2. Corrigeren = een correctie op de huidige gegevens toepassen

3. Beeindigen = afvoeren, zonder een nieuw GE op te voeren.

# bij meervoudige GEs
1. een nieuwe toevoegen kan al. Dat is goed
2. een bestaande GE (regel / row) verwijderen moet kunnen
3. een bestaande GE corrigeren

Voor ongedaan maken moeten we een andere interface bedenken nog.

---

## 🤖 Assistant



*Created 9 todos · Read src · Read v06-active.instructions.md*



<details>
<summary><em>Read components</em> (+26 meer)</summary>

- Read components
- Read pages
- Read context
- Read shared
- Read actions
- Read editor
- Read index
- Read tijdlijn
- Read editor
- Read EntiteitFormulier.jsx
- Read RepresentatieTabel.jsx
- Read InhoudEditorPage.jsx
- Read SchemaFormField.jsx
- Read RepresentatieFormulier.jsx
- Read NieuwRecordFormulier.jsx
- Read SchemaContext.jsx
- Read schemaUtils.js
- Read App.jsx
- Read ActionFormParts.jsx
- Read IndexSchemaPage.jsx, lines 1 to 300
- Read EditorNavigatie.jsx
- Read EntiteitActieBox.jsx
- Read RepresentatieActieBox.jsx
- Read RegistratieActieBox.jsx
- Read IndexSchemaPage.jsx, lines 300 to 600
- Read NieuweEntiteitActieBox.jsx
- Read EditorPage.jsx
</details>



<details>
<summary><em>Searched for regex `registratie|registreer|/registratie/|/registreer` (`**/bitemp_register_v06/web/vite/src/pages/IndexSchemaPage.jsx`), 20 results</em> (+10 meer)</summary>

- Searched for regex `registratie|registreer|/registratie/|/registreer` (`**/bitemp_register_v06/web/vite/src/pages/IndexSchemaPage.jsx`), 20 results
- Searched for regex `voerEntiteitActieUit|voerNieuweEntiteitActieUit|voerActieUit|voerRegistratie` (`**/bitemp_register_v06/web/vite/src/pages/IndexSchemaPage.jsx`), 15 results
- Read IndexSchemaPage.jsx, lines 1668 to 1850
- Read IndexSchemaPage.jsx, lines 1846 to 1980
- Read IndexSchemaPage.jsx, lines 1513 to 1670
- Read EditorV2Page.jsx
- Read celEvaluator.js, lines 1 to 200
- Read celEvaluator.js, lines 200 to 280
- Read main.jsx
- Searched for regex `InhoudEditorPage|EntiteitFormulier|Router|BrowserRouter|Routes|Route` (`**/bitemp_register_v06/web/vite/src/**/*.jsx`), 20 results
- Read main.jsx
</details>



<details>
<summary><em>Read src</em> (+40 meer)</summary>

- Read src
- Read v06-active.instructions.md
- Read components
- Read pages
- Read context
- Read shared
- Read actions
- Read editor
- Read index
- Read tijdlijn
- Read editor
- Read EntiteitFormulier.jsx
- Read RepresentatieTabel.jsx
- Read InhoudEditorPage.jsx
- Read SchemaFormField.jsx
- Read RepresentatieFormulier.jsx
- Read NieuwRecordFormulier.jsx
- Read SchemaContext.jsx
- Read schemaUtils.js
- Read App.jsx
- Read ActionFormParts.jsx
- Read IndexSchemaPage.jsx, lines 1 to 300
- Read EditorNavigatie.jsx
- Read EntiteitActieBox.jsx
- Read RepresentatieActieBox.jsx
- Read RegistratieActieBox.jsx
- Read IndexSchemaPage.jsx, lines 300 to 600
- Read NieuweEntiteitActieBox.jsx
- Read EditorPage.jsx
- Searched for regex `registratie|registreer|/registratie/|/registreer` (`**/bitemp_register_v06/web/vite/src/pages/IndexSchemaPage.jsx`), 20 results
- Searched for regex `voerEntiteitActieUit|voerNieuweEntiteitActieUit|voerActieUit|voerRegistratie` (`**/bitemp_register_v06/web/vite/src/pages/IndexSchemaPage.jsx`), 15 results
- Read IndexSchemaPage.jsx, lines 1668 to 1850
- Read IndexSchemaPage.jsx, lines 1846 to 1980
- Read IndexSchemaPage.jsx, lines 1513 to 1670
- Read EditorV2Page.jsx
- Read celEvaluator.js, lines 1 to 200
- Read celEvaluator.js, lines 200 to 280
- Read main.jsx
- Searched for regex `InhoudEditorPage|EntiteitFormulier|Router|BrowserRouter|Routes|Route` (`**/bitemp_register_v06/web/vite/src/**/*.jsx`), 20 results
- Read main.jsx
- Read content.txt
</details>



*Read content.txt*

Now let me read the actual component files I need to modify:  

*Read EntiteitFormulier.jsx, lines 1 to 150 · Read RepresentatieFormulier.jsx, lines 1 to 150 · Read EntiteitFormulier.jsx, lines 150 to 384 · Read RepresentatieFormulier.jsx, lines 150 to 213*



*Read EntiteitFormulier.jsx, lines 1 to 150 · Read RepresentatieFormulier.jsx, lines 1 to 150 · Read EntiteitFormulier.jsx, lines 150 to 384 · Read RepresentatieFormulier.jsx, lines 150 to 213*

Now let me understand how the Index page's RepresentatieActieBox implements afvoeren/corrigeren: 

*Searched for regex `RepresentatieActieBox|afvoer.*wijzigingen|corrigeren|correctie` (`**/bitemp_register_v06/web/vite/src/pages/IndexSchemaPage.jsx`), 28 results · Read RepresentatieActieBox.jsx*

Let me look at how the afvoer/corrigeer API payloads are constructed: 

*Read IndexSchemaPage.jsx, lines 960 to 1060 · Starting: *Understand registreer API for corrections/changes* (2/9)*

Now let me look at how the existing afvoer/corrigeer action is executed from the viz page: 

*Read IndexSchemaPage.jsx, lines 1830 to 1910 · Starting: *Implement all GE actions in EntiteitFormulier* (3/5)*

Now I have a thorough understanding. Let me also check the `coercedWaardeVoorVeld` and `validatieMeldingVoorVeld` utilities: 

*Searched for regex `export function coercedWaardeVoorVeld|export function validatieMeldingVoorVeld` (`**/bitemp_register_v06/web/vite/src/components/actions/ActionFormParts.jsx`), 2 results*



*Searched for regex `export function coercedWaardeVoorVeld|export function validatieMeldingVoorVeld` (`**/bitemp_register_v06/web/vite/src/components/actions/ActionFormParts.jsx`), 2 results · Read ActionFormParts.jsx, lines 60 to 175*

Now I have a complete understanding of the codebase. Let me now plan and implement the changes. The main changes will be in `EntiteitFormulier.jsx` with a new `RepresentatieFormulier.jsx` that supports different modes (wijzigen, corrigeren, beëindigen, verwijderen).

Here's my plan:
1. **`EntiteitFormulier.jsx`**: Add action buttons (Wijzigen/Corrigeren/Beëindigen for enkelvoudig; Verwijderen/Corrigeren for meervoudig) and manage the active action state
2. **`RepresentatieFormulier.jsx`**: Support different modes (opslaan, corrigeren) with the right API payload
3. Add similarity check for "Wijzigen" to suggest "Corrigeren" if changes are minor

Let me re-read the full RepresentatieFormulier to understand all props and the complete code: 

*Read RepresentatieFormulier.jsx, lines 140 to 213*



*Read RepresentatieFormulier.jsx, lines 140 to 213*



---

## 🧑 User

i saw you thinking about two step editing, but that is not desired. I like the directness of edit the data immediately. Hence the check on differences once you click a button.

What you can do is enable a button only once something changed.

---

## 🤖 Assistant

Let me re-read the exact file contents to make precise edits.  

---

## 🧑 User

Een wijziging is voor een enkelvoudig record: : de nieuwe opvoeren. De backend voert de oude vanzef af.
{
  "registratie": {
    "registratietype": "registratie"
  },
  "wijzigingen": [
    {
      "opvoer": {
        "partnernaam": {
          "natuurlijkpersoon_id": 7,
          "achternaam": "NewName"
        }
      }
    }
  ]
}

Een correctie is bijna gelijk, maar met type correctie:
{
  "registratie": {
    "registratietype": "correctie"
  },
  "wijzigingen": [
    {
      "opvoer": {
        "burgerschap": {
          "rel_id": 1,
          "natuurlijkpersoon_id": 7,
          "landcode": "NLD"
        }
      }
    }
  ]
}

---

## 🤖 Assistant

Understood - direct inline editing with buttons enabled only when values change, and the similarity check fires on the Wijzigen button click. Let me implement this now.

Let me re-read the exact current files to ensure precise edits:  

*Read RepresentatieFormulier.jsx, lines 37 to 87 · Read RepresentatieFormulier.jsx, lines 82 to 213*



<details>
<summary><em>Read RepresentatieFormulier.jsx, lines 37 to 87</em> (+4 meer)</summary>

- Read RepresentatieFormulier.jsx, lines 37 to 87
- Read RepresentatieFormulier.jsx, lines 82 to 213
- Read EntiteitFormulier.jsx, lines 76 to 145
- Read EntiteitFormulier.jsx, lines 260 to 384
- Read EntiteitFormulier.jsx, lines 140 to 148
</details>

Now I have exact text for all replacements. Let me apply them all: 

*Updated todo list*




*Updated todo list*


Now the EntiteitFormulier changes: 


*Starting: *Build and test* (5/5)*

Now let me build to check for 

*Starting: *Build and test* (5/5)*

Now let me build to check for errors: Build succeeds. Let me verify the final state of the modified files:   

*Read RepresentatieFormulier.jsx, lines 1 to 30 · Completed: *Build and test* (5/5)*

Build passes cleanly. Here's a summary of all changes:

### `RepresentatieFormulier.jsx`

**New props**: `onCancel`, `isEnkelvoudig` (default `true`)

**Dirty tracking**: `isDirty` and `aantalGewijzigdeVelden` computed via `useMemo`, comparing current values against `initialData`.

**Payload builders**:
- `buildOpvoerPayload()` — field values + identifying keys (entiteitId, rel_id, idKolom)
- `buildAfvoerSleutel()` — only identifying keys for afvoer

**Action handlers** (replace old single `handleSubmit`):
- `handleActie(registratietype, isAfvoer)` — core API call to `POST /registratie/`
- `handleWijzigen()` — sends `registratietype: "registratie"` + opvoer. **Similarity check**: if ≤ half of fields changed, prompts "Wilt u niet eigenlijk corrigeren?"
- `handleCorrigeren()` — sends `registratietype: "correctie"` + opvoer
- `handleBeeindigen()` — confirm dialog → afvoer only
- `handleVerwijderen()` — confirm dialog → afvoer only (meervoudig)

**Buttons** (conditional on record state):
| Mode | Buttons |
|------|---------|
| **Nieuw** (`initialData=null`) | Opslaan (as before) |
| **Enkelvoudig** bestaand | **Wijzigen** (disabled if !dirty), **Corrigeren** (disabled if !dirty), **Beëindigen** (always enabled) |
| **Meervoudig** correctie | **Corrigeren** (disabled if !dirty), **Verwijderen**, **Annuleren** |

### `EntiteitFormulier.jsx`

- New `bewerkRij` state tracking which meervoudig row is in correction mode
- `handleVerwijderenRij(item, childMeta)` — confirm + afvoer API call for table rows
- Meervoudig table now has **✎** (corrigeren) and **✕** (verwijderen) buttons per row
- Selected row is highlighted; an inline `RepresentatieFormulier` opens below the table for correction
- State coordination: opening a correction clears any "toevoegen" form and vice versa

---

## 🧑 User

Wil je de UI changes documenteren?

En een vraag:

Een relatie heeft altijd een secondaire id: waar de relatie heen gaat. De doel-representatie (doorgaans een ENT). Hier Bereikbaarheid , de soort bereikbaarheid en dan moet de locatie aangewezen worden met een locatie ID. Dat is nu helemaal weg. Qua wijzigen is dat nog iets:
1. een dropdown. Dat kan nu, maar nu zijn er maar 10 adressen ofzo. Later zijn dat er veel meer. Dan moet je iets anders doen.
2. read only tonen en een zoek <<locatie>> (de naam van doelrepresentatie, het type dus) optie.

2 lijkt mij beter, al is 1 nu wel gemakkelijker te maken natuurlijk.

Zijn er NL design system componenten die bruikbaar zijn voor de zoek?

---

## 🤖 Assistant



*Created 3 todos*

Let me first look at how the secondaire ID is currently handled in the Index page and what NL Design System is being used:  

*Searched for text `secondaire|SecondaireEntiteitIDKolom` (`**/bitemp_register_v06/web/vite/src/**/*.{jsx,js}`), 30 results · Searched for regex `@nl-design-system|@utrecht|nl-design-system` (`**/bitemp_register_v06/web/vite/package.json`), 3 results · Read IndexSchemaPage.jsx, lines 1210 to 1260 · Fetched https://nl-design-system.github.io/utrecht/storybook/?path=/docs/react-combobox--docs*



---

## 🧑 User

ja, wil je optie A bouwen en optie documenteren als optie?

---

## 🤖 Assistant



*Created 4 todos · Searched for regex `secondaire-ids|secondaireEntiteitIDKolom.*secondaire|ActionFieldControl.*secondaire` (`**/bitemp_register_v06/web/vite/src/pages/IndexSchemaPage.jsx`), 4 results*



<details>
<summary><em>Created 4 todos</em> (+4 meer)</summary>

- Created 4 todos
- Searched for regex `secondaire-ids|secondaireEntiteitIDKolom.*secondaire|ActionFieldControl.*secondaire` (`**/bitemp_register_v06/web/vite/src/pages/IndexSchemaPage.jsx`), 4 results
- Read IndexSchemaPage.jsx, lines 905 to 955
- Searched for regex `secondaire|ActionFieldControl` (`**/bitemp_register_v06/web/vite/src/components/actions/ActionFormParts.jsx`), 20 results
- Read ActionFormParts.jsx, lines 270 to 300
</details>

Good — I now see the full pattern. The API returns `{ ids: [1, 2, 3, ...] }`. Now let me look at how the schema provides the `secondaireEntiteitIDKolom` info and how the current RepresentatieFormulier classifies fields: 

*Read RepresentatieFormulier.jsx, lines 37 to 80*

Now let me check what schema info is available on the typeMeta for secondaireEntiteitIDKolom:  

*Searched for text `secondaireEntiteitIDKolom` (`**/bitemp_register_v06/web/vite/src/**/*.{jsx,js}`), 10 results*

The `secondaireEntiteitIDKolom` is available on `typeMeta`. The API is `/api/viz/relatie/{doeltype}/secondaire-ids` and returns `{ ids: [1, 2, 3, ...] }`. Now let me see how the EntiteitFormulier passes props so I know what `typeMeta` contains for each child (hub):   

*Read EntiteitFormulier.jsx, lines 260 to 310*



*Read EntiteitFormulier.jsx, lines 260 to 310 · Starting: *Implement dropdown for secondaire ID* (2/4)*

Now I have the full picture. The `childMeta` (hub typeMeta) contains `secondaireEntiteitIDKolom`. I need to:

1. In `RepresentatieFormulier`: treat the secondaire ID kolom as editable (not immutable) when present, and render it as a `<select>` dropdown
2. Fetch the available IDs from the API
3. Include the secondaire ID in the payload

Let me read the full current RepresentatieFormulier to plan the edits precisely: 

*Read RepresentatieFormulier.jsx, lines 1 to 305*

Now I have the full picture. The key changes needed in `RepresentatieFormulier.jsx`:

1. Add `useEffect` to fetch secondaire IDs when `typeMeta.secondaireEntiteitIDKolom` exists
2. Move the secondaire ID kolom from immutable to a special "secondaire" category — bewerkbaar as dropdown
3. Include it in the payload 
Now let me also include the similarity check properly — it should use `alleBewerkbaar` instead of `bewerkbareVelden`:   
Let me check the current state of the continuation plan. I need to:
1. Run the build to verify the secondaire ID changes compile
2. Document Option B

Let me first run the build: 

*Starting: *Run build to verify changes* (1/3)*



*Starting: *Run build to verify changes* (1/3)*

Build succeeded. Let me mark that and move to documentation. 

*Starting: *Document Option B in docs* (3/3)*

Now let me read the current documentation to find the right place to add Option B: 

*Searched for regex `secondaire|Optie|dropdown|zoekcomponent` (`**/bitemp_register_v06/docs/inhoud-editor-technisch.md`), 12 results*



*Searched for regex `secondaire|Optie|dropdown|zoekcomponent` (`**/bitemp_register_v06/docs/inhoud-editor-technisch.md`), 12 results · Read inhoud-editor-technisch.md, lines 335 to 370*

Now I need to update the documentation: 
1. Move the secondaire ID from "uitgesteld naar Iteratie 3+" to the completed items (Optie A is now built)
2. Update point 6 in §12 to reflect that Optie A is now implemented and Optie B is gedocumenteerd als toekomstige verbetering 


*Completed: *Document Option B in docs* (3/3)*

Alles is afgerond:

**Optie A (gebouwd):** De `<select>` dropdown voor secondaire entiteit-IDs is geïmplementeerd in `RepresentatieFormulier.jsx`. Het formulier:
- Herkent het secondaire veld uit `secondaireEntiteitIDKolom` in de schema-metadata
- Haalt beschikbare IDs op via `GET /api/viz/relatie/{typenaam}/secondaire-ids`
- Toont een `<select>` dropdown (of fallback tekstveld als de API geen IDs retourneert)
- Neemt de geselecteerde waarde mee in opvoer-payload en afvoer-sleutel
- Dirty tracking werkt ook voor het secondaire veld

**Optie B (gedocumenteerd als toekomst):** In `inhoud-editor-technisch.md` §12 punt 6 staat nu:
- Optie A als "huidig, geïmplementeerd" met technische details
- Optie B als "toekomstig, schaalbaar alternatief" — zoekcomponent met NL DS Select Combobox (status: Help Wanted), `downshift`/`react-select`, of modal met `RepresentatieTabel`. Aanbevolen bij >100 secondaire entiteiten.

Build succesvol (0 errors). De similarity check gebruikt nu ook `alleBewerkbaar` (inclusief secondaire veld).

---

## 🧑 User

ik zie nog geen dropdown bij bereikbaarheid

---

## 🤖 Assistant

Laat me het formulier en de schema-metadata onderzoeken om te begrijpen waarom de dropdown niet verschijnt. 

*Starting: *Diagnose missing dropdown* (1/3) · Searched for text `secondaire` (`**/bitemp_register_v06/web/vite/src/components/editor/RepresentatieFormulier.jsx`), 20 results · Read RepresentatieFormulier.jsx, lines 48 to 130*

Now let me check what the schema API returns for Bereikbaarheid — specifically what `typeMeta` looks like: 

*Searched for regex `secondaireEntiteitIDKolom|SecondaireEntiteitIDKolom` (`**/bitemp_register_v06/web/vite/src/components/editor/*.jsx`), 1 result*

The code checks for `typeMeta?.secondaireEntiteitIDKolom`. Let me check what the schema API actually returns — the JSON field names might differ (camelCase vs snake_case): 

*Searched for regex `secondaire.*json|SecondaireEntiteitIDKolom.*json|secondaire_entiteit` (`**/bitemp_register_v06/**/*.go`), 4 results*

The JSON field is `secondaireEntiteitIDKolom` — camelCase. Let me check how the Inhoud Editor page receives and passes `typeMeta` to `RepresentatieFormulier`. The key question is: does the schema that the Inhoud Editor receives include `secondaireEntiteitIDKolom`?  

*Searched for regex `typeMeta|schema.*types` (`**/bitemp_register_v06/web/vite/src/**/*.jsx`), 30 results*

Good, `secondaireEntiteitIDKolom` is in the schema data. Now let me check what EntiteitFormulier passes to RepresentatieFormulier — specifically how `typeMeta` gets from the schema context into the form: 

*Searched for regex `RepresentatieFormulier|typeMeta|childMeta` (`**/bitemp_register_v06/web/vite/src/components/editor/EntiteitFormulier.jsx`), 40 results · Read EntiteitFormulier.jsx, lines 140 to 250*

Now let me look at the crucial part — where `RepresentatieFormulier` is rendered for enkelvoudige GEs:  is rendered for enkelvoudige GEs:  

*Read EntiteitFormulier.jsx, lines 250 to 340 · Read EntiteitFormulier.jsx, lines 340 to 440*

Now I see what's happening. The `RepresentatieFormulier` receives `typeMeta={childMeta}`, where `childMeta = typeMetaByTypenaam?.[child.doeltype]`. For Bereikbaarheid (which is a relatie), the `childMeta` should have `secondaireEntiteitIDKolom`. Let me check the schema API to see what it actually returns for Bereikbaarheid:  

*Searched for regex `schema|viz.*schema` (`**/bitemp_register_v06/routes/*.go`), no results*



*Searched for regex `schema` (`**/bitemp_register_v06/routes/**/*.go`), no results · Searched for files matching `**/bitemp_register_v06/routes/*.go`, 3 matches*



*Searched for regex `schema` (`**/bitemp_register_v06/routes/addroutes.go`), no results*



*Read addroutes.go, lines 1 to 30*



<details>
<summary><em>Searched for regex `schema|viz.*schema` (`**/bitemp_register_v06/routes/*.go`), no results</em> (+4 meer)</summary>

- Searched for regex `schema|viz.*schema` (`**/bitemp_register_v06/routes/*.go`), no results
- Searched for regex `schema` (`**/bitemp_register_v06/routes/**/*.go`), no results
- Searched for files matching `**/bitemp_register_v06/routes/*.go`, 3 matches
- Searched for regex `schema` (`**/bitemp_register_v06/routes/addroutes.go`), no results
- Read addroutes.go, lines 1 to 30
</details>

The schema API is at `/api/viz/schema`. Let me check what it actually returns:  Found it! The schema shows `secondaireEntiteitIDKolom: "locatie_id"` is on the **hub** type (Bereikbaarheid), but since it has `ge_subtype: "hub"`, the code uses `dataMeta` for fields. The `locatie_id` field is in the hub's velden, not in the data child's velden. Let me check: That's the bug. `locatie_id` exists in the **hub** type (`Bereikbaarheid`), but not in the **data** child (`Bereikbaarheid_Data`). The form uses `dataMeta.velden` when a data child exists, so `locatie_id` is never found.

Let me read the exact code block and fix it: 

*Read RepresentatieFormulier.jsx, lines 72 to 100*


Now build to verify:  

*Completed: *Diagnose missing dropdown* (1/3)*

Build succesvol. Het probleem was een **hub-pattern** issue: bij Bereikbaarheid (een relatie met `ge_subtype: "hub"`) zit `locatie_id` in de **hub**-velden (`typeMeta.velden`), maar het formulier gebruikte `dataMeta.velden` (van `Bereikbaarheid_Data`) — waar `locatie_id` niet in zit.

De fix in `RepresentatieFormulier.jsx`: na de veldclassificatie-loop, als het secondaire veld niet gevonden is en er een `dataMeta` bestaat, zoekt het formulier nu ook in `typeMeta.velden` (de hub-velden) naar het secondaire ID-veld. Nu zou de `locatie_id` dropdown moeten verschijnen bij Bereikbaarheid.

---

## 🧑 User

Het locatie id, wat nu getoond wordt, is niet zo betekenisvol. We moeten het afgeleide weergaveveld van de locaties tonen... (zoals in de tabel) Kan dat?

---

## 🤖 Assistant



*Created 3 todos*

No weergave in the flat list. Let me check the full entity endpoint: Now let me check what the inhoud editor uses for displaying the table (in the screenshot with "weergave" column): 

*Searched for regex `weergave|afgeleide` (`**/bitemp_register_v06/web/vite/src/**/*.jsx`), 30 results*

Now let me look at the RepresentatieTabel, which is what the Inhoud Editor uses for the table view showing "weergave":  

*Searched for regex `weergave|afgeleide|celEvaluator` (`**/bitemp_register_v06/web/vite/src/components/editor/RepresentatieTabel.jsx`), 20 results · Read RepresentatieTabel.jsx, lines 14 to 55*

Now I understand the architecture. The `berekenWeergaveveld` function in RepresentatieTabel needs the full entity with nested GEs to evaluate CEL expressions. The table data fetched via `/locaties` returns flat data (just id + opvoer), but the table must be fetching full entities somehow.

Let me check how RepresentatieTabel fetches its data: 

*Read RepresentatieTabel.jsx, lines 55 to 100 · Read RepresentatieTabel.jsx, lines 100 to 210*

Now I understand the full picture. The table fetches via `full/locaties` which returns full entities with nested GEs, Now I understand the full picture. The table fetches via `full/locaties` which returns full entities with nested GEs, enabling CEL-based weergave computation. 

For the dropdown Now I understand the full picture. The table fetches via `full/locaties` which returns full entities with nested GEs, enabling CEL-based weergave computation. 

For the dropdown in RepresentatieFormulier, I need a similar approach. The best solution: instead of just fetching IDs from `/api/viz/relatie/.../secondaire-ids`, also fetch the full entities of the secondaire entiteit type (Locatie) to compute weergavevelden. Let me look at the approach:

1. Get `doelEntiteit` from typeMeta (= "Locatie")  
2. Look up Locatie's typeMeta from `typeMetaByTypenaam`
3. Fetch `full/locaties` to get full entities with nested GE data
4. Use `berekenWeergaveveld` to compute the display text per entity
5. Show `id - weergavetekst` in the dropdown

Let me check the `doelEntiteit` field and the imports needed:  

*Read RepresentatieFormulier.jsx, lines 1 to 48*

I see `useSchema` only returns `baseUrl` here, but in `EntiteitFormulier.jsx` it also returns `typeMetaByTypenaam`. I need to add that. Let me also check how `berekenWeergaveveld` is defined and if I can import the shared utilities:  

*Read celEvaluator.js, lines 1 to 15 · Searched for regex `^export` (`**/bitemp_register_v06/web/vite/src/shared/celEvaluator.js`), 3 results*



*Read celEvaluator.js, lines 1 to 15 · Searched for regex `^export` (`**/bitemp_register_v06/web/vite/src/shared/celEvaluator.js`), 3 results*

Now let me check `platSlaHubItems`:   

*Searched for regex `^export.*platSlaHubItems|^export.*berekenWeergaveveld` (`**/bitemp_register_v06/web/vite/src/shared/schemaUtils.js`), 1 result*

Good. `berekenWeergaveveld` is a local function in RepresentatieTabel.jsx, not exported. I'll need to either duplicate the logic or refactor. Since it's self-contained and simple, I'll add a similar inline function in RepresentatieFormulier.

Now let me plan the approach:
1. Import `evalueerCelExpressie`, `bouwCelContext` from celEvaluator and `platSlaHubItems` from schemaUtils
2. Get `typeMetaByTypenaam` from `useSchema()`
3. Instead of fetching secondaire IDs, fetch the full entities of the doelentiteit type (e.g., `full/locaties`)
4. Build a lookup map: `id → weergavetekst`
5. Show in dropdown: `"1 — Esdoornstraat 45, 3511AA Utrecht"` 

*Starting: *Update dropdown to show weergave* (2/3)*

Now let me read the full current state of the useEffect and the dropdown rendering section:  

*Read RepresentatieFormulier.jsx, lines 46 to 72*

Now let me see the dropdown rendering:   

*Searched for text `secondaireVeld && (` (`**/bitemp_register_v06/web/vite/src/components/editor/RepresentatieFormulier.jsx`), 1 result · Read RepresentatieFormulier.jsx, lines 288 to 340*

Now I have the full picture. I'll make the following changes:

1. Add imports for `evalueerCelExpressie`, `bouwCelContext`, `platSlaHubItems`
2. Get `typeMetaByTypenaam` from `useSchema()`
3. Replace the simple ID fetch with a full entity fetch + weergave computation
4. Update the dropdown to show `id — weergavetekst`


*Starting: *Build and verify* (3/3) · Completed: *Build and verify* (3/3)*

Build succesvol. De dropdown haalt nu de **volledige entiteiten** op van het doeltype (bijv. `full/locaties`) en berekent het weergaveveld via CEL-expressies — precies zoals de tabel dat doet.

De opties in de dropdown tonen nu:
```
(kies Locatie)
1 — Esdoornstraat 45, 3511AA Utrecht
2 — Beukenhof 7, 3521ZX Utrecht
3 — Lindelaan 12, 1234AB Utrecht
...
```

Wat er veranderd is in `RepresentatieFormulier.jsx`:
- Imports van `platSlaHubItems`, `evalueerCelExpressie`, `bouwCelContext` toegevoegd
- `typeMetaByTypenaam` uit `useSchema()` gehaald
- `doelEntiteitMeta` opgezoekt via `typeMeta.doelEntiteit` (bijv. `"Locatie"`)
- De `useEffect` fetcht nu `full/{padnaam}` in plaats van `/api/viz/relatie/.../secondaire-ids`
- Per entiteit wordt het weergaveveld berekend via dezelfde CEL-evaluator die de tabel gebruikt
- Dropdown toont `"{id} — {weergavetekst}"` per optie

---
