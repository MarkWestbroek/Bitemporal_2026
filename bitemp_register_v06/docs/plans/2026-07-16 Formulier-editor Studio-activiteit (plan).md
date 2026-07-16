# Plan — Visuele Formulier-editor als Omnium Studio-activiteit

> **Opgesteld**: 2026-07-16
> **Status**: P1-MVP **gebouwd** (2026-07-16, branch `feat/formulier-editor-studio`); P2/P3 open

## 0. Implementatiestatus (2026-07-16)

**P1-MVP gebouwd en geverifieerd.** Nieuwe module `web/vite/src/formuliereditor/`
(`layoutModel.js` + test, `useFormulierEditorStore.js`, `FormulierCanvas.jsx`,
`FormulierInspector.jsx`, `preview.js`) + Studio-activiteit
`studio/activities/formulierActivity.jsx` in nieuwe balkgroep **"presentatie"**.
Werkt: palette (ModelPicker) → veld toevoegen met **padadressering** `ENT.GE.veld` →
structuur-boom (selecteren/schuiven/verwijderen, groep/rij/conditioneel toevoegen) →
inspector (label/breedte/widget/beschrijving/conditie-object + definitie-metadata) →
**live preview** via `CustomFormulierRenderer`. Renderer uitgebreid met label-override
(`SchemaFormField`), beschrijving-override en object-condities. Undo/redo aanwezig.
Verificatie: `layoutModel.test.js` (7/7), productie-build groen, en een Playwright-smoke
(activiteit zichtbaar, palette gevuld vanuit het model, veld toegevoegd, preview rendert).
De smoke ving één bug: de preview crashte zonder `<SchemaProvider>` — nu wrapt de
activiteit-Provider de slots in `SchemaProvider baseUrl={apiBase()}`.

**Ook gebouwd (2026-07-16, vervolgcommits):**
- **DB-opslaan** — `saveFormulierDefinitie.js` schrijft de definitie weg als nieuwe
  `FormulierDefinitie` (nextId via max-id-endpoint → opvoer hub/meta/layout/aanvang);
  "Opslaan"-knop + menu-item + statusfeedback. Geverifieerd tegen de echte backend
  (definitie aangemaakt + opgeruimd) en UI-validatie (Playwright).
- **Meervoudigheid — `lijst`-element** (§4a-quater): `momentvoorkomen` gesurfacet op de
  FieldRef (`modelTree.js`); een blad-veld uit een meervoudig GE wrapt automatisch in een
  `lijst` (relatieve adressering), en een pick van het array-collectieveld maakt een lege
  `lijst` met dat pad als bron. `CustomFormulierRenderer` rendert `lijst` als herhaalbare
  sectie (item toevoegen/verwijderen); `+ Lijst`-knop + inspector. Geverifieerd: unit 9/9,
  build, Playwright (lijst maken + item toevoegen in preview) + regressie op het platte pad.

**Nog open:**
- **`lijst` runtime-save**: de per-item cross-GE-save in `EntiteitFormulier` (echte
  entiteit-data) is nog niet aangepast — een lijst-gebaseerde definitie rendert in de
  preview, maar wordt op een echt record nog niet opgeslagen/geladen. Volgende increment.
- **Nieuwe versie van bestaande definitie**: nu maakt opslaan telkens een nieuwe definitie;
  laden-uit-DB + nieuwe Layout-versie is follow-up.
- **Doeltype-gebonden palette**: koppel aan `doeltype` + betrokken domeinen (§4a-bis).
- **EntiteitFormulier path-keying** (§5 stap 6) voor de flat velden.
- **dnd-kit** i.p.v. ↑/↓-knoppen; **legacy-resolver** voor kale-naam-definities.

---

> **Oorspronkelijk ontwerp** (vóór bouw):
> **Backlog**: F30 / F41 (visuele FormulierDefinitie-editor), F42 (invul-wizard), raakt F2/F26/F29
> **Bron-discussie**: chat 2026-07-16 (order-vragen op de custom renderer + wens voor visuele editor)

## 1. Aanleiding

