# Marks — markeringen op het model (plan, 18-11-2026)

*Sessie OMNIUM-UI (Claude), op vraag van Mark (18-11). Status: **besloten door Mark op 18-11**
(§9); de kern (stap 2) is in aanbouw. Aanleiding: BACKEND heeft voor "indexen uit het
model" (stap 4) een aanwijzing per veld nodig (`zoeksleutel`, `sorteerbaar`); dat is fysieke
afstemming die niet in het canonieke model thuishoort.*

## 1. Kern in vijf zinnen

1. Een **mark** is een aanwijzing op een modelelement die zegt **hoe een transformatie dat
   element moet behandelen**. Hij verandert de betekenis van het model niet.
2. Marks staan **los van het model, in een eigen laag erbovenop** (MDA: een doorzichtig vel over
   het model). Ze zitten wel in het project, gaan mee in sync, branches en export.
3. Een mark is **gestructureerd**: hij heeft een soort met een vaste vorm. Die soort hoort bij de
   **transformatie** die hem leest, niet bij het M3 en niet bij het profiel.
4. Marks zitten in **lagen** met labels (gemeente X, domein Y, omgeving Z, …). Een laag is eerst
   van jezelf en kun je delen, zoals een bundel. Een transformatie draait met een **context**: een
   keuze van lagen in een volgorde. Zo zijn marks filterbaar, en geeft een ander filter een andere
   uitkomst.
5. Een mark **verwijst via de uuid** van zijn doel (element, veld, relatie); bij BPMN en DMN, die
   nog geen uuid hebben, via profiel en element-id.

## 2. Wat MDA erover zegt

Uit de MDA Guide (OMG, versie 1.0.1, 2003) en "MDA Distilled" (Mellor e.a., 2004). Uit het hoofd
weergegeven; bij twijfel over een formulering eerst de bron nalezen.

- Een mark staat voor **een begrip uit het doelplatform** en wordt op een element van het
  platformonafhankelijke model (PIM) gezet om aan te geven **hoe dat element getransformeerd wordt**.
- Marks zijn platformspecifiek en dus **geen deel van het PIM**. De Guide gebruikt het beeld van een
  **doorzichtige laag** over het model. Hetzelfde PIM kan voor twee platforms twee verschillende
  sets marks dragen.
- Marks horen bij een **mapping** (de transformatie). Waar ze vandaan komen is vrij: typen uit een
  model, rollen uit een patroon, stereotypen uit een UML-profiel, elementen van een metamodel.
- Mellor maakt dat scherper met een **markeermodel** (*marking model*): de transformatie declareert
  welke marks ze kent, elk met **naam, type en standaardwaarde**. Een mark is daar dus een getypeerd
  naam-waardepaar, geen vrije tekst.
- Marks kunnen ook **kwaliteitseisen** dragen (bv. "moet snel doorzoekbaar zijn"), waaruit de
  transformatie zelf de techniek kiest. Dat is precies het geval van BACKEND: `zoeksleutel` zegt
  wat gewenst is, de codegen kiest de index.

Dus: **los van het model, gestructureerd, en eigendom van de transformatie.** Dat sluit aan op wat
Mark voorstelt ("los, maar dicht tegen het model").

## 3. Op welk metaniveau?

| Niveau | Marks? | Toelichting |
|---|---|---|
| **M1** (model) | **Ja, hier horen ze** | Op een entiteit, gegevenselement, veld, relatie, proces-taak, beslissing. Dit is het MDA-geval. |
| **M2** (profiel) | Niet als mark; wel als **standaard** | "Elk veld van type Datum is sorteerbaar" is geen mark op het profiel, maar een standaardregel in het markeermodel (§4). Zo blijft een profiel vrij van platformkennis. |
| **M3** | Nee | Het M3 zegt wat een profiel kan uitdrukken; daar verandert niets. De vorm van een markwaarde hergebruikt het bestaande `PropertyType`. |
| **M0** (data) | Nee, dat is een **annotatie** | Een uitspraak over een geregistreerd gegeven (twijfel, onderzoek) is iets anders: het is zelf een geregistreerd feit, met tijd en registratie. Daarvoor ligt het ontwerp *Annotatie & Betwijfeling* (13-07) er. |

