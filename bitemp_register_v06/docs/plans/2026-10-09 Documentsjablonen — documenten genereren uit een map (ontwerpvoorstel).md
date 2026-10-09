# Documentsjablonen — documenten genereren uit een map (ontwerpvoorstel)

*Datum: 2026-10-09. Aanleiding: Mark, "zoiets als document templates, waarbij je uit een map met
diagrammen en use cases een use case-overzichtsdocument genereert — een soort van
template-mechanisme is dan nodig". Status 2026-10-09: stappen 1–4 gebouwd (renderer, contextbouwer,
schets-SVG, drie ingebouwde sjablonen, voorbeeldvenster) — gebruik en taal in
`docs/DOCUMENTEN.md`; stappen 5–7 (tweede toets, eigen sjablonen, DOCX/Imprint) open.*

## 1. Wat we willen

Uit een **bereik** van het model (een map in de projectboom, een diagram, een selectie, een heel
profiel) een **leesbaar document** maken volgens een **sjabloon**: een use case-overzicht met per
diagram de tekening en per use case naam, toelichting, actoren en include/extend-relaties; een
gegevenswoordenboek uit een klassenmodel; een procesbeschrijving uit BPMN. Enterprise Architect
heeft dit als *RTF/Document Generation* (F8): een template met secties per pakket, element,
diagram en attribuut, en velden die je erin plakt. Dat is het referentiebeeld, zonder de RTF-
editor.

Kenmerken die we willen vasthouden:

- **Het model is de bron**, het document is uitvoer. Nooit andersom (geen "document-import").
- **Profielonafhankelijk waar het kan**: een sjabloon loopt over knopen, groepen en verbindingen
  (het graafbeeld), en kent de profieltermen alleen via labels. Een profiel mag wél eigen,
  ingebouwde sjablonen meebrengen.
- **Diagrammen als tekening in het document**, byte-gelijk aan wat Studio en Imprint tonen.
- **Dezelfde placeholder-taal** als de publicatie-templates (`{{veldpad}}`, `{{#if}}`), zodat er
  één manier van "tekst met gaten" in Omnium bestaat.

## 2. Wat er al ligt

| Bouwsteen | Waar | Bruikbaar voor |
|---|---|---|
| Publicatie-templates: `{{veldpad}}`, `{{#if}}/{{#unless}}/{{else}}`, `{{#vorm}}` | `docs/PUBLICATIE_TEMPLATES.md`, publicatie-renderer | de placeholder-taal; evalueert nu op M0 via GraphQL-paden |
| Transformatievorm: lezer → regelset → toepasser → **schrijver** | `docs/TRANSFORMATIES.md` §3, §7.6 ("schrijver voor export met tekstsjablonen") | een document is een *schrijver* op het graafbeeld van een bereik |
| Graafbeeld van een model | `transformatie/modelNaarGraaf.js` | de profielonafhankelijke context: knopen, groepen, verbindingen |
| Map-verzameling | `studio/activities/transformaties.js` `collectMapModel()` | bereik "map" → per profiel elementen + diagrammen (+ connectoren ertussen) |
| Headless SVG-tekenaar | `diagramsvg/renderDiagramSvg()` (Studio én render-API, `docs/RENDER_API.md`) | diagrammen als SVG in het document, zonder canvas |
| Canvas-export PNG/SVG | `diagramcore/export/exporteerCanvas.js` | alternatief voor het *actieve* diagram (met canvas-opmaak) |
| Transformeren-dialoog op een map (Importeren / Transformeren / Exporteren) | `useTransformStore`, contextmenu van een map | de plek in de UI: een document is een export met bereik map |
| Projectsync (Studio-project als blob + operaties) | `docs/plans/2026-10-07 Projectsync` | eigen sjablonen in het project meenemen |

Kortom: de motor bestaat voor driekwart. Wat ontbreekt is (a) een **sjabloon-renderer** die over
een modelcontext itereert, (b) de **contextbouwer** van bereik naar context, (c) ingebouwde
sjablonen en (d) de UI met voorbeeldweergave en uitvoer.

## 3. Voorstel

### 3.1 Niveaus

Een sjabloon is geen M1-model en geen M2-profiel. Het is **presentatie van M1**, geparametriseerd
op M2-termen (elementtypen, veldtypen). Daarom:

- **Ingebouwde sjablonen** horen bij een profiel (M2): `diagramprofielen/<profiel>/sjablonen/*.md`
  — bv. `usecase/sjablonen/use-case-overzicht.md`, `canoniek-uml/sjablonen/gegevenswoordenboek.md`.
