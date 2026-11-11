// @ts-check
/**
 * diagramcore/types/schema — typedefs voor het Definitie-domein.
 *
 * Kern-ontwerpkeuze (plan §4.2): descriptors zijn plain objects met een
 * JSON-serialiseerbare kern plus optionele functie-hooks. De hooks horen bij
 * het Implementatie-domein (ActionHook, ShapeRenderer) en worden op
 * id gekoppeld; de serialiseerbare kern is de kandidaat voor het
 * configuratie-register (plan §8.5). Bewaak die scheiding: geen functies in
 * nieuwe declaratieve velden.
 */

/**
 * ActionType — declaratieve actie-definitie. De uitvoering (ActionHook) is
 * frontend-code, gekoppeld op `id`. Eén ActionType kan zowel in een menu als
 * op een taakbalk verschijnen (plan §4.6).
 *
 * @typedef {Object} ActionType
 * @property {string} id
 * @property {string} label
 * @property {string} [icoon]      - icoon-id in de shape-/icoonregistry
 * @property {string} [shortcut]   - alleen label; afvangen is een shell-taak
 */

/**
 * TaskbarType — een taakbalk-definitie binnen een DiagramType.
 * `acties` is óf een afleidingsregel (string) óf een expliciete lijst:
 *  - "elementTypes"   → één actie per niet-connector-ElementType (balk "Maken")
 *  - "connectorTypes" → één actie per connector-ElementType (balk "Verbinding")
 *  - "layouts"        → één actie per LayoutStrategie (balk "Auto-layout")
 *
 * @typedef {Object} TaskbarType
 * @property {string} id
 * @property {string} [label]
 * @property {"elementTypes"|"connectorTypes"|"layouts"|ActionType[]} acties
 */

/**
 * PropertyType — één eigenschap van een FieldType of ElementType (metamodel,
 * vierde iteratie). Declaratief: naam/key + datatype (+ evt. referenceTypes).
 * De widget volgt uit de registry datatype → PropertyTypeEditor
 * (inspector/propertyTypeEditors.jsx); profielen kunnen datatypes toevoegen
 * (bv. "cel-expressie"). Heeft de property `referenceTypes`, dan kiest de
 * editor via ReferenceResolvers (VerwijzingsKiezer: keuzelijst + minibrowser).
 *
 * @typedef {Object} PropertyType
 * @property {string} key                  - waar de waarde leeft (veld.naam of data[key])
 * @property {string} [label]
 * @property {string} [datatype]           - "string" (default) | "tekst" | "boolean" | "colour" |
 *   "keuze" | "diagram-verwijzing" | profiel-eigen. Waarde van "diagram-verwijzing":
 *   `{profielId, diagramId}` (ook een ander profiel), of een kale diagram-id = dit profiel
 * @property {{waarde: string, label: string}[]} [opties] - bij datatype "keuze":
 *   de vaste lijst (bv. BPMN-event-soorten, ArchiMate-access lezen/schrijven)
 * @property {boolean} [verplicht]
 * @property {string} [placeholder]        - voorbeeldtekst in een leeg invoerveld
 * @property {{key: string, waarde?: any}} [zichtbaarAls] - voorwaardelijk tonen (M3, 2026-10-27):
 *   de inspector toont deze eigenschap pas als eigenschap `key` aan staat (of gelijk is aan
 *   `waarde`, of één van een lijst). Alleen weergave; een gevulde eigenschap blijft zichtbaar.
 *   Bv. canoniek `tijdprecisie` met `{key: "materieel"}`. Zie diagramcore/model/zichtbaarAls.js.
 * @property {string[]} [referenceTypes]   - ReferenceType-ids; kandidaten via resolvers
 * @property {"afgeleid"|"kardinaliteit"|"standaardwaarde"|"geordend"|"nietUniek"|"alleenLezen"|"id"|"zichtbaarheid"|"beschrijving"|"verwijzing"} [betekenis]
 *   ("verwijzing", 2026-10-20: deze diagram-verwijzing ís de doorklik van het element — de
 *   gedragsverwijzing; de motor zet dan geen vaste `verwijstNaar` erbij, zie model/verwijstNaar.js)
 *   - wat deze eigenschap *betekent* voor de motor, los van haar naam
 *   (2026-10-10, UML 2.5.1 Property; zie diagramcore/model/afgeleid.js):
 *   `"afgeleid"` (boolean) → "/" vóór de naam, ook bij een relatie — zo telt
 *   MIM's `indicatieAfleidbaar` net zo als `afgeleid`;
 *   `"kardinaliteit"` → `[0..*]`, `"standaardwaarde"` → `= waarde`,
 *   `"zichtbaarheid"` (Public/Private/Protected/Package) → `+ - # ~` vóór de naam,
 *   `"geordend"`/`"nietUniek"`/`"alleenLezen"`/`"id"` (boolean) →
 *   `{ordered}`/`{nonunique}`/`{readOnly}`/`{id}` achter het type.
 *   Een veld toont zo `+/naam : Type [0..*] = 5 {ordered, readOnly}`.
 *   `"beschrijving"` (2026-10-12): deze eigenschap ís de beschrijving van het
 *   element (MIM `definitie`); de motor voegt dan geen eigen beschrijving toe
 *   (zie diagramcore/model/beschrijving.js).
 */

