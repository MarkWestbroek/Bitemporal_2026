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
