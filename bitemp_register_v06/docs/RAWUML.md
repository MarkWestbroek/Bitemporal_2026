# RawUML — neutraal tussenformaat voor UML-import

> Status: actief, sinds 2026-04-26.
> Plek in de code: [`web/vite/src/umleditor/import/rawuml.js`](../web/vite/src/umleditor/import/rawuml.js).

RawUML (= "raw UML") is het syntactisch ruwe tussenformaat tussen de
tekstuele UML-bronnen die de editor inleest (Mermaid, PlantUML) en de
editor-shape die React Flow gebruikt (`{nodes, edges}`).

Dit document beschrijft het waarom, het formaat, het conversieproces, de
post-import-laag (orphan-detectie) en waarom XMI bewust een eigen pad volgt.

---

## 1. Waarom een tussenformaat?

Vóór de refactor produceerde elke importer (Mermaid, PlantUML, XMI) direct de
editor-shape: nodes met `id`, `type`, `data.kleur`, `data.metatype`, `position`
en edges met `data.isAssociation`, `data.isAssociationClassLink`, etc.

Dat had drie problemen:

1. **Drie keer dezelfde interpretatie.** Stereotype-mapping
   (`<<entiteit>>` → `metatype: "entiteit"`), kleurkeuze
   (`defaultKleur(metatype)`), generalisatie-richting omdraaien (kind → ouder),
   ID-generatie en de "auto-aanmaken ontbrekende doel-node"-logica leefden in
   elk van de drie parsers, soms net iets anders. Bug-fixes hadden de neiging
   maar in één parser door te dringen.

2. **Geen gedeeld punt voor post-processing.** Orphan-detectie (een GE zonder
   parent-entiteit) werkte ná de conversie naar editor-shape. Goed, maar het
   herstellen ervan (placeholder-aanmaak, skip, abort) moest opnieuw
   editor-conventies kennen.

3. **Parsers waren te dik.** De Mermaid-parser had 309 regels, de PlantUML 335,
   en het grootste deel daarvan was *editor-conversie*, niet syntax-parsing.

RawUML splitst dat op. Het is een **dunne, name-gebaseerde** structuur die
dichter bij wat de bronnen kunnen leveren staat dan bij wat de editor wil.

---

## 2. Filosofie

Dichter bij de bron dan bij de editor:

- **Referenties via `naam` (string), niet via ID.** Mermaid en PlantUML kennen
  geen stabiele IDs. RawUML laat dit zo.
- **`stereotypes[]` blijft een lijst lowercase-strings** (zonder `<<>>`). Het
  mappen naar een `metatype` is een interpretatie-stap, geen parsing-stap.
- **`kardinaliteit` / `rol` blijven losse strings** (`"0..*"`, `"owner"`). De
  adapter normaliseert ze naar een `momentvoorkomen` (`"enkelvoudig"` /
  `"meervoudig"`).
- **Posities zijn optioneel.** Alleen XMI/EA levert ze; Mermaid/PlantUML
  krijgen een gridpositie van de adapter.
