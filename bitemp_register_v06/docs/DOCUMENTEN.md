# Documenten uit sjablonen

*Studio: Modelleren → rechtsklik op een map → **Document maken…** (of Transformeren → Exporteren →
"Document: …"). Ontwerp en besluiten: `plans/2026-10-09 Documentsjablonen — documenten genereren
uit een map (ontwerpvoorstel).md`. Status 2026-10-09: stappen 1–4 gebouwd (renderer, contextbouwer,
ingebouwde sjablonen, voorbeeldvenster); eigen sjablonen in het project, DOCX en Imprint volgen.*

## Wat het doet

Een **sjabloon** (Markdown met gaten en lussen) loopt over de **context** van een map — de
elementen, hun velden en verbindingen, en de diagrammen — en levert een document: Markdown om te
bewaren of te kopiëren, en HTML in een voorbeeldvenster dat je als PDF afdrukt. Diagrammen staan
erin als **schets-SVG**: een deterministische tekening uit het model (posities en maten van het
diagram, vorm uit `elementType.shape`, lijnen uit `edgePresentatie`), zonder canvas.

Ingebouwd (`transformatie/sjabloon/sjablonen.js`):

| Sjabloon | Profielen | Inhoud |
|---|---|---|
| Use case-overzicht | use case | per diagram de tekening; actoren met hun use cases; per use case een tabel met actoren, include, extend, specialisatie en de diagrammen |
| Gegevenswoordenboek | canoniek, UML, MIM, ERD, GraphQL, OAS | per element met velden een tabel veld/type/compartiment; diagrammen als tekening |
| Map-overzicht (generiek) | alle | per profiel de diagrammen en alle elementen met hun velden |

## De sjabloontaal

Dezelfde notatie als de publicatie-templates waar het overlapt (veld- en lijstpatroon), maar een
eigen kleine renderer (`transformatie/sjabloon/renderer.js`) — publicatie (M0) en document (M1)
blijven apart (besluit 2026-10-09).

| Constructie | Betekenis |
|---|---|
| `{{pad}}` | waarde op de context (`naam`, `type.label`, `data.toelichting`); een lijst → `, `-opsomming; een functie (`svg`) wordt aangeroepen |
| `{{#if pad}} … {{else}} … {{/if}}`, `{{#unless pad}} … {{/unless}}` | voorwaardelijk |
| `{{#elk lijst type=x richting=uit sorteer=naam omgekeerd max=5}} … {{/elk}}` | lus; filters zijn data: `sleutel=waarde` matcht op het veld (objecten op id/naam/label); in de lus is het item de context met `index`, `eerste`, `laatste`, `aantal`; buitenste velden blijven bereikbaar (`{{map.naam}}`) |
| `{{> naam}}` | deelsjabloon (`opties.partials`) |
| front matter `--- titel: … ---` | wordt gelezen én gerenderd; `titel` is de documenttitel |

Een blok-tag die alleen op een regel staat neemt zijn regel mee (geen lege regels per lus).

## De context

`transformatie/sjabloon/context.js` → `maakDocumentContext({ naam, profielen, svgVan })`:

```
map {naam}  ·  profielen [{id,label,elementen,diagrammen,verbindingen}]
elementen   [{ id, naam, type{id,label}, data, toelichting, velden[{naam,type,compartiment}],
               diagrammen[{id,naam}], verbindingen[{type, richting:"uit"|"in", bron, doel, ander, naam}] }]
diagrammen  [{ id, naam, type, beschrijving, elementen, aantal, svg() }]
verbindingen[{ id, naam, type, bron, doel }]
```

De Studio-kant (`studio/activities/documentContext.js`) vult dit uit `collectMapModel(mapId)` en
geeft `schetsDiagramSvg` mee als tekenaar; `documentVoorbeeld.jsx` is het venster.

## Een sjabloon toevoegen

Voeg een entry toe aan `INGEBOUWDE_SJABLONEN` (`id`, `label`, `profielTypes` = profieltype-id's of
`"*"`, `toelichting`, `tekst`); `transformaties.js` registreert hem automatisch als export
"Document: <label>". Test de tekst met `renderSjabloon()` op een context uit
`maakDocumentContext()` (zie `sjabloon.test.js`).
