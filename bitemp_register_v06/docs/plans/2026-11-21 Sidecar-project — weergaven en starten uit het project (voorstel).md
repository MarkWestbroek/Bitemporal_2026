# Sidecar-project — weergaven en starten uit het project (voorstel)

Stand 21-11 (nacht, OMNIUM-UI). Vervolg op BACKLOG PROF-1 en TRANSFORMATIES.md §9.5. Wat hier
staat is een voorstel met vragen voor Mark; er is niets van gebouwd.

## 1. Waar we staan

| Stap | Stand |
|---|---|
| (a) ontwerptaal = M3 | gebouwd 20-11 (`studio/activities/ontwerptaal.js`) |
| (b) rondreis exact | gebouwd 20/21-11: meetlat 0, ook code (code op id, `diagramcore/types/codeRegister.js`) en volgorde |
| (c) sidecar-project | gebouwd 21-11: export, taal *Profiel (M3)* in Modelleren |
| (d) laden uit het project | eerste deel 21-11 (opt-in menu-actie); de tool start nog uit de code |
| weergaven in het project | open, dit voorstel |
| (e) projectbrowser in Profielen en Transformaties | open |

Bewezen: alle 27 profielen uit het sidecar-project laden geeft dezelfde tool (zelfde vingerafdruk,
zelfde objecten; `render-svc/sidecarLaden.test.mjs`).

## 2. De weergaven

Mark 19-11: "we vergeten nog de weergaven: moeten die dan niet ook in het sidecar project landen?"
en "de svg's moeten dan in het project zitten (stap 2)".

Gemeten over de 27 profielen: **73 vormen** (ShapeType-id's) en **179 iconen** in gebruik.

Wat er al is:

- **Vormen** zijn sinds "één tekenaar" (04-11) gegevens: een ShapeType = `{id, renderer, parameters,
  minMaat}` op een kleine set renderers (code). 20 profielbestanden registreren ze
  (`diagramprofielen/*/vormen.js`). Het M3 kent ShapeType al (pakket Stijl), en
  `DiagramType.shapeTypes` staat al in de ontwerptaal (als JSON). Er zijn ook **data-vormen**
  (`web/vite/vormen/*.json`, renderer `data-vorm`), te maken in Studio-instellingen → Eigen vormen.
- **Iconen** zijn React-componenten (10 bestanden met `registreerTypeIcoon`). Er zijn ook
  **data-iconen**: een SVG-tekst (`web/vite/iconen/*.json`, `dataIcoon.jsx`), te maken in
  Studio-instellingen → Eigen iconen.

Voorstel, in twee delen:

1. **Vormen**: de ShapeTypes die een profiel gebruikt, gaan als gegevens mee in het project (de
   renderer op id, zoals de hooks). Dat is klein werk: de vorm-registry levert ze, het M3 beschrijft
   ze al. Een vorm die meerdere profielen delen, staat één keer in het project (een map *Vormen*).
2. **Iconen**: elk ingebouwd icoon eenmalig omzetten naar een data-icoon (SVG-tekst), met
   `renderToStaticMarkup` in render-svc, en die in het project zetten (een map *Iconen*). Daarna zijn
   ingebouwde en eigen iconen hetzelfde soort ding, en kan een klant zijn eigen iconenset meekrijgen.

**Vraag 1.** Een icoon of vorm als **element in het project** (een eigen taal "Weergave", met een
voorbeeld op het canvas), of als **bijlage van het project** (een lijst naast de modellen, zoals de
marks)? Mijn voorkeur: een element, dan reist het mee met sync, historie en branches zonder nieuw
mechanisme, en zie je het.

**Vraag 2.** Moeten de ingebouwde iconen echt **uit de code**, of is "in het project, met de code als
reserve" genoeg? Dat laatste is minder werk en houdt de tool bruikbaar zonder sidecar-project.

## 3. Starten uit het project

Nu start de tool met de profielen uit de code; *Laad de profielen uit dit project in de tool* zet er
een project overheen tot een herlaad.

**Vraag 3.** Waar woont het sidecar-project van een instantie?

- (a) **als project op de server** (app), met een vaste id: bij het opstarten haalt de Studio het op
  en laadt het, vóór de rest. Een instantie zonder dat project valt terug op de code.
- (b) **als bestand bij de build** (zoals `web/vite/profielen/*.json` nu): meegebakken, geen
  server nodig; wijzigen = een nieuwe build.
- (c) beide: het bestand als standaard, het serverproject als aanpassing per instantie.

Mijn voorkeur is (c): dat past bij "een hele profielinrichting kan naar een instantie" (Mark 19-11),
en de tool start altijd.

**Vraag 4.** Wie mag het sidecar-project wijzigen? Besluit 16-10 zegt: profielen alleen-lezen voor
de modelleur. Voorstel: het project is alleen-lezen voor iedereen behalve de beheerder, met
branches voor een conceptversie van een profiel (zoals in PROF-1 beschreven).

**Vraag 5.** Een profiel dat uit het project komt, heeft een versie. Als het project een profiel
wijzigt zonder de versie op te hogen, wat dan? Voorstel: dezelfde bewaking als in render-svc
(`profielVersies`): weigeren te laden met een duidelijke melding.

## 4. Volgorde die ik voorstel

1. Vormen in het project (klein; geen vraag nodig behalve vraag 1).
2. Iconen naar data-iconen (na vraag 1 en 2).
3. Starten uit het project (na vraag 3 tot 5).
4. De projectbrowser in Profielen en Transformaties (stap e).
