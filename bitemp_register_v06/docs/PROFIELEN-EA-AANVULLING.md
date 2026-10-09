# Profielen voor de Sparx EA-import — de "EA-aanvulling" (2026-10-09)

Opdracht Mark (via EA-SYNC, 10-10): bouw de M2-profielen die de EA-lezer
(`web/vite/src/diagramprofielen/ea/`) nog miste — als **M2-descriptor plus
adapter, geen motorwerk** (CLAUDE.md §Metaniveaus). Acht profielen, elk met
dezelfde opbouw:

| Bestand | Inhoud |
|---|---|
| `diagramprofielen/<id>/descriptor.js` | de descriptor (puur JS, laadbaar in `node --test`) |
| `diagramprofielen/<id>/eaMapping.js` | **de EA-tabel** voor de lezer: `OBJECTEN` (Object_Type + stereotype → elementtype-id), `CONNECTOREN` (Connector_Type + stereotype → connectortype-id), `RAND_ELEMENTEN`, `CONTAINERS`, `EA_DIAGRAM_TYPES` |
| `diagramprofielen/<id>/shapes.jsx` | eigen vormen (alleen waar nodig) |
| `diagramprofielen/<id>/index.js` | registratie + `maakElement` |
| `diagramprofielen/<id>/<id>.test.js` | descriptor geldig, overerving/bereik, EA-tabel sluit op de descriptor |
| `studio/activities/<id>Activity.jsx` | de activiteit (preview, niet in de balk; via Modelleren) |

Gedeeld: `diagramprofielen/uml2Basis.js` (notitie, notitie-lijn, kader,
package, `bevat`, stereotype-labels, element-fabriek) en
`diagramprofielen/uml2Iconen.jsx` (taakbalk-glyphs, namespaces `cd-`, `ob-`,
`rq-`, `ep-`, `xs-`, `ws-`, `cs-`, `cm-`).

**Elementtype-id's zijn een contract** met de EA-lezer (die mapt op EA-GUID
én op deze id's): nooit meer wijzigen, hooguit toevoegen. De tabellen
hieronder zijn een leesbare samenvatting; `eaMapping.js` is de bron.

M3-primitieven die overal terugkomen: `erft`/`isAbstract` (abstracte wortel
als bereik voor verbindingsregels), `randElement` (poorten), `containerVoor`
+ `hierarchie` (packages, nodes, klassen), `samentrekking` (interface →
lollipop), `randAanhechting: "zwevend"`, `omtrek` waar de vorm geen
rechthoek is. Elk profiel heeft notitie + notitie-lijn + kader.

---

## 1. `component-deployment` — Component & deployment

Eén profiel voor beide EA-diagramtypen ("Component", "Deployment"): de
elementen overlappen (artifact op allebei, component op een deployment).

Abstract `klassifier` → `component`, `interface`, `artifact` (→
`deploymentspec`), `node` (→ `device`, `executieomgeving`). `poort` is
randElement op component/node. Containers: component, node(-afstammelingen),
package. Interface klapt in tot lollipop (realisatie = steeltje); de
*required*-socket (halve maan) heeft de motor niet — dat is de
«use»-dependency naar het bolletje; assembly tekent bol-aan-lijn.

| EA Object_Type (stereotype) | elementtype |
|---|---|
| Component | `component` |
| Interface | `interface` |
| Port | `poort` (rand; ParentID = gastheer) |
| Artifact | `artifact` |
| Artifact («deployment spec») / DeploymentSpecification | `deploymentspec` |
| Node | `node` |
| Node («device») / Device | `device` |
| Node («executionEnvironment») / ExecutionEnvironment | `executieomgeving` |
| Package | `package` |
| Note, Text / Boundary | `notitie` / `boundary` |
| Class | `component` (verwijzing) |

| EA Connector_Type (stereotype) | connectortype |
|---|---|
| Realisation | `realisatie` |
| Usage / Dependency («use») | `gebruikt` |
| Assembly | `assembly` |
| Delegate | `delegatie` |
| Deployment / Dependency («deploy») | `deployment` |
| Manifest / Dependency («manifest») | `manifest` |
| Association (tussen node-typen) | `communicatiepad` |
| Generalization | `generalisatie` |
| Dependency | `dependency` (stereotype → `data.stereotype`, label op de lijn) |
| NoteLink | `notitielijn` |
| Nesting / Aggregation | `bevat` |