- **Eigen sjablonen** horen bij het project (M1-niveau, "van de gebruiker"), als bestand in het
  Studio-project (meegesynct via projectsync) en importeerbaar/exporteerbaar als `.md`.
- **Generieke sjablonen** (profielonafhankelijk: "inhoud van deze map") staan in
  `studio/sjablonen/`.

### 3.2 De taal: Markdown met gaten en lussen

Dezelfde syntax als de publicatie-templates, plus **iteratie** en **diagrammen**:

```markdown
---
titel: Use case-overzicht {{map.naam}}
---
# {{map.naam}}

{{#elk diagrammen sorteer=naam}}
## Diagram {{naam}}
{{svg}}
{{#if beschrijving}}{{beschrijving}}{{/if}}
{{/elk}}

# Actoren
{{#elk elementen type=actor sorteer=naam}}
## {{naam}}
{{#if data.toelichting}}{{data.toelichting}}{{/if}}
{{#elk verbindingen type=associatie richting=uit}}- {{doel.naam}}
{{/elk}}
{{/elk}}

# Use cases
{{#elk elementen type=usecase sorteer=naam}}
## {{naam}}
{{#if data.toelichting}}{{data.toelichting}}{{/if}}
{{#elk verbindingen type=include richting=uit}}- *include* {{doel.naam}}
{{/elk}}{{#elk verbindingen type=extend richting=in}}- uitgebreid door {{bron.naam}}
{{/elk}}
Op diagram: {{#elk diagrammen}}{{naam}}{{#unless laatste}}, {{/unless}}{{/elk}}
{{/elk}}
```

Constructies:

| Constructie | Betekenis |
|---|---|
| `{{pad}}` | waarde op het huidige contextobject (`naam`, `data.toelichting`, `type.label`); meervoud → `, `-gescheiden, zoals in de publicatie |
| `{{#if pad}} … {{else}} … {{/if}}`, `{{#unless}}` | als in de publicatie-templates |
| `{{#elk lijst filter… sorteer=veld}} … {{/elk}}` | lus; `lijst` = `diagrammen`, `elementen`, `verbindingen`, `velden`, `kinderen` (sub-mappen), met filters `type=`, `richting=uit|in` (verbindingen), `compartiment=` (velden); binnen de lus is het item de context, `laatste`/`eerste`/`index` beschikbaar |
| `{{svg}}` (op een diagram) | de tekening als inline SVG (Markdown: `![](bestand.svg)` + bestand in de zip) |
| `{{#vorm naam pad}}` | weergavevormen als in de publicatie, waar zinvol (tabel, chips) |
| `{{> naam}}` | deelsjabloon (bv. één use case-blok hergebruiken) |

Bewust **geen** vrije expressies of code in het sjabloon: filters en sortering zijn data, net als
in de regelsets. Wie meer wil, maakt eerst een transformatie (regelset) en documenteert het
resultaat.

### 3.3 De context

De **contextbouwer** maakt van een bereik één object (profielonafhankelijk, via het graafbeeld):

```
{ map: {naam, pad},
  diagrammen: [{ id, naam, type, beschrijving, svg(), elementen: [...] }],
  elementen:  [{ id, naam, type: {id,label}, data, velden: [{naam, type, data}], diagrammen: [...],
                verbindingen: [{ type, richting, bron, doel, naam }] }],
  kinderen:   [ …sub-mappen met dezelfde vorm… ],
  profiel:    { id, label }  // per profiel een deelcontext als een map meerdere profielen bevat
}
```

`svg()` is lui: alleen gerenderd als het sjabloon erom vraagt (`diagramsvg`, dezelfde opties als
de render-API; voor het actieve diagram optioneel de canvas-export met handmatige opmaak).
Bereik: map (eerst), daarna diagram, selectie, profiel — hetzelfde bereik-contract als
transformaties (§4 daar).

### 3.4 Uitvoer

1. **Markdown** (bestand, of kopiëren) — eerst; diagrammen als `.svg`-bestanden in een zip, of
   inline `<svg>` (GitHub rendert dat niet, Imprint wel).
2. **HTML** in een voorbeeldvenster in de Studio, met *Afdrukken → PDF* van de browser; inline SVG.
3. Later: **DOCX** (een docx-schrijver; het sjabloon blijft Markdown, de schrijver zet om),
   en **Imprint**: het document als pagina in de publicatie (zelfde renderer, serverzijde via de
   render-API).

### 3.5 In de UI

- Contextmenu van een map (en van een diagram): **Document maken…** → kies sjabloon (ingebouwd per
  aanwezig profiel, generiek, eigen) → **voorbeeld** (HTML, scrollbaar, met de tekeningen) →
  *Download Markdown* / *Download HTML* / *Kopieer*. Dit is een derde knop naast Importeren /
  Transformeren / Exporteren in de bestaande Transformeren-dialoog, of een eigen tab daarin.
