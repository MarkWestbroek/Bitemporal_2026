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

Now let me read the actual component files I need to modify:  Now let me understand how the Index page's RepresentatieActieBox implements afvoeren/corrigeren: Let me look at how the afvoer/corrigeer API payloads are constructed: Now let me look at how the existing afvoer/corrigeer action is executed from the viz page: Now I have a thorough understanding. Let me also check the  and `validatieMeldingVoorVeld` utilities: Now I have a complete understanding of the codebase. Let me now plan and implement the changes. The main changes will be in  with a new  that supports different modes (wijzigen, corrigeren, beëindigen, verwijderen).

Here's my plan:
1. ****: Add action buttons (Wijzigen/Corrigeren/Beëindigen for enkelvoudig; Verwijderen/Corrigeren for meervoudig) and manage the active action state
2. ****: Support different modes (opslaan, corrigeren) with the right API payload
3. Add similarity check for "Wijzigen" to suggest "Corrigeren" if changes are minor

Let me re-read the full RepresentatieFormulier to understand all props and the complete code: 

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

Let me re-read the exact current files to ensure precise edits:  Now I have exact text for all replacements. Let me apply them all: 
```

```

```

```
Now the EntiteitFormulier changes: 
```

```
Now let me build to check for Now let me build to check for errors: Build succeeds. Let me verify the final state of the modified files:   Build passes cleanly. Here's a summary of all changes:

### 

**New props**: ,  (default `true`)

**Dirty tracking**:  and  computed via , comparing current values against .

**Payload builders**:
-  — field values + identifying keys (entiteitId, rel_id, idKolom)
-  — only identifying keys for afvoer

**Action handlers** (replace old single ):
-  — core API call to 
-  — sends  + opvoer. **Similarity check**: if ≤ half of fields changed, prompts "Wilt u niet eigenlijk corrigeren?"
-  — sends  + opvoer
-  — confirm dialog → afvoer only
-  — confirm dialog → afvoer only (meervoudig)

**Buttons** (conditional on record state):
| Mode | Buttons |
|------|---------|
| **Nieuw** () | Opslaan (as before) |
| **Enkelvoudig** bestaand | **Wijzigen** (disabled if !dirty), **Corrigeren** (disabled if !dirty), **Beëindigen** (always enabled) |
| **Meervoudig** correctie | **Corrigeren** (disabled if !dirty), **Verwijderen**, **Annuleren** |

### 

- New  state tracking which meervoudig row is in correction mode
-  — confirm + afvoer API call for table rows
- Meervoudig table now has **✎** (corrigeren) and **✕** (verwijderen) buttons per row
- Selected row is highlighted; an inline  opens below the table for correction
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

Good. Now let me look at the existing docs folder for the right place to document: Now I'll update the technical documentation with the new GE actions and update the scope section: 
```

```
Documentatie is bijgewerkt in . De nieuwe sectie **§8b** beschrijft alle GE-acties, payloads en state management. De scope-sectie (§11) is gesplitst in Iteratie 1 en 2.

---

Over je vraag naar de **secondaire entiteit-ID** (bijv. `locatie_id` bij Bereikbaarheid):

**Het probleem**: de  valt nu in de immutable-categorie (het is een FK), waardoor het niet bewerkbaar is in het formulier. De Index/Viz-pagina lost dit op met een dropdown via de API ().

**NL Design System componenten voor zoeken:**

Het meest relevante component is de **[Select Combobox](https://nldesignsystem.nl/select-combobox/)** — een invoerveld met filterfunctie over een optielijst. Helaas is dit component in status **Help Wanted**: er is alleen een CSS-implementatie van Gemeente Den Haag, en **geen React component** in `@utrecht/component-library-react`.

**Mijn aanbeveling** voor de twee opties:

| | Optie A: Dropdown | Optie B: ).

**NL Design System componenten voor zoeken:**