De custom-formulierlaag draait al: een `FormulierDefinitie` (configuratie-domein, bitemporeel)
bewaart een `layout_json` dat door [CustomFormulierRenderer.jsx](../../web/vite/src/components/editor/CustomFormulierRenderer.jsx)
wordt gerenderd en via cross-GE-save wordt weggeschreven ([EntiteitFormulier.jsx](../../web/vite/src/components/editor/EntiteitFormulier.jsx)).
Het `layout_json` wordt nu **met de hand** geschreven. Dat is foutgevoelig en verklaart de
verwarring uit de aanleiding-chat:

- De **volgorde** in het formulier leek af te wijken van de JSON → in werkelijkheid keek de
  gebruiker naar de *standaard*-weergave (toggle `customWeergave === false`), niet naar de
  layout. De custom-weergave rendert wél in JSON-volgorde.
- **Labels** zijn nu hard de veldnaam ([SchemaFormField.jsx](../../web/vite/src/components/editor/SchemaFormField.jsx) `{veld.naam}`); geen override mogelijk.
- Velden worden **globaal op kale naam** gevonden (`veldenByNaam`), niet via een pad; de groep is
  puur cosmetisch. **Dit is de kernfout**: GE-veldnamen zijn *niet* uniek over het model
  (bv. `achternaam` in zowel `NP.Naam` als `NP.Partnernaam`), dus de platte lijst botst.
- `conditioneel` werkte "niet" omdat de standaard-weergave de layout niet uitvoert.

Doel: een **visuele editor** die dit `layout_json` genereert, plus een uitbreiding van het
layout-vocabulaire (labels, robuustere condities, virtuele/voorinvul-velden).

## 2. Architectuurkeuze

**Eigen runtime-renderer behouden, UI-schema formaliseren.** We nemen géén externe form-lib
(JSONForms/rjsf/form.io) in gebruik: het metamodel + de bitemporele cross-GE-save zijn te
specifiek. Wel lenen we het bewezen patroon van **JSONForms**: scheiding tussen
*data-schema* (wélke velden bestaan = ons metamodel via de schema-API) en *UI-schema*
(layout/labels/condities = ons `layout_json`). De editor en de live-preview delen exact één
runtime: `CustomFormulierRenderer`.

Referenties die UX/mechaniek voeden: JSONForms (rules `SHOW/HIDE/ENABLE`), form.io
(palette→canvas→properties, hidden/calculated fields), SurveyJS (wizard, expressie-visibility),
dnd-kit (toegankelijke drag-drop, past bij de React/Zustand-stack).

**Leidend principe: het model is het adres.** Een veld wordt overal via zijn modelpad
`ENT.GE.veld` aangesproken — dezelfde universele "taal" die CEL, de afgeleide velden, de
berichtdefinities (`ModelPicker` levert `{typenaam, veldnaam}`) en DMN al gebruiken. Formulieren
zijn dus géén eigen naamruimte: ze verwijzen naar hetzelfde canonieke model. Dat maakt
verwijzingen uniek, herbruikbaar over representaties heen, en robuust bij hernoemen (één bron).

## 3. Plaatsing: nieuwe Studio-activiteit "Formulieren"

Registratie volgt het bestaande contract ([activityRegistry.js](../../web/vite/src/studio/activityRegistry.js)).
Sjabloon = [berichtActivity.jsx](../../web/vite/src/studio/activities/berichtActivity.jsx), want die
gebruikt al `ModelPicker` als sidebar en heeft de Provider/Sidebar/Main/Inspector-opzet.

```
web/vite/src/studio/activities/formulierActivity.jsx   ← descriptor + Provider + slots
web/vite/src/formuliereditor/                           ← nieuwe module (los van studio-schil)
  FormulierCanvas.jsx        ← Main: groepen/rijen/velden, dnd-kit reorder + nesten
  FormulierInspector.jsx     ← Inspector: eigenschappen van geselecteerd element
  useFormulierEditorStore.js ← Zustand: layout-boom + selectie + undo/redo
  layoutModel.js             ← pure helpers: normaliseer, valideer, (de)serialiseer layout_json
  layoutModel.test.js
  saveFormulierDefinitie.js  ← registratie-payload bouwen (nieuwe Layout-versie)
```