/**
 * FieldType — bepaalt hoe een veld rendert (FieldTypeViewer) en welke
 * eigenschappen het heeft (PropertyTypes).
 *
 * @typedef {Object} FieldType
 * @property {string} id
 * @property {"naam-type"|"tekst"|"waarde"|"sub-vak"} viewer - FieldTypeViewer-id: de
 *   compacte rij-weergave op de node (componeert de property-weergaven).
 *   "sub-vak" = een opgenomen deel als vak in het vak (zie ElementType.opname)
 * @property {PropertyType[]} [properties]
 * @property {boolean} [afgeleid] - elk veld van dit type is afgeleid (berekend,
 *   niet vastgelegd): de weergave zet er de UML-"/" voor, net als bij een
 *   veld met `data.afgeleid`. Bv. canoniek `afgeleidVeld` (2026-10-10).
 */

/**
 * CompartmentType — een sectie-definitie binnen een ElementType.
 *
 * @typedef {Object} CompartmentType
 * @property {string} id
 * @property {string|null} [label]  - null → geen kopregel
 * @property {string} fieldType     - id van het FieldType voor de regels
 * @property {boolean} [alleenWeergave] - true → gevuld door een hook
 *   (extraCompartimenten), niet handmatig bewerkbaar in de inspector
 * @property {boolean} [verbergInInspector] - true → alleen op de node tonen;
 *   de inspector slaat de sectie over (bv. als dezelfde informatie daar al
 *   via element-properties bewerkbaar is, zoals gegevenstype-validatie)
 */

/**
 * Verbindingsregels: een connector-ElementType heeft er 1..* (metamodel:
 * ConnectorType ◆ 1..* Verbindingsregel). `verbindingsregels` is de
 * volledige vorm: elke regel is een toegestane bron×doel-combinatie.
 * De verkorte vorm `bron`/`doel` (één regel, cartesiaans product) blijft
 * ondersteund. Zie ook: Verbindingsregel voor een connector-uiteinde.
 *
 * @typedef {Object} ConnectorEindpunt
 * @property {string[]} elementTypes        - toegestane element-typen
 * @property {string[]} [kardinaliteiten]   - bv. ["0..1","1","0..*","1..*"]
 */