Het meest relevante component is de **[Select Combobox](https://nldesignsystem.nl/select-combobox/)** — een invoerveld met filterfunctie over een optielijst. Helaas is dit component in status **Help Wanted**: er is alleen een CSS-implementatie van Gemeente Den Haag, en **geen React component** in `@utrecht/component-library-react`.

**Mijn aanbeveling** voor de twee opties:

| | Optie A: Dropdown | Optie B: Zoek-component |
|---|---|---|
| **Implementatie** |  gevuld door API-call naar secondaire IDs | Read-only waarde + "Zoek {type}" modal/drawer met RepresentatieTabel |
| **Schaalbaarheid** | Prima bij <50 items | Onbeperkt (server-side filtering) |
| **Effort** | Klein — vergelijkbaar met Index-pagina | Groter — custom combobox of modal met hergebruik RepresentatieTabel |
| **UX** | Snel, maar onbruikbaar bij >100 entries | Professioneler, schaalt mee |

**Pragmatisch**: ik zou beginnen met **optie A** (dropdown) voor nu — dat is snel te bouwen en werkt voor de huidige datasets. Dan in een volgende iteratie een custom combobox bouwen (bijv. met `downshift` of , gestyled op NL DS tokens), of een modale zoek-dialog die de bestaande `RepresentatieTabel` hergebruikt als picker.

Wil je dat ik optie A nu implementeer (de secondaire ID als bewerkbare dropdown in het formulier)?

---

## 🧑 User

ja, wil je optie A bouwen en optie documenteren als optie?

---

## 🤖 Assistant



 Good — I now see the full pattern. The API returns . Now let me look at how the schema provides the  info and how the current RepresentatieFormulier classifies fields: Now let me check what schema info is available on the typeMeta for secondaireEntiteitIDKolom:  The  is available on . The API is  and returns . Now let me see how the EntiteitFormulier passes props so I know what  contains for each child (hub):   Now I have the full picture. The  (hub typeMeta) contains . I need to:

1. In : treat the secondaire ID kolom as editable (not immutable) when present, and render it as a  dropdown
2. Fetch the available IDs from the API
3. Include the secondaire ID in the payload

Let me read the full current RepresentatieFormulier to plan the edits precisely: Now I have the full picture. The key changes needed in :

1. Add  to fetch secondaire IDs when  exists
2. Move the secondaire ID kolom from immutable to a special "secondaire" category — bewerkbaar as dropdown
3. Include it in the payload 
```

```
Now let me also include the similarity check properly — it should use  instead of :   
```

```
Let me check the current state of the continuation plan. I need to:
1. Run the build to verify the secondaire ID changes compile
2. Document Option B

Let me first run the build: Build succeeded. Let me mark that and move to documentation. Now let me read the current documentation to find the right place to add Option B: Now I need to update the documentation: 
1. Move the secondaire ID from "uitgesteld naar Iteratie 3+" to the completed items (Optie A is now built)
2. Update point 6 in §12 to reflect that Optie A is now implemented and Optie B is gedocumenteerd als toekomstige verbetering 
```

```
Alles is afgerond:

**Optie A (gebouwd):** De  dropdown voor secondaire entiteit-IDs is geïmplementeerd in . Het formulier:
- Herkent het secondaire veld uit  in de schema-metadata
- Haalt beschikbare IDs op via 
- Toont een  dropdown (of fallback tekstveld als de API geen IDs retourneert)
- Neemt de geselecteerde waarde mee in opvoer-payload en afvoer-sleutel
- Dirty tracking werkt ook voor het secondaire veld

**Optie B (gedocumenteerd als toekomst):** In  §12 punt 6 staat nu:
- Optie A als "huidig, geïmplementeerd" met technische details
- Optie B als "toekomstig, schaalbaar alternatief" — zoekcomponent met NL DS Select Combobox (status: Help Wanted), `downshift`/, of modal met `RepresentatieTabel`. Aanbevolen bij >100 secondaire entiteiten.

Build succesvol (0 errors). De similarity check gebruikt nu ook  (inclusief secondaire veld).

---

## 🧑 User

ik zie nog geen dropdown bij bereikbaarheid

---

## 🤖 Assistant



Laat me het formulier en de schema-metadata onderzoeken om te begrijpen waarom de dropdown niet verschijnt. Now let me check what the schema API returns for Bereikbaarheid — specifically what  looks like: The code checks for . Let me check what the schema API actually returns — the JSON field names might differ (camelCase vs snake_case): The JSON field is  — camelCase. Let me check how the Inhoud Editor page receives and passes  to . The key question is: does the schema that the Inhoud Editor receives include ?  Good,  is in the schema data. Now let me check what EntiteitFormulier passes to RepresentatieFormulier — specifically how  gets from the schema context into the form: Now let me look at the crucial part — where  is rendered for enkelvoudige GEs:  is rendered for enkelvoudige GEs:  Now I see what's happening. The  receives , where . For Bereikbaarheid (which is a relatie), the  should have . Let me check the schema API to see what it actually returns for Bereikbaarheid:  The schema API is at `/api/viz/schema`. Let me check what it actually returns:  Found it! The schema shows  is on the **hub** type (Bereikbaarheid), but since it has , the code uses  for fields. The `locatie_id` field is in the hub's velden, not in the data child's velden. Let me check: That's the bug. `locatie_id` exists in the **hub** type (`Bereikbaarheid`), but not in the **data** child (`Bereikbaarheid_Data`). The form uses  when a data child exists, so `locatie_id` is never found.

Let me read the exact code block and fix it: 
```

```
Now build to verify:  Build succesvol. Het probleem was een **hub-pattern** issue: bij Bereikbaarheid (een relatie met ) zit `locatie_id` in de **hub**-velden (), maar het formulier gebruikte  (van `Bereikbaarheid_Data`) — waar `locatie_id` niet in zit.

De fix in : na de veldclassificatie-loop, als het secondaire veld niet gevonden is en er een  bestaat, zoekt het formulier nu ook in  (de hub-velden) naar het secondaire ID-veld. Nu zou de `locatie_id` dropdown moeten verschijnen bij Bereikbaarheid.

---

## 🧑 User

Het locatie id, wat nu getoond wordt, is niet zo betekenisvol. We moeten het afgeleide weergaveveld van de locaties tonen... (zoals in de tabel) Kan dat?

---

## 🤖 Assistant



 No weergave in the flat list. Let me check the full entity endpoint: Now let me check what the inhoud editor uses for displaying the table (in the screenshot with "weergave" column): Now let me look at the RepresentatieTabel, which is what the Inhoud Editor uses for the table view showing "weergave":  Now I understand the architecture. The  function in RepresentatieTabel needs the full entity with nested GEs to evaluate CEL expressions. The table data fetched via `/locaties` returns flat data (just id + opvoer), but the table must be fetching full entities somehow.

Let me check how RepresentatieTabel fetches its data: Now I understand the full picture. The table fetches via `full/locaties` which returns full entities with nested GEs, Now I understand the full picture. The table fetches via `full/locaties` which returns full entities with nested GEs, enabling CEL-based weergave computation. 

For the dropdown Now I understand the full picture. The table fetches via `full/locaties` which returns full entities with nested GEs, enabling CEL-based weergave computation. 

For the dropdown in RepresentatieFormulier, I need a similar approach. The best solution: instead of just fetching IDs from , also fetch the full entities of the secondaire entiteit type (Locatie) to compute weergavevelden. Let me look at the approach:

1. Get `doelEntiteit` from typeMeta (= "Locatie")  
2. Look up Locatie's typeMeta from 
3. Fetch `full/locaties` to get full entities with nested GE data
4. Use  to compute the display text per entity
5. Show  in the dropdown

Let me check the `doelEntiteit` field and the imports needed:  I see  only returns  here, but in  it also returns . I need to add that. Let me also check how  is defined and if I can import the shared utilities:  Now let me check :   Good.  is a local function in RepresentatieTabel.jsx, not exported. I'll need to either duplicate the logic or refactor. Since it's self-contained and simple, I'll add a similar inline function in RepresentatieFormulier.

Now let me plan the approach:
1. Import ,  from celEvaluator and  from schemaUtils
2. Get  from 
3. Instead of fetching secondaire IDs, fetch the full entities of the doelentiteit type (e.g., `full/locaties`)
4. Build a lookup map: 
5. Show in dropdown: `"1 — Esdoornstraat 45, 3511AA Utrecht"` Now let me read the full current state of the useEffect and the dropdown rendering section:  Now let me see the dropdown rendering:   Now I have the full picture. I'll make the following changes:

1. Add imports for , , 
2. Get  from 
3. Replace the simple ID fetch with a full entity fetch + weergave computation
4. Update the dropdown to show  
```

```
Build succesvol. De dropdown haalt nu de **volledige entiteiten** op van het doeltype (bijv. `full/locaties`) en berekent het weergaveveld via CEL-expressies — precies zoals de tabel dat doet.

De opties in de dropdown tonen nu:
```
(kies Locatie)
1 — Esdoornstraat 45, 3511AA Utrecht
2 — Beukenhof 7, 3521ZX Utrecht
3 — Lindelaan 12, 1234AB Utrecht
...
```

Wat er veranderd is in :
- Imports van , ,  toegevoegd
-  uit  gehaald
-  opgezoekt via  (bijv. `"Locatie"`)
- De  fetcht nu  in plaats van `/api/viz/relatie/.../secondaire-ids`
- Per entiteit wordt het weergaveveld berekend via dezelfde CEL-evaluator die de tabel gebruikt
- Dropdown toont  per optie

---