Het verschil tussen mark en annotatie in één regel: **een mark stuurt een transformatie
(ontwerptijd, bij het model); een annotatie zegt iets over gegevens (looptijd, in het register).**
Wat ze delen is de vorm van de W3C Web Annotation: een *doel* (waar hangt het aan), een *inhoud*
(de gestructureerde waarde) en een *motivatie* (waarvoor). Die vorm nemen we over (§5); de
betekenis komt uit MDA.

Marks zijn daarmee **geen M3-ding en geen deel van het M1-model**: ze horen in het
**projectmetamodel**, naast kruisverbanden en mappen (plan *M3 en projectmetamodel als modellen*,
15-11).

## 4. De drie begrippen

**Marksoort** (wat kan er gemarkeerd worden). Gedeclareerd door de transformatie die hem leest,
in haar regelset (`TRANSFORMATIES.md`: lezer → regelset → toepasser):

```js
// bij de regelset "canoniek → register" (BACKEND, indexen uit het model)
marksoorten: [
  { id: "register.zoeksleutel", label: "zoeksleutel", datatype: "boolean",
    doelen: ["veld"], uitleg: "Op dit veld wordt gezocht; de codegen legt een index aan." },
  { id: "register.sorteerbaar", label: "sorteerbaar", datatype: "boolean", doelen: ["veld"] },
]
```

- De id heeft een **naamruimte** (`register.`, `gzac.`, `formulier.`): die van de transformatie.
- `datatype` en eventuele `opties` zijn de velden van een M3-`PropertyType`. De inspector kan een
  mark daardoor bewerken met de editors die er al zijn; een samengestelde mark is een lijstje van
  zulke eigenschappen.
- `doelen` zegt waar hij op mag: `element`, `veld`, `relatie`, `map`, eventueel beperkt tot een
  profiel of elementtype.
- Een **standaardregel** kan erbij: "geldt voor elk veld met type X, tenzij anders gemarkeerd".
  Dat is het antwoord op "marks op M2".

**Laag** (bij wie of wat hoort deze set marks). Een laag heeft een naam en nul of meer
**labels** (`{soort, waarde}`): gemeente Waterstede, domein parkeren, omgeving cg-test, doelplatform
GZAC 13. De labelsoorten zijn **open**: een project maakt er bij, zoals het koppelsoorten bijmaakt.
Het "XXX" uit Marks vraag (e-dienst, leverancier, …) past daar zonder aanpassing in. Een laag
zonder labels is algemeen.

Een laag werkt **zoals een bundel** (besluit Mark 18-11): hij begint **bij jezelf** (in je
werkruimte, niet in het project) en je kunt hem **delen** (dan staat hij in het project en ziet
iedereen hem). Wie het project mag bewerken, mag een gedeelde laag wijzigen.

**Mark** (de aanwijzing zelf): `{id, laag, soort, doel, waarde}`.

## 5. Vorm en verwijzing

In het werkbestand, als eigen onderdeel naast `kruisverbanden`:

```json
"marks": {
  "lagen": [
    { "id": "algemeen", "naam": "Algemeen", "labels": [] },
    { "id": "waterstede", "naam": "Waterstede", "labels": [{ "soort": "gemeente", "waarde": "Waterstede" }] }
  ],
  "contexten": [
    { "id": "ws-test", "naam": "Waterstede op cg-test", "lagen": ["algemeen", "waterstede"] }
  ],
  "marks": [
    { "id": "m1", "laag": "algemeen", "soort": "register.zoeksleutel",
      "doel": { "soort": "veld", "uuid": "d9819126-…" }, "waarde": true }
  ]
}
```

**Verwijzen: op de uuid.** Dat is de identiteit binnen de tool (besluit Mark 31-10); een
hernoeming breekt niets.

- Vandaag hebben alleen de elementen en velden van het canonieke model een uuid (projectformaat 4).
  Voor die doelen is het dus meteen goed.
- Elementen van andere talen (BPMN-taak, DMN-beslissing) hebben nog geen uuid. Een mark verwijst
  daar met `{profielId, elementId}`; die id is binnen een project stabiel. BPMN en DMN doen zo
  vanaf de eerste versie mee. Een uuid voor alle talen is een eigen stap (projectformaat 5).