/**
 * ElementType — de betekenis-definitie van een soort element.
 * De vorm komt uit het ShapeType (Stijl-domein), gekoppeld via `shape`; een ShapeRenderer
 * (Implementatie-domein) realiseert dat ShapeType.
 *
 * DiagramType.shapeSets (P07): optionele alternatieve gedaanten voor één
 * profiel — [{id, label, shapes: {elementTypeId: shapeId}}]. De gekozen set
 * overschrijft per elementtype de shape (menu "Shape-set"); de Definitie
 * blijft gelijk, alleen de vorm wisselt.
 *
 * @typedef {Object} ElementType
 * @property {string} id
 * @property {string} label
 * @property {string} [erft]                - id van het ouder-ElementType (EMOF
 *   Class.superClass, één ouder). Bij registratie vlakt `types/erfenis.js` uit:
 *   shape, kleur, compartments, properties, hooks, bron/doel, randElement … van
 *   de ouder komen mee, het kind overschrijft per sleutel/id. In de
 *   profiel-ontwerper is dit de generalisatie-pijl tussen twee elementtypen.
 * @property {boolean} [verwijstNaar]      - `false`: dit type heeft geen vaste doorklik
 *   (M3, 2026-10-20). Standaard heeft elke knoop `data.verwijstNaar = {profielId, diagramId}`:
 *   dubbelklik opent dat diagram, ook in een ander profiel (EA composite element). Connectoren
 *   en notities niet. Een property met `betekenis: "verwijzing"` (de gedragsverwijzing) neemt
 *   zijn plaats in. Zie diagramcore/model/verwijstNaar.js.
 * @property {boolean} [beschrijving]      - `false`: dit type heeft geen vaste
 *   M3-beschrijving (notitie-lijn, lidmaatschap). Een notitie (vorm `note`)
 *   heeft er sowieso geen: zij ís een tekst. Zie diagramcore/model/beschrijving.js.
 * @property {boolean} [isAbstract]         - niet instantieerbaar (geen knop in de
 *   Maken-balk, geen drop-doel, naam cursief), wél bruikbaar als **bereik**: in
 *   elke lijst van elementtype-ids (bron/doel, verbindingsregels,
 *   randElement.ouderTypes, afbakeningVoor, overbrugt, shapeSets) staat een
 *   abstract type voor al zijn concrete afstammelingen. Zo wordt
 *   "relatie: Representatie → Representatie" één regel.
 * @property {string} [omschrijving]        - één-regel-uitleg (taakbalk-tooltip)
 * @property {string} shape                 - ShapeType-id (bv. "class-box", "chip", "knip-box", "note", "boundary")
 * @property {string} [stereotype]          - headerregel, bv. "«entiteit»"
 * @property {"binnen"|"buiten"|"geen"} [naamLabel] - waar de naam van het element
 *   staat. `"binnen"` (default) = de shape rendert de naam zelf, zoals altijd.
 *   `"buiten"` = de motor zet de naam als los label ónder de vorm — bedoeld voor
 *   kleine, vaste vormen die geen tekst kunnen dragen (BPMN-events en -gateways,
 *   state machine begin/eind/keuze, activity-knooppunten). `"geen"` = nooit tonen.
 *   Het buitenlabel is diagram-breed uit te zetten (`data-dc-labels="uit"` op het
 *   canvasvlak, menu Beeld → Buitenlabels) — dat geldt dan voor álle profielen.
 *   N.B. shapes met `.dc-node` klippen hun inhoud (`overflow: hidden`); het
 *   buitenlabel wordt daarom bewust náást de shape gerenderd, niet erin.
 * @property {string} [kleur]               - default; instantie kan overriden
 * @property {number} [randDikte]           - vormgrammatica: randbreedte in px (identiteit = dik, bv. 3)
 * @property {number} [hoekRadius]          - vormgrammatica: hoekafronding in px (structuur = rond)
 * @property {"dashed"} [randStijl]         - vormgrammatica: gestippeld = inhoud elders beheerd
 *   (ook per element via data.randStijl); geldt voor class-box, chip en package
 * @property {"standaard"|"onzichtbaar"} [handleStijl] - aansluitpunten tonen of niet
 * @property {"rechthoek"|"ruit"|"ellips"} [omtrek] - de echte omtrek voor
 *   zwevende aanhechting: een lijn raakt een ruit (beslissing) op zijn punt of
 *   zijde en een ellips (use case, begin/eind) op de boog, niet op de
 *   onzichtbare rechthoek eromheen. Default rechthoek. Zie canvas/zwevendeRand.js
 * @property {"toppen"|"snijpunt"} [aanhechtpunten] - waar een zwevende lijn
 *   een ellips of ruit raakt. `"toppen"` = op een van de vier uiterste punten
 *   (links, rechts, boven, onder), het paar met de kortste afstand: rustig,
 *   zoals EA bij use cases en BPMN bij gateways. `"snijpunt"` = waar de
 *   middellijn de omtrek snijdt (uitwaaieren). Default afgeleid van `omtrek`:
 *   ellips/ruit -> "toppen", rechthoek -> "snijpunt". Geen profielcode nodig.
 * @property {"zijden"|"zwevend"} [randAanhechting] - waar een connector aan dit
 *   element vastpakt. `"zijden"` = de vier handles (midden van elke zijde);
 *   `"zwevend"` = het punt waar de lijn de omtrek snijdt, zodat lijnen naar
 *   verschillende buren uitwaaieren en meeglijden als je de node versleept.
 *   Zonder waarde geldt `DiagramType.randAanhechting`, en anders `"zijden"`.
 *   Een handmatig gekozen handle (`data.sourceHandle`/`targetHandle` op de
 *   connector) wint altijd — zweven geldt alleen waar niets gekozen is.
 * @property {"diagram"|"model"} [verwijderen] - connectors: wat Delete doet — van het diagram
 *   halen (default) of uit het model (sequence-bericht: een verborgen bericht op zijn eigen
 *   interactiediagram is zinloos); hooks.naVerwijderen ruimt dan het eigendom op (de punten)
 * @property {boolean} [inPalet]            - default true; false = niet in de balk "Maken" en
 *   niet in het "nieuw element"-menu — het element ontstaat anders (sequence-punt: met een bericht)
 * @property {boolean} [resizebaar]         - default true; false → geen NodeResizer
 * @property {number} [minBreedte]          - resize-minimum (default 180) — bv. smalle balken
 * @property {number} [minHoogte]           - resize-minimum (default 56)
 * @property {boolean} [achtergrond]        - true → rendert onder de andere nodes (boundaries/kaders)
 * @property {boolean} [sleeptInhoudMee]    - true → versleep je dit element, dan schuiven de nodes die
 *   geometrisch binnen zijn vlak liggen mee (informeel kader: géén lidmaatschap in het model, alleen
 *   het gebaar; vgl. containerVoor voor formele leden)
 * @property {boolean} [meerdereVoorkomens] - overschrijft de DiagramType-default voor dit elementtype
 * @property {string} [kort]                - korte knop-tekst voor de "Maken"-taakbalk (bv. "ENT")
 * @property {string} [taakbalkGroep]       - groep in de afgeleide Maken-/
 *   Verbinding-balk (bv. de ArchiMate-laag); op elke groepsgrens komt een
 *   scheidingsteken. Zonder groepen geen scheidingen — zie
 *   diagramcore/taskbar/scheidingen.js
 * @property {boolean} [isConnector]
 * @property {string} [aard] - **betekenis** van het type (M3, 2026-10-18; zie
 *   types/layoutStijl.js): wat het ís, niet hoe het getekend wordt. Connector:
 *   "stroom" | "specialisatie" | "realisatie" | "bericht" | "associatie" |
 *   "afhankelijkheid" | "toewijzing" | "insluiting" | "annotatie". Element:
 *   "begin" | "eind" | "baan". Gelezen door de layout (via de LayoutStijl) en
 *   bruikbaar voor transformaties, documenten, validatie en de MCP.
 * @property {Record<string, string>} [facetten] - indeling van het type op de
 *   facetten van het DiagramType, bv. `{laag: "business", aspect: "actief"}`
 *   (ArchiMate). Betekenis; de volgorde van de waarden staat op
 *   `DiagramType.facetten`, de keuze "rijen per laag" in de LayoutStijl.
 * @property {string|string[]} [containerVoor] - connectortype-id(s): dit type is een
 *   container (bv. package); een element erin slepen (canvas of boom) legt
 *   die lidmaatschaps-connector (bij een lijst de eerste), "Losmaken uit …" haalt hem weer weg.
 *   Een lijst sinds 20-10 (Mark; ArchiMate 3 §4.5): een grouping is container voor aggregatie
 *   én compositie. Lezers gaan via types/containerVoor.js (lidConnectoren, isLidConnector).
 *   Containers sorteren bovenaan in de elementen-boom
 *   Leden die ín de container liggen renderen als kind ervan: ze reizen mee
 *   en blijven binnen de rand (Alt+slepen tilt eruit) — canvas/nesting.js
 * @property {string[]} [afbakeningVoor]    - connectortype-ids die dit
 *   containertype **begrenst**: bron en doel moeten in dezelfde afbakening
 *   liggen (BPMN: sequence flow kruist geen poolgrens). Motor-primitief, zie
 *   canvas/afbakening.js
 * @property {string[]} [overbrugt]         - (connectortype) elementtype-ids
 *   van afbakeningen die deze verbinding **moet** kruisen: bron en doel in
 *   verschillende afbakeningen (BPMN: message flow tussen pools)
 * @property {{ouderTypes: string[], klem?: "rand"|"as"}} [randElement] - rand-aanhechting
 *   (gedragsdiagram-primitief §3.1): dit element woont óp de rand van een
 *   gastheer-element (BPMN boundary-event, state entry/exit-point, activity
 *   pin). `ouderTypes` = element-typen waaraan het mag hechten. Aanhechten =
 *   het element op/naast de rand van een gastheer slepen; het klikt dan vast
 *   op de omtrek en beweegt mee (element.data.randVan = gastheer-id; de
 *   diagram-positie is dan relatief aan de gastheer). Wegslepen = losmaken.
 * @property {boolean} [gedragsVerwijzing]  - behavior-reference
 *   (gedragsdiagram-primitief §3.2): dit element kan naar een ander diagram
 *   verwijzen (submachine state, BPMN call-activity). De verwijzing leeft in
 *   element.data.gedragDiagramId (property-datatype "diagram-verwijzing");
 *   dubbelklik op de node opent dat diagram (nieuwe tab in Modelleren). Sinds 2026-10-20
 *   een betekenis-variant van de generieke doorklik: de property draagt
 *   `betekenis: "verwijzing"` en vervangt daarmee `verwijstNaar` (model/verwijstNaar.js).
 * @property {boolean} [uitwerking] - dit elementtype kan een **uitwerking** dragen
 *   (2026-10-15, Mark: "een use case als map in de boom, met het AD eronder"): in de
 *   projectboom hangen diagrammen en elementen — uit welke taal dan ook — onder zo'n element
 *   (hun plaatsing wijst naar de element-sleutel `el::profiel::id` als ouder), zoals EA's
 *   child diagrams. Alleen zo'n element is een sleepdoel in de boom en een `map`-doel voor de
 *   assistent en de MCP; dubbelklik op het canvas opent de eerste uitwerking (na een
 *   `gedragDiagramId`). De boom blijft ordening (geen M1): de inhoudelijke band is een
 *   kruisverband of gedragsverwijzing. Zie studio/activities/modellerenActivity.jsx.
 * @property {{gedaante: string, relatieTypes: string[], labelIngeklapt?: string, labelUitgeklapt?: string}} [samentrekking]
 *   - gedaanten van een samenstel (lollipop): een voorkomen met
 *   `DiagramNode.gedaante === gedaante` rendert ingeklapt en maakt de genoemde
 *   relaties over de hele lengte kaal
 * @property {{gedaante: string, relatieTypes: string[], compartiment?: string, labelIngebed?: string, labelLos?: string}} [opname]
 *   - gedaanten van een samenstel (opname): een voorkomen van dit *deel* met
 *   `DiagramNode.gedaante === gedaante` verdwijnt als node en verschijnt als
 *   sub-vak in `compartiment` van het geheel (bron van een van de
 *   `relatieTypes`); die relatielijn vervalt. Per voorkomen, dus per diagram.
 *   Zie canvas/opname.js
 * @property {boolean} [standaardDichtInBoom] - boomrijen van dit type beginnen
 *   ingeklapt (zoals mappen in een verkenner); de chevron-klik wint daarna
 * @property {ConnectorEindpunt} [bron]     - verplicht als isConnector
 * @property {ConnectorEindpunt} [doel]     - verplicht als isConnector
 * @property {"x"|"y"|"xy"} [layoutDimensie] - in welke richting het element op
 *   het canvas beweegt (standaard "xy"); "x" = alleen opzij (sequence-levenslijn)
 * @property {Object} [edgePresentatie]     - declaratieve edge-vorm voor kale
 *   connectoren: { lijn, kleur, markerStart, markerEnd, labels, labelsBoven } (zie
 *   ConnectorEdge; labelsBoven = middenlabel boven de lijn, bv. sequence-berichten);
 *   hooks.edgePresentatie(el, {elements}) mag daarnaast sourceHandle/targetHandle/vorm
 *   voorstellen (een keuze op het diagram wint)
 * @property {PropertyType[]} [properties]  - element-brede eigenschappen voor de
 *   inspector (bv. tekst, expressie, kleur) — PropertyTypes van het ElementType
 * @property {CompartmentType[]} [compartments] - max 9, {ordered}
 * @property {Object} [hooks]               - Implementatie-domein: valideer,
 *   extraCompartimenten, inhoudsregels (eigen inhoud in het inhoudsvak, zie InhoudsRegel),
 *   naamWeergave (de naam zoals de vorm hem toont: object "jan : Persoon"; "" = geen naamregel),
 *   eigenschapUit ((element, key, {elements}) → reden of null: de inspector zet de eigenschap
 *   uit; 06-11), afgeleideEigenschappen ((element, {elements}) → [{key, label, waarde, uitleg?,
 *   inOndertitel?}]: alleen-lezen regels in de inspector, bv. het domein uit het package; 08-11),
 *   edgeLabels, naVerbinden, magVerbinden (connector: (bron, doel) → false = niet, verder dan
 *   de verbindingsregels; 06-11), verschuifConnector, edgePresentatie (connector →
 *   presentatie-overrides o.b.v. data, bv. richting → pijl), … (functies;
 *   NIET serialiseren)
 */