- Menu Project → **Documenten**: dezelfde dialoog op de hele projectboom.
- **Sjablonen beheren** (Studio-instellingen → Documentsjablonen, of in het project): lijst,
  nieuw van ingebouwd (kopie), bewerken in een tekstvak met live voorbeeld op een gekozen map,
  importeren/exporteren.

### 3.6 Code

| Onderdeel | Plek | Opmerking |
|---|---|---|
| Renderer (puur) | `transformatie/sjabloon/renderer.js` + tests | placeholders, if/unless/else, elk met filters/sortering, partials, `svg`; geen DOM |
| Publicatie-syntax | eigen parser in `transformatie/sjabloon/`, zelfde notatie als de publicatie waar het overlapt | besluit §5: apart houden, principes delen (veld- en lijstpatroon) |
| Contextbouwer | `transformatie/sjabloon/context.js` | op `collectMapModel` + `modelNaarGraaf`; `svg()` via `diagramsvg` |
| Ingebouwde sjablonen | `diagramprofielen/<profiel>/sjablonen/*.md`, `studio/sjablonen/*.md` | `?raw`-import in Vite; profiel-descriptor krijgt `sjablonen: [{id, label, bestand}]` |
| Eigen sjablonen | Studio-project (`modellerenStore.sjablonen`), projectsync-operatie `sjabloon.zet/wis` | `MODEL_OPS` bijwerken (zie projectsync) |
| UI | `studio/activities/documentDialoog.jsx`, items in `transformaties.js` (soort `document`) | voorbeeld = HTML in een iframe (sandbox) |
| Uitvoer | Markdown/HTML in de browser; DOCX later; CLI-runner dezelfde renderer (§7.6 transformaties) | |

## 4. Stappenplan

1. **Renderer + tests** (puur, 1 dag): tokenizer, `{{pad}}`, if/unless/else, `#elk` met
   `type=`/`richting=`/`sorteer=`, `laatste`/`eerste`, partials. Zonder SVG.
2. **Contextbouwer op een map** (½ dag): `collectMapModel` → context; verbindingen met
   richting; velden uit compartimenten; `svg()` via `diagramsvg`.
3. **Eerste ingebouwd sjabloon: use case-overzicht** (½ dag) + Markdown-download met SVG's in
   een zip, en HTML-voorbeeld met inline SVG. Hiermee is Marks vraag beantwoord.
4. **UI**: *Document maken…* op map en diagram, voorbeeldvenster, downloads (1 dag).
5. **Tweede sjabloon** als toets van de generiekheid: gegevenswoordenboek (canoniek-uml:
   klassen → attributen in een tabel, met `{{#vorm tabel velden}}`) (½ dag).
6. **Eigen sjablonen** in het project, beheer-scherm, projectsync-operaties (1–2 dagen).
7. **DOCX** en **Imprint-pagina** (later, apart plannen).

## 5. Besluiten en open punten

**Besluit (Mark, 2026-10-09): HTML-publicatie en document blijven apart.** Ze zijn verschillende
dingen (een pagina met live registerdata op M0 versus een document uit het model op M1). Geen
gedeelde parser of renderer; wél dezelfde **principes en patronen** hergebruiken: de
placeholder-vorm `{{pad}}`, het **veldpatroon** (een veld = naam + type + waarde, met
voorwaardelijke blokken voor lege velden) en het **lijstpatroon** (meervoud → opsomming,
filteren en sorteren als data, `laatste`/`eerste` in een lus). De document-renderer krijgt dus
een eigen, kleine implementatie in `transformatie/sjabloon/`, met dezelfde notatie waar het
overlapt zodat de kennis overdraagbaar blijft. Mocht de publicatie later lussen willen, dan is
dat een eigen stap daar — niet via een gedeelde module.

Open:
- **Sortering en filters als data**: genoeg voor overzichten; voor "alleen use cases met een
  include" is een voorwaarde op een lus nodig (`{{#elk elementen type=usecase als=verbindingen.type=include}}`)
  — pas toevoegen als iemand het mist.
- **Diagram-opmaak**: `diagramsvg` tekent uit het model (auto-layout of diagramposities); de
  canvas-export tekent wat je ziet (incl. handmatige knikken en kleuren). Voor documenten lijkt
  het model de juiste bron; het canvas als optie voor het actieve diagram.
- **EA-templates importeren**: nee; wel de *structuur* van EA's standaardsjablonen overnemen als
  ingebouwde sjablonen (pakket → diagrammen → elementen → attributen/operaties).