Descriptor in een **nieuwe activity-bar-groep `"presentatie"`** (rationale: dit is de
*presentatie van de data-invoer*; de data-editor zelf is een aparte, nu ongeplande activiteit —
behalve referentielijst-beheer). De WeergaveDefinitie-/tabel-editor hoort t.z.t. in dezelfde
groep. Toevoegen aan `GROEP_LABELS` in [activityRegistry.js](../../web/vite/src/studio/activityRegistry.js).

Descriptor:
- **Provider** — laadt actieve `FormulierDefinitie`s + schema; deelt editor-store via context.
- **Sidebar** — `ModelPicker` (multiselect, `expandEntiteiten`) → sleep ENT/GE/REL/veld naar canvas.
- **Main** — `FormulierCanvas` (bewerkbare boom + inline live-preview toggle).
- **Inspector** — `FormulierInspector` (label, breedte, widget, verplicht, condities).
- **menus** — "Formulier": nieuw, kies doeltype, opslaan (nieuwe versie), exporteer JSON,
  importeer JSON (plak-vlucht voor bestaande definities).

Het draait op de bestaande schema-API (`ModelPicker` krijgt `baseUrl={apiBase()}`) en op de
`FormulierDefinitie`-CRUD die er al is; geen backend-wijziging voor P1.

## 4. Layout-vocabulaire (uitbreidingen, backwards compatible)

Bestaand blijft geldig (`formulier/groep/rij/veld/conditioneel`). Toevoegingen:

### 4a. Veld-adressering: padgebaseerd (`ENT.GE.veld`)

De **kale-veldnaam-lookup vervalt als canoniek mechanisme.** GE-veldnamen zijn niet uniek over
het model, dus een `veld`-verwijzing wijst voortaan naar een **pad** — dezelfde vorm die CEL en
de afgeleide velden gebruiken, en die gegarandeerd uniek is over het model:

```json
{ "type": "veld", "veld": "NP.Naam.achternaam" }
{ "type": "veld", "veld": "NP.Partnernaam.achternaam" }
```

**Shorthand via pad-context.** Een `groep` (of de root) mag een `context` zetten; daarbinnen mag
`veld` een korter (relatief) pad zijn dat tegen die context wordt opgelost:

```json
{ "type": "groep", "label": "Naam", "context": "NP.Naam",
  "elementen": [ { "type": "veld", "veld": "achternaam" }, { "type": "veld", "veld": "voornaam" } ] }
```

Let op de nuance uit de aanleiding: GE's zijn vaak compact, dus zodra twee GE's in dezelfde
groep zitten moet je alsnog `NP.Naam.achternaam` vs `NP.Partnernaam.achternaam` voluit schrijven.
De context-shorthand is dus comfort, geen vervanging van het volle pad. De editor toont/serialiseert
altijd het opgeloste volle pad in de definitie; de context is puur invoergemak.

**Migratie huidige definities.** Bestaande layouts met kale namen (zoals het Initiatief-voorbeeld)
blijven werken via een *legacy-resolver*: bij een kale naam zonder context zoekt de runtime één
match; bij >1 match → zichtbare waarschuwing in editor + import, met voorstel het pad te kiezen.
De editor herschrijft ze bij eerste opslag naar volle paden.

### 4a-bis. Domein als primaire context — cross-domein formulieren

Het **domein** is de primaire context van modelelementen (ENT/GE/enum/gegevenstype). Een
formulier mag **cross-domein** zijn: complexe aanmeldformulieren raadplegen vaak meerdere
domeinen tegelijk — bijv. klant-domein + onderwerp-domein (bouwvergunningen) + een algemeen
geografisch domein (openbare ruimte). De editor moet dus:

- de palette (`ModelPicker`) per domein laten filteren/groeperen, maar velden uit **meerdere**
  domeinen in één definitie toelaten;
- het gekozen/betrokken domein(en) van een `FormulierDefinitie` expliciet vastleggen (nu is er
  één `doeltype`; te bezien of we naast het hoofd-`doeltype` een lijst betrokken domeinen/ENT's
  registreren voor navigatie en validatie).