/**
 * ShapeType — de vorm als gegevens (Stijl-domein, M3 2026-11-04; EA: Style). `ElementType.shape`
 * en de shape-sets verwijzen ernaar met het id. Zie types/shapeType.js en docs/plans/2026-11-04
 * Eén tekenaar §3.1. Een shape-id zonder ShapeType tekent nog via de oude React-component.
 *
 * @typedef {Object} ShapeType
 * @property {string} id
 * @property {string} renderer              - ShapeRenderer-id: bibliotheekvorm of eigen renderer
 * @property {Object} [parameters]          - gewone gegevens voor de renderer, bv. `{hoekRadius: 8}`.
 *   Door de motor gelezen: `naamGewicht` (font-weight van de naam, standaard 700), `naamKlasse`
 *   (CSS-klasse op de naamregel), `naamBewerkbaar: false` (klikken op de naam hernoemt niet:
 *   diagramverwijzing), `testId` (data-testid op de canvasvorm),
 *   `inhoud` (modus van de inhoud-tekenaar; "geen" = geen inhoudsvak, de
 *   naam wordt dan een buitenlabel), `naamGrootte`, `tekstAnker`, `maxBreedte`, `factorW/factorH`,
 *   `extraHoogte` (maat.js), `vulling`/`rand` (vaste kleuren), `kleurAls: "rand"` (de eigen
 *   kleur van het element kleurt de rand, niet het vlak; de typekleur telt dan niet — kaders),
 *   `naamOnderstreept` (object-notatie), `typePrefix` (vóór het type van een veldregel: "= " bij
 *   een slot), `stereotype: false` (geen stereotyperegel) en `klasse` (een CSS-klasse op het
 *   canvas, bv. `dc-punt-node`).
 *   Een vorm kan hier ook als gegevens staan: `figuur: {viewBox, kinderen}` voor de
 *   bibliotheek-renderer "figuur" (ArchiMate-symbolen als vorm)
 * @property {{w: number, h: number}} [minMaat] - standaard; ElementType.minBreedte/minHoogte
 *   overschrijft per as
 * @property {"rechthoek"|"rand"} [ankers]  - waar lijnen aanhechten (standaard rechthoek);
 *   "rand" gebruikt ShapeRenderer.rand, zonder die functie terugval op rechthoek
 */

