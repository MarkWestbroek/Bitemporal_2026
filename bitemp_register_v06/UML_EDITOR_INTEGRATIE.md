# UML Editor Integratie

Deze documentatie beschrijft hoe de losse `UML-editor` is opgenomen in `bitemp_register_v06`, hoe de frontend-routing werkt, en hoe je de subtree later kunt synchroniseren.

## Doel

De UML editor is opgenomen zodat:

- de afstemming met de schema-API directer wordt;
- frontend-code en editor-code in dezelfde applicatie kunnen draaien;
- de editor via dezelfde Go-server op poort `8082` beschikbaar is;
- het editor-project toch apart onderhoudbaar blijft via een Git subtree.

## Projectstructuur

De integratie bestaat uit twee delen:

1. De originele editor-code staat als subtree in:

   `bitemp_register_v06/uml-editor/`

2. De bestaande Vite-frontend gebruikt die code via een alias en een wrapper page in:

   `bitemp_register_v06/web/vite/`

Belangrijke bestanden:

- `uml-editor/`: subtree met de originele editor-repo
- `web/vite/editor.html`: extra HTML entry point voor de editor
- `web/vite/src/pages/EditorPage.jsx`: wrapper die de editor in de bestaande app rendert
- `web/vite/vite.config.js`: bevat de Vite alias en de extra build input
- `web/vite/src/App.jsx`: route-detectie voor `/editor` en `/editor.html`

## Waarom een subtree

De editor is niet simpelweg gekopieerd, maar als Git subtree opgenomen. Daardoor:

- blijft de editor logisch een apart project;
- kun je updates uit de editor-repo binnenhalen;
- kun je lokale wijzigingen vanuit dit repo terugpushen naar de editor-repo;
- blijft de integratie technisch simpel, zonder submodule-gedrag in de werkmap.

De subtree is toegevoegd op:

- prefix: `bitemp_register_v06/uml-editor`
- remote: `uml-editor`
- bronrepo: `https://github.com/MarkWestbroek/UML-editor.git`

## Frontend-integratie

### Vite alias

In `web/vite/vite.config.js` is een alias toegevoegd:

- `@editor` -> `../../uml-editor/src`

Daardoor kan de Vite-app editor-code importeren zonder duplicatie van bestanden.

Daarnaast is expliciet resolve-configuratie toegevoegd voor:

- `@xyflow/react`

Dat is nodig omdat de editor-code fysiek buiten `web/vite/src/` staat, terwijl de dependency wel in `web/vite/node_modules/` is geïnstalleerd.

### Extra HTML entry point

De bestaande React/Vite setup had al meerdere entry points:

- `index.html`
- `tijdlijn.html`
- `registraties.html`

Daar is aan toegevoegd:

- `editor.html`

Na build resulteert dat in een extra door Gin geserveerde pagina.

### Wrapper page

De daadwerkelijke editor wordt niet direct als zelfstandige app gestart, maar als pagina in de bestaande frontend opgenomen via:

- `web/vite/src/pages/EditorPage.jsx`

Deze wrapper importeert:

- `@editor/components/MetamodelEditor`
- `@editor/metamodel/demoData`
- `@editor/styles/editor.css`

## Routing en URLs

De Go-server gebruikt:

- `router.Static("/viz", "./web")`

Daardoor worden de gebuilde Vite-bestanden onder `web/react/` automatisch beschikbaar onder `/viz/react/`.

Voor de editor betekent dat:

- development via Vite: `http://localhost:5174/viz/react/editor.html`
- via de Go-server: `http://localhost:8082/viz/react/editor.html`

Ook de route-detectie in `web/vite/src/App.jsx` kent nu:

- `/editor`
- `/editor/`
- `/editor.html`

## Build- en runtime-model

### Development

Frontend development draait via Vite op poort `5174`.

Start in:

- `bitemp_register_v06/web/vite`

Command:

```powershell
"C:\Program Files\nodejs\npm.cmd" run dev -- --host
```

De editor gebruikt dan dezelfde Vite dev server als de andere React-pagina's.

### Productie / lokale Go-run

De Go-app serveert op poort `8082` de statische bestanden uit `web/`.

Na een build:

```powershell
"C:\Program Files\nodejs\npm.cmd" run build
```

komt de output terecht in:

- `bitemp_register_v06/web/react/`

en wordt de editor beschikbaar op:

- `http://localhost:8082/viz/react/editor.html`

## Dependency-keuze

De UML editor gebruikt:

- `@xyflow/react`

Die dependency is toegevoegd aan:

- `bitemp_register_v06/web/vite/package.json`

De editor wordt lazy-loaded in `App.jsx`. Daardoor blijft de editor in een apart chunk en worden de bestaande visualisatiepagina's niet onnodig zwaarder.

## Subtree beheer

### Eenmalig toegevoegd

De subtree is toegevoegd met:

```powershell
git remote add uml-editor https://github.com/MarkWestbroek/UML-editor.git
git fetch uml-editor
git subtree add --prefix=bitemp_register_v06/uml-editor uml-editor main --squash
```

