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

**Downloaden** (voorbeeldvenster, 2026-10-10):

| Knop | Resultaat | Waar het werkt |
|---|---|---|
| Download Markdown | één `.md`, diagrammen als inline `<svg>` | VS Code-preview, browsers |
| **Markdown + afbeeldingen (.zip)** | `.md` met `![titel](stam-dN.svg)` + de losse `.svg`'s | overal, ook **GitHub** (dat stript inline SVG) |
| Download HTML / Afdrukken | HTML, of PDF via de printdialoog | browsers |

De zip-variant vervangt elk `<svg>…</svg>`-blok door een afbeeldingslink; de alt-tekst is de kop
erboven ("Diagram: Overzicht" → "Overzicht"). Code: `transformatie/sjabloon/markdownMetAfbeeldingen.js`
en een eigen ZIP-schrijver zonder afhankelijkheden (`zip.js`, methode STORE). Pak de zip uit naast
elkaar in één map, bv. `docs/voorbeelden/documenten/`.

**Een map als JSON** (ons eigen formaat `studio-map-export`): rechtsklik op de map → *Exporteren…*
→ *Map → JSON-bestand*; terug via *Importeren…* → *JSON-map-export*.

Ingebouwd (`transformatie/sjabloon/sjablonen.js`):

| Sjabloon | Profielen | Inhoud |
|---|---|---|
| **Projectdocument (volgt de mappen)** | alle | de mappenboom is de hoofdstukindeling: per (sub)map een kop op het juiste niveau, de **omschrijving van de map** als tekst, de diagrammen als tekening en de use cases met toelichting en relaties — zo is een document als het CGV use case-model volledig gegenereerd |
| Use case-overzicht | use case | per diagram de tekening; actoren met hun use cases; per use case een tabel met actoren, include, extend, specialisatie en de diagrammen |
| Gegevenswoordenboek | canoniek, UML, MIM, ERD, GraphQL, OAS | per element met velden een tabel veld/type/compartiment; diagrammen als tekening |
| Map-overzicht (generiek) | alle | per profiel de diagrammen en alle elementen met hun velden |

**Volledig gegenereerd uit het model:** [`voorbeelden/documenten/CGV_Use_case_model-gegenereerd.md`](voorbeelden/documenten/CGV_Use_case_model-gegenereerd.md)
(script `web/vite/scripts/genereer-cgv-voorbeeld.mjs`) naast het handgeschreven origineel
[`CGV_Use_case_model.md`](voorbeelden/documenten/CGV_Use_case_model.md). De inleiding is de
omschrijving van de bovenste map, de lagenplaat een ArchiMate-diagram in die map (gedaante
"Blokken (informeel)": de tekening volgt de shape-set die het diagram bewaart), de hoofdstukken
Actoren en Use cases zijn submappen. Een map krijgt zijn omschrijving in de Studio via het
eigenschappenpaneel (klik op de map in de projectboom).

**Voorbeeld:** [`voorbeelden/documenten/use-case-overzicht-klant.md`](voorbeelden/documenten/use-case-overzicht-klant.md)
— gegenereerd met `web/vite/scripts/genereer-voorbeelddocument.mjs` (zelfde renderer, context en
schets-tekenaar als de Studio; diagrammen als losse `.svg` naast het document, omdat GitHub inline
SVG in Markdown niet toont). Opnieuw maken: `node scripts/genereer-voorbeelddocument.mjs` vanuit
`web/vite`. Bekend in de schets: pijlpunten stoppen op de omsluitende rechthoek van een ellips, niet
op de ellipsrand.

## Volgorde en indeling

- **Diagrammen** staan in de volgorde van de projectboom (Ctrl+↑/↓ of *Omhoog*/*Omlaag* in de
  boom), ook als een map diagrammen van verschillende profielen bevat.
- **Elementen** (actoren, use cases) staan op naam.
- **Projectdocument**: per map eerst de **omschrijving** (eigenschappenpaneel van de map), dan de
  diagrammen van die map, dan de use cases op die diagrammen, en daarna de submappen als
  subhoofdstukken. Zet dus de inleiding in de omschrijving van de bovenste map, de overzichtsplaat
  (bv. het lagenschema) als eerste diagram in die map, en de rest in submappen (Actoren, Use cases,
  per actor een submap …).
- **Use case-overzicht** is plat: alle diagrammen van de map, dan alle actoren, dan alle use cases;
  submappen en omschrijvingen doen daar niet mee.

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
map {naam, omschrijving}  ·  naam, omschrijving, diepte, kop ("#"…), subkop
kinderen    [ …submappen in dezelfde vorm, diepte + 1… ]
profielen   [{id,label,elementen,diagrammen,verbindingen}]
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