**Open punt — adres-uniciteit vs. domein.** CEL/afgeleide velden adresseren nu als `ENT.GE.veld`
en leunen op globaal-unieke ENT-typenamen (de bekende `naam`-collision werd al op ENT
gedisambigueerd). Zodra ENT-namen over domeinen heen kunnen botsen, wordt het adres
`Domein.ENT.GE.veld`. We houden het adresformaat **identiek aan wat het model elders gebruikt**
(niet vooruitlopen); als het model naar domein-gekwalificeerde paden gaat, volgt de formulier-editor
automatisch. Te bevestigen bij de start van P1.

### 4a-ter. Databronnen: referentielijsten & andere passieve bronnen

Referentielijsten (en andere passieve bronnen) zijn geen invoervelden maar **keuze-bronnen**
waaruit een veld put. Een veld met `ref: "Gemeente"` hoort als keuze-widget (combobox) te
renderen — de runtime doet dit al via [RefCombobox](../../web/vite/src/components/editor/RefCombobox.jsx)
en de `/api/viz/reflijst/{type}/opties`-API. In de editor betekent dit:

- de inspector detecteert `veld.ref` en toont "keuze uit referentielijst «X»" (read-only info) +
  widget-opties (dropdown / combobox / radio bij weinig opties);
- toekomst: andere databronnen (andere entiteiten als lookup, externe lijsten) via dezelfde
  keuze-widget-abstractie. Referentielijst-*beheer* blijft een eigen `data`-activiteit; de
  formulier-editor *consumeert* ze alleen.

### 4a-quater. Meervoudigheid — herhaalbare lijst (`lijst`-element)

Een `veld` adresseert één scalar. Maar veel onderdelen zijn **meervoudig** (GE/relatie met
`momentvoorkomen: meervoudig`, bv. `Initiatief.bijdragen` `0..*`): 0..N objecten, elk met
dezelfde velden. Een enkel invoerveld klopt dan niet; je hebt een **herhaalbare sectie** nodig.
Bij een nieuw record bestaat de lijst nog niet — de invuller moet items kúnnen toevoegen.

Nieuw layout-element:

```json
{
  "type": "lijst",
  "bron": "Initiatief.bijdragen",   // pad naar het meervoudige GE/relatie
  "label": "Bijdragen",
  "min": 0, "max": null,             // cardinaliteit (null = onbegrensd)
  "elementen": [                     // template voor één item; velden RELATIEF aan de bron
    { "type": "veld", "veld": "toelichting" },
    { "type": "rij", "elementen": [
      { "type": "veld", "veld": "score", "breedte": "50%" },
      { "type": "veld", "veld": "schaal", "breedte": "50%" }
    ]}
  ]
}
```

- **Adressering binnen een lijst is relatief aan `bron`** (het item-pad), want het volle pad
  `ENT.GE.veld` adresseert de héle lijst, niet één item. Dit hergebruikt de `context`-shorthand
  uit §4a: `bron` zet de context voor de item-velden.
- **Runtime**: rendert de template per bestaand item + een "＋ toevoegen"-knop en per rij een
  verwijder-actie; bij een nieuw record start je met 0 (of 1 blanco) item. Elk item ⇒ één
  GE-instantie. De bestaande cross-GE-save groepeert al per GE; hier komt groepering **per
  item-instantie** bij (rel_id/id per rij). `EntiteitFormulier` doet dit in de *standaard*-weergave
  al (meervoudig = tabel met ＋/✎/✕); de custom renderer krijgt de equivalente lus.
- **Editor**: de palette weet de `momentvoorkomen` van elk GE (de boom toont "GE · meervoudig").
  We surfacen dat op de FieldRef; sleep je een veld uit een meervoudig GE, dan biedt de editor
  aan het in een `lijst` (gebonden aan dat GE) te wrappen. Ook een expliciete "＋ Lijst"-knop +
  `bron` kiezen in de inspector.
- **Enkelvoudig blijft** zoals nu (platte velden). De editor markeert visueel of een GE
  enkelvoudig of meervoudig is, zodat de bouwer de juiste keuze maakt.