## 2. `object` — Object (instantiediagram)

`object` (naam : Klasse onderstreept; `data.instantieVan` = cross-profiel
verwijzing naar een klasse, of `data.klassifierLabel` als tekst; slots als
compartiment), `multiobject` (erft object, dubbele rand), package, notitie,
kader. Connectoren: `link` (rolnamen, gericht), `compositie`, `dependency`,
notitielijn, bevat.

| EA | elementtype |
|---|---|
| Object («multiobject») | `multiobject` |
| Object | `object` — `Classifier` → klassifierLabel; `RunState` → slots (`slotsUitRunState`) |
| Class | `object` (verwijzing) |
| Association | `link` (SourceRole/DestRole → bronRol/doelRol) |
| Aggregation (Strong) | `compositie` |
| Dependency / InstanceOf | `dependency` |

## 3. `requirements` — Requirements (EA-stijl)

Abstract `eis` (reqId, tekst, status, prioriteit, moeilijkheid) →
`requirement` (soort → stereotype «functional» …), `feature`, `issue`,
`change`. `verwijzing` = element van elders (use case, klasse, component) dat
een eis realiseert. Connectoren: `aggregatie` (decompositie, open ruit bij
het geheel, boom-route), `realisatie`, `trace`, `derive`, `verify`, `refine`,
`dependency`, `generalisatie`, notitielijn, bevat.

| EA | elementtype |
|---|---|
| Requirement | `requirement` — Alias → reqId, Note → tekst, Status/Priority/Difficulty, stereotype → soort |
| Feature / Issue / Change | `feature` / `issue` / `change` |
| UseCase, Class, Component, Actor, Activity, Object, Artifact | `verwijzing` (stereotype = het Object_Type) |
| Aggregation | `aggregatie` |
| Realisation | `realisatie` |
| Abstraction/Dependency («trace» «derive» «verify» «refine») | `trace` `derive` `verify` `refine` |
| Dependency / Abstraction (overig) | `dependency` |
| Generalization | `generalisatie` |

EA-diagramtype: "Requirements" of "Custom" met `StyleEx` MDGDgm=…Requirements.

## 4. `business` — Business (Eriksson-Penker)

`proces` (chevron, container), `doel` (schietschijf-ellips), abstract
`resource` → `fysiek` / `mensen` / `informatie` (doos met groot soort-icoon),
`gebeurtenis` (bliksem), `bedrijfsobject`, `actor`, package. De vier
EP-lijnen `invoer` «input», `uitvoer` «output», `besturing` «control»,
`levering` «supply» (resource → proces: één regel dankzij het abstracte
bereik), `doelkoppeling` «achieve», `stroom`, `dependency`, `associatie`,
`generalisatie`. EA-diagramtype "Analysis".

| EA | elementtype |
|---|---|
| Activity («process»/«business process») / Process / Activity | `proces` |
| Object/Class («goal») | `doel` |
| Object/Class («physical» «people» «information»; «resource» → fysiek) | `fysiek` `mensen` `informatie` |
| Object («event») / Event | `gebeurtenis` |
| Object/Class («business object» of zonder) | `bedrijfsobject` |
| Actor | `actor` |
| Dependency («input» «output» «control» «supply») | `invoer` `uitvoer` `besturing` `levering` |
| Dependency («goal»/«achieve») | `doelkoppeling` |
| ControlFlow / ObjectFlow | `stroom` / `invoer`-`uitvoer` (naar richting) |

## 5a. `xsd` — XML Schema

**Eigen profiel, geen stereotype-laag op puur-uml**: XSD-typen hebben eigen
compartimenten en velden (elementen met type en min/maxOccurs, attributen met
use, facets), het is een *schema-profiel* zoals oas31/graphql waar later een
XSD-tekst-adapter op past, en vermenging zou het UML-klassemodel onzuiver
maken. De vormen blijven class-boxen: het ís een klassediagram-familie.