/**
 * ShapeRenderer — de code bij een ShapeType (Implementatie-domein; EA: Realisation). Puur: geen
 * DOM, geen store, geen React; alles wat nodig is, zit in `ctx`. Geregistreerd met
 * `registreerRenderer`. **Inhoud is van de motor:** naam, stereotype, badges, compartimenten en
 * buitenlabel tekent de renderer nooit; eigen gegevens van een type lopen via
 * `hooks.inhoudsregels`.
 *
 * @typedef {Object} ShapeRenderer
 * @property {(ctx: ShapeContext) => VormBoom} omtrek - de vorm, met de stijl uit `ctx.stijl`
 * @property {(ctx: ShapeContext) => (Vak|null)} inhoudsvak - waar de motor de inhoud zet;
 *   `null` = geen inhoud (event, gateway met buitenlabel)
 * @property {(ctx: ShapeContext) => Vak} [kindervak] - containers: waar de leden liggen (bij een
 *   pool niet het labelvak)
 * @property {(ctx: ShapeContext) => VormBoom} [ornament] - iconen en markeringen
 * @property {(ctx: ShapeContext, hoek: number) => {x: number, y: number}} [rand] - aanhechtpunt
 *   op de omtrek voor `ankers: "rand"`; hoek in graden
 * @property {(p: {element: Object, elementType: ElementType, parameters: Object, stijl: Object, diagram: Object|null, node: Object|null}) => ({w: number, h: number}|null)} [maat] -
 *   de natuurlijke maat als die van het element afhangt (fork/join: staand of liggend) of van
 *   het diagram (levenslijn: tot onder het laagste element; `diagram` alleen-lezen, `node` het
 *   eigen voorkomen); alleen zonder bewaarde maat gevraagd. `null` = de motor meet (maat.js).
 *   Krijgt sinds 05-11 ook `elementen` (alleen-lezen)
 * @property {(p: {element: Object, elementType: ElementType, parameters: Object, stijl: Object, diagram: Object|null, elementen: Object|null, node: Object|null}) => ({w?: number, h?: number}|null)} [ondergrens] -
 *   een dynamische minimummaat die ook bovenop een bewaarde maat geldt (levenslijn: altijd tot
 *   onder haar laagste punt); het canvas zet hem ook als minimum voor de resizer
 * @property {(p: {element: Object, elementType: ElementType, parameters: Object, stijl: Object, diagram: Object|null, elementen: Object|null, node: Object|null}) => ({w?: number, h?: number}|null)} [bovengrens] -
 *   een maximummaat die een bewaarde maat afknipt (levenslijn: nooit breder dan 14, ook als een
 *   import of de MCP een doos van 160 bewaarde); sinds 06-11
 * @property {boolean} [leestDiagram]       - deze renderer tekent uit `ctx.diagram` en
 *   `ctx.elementen` (levenslijn: activaties uit de berichten). Het canvas geeft zo'n renderer het
 *   levende diagram mee (posities tijdens slepen) en hertekent hem bij elke verplaatsing; een
 *   renderer zonder deze vlag krijgt op het canvas geen diagram
 */

