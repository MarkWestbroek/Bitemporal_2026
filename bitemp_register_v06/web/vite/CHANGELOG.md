# Changelog — Frontend / Omnium Studio

Alle noemenswaardige wijzigingen aan de web-frontend (`web/vite/`: Studio-werkbank,
inhoud-editor, publicatie, IDE). Formaat: [Keep a Changelog](https://keepachangelog.com);
versionering volgens [`docs/versiebeheer.md`](../docs/versiebeheer.md) (prefix `studio/`).

De single source of truth voor het nummer is `package.json` `"version"`.

## [Unreleased]

### Toegevoegd
- **Inhoud-editor: materiële elementen als lijst van voorkomens** (27-10). Een materieel GE of
  materiële relatie (ook enkelvoudig, zoals MeldingStatus) toont zijn voorkomens op volgorde van
  aanvang, met aanvang, einde en het label **nu**; **+ Nieuw voorkomen** legt een opvolger vast
  (de engine geeft het vorige automatisch een einde). Bij tijdprecisie `tijdstip` vul je datum én
  tijd in (RFC 3339 naar de API). Aanvang of einde corrigeren wordt een eigen opvoer op
  `_Aanvang`/`_Einde`. Zie [`docs/inhoud-editor-technisch.md`](../docs/inhoud-editor-technisch.md) §8b.
- **Objecttype: overerving en partijen met een rol** (27-10, regelset canoniek-naar-objecttype
  0.2.0). Een subtype (`erft`) geeft één schema met de velden van de ouder; een relatie met eigen
  velden (AanvraagPartij met `partijrol`) wordt een lijst van {partijrol, partij}; velden binnen
  het doel van een relatie zijn niet verplicht; het e-dienstmodel kan namen geven
  (`projectie.namen`). Eerste gebruik: aanvraag v2 en de gehandicaptenparkeerkaart-aanvraag. Zie
  [`docs/TRANSFORMATIES.md`](../docs/TRANSFORMATIES.md) §11.5.
- **Inrichting van e-diensten: objecttype uit het canonieke model** (25-10). Een transformatie
  "canoniek model + e-dienst → objecttype (JSON Schema)" voor Open Object, als artefact in de vorm
  van het inrichting-register op Fundament (herkomst, trace per modelknoop, hash = sha256 over
  JCS/RFC 8785), met een runner (`scripts/maak_inrichtingsartefact.mjs`) die het artefact schrijft
  en met een bestaand artefact vergelijkt. Nieuw in `src/transformatie/`: `v3Graaf.js`
  (samengestelde bron), `jsonSchemaSchrijver.js`, `jcs.js`. De gedeelde datatypen staan als
  snapshot in `testdata/gegevenstypen.json`, bewaakt door een Go-test. Zie
  [`docs/TRANSFORMATIES.md`](../docs/TRANSFORMATIES.md) §11.

## [studio/v0.24.0] — 2026-10-23

### Toegevoegd
- **ArchiMate: groupings en locaties zijn containers** (20-10, Mark; ArchiMate 3 §4.5): een
  aggregatie of compositie vanuit een grouping of locatie maakt het doel lid. Het lid reist op het
  canvas mee met zijn grouping, slepen erin legt een aggregatie, en de lagen-layout zet het lid in
  de grouping en laat die meegroeien. Ligt een deel in zijn geheel, dan verdwijnt de
  compositie-/aggregatielijn (zoals in Archi); erbuiten blijft hij zichtbaar. Slepen in een
  grouping laat andere relaties van het element met rust. (M3: `containerVoor` mag een lijst zijn.)
- **M3: het superprofiel — notitie, constraint, annotatie-lijn en diagramverwijzing in elk profiel**
  (20-10, Mark): elk profiel erft vier ingebouwde typen (`diagramcore/types/superprofiel.js`). De
  **notitie** (UML Comment) en de **constraint** (UML Constraint: specificatie tussen `{…}` in
  natuurlijke taal, OCL of CEL; lichtblauw ezelsoor) zijn modelinhoud. De **annotatie-lijn**
  (`notitielijn`) gaat van notitie of constraint naar élk element van het profiel — ook in profielen
  die er geen hadden (canoniek, state machine, CMMN, ERD, OAS, GraphQL, …). De **diagramverwijzing**
  (zoals Archi's view reference) wijst naar een ander diagram; sinds 21-10 een gewoon modelelement.
  Een type wordt altijd geërfd; een profiel mag het alleen uit het palet halen
  (`DiagramType.superprofiel = {constraint: {inPalet: false}}`). Een eigen `constraint` van een
  profiel blijft (ArchiMate, MIM, canoniek). ArchiMate's `toelichting`-lijn ging erin op
  (`DiagramType.hernoemdeTypen`, migratie bij het laden; ook de Exchange-import). Ontwerp:
  `docs/plans/2026-10-20 Notities, constraints en doorklikken — het superprofiel (ontwerp).md`.
- **Doorklikken in de Studio** (20-10, Mark): in de eigenschappen kies je bij *verwijst naar* een
  diagram uit élk profiel (gegroepeerd per taal), met ↗ om het te openen. Een element met een
  doorklik krijgt de ⧉-badge; dubbelklik of *Open <diagram>* in het rechtsklikmenu opent het, ook in
  een andere taal (nieuwe tab). De assistent en de MCP kunnen een doorklik zetten
  (`verwijstNaar` in het plan) en zien hem bij wat er al is.
- **Diagramverwijzing** (20-10, Mark): zet met ⧉ in de Maken-balk een verwijzing naar een ander
  diagram (ook in een andere taal) op het canvas; je kiest het doel bij het plaatsen. Hij toont de
  naam van dat diagram, volgt een hernoeming en is doorgestreept als het doel verwijderd is;
  dubbelklik opent het. Een gewoon modelelement: in de projectboom en op meer diagrammen te zetten.
- **Verwijst naar: zoeken in plaats van scrollen** (21-10, Mark): de kiezer in de eigenschappen is
  dezelfde als bij elke verwijzing — keuzelijst per taal plus 🔍 met zoekveld, voor modellen met
  honderden diagrammen. De zoek-popup stak tegen de rechterrand 2 px buiten beeld; gerepareerd.
- **Herkenbare knoppen voor diagramverwijzing en constraint** (22-10, Mark): in de compacte
  Maken-balk hadden ⧉ en { } een nietszeggend doosje als icoon, waardoor de ⧉-knop niet te vinden
  was; nu een eigen icoon.
- **Dubbelklik op de naam opent de doorklik** (20-10, Mark): bij een element dat naar een diagram
  verwijst start de eerste klik op de naam niet meer meteen het hernoemen.
- **Verwezen door** (20-10, Mark): bij een diagram staat welke elementen ernaar doorklikken, uit
  elk profiel — in de eigenschappen van het diagram (boom) en in het lege eigenschappenpaneel als
  er op het canvas niets geselecteerd is. Klik: open een diagram waarop dat element staat.
- **Zoek in projectboom voor een diagram** (20-10, Mark): rechtsklik op het lege canvas; dichte
  mappen klappen open (ook als het diagram als uitwerking onder een element hangt) en de regel licht op.
  Het rechtsklikmenu op het lege canvas begint nu met het kopje **Diagram** (zoeken, de assistent,
  plaatje-link), zoals bij een element het kopje *Element*.
- **ArchiMate-lagen volgen de afhankelijkheden** (20-10, Mark: "in de ene staat alles op één lijn;
  in de andere zou de afhankelijkheid beter gevolgd kunnen worden"). Binnen een laag bepalen de
  relaties boven en onder: wie samenstelt, toewijst of voorgaat staat boven. Een laag met meer dan
  zes elementen naast elkaar slaat om in een volgende rij, in plaats van één lange strook.
  Stijl-optie `maxPerRij`.
- **M3: doorklikken naar een diagram, ook in een ander profiel** (20-10, Mark): elke knoop heeft
  de vaste eigenschap `verwijstNaar` (`{profielId, diagramId}`), zoals EA's composite element —
  in de inspector achteraan, naast de vaste beschrijving vooraan. Niet op connectoren en notities;
  een type zet hem uit met `verwijstNaar: false`. De gedragsverwijzing (`gedragDiagramId` bij de
  activity-aanroep, BPMN en state machine) is er een betekenis-variant van: die property draagt
  `betekenis: "verwijzing"` en ís dan de doorklik, zonder tweede veld. `diagramcore/model/
  verwijstNaar.js` (`doorklikVan`, `normaliseerVerwijzing`); een kale diagram-id blijft "dit
  profiel". De kiezer over alle profielen, het openen in een andere activiteit, de ⧉-badge en
  "Open …" volgen bij OMNIUM-UI. Ontwerp: `docs/plans/2026-10-20 Notities, constraints en
  doorklikken — het superprofiel (ontwerp).md`.
- **Use case: doel, trigger, pre- en postconditie, flow of events; primaire actor** (18-10, Mark;
  naar Cockburn): een use case heeft nu `doel`, `trigger` (met soort: actor, tijd, gebeurtenis),
  `preconditie`, `postconditie` en een vrij `flowOfEvents`; de associatie actor–use case heeft
  `primair` (de belanghebbende wiens doel de use case dient — UML 2 kent het begrip niet, dus
  zonder pijl). Een use case zonder primaire actor én zonder trigger geeft een waarschuwing (hook
  `valideer`, `usecase/controle.js`). De EA-import neemt pre- en postcondities over uit EA's
  constraints (`t_objectconstraint`). Richting voor flows en scenario's: `docs/plans/2026-10-18
  Use case — doel, trigger, condities, flows en scenario's (ontwerp).md`.
- **Use case-layout zoals een modelleur hem zet** (18-10, meting van ARCH-PROJECT tegen Marks
  handwerk in "Omnium architectuur"): een actor staat op de hoogte van zijn use cases, een
  secundaire actor (van wie elke use case al een sterkere actor heeft) rechts van het kader, het
  kader staand — use cases met een actor in de eerste kolom, wat alleen via include of extend
  bereikt wordt in de tweede — en een specialisatie geeft geen eigen kolom (het kind naast zijn
  ouder). Op de vier diagrammen daar: hoogstens één kruising (was 2–5), lijnen even kort of korter
  dan het handwerk, het kader rechtop. Voor alle profielen: de volgorde binnen een laag volgt de
  buren over kadergrenzen heen (een paar rondes), en elk element op het bovenste niveau staat op de
  hoogte van zijn buren. Stijl-opties `secundairAchteraan` en `kaderKolommen`.
- **Primaire actor bepaalt links of rechts** (18-10, Mark: Cockburn, "primair links, secundair
  rechts"): staat op een associatie de eigenschap *primair*, dan komt een actor zonder primaire
  associatie rechts van het kader. Staat *primair* nergens op het diagram, dan geldt de vuistregel.
  Stijl-optie `secundairUit: "primair"`.
- **Meldingen in de inspector**: een profielregel (`hooks.valideer`) laat zijn meldingen bovenaan
  de eigenschappen zien — waarschuwing, fout of info. De use case laat zo "geen primaire actor en
  geen trigger" zien.
- **M3: betekenis en weergave van de auto-layout gescheiden** (18-10, Mark via OMNIUM-UI; M3-MOF):
  `ElementType.aard` zegt wat een type ís — connector: stroom, specialisatie, realisatie, bericht,
  associatie, afhankelijkheid, toewijzing, insluiting, annotatie; element: begin, eind, baan — en
  `ElementType.facetten` deelt in op de facetten van het profiel (`DiagramType.facetten`, geordend;
  ArchiMate: laag en aspect uit het raamwerk). De weergave is een nieuw M3-begrip **LayoutStijl**
  (`DiagramType.layoutStijlen`, per diagram te kiezen): renderer, richting, `alleenStroom`, `rijen`
  per facet en regels die per type kiezen zoals CSS. `regelsVoorStijl` (`diagramcore/types/
  layoutStijl.js`) vertaalt dat naar het formaat dat de leesvolgorde-renderer al leest; registratie
  controleert aard, facetten en stijlen. Activity, BPMN, state machine, CMMN, use case en ArchiMate
  hebben aard/facetten en een stijl; die levert exact de huidige leesvolgorde, behalve dat een
  notitie-lijn (aard annotatie) niet meer meetelt.
- **De auto-layout leest de LayoutStijl** (18-10, OMNIUM-UI): per stijl van het profiel vier
  richtingen (de richting van de stijl eerst; ArchiMate heet nu *Lagen, …*), de afstanden uit de
  stijl, en de minimale maat van lanes, pools en partities uit het type (`minBreedte`/`minHoogte`).
  Het oude `leesvolgorde`-veld in de profielen is weg; `layoutStijlen: []` = geen auto-layout
  (sequence, formulier). De MCP leest dezelfde stijlen (uit `profielen.json`).
- **Profielontwerper: aard, facetten en layoutstijlen** (18-10): *aard* en *facetten* als
  eigenschappen op een elementtype en *aard* op een verbindingsregel; nieuwe knopen **Facet**
  («facet», met de waarden in volgorde) en **Layoutstijl** («layoutstijl»: richting, alleen stroom,
  rijen/kolommen per facet, afstanden, regels als JSON). Werkt beide kanten op: een bestaand profiel
  bekijken toont ze, activeren neemt ze mee.
- **Auto-layout in zes richtingen** (18-10, Mark): de deterministische layouts van de IDE staan nu
  ook in de Studio, voor het canonieke model: gelaagd van boven naar beneden, van onder naar
  boven, van links naar rechts, van rechts naar links, een waaier rond een middelpunt, en
  hiërarchisch (generalisaties als boom). Rechtsklik op het canvas → **Auto-layout ▸**; met twee
  of meer elementen geselecteerd alleen de selectie. Ook in de taakbalk *Auto-layout* (↓ ↑ → ← ⊙ 🌳)
  en in het menu *Diagram*.
- **Auto-layout voor alle profielen, op leesvolgorde** (18-10, Mark: "boven/onder is per profiel
  een ander concept; het heeft te maken met leesvolgorde"). Elk profiel zonder eigen layout krijgt
  een gelaagde layout die volgt hoe je het diagram leest: waar je begint (start-events, begin,
  actoren), welke verbindingen de stroom vormen, wat achteraan komt, en welke containers banen zijn.
  Vier richtingen, de standaard van het profiel eerst: **BPMN van links naar rechts** (de stroom
  loopt door de lanes, alle lanes even lang), **activiteitendiagram van boven naar beneden**
  (partities als banen), use cases van links naar rechts (actoren links, het systeemkader groeit om
  zijn use cases), toestanden van boven naar beneden, ArchiMate in zijn lagen (motivatie,
  strategie, business, applicatie, technologie, fysiek, implementatie). Containers groeien mee met
  hun inhoud. Sequence en formulier krijgen bewust geen auto-layout.
- **De assistent en de MCP kunnen verplaatsen** (18-10, Mark): een element naar een plek, of
  rechts, links, onder of boven een ander element; en een diagram opstellen met een layout van zijn
  taal ("zet dit diagram hiërarchisch neer"). Ze zien daarvoor waar elk element nu staat.
- **"Niet gedaan" bij de assistent**: wat de AI van de opdracht niet kan (kleuren, lijnroutes,
  diagrammen weghalen), en wat bij het toepassen niet lukte, staat apart in een oranje blok — niet
  meer alleen verstopt in de uitleg (Mark, 18-10: "een uitgebreid antwoord, maar geen effect").

### Gewijzigd
- **BPMN-lane**: minimale hoogte 100 in plaats van 200, zodat een lane met één rij taken niet
  onnodig hoog is.

## [studio/v0.23.0] — 2026-10-16

### Toegevoegd
- **Plaatjes als link voor Confluence** (16-10, Mark): Confluence laat ingebedde plaatjes bij
  plakken weg, maar toont een plaatje van een ander adres wél. Bij *Kopieer voor
  Teams/Confluence* kies je nu hoe de diagrammen meegaan:
  - **ingebed** (Teams, Word, Outlook), zoals tot nu toe;
  - **als link, momentopname**: het plaatje van nu, op een vast adres;
  - **als link, houd up to date**: één adres per diagram. Verandert het diagram, dan zet Studio
    er na een paar seconden een nieuw plaatje op, en wie de Confluence-pagina opnieuw laadt, ziet
    het nieuwe.

  Het adres is openbaar maar onraadbaar: wie het kent, ziet dat ene plaatje en niets anders van
  het project. *Gedeelde plaatjes* in het documentvenster toont alle links van het project, met
  adres kopiëren en **intrekken** (het plaatje verdwijnt dan overal waar het geplakt is). Eén
  diagram kan ook direct: rechtsklik op het lege canvas, *Kopieer als plaatje-link*. Alleen voor
  projecten op de server; vraagt api 0.17.0.
- **Op raster** (16-10, melding #7 van Hugo): schakelaar **#** in de taakbalk *Uitlijnen* (ook
  via rechtsklik op het canvas en in de instellingen). Aan: elementen vallen bij slepen én bij
  plaatsen op het 16px-puntenraster. Onthouden per gebruiker. *Alles op raster* (▦) blijft de
  eenmalige actie.
- **Velden via de assistent en de MCP** (16-10, melding #4): "kun je wat statussen aan status
  toevoegen" voegt waarden toe aan een bestaande enumeratie; attributen met type ("geef pakket
  naam: tekst") op een bestaande of nieuwe klasse. Bestaande namen niet dubbel; de assistent ziet
  welke velden er al zijn.

### Gewijzigd
- **Use case-document zonder lege rijen** (16-10, Mark/Hugo): bij een use case staan *Actoren*,
  *Bevat*, *Uitgebreid door* en *Specialiseert* alleen nog als er iets in staat. Sjabloontaal:
  `{{#if lijst type=… richting=…}}` (waar als de gefilterde lijst niet leeg is).

### Opgelost
- **Studio-instellingen crashten** (16-10, Mark): de vormvoorbeelden tekenden de sequence-levenslijn
  buiten een canvas, en die vraagt de canvas-store op (React Flow-fout #001). De voorbeelden hebben
  nu een eigen React Flow-context, ook in het gedaantepaneel van de profielontwerper.
- **Documentdiagram scheef** (16-10, melding #8): lijnen tussen vakken die naast of boven elkaar
  staan lopen nu recht (horizontaal of verticaal, op het midden van de overlap) zoals op het
  canvas, en kardinaliteit en rolnaam staan bij de uiteinden.

## [studio/v0.22.0] — 2026-10-16

### Toegevoegd
- **Een use case als map: de uitwerking eronder** (15-10, Mark; M3 `ElementType.uitwerking`):
  een element van een type dat een uitwerking mag dragen — use case en collaboratie, actie en
  aanroep, BPMN-subproces, toestand, requirement — is in de projectboom zelf een ouder. Sleep er
  een diagram of element op (uit welke taal dan ook: het activiteitendiagram onder de use case),
  en het hangt eronder in een uitklap; wat je daarna op dat diagram tekent, volgt mee (boomregel).
  Dubbelklik op het element op het canvas opent de eerste uitwerking. Verwijder je het element,
  dan valt de uitwerking terug naar zijn map. De assistent en de MCP kennen het ook: `map` mag de
  naam van zo'n element zijn ("maak een activiteitendiagram onder Leen boek"), en wat eronder
  hangt telt als inhoud van de map. De boom blijft ordening, geen model: de inhoudelijke band is
  het kruisverband (realiseert) of een gedragsverwijzing.
- **Kopieer voor Teams/Confluence** (16-10, Mark): in het documentvoorbeeld kopieert een nieuwe
  knop het document als opgemaakte tekst met de diagrammen als afbeelding (PNG). Markdown met
  ingebedde SVG werd in Teams en Confluence als XML-code geplakt; die editors begrijpen geen
  markdown of SVG, wel HTML met plaatjes. Werkt ook in Word en Outlook.
- **Waar wordt een element gebruikt?** (16-10, melding #5 van Hugo): de eigenschappen van een
  element tonen *Gebruikt op* — de diagrammen waarop het staat (met ×2 bij meer voorkomens), klik
  opent het diagram. Staat het nergens, dan zegt het paneel dat weghalen geen diagram verandert, en
  in de projectboom en de elementenlijst staat zo'n element **cursief**. (In de elementenlijst
  betekende cursief eerst "niet op het open diagram"; dat zie je nu aan de ＋-knop.)
- **Assistent vanaf het canvas, en weghalen** (16-10, AI-2 stap 2): rechtsklik op een element of
  op het lege vlak van een diagram → *✨ Vraag de assistent…*. Het gesprek gaat over de map van dat
  diagram (of het element waar het onder hangt), en nieuwe elementen komen op het open diagram.
  Het plan kan nu ook **weghalen**: "haal de actor Lid weg" verwijdert het element met zijn
  relaties uit het model, van alle diagrammen en uit de boom (rood in het voorstel; Ctrl+Z maakt
  het ongedaan); een relatie alleen zelf. Diagrammen en mappen haalt hij bewust niet weg. Ook via
  de MCP (`verwijderen` in het plan).
- **Projectboom opgeruimd** (16-10, BOOM-1 stap 4): onder *Niet ingedeeld* staan alleen nog
  profielen die écht zwervende diagrammen hebben (geen twaalf regels "geen diagrammen" meer), met
  één ＋ in de kop voor een nieuw diagram in welke taal dan ook; de elementenlijst onderin heet
  *‹profiel› — niet ingedeeld* en toont alleen wezen (elementen die nergens staan), anders één
  regel "alle elementen staan in de boom". In de profiel-ontwerper zijn `uitwerking`,
  `gedragsverwijzing`, `meerdere voorkomens`, `niet in het palet`, `geen beschrijving` en
  `beweegt alleen in x/y` nu velden op een elementtype, `Delete = uit het model` op een
  verbindingsregel en `betekenis` op een eigenschap — de M3-velden die de ontwerper nog miste
  (werklijst M3-MOF).
- **Token of toegangscode?** (15-10, Mark): *Mijn API-tokens* (omt_…, voor MCP en scripts) en de
  AI-instellingen (toegangscode om-…, uit *AI-toegang*) verwijzen nu naar elkaar — ze werden
  door elkaar gehaald.

## [studio/v0.21.0] — 2026-10-15

### Toegevoegd
- **Sequence: koppen, guard en retourwaarde** (14-10, Mark): een levenslijn heeft een *kop* —
  object (rechthoek), actor, de robustness-stereotypes boundary, control en entity (Jacobson) en
  hun business-varianten (met schuine streep). Is de levenslijn een *instantie van* een element
  uit een ander profiel (bv. een ArchiMate-applicatiecomponent) en is er geen kop gekozen, dan
  tekent de kop dat element zoals zijn eigen profiel het doet. Een bericht heeft een *guard* en een
  *retourwaarde*, getekend als `[guard] naam(…): retour` (een retour die al in de naam staat, komt
  er niet dubbel bij); een benoemd bericht toont altijd zijn haakjes (`Verzend()`), zoals EA. Het
  label staat bóven de lijn (`edgePresentatie.labelsBoven`). De EA-import zet de kop uit Actor of
  het stereotype en de guard uit `Btm_Mid_Label`; de retourwaarde las hij al.
- **Sequence: berichten verticaal slepen** (14-10, Mark): pak een bericht vast en sleep het omhoog
  of omlaag (spooklijn tijdens het slepen). Beide punten gaan mee en de lijn wordt horizontaal;
  omlaag duwt de berichten eronder weg zodra ze dichter dan 32px komen (trapsgewijs), zo maak je
  ruimte voor een bericht ertussen. Omhoog schuift vrij — een ander bericht kruisen verandert de
  volgorde, want in v0 is de hoogte de volgorde. Een notitie die met een notitie-lijn aan een punt
  hangt, schuift evenveel mee (plan §3: relatief aan haar anker). Motor: nieuwe M3-hook
  `verschuifConnector` (connector, dy, {elements, diagram}) → posities; sequence: `sequence/verschuif.js`.
- **Sequence: activaties afgeleid uit de berichten** (14-10, Mark): de levenslijn tekent zelf haar
  execution-balken, met dezelfde aanroepstapel-regel als EA (dat ze ook niet bewaart, `Activation=0`)
  en als het plan: een zender die niet op de stapel staat opent een episode, een bericht nest een
  activatie op de ontvanger, een retour sluit hem, anders eindigt hij 18px na zijn laatste bericht;
  zelf-aanroepen nesten 5px naar rechts. Niets wordt opgeslagen, de balken volgen de berichten
  (`sequence/activaties.js`, `AfgeleideActivaties` in shapes.jsx).
- **Sequence: levenslijn beweegt alleen opzij** (14-10, Mark): omhoog/omlaag slepen zette alle
  berichten scheef (punten hangen aan de lijn). M3: `ElementType.layoutDimensie: "x"|"y"|"xy"`; het
  canvas klemt de sleep al tijdens het slepen.
- **Sequence: lijn hecht aan de rand van het punt/de balk** (14-10, Mark): berichten begonnen en
  eindigden 8px buiten de punten en leken naar rechts verschoven (eigen `.dc-seq-punt`-klasse:
  de aanhechtpunten staan óp de rand van het punt = de rand van de activatiebalk, zoals EA).
  Punten zijn nu onzichtbaar (een ring zodra de muis erop staat of bij selectie) — in UML tekent
  men ze niet. Een **zelf-bericht** is niet langer een lus op één punt maar loopt tussen een zend-
  en een ontvangpunt op dezelfde lijn (EA: 15px lager): rechts eruit, hoekig, rechts erin — het
  haakje van EA — en de "rugzak"-activatie volgt uit de afleiding. **Tekenen** (15-10, Mark): kies
  het berichttype in de balk *Verbinding* en sleep van levenslijn naar levenslijn op de gewenste
  hoogte — de punten ontstaan daar vanzelf (horizontaal; naar dezelfde lijn 15px lager = het
  haakje), de activaties volgen; *Punt* en *Activ* staan niet meer in het palet (M3
  `ElementType.inPalet: false`). Motor: `hooks.edgePresentatie` mag `sourceHandle`/`targetHandle`/
  `vorm` voorstellen; nieuwe M3-hook `naVerbinden(connector, {s, diagramId, van, naar})` zodra een
  verbinding op het canvas is getrokken, met de muispositie bij begin en eind. **Delete** haalt een
  bericht uit het model, mét zijn punten (M3 `verwijderen: "model"`, hook `naVerwijderen`); tekenen
  en verwijderen zijn elk één undo-stap (Ctrl+Z liet eerst losse punten achter). Parameters van een EA-bericht
  vallen terug op `params` als `paramsDlg` ontbreekt (`Meld mij aan(anyID): id`).

### Opgelost
- **Notitie op een sequencediagram** (14-10, Mark): kon niet kleiner dan 180×60 (EA-notities zijn
  120×70) — nu 100×44 (`minBreedte`/`minHoogte`, de notitie-vorm zelf vraagt niet meer dan 100×44);
  had onzichtbare handles, dus geen notitie-lijn te trekken zonder eerst de verbind-modus te kiezen
  — handles zichtbaar; een levenslijn die later in de volgorde kwam tekende dwars door de notitie —
  notities (vorm `note`) liggen nu in elk profiel op z-index 5, boven gewone elementen.
- **Sequence-berichten hechtten aan de verkeerde kant** (14-10, Mark): de zijdekeuze van een lijn
  rekende met de positie van de punten *relatief aan hun levenslijn* (beide x≈1), koos daardoor
  aan beide kanten "rechts" en de berichten stonden 18px naar rechts met de pijl voorbij de balk.
  Nu het absolute midden (`absMidden` in materialiseerConnectoren.js); EA-punten krijgen hun maat mee.
- **Her-import van een EA-sequencediagram werd geweigerd** (14-10, Mark): de punten op de lijnen
  hadden geen EA-GUID, dus de merge op GUID zag ze als nieuw en botste op hun id ("Element-id
  bestaat al: …~van") — het hele sequence-profiel kwam dan niet binnen. Een punt heeft nu de GUID
  van zijn bericht + `~van`/`~naar`; een element zonder GUID met hetzelfde id als in de import
  geldt als dezelfde EA-bron (ids zijn afgeleid van de GUID), zodat oude imports ook bijwerken. Motor: de `edgeLabels`-hook kent
  `rondNaam` (delen vóór en na de naam in hetzelfde, inline bewerkbare label). Eerste stap van
  het plan *Sequence — volgorde in het model, layout erbovenop*.

### Toegevoegd
- **Mijn API-tokens** (14-10, AI-1): onder *Gebruikers* maak je een persoonlijk token voor de
  Omnium-MCP-server (AI in VS Code) of een script; je ziet het één keer, daarna het begin, wanneer
  het verloopt en wanneer het laatst gebruikt is; intrekken kan altijd. Vereist de api met
  `/api/auth/tokens`.

- **✨ Assistent in context** (14-10, AI-2): rechtsklik op een map → *Vraag de assistent…*:
  beschrijf een model in gewone taal ("maak een use case-model met de actoren gebruiker en
  beheerder …"), kies de taal, en je krijgt een voorstel met elementen en relaties, gecontroleerd
  tegen het profiel (wat niet mag, wordt met uitleg weggelaten). **Toepassen** zet ze met een
  diagram in de map (één keer Ctrl+Z maakt het ongedaan). Rechtsklik op een element: velden
  erbij ("aap: string, noot: int"). Bijsturen in hetzelfde gesprek. Werkt met de bestaande
  AI-instellingen (eigen sleutel of toegangscode voor de Omnium-proxy).
- **Assistent stap 1b** (14-10, na Marks eerste proef): de assistent **kent wat er al in de map
  staat** en sluit erop aan — "maak een associatie tussen gebruiker en test" legt de relatie
  tussen de bestaande elementen (geen dubbele, geen nieuw diagram), hernoemen kan ook. Eén
  opdracht mag **meerdere talen** raken (een use case met een activiteitendiagram eronder, met
  een kruisverband) en **submappen** maken. Het **gesprek blijft open na Toepassen**: kijken,
  bijsturen, verder. Talen kies je als chips; talen die de opdracht noemt of die al in de map
  staan gaan vanzelf mee. Strengere controle: een associatie hoort tussen actor en use case
  (omgekeerd wordt gedraaid, anders weggelaten), geen relatie naar zichzelf, geen dubbele; een
  actor ligt niet in een systeemkader. Aanwijzingen en voorkeursparen staan in het profiel (M2,
  `descriptor.assistent`). Ook via rechtsklik op een element (de map waar het staat); velden
  heten nu *Velden toevoegen met de assistent…*.
  Meldingen #8 en #9 (lokaal): een **bestaand element in een kader zetten** werkt nu (`in`, of een
  bevat-relatie van de AI); het element komt op het diagram ook echt in het kader en het kader
  groeit mee. Een plan dat een bestaand diagram bij zijn id noemt, wordt geaccepteerd. Wat de
  controle weglaat staat opvallend open bij het voorstel (de uitleg van de AI kan meer beloven).
  Melding #11: de assistent kan **uitlijnen en opstellen** ("lijn alles horizontaal uit en test en
  Omnium verticaal"): naast elkaar, boven elkaar, verdelen, links/rechts/boven/onder of het hele
  diagram automatisch — met hetzelfde rekenwerk als de werkbalk Uitlijnen; leden van een kader
  schuiven mee. Verandert een voorstel niets, dan staat dat er eerlijk bij (met wat de assistent
  wél kan) en is er geen Toepassen.

- **Elementen volgen hun diagram in de projectboom** (14-10, BOOM-1): één regel — *een
  niet-ingedeeld element komt in de map van het eerste geplaatste diagram waarop het staat*. Dus:
  een element dat je tekent (paletknop, magic link) of uit de lijst op een diagram sleept staat
  meteen in de map van dat diagram; zet je een (geïmporteerd) diagram in een map, dan volgen zijn
  elementen; en bij het laden van een project worden bestaande niet-ingedeelde elementen zo
  opgeruimd. *Niet ingedeeld* houdt alleen wezen over (op geen enkel geplaatst diagram). Een
  hiërarchie-kind reist met zijn top-voorouder mee; connectoren staan niet in de boom. Via de
  projectsync zien anderen dezelfde plaatsing. Dat is waar de context is (Mark); de losse
  elementenlijst kan daarna weg.

### Tests
- **Tokens** (14-10): `tests/e2e/20-studio-tokens.spec.js`.
- **Boom** (14-10): `tests/e2e/23-studio-boom-nieuw-element.spec.js` en `studio/boomRegels.test.js`.
- **Assistent** (14-10): `tests/e2e/21-studio-assistent.spec.js` (AI gemockt: submap met twee
  talen en verband, bestaande elementen + doorpraten, velden) en unittests voor `assistentKern.js`
  en `wijziging.js`. Met DeepSeek Flash via de proxy nagespeeld op Marks scenario's (1–7 s per beurt).

## [studio/v0.20.1] — 2026-10-14
Nooit meer een release missen: de Studio meldt een nieuwe versie zelf en laat zien wat er nieuw
is. Plus de eerste eigen meldingen opgelost. Alleen frontend; api blijft 0.15.0.

### Toegevoegd
- **Nieuwe versie zonder F5** (14-10, Mark: Hugo kreeg de release pas na een F5): de Studio kijkt
  elke 5 minuten, en als je terugkomt in het tabblad, of er een nieuwere build is (`versie.json`,
  bij de build gemaakt). Dan verschijnt bovenin een strook met wat er nieuw is en **Herladen**
  (stuurt eerst wat nog naar de server moet). Werkt vanaf deze versie; daarna niet meer nodig.
- **Wat is er nieuw** (14-10, Mark): na het laden van een nieuwere versie één keer de wijzigingen
  sinds je vorige bezoek, uit de CHANGELOG van de build; ook via *Help → Wat is er nieuw…*. Plus
  *Help → Releaselog (CHANGELOG)…* naar de releaselog bij de draaiende versie (HELP-4).

### Opgelost
- **Meldingen** (14-10, eigen meldingen #5–#7): *Mijn meldingen* en *Melden* hebben een
  sluitknop (#5); de link naar de losse meldpagina wees naar `…/studio/melden.html` (#6); F8 met
  *Mijn meldingen* open neemt die nu mee op de afbeelding, en F8 met een open formulier voegt een
  schermafbeelding toe in plaats van een nieuwe melding te beginnen (#7).

### Tests
- **Versie** (14-10): `tests/e2e/19-studio-versie.spec.js` (5) en unittests voor het lezen van de
  CHANGELOG.

## [studio/v0.20.0] — 2026-10-14
Melden vanuit Omnium: een bug, wens, vraag of compliment, met een schermafbeelding (F8) en de
plek waar het over gaat; *Mijn meldingen* met status en gesprek; `melden.html` als de Studio
hangt. Samen met **api 0.15.0** (vereist).

### Toegevoegd
- **Melden vanuit Omnium** (14-10, Mark): *Help → Melden…* (Alt+M) voor een bug, wens of vraag,
  met bijlagen (plakken, slepen, kiezen); *Melden met schermafbeelding…* (F8): trek een kader om
  wat je wilt laten zien, het komt als bijlage mee, met de plek eronder. Rechtsklik op een map,
  diagram of element: *Melden over dit item…* (pad en onderwerp gaan mee). *Mijn meldingen…*
  toont status, toelichting en het gesprek; een beheerder behandelt er (status, prioriteit,
  behandelaar). `melden.html` werkt ook als de Studio hangt. F8 en Alt+M zijn instelbaar.
  Na de eerste eigen meldingen (14-10): F8 **bevriest** eerst het scherm, zodat ook een open
  rechtsklikmenu op de afbeelding komt (#3); het formulier heeft **+ schermafbeelding** (#2); en
  er is een soort **compliment** (#4).
  Vereist de api met `/api/meldingen`.

### Tests
- **Melden** (14-10): `tests/e2e/18-studio-melden.spec.js` (7 tests) en unittests voor de
  meldhulpen en de context.

## [studio/v0.19.0] — 2026-10-14
Mensen uitnodigen om Omnium te proberen: uitnodigingen met een rol en toegang per project
("alles dicht tenzij"), vijf rollen, en voor nieuwe gebruikers een kennismakingstour, een
opdrachtenpalet met uitleg, sneltoetsen, lege staten en tips. Verder het relatiepaneel, de
modelleer-voorkeuren, beschrijvingen bij mappen en diagrammen, gegevenselementen als `0..*`
`{enkelvoudig}` en de Studio-regressietests. Samen met **api 0.14.0** (vereist voor de
uitnodigingen en de projecttoegang).

### Toegevoegd
- **Help en rondleiding** (14-10, Mark): het opdrachtenpalet (Ctrl+K) toont per opdracht een
  regel uitleg, groepeert per menu en vindt ook beginletters; het Help-menu kreeg Rondleiding,
  Sneltoetsen… (overzicht met de actuele toetsen) en Tips opnieuw tonen. Een leeg diagram legt
  uit wat je in dat profiel maakt, met startknoppen. Korte tips verschijnen één keer (eerste
  element, eerste relatie per profiel). Een **kennismakingstour** van acht stappen start bij
  het eerste bezoek en gaat vanzelf verder als je een diagram en een element maakt.

### Gewijzigd
- **Kardinaliteit van gegevenselementen** (14-10, Mark): de lijn van een entiteit naar een
  gegevenselement toont nu `0..*` met `{enkelvoudig}` of `{meervoudig}` eronder, in de Studio en
  in de render-API (`/api/render/svg`, dus ook bij Imprint). In een bitemporeel model zijn de
  voorkomens alle voorkomens in de tijd; het momentvoorkomen is een constraint, geen `0..1`.
  Relaties volgen nog.

### Tests
- **Help** (14-10): `tests/e2e/16-studio-help.spec.js`, `17-studio-tour.spec.js`; unittests voor
  palet, tips en rondleiding (elk anker bestaat in de code).

### Toegevoegd
- **Uitnodigen en toegang per project** (14-10, Mark): *Gebruikers → Uitnodigen* met e-mail,
  rol, geldigheid en per project lezen/schrijven; de link verschijnt één keer (en gaat per mail
  als de server SMTP heeft). De genodigde opent `studio.html#uitnodiging=…`, kiest gebruikersnaam
  en wachtwoord en is ingelogd. *Van server ophalen…* toont alleen projecten waar je bij mag,
  met "alleen lezen" waar dat geldt; eigenaar en beheerder krijgen **Toegang…** (gebruikers of
  iedereen, lezen/schrijven). Vijf rollen (lezer, modelleur, ontwerper, bouwer, beheerder) in
  `shared/rollen.js`; de Studio staat open voor elke rol, de API beslist per project.

### Tests
- **Uitnodigen** (14-10): `tests/e2e/15-studio-uitnodigen.spec.js` (accepteren, ongeldige link,
  uitnodigformulier, Toegang…) en unittests voor rollen, token en toegangsrijen.

### Tests
- **Regressietests voor de Studio** (13-10, Mark): Playwright-specs `tests/e2e/10…14-studio-*.spec.js`
  (20 tests: deselecteren incl. muisbeweging, klik-door in kaders, geen groepskader; relatiepaneel,
  Delete/Ctrl+Delete, "relaties mee terug"; inspector zonder diagram, pijltjes, meegroeiend
  tekstveld, typekiezer, CSS-lekken; projectboom zoeken/slepen, REL, beschrijving; BPMN-maat,
  vergroten, handle). Nieuw script `npm run test:e2e:studio`. Unittests voor `relaties.js`
  (relatiepaneel-logica, uit de activiteit gehaald), verbergen/tonen per diagram, het
  sync-vocabulaire en de schets-maat van use cases.

### Toegevoegd
- **Modelleer-voorkeuren per gebruiker** (13-10, Mark en Hugo): Studio-instellingen → *Modelleren*.
  *Verborgen relaties komen mee terug* als je een element weer op een diagram zet (standaard aan;
  uit werkt zoals Archi). *Relatiepaneel standaard uitgeklapt* (standaard ingeklapt; de kop van het
  paneel klapt in/uit en onthoudt de stand).

### Toegevoegd
- **Relatiepaneel in de inspector** (13-10, Mark): bij een element alle relaties van/naar dat
  element, met type, richting, het andere uiteinde en de stand op het actieve diagram (zichtbaar,
  verborgen, andere kant niet op dit diagram); per relatie *van diagram*, *toon* en *uit model*.

### Opgelost
- **Relaties van het diagram halen** (13-10, Mark): "Van diagram halen" in de inspector deed niets
  bij een verbinding, en **Delete** op een lijn haalde de relatie uit het model. Nu verbergt beide
  de relatie alleen op dit diagram; **Ctrl+Delete** haalt (na bevestiging) ook lijnen uit het model.

### Gewijzigd
- **Mappen en diagrammen hebben een beschrijving** (13-10, Mark): de map-`omschrijving` heet nu
  `beschrijving`, consequent met elementen en velden (M3). Oude mappen migreren bij binnenkomst
  (opslag, projectbestand, sync-snapshot; `mappenMetBeschrijving` in `structuurKern.js`); de oude
  sync-operatie `zetMapOmschrijving` blijft werken. Een **diagram** heeft nu ook een beschrijving
  (eigenschappenpaneel; `diagram.beschrijving` via `zetDiagram`). In documenten komt die onder de
  plaat; `{{omschrijving}}` blijft als alias van de mapbeschrijving werken.

### Opgelost
- **Typekiezer valt niet meer buiten het paneel** (13-10, Mark): de minibrowser (🔍 bij een
  verwijzing, bv. het type van een veld) was 240px breed en rechts uitgelijnd op het anker; in een
  smal eigenschappenpaneel stak hij links buiten beeld en werd afgesneden. Nu een portal met vaste
  positie, binnen het venster geklemd, boven het veld als er onder te weinig ruimte is; sluit bij
  een klik ernaast, scrollen of venster-resize.
- **BPMN-events en -gateways zonder opgeslagen maat waren enorm** (13-10, Mark): hun SVG (breedte
  100%) kreeg in een krimpende node de browser-standaard 300×150. Nu ligt de SVG absoluut over de
  vorm en bepaalt de minimummaat de grootte (event ±60px, gateway ±68px).
- **Use cases in de documentexport niet meer scheef** (13-10, Mark): de schets nam voor een ovaal
  zonder opgeslagen maat altijd 160×64, terwijl het canvas de breedte aan de naam aanpast
  (150–280px, afbreken). Nu dezelfde rekensom (gekalibreerd op het canvas, ±2px), en actoren
  64px breed met een label dat meegroeit; vormen die op het canvas uitgelijnd staan, blijven dat
  in Markdown en HTML.

## [studio/v0.18.0] — 2026-10-13
Beschrijving als vaste M3-eigenschap van elk element en veld (M3-MOF), eigenschappen die altijd
zichtbaar zijn (pijltjes in de boom, zonder open diagram, meegroeiende tekstvelden), en
projectboom-fixes: zoeken vindt elementen onder een domein, relaties staan onder hun entiteit, en
knoppen kleuren niet meer groen door globale CSS van de schemapagina's. Daarnaast exporteert de
Toegang-activiteit een beleidsbundel voor de API. Alleen frontend: **api blijft 0.13.0**.

### Toegevoegd
- **Beschrijving als vaste M3-eigenschap** (12-10, besluit Mark): elk element en elk veld heeft naast
  zijn naam een **beschrijving** (`data.beschrijving`; UML `Comment::body`, EA Notes), zonder dat een
  profiel hem declareert — de inspector toont hem vooraan. Notities en notitie-lijnen hebben er geen
  (een notitie ís een tekst). De profieleigen varianten zijn opgeheven en migreren bij het laden
  (`DiagramType.oudeBeschrijvingSleutels`): `toelichting` (use case, DMN, de acht EA-profielen),
  `description` (canoniek; V3 houdt `description`, de adapter vertaalt) en `notes` (EA-import).
  MIM houdt zijn `definitie` — volgens MIM "de beschrijving van de betekenis" — en markeert die met
  `betekenis: "beschrijving"`; MIM-`toelichting` en de GEMMA-tags blijven eigen. EA-import (Notes),
  ArchiMate-import (documentation), Mermaid, DMN-XML, XMI-export en de documentsjablonen
  (`beschrijving`, met `toelichting` als alias) volgen.
- **Beleidsbundel exporteren** (12-10, toegangsplan fase 1a): de Toegang-activiteit heeft
  "Exporteer beleidsbundel voor de API (TOEGANG_BUNDEL)", alleen bij een volledig opgelost beleid;
  met voorbeeldbeleid `cg-portfolio`. De Go-uitvoerder die de bundel gebruikt, komt met een
  volgende api-release.

### Opgelost
- **Eigenschappen volgen de pijltjes in de projectboom** (12-10, Mark): wie met ↑/↓ door de boom
  liep, zag bij elementen een leeg eigenschappenpaneel (alleen mappen en diagrammen werkten). Nu
  krijgt de inspector het element door, zoals bij een klik — binnen het profiel van de actieve tab.
- **Eigenschappen ook zonder open diagram** (12-10, Mark: "elementen hebben eigenschappen, of er nu
  een diagram open is of niet"): een element uit de boom toont zijn eigenschappen ook als er geen
  tab open is, of als de actieve tab een ander profiel heeft. Een klik op het canvas zet de
  selectie in de boom.
- **Inspector-opmaak zonder open diagram** (12-10, Mark: "het toelichting-veld is heel klein"): de
  stylesheet van de diagramkern laadde alleen met het canvas mee; zonder diagram stonden de labels
  erboven en was het tekstvak smal. De element-inspector laadt hem nu zelf. Grote tekstvelden (datatype `tekst`,
  zoals toelichting en beschrijving) groeien mee met de inhoud, tot ±14 regels; daarboven een
  schuifbalk. `string` blijft één regel.
- **Knoppen en labels lekten niet meer groen de Studio in** (12-10, Mark: "soms grijs, soms
  uitbundig groen"): `shared/schema-viz.css` en `styles/tijdlijn-schema.css` hadden globale regels
  voor `label`, `input`, `select` en `button` (groen = de tijdlijn-accentkleur). Zodra een van die
  pagina's in een sessie geladen was, golden ze overal. Nu alleen binnen `.schema-pagina`.
- **Zoek in projectboom vindt kinderen** (12-10, Mark: "NP zoeken levert het domein op"): een
  element onder een domein-package of entiteit heeft geen eigen plaatsing; het zoeken klapt nu de
  voorouders open en laat de rij van het element zelf oplichten.
- **Canoniek: relaties in de projectboom** (12-10, Mark: "REL is niet in de tree te zien, terwijl
  het gewoon een speciale GE is"): een relatie staat nu onder zijn bron-entiteit, net als een GE.

## [studio/v0.17.0] — 2026-10-12
Canvas en modellering na 0.16.0: klik op leeg deselecteert betrouwbaar, kaders laten klikken door,
vergroten grijpt beter, ovalen en ruiten hechten aan op hun toppen, donker thema leesbaar, en
elementen onder een domein (V3-package) zijn weer naar een diagram te slepen. Afgeleide relaties en
de UML 2.5.1 Property-kernset in UML, MIM, canoniek en SysML; documenten als Markdown + afbeeldingen
(.zip). Alleen frontend: **api blijft 0.13.0**. De register-kant van afgeleide relaties (backend,
op main sinds 11-10) gaat mee met de volgende api-release; tot dan maakt codegen voor een afgeleide
relatie nog gewoon een tabel.

### Opgelost
- **Elementen onder een package/domein naar een diagram slepen** (12-10, Mark): in de projectboom
  waren alleen rijen met een eigen plaatsing sleepbaar, dus na een V3-import kon je wel het
  domein-package (np-loc) op een diagram zetten, maar niet de entiteiten eronder. Kindrijen in de
  hiërarchie (ook GE's onder een entiteit) zijn nu sleepbaar naar het canvas; het lidmaatschap
  van het domein blijft ongemoeid.

### Toegevoegd
- **Afgeleide relaties: de Studio rekent mee** (11-10, bij de backend van BACKEND-GEN): de
  CEL-evaluator kent **collect** (`ouders.ouders`) en parset strikt, gelijk met de Go-evaluator
  (gedeeld `testdata/cel-pariteit.json`, 60/60). De inspector controleert de afleidingsregel van
  een afgeleide relatie tegen het model (✓/⚠/✗: rolnamen, doorkijk naar het doel, het doeltype
  aan het eind). `geordend` gaat mee naar V3; een afgeleide relatie stuurt geen velden mee.
- **Afgeleide relaties** (10-10, Mark): `afgeleid` (UML isDerived) op relaties in UML, canoniek, MIM
  (`indicatieAfleidbaar`) en SysML, met "/" voor de naam; ook op SysML-waarden en -delen. M3:
  `PropertyType.betekenis: "afgeleid"` laat de motor het "/" tekenen ongeacht de naam van de
  eigenschap. V3-rondreis (`afgeleid`, `afleidingsregel`, `afleidingsregelTaal` op een relatie),
  EA-import ("/" in de naam of een rol met Derived=1) en XMI-export (`isDerived`). Register-kant
  (geen tabel, alleen lezen) volgt in de backend; zie `docs/plans/2026-10-10 UML Property en
  afgeleide relaties.md`.
- **UML 2.5.1 Property-kernset** (10-10, Mark): attributen in UML en SysML met kardinaliteit,
  standaardwaarde, zichtbaarheid en {ordered, nonunique, readOnly, id}, getoond als
  `+/naam : Type [0..*] = 5 {ordered}`; associatie-uiteinden met rolnaam, kardinaliteit,
  **navigeerbaarheid per uiteinde** (pijl of ×; `directioneel` leest als doel navigeerbaar) en
  dezelfde eigenschappen. MIM toont zijn kardinaliteit en "identificerend" in UML-notatie. M3:
  meer `betekenis`-waarden; motor: marker `kruisje`. EA-import (rolstijl, IsOrdered,
  AllowDuplicates, Const, Default) en XMI-export (isOrdered/isUnique/isReadOnly/isID,
  defaultValue, navigableOwnedEnd) volgen.
- **Document als "Markdown + afbeeldingen (.zip)"** (10-10, Mark): het voorbeeldvenster levert
  naast de losse Markdown een zip met het `.md`-bestand en de diagrammen als losse `.svg`'s. GitHub
  toont inline SVG in Markdown niet; zo wel. Eigen ZIP-schrijver zonder afhankelijkheden.

### Gewijzigd
- **Canoniek: afgeleide velden boven de gewone, met "/"** (10-10, Mark): bij entiteit,
  gegevenselement (ook opgenomen in een entiteit) en relatie staat het afgeleid-compartiment nu
  bovenaan, en elk veld daarin krijgt de UML-"/" — generiek via het nieuwe M3-attribuut
  `FieldType.afgeleid`. De render-API (diagramsvg) volgt dezelfde volgorde.
- **Vergroten grijpt beter** (10-10, Mark): de hoekpunten van de resizer zijn 9px (was 5) en de
  zijkanten hebben een klikvlak van 10px (was 1). Bij een geselecteerd kader wint de resizer van de
  verplaatsrand, die sinds de klik-door-fix het trekken aan de zijkant afving. De
  verbindingshandles liggen boven de verbrede zijlijnen, zodat relaties trekken blijft werken.
- **Ovalen en ruiten hechten aan op hun toppen** (10-10, Mark): een lijn naar een use case, een
  begin/eind-stip, een beslissing of een BPMN-event/gateway raakt de vorm nu op het dichtstbijzijnde
  uiterste punt (links, rechts, boven, onder) in plaats van schuin op de boog richting het
  middelpunt. Generiek via het nieuwe M3-attribuut `ElementType.aanhechtpunten`, met als default
  wat uit `omtrek` volgt; geen profielcode.

## [studio/v0.16.0] — 2026-10-10
Sparx EA ↔ Omnium: EA-modellen uit een `.qea` lezen (in de browser, of via de server rechtstreeks
uit git), terugschrijven als XMI 2.1, acht nieuwe profielen voor de EA-diagramsoorten en BPMN/DMN
op EA-niveau; overerving en abstracte elementtypen in het M3. Daarnaast documenten uit sjablonen,
ArchiMate-blokken en canvas-fixes. Samen met api 0.13.0 (EA-import via de server). Onderzoek en
EA-schema: `docs/plans/2026-10-07 Sparx EA-sync — vier routes vergeleken (onderzoek).md`.

### Toegevoegd
- **Acht profielen voor de EA-import** (09-10, opdracht Mark; `docs/PROFIELEN-EA-AANVULLING.md`):
  **Component & deployment** (component, interface/lollipop, poort op de rand, artifact,
  node/device/execution environment; realisatie, «use», assembly, «deploy», «manifest»,
  communicatiepad), **Object** (instanties naam : Klasse met slots en links; klasse via
  cross-profiel verwijzing), **Requirements** (EA-stijl: requirement/feature/issue/change met
  status/prioriteit; trace/derive/verify/refine, realisatie, aggregatie), **Business (EP)**
  (Eriksson-Penker: proces-pijl, doel, fysieke/mensen-/informatie-resources, gebeurtenis,
  bedrijfsobject; «input»/«output»/«control»/«supply»), **XML Schema** en **WSDL** (eigen
  schema-profielen met XSD-/WSDL-stereotypen, geen laag op puur-uml), **Composite structure**
  (parts, poorten, connectoren, collaboraties) en **Communication** (links met genummerde
  berichten als compartiment). Elk met `eaMapping.js` (EA Object_Type/Connector_Type/stereotype →
  stabiele elementtype-id's) voor de lezers, abstracte wortels via `erft`/`isAbstract`, notitie +
  notitie-lijn, en tests. Interaction overview = uitbreiding van activity (`interactiegebruik`),
  timing past niet in het M3 (tijdas) — toegelicht in de notitie. Gedeeld: `uml2Basis.js`,
  `uml2Iconen.jsx`.
- **BPMN-profiel naar EA-niveau** (10-10, Mark legde GGM-diagrammen naast EA): taaktype op `taak`
  (`data.taakSoort`: user/service/send/receive/manual/script/businessRule, icoon linksboven in de
  nieuwe `bpmn-taak`-vorm), gateways `complex` (✱) en `event-gateway` (ring in de ruit), event-soorten
  escalatie/compensatie/conditioneel/link/annulering/terminate, `data-store` (cilinder),
  `data.verzameling` op een data-object (drie streepjes), message flow met open rondje + open
  driehoek (bron-marker `cirkel-open`, motor-kant bij EA-SYNC), en een `stereotype` op de
  data-associatie (EA «toekomst» als label). De XML-lezer en `eaMapping.js` (`TAAK_SOORT`,
  `GATEWAY_TYPE`, `EVENT_SOORT`) volgen.
- **BPMN 2.0 XML → BPMN-model en DMN XML → DMN DRD-model** (10-10, opdracht Mark; `docs/TRANSFORMATIES.md`
  §7): native imports in de vorm lezer → regelset → toepasser, mét de BPMNDI-/DMNDI-diagramlaag (posities,
  maten, waypoints als knikpunten; een uitgeklapt subproces krijgt een eigen diagram). Generieke aansluiting
  `transformatie/planNaarCoreModel.js`; XML-lezers `transformatie/bpmnXml.js`, `dmnXml.js`, `xmlBoom.js`.
  In Modelleren: *Transformeren → Importeren*. `bpmn` en `dmn-drd` kregen een notitie-lijn en een
  `eaMapping.js`; `object` een generalisatie.
- **Sparx EA importeren uit een `.qea`** (SQLite, client-side met sql.js): in Modelleren *Bestand →
  Importeer Sparx EA (.qea)…* leest één pakket (keuzelijst met zoekveld) en zet elk diagram in zijn
  eigen profiel — klassediagrammen naar UML of, bij MIM-/MIG-stereotypen, naar MIM (tagged values →
  mim12-eigenschappen), activiteitendiagrammen naar Activity (aanroepen, pins, guards, partities),
  use case-diagrammen naar Use case (incl. collaboratie en «legt vast»). Posities, maten, knikpunten,
  verborgen lijnen en kleuren komen mee (schaal 1,5); stabiele ids uit de EA-GUID; stereotypen,
  tagged values en notities reizen mee op `data`. De EA-boom wordt de projectboom: pakketten,
  use cases en activities als mappen, het diagram bij zijn eigenaar met de knopen ernaast; je kiest
  de doelmap of de wortel (of een nieuwe map daarin). Toevoegen met undo per profiel. Per profiel bestaat ook een import
  "alleen dit profiel". `scripts/inspecteer-qea.py` doorlicht een `.qea`. Opnieuw importeren is
  een **merge op EA-GUID** met een **review als boom** (profiel → pakket → regels; nieuw,
  gewijzigd, verdwenen; een tak uitvinken haalt alles eronder uit de import).
- **Studio**: een map **verwijderen mét inhoud** (submappen, diagrammen en elementen) achter
  een dubbele bevestiging; *Opheffen* is het oude gedrag (inhoud naar het niveau erboven).
- **Lijndata per diagram** (`diagram.lijnen`, de "Position" van een connector op een diagram in
  het M3): pad, lijnvorm, vastgezette uiteinden en labelposities horen bij het diagram, zoals in
  EA; dezelfde relatie ligt op elk diagram anders. Alle lijn-bewerkingen op de canvas (knikken,
  lijnvorm, boomstijl, uiteinden, normaliseren, verhangen, labels) schrijven naar het actieve
  diagram (`zetLijn`/`zetLijnen`, één undo-stap); het element blijft de standaard voor oude
  modellen. De EA-import zet per diagram EA's pad en Line Style.
- **Profielstores in IndexedDB** (`diagramcore/model/opslag.js`): de modellen van alle
  profielen worden in IndexedDB bewaard in plaats van localStorage — geen plafond van ±5 MB
  meer (de Zandbak MW met 25.800 elementen past), bewaren gebundeld en asynchroon buiten de
  hoofddraad, als object in plaats van JSON-tekst. Eenmalige migratie uit localStorage bij het
  eerste laden; zonder IndexedDB blijft localStorage. Mislukt bewaren, dan werkt het model in het
  geheugen en meldt de EA-import dat.
- **EA-boom in één stap**: mappen en plaatsingen van een import komen in twee store-stappen in
  het project (`nieuweMappen`, `plaatsPerMap`), ook via projectsync.
- **Sequence-diagrammen uit EA** naar het sequence-profiel: levenslijnen, berichten (synchroon,
  asynchroon, retour, zelf-bericht) op hun hoogte, notities; `notitielijn` in het profiel.
- **Export naar Sparx EA (XMI 2.1)** uit UML en MIM: EA's eigen XMI-vorm met pakketten,
  klassen, attributen, associaties, generalisaties, notities, tags, kleuren én diagrammen
  (posities, lijnpaden), met de bewaarde EA-GUIDs — EA werkt bestaande elementen bij in plaats
  van ze te verdubbelen.
- **EA-import via de server** (*Project → EA-import via de server (uit git)…*): kies repo (met de
  uitgecheckte branch) → `.qea` in die repo → pakket → mappad, met vinkjes voor "eerst git pull" en
  "ook verwijderen"; de api start de sidecar, de Studio volgt de taak en haalt de operaties binnen.
  Api: `handlers/studio_ea_import_handler.go`, env `STUDIO_EA_IMPORT_MAPPEN` e.a. (zie `docs/API_REFERENCE.md`).
- **Projectboom snel bij grote projecten**: de Zandbak-snapshot (25.000 MIM-elementen, 1.900 mappen)
  laadde in 176 s en bevroor bij elke hertekening; nu < 1 s. De hiërarchie wordt één keer per
  modelstand berekend (was: per elementregel), mappen gebruiken een index op submappen en inhoud,
  en mappen dieper dan twee niveaus staan standaard dicht.
- **Lijnvorm kiezen wist de knikpunten** (contextmenu → Lijnvorm): knikpunten winnen van de vorm, dus
  "Hoekig" op een uit EA geïmporteerde lijn deed niets; nu zoals Boomstijl, Ctrl+Z zet ze terug.
- **"Verwijder uit model" haalt overal de boomplek weg**: de knop in de inspector en Ctrl+Delete op het
  canvas ruimen nu ook de plaatsing in de projectboom op, net als het boommenu (één structuur-undo-stap).
- **Wees-plaatsingen niet meer in export en snapshot**: een element of diagram dat buiten het
  boommenu om verwijderd is (canvas, inspector, browser) liet zijn boomplaatsing staan; die reisde mee
  in het werkbestand en kwam terug als het id weer opdook. Het werkbestand (Studio én sidecar) laat ze
  nu weg; live blijven ze staan, zodat Ctrl+Z het element mét plaatsing terugzet.
- **BPMN-events en -gateways vullen hun node**: een bewaarde maat (EA: 30/42 pt × 1,5) is nu ook de
  getekende ring/ruit; eerst stond een vaste ruit van 34px linksboven en hechtten de lijnen met een gat
  op de grotere omtrek.
- **Bron-marker `cirkel-open`** in de motor (ConnectorEdge + typeicoon): een open, canvas-gevuld
  rondje net buiten de bron, voor de BPMN message flow (verzoek van het profielwerk).
- **EA-lijnen en BPMN zoals in EA** (Marks vergelijking van twee GGM-procesplaten): knikpunten alleen
  bij EA's Custom-stijl (bij Direct en Auto Routing zijn opgeslagen paden verouderd: zigzaglijnen);
  BPMN-events en -gateways hechten zwevend op hun echte omtrek (cirkel/ruit; geen trapjes meer) en
  de "zo recht mogelijk"-routering werkt ook voor die vormen; taken in een subproces hangen in de
  pool erboven (het subproces bedekte ze), het subproces toont dan zijn naam linksboven; een
  bewaarde maat kleiner dan het minimum (180px) wint; labels van data-objecten breken niet meer
  per letter af. Taaktypes, complexe/event-gateways, escalatie-events, datastores en de
  pijlpunten van berichtstromen liggen bij M3-MOF (BPMN-profiel).
- **Projectboom in EA-volgorde**: binnen een map eerst de diagrammen, dan de submappen, dan de elementen
  (diagrammen verdwenen eerder onder lange submappen, zoals de pools van een BPMN-proces).
- **Onbekende profielen blijven bewaard**: een werkbestand met profielen die deze Studio niet kent,
  gaat bij "Naar server sturen" en de automatische snapshot ongewijzigd mee terug (werd gewist).
- **Sidecar maakt na een import zelf een snapshot** (`--geen-snapshot` om over te slaan;
  `--alleen-snapshot` compacteert een bestaand project); servergrens werkbestand 20 → 100 MB.
- **Worktree-poorten 5176–5179** praten nu met de lokale api (api-basis, inloggen, CORS).
- **Node-sidecar voor de EA-import** (`npm run importeer-qea`, `scripts/importeer-qea-uit-git.sh`):
  een `.qea`-pakket zonder browser in een serverproject zetten — zelfde lezers, zelfde merge op
  GUID, zelfde projectboom; stand van de server (snapshot + operatielog) nagespeeld in node, het
  verschil als operaties naar het log, dus open Studio's zien het meteen. `--droog`, `--map`,
  `--verdwenen-verwijderen`, `--lijst-pakketten`. Nog niet tegen een draaiende api getest.
- **IndexedDB-opslag: dataverlies bij herladen verholpen** (10-10, vóór release): een store-stand
  van vóór de hydratatie werd ná het inladen alsnog weggeschreven en wiste de bewaarde store; de
  volgende herlaad was leeg (alleen de mappen, uit localStorage, bleven). Nu wordt zo'n stand
  genegeerd; regressietest in `opslag.test.js`.
- **Dialogen verplaatsbaar** (slepen aan de titel), geklemd op het venster (een uitklappende
  review-boom scrolt) en een reeks dialogen blijft bij de menukeuze staan in plaats van steeds verder
  naar rechtsonder te schuiven.
- **Compartimenten verbergen per diagram** (*Beeld → Compartimenten verbergen op dit diagram*,
  per voorkomen te overrulen via het contextmenu): EA's "Hide attributes"; de EA-import neemt het
  over, de XMI-export schrijft het terug.
- **EA-import voor de nieuwe profielen** van M3-MOF (component/deployment, object, requirements,
  business, xsd, wsdl, composite-structure, communication) via één gegevensgestuurde lezer op hun
  `eaMapping.js`-tabellen; interaction overview landt in activity als `interactiegebruik`.
- **BPMN en DMN uit EA** via dezelfde lezer en M3-MOF's tabellen: EA's "Analysis"-diagrammen
  worden op stereotype verdeeld over BPMN, DMN en Eriksson-Penker; events, gateways, boundary-
  events en condities uit EA's tagged values; DMN-eisen in DRD-richting.
- **Hoekige lijnen zo recht als het kan**: een hoekige lijn zonder knikken loopt recht als de
  dozen elkaar in x of y overlappen, anders met één hoek (zoals EA's Auto Routing).
- **Boomstijl** op een lijn wist eerdere knikpunten; een EA-import bracht die mee en dan
  "deed" de boomstijl niets.
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

### Toegevoegd (documenten en canvas, 09/10-10)
- **Documenten uit sjablonen** (09-10): rechtsklik op een map → *Document maken…*: use
  case-overzicht, gegevenswoordenboek of generiek map-overzicht, met de diagrammen als tekening;
  voorbeeldvenster, Markdown/HTML-download en afdrukken. Sjabloontaal en context:
  `docs/DOCUMENTEN.md`. Plus het sjabloon **Projectdocument (volgt de mappen)**: hoofdstukken =
  submappen, tekst = de nieuwe **omschrijving van een map** (eigenschappenpaneel), platen = de
  diagrammen in de map.
- **ArchiMate-gedaante "Blokken (informeel)"** (09-10): effen blokken zonder icoon, Grouping als
  laagkader, bediening getekend als "gebruikt" (pijlpunt aan de bron) — voor overzichtsplaten.
  In documenten volgen diagrammen de volgorde van de projectboom. ArchiMate-Grouping is in de
  standaardnotatie een gestippeld kader achter de inhoud. Afbeelding-exports bevatten geen
  selectie meer (tijdelijk opgeheven en daarna hersteld). De shape-set is nu **per diagram** bewaard en gegenereerde
  documenten volgen hem.
- **Deselecteren binnen kaders** (09-10): een klik op het lege binnenvlak van een systeemkader,
  Kader, Grouping of laagkader gaat door naar het canvas en deselecteert. Het kader zelf pak je
  bij de naam of de rand. Droppen uit de boom op een Kader of Grouping plaatst het element nu ook.
  Na een selectie met Shift+slepen verschijnt geen blauw groepskader meer; dat ving elke klik
  tussen de geselecteerde elementen, zodat deselecteren daar niet werkte. Samen slepen werkt nog.
- **Klik op leeg deselecteert weer betrouwbaar** (09-10, Mark: "ik klik toch echt op leeg"). Een
  echte muisklik beweegt vaak een paar pixels. d3-zoom maakte daar een pan van en slikte de klik
  in, en het pan-einde liet de canvas de oude selectie terugzetten. Nu telt alles tot 8px als
  klik op leeg, en de canvas zet een selectie alleen nog terug voor een element dat net
  geplaatst is.
- Het **Instellingen-icoon** is een echt tandwiel; het oude leek naast de ☀-themaknop op een zon.
- **Donker thema beter leesbaar** (10-10): de vaste slate-grijzen uit de profielen (lijnen, actor,
  start/eind, fork-balken, levenslijnen, BPMN-events) lopen via thema-variabelen
  (`--dc-lijn-slate-*`); licht blijft exact gelijk, donker wordt lichter. Zoomknoppen en minimap
  volgen het donkere thema.
- Projectsync: de volgorde van regels in de boom (Ctrl+↑/↓) en de mapomschrijving gaan nu mee
  (`schuifPlaatsing`, `zetMapOmschrijving` in `STRUCTUUR_OPS`); een volgordewijziging bleef eerder
  lokaal.

### Gefixt
- Zwevende lijnuiteinden mikken op hun dichtstbijzijnde knikpunt (niet op de andere doos); een
  knikpunt óp de rand is het uiteinde.
- EA-import: het lijnpad kwam van het eerste diagram in de bron, niet van het geïmporteerde
  (Metamodel v2026 lag met zijn generalisaties ver naast de dozen); nu per diagram. EA's Auto
  Routing en Orthogonal - Square worden *Hoekig* (waren rechte lijnen of krommen). Kleuren per
  diagramobject komen mee. Een her-import ruimt pad en vorm van een oude import op.
- Bestand-menu in Modelleren toonde twee scheidingslijnen onder elkaar.
- Een model dat niet in de lokale opslag van de browser past (localStorage ±5 MB) laat de
  import niet meer "weigeren": het blijft in het geheugen werken en het verslag meldt het.


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
