# Driehoek Proces – Regels – Data: één canoniek model als naaf

Dit document beschrijft een UI- en formaatvoorstel om **processen (BPMN)**,
**beslisregels (DMN)** en **data (canoniek metamodel)** tot één samenhangend
geheel te maken, waarin álle data die door regels en processen stroomt
herleidbaar is tot velden uit het canoniek model (MetaRegistry / V3 JSON).

Aanleiding: Ritense/Valtimo heeft een eigen BPMN-editor op bpmn.io gebouwd
([github.com/creatoratnight/bpmn-modeler](https://github.com/creatoratnight/bpmn-modeler),
demo op [designer.valtimo.nl](https://designer.valtimo.nl/)) — een bewust
uitgeklede bpmn-js editor. De Valtimo Designer toont maar één start-, één
intermediate- en één eindevent: geen message/signal-events. Dat is een
keuze in palette + properties-panel, **niet** een beperking van bpmn-js.

---

## 1. Uitgangspunt: het canoniek model is de naaf, niet een vierde editor

De driehoek werkt alleen als alle editors **dezelfde type-provider** delen:
de MetaRegistry + schema-API (`/api/schema/model`, V3 JSON). DMN-inputs,
proces-berichten en token-variabelen worden **gebonden** aan velden in plaats
van vrij ingetypt.

```mermaid
flowchart TB
    MM[(Canoniek model<br/>MetaRegistry / V3 JSON<br/>velden, afgeleide velden, enums, datatypes, bitemp-dimensies)]
    subgraph Editors
        UML[UML / Data-editor<br/>definieert velden]
        DMN[DMN-editor<br/>input/output = veldreferenties]
        BPMN[BPMN-editor<br/>events/token = berichttypen]
    end
    MM -- "type-provider (ModelPicker)" --> DMN
    MM -- "type-provider (ModelPicker)" --> BPMN
    UML -- "publiceert velden" --> MM
    DMN -. "ad-hoc output wordt<br/>kandidaat afgeleid veld" .-> MM
```

---

## 2. Kan bpmn-js message/signal-events aan?

Ja. `bpmn-js` (de engine achter zowel de Camunda Modeler als de Valtimo
Designer) ondersteunt volledig:

- `bpmn:Message` + `MessageEventDefinition` (start / catch / throw)
- `bpmn:Signal` + `SignalEventDefinition`
- timer, error, escalation, conditional event definitions

Wat de Valtimo Designer toont is een uitgekleed palette. Met een custom
**replace-menu entry** + een **custom properties-provider** zet je message/
signal-events er gewoon bij. Dat is precies het haakje dat nodig is om data
het proces in/uit te laten lopen in metamodel-termen.

---

## 3. Drie nieuwe concepten in het metamodel-formaat

Alles wat nu "los" is (DMN-kolomnaam, proces-variabele, message-payload)
wordt een **verwijzing naar het canoniek model**:

| Concept | Wat het is | Waar gebruikt |
|---|---|---|
| **Veldreferentie** (`FieldRef`) | Pointer `{typenaam, veldpad, t-dimensie}` naar een primair óf afgeleid veld | DMN-inputs, proces-variabelen, condition-expressions |
| **Berichttype** (`MessageType`) | Benoemde **projectie/view** over het canoniek model: een geordende bundel veldreferenties (MIM-conform: subset/aggregatie van objecttypen + attribuutsoorten) | Message-events, signals, token-payload |
| **Procescontract** | Input-berichttype + output-berichttype van een proces (en per CallActivity) | BPMN proces-niveau, koppelvlak-documentatie |

Het **Berichttype** is het scharnier dat nu nog ontbreekt. Een message-event
"eet" geen losse velden maar een berichttype, en een berichttype is per
definitie een view over het canoniek model. Daarmee is álle data die een
proces in- of uitgaat herleidbaar tot metamodel-velden.

---

## 4. UI-voorstel

### 4.1 Gedeeld: de Model Picker (één component, overal)

Een herbruikbaar React-paneel gevoed door de schema-API:

- **Boom**: Domein → Entiteit → GE → Veld
- Per veld een **badge**: primair / afgeleid (oranje `/`, zoals de UML-editor
  al doet), datatype, enum, en de **bitemporele dimensie** (formeel `t_f` /
  materieel `t_m`)
- Zoekbaar, en **drag-source**: sleep een veld in een DMN-kolom, een
  message-veld of een proces-variabele

Dit ene component verschijnt als lade in alle drie de editors — één
samenhangende wereld.

### 4.2 DMN-editor: inputs/outputs binden i.p.v. typen

```mermaid
sequenceDiagram
    actor U as Modelleur
    participant DMN as DMN-editor
    participant MP as Model Picker
    participant API as schema-API
    U->>DMN: klik "+ input clause"
    DMN->>MP: open picker
    MP->>API: GET /api/schema/model
    API-->>MP: typen + velden + enums
    U->>MP: kies NatuurlijkPersoon.leeftijd (afgeleid)
    MP-->>DMN: FieldRef + datatype=integer + t-dimensie
    DMN->>DMN: kolomtype/allowed-values auto-ingevuld
```

- **Input-clause**: knop "Bind veld" → Model Picker → kolom krijgt
  `typenaam.veldpad`, datatype en (bij enums) toegestane waarden komen
  **automatisch** uit het metamodel. Geen handmatige FEEL-typefouten.
- **Bitemporele keuze** per input: lees je het veld op het **formele**
  peiltijdstip van de registratie of op een **materieel** peilmoment? Klein
  dropdownetje op de clause.
- **Output-clause**: twee opties — (a) **bind aan bestaand veld** (primair of
  afgeleid), of (b) markeer als **ad-hoc tussenresultaat**. Bij (b): één klik
  "promoveer tot afgeleid veld" → teruggeschreven naar het canoniek model als
  afgeleid veld met de DMN als regelbron. Zo lekt data nooit buiten het model.

### 4.3 BPMN-editor: getypeerde events + token-contract

Drie uitbreidingen op het Valtimo/bpmn-js palette:

1. **Getypeerde events**: message-start, message-catch/throw, signal. Elk
   event-property-panel heeft een veld **"Berichttype"** → Model Picker /
   Berichttype-kiezer.
2. **Berichttype-editor** (nieuw, klein): stel een bericht samen als
   projectie over het metamodel — vink velden/subtrees aan (bv.
   `NatuurlijkPersoon.bsn`, `...namen.achternaam`, `bereikbaarheid.locatie_id`).
   Resultaat is een herbruikbaar, MIM-conform berichttype.
3. **Proces-data-contract paneel** (op proces/pool-niveau): **Input-** en
   **Output-berichttype**. Hetzelfde paneel verschijnt op een CallActivity,
   zodat `camunda:in`/`camunda:out` niet meer met `variables="all"` hoeft maar
   **per veld getypeerd** mapt — dat had het `Plaats`-kolom-incident voorkomen.

```mermaid
flowchart LR
    subgraph BPMN-canvas
        S((Message start<br/>Berichttype: InwonerAanmelding)) --> ST[Service task]
        ST --> G{DMN gateway}
        G --> E((Message end<br/>Berichttype: RegistratieBevestiging))
    end
    S -. "payload-velden" .-> MM[(Canoniek model)]
    E -. "payload-velden" .-> MM
    G -. "inputs = FieldRefs" .-> MM
```

### 4.4 Driehoek-view: lineage als vierde scherm

Een read-only overzicht dat de cirkel rond maakt:

- Kies een **veld** → zie welke **DMN-regels** het lezen/schrijven en welke
  **processtappen/berichten** het raken.
- Kies een **processtap** → zie welke DMN's worden aangeroepen en welke velden
  in/uit gaan.

Puur afgeleid uit de FieldRefs/Berichttypen, dus "gratis" zodra de binding
bestaat.

---

## 5. Opslag: uitbreiding van V3 JSON

Eén formaat, drie toevoegingen:

- `berichttypen[]`: naam + lijst veldreferenties (projectie)
- Op DMN-artefacten: `inputs[].fieldRef`, `outputs[].fieldRef | adhoc`
- Op BPMN: per message/signal-event een `berichttypeRef`; op proces/
  CallActivity een `contract {inputRef, outputRef}`

Omdat BPMN/DMN hun eigen XML hebben, leg je de binding vast als
**extensionElements** (`<canoniek:fieldRef typenaam=... veldpad=... t=...>`),
net zoals Camunda dat met `camunda:` doet. Zo blijft het bestand een geldig
BPMN/DMN-bestand én metamodel-gekoppeld.

```mermaid
classDiagram
    class FieldRef {
        +string typenaam
        +string veldpad
        +string t_dimensie  // formeel | materieel
        +bool afgeleid
    }
    class Berichttype {
        +string naam
        +FieldRef[] velden
    }
    class Procescontract {
        +Berichttype input
        +Berichttype output
    }
    class DMNInput {
        +FieldRef fieldRef
    }
    class DMNOutput {
        +FieldRef fieldRef
        +bool adhoc
    }
    Berichttype "1" o-- "*" FieldRef
    Procescontract "1" o-- "1" Berichttype : input
    Procescontract "1" o-- "1" Berichttype : output
    DMNInput --> FieldRef
    DMNOutput --> FieldRef
```

---

## 6. Fasering

```mermaid
flowchart LR
    F1[1. Model Picker<br/>op schema-API] --> F2[2. DMN-input binding]
    F2 --> F3[3. Berichttype-concept<br/>in V3 JSON + editor]
    F3 --> F4[4. bpmn-js message/<br/>signal-events aan]
    F4 --> F5[5. Procescontract +<br/>getypeerde CallActivity]
    F5 --> F6[6. Lineage-view]
```

1. **Model Picker** als losse React-component op de schema-API — laagste
   risico, direct nut.
2. **DMN-input binding** — grootste, snelste winst: DMN ráákt per definitie
   velden.
3. **Berichttype-concept** in V3 JSON + simpele Berichttype-editor.
4. **bpmn-js message/signal-events** aanzetten + Berichttype-property.
5. **Procescontract** + getypeerde CallActivity-mapping.
6. **Lineage-view**.

---

## 7. Aanbeveling

Begin bij stap 1+2: één gedeelde Model Picker en DMN-inputs die binden aan
velden. Dat bewijst het principe ("data kan niet bestaan buiten het canoniek
model") met minimale code en levert meteen waarde. Het Berichttype-concept is
daarna de sleutel die processen net zo strak aan het model bindt als DMN — en
dat is precies wat Valtimo/Camunda standaard níét bieden. Daar zit de
onderscheidende kracht van de canoniek-model-aanpak.

---

## 8. Implementatiestatus

Voortgang ten opzichte van de fasering in §6:

| Stap | Status | Locatie |
|---|---|---|
| 1. Model Picker op schema-API | ✅ klaar | `web/vite/src/modelpicker/` |
| 2. DMN-input/output binding | ✅ klaar | `web/vite/src/dmn/` |
| 3. Berichttype-concept (V3 JSON + editor) | ⬜ open | — |
| 4. bpmn-js message/signal-events | ⬜ open | — |
| 5. Procescontract + getypeerde CallActivity | ⬜ open | — |
| 6. Lineage-view | ⬜ open | — |

### 8.1 Stap 1 — Model Picker (klaar)

Herbruikbaar React-component dat het canoniek model uit de schema-API
(`/api/schema/model/code`) als boom toont (Domein → Entiteit → GE → Veld).

- **Bestanden** (in `bitemp_register_v06/web/vite/src/modelpicker/`):
  - `useSchemaModel.js` — fetch-hook (`baseUrl` of `injectedTypes`).
  - `modelTree.js` — pure logica: `bouwModelTree`, `filterTree`,
    `maakFieldRef`, `fieldRefKey`.
  - `ModelPicker.jsx` — boom, zoeken, t_f/t_m-toggle, afgeleide-velden,
    drag-source (MIME `application/x-canoniek-fieldref`, geëxporteerd als
    `FIELDREF_MIME`), enkel/multi-select.
  - `modelpicker.css` — `.mp-`-geprefixte stijlen (afgeleid veld = oranje `/`
    + cursief).
  - `index.js` — barrel-export.
  - `modelTree.test.js` — 7 unit-tests (alle groen).
- **FieldRef-contract**: `{typenaam, veldnaam, veldpad, entiteit, datatype,
  type, format, enum[], ref, afgeleid, tDimensie}` waarbij `tDimensie` =
  `formeel` (t_f) of `materieel` (t_m).
- **Demo**: route `/modelpicker` (`pages/ModelPickerDemoPage.jsx`).

### 8.2 Stap 2 — DMN-binding (klaar)

DMN-beslistabel waarvan input/output-kolommen binden aan FieldRefs uit het
canoniek model. Bewijst het kernprincipe: **data kan niet bestaan buiten het
canoniek model**.

- **Bestanden** (in `bitemp_register_v06/web/vite/src/dmn/`):
  - `dmnModel.js` — pure beslistabel-logica. `bindInput`/`bindOutput`
    kopiëren automatisch `type`/`datatype`/`enum` uit de FieldRef.
    `valideerTabel` dwingt af dat ongebonden, niet-ad-hoc kolommen een
    **fout** zijn. `adhocNaarAfgeleidVeldVoorstel` promoveert een ad-hoc
    output naar een afgeleid-veld-voorstel (taal `dmn`).
  - `DmnTableEditor.jsx` — controlled editor; kolommen binden via drop op de
    kop óf "bind…"-knop; enum-cellen worden dropdowns met metamodel-waarden;
    ad-hoc outputs zijn promoveerbaar tot afgeleid veld.
  - `dmntable.css` — `.dmn-`-geprefixte stijlen.
  - `index.js` — barrel-export.
  - `dmnModel.test.js` — 10 unit-tests (alle groen).
- **Demo**: route `/dmn-demo` (`pages/DmnEditorDemoPage.jsx`) — links de
  Model Picker, rechts de beslistabel + JSON-output met zichtbare binding.

### 8.3 Wiring & draaien

- Routes geregistreerd in `web/vite/src/App.jsx` (`/modelpicker`,
  `/dmn-demo`) en als build-entrypoints in `vite.config.js`
  (`modelpicker.html`, `dmn-demo.html`).
- Draaien: VS Code-task **`vite: dev server (v06)`** (Vite op `:5174`, Go API
  op `:8082`); open `/modelpicker` of `/dmn-demo`.
- Tests: vanuit `web/vite/` → `node --test src/modelpicker/modelTree.test.js`
  en `node --test src/dmn/dmnModel.test.js`.

---

## Referenties

- [process_engine_v01/docs/ontwerp.md](ontwerp.md) — huidige worker-architectuur
- [process_engine_v01/docs/CONTRACTEN.md](CONTRACTEN.md) — procesvariabele-contract
- bpmn-js: [github.com/bpmn-io/bpmn-js](https://github.com/bpmn-io/bpmn-js)
- Valtimo bpmn-modeler: [github.com/creatoratnight/bpmn-modeler](https://github.com/creatoratnight/bpmn-modeler)
