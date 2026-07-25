# Chat Samenvatting

> **Claude**-sessie (Claude Code) — de map heette historisch `copilot-chats`.

## Metadata

- Datum: 2026-07-22 t/m 2026-07-24
- Titel: Toegangsspraak — leesbare beleidstaal voor toegangsbeleid, met profiel en round-trip
- Bestandstamnaam: 2026-07-22-ontwerpen-leesbare-policy-taal-voor-toegangsbeleid
- Gerelateerde export: exports/2026-07-22-ontwerpen-leesbare-policy-taal-voor-toegangsbeleid.md
- Gerelateerde branch/commit: `feat/toegangsspraak` — 31 commits (`02c60d3` … `7263b80`),
  gemerged naar main via PR #13 (`327c703`, 2026-07-25)

## Doel

Voor de werkgroep FTV / Register Toegangsbeleid een **menselijk leesbare beleidstaal**
ontwerpen met de dekking van XACML/OPA/Cedar en ODRL, maar begrijpelijk voor leken —
inclusief werkende parser, editor in Omnium Studio, en een visuele vorm van de regels.

## Beslissingen

- **Gecontroleerde taal (CNL), geen vrij Nederlands.** Eén kernzin draagt de taal:
  *\<wie\> **mag** \<gegevens\> \<actie\>* — of **mag niet** — *[**als** \<voorwaarden\>]
  [**waarbij:** \<verplichtingen\>]*. En/of-ambiguïteit is opgelost met het
  **RegelSpraak-opsommingspatroon** ("aan alle / ten minste één / precies één van de
  volgende voorwaarden is voldaan"), nestbaar voor elke boolese combinatie.
- **De van-vorm is canoniek**: *"de achternaam van de naam van een natuurlijk persoon"*.
  "van" is een grammatica-element dat de compositie in het metamodel **omgekeerd** volgt.
  Het puntpad blijft de interne vorm (en wat drag & drop oplevert), maar de renderer
  schrijft altijd de van-vorm terug.
- **Onbepaalde termen mogen**: het lidwoord is optioneel in het definiendum
  ("Mail is …", "Inkomensgegevens zijn …"), maar **verplicht in van-ketens**, waar het
  de groepen scheidt.
- **Woordvolgorde per context**: na "als"/"waarvan" is de **bijzinsvolgorde** canoniek
  ("als de taal niet "nl" **is**"), in opsommings-bullets de **stellingsvorm** — een bullet
  ís een stelling. Beide volgordes parsen naar dezelfde AST.
- **Operatoren zijn data, geen grammatica**: een uitbreidbaar register met longest-match,
  zodat domeinprofielen (geo: *valt geheel binnen*, *overlapt*) operatoren toevoegen
  zonder één regel grammatica te wijzigen.
- **Conflictregel vast en zelf leesbaar**: wat niet uitdrukkelijk is toegestaan mag niet;
  een verbod gaat altijd vóór een toestemming.
- **Het metamodel bewaakt de types** en maakt **keten-verkorting** mogelijk zolang die
  eenduidig is; bij dubbelzinnigheid eist de taal de volledige keten.
- **Toegangsregel-profiel: de AST is het profiel al bijna.** Het diagram is de *derde
  projectie* van dezelfde AST (naast tekst en ODRL). `policy` is top-level, `map` ordent,
  en `policy —omvat→ toegangsregel` is bewust **aggregatie, geen compositie** — regels zijn
  herbruikbaar over policies en diagrammen.
- **Cross-profiel-verwijzing als paar `{profiel, element}`** met canoniek model als default,
  niet hardgecodeerd.
- **Begrippen → ArchiMate Business Object, wetten → Constraint, doelbinding → Goal**
  (motivatielaag) — beter dan een eigen elementtype, en het sluit aan op GEMMA.
- **De layout is heilig**: publiceren doet een *merge* met inhouds-stabiele ids
  (`trg:reg:…`), geen vervanging. Toevoegen raakt de posities van de rest niet;
  weggooien is weg.
- **Vormen eerst, kleur als tweede laag** — betekenis zit nooit alleen in kleur
  (verbod = gearceerde band + ⃠ + tekstlabel).
- **Lidwoord en telbaarheid als metamodel-metadata**, design-time gevuld uit een lokale
  dataset (OpenTaal/Wiktionary) — géén runtime woordenboek-API. Leg het *lidwoord* vast,
  niet het genus: Nederlanders kennen de/het wel, m/v/o niet.

## Waarom deze keuze

De leesbaarheidseis is de harde eis; alle andere keuzes volgen daaruit. Een gecontroleerde
taal met vaste zinspatronen geeft één betekenis per zin zonder de ambiguïteit van vrij
Nederlands, en het RegelSpraak-patroon is bewezen prior art. Door **de tekst de bron te
maken en ODRL/diagram als projecties** blijft er één waarheid: de terugweg reconstrueert
tekst uit het diagram-model en laat de bestaande parser de betekenis bewaken, zodat er
nooit een tweede validator ontstaat. De vaste conflictregel schrapt in één besluit de
combinatie-algoritme-complexiteit die XACML onleesbaar maakt.

## Gewijzigde onderdelen

- Bestanden: `web/vite/src/toegangsspraak/` (woorden, operatoren, parser, renderer, odrl,
  metamodel, editorSuggesties + tests), `web/vite/src/diagramprofielen/toegangsregel/`
  (index, adapter, shapes, terugweg, archimateKoppeling, canoniekResolutie + tests),
  `studio/activities/toegangActivity.jsx`, `ToegangDiagram.jsx`,
  `toegangsregelsActivity.jsx`, `modelpicker/ModelPicker.jsx` (`focusVeldpad`,
  `externeZoekterm`), `diagramprofielen/archimate/index.js` (Constraint toegevoegd),
  `diagramcore` (lijndikte per connector)
- API routes: n.v.t. (frontend/Studio)
- DB/SQL: n.v.t. — bitemporele opslag is whitepaper-fase 2
- Frontend: Omnium Studio — activiteit **Toegangverlening** (status preview) met
  teksteditor, ontleding, autocomplete, Diagram-tab en ODRL-inspector; activiteit
  **Toegangsregels** als profiel op de diagram-motor
- Docs: `docs/TOEGANGSSPRAAK.md` (functioneel + technisch), `docs/toegangsspraak-teaser.md`
  (voor de werkgroep, met screenshots), en in `docs/plans/`: taal-ontwerp (22-07),
  profiel-ontwerp (23-07), designbrief + handreiking (23-07), ontwerp-antwoord vormentaal
  (24-07), overdrachtsdocument laptop (24-07)

## Open punten

- **Plicht-subgrammatica** — voorstel ligt er (§12.2: lijdende vorm, register op
  deelwoord-niveau), maar het is een **werkgroep-besluit**: alleen lijdend, of ook gebiedend?
- **Droppen uit de projectboom op de canvas**: op GE-niveau ontbreekt alleen de
  drop-afhandeling in `DiagramCanvas`; op attribuut-niveau moet de boom eerst velden tonen
  (velden zijn nu compartiment-regels, geen elementen). De ModelPicker is de sluiproute.
- **Doorsnede-keuze** voor autocomplete/controle: domein-filter of universele projectboom.
- **Lidwoord/telbaarheid** daadwerkelijk design-time vullen in het metamodel.
- **ArchiMate-verdieping + GEMMA-afstemming** met de werkgroep; kleurenblind-toets van het
  palet.
- **Whitepaper fase 2/3**: policies bitemporeel opslaan, vertalers ODRL → Rego/Cedar,
  NLGov-profiel formaliseren (RDF/OWL), AuthZEN-koppeling.
- **Let op bij overdracht**: de Studio-state (gepubliceerd diagram-model incl. layout,
  kruisverbanden, ArchiMate-elementen) leeft in localStorage en **reist niet mee via git** —
  gebruik de gecommitte Studio-exports.

## Volgende stap

De vijf vragen uit de teaser voorleggen aan de werkgroep FTV (naam, plicht-grammatica,
begrippen-als-Business-object, lidwoord/telbaarheid, kleurenblind-toets). Technisch is de
eerstvolgende afgebakende klus het droppen uit de projectboom op de canvas, zodra
`diagramcore/canvas/` rustig is.