### Updates uit de editor-repo ophalen

```powershell
git subtree pull --prefix=bitemp_register_v06/uml-editor uml-editor main --squash
```

### Lokale editor-wijzigingen terugsturen

```powershell
git subtree push --prefix=bitemp_register_v06/uml-editor uml-editor main
```

## Praktische werkwijze

Als je alleen aan de editor werkt:

- pas primair bestanden aan onder `bitemp_register_v06/uml-editor/`
- houd Vite-integratiestukken beperkt tot `web/vite/`

Als je editor en API op elkaar wilt afstemmen:

- maak editor-aanpassingen in de subtree;
- maak app/routing/build-aanpassingen in `web/vite/`;
- test vervolgens via zowel de Vite dev server als de Go-server.

## Relevante bestanden

- `bitemp_register_v06/UML_EDITOR_INTEGRATIE.md`
- `bitemp_register_v06/uml-editor/README.md`
- `bitemp_register_v06/web/vite/README.md`
- `bitemp_register_v06/web/vite/vite.config.js`
- `bitemp_register_v06/web/vite/src/App.jsx`
- `bitemp_register_v06/web/vite/src/pages/EditorPage.jsx`

---

## Interactie: edge-optimalisatie en gebiedsselectie

### Dubbelklik op een edge → kortste route

Wanneer je **dubbelklikt** op een lijn (edge) tussen twee elementen, worden de handle-posities automatisch herberekend zodat de lijn zo kort mogelijk is.

Achtergrond: elke node heeft vier aansluitpunten (handles): `top`, `bottom`, `left`, `right`. Bij het aanmaken van een edge worden de handles bepaald door waar je de lijn vandaan sleept. Maar als je daarna nodes verplaatst, kan de lijn suboptimaal lopen (bijv. van boven naar beneden terwijl de nodes naast elkaar staan).

De functie `berekenKortsteHandles()` in `MetamodelEditor.jsx` berekent voor alle 4×4 combinaties welk paar ankerpunten (rekening houdend met node-afmetingen) de kortste euclidische afstand oplevert, en past `sourceHandle` en `targetHandle` automatisch aan.

### Shift + sleep → gebiedsselectie (rubber-band)

Houd **Shift** ingedrukt en sleep op het canvas om een selectierechthoek te tekenen. Alle nodes die (deels) overlappen worden geselecteerd. Je kunt de geselecteerde nodes vervolgens als groep verslepen.

Aanvullend: **Ctrl + klik** op individuele nodes voegt ze toe aan of verwijdert ze uit de selectie.

### Rechtsklikmenu voor uitlijnen en verdelen

Wanneer **minstens 2 nodes** geselecteerd zijn, kun je met **rechtsklik** een compact contextmenu openen. Dat menu werkt zowel na **Ctrl + klik** als na **Shift + sleep** (gebiedsselectie), en mag ook geopend worden wanneer er tegelijk relaties/edges mee geselecteerd zijn. De acties worden dan **alleen op de geselecteerde nodes** toegepast; edges worden genegeerd.

Beschikbare acties:

- **Links / Centreer / Rechts** — horizontale uitlijning van de geselecteerde nodes
- **Boven / Midden / Onder** — verticale uitlijning van de geselecteerde nodes
- **Verdeel gelijk ↕ / Verdeel gelijk ↔** — verdeelt de tussenruimte gelijkmatig; deze opties verschijnen pas bij **3 of meer** geselecteerde nodes
- **Ctrl + Z** — draait de laatste canvasactie terug via een kleine undo-stack (o.a. verplaatsen, verbinden, verwijderen, uitlijnen en verdelen)
- **Ctrl + Y** of **Ctrl + Shift + Z** — zet de laatste ongedaan gemaakte canvasactie opnieuw terug

Technisch: het contextmenu is gekoppeld aan `onNodeContextMenu`, `onPaneContextMenu`, `onEdgeContextMenu` en `onSelectionContextMenu` in `MetamodelEditor.jsx`, zodat het menu ook bruikbaar blijft als React Flow naast nodes ook de selectiebox of onderliggende edges als geselecteerd markeert.

Technisch: dit zijn React Flow props op de `<ReactFlow>` component:

| Prop | Waarde | Effect |
|------|--------|--------|
| `selectionKeyCode` | `"Shift"` | Shift ingedrukt → rubber-band selectie i.p.v. canvas pan |
| `selectionMode` | `"partial"` | Nodes die deels overlappen met de selectierechthoek worden ook geselecteerd |
| `multiSelectionKeyCode` | `"Control"` | Ctrl + klik om nodes individueel bij de selectie te voegen |

### Dependency-edges tijdelijk verbergen

Voor **stippellijnen met `«use»`** (dependency-edges van GE/relatie naar enum, gegevenstype of referentielijst-item) is er nu een apart rechtsklikmenu:

- **Rechtsklik op een dependency-edge** → **`Verberg deze dependency`**
- **Rechtsklik op een enum- of gegevenstype-node** → **`Verberg dependencies`** of **`Toon dependencies`** voor alle inkomende `«use»` edges naar die node