/**
 * ShapeContext — wat de motor aan een renderer geeft.
 *
 * @typedef {Object} ShapeContext
 * @property {Object} element
 * @property {ElementType} elementType
 * @property {ShapeType} shapeType
 * @property {{w: number, h: number}} maat
 * @property {{kleur?: string, randDikte?: number, hoekRadius?: number, randStijl?: string}} stijl -
 *   door de motor opgelost: element wint van type, type van thema (`losStijlOp`)
 * @property {Object} [node]                - het voorkomen in het diagram; alleen voor een
 *   renderer die dat echt nodig heeft (`gedaante` bij samentrekking en opname)
 * @property {Object} diagram               - alleen-lezen; vervangt store-toegang (de levenslijn
 *   leidt haar activaties af uit de berichten). Op het canvas alleen voor `leestDiagram`
 * @property {Record<string, Object>|null} [elementen] - de elementen van het model, alleen-lezen
 *   (connectoren zijn geen nodes: de berichten van een sequence staan hier)
 * @property {Object} [thema]
 * @property {{h: number, minW: number}|null} [inhoud] - de door de motor gemeten inhoud (hoogte en
 *   de breedte die hij minimaal wil); `null` bij `parameters.inhoud: "geen"`. Een renderer die
 *   zijn inhoudsvak om de inhoud heen legt, leest dit; hij meet nooit zelf
 * @property {string} idPrefix              - voor id's in `clipPath` en `marker`
 */

/**
 * VormBoom — één beschrijving, twee lezers: tekst voor server en documenten, React-elementen op
 * het canvas. Alleen de tags uit `VORMBOOM_TAGS` (types/shapeType.js); tekst alleen in text en
 * tspan. Kleur: thema-token `var(--diagram-<token>, <licht>)`, tenzij het element of type een
 * kleur zet (die staat letterlijk in `ctx.stijl.kleur`).
 *
 * @typedef {Object} VormBoom
 * @property {string} tag
 * @property {Record<string, string|number>} [attrs]
 * @property {Array<VormBoom|string|number>} [kinderen]
 */

/**
 * Vak — een rechthoek binnen de vorm, in coördinaten van het element.
 *
 * @typedef {Object} Vak
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {"boven"|"midden"} [uitlijning] - inhoud bovenaan (standaard; class-box) of in het
 *   midden (use case)
 * @property {number} [rotatie]             - graden, bv. -90 voor de kop van een pool
 * @property {"midden"|"links"} [tekstAnker] - overschrijft `parameters.tekstAnker` voor dit vak
 *   (subproces: uitgeklapt links, ingeklapt midden)
 */

/**
 * InhoudsRegel — één regel eigen inhoud (`hooks.inhoudsregels(element, context)`, M3 2026-11-04):
 * bv. reqId en status van een eis, of links/op/rechts van een vergelijking. Zelfde vocabulaire
 * als de labels van `hooks.edgeLabels`. De context draagt `elements`, `diagram` en de
 * host-functies (`verwijzingLabel`, zie tekenaar/host.js).
 *
 * @typedef {Object} InhoudsRegel
 * @property {{tekst: string, soort?: string, kleur?: string, veld?: string, vet?: boolean}[]} delen -
 *   `veld` = de data-sleutel voor inline bewerken; `soort`: "badge" (een chip), "mono"
 *   (vaste breedte), "tekst" (als enige deel: wordt afgebroken over meer regels),
 *   "kardinaliteit"/"constraint"/"staart" (gedempt)
 * @property {boolean} [divider]            - een scheidslijn boven deze regel
 * @property {"links"|"midden"} [anker]     - uitlijning van de regel (standaard links)
 * @property {number} [grootte]             - lettergrootte (standaard 11)
 */

/**
 * VerwijzingsKandidaat — één keuzemogelijkheid uit een VerwijzingsBron.
 *
 * @typedef {Object} VerwijzingsKandidaat
 * @property {string} waarde   - wat er in het veld/de data terechtkomt
 * @property {string} label
 * @property {string} [icoon]  - soort-aanduiding, bv. "✦" | "◇" | "▣"
 * @property {string} [groep]  - groepskop in de keuzelijst (optgroup)
 * @property {string[]} [pad]  - boom-pad voor de minibrowser (bv. [domein])
 */

/**
 * ReferenceType — declaratieve soort-aanduiding van verwijzings-kandidaten
 * (plan §4.5b): basistype, gegevenstype, enum, ref.lijstitem, oas-schema, …
 * De bijbehorende **ReferenceResolver** (Implementatie-domein) levert de
 * kandidaten runtime en staat in `DiagramType.referenceResolvers`, gekoppeld
 * op dit id — zelfde koppelvlak-patroon als ActionType → ActionHook.
 *
 * @typedef {Object} ReferenceType
 * @property {string} id       - bv. "gegevenstype", "enumeratie", "oas-schema"
 * @property {string} label
 * @property {string} [icoon]
 */

/**
 * @typedef {(ctx: {elements: Record<string, Object>, element?: Object, veld?: Object}) => VerwijzingsKandidaat[]} ReferenceResolver
 */