`schema` (package-container), abstract `xsdType` → `complexType`
(elementen + attributen), `simpleType` (base, facets) → `enumeration`
(waarden), `element` (globaal), `attribute` (globaal, chip), `group`,
`attributeGroup`. Connectoren: `extension`, `restriction` (generalisaties
«extend»/«restrict»), `vanType` (element/attribuut → type; rolnaam +
occurs als label), `groupRef`, `import` (import/include/redefine),
`dependency`, notitielijn, bevat.

| EA (klassediagram "Logical", MDG XSD) | elementtype |
|---|---|
| Package/Class «XSDschema» | `schema` |
| Class «XSDcomplexType» (zonder stereotype ook) | `complexType` — t_attribute → elementen/attributen |
| Class/DataType «XSDsimpleType», PrimitiveType | `simpleType` |
| Class «XSDenumeration» / Enumeration | `enumeration` |
| Class «XSDtopLevelElement»/«XSDelement»/«XSDany» | `element` |
| Class «XSDtopLevelAttribute»/«XSDattribute» | `attribute` |
| Class «XSDgroup» / «XSDattributeGroup» | `group` / `attributeGroup` |
| Generalization («XSDextension» / «XSDrestriction» / zonder) | `extension` / `restriction` / `extension` |
| Association / Aggregation | `vanType` |
| Dependency («XSDgroupRef») | `groupRef` |
| Dependency («XSDimport» «XSDinclude» «XSDredefine») / PackageImport | `import` |

## 5b. `wsdl` — WSDL 1.1

Zelfde keuze als XSD. `namespace` (container), abstract `wsdlElement` →
`service` (ports), `portType` (operaties), `binding` (protocol/stijl,
operaties), `message` (parts, met verwijzing naar XSD-elementen), `types`
(verwijzing naar een XSD-schema). Connectoren: `realiseert` (binding →
portType), `port` (service → binding), `gebruiktMessage` (portType →
message; operatie + rol input/output/fault als label), `gebruiktTypes`,
`import`, `dependency`, notitielijn, bevat.

| EA (klassediagram "Logical", MDG WSDL) | elementtype |
|---|---|
| Package «WSDLnamespace»/«WSDL» | `namespace` |
| Class «WSDLservice» (t_attribute → ports) | `service` |
| Interface/Class «WSDLportType» (t_operation → operaties) | `portType` |
| Class «WSDLbinding» | `binding` |
| Class «WSDLmessage» (t_attribute → parts) | `message` |
| Class/Package «WSDLtypes» | `types` |
| Realisation | `realiseert` |
| Association / Dependency («WSDLport») | `port` |
| Dependency («WSDLmessage» «input» «output» «fault») | `gebruiktMessage` |
| Dependency («WSDLtypes» «use») | `gebruiktTypes` |
| PackageImport / Dependency («import») | `import` |

---

## 6. Composite structure, communication, interaction overview, timing

Marks vraag: passen ze in ons M3? Per stuk:

### `composite-structure` — ja, gebouwd

Precies het SysML-ibd in UML-vorm: abstract `structureel` → `klasse`
(container), `part` (container; type als verwijzing of tekst; referentie =
gestippeld), `collaboratie` (gestippelde ellips-container met rollen),
`collaboratiegebruik`; `poort` als randElement op klasse/part/collaboratie;
`interface` met lollipop. Connectoren: `connector` (rollen/kardinaliteiten;
`isAssembly` → bol), `delegatie`, `rolbinding` (collaboration use → part),
`realisatie`, `gebruikt`, `dependency`, notitielijn, bevat. EA-diagramtype
"CompositeStructure"; Part/Port met ParentID, CollaborationOccurrence.

### `communication` — ja, gebouwd, als eigen profiel + transformatie