- Mappen hebben een id en kunnen op dezelfde manier doel zijn (het uitgestelde punt "MDA-mark op
  een map" uit *bronnen als artefacten*).
- Verdwijnt het doel, dan blijft de mark staan als **wees** en toont de Studio dat. Hij wordt niet
  stil weggegooid; zelfde regel als bij een kolom waarvan de bron verdween.

## 6. Filteren en samenvoegen van lagen

Een transformatie (en de Studio bij het tonen) werkt met een **context**: een keuze van lagen in
een **volgorde**. Bijvoorbeeld `[algemeen, domein parkeren, Waterstede, cg-test]`. Er is geen
vaste voorrang tussen labelsoorten: de volgorde staat in de context zelf (Mark 18-11: "de
volgorde-bepaalmark"). Een context is per gebruiker en per doel te kiezen, heeft een naam en is
te delen, net als een laag. Je maakt hem door lagen aan te wijzen, of met een filter op labels
(alle lagen met `gemeente = Waterstede`), en zet ze daarna in de gewenste volgorde.

Een ander filter of een andere volgorde geeft een andere uitkomst: lagen die buiten het filter
vallen doen niet mee, en hun marks dus ook niet. Dat is de bedoeling; daarom staat de gebruikte
context bij elke uitvoer (§7).

- **Effectieve mark** = voor elk paar (doel, soort) de waarde uit de laatste laag in de context die
  er een heeft. Later in de volgorde wint.
- Een laag kan een mark ook **uitzetten** (waarde `null` = "hier niet"), zodat een gemeente een
  algemene keuze kan terugdraaien.
- De Studio toont bij een element de effectieve marks en uit welke laag elk komt. Kiest de
  gebruiker andere lagen, dan ziet hij een andere uitkomst; dat is het filter.
- Spreken twee lagen elkaar tegen, dan beslist de volgorde; de Studio laat zien welke laag won en
  welke werd overschreven.

De kern hiervan is één pure functie, `effectieveMarks(marks, lagen, context)`, zonder scherm en
onder node te testen.

## 7. Export en bereikbaarheid voor een transformatie

Twee vormen, elk voor een eigen lezer:

1. **Projectbestand (studio-project JSON):** alle lagen en alle marks, onbewerkt (§5). Voor sync,
   branches, back-up en een andere Studio.
2. **V3-export (voor codegen en BACKEND):** de **effectieve marks voor de gekozen context**, als
   **bijlage** naast het model, niet op het element zelf (besluit Mark 18-11: anders zitten ze
   toch weer ín het model):

   ```json
   { "model": { … },
     "marks": {
       "context": ["algemeen", "waterstede", "cg-test"],
       "marks": [
         { "doel": { "soort": "veld", "uuid": "d9819126-…" }, "soort": "register.zoeksleutel", "waarde": true },
         { "doel": { "soort": "veld", "uuid": "d9819126-…" }, "soort": "register.sorteerbaar", "waarde": true }
       ] } }
   ```

   De codegen hoeft geen lagen te kennen: de bijlage bevat alleen wat geldt, met de uuid van het
   doel (die staat sinds V3.1 op elk element en veld). Hij zoekt per veld op de uuid en zet het in
   de MetaRegistry. Een V3-bestand zonder `marks` blijft gewoon geldig.

Voor transformaties binnen de Studio (artefacten, formulieren) komt er één hulpfunctie
`marksVoor(doel, context)`, zodat geen transformatie zelf door lagen hoeft te lopen.

Sync en branches: een mark is een eigen record, dus samenvoegen naar MAIN werkt per mark, net als
per veld. De **modeltools (MCP)** krijgen lezen en zetten van marks, zodat de assistent ze kan
toepassen.

## 8. Stappen

| Stap | Wat | Raakt |
|---|---|---|
| 1 | Besluiten (§9) | Mark |
| 2 | Kern, puur: lagen, marks, `effectieveMarks`, wezen; tests | Studio, geen scherm |
| 3 | Opslag in het werkbestand, sync-operaties, vergelijken en samenvoegen | Studio, render-svc (vergelijk) |
| 4 | Marksoorten bij de regelset; eerste set `register.*` samen met BACKEND | Studio, BACKEND |
| 5 | V3-export met effectieve marks en `markContext` | Studio; codegen leest ze (BACKEND) |
| 6 | Inspector: sectie *Marks* op element en veld, met de laag erbij; een **teken op het canvas** bij een element met marks, klikbaar voor de inhoud | Studio |
| 7 | Lagen en contexten: eigen en gedeeld, labels, volgorde, filter; wezen tonen | Studio |
| 8 | Later: standaardregels per type, uuid voor alle talen (formaat 5), mark op een map, MCP | — |

Stap 2 tot en met 5 zijn genoeg voor BACKEND's stap 4; het scherm (6 en 7) kan daarna. Tot stap 5
klaar is kan BACKEND de tijdelijke veldeigenschap `fysiek: {…}` gebruiken; die verhuist dan in één
omzetting naar `register.*`-marks in de laag *algemeen*.

**Afstemming met BACKEND (18-11).** Akkoord op `register.zoeksleutel` en `register.sorteerbaar`
(boolean, op een veld) en op de bijlage; er komt geen tijdelijke veldeigenschap.
`register.tekstzoeken` is gereserveerd (zoeken op een deel van een tekst; ander soort index).
`uniek` blijft een eigenschap van het veld: het is een regel van het model, geen afstemming. De
doelkant van een relatie krijgt altijd een index, dus een mark op een relatie is daarvoor niet
nodig. Eis aan de export: elk veld met een mark heeft een uuid in de V3; een mark waarvan de
codegen het doel niet vindt geeft een waarschuwing en de bouw gaat door.

**Stand (18-11).** Stap 2 is gebouwd: `web/vite/src/marks/marks.js` (lagen, contexten,
`effectieveMarks`, `marksVoor`, `wezen`, `marksBijlage`) en `marksoorten.js` (soorten per
transformatie, toets op doel en datatype, de eerste set `register.*`), met tests. Nog nergens
aangesloten: geen scherm, geen export.

Stap 3 is gebouwd (18-11): de marks staan in het werkbestand (`marks`, alleen als er iets is) en
in de store `studio/marksStore.js`; een wijziging gaat als één operatie `marks/patchMarks` de
projectsync in, en de server speelt hem na (`sidecarImport.speelOpsNa`). Vergelijken en
samenvoegen van een branch nemen lagen, contexten en marks mee, elk op id (verschilsoorten
`marklaag`, `markcontext`, `mark`; groep *Marks* in de keuzeboom). De gekozen context
(`actieveContext`) is van de gebruiker en van het apparaat en reist niet mee. Een oudere Studio
slaat de onbekende store over. **Nog niet:** eigen lagen in de werkruimte die je daarna deelt
(nu is elke laag meteen van het project), en het scherm.

Wat nu al in het model staat en eigenlijk een mark is, verhuizen we **niet** vooraf. Kandidaten om
later te bekijken: de vorm van invoer in een formulier (inhoud en vorm scheiden we al), een
afwijkende tabelnaam, en GZAC-specifieke keuzes in een BPMN-model.

## 9. Besluiten van Mark (18-11)

1. **Naam: mark**, de MDA-naam, ook in de Studio (aan het begin van een zin en als kopje: Mark,
   Marks). Geen hoofdletters: het is geen afkorting. Wie dit gebruikt kent de term. (En Mark heet
   zelf ook zo.)
2. **Een mark komt vanuit de vraag, het doel.** De marksoort hoort dus bij de transformatie
   (regelset), met een naamruimte; niet bij het profiel of het M3.
3. **Lagen zoals bundels:** eerst bij jezelf, daarna deelbaar; met een of meer labels (gemeente X,
   domein Y, …).
4. **Geen vaste voorrang.** De volgorde staat in de context en kan per gebruiker en per filter
   verschillen; een ander filter geeft bewust een andere uitkomst.
5. **Doelen:** het canonieke model én BPMN en DMN vanaf de eerste versie.
6. **V3:** marks als bijlage `marks` naast het model, niet op het element.
7. **Zichtbaar:** een teken op het canvas, klikbaar voor de inhoud, en in Eigenschappen.