/**
 * LayoutStrategie — plaatsingsstrategie van een DiagramType (plan §4.5).
 * Uitlijnen/verdelen/snap-grid zijn core; plaatsing is profiel-kennis.
 * `run` is Implementatie-domein (code); id/label zijn de declaratieve kern.
 *
 * @typedef {Object} LayoutStrategie
 * @property {string} id
 * @property {string} label
 * @property {string} [kort] - kort symbool voor de taakbalk (↓ → ⊙ …); `label` wordt de tooltip
 * @property {(invoer: {flowNodes: Object[], flowEdges: Object[], selectieIds: string[]|null, elements: Object, diagram: Object}) => Record<string, {x: number, y: number}>|Map<string, {x: number, y: number}>|{posities: Record<string, {x: number, y: number}>, maten?: Record<string, {width: number, height: number}>}} run
 *   - posities per knoop; met `{posities, maten}` krijgen containers ook een nieuwe maat.
 *
 * Leesvolgorde — het invoerformaat van de LayoutRenderer "leesvolgorde"
 * (diagramcore/layout/leesvolgorde.js). Geen profielveld meer (18-10): `regelsVoorStijl` maakt het
 * uit de aard en facetten van de typen en de LayoutStijl. Een profiel zonder eigen `layouts`
 * krijgt per stijl vier strategieën (de richting van de stijl eerst); `layoutStijlen: []` = geen
 * automatische layout (bv. sequence: de volgorde ís de tekening).
 *
 * LayoutStijl — de **weergave** van de automatische layout (M3, 2026-10-18), naast de
 * gedaante (ShapeSet): zelfde patroon als ShapeType/ShapeRenderer en LineStyle/
 * LineRenderer. De stijl noemt een LayoutRenderer (het algoritme, Implementatie-domein)
 * en regels die per type kiezen, zoals CSS: van algemeen (aard) naar specifiek (type-id),
 * bij gelijke specificiteit de laatste. Het resultaat zijn posities en maten per voorkomen
 * (zoals OMG DI). `regelsVoorStijl` (types/layoutStijl.js) vertaalt een stijl met de aard
 * en facetten van de typen naar het Leesvolgorde-formaat hieronder.
 *
 * @typedef {Object} LayoutStijl
 * @property {string} id
 * @property {string} [label]
 * @property {"leesvolgorde"} renderer      - LayoutRenderer-id (zie LAYOUT_RENDERERS)
 * @property {"TB"|"LR"|"BT"|"RL"} [richting] - leesrichting (standaard TB)
 * @property {boolean} [alleenStroom]       - alleen connectoren met aard "stroom" bepalen de
 *   volgorde (stroomdiagrammen: activity, BPMN, state machine, CMMN)
 * @property {string} [rijen]               - facet-naam: vaste lagen langs de leesrichting in de
 *   volgorde van DiagramType.facetten (ArchiMate: "laag")
 * @property {string} [kolommen]            - facet-naam voor de dwarsrichting (bv. "aspect")
 * @property {boolean} [secundairAchteraan] - een beginpunt van wie elke buur al een sterker
 *   beginpunt heeft, komt achter zijn buren (use case: secundaire actoren rechts van het kader;
 *   18-10, meting ARCH-PROJECT). Terugval tot "initiatief" in het model staat.
 * @property {string} [secundairUit]       - eigenschap op een verbinding die een beginpunt primair
 *   maakt (use case: "primair", Cockburn — Mark 18-10). Een beginpunt zonder zo'n verbinding is
 *   secundair en komt achteraan; staat de eigenschap nergens, dan `secundairAchteraan` (vuistregel).
 * @property {number} [maxPerRij]           - hoogstens zoveel elementen naast elkaar in één laag; meer
 *   slaat om in een volgende rij (ArchiMate: 6 — anders wordt een volle laag één lange strook)
 * @property {number} [kaderKolommen]       - in een container hoogstens zoveel kolommen langs de
 *   leesrichting: wat verbonden is met iets buiten het kader vooraan, de rest erachter (use case:
 *   2 — de use cases staand, include/extend-doelen in de tweede kolom)
 * @property {{laag?: number, dwars?: number, baan?: number, marge?: number}} [afstanden]
 * @property {LayoutRegel[]} [regels]
 *
 * @typedef {Object} LayoutRegel
 * @property {{aard?: string, elementType?: string, connectorType?: string, erft?: string, facet?: Record<string, string>}} selector
 * @property {{volgorde?: "mee"|"omgekeerd"|"negeer", positie?: "begin"|"eind"|null, baan?: boolean}} opties
 *   - connectoren: `volgorde`; elementen: `positie` (begin/eind) en `baan`
 *
 * @typedef {Object} Leesvolgorde
 * @property {"TB"|"LR"} [richting] - standaard (smaak: AD van boven naar beneden, BPMN van links naar rechts)
 * @property {string[]} [stroom]    - connector-ids die de volgorde bepalen (weg = alle)
 * @property {string[]} [omgekeerd] - lees doel → bron (standaard o.a. generalisatie: de ouder eerst)
 * @property {string[]} [negeer]    - connector-ids die niet meetellen (bv. message flow)
 * @property {string[]} [start]     - element-typen waar je begint (meer dan één mag)
 * @property {string[]} [eind]      - element-typen die achteraan komen
 * @property {string[]} [banen]     - container-typen die banen zijn (lanes, partities)
 * @property {string[][]} [lagen]   - vaste lagen op type, in plaats van de stroom (ArchiMate)
 * @property {boolean} [secundairAchteraan] - zie LayoutStijl.secundairAchteraan
 * @property {number} [kaderKolommen] - zie LayoutStijl.kaderKolommen
 * @property {number} [maxPerRij] - zie LayoutStijl.maxPerRij
 * @property {string} [secundairUit] - zie LayoutStijl.secundairUit
 * @property {Record<string, number[]>} [minimaal] - type-id → [breedte, hoogte] (uit ElementType.minBreedte/minHoogte)
 */