Marks vraag: één onderliggend interactiemodel met twee weergaven, of twee
profielen met een M2→M2-transformatie? **Twee profielen met transformatie**,
om een M3-reden: in ons M3 is een profiel *één rendering* (DiagramType =
Definitie + Stijl + Implementatie). Een sequence-diagram legt berichten als
rand-elementen op levenslijnen tegen een verticale tijdas; een communication-
diagram legt ze als genummerde regels op een link in een graaf. Dat zijn niet
twee *gedaanten* van hetzelfde element (gedaante is per voorkomen, binnen één
profiel: lollipop/opname) maar twee *notaties*. De "F5 van Rational Rose" is
bij ons dus een transformatie in de koppelingen-matrix (lezer → regelset →
toepasser, `TRANSFORMATIES.md`): levenslijn ↔ object, bericht(punt → punt) ↔
berichtregel op de link van dat paar, volgorde op de tijdas ↔ volgnummer. De
regelset is klein en verliesvrij op de inhoud; alleen layout gaat verloren
(en dat hoort ook). Het alternatief — één profiel met twee DiagramTypes die
dezelfde store delen — zou motorwerk zijn (de store is nu per profiel).

Gebouwd: `object` (rol, `ob-object`-vorm), `actor`, `link` **met een
berichten-compartiment** (volgnummer, bericht met → / ←, soort, guard): een
connector met velden materialiseert in de motor als anker + box (het
ASOC-patroon), dus de berichtenlijst hangt vanzelf bij de lijn. De EA-lezer
vouwt EA's losse bericht-connectoren per paar samen (`vouwBerichtenTotLinks`).
EA-diagramtype "Collaboration".

### Interaction overview — past, maar als uitbreiding van `activity`, niet als profiel

Een interaction overview diagram ís een activity diagram waarvan de knopen
interacties zijn (`ref sd X` = een sequence-fragment; een inline interactie).
In ons M3 is dat een extra ElementType in het activity-profiel:
`interactiegebruik` met `gedragsVerwijzing: true` en een property
`gedragDiagramId` (datatype "diagram-verwijzing") naar een sequence-diagram —
exact het primitief waarmee `submachine`/`aanroep` al werken (dubbelklik
opent het). Geen nieuw profiel: de EA-lezer mapt Diagram_Type
"InteractionOverview" op `activity` en EA's "Interaction"-objecten op
`interactiegebruik`. Aanbeveling: dat ene elementtype in activity toevoegen
(EA-SYNC, in zijn branch; raakt alleen `activity/index.js`).

### Timing — past níet in het M3, bewust niet gebouwd

Een timing diagram is een *grafiek*: per levenslijn een toestand- of
waarde-verloop tegen een horizontale tijdas, met tijdsconstraints tussen
overgangen. De dragende structuur is een as met schaal, geen knoop-lijn-
graaf. Ons M3 kent knopen, connectoren, rand-elementen en containers; een
tijdas met proportionele plaatsing en "toestand als niveau" is een nieuw
canvas-primitief (zoals lanes dat waren voor BPMN) — motorwerk, geen
descriptor. Twee uitwegen als het ooit nodig is: (1) een tabel-/grafiek-
weergave buiten de diagrammotor (zoals de DMN-tabel naast de DRD), gevoed
door het sequence-model (de volgorde en toestanden zijn daar al); (2) een
motor-primitief "as" (randAanhechting op een geschaalde lijn). Voor nu: de
EA-lezer slaat timing-diagrammen over met een melding, en EA's "Timing"
blijft bij Marks "zelden gebruikt".

### EA "Profile" en "Metamodel" diagrammen

Dat zijn M2/M3-tekeningen: ons domein van de profiel-ontwerper en het
EA-Metametamodel-sync. Geen nieuw profiel.

---

## Stand en vervolg

- Alle acht descriptors valideren tegen het M3-contract en hebben tests
  (`node --test`); de activiteiten staan geregistreerd (preview, niet in de
  balk, via Modelleren en Ga naar).
- Vervolg bij EA-SYNC: de lezers per profiel op basis van `eaMapping.js`;
  `interactiegebruik` in activity. De exacte EA-kolomwaarden (Object_Type
  "Device" vs "Node"+stereotype; Diagram_Type van requirements/EP) zijn in
  `eaMapping.js` als alternatieven opgenomen — `scripts/inspecteer-qea.py`
  beslist per bestand.
- Later: XSD-/WSDL-tekst-adapters (lezer/schrijver) naast oas31/graphql; de
  sequence ↔ communication-regelset in de koppelingen-matrix.

---

## Addendum 2026-10-10 — BPMN/DMN-EA-tabellen, object-generalisatie