Alleen edges met `data.isDependency === true` zijn op deze manier verbergbaar. Gewone compositie- en relatie-edges blijven dus altijd zichtbaar.

De verborgen status blijft behouden bij een **V3 roundtrip**: in de V3 JSON worden dependency-layoutgegevens opgeslagen onder `useEdges[]`, inclusief `id`, `sourceHandle`, `targetHandle` en `hidden`. Daardoor kun je een diagram opslaan, later opnieuw laden, en dezelfde dependency-edges verborgen houden.

---

## Import en Export

### Export

De editor ondersteunt drie exportformaten. Alle exports worden als bestandsdownload aangeboden via de toolbar.

| Formaat | Bestand | Knop | Doel |
|---------|---------|------|------|
| **Mermaid** | `metamodel.mmd` | 🧜 Mermaid | Class diagram syntax voor Mermaid.js |
| **PlantUML** | `metamodel.puml` | 🌱 PlantUML | Class diagram syntax voor PlantUML |
| **XMI 1.1** | `metamodel.xmi` | 📦 XMI 1.1 | UML 1.4 XMI voor Sparx Enterprise Architect e.a. |

#### XMI export met diagramposities

De XMI export bevat naast het UML-model ook een `<XMI.extension>` blok met diagramposities per element in EA-compatibel formaat:

```xml
<XMI.extension extender="UML-editor">
  <diagrams>
    <diagram>
      <elements>
        <element subject="EAID_node_1" left="150" right="330" top="-50" bottom="-170"/>
      </elements>
    </diagram>
  </diagrams>
</XMI.extension>
```

De coördinaten gebruiken EA's conventie: `left`/`right` zijn X-bereik, `top`/`bottom` zijn Y-bereik met negatieve waarden (EA's scherm-Y is omgekeerd).

### Import

De editor kan ook modellen **importeren** uit de drie formaten. Importknoppen staan in de toolbar naast de exportknoppen.

| Formaat | Knop | Bestandstypen |
|---------|------|---------------|
| **XMI** | 📥 XMI | `.xmi`, `.xml` |
| **Mermaid** | 📥 Mermaid | `.mmd`, `.md`, `.txt` |
| **PlantUML** | 📥 PlantUML | `.puml`, `.plantuml`, `.txt` |

> **Let op**: import vervangt het huidige model volledig. Sla het huidige model eerst op als je het wilt bewaren.

#### XMI import

De XMI importer (`uml-editor/src/import/importXMI.js`) ondersteunt:

- `UML:Class` met stereotype → entiteit / gegevenselement / relatie
- `UML:Class` met `<<enumeration>>` → enumeratie
- `UML:DataType` → gegevenstype
- `UML:AssociationClass` → relatie-node met twee edges naar de participerende entiteiten
- `UML:Association` → edge met rolnaam, kardinaliteit en momentvoorkomen
- `UML:Dependency` → dependency-edge (stippellijn met `<<use>>`)
- **EA diagramposities**: als het XMI-bestand een EA extensie-blok bevat met `<element subject="..." left/right/top/bottom>` of `<DiagramElement>` met geometry-strings, worden de posities uitgelezen en toegepast op de nodes

#### Mermaid import

De Mermaid importer (`uml-editor/src/import/importMermaid.js`) ondersteunt:

- `class Foo { <<entiteit>> ... }` → node met stereotype-bepaling
- Velden met `+type naam` (verplicht) of `-type naam` (optioneel)
- Enum-waarden (regels zonder marker in een `<<enumeration>>` blok)
- Relaties: `Foo --> Bar : label`, `Foo "1" --> "0..*" Bar : label`
- Dependencies: `Foo ..> Bar` (stippellijn)

#### PlantUML import

De PlantUML importer (`uml-editor/src/import/importPlantUML.js`) ondersteunt:

- `class Foo <<entiteit, materieel>> { ... }` → node met metatype en materialiteit
- `enum Foo { ... }` → enumeratie
- `class Foo <<datatype>> { ... }` → gegevenstype
- Velden: `+ naam : type` (verplicht) of `- naam : type` (optioneel)
- Relaties: `Foo "1" --> "0..*" Bar : label`
- Dependencies: `Foo ..> Bar` (stippellijn)

### Import/export bestanden

| Bestand | Doel |
|---------|------|
| `uml-editor/src/export/exportMermaid.js` | Editor → Mermaid class diagram |
| `uml-editor/src/export/exportPlantUML.js` | Editor → PlantUML class diagram |
| `uml-editor/src/export/exportXMI.js` | Editor → XMI 1.1 (incl. diagramposities) |
| `uml-editor/src/import/importXMI.js` | XMI 1.1 → Editor (incl. EA diagramposities) |
| `uml-editor/src/import/importMermaid.js` | Mermaid class diagram → Editor |
| `uml-editor/src/import/importPlantUML.js` | PlantUML class diagram → Editor |