/**
 * DiagramType — één "profiel": de volledige configuratie van een diagramsoort.
 *
 * N.B. motor-interne velden beginnen met `_` (`_erfenisGenormaliseerd`,
 * `_hierarchieVoorExpansie`; op ElementType `_geerfd`, op eindpunten
 * `_voorExpansie`): gezet door types/erfenis.js bij registratie, nooit
 * serialiseren of in een profiel-kern opslaan — registreer daarom een
 * bewaarde kern altijd via `kopieVoorNormalisatie` (zie profielRegistratie).
 *
 * @typedef {Object} DiagramType
 * @property {string} id                    - bv. "canoniek-uml", "puur-uml", "oas31"
 * @property {string} label
 * @property {string} [versie]              - de versie van dit profiel, semver "1.2.3" (M3,
 *   2026-11-11). Een project noteert per profiel de versie waarmee het is bewaard
 *   (`profielVersies`); de Studio vergelijkt die bij het openen. major = bestaande modellen
 *   veranderen van betekenis of vragen een migratie; minor = uitbreiding; patch = alleen
 *   weergave. Zonder eigen versie zet de registratie "1.0.0". Zie types/profielVersie.js; de
 *   vingerafdruk-test in render-svc faalt bij een structuurwijziging zonder versieverhoging.
 * @property {string[]} [oudeBeschrijvingSleutels] - sleutels waaronder dit profiel
 *   vóór 2026-10-12 de beschrijving bewaarde (bv. `["toelichting", "notes"]`);
 *   bij het laden migreren ze naar `data.beschrijving` (elementen en velden).
 * @property {{aanwijzingen?: string[], paren?: Record<string, string[][]>}} [assistent] - voor de
 *   AI-assistent (2026-10-14): `aanwijzingen` gaan als modelleerregels de prompt in; `paren`
 *   (connector-id → toegestane [bron, doel]-typeparen) dwingt de controle af — een omgekeerd
 *   paar wordt gedraaid, een ander paar valt weg (studio/assistent/assistentKern.js).
 * @property {string} style                - StyleType-id (Implementatie-domein)
 * @property {ShapeType[]} [shapeTypes]     - de eigen vormen van dit profiel als gegevens (M3,
 *   2026-11-04); `registreerDiagramType` registreert ze. Zie types/shapeType.js.
 * @property {string|Array<string|{type: string, omgekeerd?: boolean}>} [hierarchie] - de
 *   connectortypen die de ouder-kindrelatie in de elementenboom vormen (P02, "bevat-relatie").
 *   Eén id (`"ref"`) of een lijst in volgorde van stapeling (`["bevat", "compositie"]`): de
 *   boom nest een element onder de bron van zo'n connector. `{type, omgekeerd: true}` als de
 *   pijl náár de ouder wijst (DMN: requirements naar de beslissing). Elk id moet een
 *   connectortype van dit profiel zijn (`valideerDiagramType`); een abstract type staat voor
 *   zijn concrete afstammelingen (`types/erfenis.js` breidt uit). De profiel-ontwerper leest
 *   en schrijft hem (studio/activities/profielOntwerp.js). Relaties die geen connector-element
 *   zijn, levert `hooks.hierarchieParen` (canoniek-uml: gespiegelde composities).
 * @property {"geen"|"icoon"|"tekst"} [typeWeergave] - default voor de
 *   Typering-toggle: alleen vorm, mini-icoon of stereotype-tekst (default "tekst")
 * @property {"zijden"|"zwevend"} [randAanhechting] - profiel-default voor waar
 *   connectoren vastpakken (zie ElementType.randAanhechting); per elementtype
 *   te overschrijven. Default "zijden" — bestaande profielen veranderen niet
 *   tenzij ze het zelf zetten.
 * @property {ElementType[]} elementTypes
 * @property {FieldType[]} [fieldTypes]     - de veldtypen waar CompartmentTypes naar verwijzen
 * @property {ReferenceType[]} [referenceTypes] - declaratieve soorten verwijzings-kandidaten (§4.5b)
 * @property {Record<string, ReferenceResolver>} [referenceResolvers] - Implementatie:
 *   resolver per ReferenceType-id (kandidaten uit model/runtime)
 * @property {TaskbarType[]} [taakbalken]
 * @property {LayoutStrategie[]} [layouts]
 * @property {Leesvolgorde|false} [leesvolgorde] - zie Leesvolgorde; geldt als `layouts` leeg is
 * @property {Record<string, {inPalet?: false}>} [superprofiel] - het superprofiel (M3, 2026-10-20:
 *   notitie, constraint, notitielijn, diagramverwijzing) erft elk profiel altijd; per type mag een
 *   profiel alleen het palet uitzetten, bv. `{constraint: {inPalet: false}}`. Zie
 *   types/superprofiel.js en docs/plans/2026-10-20 Notities, constraints en doorklikken.
 * @property {Record<string, string>} [hernoemdeTypen] - migratie bij het laden: elementType
 *   oud → nieuw (bv. ArchiMate `{toelichting: "notitielijn"}`)
 * @property {Record<string, string[]>} [facetten] - de facetten van dit profiel met hun
 *   **geordende** waarden, bv. `{laag: ["motivatie", "strategie", "business", …]}`.
 *   ElementType.facetten kiest daaruit (gecontroleerd bij registratie).
 * @property {LayoutStijl[]} [layoutStijlen] - weergave: de layoutstijlen van dit
 *   profiel; een diagram kiest er één met `diagram.layoutStijl` (id), anders geldt de
 *   eerste. Zonder stijlen een generieke standaard (types/layoutStijl.js stijlVoor).
 * @property {boolean} [meerdereVoorkomens] - elementen mogen meermaals in één diagram voorkomen (default false)
 * @property {{exporteer?: Function, importeer?: Function}} [serialisatie]
 * @property {(ctx: Object) => Array<Object>} [menus] - extra menubalk-menu's
 *   (zelfde itemmodel als studio/buildMenus.js)
 */

// Dit bestand exporteert alleen types (JSDoc); geen runtime-code.
export {};