Dit is een **P2-brok** (raakt runtime-rendering én de save-lus) en krijgt een eigen increment.

### 4b. Overige uitbreidingen

| Sleutel | Op element | Betekenis | Fase |
|---|---|---|---|
| `label` | `veld`, `groep` | Weergavelabel-override (val terug op veldnaam) | P1 |
| `veld` = pad `ENT.GE.veld` | `veld` | Canonieke, modelunieke adressering (zie 4a) | P1 |
| `context` | `groep`, root | Pad-prefix voor shorthand-`veld` binnen de groep (zie 4a) | P1 |
| `beschrijving` | `veld` | Helptekst-override | P1 |
| `conditie` (object) | `groep`, `veld`, `conditioneel` | `{ "veld": x, "op": "==|!=|leeg|nietleeg", "waarde": y }` naast de bestaande string-`als` | P1 |
| `virtueelVeld` | nieuw element | UI-only veld (checkvraag/keuze), niet in metamodel; heeft eigen `id`, `widget`, `opties` | P2 |
| `regel` | `groep`/`veld` | `{ effect: "toon"|"verberg", conditie }` — datagedreven i.p.v. losse `conditioneel`-wrapper | P2 |
| `zetWaarde` | `virtueelVeld`/`regel` | `{ doelVeld, waarde, verborgen }` — schrijf een berekende/voorgekozen waarde naar een écht DB-veld | P2 |

`layoutModel.js` valideert dit schema (JSON-schema of handmatige guard) en geeft leesbare
fouten in de editor. De runtime-renderer krijgt in P1/P2 de bijpassende leesregels.

### 4c. Invoer-widgets (raakt F40)

De `widget`-keuze op een veld bepaalt hoe het rendert; dit sluit aan op de bestaande
datatype-gedreven weergave-hints ([SchemaFormField](../../web/vite/src/components/editor/SchemaFormField.jsx)
+ DatatypeRegistry) en op [widgetOverrides.js](../../web/vite/src/components/editor/widgetOverrides.js).
Twee lagen:

- **Default per datatype**: het veldtype/datatype bepaalt de standaard-widget (bv. `LangeTekst`
  → textarea, `Bedrag` → €-prefix, `GeoPunt` → kaart-picker). Editor toont deze default; de
  gebruiker mag afwijken (jouw wens "afwijken van de default weergave op basis van veldtype").
- **Rijke widgets**: sommige datatypes verdienen een specifieke UI. Voorbeeld (F40): `GeoPunt`
  → een **kaartje waarop je een punt aanklikt** i.p.v. een lat/lon-tekstveld. We zetten hiervoor
  een **widget-register** op (naam → React-component + welke datatypes/veldtypes het aankan),
  zodat nieuwe widgets pluggable zijn zonder de renderer te wijzigen. `json`/`markdown` bestaan al
  als precedent.

In P1 leveren we de widget-*keuze* + het register-raamwerk met de bestaande widgets; rijke
widgets (geo-kaart e.d.) zijn eigen, latere increments onder F40.

## 5. Fasering

### P1 — Visuele editor (MVP), geen backend-wijziging
1. **Store + model**: `useFormulierEditorStore` (layout-boom, selectie, undo/redo via snapshots,
   analoog aan de IDE-store). `layoutModel.js` met `parse/serialize/validate/normaliseer`.
2. **Canvas**: render de boom bewerkbaar; **dnd-kit** voor herordenen binnen/tussen groepen en
   rijen; klik = selecteer; verwijderen; nieuwe groep/rij toevoegen.
3. **Sidebar-drop**: `ModelPicker`-`onPick`/drag voegt een `veld`-element toe op de
   selectie/cursorpositie. `ModelPicker` levert `{ typenaam, veldnaam }` per veld → de editor
   bouwt hieruit het **volle pad** `ENT.GE.veld` (bron van waarheid in de definitie).
4. **Inspector**: label, breedte (`50%`/`33%`/vrij), widget-keuze (hergebruik
   [widgetOverrides.js](../../web/vite/src/components/editor/widgetOverrides.js)-vocabulaire), verplicht, groep-label.
