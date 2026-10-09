# Changelog — Frontend / Omnium Studio

Alle noemenswaardige wijzigingen aan de web-frontend (`web/vite/`: Studio-werkbank,
inhoud-editor, publicatie, IDE). Formaat: [Keep a Changelog](https://keepachangelog.com);
versionering volgens [`docs/versiebeheer.md`](../docs/versiebeheer.md) (prefix `studio/`).

De single source of truth voor het nummer is `package.json` `"version"`.

## [Unreleased]
Sparx EA-import en overerving in het M3 (branch `feat/ea-qea-lezer`, 07–09 oktober; alleen
frontend, api blijft 0.12.0). Onderzoek en EA-schema: `docs/plans/2026-10-07 Sparx EA-sync — vier
routes vergeleken (onderzoek).md`.

### Toegevoegd
- **Sparx EA importeren uit een `.qea`** (SQLite, client-side met sql.js): in Modelleren *Bestand →
  Importeer Sparx EA (.qea)…* leest één pakket (keuzelijst met zoekveld) en zet elk diagram in zijn
  eigen profiel — klassediagrammen naar UML of, bij MIM-/MIG-stereotypen, naar MIM (tagged values →
  mim12-eigenschappen), activiteitendiagrammen naar Activity (aanroepen, pins, guards, partities),
  use case-diagrammen naar Use case (incl. collaboratie en «legt vast»). Posities, maten, knikpunten,
  verborgen lijnen en kleuren komen mee (schaal 1,5); stabiele ids uit de EA-GUID; stereotypen,
  tagged values en notities reizen mee op `data`. De EA-boom wordt de projectboom: pakketten,
  use cases en activities als mappen, het diagram bij zijn eigenaar met de knopen ernaast; je kiest
  de doelmap of de wortel. Toevoegen met undo per profiel. Per profiel bestaat ook een import
  "alleen dit profiel". `scripts/inspecteer-qea.py` doorlicht een `.qea`.
- **M3: overerving en abstracte elementtypen** — `ElementType.erft` en `isAbstract` (EMOF
  superClass/isAbstract), uitgevlakt bij registratie (`types/erfenis.js`); een abstract type staat in
  elk bereik voor zijn concrete afstammelingen (een abstract knoop-type nooit voor connectoren);
  profiel-ontwerper tekent *Erft van* (▷) en kent een vinkje *abstract*. **Canoniek-uml** staat op
  Marks Metamodel v2026: abstracte `representatie`, entiteit en gegevenselement eronder, relatie
  onder gegevenselement.
- **Profielen**: notitie-lijn in puur-uml, activity, use case en MIM; collaboratie, klasse,
  realiseert en dependency in use case; `ElementType.omtrek` (ruit/ellips) zodat lijnen de echte
  vorm raken — activity hecht nu zwevend.
- **Studio**: bestandsimport in een niet-lege sandbox vraagt *toevoegen (undo)* of *vervangen*;
  keuzedialoog `vraagKeuze` met zoekveld; `importBestand.binair`.

### Gefixt
- Zwevende lijnuiteinden mikken op hun dichtstbijzijnde knikpunt (niet op de andere doos); een
  knikpunt óp de rand is het uiteinde.


## [studio/v0.15.2] — 2026-10-08
Patch: de snapshot-grens ging niet mee naar de server. Alleen frontend; api blijft 0.12.0.

### Gefixt
- **Snapshot-grens (`tot_volgnummer`) reist mee** (08-10): de opslag-aanroep liet het veld weg,
  waardoor de grens op de server 0 bleef, de compactie nooit iets deed en een client na *Van server
  ophalen* álle operaties nogmaals afspeelde bovenop de snapshot. Voor posities onschadelijk, maar
  een *Omhoog*/*Omlaag* van vóór de snapshot werd zo tweemaal toegepast (één wissel verschil tussen
  twee browsers). Test op de aanroep; `apiBase()` is node-veilig.

## [studio/v0.15.1] — 2026-10-08
Patch: de volgorde in de projectboom synct nu en overleeft de snapshot. Alleen frontend; api
blijft 0.12.0.

### Gefixt
- **Boomvolgorde synct** (08-10): *Omhoog*/*Omlaag* (Ctrl+↑/↓) in de projectboom kwam niet bij
  collega's aan — `schuifPlaatsing` ontbrak in het operatievocabulaire en het vangnet zag alleen
  waarden, niet de sleutelvolgorde van `plaatsing`. Nu een benoemde operatie; het vangnet meldt een
  volgorde-wissel (ook bij undo) als `volgordePlaatsing` in `patchStructuur`.
- **Boomvolgorde overleeft de snapshot** (08-10): de volgorde zat alleen in de sleutelvolgorde van
  `plaatsing`, en `jsonb` op de server herschikt objectsleutels — wie ophaalde kreeg een andere
  volgorde dan wie stuurde. Het werkbestand draagt nu `structuur.plaatsingVolgorde` expliciet mee;
  laden herstelt die volgorde (`herschikOpVolgorde`).

## [studio/v0.15.0] — 2026-10-08
Samenwerken wordt live (projectsync stap 2, api 0.12.0) en het vervolg van de canvas-bediening:
geen browser-popups meer, sorteren en navigeren in de projectboom, velden herordenen, zelfde
maat, instelbare sneltoetsen. Zie `docs/plans/2026-10-07 Projectsync …`, `docs/STUDIO.md` en
`RELEASE.md`.

### Toegevoegd (projectsync stap 2)
- **Live synchroniseren** (07/08-10): elke modelwijziging is een benoemde operatie
  (`studio/sync/operaties.js`) die via een outbox naar `POST …/ops` gaat; wijzigingen van anderen
  komen direct binnen over een SSE-kanaal (`EventSource`, `startKanaal`) en anders via een poll als
  terugval (interval van de instantie of per browser in Studio-instellingen → *Samenwerken*).
  Operaties van anderen gaan niet in je undo, en je eigen Ctrl+Z wist hun werk niet (undo-rebase).
  Menu *Project*: sync-stand in de kop (live / poll / N te verzenden / offline), *Live
  synchroniseren*, *Nu verversen*.
- **Snapshot-compactie**: na 200 operaties zet een client stil een nieuwe snapshot en ruimt de server
  het log op; wie te ver achterloopt laadt de snapshot opnieuw (tabs blijven).
- **Wie is online**: "N anderen online" rechts in de menubalk (namen in de tooltip) en "Online: …"
  in het Project-menu.
- **Werkruimte los van het project**: tabs, actieve tab en open/dicht mappen per project
  (`studio-werkruimte:<projectId>`) én per gebruiker op de server, zodat je op een andere computer
  verdergaat waar je was. Het werkbestand is **v3**, zonder tabs en viewports.

### Gewijzigd
- **Geen browser-popups meer** (07-10): alle prompt/confirm/alert-vensters zijn vervangen door
  de eigen dialoogservice (`naamDialog.jsx`), die bij de muisklik verschijnt. *Nieuwe map* en
  *Nieuwe submap* vragen geen naam meer: de map staat er meteen en je typt de naam inline in de
  boom; submappen kunnen willekeurig diep. Zie `docs/STUDIO.md`.
### Toegevoegd
- **Sorteren in de projectboom** (07-10): Ctrl+↑/↓ of *Omhoog*/*Omlaag* in het contextmenu voor
  mappen, diagrammen en elementen. **Pijltjes** lopen door de boom: ↑/↓ regels, ← sluit een map of
  gaat naar de ouder, → opent een map of gaat naar het eerste kind, Enter opent een diagram. De scheiding tussen Mappen en Elementen is een versleepbare
  splitter (per browser bewaard).
- **Velden herordenen** (attributen, operaties, …): ↑/↓ en Ctrl+↑/↓ in de inspector, Ctrl+↑/↓ in
  het inline-veld op het canvas.
- **Zelfde breedte / hoogte / maat** in de Uitlijnen-balk en het contextmenu: naar de laatst
  geselecteerde (dus ook kleiner maken kan).
- **Sneltoetsen**, instelbaar in Studio-instellingen → Sneltoetsen, met EA-achtige standaarden
  (Ctrl+Alt+pijlen uitlijnen, Alt+V verticaal centreren = boven elkaar, Alt+H horizontaal = naast
  elkaar zoals in EA, Alt+-/= verdelen, Alt+W/E/R zelfde maat, Alt+Z
  maat aan inhoud, Ctrl+Delete verwijderen uit model, Alt+G zoek in projectboom).
- Graaf (demo), SP en de Profiel-editor staan standaard niet meer in de activity bar.
- **Documenten uit sjablonen** (09-10): rechtsklik op een map → *Document maken…*: use
  case-overzicht, gegevenswoordenboek of generiek map-overzicht, met de diagrammen als tekening;
  voorbeeldvenster, Markdown/HTML-download en afdrukken. Sjabloontaal en context:
  `docs/DOCUMENTEN.md`. Plus het sjabloon **Projectdocument (volgt de mappen)**: hoofdstukken =
  submappen, tekst = de nieuwe **omschrijving van een map** (eigenschappenpaneel), platen = de
  diagrammen in de map.
- **ArchiMate-gedaante "Blokken (informeel)"** (09-10): effen blokken zonder icoon, Grouping als
  laagkader — voor overzichtsplaten. De shape-set is nu **per diagram** bewaard en gegenereerde
  documenten volgen hem.
- Projectsync: de volgorde van regels in de boom (Ctrl+↑/↓) en de mapomschrijving gaan nu mee
  (`schuifPlaatsing`, `zetMapOmschrijving` in `STRUCTUUR_OPS`); een volgordewijziging bleef eerder
  lokaal.

## [studio/v0.14.0] — 2026-10-07
Samenwerken aan een project, eerste trede: het Studio-project krijgt een naam en een id en kan
als geheel naar de server en terug (api 0.11.0). Daaronder ligt de operatielaag die elke
modelwijziging als benoemde operatie vastlegt (nog niet verzonden). Plus projectboom-fixes uit
gebruik. Zie `docs/plans/2026-10-07 Projectsync — eenmalig naar de server, daarna operaties als
events (plan).md` en [`docs/STUDIO.md`](../docs/STUDIO.md) (project op de server, 2026-10-07).

### Toegevoegd
- **Project op de server** (07-10): menu *Project* toont de projectnaam en de sync-stand en heeft
  *Hernoem project…*, *Nieuw project… (huidige parkeren)*, *Naar server sturen* (met
  versiecontrole: bij een conflict kies je overschrijven of afbreken) en *Van server ophalen…*
  (`activities/ProjectServerDialoog.jsx`, lijst van alle projecten van ingelogde gebruikers).
  Het werkbestand "studio-project" is nu **v2** met `project: {id, naam}`; v1 wordt bij import
  opgewaardeerd. Samenwerken is hiermee "om de beurt". Eigen profielen/vormen/iconen (M2) en
  klassieke editors reizen niet mee.
- **Operatielaag** (07-10, `studio/sync/operaties.js`, `sync/outbox.js`): model-, structuur- en
  kruisverband-acties worden benoemde operaties `{store, op, args}`; een diff-vangnet meldt wat
  buiten de acties om verandert (undo/redo, migraties). Operaties van een ander worden toegepast
  met de undo gepauzeerd én gerebased. De outbox blijft in het geheugen tot de verzender er is
  (`studio-outbox-persist=1` zet persistentie aan voor ontwikkeling).
- **Hele groepen naar een map** (06-10): rechtsklik op een typekop in de elementen-browser →
  *Selecteer alle N* of *Verplaats alle N naar map ▸* (bestaande map of *Nieuwe map…*); het
  contextmenu van een element heeft *Verplaats naar map ▸*. Eén undo-stap per bundel.
- **Projectboom** (07-10): elementregels hernoemen inline (F2, nog eens klikken, dubbelklik);
  **Shift+klik** selecteert een bereik binnen dezelfde lijst; de eerste **Ctrl+klik** neemt de al
  geselecteerde regel mee, zodat de bundel als geheel sleept.

### Gefixt
- **Slepen uit de projectboom naar het canvas** gaf een verbodsbord (ook in 0.13.0): de canvas
  zette `dropEffect "link"` terwijl de bron `"copyMove"` toestaat; de canvas kiest nu een
  toegestaan dropEffect. Droppen op een kader maakt het element lid.

## [studio/v0.13.0] — 2026-10-07
Canvas-bediening in Omnium Studio: inline hernoemen (ook van velden en relatienamen), een
verbind-modus vanaf het hele vlak, kaders die hun inhoud meeslepen, en een reeks kleine ergernissen
uit gebruik. Alleen frontend; api blijft 0.10.0, render-svc 0.1.0. Details per onderdeel in
[`docs/STUDIO.md`](../docs/STUDIO.md) (canvas-bediening, 2026-10-07) en BACKLOG §31.11.

### Toegevoegd
- **Inline hernoemen** (07-10): op het canvas met **F2**, dubbelklik, of een klik op de naam, op een
  veldregel (attribuut van een klasse) of op een relatienaam — het veld ligt óp de tekst en neemt
  maat en letter over (`NaamEditor.jsx`, `InlineNaamContext`). In de projectboom en de
  elementen-/diagramlijst met F2 of een klik op de al geselecteerde regel; de `window.prompt`-popup
  is weg. Hernoemen trekt naam-verwijzingen door (attribuuttype `typeLabel`; `model/hernoemen.js`,
  één undo-stap).
- **Verbind-modus** (07-10): met **Shift** begint een sleep vanaf élke plek op een vorm een lijn
  (vlak-handle), en tijdens het slepen is élke plek op een doelvorm losplek; React Flow in
  `loose`-modus met vangstraal 24. Gemeld: vanaf een use case (ellips) greep een lijn slechts op één
  punt.
- **Informeel kader** in het use case-profiel (zoals puur-uml), en kaders slepen hun inhoud mee
  (`ElementType.sleeptInhoudMee`, M3) — zonder modelrelatie; het systeemkader blijft de formele grens.
- **Beeld → Taakbalken op een rij bovenin**: balken liggen standaard automatisch op één rij bovenin
  (doorlopend naar een tweede rij als het canvas te smal is); zelf slepen zet dat per balk uit.
- **Diagram verwijderen** via het contextmenu van de diagramregel in de projectboom, voor elk profiel.
- **Slepen uit boom of lijst naar het diagram**, ook óp een container (systeemkader, package, pool):
  het element wordt dan meteen lid.
- **Transformatie "Use case-model → Mermaid flowchart"** (06-10): de terugweg van de import.
  Schrijft de use case-diagrammen van een map als `.mmd`, één flowchart per diagram, met
  toelichtingen als notities. Roundtrip getest: import → export → import geeft hetzelfde model en
  een tweede export dezelfde tekst. Nieuw in `src/transformatie/`: `modelNaarGraaf.js` (graafbeeld
  van een model als bron voor een regelset) en `mermaidSchrijver.js` (de Mermaid-schrijver). Zie
  [`docs/TRANSFORMATIES.md`](../docs/TRANSFORMATIES.md) §6.

### Gewijzigd
- Naamloze kleine vormen (begin/eind, gateway) heten in lijsten naar hun type, "(Begin)", niet naar
  hun id (`weergaveNaam.js`).
- Een geselecteerde lijn wordt niet meer dikker (de pijlpunt schaalde mee) maar gekleurd met een
  zachte gloed eronder.
- `ElementType.minBreedte`/`minHoogte` sturen ook de CSS-minima van de shape (activity-actie kan
  nu 100 px smal); de resizer gaat nooit onder het minimum van de shape zelf (`ShapeResizer`).
- Compacte taakbalkknoppen zijn 30×30, zodat Maken, Verbinding en Uitlijnen even hoog zijn; de
  balkbreedte wordt alleen nog bewaard als je zelf aan de hoekgreep trekt.
- "Kinderen in boomstijl" is één undo-stap (store-actie `updateElementen`).

### Opgelost
- Resizen vanaf de linker-/bovenrand: de positie wordt samen met de maat bewaard en blijft tijdens
  het trekken live (eerder haalde de bovenrand omlaag trekken de onderrand omhoog en sprong de node
  daarna terug).
- Hernoemen van een datatype ververste het attribuuttype in de klasse niet.
- Boomrijen van de elementenlijst gaven bij slepen de element-referentie niet mee, zodat een drop op
  het diagram niets deed.

## [studio/v0.12.0] — 2026-10-06
Gebruikersbeheer in de Studio: accounts, rollen en wachtwoorden als activiteit, en uitloggen in de
menubalk. Backend: api 0.10.0 in [`RELEASE.md`](../../RELEASE.md).

### Toegevoegd
- **Activiteit *Gebruikers*** (groep beheer, 06-10): accounts, rollen en wachtwoorden op het
  nieuwe gebruikersbeheer (domein `beheer`, `docs/AUTH_DEVELOPER_GUIDE.md` §11). Iedereen die is
  ingelogd wijzigt er zijn eigen wachtwoord (lijn-oogje per veld zoals in Imprint; zodra de
  herhaling afwijkt staat er meteen een melding onder en kan het formulier niet weg); admins maken gebruikers aan
  (de server maakt een wachtwoord dat je één keer ziet), voegen rollen toe met een optionele
  einddatum, trekken rollen in, blokkeren, deblokkeren en beëindigen accounts. Elke wijziging is een
  registratie. Je eigen admin-rol, blokkeren en beëindigen staan voor je eigen account uit.
- **Uitloggen in de Studio** (06-10): rechts in de menubalk staan je naam en rol en een knop
  *Uitloggen* (`StudioGebruiker.jsx`); klik op je naam opent *Gebruikers* (eigen wachtwoord). Na het
  uitloggen toont de Studio het inlogscherm. De inhoud-editor, publicatie en het dashboard hadden
  dit al (`GebruikerBadge`).

## [studio/v0.11.0] — 2026-10-06
Modelleren en uitwisselen: het GraphQL-schema als profiel, transformaties in een vaste vorm, de
ODRL-export voor de viewer van de werkgroep FTV en modeldiagrammen als SVG voor Imprint. Backend:
api 0.9.0 in [`RELEASE.md`](../../RELEASE.md).

### Gewijzigd
- **Kaart van Nederland** (29-09):
  - elke stip staat op de mediaan van de adressen van de gemeente, niet op het middelpunt van
    het vlak (Rotterdam stond op de Maasvlakte);
  - de kaders met Caribisch Nederland staan er altijd (`caribbean: false` om ze te verbergen);
  - in de weergave is de toetsenhulp alleen voor schermlezers;
  - een lege groep verdwijnt uit de legenda.

### Toegevoegd
- **Toegangsspraak → ODRL (ODRL-AP-NL) als Turtle** (05-10): een tweede export naast de
  JSON-LD uit de editor, in de transformatievorm graafbeeld → regelset → schrijver.
  - `toegangsspraak/graaf.js`, `odrlApNlRegels.js` en `odrlExport.js`; de uitvoer volgt de ODRL
    Visualisation Note, zodat de ODRL-viewer van de werkgroep FTV het beleid als document toont.
  - **Eerste schrijver**: `transformatie/turtleSchrijver.js` (plan → triples → Turtle, met een
    contexttabel zoals een JSON-LD-context).
  - De toepasser geeft een getypeerde waarde uit één kale placeholder ongemoeid door.
  - Nog geen menu-ingang; voorbeelden en runner in `authz/odrl-viewer-voorbeelden/`.
- **Transformatie "Mermaid flowchart → use case-model"** (05-10). Importeert een Mermaid
  flowchart (bestand of geplakte tekst) als use case-model: actoren, use cases, geneste
  systeemkaders, include/extend/generalisatie; notities worden de toelichting van hun element.
  - Eerste transformatie in de vorm lezer → regelset → toepasser (`src/transformatie/`); de
    afbeelding staat als leesbare regels in `diagramprofielen/usecase/mermaidRegels.js`. Zie
    [`docs/TRANSFORMATIES.md`](../docs/TRANSFORMATIES.md).
  - Transformatiepaneel: bij importeren kan de bron ook geplakt worden.
  - Use case-profiel: eigenschap *Toelichting* op actor, use case en systeemkader; een
    systeemkader mag een systeemkader bevatten; een lange actornaam breekt niet meer op de
    breedte van de strekfiguur.
- **GraphQL-schema-profiel** (02-10): het typesysteem van GraphQL als diagramprofiel (M2) op de
  generieke motor (`diagramprofielen/graphql`, activiteit "GraphQL", preview via Modelleren).
  - Elementtypen: schema, type, interface, union, enum, input, scalar en directive, alle op `class-box`.
  - Importeer en exporteer SDL (`.graphql`) met een eigen parser, zonder dependency. De export is
    deterministisch; schema-meldingen komen als commentaar bovenaan.
  - Veld- en argumentlijnen worden afgeleid uit de velden; de kardinaliteit volgt uit `!` en `[ ]`.
  - Schema-validatie: onbekende typen, typen op de verkeerde positie, ontbrekende interface-velden,
    lege unions en enums, en de query-root.
- **SVG-tekenaar voor modeldiagrammen** (30-09): `src/diagramsvg` tekent een V3-model als pure SVG,
  zonder DOM en zonder `<foreignObject>`, met dezelfde mapping en auto-layout als de Studio.
  - De render-API van de backend gebruikt hem via de sidecar `render-svc`; zie
    [`docs/RENDER_API.md`](../docs/RENDER_API.md).
  - Keuze van de weergave: een opgeslagen diagram, één domein of een lijst entiteiten; licht,
    donker of meebewegend met de site via CSS-variabelen. Dezelfde invoer geeft byte-gelijke SVG.
- **Kaart van Nederland: toetsenbord en zoeken** (28-09).
  - Pijltjes lopen naar de buurstip in die richting, niet meer alfabetisch.
  - Shift+↑/↓ gaat per beginletter, Shift+←/→ alfabetisch.
  - Een zoekveld zoekt op gemeente en woonplaats; typen op de kaart gaat erheen. Zo is kiezen ook
    te doen waar het druk is.
  - De bedieningstekst is aangepast (vormenregister en `vorm-nl-map`).
- **`scripts/maak_uitleg_correctie.py`**: de tekst van een uitleg wijzigen in één replay (afvoer +
  opvoer).

### Opgelost
- **Kaart van Nederland: Urk en Medemblik op een dijk** (28-09). De eerste reparatie gebruikte het
  middelpunt van de woonplaats, en ook dat vlak bevat water. Urk kwam zo op de Houtribdijk. Nu de
  mediaan van de adressen van de gemeente. De test controleert de afstand tot de hoofdplaats.
- **Aanmelden** (05-10): de technische teller "n opvoeren in één registratie" staat niet meer op
  openbare formulieren.
- **V3-import**: velden met `goType` `integer`, `number` of `boolean` (de JSON-Schema-namen uit
  Imprint) werden `string`; ze houden nu hun type.

## [studio/v0.10.0] — 2026-09-28
Het werk voor het Common Ground-portfolio (pf.common-ground-lab.nl), 22–28 september. Backend:
api 0.8.0 in [`RELEASE.md`](../../RELEASE.md).

### Toegevoegd
- **Publicatie en embed.**
  - Een kale embed-modus voor de iframe op commonground.nl, in de opmaak daarvan (Rijksoverheid
    Sans).
  - Een detailpagina in de commonground-opmaak, met `{{#if}}`-blokken, template-paden die op
    het GraphQL-schema worden afgestemd, en weergavevormen in detail-templates
    (`{{#vorm naam pad}}…{{/vorm}}`).
  - Lijst en detail lezen via opgeslagen documenten (QueryDefinitie).
  - Een tweede weergave naast de standaard (`?weergave=<code of id>`), met de weergaven
    *Initiatief met vormen* en *Initiatief v2*.
- **Formulieren.**
  - Een nieuw-modus voor FormulierDefinities, het openbare `aanmelden.html` (met "Wat je hebt
    ingevuld" na het verzenden), en een nieuwe doelentiteit vanuit een relatieveld
    (`nieuwFormulier`).
  - Meerkeuze op referentielijsten (chips + zoekveld), en *Bewerken via*: een record bewerken met
    een gekozen formulier.
  - `code` op definities (`?formulier=`, `?lijst=`, `?weergave=` met code).
- **Invoersoort en vorm gescheiden, met een vormenbibliotheek:**
  - `image-map`, `button-group`, `cards`, `nl-map`, `switch`, `range`, `rotary`, `stepper`,
    `rating-grid`, `drag-sort`, `period`, `address-search`;
  - `masked`, `partial-date`, `duration`, `number-stepper`, `color`, `tag-input`, `markdown`,
    `code`, `ranking`;
  - de weergavevormen `scale-bars` en `chips`;
  - configSchema's per vorm, de vorm in het formulierprofiel, en de showcase `vormen.html`.
- **Validatie bij het invullen** volgens het datatype (patroon, 11-proef, mod-97, …), met een
  gedeelde testset met de backend.
- **LijstDefinitie**: de kolommen van het overzicht als data, en het formulier waarmee een rij
  opent.
- **Dashboard** (`dashboard.html`): tegels op QueryDefinities.
- **AI-assistent.**
  - De vorm `ai-assist`: een voorstel doen en bijsturen, waarna de mens beslist.
  - De invulhulp: een formulier voorinvullen uit een tekst of webpagina.
  - Een eigen sleutel (Claude, DeepSeek, Alibaba, OpenAI-compatibel) of een toegangscode, het
    kiezen van een model, en de Studio-activiteit *AI-toegang*.
- **Uitleg bij een vraag: het (i)-rondje** (28-09). Een losse, vertaalbare uitleglijst
  (entiteit `Uitleg`, code + taal, soort `inhoud` of `vorm`) met `uitleg`/`uitlegTekst` op veld,
  groep en lijst, plus de bediening van de vorm (uit de lijst als `vorm-<naam>`, anders het
  vormenregister). Toegankelijk als disclosure, in te stellen in de
  formuliereditor. Zie `docs/FORMULIERDEFINITIES.md` §2.5.
- **Kaart van Nederland (`nl-map`): Caribisch Nederland** (28-09). Bonaire, Saba en Sint Eustatius
  (GM9001–GM9003) in kaders linksboven, zodra ze in de referentielijst staan.

### Opgelost
- **Actuele data:** een afgevoerde hub telt niet meer mee, ook niet als terugval
  (`shared/actueleData.js`). De inhoud-tabel toont alleen actuele hubs.
- **Inhoud:** kolomfilter en sortering werken op GE- en relatiekolommen, en relaties zonder
  datavelden tonen hun doel.
- **Formulieren:**
  - verplicht-meldingen verschijnen in de nieuw-modus pas na aanraking of een verzendpoging;
  - de EntiteitCombobox is een echte combobox;
  - FormulierDefinities worden met `size=1000` opgehaald (de standaardpagina was 20).
- **Vormen:** de keuzekaarten waren onleesbaar in het donkere Studio-thema.
- **Kaart van Nederland: stippen in het water** (28-09). Bij 12 gemeenten met veel water (Urk,
  Hoorn, Vlissingen, Waddeneilanden, …) lag de stip in zee; nu op de eigen woonplaats, op land.
  Met een test op de kaartdata.
- **(i)-uitleg:** openen markeerde het veld als aangeraakt, waardoor *verplicht* verscheen.

## [studio/v0.9.0] — 2026-09-22
### Toegevoegd
- **GE opnemen in de entiteit.** Per diagram kan een gegevenselement ín zijn entiteit
  getoond worden als sub-vak (*opname*); de compositielijn vervalt dan en andere lijnen
  van de GE hangen aan de entiteit. Declaratie `ElementType.opname`, beslisplek
  `diagramcore/canvas/opname.js`; contextmenu op GE, compositie en entiteit.
- **Velden bewerkbaar in canoniek-uml**, zoals in de oude IDE: van de GE (typenaam, domein,
  beschrijving, meervoud, materieel, kleur, label heen/terug), van de compositie (rolnaam,
  JSON-rolnaam, momentvoorkomen, kardinaliteit), van de entiteit (beschrijving, meervoud,
  materieel, kleur, subtype) en van de relatie (o.a. kardinaliteit bron/doel, label
  heen/terug, gericht, geordend). Het stereotype volgt het subtype.
- **Magic link.** Een lijn slepen zonder gekozen verbindingstype: één passend type wordt
  direct gelegd, bij meerdere verschijnt een keuzemenu op de losplek. Een gekozen type dat
  hier niet mag verdwijnt niet meer stil; het menu legt uit waarom en biedt alternatieven.
  Werkt ook op het lege vlak (of het vlak van een container): nieuw element, lidmaatschap
  en verbinding in één gebaar. Canvasmenu's zijn met het toetsenbord te bedienen.
- **Containers houden hun inhoud vast.** Leden die ín hun container liggen reizen mee en
  zijn begrensd door de rand (Alt+slepen tilt eruit); een nieuw element dat in een
  container belandt wordt er meteen lid van. Presentatie relatief, opslag absoluut: geen
  migratie. `diagramcore/canvas/nesting.js`.
- **Afbakening (pools).** Motor-primitief `ElementType.afbakeningVoor` en
  `ConnectorType.overbrugt`; het menu noemt de reden van een weigering. BPMN-pool is de
  eerste afnemer: sequence flow binnen de pool, message flow ertussen of aan de poolrand.
  `diagramcore/canvas/afbakening.js`.
- **Reconnect.** Het uiteinde van een lijn verhangen; het type blijft gelijk, knikpunten
  vervallen, een weigering wordt uitgelegd.
- **Zoekende combobox voor relatievelden** (inhoud-editor). Op de nieuwe-entiteitpagina
  heet de secundaire id-kolom van een relatie naar de doel-entiteit ("gemeente" in plaats
  van `gemeente_id`); bij een referentielijst-item verschijnt een `RefCombobox` met
  zoeken op de server, in plaats van een op 100 afgekapte keuzelijst. Overige doelen
  pagineren over `/full/`.

### Gewijzigd
- **Het profiel is de bron van de veldnamen** voor heenreis, terugreis en migratie
  (`mappingV3Canoniek.js`: `vertaalbareVelden(elementType)`); de vaste veldlijsten
  vervallen. Een alleen in het profiel toegevoegde property gaat vanzelf mee, bewaakt
  door `mappingV3Canoniek.test.js`.
- **Verdelen** gebruikt gelijke tussenruimte in plaats van gelijke linkerranden;
  aangehechte rand-elementen en label-ankers doen niet mee aan uitlijnen en verdelen.
- **Escape** maakt de hele selectie leeg (nodig binnen containers en na een kader-selectie).
- **Tekenen zet de aanhechting niet meer vast.** Bij zwevende randaanhechting bewaren
  tekenen, verhangen en de magic link geen handle; Shift bij het loslaten zet hem wél
  vast. In BPMN zweven taak, subproces, data-object, pool en lane; events en gateways
  houden hun vier punten.
- **Migratie van oude sandboxes.** Een vóór 15 september geladen sandbox had ENT ◆ GE nog
  als presentatie-edge; die worden bij het laden compositie-connectoren.
- **Frontend-image instelbaar zonder nieuwe build** (raakt de bundle niet): de
  nginx-config is een template met `API_UPSTREAM` (welke backend), `FRAME_ANCESTORS`
  (wie de Studio in een iframe mag tonen) en `NGINX_RESOLVER`; de defaults geven het oude
  gedrag. Zie `deploy/frontend/default.conf.template` en `docs/VPS_DEPLOYMENT.md` §9.

### Gerepareerd
- **502 na het opnieuw aanmaken van de API-container.** nginx onthield het oude IP-adres
  van de API; de frontend moest dan mee herstart worden. De nieuwe image zoekt de API per
  verzoek op en antwoordt direct na een IP-wissel (gemeten; de oude config bleef op 502
  hangen).
- **Universum: dubbelklik naar objecten werkt weer.** Bij een groot metamodel stond de
  node bij de tweede klik al niet meer onder de cursor; zo'n misklik wordt nu opgevangen
  (binnen 400 ms en 12 px). Een entiteit zonder objecten of een mislukte fetch geeft een
  korte melding in plaats van stil op het metaniveau te blijven.
- **GraphQL-veldnamen met koppelteken** (`nl-titel`) worden `nl_titel`, zoals de backend ze
  aanbiedt; Kennisartikel en Trefwoord gaven een syntaxfout.
- **`RefCombobox`**: ▼ toont de eerste opties, geen "Geen resultaten" tijdens het wachten,
  verouderde zoekantwoorden worden genegeerd, minimale breedte in smalle rijen.

### Let op bij uitrol
- De Studio roept `/admin/rebuild/` en `/admin/diff/` aan. Vanaf **api 0.7.0** bestaan die
  routes alleen in een API-build met `-tags devtools`; zie `RELEASE.md`.

## [studio/v0.8.0] — 2026-09-16
### Toegevoegd
- **OpenAPI → canoniek model.** Nieuwe transformatie onder *Transformeren →
  importeren*: `components.schemas` uit een OAS-document wordt een canoniek
  model (`oasNaarV3.js` puur, `oasCanoniekImport.js` als descriptor), met
  diagnostics per schema. Eerste stap — `paths`/operations en generalisatie
  via `allOf` blijven bewust liggen (backlog §29.7).
- **Doorkijk over relaties in de modelboom.** `bouwModelTree` kreeg de optie
  `relatieDiepte` (default 0, dus ongewijzigd voor bestaande activiteiten; de
  toegang-activity zet 2), zodat beleidsketens over registergrenzen resolven —
  "de wijk van de woonlocatie van een natuurlijk persoon". `ModelPicker` kreeg
  dezelfde prop; `modelpicker/veldenlijst.js` deelt de platte veldenlijst met
  de activity. Doorkijk-takken zijn gemarkeerd met `↗`.

### Gewijzigd
- **Composities (ENT ◆ GE) zijn connectoren.** De heenreis van het
  canoniek-uml-profiel vouwt structurele ENT→GE-edges tot een
  `compositie`-connector, net als relaties sinds fase 3B; de core leidt de
  lijn af op elk diagram waar beide uiteinden staan. Labels komen uit
  `hooks.edgeLabels`. **Let op:** de sandbox persisteert — een al geladen
  model krijgt de connectoren pas na *Bestand → Importeer V3 JSON…* of
  *Herlaad uit UML-model…*. Label-offsets van de oude edge gaan daarbij
  verloren (backlog §29.10).

### Gerepareerd
- **Verdwenen compositielijnen.** Modellen uit de eerste umleditor bewaren
  kale zijden als handle (`"left"`, `"bottom"`); React Flow weigert zo'n edge
  **stil**, waardoor de lijn zonder melding verdween. `normaliseerHandle()`
  zet ze om, voor connectoren én opgeslagen presentatie-edges. Werkt direct,
  ook op een al geladen model.
- **OAS-import sloeg verwijzingen plat.** `allOf: [$ref X]` op property-niveau
  werd een tekstveld (6 relaties weg in de OpenOrganisatie-casus) en
  `oneOf: [Enum, BlankEnum]` werd stil genegeerd. Beide met regressietest.

## [studio/v0.7.2] — 2026-09-10
### Gerepareerd
- **Help-menu gaf "Markdown file not found" in productie.** De link wees op
  `/docs/bitemp_register_v06/docs/STUDIO.md`, dat de API alleen kan renderen
  als hij vanuit een git-checkout draait (`findProjectRoot` zoekt een
  `.git`-map); in de Docker-image zit alleen de binary. Wijst nu naar
  STUDIO.md op GitHub. Structurele fix (gecureerde docs in de image +
  `DOCS_ROOT`) staat op de backlog.

## [studio/v0.7.1] — 2026-09-10
### Gerepareerd
- **Profiel-editor liet de hele Studio crashen in productie.** Openen gaf
  `Setting the value of 'studio05-profiel-ontwerp' exceeded the quota`, en
  omdat `studio-shell` onthoudt welke activiteit open stond crashte hij bij
  elke herlaad opnieuw — de Studio was daarmee onbereikbaar tot je
  `localStorage` leegde. Oorzaak: `herlaadUitModel` materialiseert alle
  twintig geregistreerde profielen tot ontwerp-diagrammen naast elkaar, en
  die hele bak ging als één waarde naar `localStorage` (~5 MB per origin).
  Alleen zichtbaar in productie: in dev vangt de `studio05Map`-plugin uit
  `vite.config` de opslag af naar bestanden in `web/vite/`, zonder limiet.
  De editor heeft die persistentie niet nodig — zijn inhoud is afgeleid en
  wordt bij openen opnieuw opgebouwd; de layouts staan apart in
  `studio05-profiel-layouts`. `persistKey` is daarom verwijderd.

## [studio/v0.7.0] — 2026-09-09
### Gerepareerd
- **Diagram-export sneed tekening af.** Het kader kwam van `getNodesBounds`
  (alleen de node-boxen uit het model). Alles wat daarbuiten getekend wordt
  viel weg: de satelliet-velden van de graaf-bol, buitenlabels, bochtige of
  geknikte lijnen, edge-labels en rand-elementen (relatieve kind-positie). Het
  kader wordt nu aan de DOM gemeten (`diagramcore/export/tekenBounds.js`).
- **Selectie-export**: tekent alleen nog de selectie — geen half-afgesneden
  buren meer in de rand, en zonder de blauwe resize-lijntjes van een
  geselecteerde node. Lijnen buiten de selectie bleven eerst nog wél staan:
  html-to-image kloont een `<svg>` in één keer diep en negeert daarbinnen het
  `filter`, en React Flow zet elke edge in zo'n `<svg>`-wikkel.

### Gewijzigd
- **Kader-selectie** (Shift+slepen) neemt geen lijnen meer mee naar elementen
  buiten het kader; een lijn hoort pas bij de selectie als beide uiteinden erin
  zitten.

## [studio/v0.6.0] — 2026-07-29
### Toegevoegd — Toegangsspraak & Toegangsregel
- **Toegangsspraak-editor**: ontleding van regeltekst met autocomplete,
  element-focus, bijzinsvolgorde, spans en koppeling aan het metamodel;
  structuurwoorden en modaliteit-kleur, plus een canonieke tab.
- **Existentie-voorwaarden** ("er is een lopend dossier voor de betrokkene").
- **Toegangsregel-profiel** op de diagram-motor: read-only Diagram-tab (stap 1–2),
  policy + map en kruisverbanden (stap 3), kolom-resolutie naar echte
  canoniek-elementen, **de terugweg** diagram-model → tekst (stap 4), en
  **ArchiMate-koppeling** naar wet, doel en begrippen (stap 5 v0).
- **Vormentaal**: de zin als silhouetten; lijnlabels alleen op structuur,
  layout blijft heilig bij herpubliceren.

### Toegevoegd — diagram-motor & notaties
- **Sequence v1 — hermetisch minimum** (ontwerp "Sequence hermetisch" §5.1):
  getypeerde levenslijnen via het nieuwe cross-profiel **instantie-van**-concept
  (datatype "element-verwijzing"; kop toont `naam:Type` onderstreept; element
  uit de boom op de lijn droppen typeert hem), **OperatieResolver-facet** per
  profieltype (puur-UML-operaties, OAS-operations) en **operatie-keuze op
  berichten** (label = signatuur, met argumenten-veld).
- Core: `onExternDrop` op de canvas + `ELEMENT_REF_MIME` (cross-profiel
  drag-and-drop referenties) + descriptor-hook `hooks.ontvangtDrop`.
- **Sequence-profiel (v0)**: levenslijnen (smalle hoge node met naam-kop);
  punten (occurrences) en activaties als rand-elementen die op de lijn
  klemmen en meebewegen; sync/async/retour-berichten;
  alt/opt/loop/par-fragmenten. Volgorde = y-positie (as-primitief = v1).
- Core: `elementType.minBreedte`/`minHoogte` voor de NodeResizer
  (smalle balken zoals activaties resizen nu correct).
- **BPMN-profiel op de eigen motor (v0)**: taak, subproces (doorklik), events
  met soort (bericht/timer/fout/signaal), boundary events op het
  rand-primitief, gateways ×/+/○, lane, data-object; sequence flow met
  [conditie], message flow. Naast de bestaande bpmn.io-activiteit.
- **ArchiMate-profiel (v0)**: ~22 elementtypen over vier lagen in de
  laag-kleuren (archimate-box met type-icoon rechtsboven), junction (en/of)
  en alle elf relaties; geldigheidsmatrix volgt in v1.
- Core: property-datatype **"keuze"** (select over `PropertyType.opties`).

### Gewijzigd
- Core: **lijndikte per connector** (`presentatie.dikte`).
- Kaderselectie selecteert wat het raakt; node-acties in het selectie-menu.

### Gepubliceerd
- Docker: `markwestbroek/bitemp-viz-frontend:0.6.0` + `latest`
  (zie [`docs/DOCKER_RELEASE.md`](../../docs/DOCKER_RELEASE.md)).

## [studio/v0.5.0] — 2026-07-17  _(bij merge van `feat/diagramcore-gedrag-primitieven`)_
### Toegevoegd
- **Gedragsdiagram-primitieven in de diagram-motor** (STUDIO-05-gedragsdiagrammen §3):
  - **rand-aanhechting** (`elementType.randElement`): elementen die vastklikken op de
    omtrek van een gastheer en meebewegen (entry/exit-points, pins; straks BPMN
    boundary-events);
  - **gedragsverwijzing** (`elementType.gedragsVerwijzing` + property-datatype
    `diagram-verwijzing`): dubbelklik opent het gekoppelde diagram (ook als tab in
    Modelleren), ⧉-badge op de node.
- **State machine v1**: keuze, junction, historie (Ⓗ/Ⓗ*), samengestelde toestand
  (container), submachine met doorklik, entry/exit-points op de rand.
- **Use case-profiel** (nieuw): actor, use case, systeemkader;
  associatie/«include»/«extend»/generalisatie.
- **Activity-profiel** (nieuw): acties, beslissing/samenvoeging, fork/join,
  object nodes, pins (rand), aanroep (CallBehaviorAction, doorklik), partities;
  controle- vs objectstroom, "[guard]"-labels.
- **Sprekende taakbalken**: eigen vorm-glyphs per elementtype
  (`gedragTypeIconen.jsx`, koppelvlak plan §8.6a) + **eigen tooltips** met naam
  en één-regel-omschrijving (`ElementType.omschrijving`); toggle in
  Studio-instellingen → Taakbalken.
- **Gedeelde naam-modal** (`vraagNaam`) vervangt `window.prompt` bij
  diagram-aanmaak (ook in de Modelleren-host).
- Plan: **ArchiMate en verdere notaties** (ArchiMate v0–v2, C4, SysML, ERD, OWL,
  mindmap) — `docs/plans/2026-07-17 ArchiMate en verdere notaties (plan).md`.
### Gewijzigd
- Handles zijn hulpchrome: overal klein en gedempt tot hover/selectie; op
  punt-nodes (junction e.d.) liggen ze búiten de vorm — kern blijft sleepbaar.
- Lidmaatschaps-lijnen (bevat) verbergen zichzelf zolang het lid geometrisch
  ín zijn container ligt (`edgePresentatie.verbergBijNesting`).
### Opgelost
- "Nieuw diagram" deed niets bij koppeling-profielen (canoniek/MIM): de
  auto-herlaad-guard telde alleen `elements`, waardoor een net aangemaakt leeg
  diagram werd overschreven; guard telt nu ook `diagrams`.
- `.dc-node` was content-box → shapes staken buiten hun node (scheve handles);
  nu border-box, exact gevuld en gecentreerd.
- Begin/eind-pseudotoestanden werden overwoekerd door de standaard-handles.

## [studio/v0.4.0] — 2026-07-16  _(bij merge van `feat/formulier-editor-studio`)_
### Toegevoegd
- **Visuele FormulierDefinitie-editor** als nieuwe Studio-activiteit "Formulieren"
  (balkgroep *Presentatie*): palette (ModelPicker) → veld met padadressering `ENT.GE.veld`
  → structuur-boom → inspector → live preview via `CustomFormulierRenderer`.
- **Opslaan naar register**: definitie als nieuwe `FormulierDefinitie` (max-id + opvoer).
- **Meervoudigheid** via het `lijst`-element: auto-wrap van meervoudige velden, herhaalbare
  sectie met item toevoegen/verwijderen; per-item opvoer/afvoer bij opslaan.
- Renderer-uitbreidingen (backwards compatible): label-/beschrijving-override, object-condities,
  padgebaseerde veldadressering naast korte namen.
### Gewijzigd
- `EntiteitFormulier`: mapping/save geëxtraheerd naar pure, geteste `customFormMapping.js`.

## [studio/v0.3.0] — 2026-07-14
### Toegevoegd
- Grafische kruisverband-view (fase 4) en kruisverbanden-matrix.
- Transformatie-generatoren (bv. "Map → Markdown-overzicht") op de map.
- State-machine-profiel v0 (gedragsdiagram).
- Diagram/selectie exporteren als afbeelding (PNG/SVG + klembord) + export-voorkeuren.

## [studio/v0.2.1] — 2026-07-13
### Toegevoegd
- Koppelingen v0 (kruisverbanden-matrix) + transformeren-raamwerk (import/export/transform).
- Studio-versie zichtbaar in de UI; versionering-conventie vastgelegd.
### Gefixt
- Prism-syntaxkleuring in de productiebundel.

## [studio/v0.2.0] — 2026-07-12
### Toegevoegd
- Consolidatie fase 0–2: Modelleren-tab-host (klassieke editors als profieltype),
  projectboom met mappen/hiërarchie/contextmenu's, project-werkbestand.
- Structuur-undo (Ctrl+Z) + multiselect in de elementen-onderboom.
- Shape-/icoon-editor in de Studio-instellingen.

## [studio/v0.1.0] — 2026-06-17
### Toegevoegd
- Raamwerk van de geïntegreerde werkbank (VS Code-schil): activity-registry, auto-hide
  panelen, menubalk; eerste activiteiten (UML/canoniek model, DMN, BPMN, berichten).

---

Vóór `studio/v0.1.0`: de frontend deelde commits met de backend; niet per component te
reconstrueren (zie `git log`).