- **`bpmn` en `dmn-drd` hebben nu ook een `eaMapping.js`** voor de generieke
  EA-lezer (tweede smaak naast de native XML-import, `TRANSFORMATIES.md` §7).
  Let op de EA-werkelijkheid in het GGM: BPMN-diagrammen staan er als
  Diagram_Type "Analysis" — hetzelfde als Eriksson-Penker; de **stereotypen**
  houden ze uit elkaar (Activity«Activity», Event«StartEvent»/«IntermediateEvent»/
  «EndEvent», ActivityPartition«Pool»/«Lane», Decision«Gateway», Artifact
  «DataObject»/«DataStore», Note«TextAnnotation»; connectoren ControlFlow
  «SequenceFlow»/«MessageFlow», Dependency«DataInputAssociation»/
  «DataOutputAssociation»/«InformationRequirement», InformationFlow). Event- en
  gateway-soort komen uit tagged values (`EVENT_SOORT`, `GATEWAY_TYPE`). Een
  «IntermediateEvent» met ParentID = activiteit is een `boundary-event`.
  DMN in EA: het stereotype is leidend (`objectType: "*"`), Decision/InputData/
  BusinessKnowledgeModel/KnowledgeSource; requirements als connector-stereotype.
- **`object`** kreeg `generalisatie` (object → object): het GGM-objectdiagram
  bevat 48 Generalization-lijnen tussen klassen-op-het-objectdiagram.
- **`requirements`**: EA bewaart Priority in `t_object.PDATA2` en Difficulty in
  `PDATA3` (Status in `Status`) — in de tabel opgenomen.
- `bpmn` en `dmn-drd` hebben nu een `notitielijn` (Marks regel: notitie + lijn
  in elk profiel).
- **GGM-feiten (EA-SYNC, 10-10):** EA's «IntermediateEvent» heeft daar ParentID
  = de *pool*, niet de activiteit → gewoon tussen-event; alleen met een
  Activity«Activity»/«SubProcess» als ouder wordt het een boundary-event.
  DMN-eisen staan in EA als Dependency van de *beslissing* naar wat ze nodig
  heeft; de lezer draait ze om naar DRD-richting (InformationFlow blijft
  1-op-1). Object_Type varieert (Activity«Decision», Class«InputData», …) —
  de wildcard in `dmn-drd/eaMapping.js` vangt dat.

## Addendum 2026-10-10 (2) — BPMN-profiel op EA-niveau

Mark vergeleek "[HR] Online opgave proces" en "[HR] Opgave verwerkingsproces"
naast EA. Lijnen, nesting en maten waren lezer-/motorwerk (EA-SYNC); dit is
het M2-deel, allemaal in `diagramprofielen/bpmn/`:

| EA (tagged value / element) | Profiel |
|---|---|
| `taskType` Abstract/User/Service/Send/Receive/Manual/Script/BusinessRule | `taak.data.taakSoort` (keuze), icoon linksboven in `bpmn-taak`; `TAAK_SOORT` in `eaMapping.js` |
| `gatewayType` Complex / Event | elementtypen `complex` (✱) en `event-gateway` (ring + vijfhoek in de ruit); `GATEWAY_TYPE` |
| `eventDefinition` Escalation/Compensation/Conditional/Link/Cancel/Terminate | `data.soort` escalatie/compensatie/conditioneel/link/annulering/terminate (icoontje in de ring); `EVENT_SOORT` |
| Artifact«DataStore» | elementtype `data-store` (cilinder, `bpmn-datastore`) |
| `isCollection=true` op een data-object | `data.verzameling` (vinkje; drie streepjes onder het dokje) |
| message flow | `markerStart: "cirkel-open"` (nieuwe motor-marker, EA-SYNC) + `markerEnd: "driehoek"` |
| Dependency/Association met eigen stereotype («toekomst») tussen activiteit en data | `data-associatie` met `data.stereotype` als label op de lijn |

De BPMN-XML-lezer levert dezelfde velden (userTask → `taakSoort: "user"`,
`isCollection`, `dataStoreReference` → `data-store`, `eventBasedGateway` →
`event-gateway`, `complexGateway` → `complex`, escalation/compensate/…).