5. **Live preview**: knop/split die `CustomFormulierRenderer` met dummy-`velden` uit het
   metamodel toont — één runtime, geen tweede renderer.
6. **Renderer-uitbreiding**: `CustomFormulierRenderer` krijgt een **pad-resolver** (`ENT.GE.veld`
   → velddef + waarde) i.p.v. de kale `veldenByNaam`-lookup, met context-shorthand en
   legacy-fallback (4a); plus `label`/`beschrijving`-override en object-condities (string-`als`
   blijft werken). Consequentie in [EntiteitFormulier.jsx](../../web/vite/src/components/editor/EntiteitFormulier.jsx):
   `customVelden`/`customValues`/`veldNaarGE` worden **op pad gekeyed** i.p.v. op kale veldnaam,
   zodat de cross-GE-save `NP.Naam.achternaam` en `NP.Partnernaam.achternaam` uit elkaar houdt.
7. **Opslaan**: `saveFormulierDefinitie.js` bouwt een registratie met een nieuwe
   `FormulierDefinitie_Layout`-versie (`definitie_versie` ophogen), payload-vorm zoals in
   [het replay-voorbeeld](../../replay%20files/registraties-replay-init-formulierdefinitie-initiatief-voorbeeld.json).
   Doeltype kiezen + status/is_standaard beheren via het Formulier-menu.

**Definition of done P1**: een gebruiker sleept velden, hernoemt labels, herordent, zet een
eenvoudige conditie, ziet live-preview, en slaat op als nieuwe versie die de inhoud-editor
direct oppakt.

### P2 — Meervoudigheid, regels & virtuele/voorinvul-velden
- **Herhaalbare lijst** (`lijst`-element, §4a-quater): meervoudige GE's/relaties als
  herhaalbare sectie met ＋toevoegen/verwijderen; runtime-render + save per item-instantie;
  editor-wrap vanuit de palette. Surfacen van `momentvoorkomen` op de FieldRef.
- `virtueelVeld` (checkvraag/keuze) rendert in de runtime maar hoort niet bij een DB-veld.
- `regel { effect, conditie }` op groep/veld voor tonen/verbergen (vervangt op termijn de
  losse `conditioneel`-wrapper; die blijft leesbaar voor oude definities).
- `zetWaarde { doelVeld, waarde, verborgen }`: een antwoord vult — zichtbaar of verborgen — een
  echt veld dat via de bestaande cross-GE-save wordt weggeschreven. Verborgen doelvelden worden
  in `customEditValues` gezet zonder UI.
- Condities kunnen optioneel op de bestaande [celEvaluator](../../web/vite/src/shared/celEvaluator.js)
  draaien i.p.v. de mini-parser (uniform met afgeleide velden).

### P3 — Invul-wizard (F42)
- Stap-modus over dezelfde definitie (`stap`-element of afgeleid uit groepen); checkvragen uit P2
  als navigatie-gate. UX-referentie: SurveyJS. Aparte runtime-wrapper, zelfde definitie.

## 6. Risico's / aandachtspunten
- **Naam-collisions** over GE's: opgelost door padadressering `ENT.GE.veld` (§4a) — geen platte
  namespace meer. Aandacht: de legacy-resolver voor bestaande kale-naam-definities en de
  omschakeling van `veldNaarGE`-keying in `EntiteitFormulier` (nu op kale naam) naar pad.
- **Dubbele velden** (zoals `git_repo` in rij én conditioneel blok in de voorbeelddefinitie):
  editor moet dit signaleren, geen harde fout.
- **Versiebeheer**: elke opslag = nieuwe Layout-versie; niet elke muisbeweging. Expliciete
  "Opslaan als nieuwe versie"-actie, niet auto-save.
- **Preview-data**: preview met lege/dummy-waarden; niet aan een concreet record gebonden in P1.

## 7. Niet in scope (nu)
- Backend-schema-wijzigingen (P1 gebruikt de bestaande `FormulierDefinitie`-entiteit).
- RBAC op veld-/formulierniveau (F8), audit-weergave (F7), tijdreis-kiezer (F6).
- Vrije HTML-layout (GrapesJS-stijl) los van veld-binding.