- **Edges hebben een `soort`** (associatie, compositie, aggregatie,
  generalisatie, dependency) die rechtstreeks uit de pijl-syntax komt.
  Interpretatie naar editor-edges (zoals "compositie wordt een metamodel-edge
  met `data.isCompositie: true`", "generalisatie-richting omdraaien") gebeurt
  in de adapter.

Wat RawUML **níet** bevat:

- Geen editor-IDs (de adapter genereert die met `generateId(...)`).
- Geen `data.kleur` / `data.metatype` (afgeleid uit stereotypes in de adapter).
- Geen `associatieAnker`-nodes (puur editor-concept).
- Geen `isAssociation` / `isAssociationClassLink` edge-flags.
- Geen V3-export-velden (`weergaveVeld`, `goType`, etc.).

---

## 3. Het formaat

### 3.1 RawUMLModel

```ts
type RawUMLModel = {
  nodes:        RawUMLNode[];
  edges:        RawUMLEdge[];
  bronFormaat:  "mermaid" | "plantuml" | "xmi";
  waarschuwingen?: string[];   // niet-fatale parse-meldingen
};
```

### 3.2 RawUMLNode

```ts
type RawUMLNode = {
  naam:         string;                       // referentie-key in edges
  stereotypes:  string[];                     // lowercase, zonder <<>>
  taggedValues?: Record<string, string>;      // bv. { "bitemp::metatype": "rel" }
  velden?:      RawUMLVeld[];                 // entiteit/GE/relatie/datatype
  enumWaarden?: string[];                     // alleen voor enumeraties
  description?: string;
  positie?:     { x: number; y: number };     // optioneel; XMI/EA levert dit
  bronId?:      string;                       // originele ID (XMI xmi.id)
};
```

### 3.3 RawUMLVeld

```ts
type RawUMLVeld = {
  naam:           string;
  type?:          string;     // ruw type-token uit bron: "int", "Datum", "string", ...
  format?:        string;     // optioneel format-hint: "date"
  isAfgeleid?:    boolean;
  defaultWaarde?: string;
  verplicht?:     boolean;    // true voor `+` (public), anders false
};
```

### 3.4 RawUMLEdge

```ts
type RawUMLEdgeSoort = "associatie" | "compositie" | "aggregatie" | "generalisatie" | "dependency";

type RawUMLEdge = {
  bronNaam:           string;
  doelNaam:           string;
  soort:              RawUMLEdgeSoort;
  bronKardinaliteit?: string;       // "1", "0..*", "1..*"
  doelKardinaliteit?: string;
  bronRol?:           string;
  doelRol?:           string;
  label?:             string;       // edge-label uit `: ...`
  directioneel?:      boolean;
};
```

> **Conventie voor generalisatie:** in een RawUMLEdge met
> `soort: "generalisatie"` is `bronNaam` altijd het *kind* en `doelNaam` altijd
> de *ouder*. De parsers zorgen voor deze normalisatie.

---

## 4. Conversiepijplijn

```
Mermaid-tekst          ──┐
PlantUML-tekst         ──┼──> RawUMLModel ──> rawUMLNaarEditor() ──> { nodes, edges }
                                                                          │
                                                                          ▼
                                                          detecteerOrphans() + orphan-dialoog
                                                                          │
                                                                          ▼
                                                                  pasOrphanActiesToe()
                                                                          │
                                                                          ▼
                                                          editor (React Flow + V3-export)
```

### 4.1 Parsers (`mermaidNaarRaw`, `plantumlNaarRaw`)

Beide parsers doen alleen wat hun bron uniek maakt:

- comment-stripping en directief-skip (`@startuml`, `skinparam`, `%%`)
- block-grenzen (`class Foo {` / `}`)
- pijl-tokenisatie (`*--`, `<|--`, `..>`)
- veld-regex per bron-syntax

Beide produceren een `RawUMLModel` met `bronFormaat`. Geen IDs, geen kleuren,
geen positie-keuze, geen edge-flags.

### 4.2 De adapter (`rawUMLNaarEditor`)

Eén plek waar editor-conventies worden toegepast:

1. **Stereotype-resolutie** per node via `mapStereotypesNaarMeta`
   ([`_helpers.js`](../web/vite/src/umleditor/import/_helpers.js)). Onbekende
   stereotypes vallen terug op metatype `"entiteit"`. De
   `bitemp::metatype`-tagged-value wordt mee-aangeboden aan de resolver.

2. **Node-type-keuze**: enumeratie / gegevenstype / referentielijst-instantie
   / entiteit / gegevenselement / relatie. De juiste velden voor het type
   worden samengesteld (`waarden` voor enums, `basistype` voor datatypes,
   `velden` voor de rest).

3. **ID-generatie + naam→id-map.** Edges in RawUML refereren via naam; hier
   worden ze omgezet naar editor-IDs.

4. **Auto-positie**: een gridpositie als de bron geen positie levert.
   Bron-posities (XMI/EA) worden gerespecteerd.

5. **Edge-conversie**:
   - `generalisatie` → `data.isGeneralization`, richting kind → ouder
   - `dependency` → `data.isDependency`
   - `associatie` / `compositie` / `aggregatie` → standaard metamodel-edge
     met `rolnaam`, `kardinaliteit`, `momentvoorkomen` (en optioneel
     `isCompositie` / `isAggregatie`)

6. **Auto-aanmaken ontbrekende doel-nodes**: als een edge naar een naam
   verwijst die niet als top-level RawUMLNode is gedeclareerd, krijgt die naam
   een entiteit-placeholder.

Bewust **niet** gedaan: ASOC-promotion van directe entiteit↔entiteit-edges.
Een veldloze associatieklasse mag in dit model één bubble blijven; pas als de
gebruiker er expliciet velden op zet, promoot de editor zelf via de
ASOC-conversie in [`DiagramCanvas.jsx`](../web/vite/src/ide/DiagramCanvas.jsx).

---

## 5. Orphan-detectie & herstel

Na de conversie naar editor-shape kunnen er nog "wezen" overblijven: een GE
of relatie die geen parent-entiteit heeft binnen het geïmporteerde model. De
helpers in `rawuml.js` werken hier op:

### 5.1 `detecteerOrphans({ nodes, edges })`

- **GE-orphan**: geen edge die hem als compositie-target vanuit een
  entiteit-node noemt (dependency en generalisatie tellen niet).
- **Relatie-orphan**: geen edge naar een entiteit of associatieAnker.

Returnt `Array<{ nodeId, type, naam, reden }>`.

### 5.2 `pasOrphanActiesToe(graaf, orphans, keuzes)`

`keuzes` is een `Map<nodeId, "placeholder" | "overslaan" | "abort">`.

- **`placeholder`**: gele entiteit-node `Placeholder_<naam>` aangemaakt en
  gekoppeld. Voor relaties worden zowel een bron- als een doel-placeholder
  gemaakt.
- **`overslaan`**: orphan-node + alle aangrenzende edges verwijderd.
- **`abort`**: gooit `Error` met `code: "ORPHAN_ABORT"`. Aanroepende code
  moet de hele import afbreken.

Aborts worden eerst gedetecteerd, vóór mutaties — zo blijft de graaf bij
afbreking schoon.

UI-laag: [`OrphanDialog.jsx`](../web/vite/src/umleditor/components/OrphanDialog.jsx)
in de editor-v2, en de inline orphan-dialoog in
[`ImportDialog.jsx`](../web/vite/src/ide/ImportDialog.jsx) in de IDE.

---

## 6. Waarom XMI buiten RawUML blijft

XMI 1.1 (Enterprise Architect) is structureel rijker dan Mermaid en PlantUML,
en heeft genoeg eigen specials dat een tussenstap waarde verliest:

- **Stabiele `xmi.id`s.** De bron is al een echte graaf — RawUML's
  name-based referenties zouden het werk *moeilijker* maken (we zouden weer
  `bronId → naam → bronId` heen-en-weer moeten mappen).
- **EA's `AssociationClass`-patroon** bestaat uit een `Class` + een
  `Association` met `conID`-tagged-value. Dat mapt 1-op-1 op het editor-
  anker-patroon (anker + REL + drie edges). Een tussenstap zou dit alleen
  maar ingewikkelder maken.
- **MIM tagged values** (`Indicatie materiële historie`,
  `Heeft tijdlijn geldigheid`, `isAbstract`, …) hebben EA-specifieke namen
  met directe editor-equivalenten. Generaliseren naar RawUML's
  `taggedValues<string,string>` zou geen winst opleveren.
- **EA-extensie-elementen leveren posities.** Die willen we direct
  doorgeven; in RawUML is `positie` optioneel, maar voor XMI is het standaard.

Daarom houdt [`importXMI.js`](../web/vite/src/umleditor/import/importXMI.js)
zijn eigen pad. De orphan-helpers (`detecteerOrphans`, `pasOrphanActiesToe`)
werken wél op XMI-imports omdat ze op de editor-shape opereren — ná
conversie. Voor de gebruiker is het orphan-gedrag dus identiek over alle drie
de bronnen.

---

## 7. Bestand-overzicht

| Bestand | Rol |
|---|---|
| [`rawuml.js`](../web/vite/src/umleditor/import/rawuml.js) | RawUML-spec (JSDoc), `rawUMLNaarEditor` adapter, `detecteerOrphans`, `pasOrphanActiesToe` |
| [`_helpers.js`](../web/vite/src/umleditor/import/_helpers.js) | `mapStereotypesNaarMeta`, `promoteEntiteitAssociaties` (alleen handmatig gebruikt) |
| [`importMermaid.js`](../web/vite/src/umleditor/import/importMermaid.js) | `mermaidNaarRaw` (pure parser) + `importVanMermaid` (= adapter) |
| [`importPlantUML.js`](../web/vite/src/umleditor/import/importPlantUML.js) | `plantumlNaarRaw` (pure parser) + `importVanPlantUML` (= adapter) |
| [`importXMI.js`](../web/vite/src/umleditor/import/importXMI.js) | XMI-importer met EA/MIM-specifieke logica (eigen pad) |

---

## 8. Verdere richting

- **`xmiNaarRuw`-adapter (optioneel)**: een dunne wrapper die XMI-output naar
  RawUML mapt voor analyse-doeleinden (orphan-rapportage, statistieken).
  Niet nodig voor de import-flow zelf.
- **`ruwUMLNaarMermaid` / `ruwUMLNaarPlantUML`**: pure exporters voor
  roundtrip-tests. Maakt het mogelijk om `mermaidNaarRaw → ruwUMLNaarMermaid`
  als zelftest te draaien.
- **Validatie-laag**: een `valideerRawUML(model)` die controleert op
  duplicaat-namen, ongeldige stereotype-combinaties (`<<entiteit, ge>>`),
  enz. Komt los te staan van de adapter — adapter blijft ruw, validatie
  rapporteert.
