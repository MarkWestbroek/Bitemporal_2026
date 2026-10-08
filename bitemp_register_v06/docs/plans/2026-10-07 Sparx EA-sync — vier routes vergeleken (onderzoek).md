# Sparx EA-sync — vier routes vergeleken (onderzoek)

Datum: 2026-10-07 · Status: **onderzoek + stap 1 gebouwd (§7)** · §5 toegevoegd na Marks opmerking dat de `.qea`'s op git staan · Claude-sessie met Mark.
Hoort bij `2026-10-06 Modelregister — het model in het register (ontwerpvoorstel).md`
§4 ("EA bijwerken") en `TRANSFORMATIES.md` (lezer → regelset → toepasser).

Vraag van Mark: wat is de beste manier om Omnium met Sparx Enterprise Architect te
**syncen**? Vier kandidaten: (A) heel model via XMI met behoud van GUIDs, (B) de
EA-automation-API, (C) de EAPX/QEA direct lezen en schrijven, (D) iets anders.

---

## 0. Wat er al is en wat de situatie bepaalt

| Feit | Gevolg |
|---|---|
| Omnium draait als **webapplicatie op een VPS** (Go + PostgreSQL 15); EA draait als **Windows-desktop** bij Mark en collega's | alles wat "op dezelfde machine als EA" moet, kan niet in de Omnium-server zitten — het moet óf aan EA-kant draaien, óf over een netwerkprotocol |
| `umleditor/export/exportXMI.js` en `import/importXMI.js` bestaan: **XMI 1.1 / UML 1.4**, met EA-extensie voor diagramposities; ids `EAID_<prefix>_<teller>` (nieuw per export) | export werkt als *eenmalige* overdracht; elke export maakt in EA **nieuwe** elementen, dus geen roundtrip |
| `diagramprofielen/mim12/adapter.js` leest XMI 2.x (`xmi:id`, `xmi:idref`) | er is al een XMI 2-lezer voor één profiel |
| Element-ids in Omnium zijn `el_<tijd>_<teller>` (canoniek-uml), geen UUID | een EA-GUID kan niet uit de Omnium-id worden afgeleid; hij moet als **externe identiteit** op het element worden bewaard |
| Transformaties zijn lezer → regelset → toepasser; een notatie is een M2-descriptor + adapter | een EA-koppeling is in deze termen: een **lezer/schrijver (adapter) voor EA's serialisatie** plus een regelset puur-uml ↔ EA-UML |
| Modelregister-voorstel: Omnium wordt bron, EA archief; later elke handeling één registratie | de sync hoeft geen symmetrische merge te zijn; "wie is eigenaar van dit pakket" volstaat |

Feiten over EA zelf (geverifieerd 2026-10-07, bronnen onderaan):

- Sinds EA 16 is **`.qea`/`.qeax` (SQLite)** het standaard bestandsformaat; `.eap`/`.eapx`
  (Jet/Access) is legacy en in de 64-bits versie niet meer ondersteund.
- EA 16 maakt een **native verbinding** met PostgreSQL (geen ODBC meer); Sparx levert een
  DDL-script (`EASchema_1558_PostgreSQL.sql`) om een lege repository aan te maken.
- XMI-import **over een bestaand pakket wist eerst alles in dat pakket** en zet de inhoud
  van het bestand ervoor in de plaats; met behoud van GUIDs blijven verwijzingen van
  buiten het pakket naar die elementen intact. "Strip GUIDs" is er om een pakket als
  kopie te importeren.
- XMI 2.1-export met "Enable full EA Roundtrip" bevat alles voor EA-naar-EA-overdracht
  (diagrammen, posities, tagged values, stereotypen) in `xmi:Extension`.
- De **Automation-API** is Windows OLE/COM: alleen op een machine met geïnstalleerd en
  gelicentieerd EA; uit-proces gebruik start `EA.exe`.
- **Pro Cloud Server** biedt een OSLC/REST-API (lezen, aanmaken, bijwerken van elementen,
  ook MDG-elementen); per web-gebruiker een token-licentie of een Team Server-licentie.

---

## 1. De vier routes

### A — XMI heen en terug, GUIDs behouden

**Hoe.** Omnium exporteert een *pakket* als XMI 2.1 (UML 2.x) mét EA-extensie; EA
importeert het over het bestaande pakket. Andersom: EA exporteert het pakket, Omnium leest
het. Elk Omnium-element bewaart de EA-GUID (`{…}`, in XMI `EAID_…`) als externe identiteit;
nieuwe Omnium-elementen krijgen bij de eerste export een vers gegenereerde GUID die daarna
vastligt.

| Voor | Tegen |
|---|---|
| geen co-locatie, geen Windows, geen licentie aan de serverkant | geen merge: EA vervangt het hele pakket; sync = "per pakket één eigenaar" |
| past één-op-één in lezer → regelset → toepasser; XMI 2-lezer (mim12) en EA-diagram-extensie (importXMI) zijn er al | bestaande exporter is XMI 1.1/UML 1.4 en moet naar 2.1 met stabiele ids |
| officieel ondersteund, stabiel over EA-versies | handmatige stap (bestand kiezen) tenzij via D geautomatiseerd |
| diagramposities reizen mee via de extensie | verlies bij alles wat Omnium niet kent (en andersom) — maar dat is inherent, niet route-gebonden |

### B — EA Automation-API (COM)

**Hoe.** Een proces op een Windows-machine met EA praat via COM (`EA.Repository`) met
een geopende repository: elementen, connectoren, attributen, tagged values, diagrammen
met coördinaten, MDG-stereotypen — alles wat de UI kan.

| Voor | Tegen |
|---|---|
| de rijkste en officieel ondersteunde toegang; semantiek klopt (EA doet zelf de boekhouding van `t_xref`, stereotypen, GUIDs) | **Windows + EA geïnstalleerd en gelicentieerd** waar de code draait; de Omnium-server is dat niet |
| fijnmazig: één element bijwerken is één call, dus echte sync mogelijk | COM uit een service/headless is broos; traag bij bulk (duizenden calls) |
| kan diagrammen **renderen** (PNG/SVG) en is elementgranulair | geen netwerkprotocol: Omnium kan het niet aanroepen zonder een tussenlaag |
| | **geen voordeel voor diagramlay-out**: de API leest dezelfde `t_diagramobjects`/`t_diagramlinks` die de XMI-extensie ook bevat |

### C — direct in de repository (EAPX/QEA/DBMS) lezen en schrijven

**Hoe.** EA's repository is een gewone relationele database met ~80 tabellen (`t_object`,
`t_connector`, `t_attribute`, `t_operation`, `t_diagram`, `t_diagramobjects`,
`t_diagramlinks`, `t_xref` (stereotypen), `t_objectproperties` (tagged values),
`t_package`, …). Drie smaken:

1. **`.eapx`** — Jet/Access: Windows-ODBC vereist, legacy, bestand staat op de pc van de
   gebruiker. *Afvallen.*
2. **`.qea`** — SQLite: triviaal te lezen met Go, maar nog steeds een bestand op de pc, dat
   EA open houdt. *Alleen bruikbaar als lees-tool naast een migratie.*
3. **Gedeelde DBMS-repository** — EA verbindt native met een PostgreSQL op de VPS; Omnium
   leest (en eventueel schrijft) dezelfde schema's server-side. Dit is de enige smaak die
   met de Omnium-architectuur spoort.

| Voor | Tegen |
|---|---|
| **lezen is veilig en compleet**: Omnium kan live EA-inhoud tonen, diffen, importeren zonder bestand; `LISTEN/NOTIFY` of triggers maken "EA is gewijzigd" detecteerbaar | **schrijven is niet ondersteund door Sparx**: `Object_ID`-autoincrements, `t_xref`-strings voor stereotypen, pakket-dubbelboekhouding (`t_package` + `t_object` van type Package), diagram-lagen; één fout en EA toont vreemde dingen |
| geen Windows, geen COM, geen licentie aan serverkant (EA-licentie blijft bij de gebruiker) | EA cachet: na een externe schrijfactie moet de gebruiker "Reload project"; gelijktijdig schrijven door EA en Omnium is niet beveiligd |
| schema is de facto stabiel (versienummer 1558 al jaren) en door de community goed gedocumenteerd | koppeling aan een ongedocumenteerd intern formaat; bij een schema-upgrade van EA breekt het stil |

### D — anders: EA zoekt Omnium op

Twee varianten die het co-locatieprobleem van B **omkeren**: niet Omnium praat met EA, maar
EA praat met Omnium via de gewone HTTP-API.

- **D1 — EA-add-in of EA-script.** Een script in EA (JavaScript/JScript, kan COM-objecten
  zoals `MSXML2.XMLHTTP` aanroepen) of een .NET-add-in met een menu-item "Naar Omnium" /
  "Uit Omnium": het leest het geselecteerde pakket via de Automation-API (dus route B,
  maar ter plekke) en POST het als XMI of als Omnium-operaties naar de server; andersom
  haalt het XMI/operaties op en past die toe via de API. Werkt met de operatie-outbox
  van `feat/projectsync` zodra die bestaat.
- **D2 — Pro Cloud Server OSLC.** Officieel, HTTP, server-side aanroepbaar vanuit Go,
  fijnmazig (element aanmaken/bijwerken). Nadeel: extra product en licenties, en de
  organisatie moet PCS al draaien.

| Voor | Tegen |
|---|---|
| D1: ondersteunde API, geen EA op de server, de gebruiker ziet in EA wat er gebeurt; kleinste stap van "handmatig XMI" naar "knop" | D1: er moet iets bij de gebruiker geïnstalleerd/geïmporteerd worden (script of add-in), per EA-installatie |
| D2: echte tweerichting-sync vanuit de server mogelijk | D2: alleen zinvol als PCS er al is; anders onevenredig |

---

## 2. Vergelijking op de vragen die er toe doen

| | A XMI | B COM | C3 gedeelde DB | D1 add-in/script | D2 OSLC |
|---|---|---|---|---|---|
| werkt met Omnium op de VPS | ✅ | ❌ (Windows+EA nodig) | ✅ | ✅ | ✅ |
| officieel ondersteund door Sparx | ✅ | ✅ | lezen: gedoogd · schrijven: ❌ | ✅ | ✅ |
| granulariteit | pakket | element | element | pakket of element | element |
| diagramlay-out mee | ✅ (extensie) | ✅ | ✅ | ✅ | beperkt |
| stabiele identiteit | GUID in XMI | GUID | `ea_guid` | GUID | GUID |
| bouwinspanning | klein–middel (exporter naar 2.1, GUID-beheer) | middel, maar buiten Omnium | lezen klein · schrijven groot | middel (client-side script) | middel + licentie |
| extra software bij gebruiker | geen | EA | geen (EA wijst naar Postgres) | script/add-in | PCS |
| risico bij EA-upgrade | laag | laag | hoog (schrijven) | laag | laag |

---

## 3. Aanbeveling

**Nu: A, met vaste GUIDs, per pakket, als transformatie.** Dat is de enige route die
zonder voorwaarden met de huidige architectuur werkt, officieel ondersteund is en
aansluit op wat er al ligt. Concreet:

1. **Externe identiteit op het element.** Een veld `externeIds: { ea: "{GUID}" }` (of een
   kruisverband-soort "identiteit in extern systeem"). Bij import uit EA gevuld; bij
   eerste export naar EA gegenereerd (UUID v4 in EA-notatie) en daarna onveranderlijk.
   Elementen zonder EA-GUID zijn "nog nooit in EA geweest".
2. **Exporter naar XMI 2.1 (UML 2.x) met `xmi:Extension extender="Enterprise Architect"`**
   voor diagrammen, posities, stereotypen en tagged values; `xmi:id` = `EAID_` +
   GUID-zonder-accolades-met-underscores. De bestaande 1.1-exporter blijft als
   "UML 1.4"-variant bestaan tot de 2.1-variant bewezen is.
3. **Lezer voor EA's XMI 2.1** als profieladapter (puur-uml als landingsprofiel, daarna
   regelset puur-uml → canoniek zoals bij de andere notaties). De mim12-adapter is
   de bron voor het XMI 2-parsen, importXMI.js voor de diagram-extensie.
4. **Sync-regel: per pakket één eigenaar.** Een pakket is óf van Omnium (export → EA
   vervangt) óf van EA (export uit EA → Omnium vervangt binnen dat bereik). Geen merge;
   conflicten bestaan dan niet. Dit is precies het model van §4 van het
   Modelregister-voorstel ("Omnium als bron, EA als archief") en van EA's eigen
   Package Control.
5. **Roundtrip-test**: canoniek → XMI → (EA importeren, exporteren) → canoniek,
   verwachte verliezen expliciet documenteren.

**Aanvulling na de constatering dat de `.qea`'s op git staan (§5): de leesrichting
loopt niet via XMI maar rechtstreeks uit de `.qea`.** Stap 3 wordt dan een
SQLite-lezer (client-side met sql.js, of server-side uit de git-checkout); stappen 1, 2,
4 en 5 blijven.

**Daarna, als de behoefte er is, in deze volgorde:**

- **C3 alleen-lezen** zodra er ooit één gedeelde EA-repository op PostgreSQL staat:
  dezelfde SQL-lezer als voor de `.qea`, maar live. Niet schrijven.
- **D1** als de handmatige XMI-stap gaat irriteren: een EA-script "Naar/Uit Omnium" dat
  dezelfde XMI over HTTP uitwisselt. Klein, ondersteund, geen serverafhankelijkheid.
- **B** niet, ook niet als migratiescript: diagramposities, knikpunten en stijlen
  komen via de XMI-extensie identiek over (EA gebruikt dat formaat zelf voor Package
  Control). Komt een diagram na import niet goed over, dan ligt dat aan onze lezer van
  de extensie en lossen we het daar op.

**Niet doen:** schrijven in EA's tabellen (C, alle smaken) en COM vanaf de server (B).
PCS/OSLC (D2) alleen overwegen als een organisatie het al heeft.

---

## 4. Open punten

- ~~Welke EA-versie en welk repositorytype gebruiken Mark en de collega's nu?~~ Beantwoord:
  `.qea`-bestanden, versiebeheerd op git (§5).
- Hoe EA de MIM-stereotypen bij import behandelt als de MDG-technologie niet is geladen
  (verwachting: stereotype-naam blijft staan, vorm/kleur niet). Testen in stap 5.
- Of `externeIds` een eigen veld wordt of een kruisverband; hangt samen met de
  M3-herziening (Kruisverband is daar al een entiteit).

---

## 5. Aanvulling: de `.qea`'s staan op git

Mark (2026-10-07): bij hen staan de EA-modellen als `.qea` in git. Dat verandert de
afweging voor de **leesrichting** (EA → Omnium); voor de schrijfrichting niet.

**Wat een `.qea` op git betekent**

- Een `.qea` is een gewone SQLite 3-database; te openen met elke SQLite-bibliotheek
  (sql.js in de browser, `modernc.org/sqlite` in Go zonder cgo).
- Op git is het bestand bereikbaar **zonder EA en zonder export-stap**; je leest altijd
  een kopie die niemand open heeft. De twee grootste bezwaren tegen route C (caching in
  EA, gelijktijdig schrijven) gelden hier niet voor lezen.
- Git kan een SQLite-blob niet mergen. Jullie werken dus al **per bestand met één
  schrijver tegelijk**: de eigenaarsregel uit §3 wordt "per `.qea` één eigenaar".
- Elke commit is een versie van het EA-model. Een Omnium-import kan de commit-hash als
  **bron van de modelversie** vastleggen (sluit aan op Publicatie/Modelversie in het
  Modelregister-voorstel): de commit is het registratiemoment aan EA-kant.

**Lezen: rechtstreeks uit de `.qea`**

| Waar | Hoe | Wanneer |
|---|---|---|
| **Studio, client-side** | sql.js (WASM); gebruiker sleept de `.qea` uit de checkout naar de Studio; lezer op `t_package`, `t_object`, `t_attribute`, `t_connector`, `t_xref` (stereotypen), `t_objectproperties` (tagged values), `t_diagram`, `t_diagramobjects`, `t_diagramlinks` → puur-uml; daarna de regelset puur-uml → canoniek | eerste stap: geen server, geen git-toegang nodig |
| **Server, uit git** | Go leest de `.qea` uit een checkout (of uit een artefact van een pipeline); import op commit-hash, optioneel getriggerd door een push | als de import onbeheerd/herhaalbaar moet zijn |

Beide delen dezelfde lezer-logica (tabellen → puur-uml); alleen de SQLite-binding
verschilt. De XMI-lezer uit §3 stap 3 wordt daarmee tweede keus (nog wel nuttig voor
modellen die níet op git staan of uit andere tools komen).

Aandachtspunten voor de lezer:

- Stereotypen staan dubbel: `t_object.Stereotype` (één naam) en `t_xref` met
  `Name='Stereotypes'` en een `Description`-string `@STEREO;Name=…;FQName=…;@ENDSTEREO;`
  (meerdere, met profiel). De `t_xref`-vorm is leidend.
- Pakketten staan dubbel: `t_package` én een `t_object` van `Object_Type='Package'`
  (gekoppeld via `t_package.ea_guid` = `t_object.ea_guid`, `t_object.PDATA1` = `Package_ID`).
- Diagramposities: `t_diagramobjects.RectLeft/RectTop/RectRight/RectBottom` (Top en Bottom
  negatief), `Sequence` = z-volgorde; connectorverloop in `t_diagramlinks.Path/Geometry/Style`.
- Associatie-einden: `t_connector.SourceRole/DestRole`, `SourceCard/DestCard`,
  `SourceIsAggregate/DestIsAggregate`; de EA-GUID is `t_connector.ea_guid`.
- Attribuuttypen: `t_attribute.Type` (naam) en `Classifier` (`Object_ID` van het type-element
  als dat in het model bestaat); `LowerBound/UpperBound` voor multipliciteit.

**Schrijven: ongewijzigd via XMI**

Omnium → EA blijft: XMI 2.1 met vaste GUIDs, importeren in EA over het eigen pakket,
`.qea` committen. Rechtstreeks in de `.qea` schrijven is hier minder gevaarlijk dan in een
live repository (bestand niet open, git kan terug), maar EA's boekhouding (`t_xref`,
dubbele pakketten, `Object_ID`-reeksen, diagramlagen) blijft ongedocumenteerd, en de
XMI-import laat EA dat zelf doen. Pas heroverwegen als de handmatige importstap
aantoonbaar in de weg zit; dan eerst D1 (EA-script dat de XMI van Omnium ophaalt).

## 6. Proef op een echte `.qea`: Gemeentelijk Gegevensmodel v2.3.0 (EA16)

Bestand: `D:\Git\Gemeentelijk-Gegevensmodel\v2.3.0\gemeentelijk gegevensmodel EA16.qea`
(66 MB, 100 tabellen, 2077 pakketten, 2260 diagrammen, 21.100 diagramobjecten).
Gelezen met `scripts/inspecteer-qea.py` plus losse SQL; alleen-lezen.

### 6.1 Wat het bestand bevat

| | Aantal | Opmerking |
|---|---|---|
| Logical (klassediagram) | 1466 | kern; daarvan 66 `Extended::Data Modeling` (EAUML table/column/PK/FK) en 28 ArchiMate3, 1 `MIM::MIM Diagram` |
| Activity | 171 | 652 Activity-elementen, 170 Actions, 26 ActionPins, 67 ActivityParameters, 60 **ActivityPartitions** |
| Use Case | 126 | 145 use cases, include/extend/realisation |
| Requirements (`Extended::Requirements`) | 152 | 424 Requirement-, 68 Change-elementen |
| BPMN 2.0 | 31 | SequenceFlow/MessageFlow als ControlFlow-stereotype |
| Statechart / Sequence / InteractionOverview | 23 / 14 / 13 | |
| Component / Object / Package / Whiteboard / DMN / overig | 15 / 15 / 12 / 17 / 4 / ~10 | |
| Stereotypen | | alle in `t_xref` (geen "losse" in `t_object.Stereotype`): `MIM::` (extern MDG), `EAUML::`, `BPMN2.0::`, `ArchiMate3::`, `VNGR SIM+Grouping NL::` (MDG **ingebed** in `t_document`, DocType TECHNOLOGY), en modeleigen `formeel`/`materieel`/`aanvang`/`beëindiging`/`registratie`/`betreft`/`registreren` (`t_stereotypes` definieert alleen `formeel`/`materieel`) |
| Tagged values | 28.511 op elementen, 15.360 op attributen, 13.394 op connectoren | GEMMA-*, domein-*, synoniemen, toelichting |
| Diagramlinks met eigen knikpunten | 4.918 van 19.431 | `t_diagramlinks.Path`; verborgen lijnen via `Hidden=1` |
| Alternate images | 8 in `t_image`, 0 elementen gebruiken er een | verwaarloosbaar |
| **Cosmetische diagram-swimlanes** | **0** | `t_diagram.Swimlanes` is bij 2243 diagrammen gevuld, maar alleen met instellingen (`locked=false;orientation=0;…`), nooit met een `<Swimlane>`; `SwimlanesActive=1` in StyleEx is een standaardvlag |

Conclusie over zwembanen: Mark herinnert het zich goed — ze zijn UML-conform als
**ActivityPartition-elementen** (60) gemodelleerd, niet als diagram-cosmetica.
Omnium's `partitie` (container in het activity-profiel) is de landingsplek; er mist
niets.

### 6.2 Hoe EA een activiteitendiagram opslaat (UC.NPA.REG.0010)

Pakket 1272 bevat drie diagrammen (use case, activity, klasse) en 28 elementen.

- **Nesting via `ParentID`, niet via pakket.** Alle knopen (Action, Decision, StateNode,
  Note) hebben `ParentID` = het Activity-element "Registreren natuurlijk persoon"; dat
  Activity-element staat zelf niet op het diagram (frame verborgen). Voor Omnium:
  EA-Activity ↔ Omnium-diagram; de knopen zijn de elementen op dat diagram.
- **Call-activity** = `Object_Type='Action'`, **naam leeg** (EA toont de naam van de
  classifier), `Classifier` = `Object_ID` van de aangeroepen Activity, en in `t_xref`
  `Name='CustomProperties'`: `@PROP=@NAME=kind@ENDNAME;@TYPE=ActionKind@ENDTYPE;@VALU=CallBehavior@ENDVALU;…`.
  Omnium: `aanroep` met `gedragDiagramId` → het diagram van de aangeroepen Activity.
- **Andere action-soorten** op dezelfde manier: `CreateObject`, `RaiseException`
  (de labels "CreateObject"/"RaiseException" boven de acties in de tekening).
- **Pins** = `Object_Type='ActionPin'`, `ParentID` = de actie, `Classifier` = het type
  (klasse), richting in CustomProperties (`kind=PinDirection, output`), eigen rij in
  `t_diagramobjects` (klein rechthoekje op de rand). Omnium: `pin` als rand-element.
- **Activity-parameters** = `Object_Type='ActivityParameter'`, `ParentID` = Activity,
  `Classifier` = type; de Activity draagt `parameterName` in CustomProperties.
- **Guards** staan in `t_connector.PDATA2` van de ControlFlow (`ja`, `nee`,
  `woon- of briefadres`). Decision = `Object_Type='Decision'`, MergeNode apart.
- **Begin/eind** = `StateNode` met `NType` 100 (initial), 101 (activity final),
  102 (flow final); 3/4/6/10–12 zijn statechart-pseudostates.
- **Use case** «registreren» (stereotype zonder profiel), `include`-connectoren met de
  voorwaarde in `PDATA4`, `Dependency «legt vast»` naar de registratieklasse,
  Realisation vanuit service/andere use case.

### 6.3 Wat de Omnium-lezer kan landen en wat (nog) mist

| EA-concept | Omnium | Status |
|---|---|---|
| ActivityPartition | activity `partitie` (container) | ✅ |
| CallBehavior-action met classifier | activity `aanroep` + `gedragDiagramId` | ✅ (lezer moet classifier → diagram oplossen) |
| ActionPin op actie | activity `pin` (rand-element) | ✅ |
| Decision + guards op flows | activity `beslissing`, `data.guard` | ✅ |
| Fork/join, initial/final/flow-final, object, note | `fork`, `begin`, `eind`, `flow-eind`, `object`, `notitie` | ✅ |
| Boundary (473, `shape=rounded`) | `boundary` in puur-uml, canoniek, usecase | ✅ klasse/use case; ❌ nog niet in activity |
| Constraint als kind-element van een klasse (op diagram apart getekend) | canoniek `constraint` | ✅ canoniek; ❌ puur-uml |
| Activity-parameters (frame met parameters) | — | ❌ nieuw: `parameter` als rand-element van het diagram/activity-frame, of als tagged lijst op het diagram |
| Action-soort CreateObject/RaiseException | — | ❌ nieuw: veld `soort` op `actie` (klein) |
| Text-element (837, vrije tekst zonder kader) | `notitie` | ⚠️ afbeelden op notitie met stijl "zonder rand" |
| Verborgen connectoren op diagram (`Hidden=1`) | `verborgenConnectoren` | ✅ |
| Eigen knikpunten (`Path`), lijnmodus (`Mode` direct/orthogonaal/boom), labeloffsets (`LLB/LMT/…`) | `knikken`, `vorm=boom`, `labelOffsets` | ✅ grotendeels; EA-labelposities zijn per label-slot |
| Kleur/lijndikte per diagramobject (`ObjectStyle`: `BCol`, `LWth`) | `gedaanteOverrides`/diagramstijl | ⚠️ deels |
| Elementen uit andere pakketten op een diagram (Relatiebeheer: 6 pakketten) | diagram plaatst willekeurige elementen | ✅ |
| `formeel`/`materieel`/`aanvang`/`beëindiging`/`registratie`/`betreft` op associaties | canoniek-uml (bitemporele relatiesoorten) | ⚠️ regelset puur-uml → canoniek nodig; dit zijn Marks eigen stereotypen |
| `MIM::Objecttype` e.d. | mim12-profiel | ✅ |
| EAUML table/column/PK/FK (Data Modeling) | erd-profiel | ✅ via regelset |
| BPMN2.0, ArchiMate3, DMN, Statechart, Sequence, Use Case | bpmn, archimate, dmn-drd, statemachine, sequence, usecase | ✅ profielen bestaan; mapping per profiel nog te maken |
| Requirements-diagrammen (152) en Requirement/Change-elementen | — | ❌ geen profiel |
| InteractionOverview, Component, Object, Package, Whiteboard, CompositeStructure, DFD | — | ❌ geen profiel (samen ~75 diagrammen) |
| Tagged values (GEMMA-*, domein-*, …) | element-`data` | ⚠️ generiek meenemen als `tags`, niet per profiel |

### 6.4 Twee andere interessante pakketten

- **Zandbak MW / Metametamodel** (46 klassen, 70 connectoren, 4 boundaries
  Definition/Implementation/Model/Style): Marks M3 getekend in EA, vrijwel één-op-één
  met `diagramcore/types/schema.js` (ElementType, ConnectorType, FieldType,
  CompartmentType, Verbindingsregel, ReferenceResolver, …) plus concepten die daar nog
  niet zijn (ActionType/ActionHook/TaskbarType/TaskbarConfiguration, Workspace/User/
  Project/ProjectFolder, Property/PropertyType/Reference/ReferenceType, StyleType,
  ShapeSet/ElementtypeSet, Position, Domain). Puur klassediagram met rolnamen,
  kardinaliteiten en notities: **ideale eerste roundtrip-test** voor de lezer, en de
  tekening waar het Modelregister-voorstel §4 naar verwijst.
- **Zandbak MW / LGM 2025 / Dienstverlening / Relatiebeheer**: één Logical-diagram met
  Partij als spil, elementen uit zes pakketten, boundaries Relatiebeheer/Uitvoering,
  een Constraint als kind van Partij, benoemde associaties met rollen/kardinaliteiten en
  «materieel»/«formeel»-aggregaties. Goede test voor de bitemporele relatiesoorten.

### 6.5 Gevolg voor de aanbeveling

Ongewijzigd: lezen rechtstreeks uit de `.qea`. De lezer landt op **puur-uml / activity /
usecase** als tussenprofiel; daarna regelsets naar canoniek, mim12, erd, bpmn, archimate.
Eerste bouwvolgorde: (1) klasse + boundary + constraint (Metametamodel, Relatiebeheer),
(2) activity met partitie/aanroep/pin/guards (UC.NPA.REG.0010), (3) use case. Nieuw te
maken in Omnium: activity-parameters, action-soort, boundary in activity, Text-stijl.
Geen profiel voor Requirements en de ~75 overige diagrammen; die slaan we over tot er
vraag naar is.

### 6.6 Metametamodel → schema.js: overerving en `abstract` op ElementType

Mark (07-10): het EA-Metametamodel wás de basis voor `schema.js`; hij heeft er recent
een **generalisatie ElementType → ElementType** en een attribuut **`abstract: boolean`**
op ElementType in gezet. Beide staan in het bestand (ElementType [17343]: attributen
`name`, `abstract: boolean`; generalisaties `ElementType → ElementType` en
`ConnectorType → ElementType`). In `schema.js` bestaat geen van beide: ElementType kent
geen `erftVan`/`abstract`, en `ConnectorType → ElementType` zit er impliciet in als
`isConnector`.

**Doel:** het metamodel voor het canonieke model (`Zandbak MW / Bitemporeel CG 2026 /
Metamodel v2026`, 51 elementen) in Omnium kunnen bouwen met een abstracte
`{Representatie}` (naam `{id}`, alias, beschrijving) boven `{Entiteit}`,
`{Gegevenselement}` en `{Relatie}`. In EA staat het zo:

- `{Entiteit} → {Representatie}` en `{Gegevenselement} → {Representatie}`;
  **`{Relatie} → {Gegevenselement}`** (een relatie is dus een gegevenselement, en
  daarmee een representatie); `{AfgeleideRelatie} → {Relatie}`.
- `{Relatie}` heeft `van`/`tot` naar `{Representatie}` (rollen `bron`/`doel`, 1) en
  `bronrol`/`doelrol` naar `{Rol}` (met `{Momentvoorkomen}` en `Kardinaliteit`);
  `type: {Relatietype}`, `tijdlijn: {Tijdlijnvoorkomen}` (formeel/materieel).
- Verder: `{Identificatie} → {Gegeven}`, `{Enumeratie} → {Gegevenstype}`,
  `{Referentielijst} → {Entiteit}`, `{Referentielijstelement} → {Entiteit}` **én**
  `→ {Gegevenstype}` (meervoudige overerving), `{Validatie} → {Bedrijfsregel}`,
  `{Bedrijfsregel}` met `voldoet aan`-aggregaties naar `{Representatie}` en `{Gegeven}`,
  `{Melding}`/`MeldingType`, en buiten het register `Subject` en
  `Eigenschap / Relatie` (abstract) als "werkelijke wereld".

**Wat de M3 daarvoor nodig heeft (voorstel, klein):**

| Veld op `ElementType` | Betekenis | Gevolg in de motor |
|---|---|---|
| `erftVan?: string` | id van het ouder-elementtype (één ouder; meervoudig = later, EA gebruikt het wél bij Referentielijstelement) | de profiel-lader **vlakt uit**: shape, kleur, compartimenten, velden, stereotype, containerVoor, randElement … van de ouder komen mee, het kind overschrijft per sleutel |
| `abstract?: boolean` | type is niet instantieerbaar | geen knop in de Maken-balk, niet als drop-doel; wél bruikbaar als **bereik**: overal waar nu lijsten van elementtype-id's staan (`bron.elementTypes`/`doel.elementTypes` van verbindingsregels, `randElement.ouderTypes`, `containerVoor`-doelen, `afbakeningVoor`) telt een abstract type als "alle concrete afstammelingen" |

Precies dat tweede punt is wat `{Relatie}` met `bron`/`doel` → `{Representatie}` nodig
heeft: één verbindingsregel `relatie: Representatie → Representatie` in plaats van de
uitgeschreven lijst `entiteit | gegevenselement | relatie`. De profiel-ontwerper in de
Studio krijgt dezelfde twee velden.

**Tijd-stereotypen.** `«aanvang»` (119), `«beëindiging»` (44), `«registratie»` (30) en
`«betreft»` (106) staan allemaal in `Zandbak MW / HR 2020` en `HR 2025`, in de pakketten
*[NPA] Objectenstructuur* en *Gebeurtenissen / Gebeurtenis / …* — de
gebeurtenismodellen van het Handelsregister. `Metamodel v2026` gebruikt ze niet; daar
is de tijdlijn een attribuut (`tijdlijn: {Tijdlijnvoorkomen}` = formeel/materieel), net
als canoniek-uml nu (`materieel: boolean` op `relatie`, formeel is default). De lezer
moet de vier stereotypen dus wél aankunnen als hij de HR-modellen leest, als
stereotype-label op een aggregatie/associatie (puur-uml), zonder er in canoniek iets
mee te doen tot er een regel voor is.

### 6.7 Aanvullingen na Marks reactie (07-10, avond)

- **Use case-realisatie (gestippelde ovaal).** De notatie is standaard UML 2:
  een *Collaboration* (UML 2.5 §11.7) wordt als gestippelde ellips getekend. De náám
  "Use Case Realization" komt uit RUP/UML 1.x; EA slaat hem op als
  `Object_Type='Collaboration'` (92 stuks, plus 4 met «registreren»; 6
  `CollaborationOccurrence`) met een `Realisation`-connector naar de use case. Dat het
  "als een map werkt" is EA, niet UML: EA laat onder élk element kind-elementen en
  kind-diagrammen hangen (`t_object.ParentID`, `t_diagram.ParentID`). In dit bestand is
  dat bij de twee `UC.NPA.NP.0060`-collaborations niet gebruikt (0 kinderen, 0
  kind-diagrammen). Omnium: elementtype `collaboratie` (gestippelde ellips) in het
  use case-profiel plus connector `realiseert`; het map-aspect dekt de projectmap, of
  `containerVoor` als het een echte container moet zijn.
- **Ontbrekende profielen**, aangevuld: Component (15 diagrammen hier), Object (15),
  **Deployment** (0 hier, maar wel UML), InteractionOverview (13), Package (12).
- **`erftVan` is in M2 tekenbaar.** De profiel-ontwerper is zelf een diagram met het M3
  als profiel; een ElementType is daar een element. Een generalisatie-pijl tussen twee
  ElementTypes ís `erftVan`, precies zoals in UML. Niet verwarren met de
  M1-`generalisatie` tussen twee entiteiten (een modelfeit, geen type-overerving);
  canoniek-uml rendert die al als supertype-keten (cursief, ↑-kopregel).
- **`abstract` = cursieve naam**, zoals UML. puur-uml heeft al `abstract` als eigenschap
  op een klasse (M1); dezelfde weergaveregel geldt voor een ElementType in de
  profiel-ontwerper, plús de regel "niet instantieerbaar, wel bereik" uit §6.6.
- **Representatie bestaat al in de backend**: `model/abuvwxy_metaregistry.go` gebruikt
  `Representatie` als Go-interface voor alle registertypen (`Factory: func() Representatie`).
  Een abstracte `representatie` als wortel van het canonieke M2 (entiteit,
  gegevenselement, relatie erven naam/alias/beschrijving, de `regel`-koppelingen en
  de afleidings-relaties één keer) haalt de dubbelingen uit het profiel en brengt M2
  en backend op dezelfde naam.

### 6.8 Stereotypen en tagged values: de lezer is verliesvrij, het profiel kiest

Mark: "Moet de lezer niet in principe elk stereotype aankunnen? Er komen nog zware
MIM-modellen, die barsten van de stereotypen. En tagged values: met mate in HR, standaard
in MIM."

**Ja — het principe is: de lezer gooit niets weg, de profieladapter interpreteert.**

Wat er in dit bestand zit: 26 profielen, 5542 toepassingen van 172 verschillende
stereotypen *zonder* profiel, 1492 `MIM::` (11 verschillende: Objecttype 930,
Enumeratie 325, Attribuutsoort 141, Domein 53, Enumeratiewaarde, Generalisatie,
Relatiesoort, Gegevensgroeptype, Gestructureerd datatype, Informatiemodel,
Gegevensgroep), 607 `MIG::` (de oudere MIG-variant: Attribuutsoort 410, Referentie
element 85, Relatiesoort 49, Data element, Generalisatie, Complex datatype,
Gegevensgroep compositie, Union), 1438 `EAUML::`, 991 `BPMN2.0::`, 492 `ArchiMate3::`.
Zwaartepunt MIM: *Delfts Gemeentelijk Gegevensmodel* (Kern/RSGB, Sociaal Domein, ICT,
HR, Volkshuisvesting).

**Transport (lezer, generiek, altijd):**

| EA | Omnium (op `element.data`, `connector.data`, en per attribuut) |
|---|---|
| `t_xref Stereotypes` → lijst `FQName` (of `Name`) | `stereotypen: ["MIM::Objecttype", …]` — volledige naam, volgorde behouden; `t_object.Stereotype` alleen als fallback |
| `t_objectproperties` (Property, Value, Notes) | `tags: { "<Property>": value }` op het element; dubbele namen → lijst |
| `t_attributetag` | `tags` op het attribuut (compartimentregel) |
| `t_connectortag` | `tags` op de connector |
| `t_xref CustomProperties` (`kind=CallBehavior`, `PinDirection`, …) | `custom: { kind: "CallBehavior", … }` |

Daarmee overleeft álles de rit naar puur-uml, ook wat geen profiel kent; de inspector
toont onbekende stereotypen als label in de kopregel en onbekende tags onder "Overig".

**Interpretatie (regelset per profiel):**

- `MIM::Objecttype` → mim12 `objecttype`; `MIM::Attribuutsoort` → attribuut; enz. De
  **MIM-standaardtags** zijn al typed properties in mim12 (`alias`, `begrip`, `definitie`,
  `toelichting`, `herkomst`, `datumOpname`, `herkomstDefinitie`, `uniekeAanduiding`,
  `populatie`, `kwaliteit`, `indicatieAbstract`, `authentiek`,
  `indicatieMaterieleHistorie`, `indicatieFormeleHistorie`, `mogelijkGeenWaarde`,
  `identificerend`, `indicatieAfleidbaar`, `waardenverzameling`): de regelset is een
  naam-afbeelding `tags["Herkomst definitie"] → herkomstDefinitie` (EA schrijft ze met
  spaties en hoofdletters, en soms `Melding::Tekst`-achtige namespaced namen). Wat
  overblijft (GEMMA-*, domein-dcat/gemma/iv3, synoniemen) blijft in `tags`.
- `MIG::` is de voorloper: dezelfde regelset met een tweede naamtabel.
- Stereotypen zonder profiel (`formeel`, `materieel`, `registreren`, `representatie`,
  `niet authentiek`, `hrd hulp`, …) blijven label; een profiel kan er later een regel
  voor krijgen.

**Wat dit vraagt van de motor:** één generieke `tags`-map en één `stereotypen`-lijst op
element, connector én attribuut (nu zijn properties per ElementType getypt en is er
geen "overig"-vak); de inspector toont ze; de XMI 2.1-schrijver zet ze terug als
`xmi:Extension` tagged values en stereotypen, zodat de roundtrip ze niet verliest.
Zonder dat vak is elke MIM-import lossy en elke export naar EA incompleet.

**Testvolgorde voor MIM:** eerst `99 Kern / RSGBPlus / RSGB Model / Model Kern RSGB`
(47 objecttypen, MIM-tags standaard), dan een zwaar extern MIM-model van Mark.

### 6.9 Diagrammen en posities uitlezen

Alles wat een EA-diagram tekent staat in drie tabellen; coördinaten zijn pixels bij 100 %
en direct bruikbaar. Eén valkuil: de **y-as is omgekeerd** (`RectTop`/`RectBottom`
negatief; `importXMI.js` doet daarom al `Math.abs(top)`).

| EA | Betekenis | Omnium |
|---|---|---|
| `t_diagram.cx/cy`, `Scale`, `Orientation` | canvasmaat, zoom (66 = 66 %), staand/liggend | `Diagram.viewport`; zoom beïnvloedt de opgeslagen coördinaten niet |
| `t_diagram.PDATA` (`HideAtts`, `HideOps`, `ShowTags`, `UseAlias`, …) | weergavetoggles per diagram | `Diagram.stijl` |
| `t_diagramobjects.RectLeft/RectTop/RectRight/RectBottom` | absolute rechthoek, ook voor geneste elementen en pins | `node.position = {x: RectLeft, y: -RectTop}`, maat `{w: RectRight-RectLeft, h: RectTop-RectBottom}` (`updateNodeSize`); nesting in containers rekent `canvas/nesting.js` zelf uit op geometrie |
| `t_diagramobjects.Sequence` | z-volgorde, **laag = bovenop** (notes seq 1, boundaries als laatste) | volgorde van `nodes[]`; boundaries hebben `achtergrond` |
| `t_diagramobjects.ObjectStyle` (`BCol`, `LCol`, `LWth`, `font`, `bold`, `DUID`) | kleur/lijndikte **per diagramobject**; `BCol` is BGR-integer (12641528 = `#F8E0C0`) | `gedaanteOverrides` / `data.kleur`; per-diagram kleur op één element bestaat niet → eerste diagram wint, of per-node stijl toevoegen |
| `t_diagramlinks.Path` = `x:y;x:y;` | knikpunten, absoluut, y negatief | `data.knikken` |
| `t_diagramlinks.Geometry`: `SX/SY/EX/EY` | verschuiving van begin-/eindpunt t.o.v. het aanhechtpunt | `sourceHandle`/`targetHandle` of `randAanhechting: zwevend` |
| … `EDGE` | zijde waar de lijn vertrekt (1 links, 2 rechts, 3 boven, 4 onder) | handle-keuze |
| … `LLB/LLT/LMT/LMB/LRT/LRB` (`CX:CY` maat, `OX:OY` offset, `HDN`) | zes label-slots: links/midden/rechts × boven/onder | `data.labelOffsets` per zijde (begin/midden/eind); boven/onder samenvoegen |
| `t_diagramlinks.Style`: `Mode` | 1 direct, 2 automatisch gerouteerd (EA schrijft dan zelf een `Path`), 3 handmatig/orthogonaal, 8 zeldzaam; verdeling hier 212 / 5400 / 13110 | Mode 1 → geen knikken; 2 en 3 → knikken overnemen |
| … `TREE=OS|V|H` | boomstijl (orthogonaal-vierkant, verticaal, horizontaal) | `vorm=boom` + handles ("Kinderen in boomstijl") |
| … `SOID`/`EOID` | `DUID` van het bron-/doel-**diagramobject** (niet het element) | nodig bij meerdere voorkomens: `DUID → nodeId` |
| … `Color`, `LWidth` | lijnkleur/-dikte per diagram | connectorstijl |
| `t_diagramlinks.Hidden=1` | lijn op dit diagram verborgen | `Diagram.verborgenConnectoren` |

Drie echte vertaalpunten, de rest is rekenwerk:

1. **Routing is in EA per diagram, in Omnium per connector.** `t_diagramlinks` is één rij
   per (diagram, connector); `data.knikken`/`labelOffsets` zitten op het element. Een
   connector die op twee diagrammen anders loopt verliest één van de twee. Oplossing:
   knikken/labels in `Diagram.connectorVoorkomens` (per diagram) als dat er is, anders
   "eerste diagram wint" en dat documenteren.
2. **Meerdere voorkomens.** EA koppelt een lijn aan een diagramobject (`DUID`), Omnium
   aan `nodeId`. De lezer houdt per diagram een `DUID → nodeId`-tabel bij en maakt bij een
   tweede plaatsing van hetzelfde element een voorkomen (`meerdereVoorkomens`).
3. **Kleur per diagramobject.** EA kan hetzelfde element op elk diagram anders kleuren;
   Omnium kleurt het element. Eerste diagram wint, tenzij we een per-node stijl toevoegen.

Vrijwel niets hiervan is EA-specifiek: de XMI 2.1-extensie bevat dezelfde velden met
dezelfde namen (`geometry="Left=…;Top=…;Right=…;Bottom=…;"`, `<path>`, `<style>`), dus
de SQLite-lezer en de XMI-lezer delen de vertaling.

## 7. Gebouwd: stap 1, de `.qea`-lezer naar puur-uml (2026-10-08)

Branch `feat/ea-qea-lezer` (worktree `D:\Git\Bitemporal_2026_ea`), niet gecommit.

| Bestand | Rol |
|---|---|
| `web/vite/src/diagramprofielen/ea/qeaHulp.js` | pure parsers: `t_xref`-stereotypen en CustomProperties, `Path` → knikpunten (y gespiegeld), rechthoek → positie/maat, BGR-kleur, GUID → id, kardinaliteit uit grenzen, deelboom van pakketten |
| `…/ea/qeaNaarPuurUml.js` | pure vertaler: rijen (EA-kolomnamen) → `{elements, diagrams, verslag}`; Class/Interface/Enumeration/DataType/Note/Text/Boundary; Association/Aggregation (ruit aan het geheel; `SubType Strong` = compositie)/Generalization/Realisation/Dependency; packages + `bevat`; diagrammen met nodes (positie, maat, z-volgorde), `verborgenConnectoren`, knikpunten van het eerste diagram waarop de lijn staat |
| `…/ea/qeaKern.js` | gedeeld: hulptabellen, `extraData`, knikpunten (incl. OS), `bouwDiagram`, `maakConnectorElement` |
| `…/ea/qeaNaarActivity.js` | activity-lezer (§7.1 punt 8) |
| `…/ea/qeaLezer.js` | sql.js (lui geladen, wasm via `?url`): `openQea(bytes)`, `leesPakketten(db)`, `leesBron(db, packageId)` — haalt ook elementen van elders op die op een diagram van het pakket staan |
| `…/ea/importQea.js` | Studio-kant: pakketkeuze (`vraagKeuze`, nieuw in `naamDialog.jsx`) → model; verslag bij weglatingen |
| `…/ea/fixtures/metametamodel.qea.json` | de rijen van *Zandbak MW / Metametamodel* (+ *Examples*) uit het echte bestand, als testfixture (100 kB) |
| `…/ea/qeaNaarPuurUml.test.js` | 15 tests op die fixture: aantallen, identiteit, attributen (`abstract: boolean`), zelf-generalisatie, aggregatierichting, rolnamen, realisatie-fallback, posities/maten/z-volgorde, kaders, notities, knikpunten, parsers |
| `studio/activities/puurUmlActivity.jsx` | `koppeling.importBestand` (`binair: true`) |
| `studio/activities/maakDiagramActiviteit.jsx` | `importBestand.binair` (ArrayBuffer) en `verwerk` mag `null` teruggeven (afgebroken) |
| `scripts/inspecteer-qea.py` | doorlichten van een `.qea` (§6) |
| `package.json` | `sql.js` 1.14.2 |

**Proef in de browser** (Playwright, dev-server op 5176, API gemockt): het echte
bestand (66 MB) opent in 0,8 s; pakketkeuze uit 2077 pakketten; *Metametamodel* →
170 elementen (43 klassen, 4 kaders, 5 notities, 20 associaties, 15 aggregaties,
12 composities, 6 generalisaties, 10 dependencies, 2 packages, 53 bevat) en 2
diagrammen; *Editor* rendert 46 nodes en 60 lijnen op de EA-posities, met de vier
kaders Model/Definition/Style/Implementation.

**Schaal.** EA tekent bij 100 % met een 8-punts letter in dozen van ~120×60; Omnium
heeft een vaste grotere letter en een minimumbreedte van 180 px. Zonder correctie
groeien de dozen maar de afstanden niet en loopt alles in elkaar (Mark, 08-10). De
lezer vermenigvuldigt daarom posities, maten en knikpunten met `EA_SCHAAL` = 1,5
(optie `schaal` van `qeaNaarPuurUml`); daarmee kloppen de verhoudingen weer.

**Lijnen (08-10, avond).** EA "Orthogonal - Square" (`TREE=OS`) bewaart alleen de
hoekpunten; de lezer zet de haakse aanhechtpunten erbij (`haaksAanhechtpunt`) en maakt
de stukken haaks (`maakHaaks`). In de motor mikt een zwevend uiteinde nu op zijn
dichtstbijzijnde knikpunt in plaats van op de andere doos, en een knikpunt dat precies
op de rand ligt ís het uiteinde (`zwevendeRand.richtpuntOfAanhechtpunt`) — anders sprong
elke geïmporteerde lijn eerst schuin naar zijn eerste knik.

**Eén import voor het hele project (09-10).** Mark importeerde UC.NPA.REG.0010 in de
UML-activiteit en kreeg geen use case-model: elke profiel-import leest alleen zijn eigen
diagramsoort. Daarom in Modelleren *Bestand → Importeer Sparx EA (.qea)…*
(`diagramprofielen/ea/importQeaProject.js`): bestand → pakketkeuze → alle lezers over
hetzelfde pakket. Klassediagrammen (alles behalve Activity/Use Case) → puur-uml, of mim12
als het pakket `MIM::`/`MIG::`-stereotypen draagt; Activity → activity; Use Case → use case.
Elke uitkomst gaat als "toevoegen" (undo per profiel) in de store van dat profiel; de
verslag telt alleen EA-typen die géén lezer kent (bij UC.NPA.REG.0010:
ActivityParameter). De profiel-imports heten nu "… — alleen dit profiel…".

**De EA-boom als projectboom (09-10, Marks vraag "kan dat?").** EA toont het diagram in
de activity, die in de use case zit, die in het pakket zit; onder het diagram de acties en
beslissingen. De project-import bouwt dat na (`plaatsEaInProjectboom` in
modellerenActivity.jsx): pakketten worden mappen; elementen die een diagram "bezitten"
(`t_diagram.ParentID`, en via `ParentID` hun eigenaars — de activity en de use case
erboven) worden óók mappen, met «stereotype» in de naam; het diagram staat in de map van
zijn eigenaar, de knopen (acties, beslissingen, pins, einden) ernaast, de rest in de map van
zijn pakket. Naamloze notities blijven uit de boom. Mappen worden hergebruikt (zelfde naam
onder dezelfde ouder), dus een tweede import geeft geen dubbele boom. Elementen van buiten
het gekozen pakket (klassen van elders op een diagram) krijgen geen map. Na de pakketkeuze
vraagt de import **waar** in het project (een bestaande map of de wortel; `kiesDoel`): de
bron bepaalt wát het is, de gebruiker wáár het komt. In Modelleren is dit de enige EA-import
onder Bestand (de profiel-varianten "alleen dit profiel" staan alleen in de losse
activiteiten).

**Volgende stap (Marks wens, 09-10): merge op GUID.** Kies je een bestaande map waar het
pakket al in staat, dan zou de import moeten *synchroniseren* in plaats van toevoegen: per
`data.eaGuid` het bestaande element/diagram bijwerken als het anders is (naam, velden,
positie), nieuwe toevoegen, en melden wat er veranderde — zonder nieuwe ids, zodat
kruisverbanden en plaatsingen blijven staan. De bouwstenen zijn er (stabiele ids uit de GUID,
`importeerModel` als één undo-stap, de mappen worden al hergebruikt).

**Daarbij hoort een review-stap met aan-/uitvinken** (Mark, 09-10; het "proefdraaien met
een verschil-overzicht" uit TRANSFORMATIES.md §2/§7 dat de transformatielaag nog mist): vóór
het invoegen een overzicht per diagram en element — nieuw / gewijzigd (met wat er verschilt)
/ ongewijzigd / in EA verdwenen — waarin je per regel kiest wat mee mag. Dezelfde dialoog
voor de eerste import (alles aangevinkt) en voor de merge; het verschil-overzicht is ook de
plek voor de trace.

### 7.1 Openstaand — de lijst uit het gesprek (08-10)

**Lezer, klassediagrammen**

1. ~~**Notitie-lijnen** (NoteLink, 874 in het bestand)~~ ✅ 08-10: `notitielijn` in puur-uml
   (stippel, geen pijl, notitie als bron) en de lezer zet NoteLinks erop om. Nog niet in
   canoniek/activity.
2. Realisatie naar een **klasse** wordt dependency «realize» (puur-uml staat realisatie
   alleen naar een interface toe) — of de verbindingsregel verruimen.
3. **Kleur per diagramobject** (`ObjectStyle BCol/LWth`), nu alleen `t_object.Backcolor`
   (Domain grijs, ProjectFolder geel komen níet mee).
4. **Labelposities** per lijn (`LLB/LMT/…`) → `labelOffsets`.
5. **Routing per diagram**: eerste diagram wint; `Mode=2` (EA auto-routing, geen Path) wordt
   een rechte lijn.
6. **Operatieparameters** (`t_operationparams`); constraint als kind-element in puur-uml;
   Text-element als notitie zonder rand.
7. ~~Import-modus **"ernaast" met undo**~~ ✅ 08-10: bij een niet-lege sandbox kiest de
   gebruiker *Toevoegen naast wat er is (Ctrl+Z maakt het ongedaan)* of *Alles vervangen*.
   Toevoegen = `hernoemBotsendeIds` (botsende element-/diagram-ids hernoemd mét verwijzingen)
   + `importeerModel` (één undo-stap). Geldt voor élke profiel-bestandsimport (MIM, OAS, …).
   De pakketkeuze heeft een zoekveld (`vraagKeuze({zoekbaar: true})`, meerdere woorden).

**Lezer, stap 2 en verder**

8. ~~**Activity-lezer**~~ ✅ 08-10 (`qeaNaarActivity.js`, *Bestand → Importeer Sparx EA* in de
   Activity-activiteit): alleen de Activity-diagrammen van het pakket; knopen via `ParentID`
   onder het frame; aanroep (`CallBehavior`, naam van de classifier, `gedragDiagramId` als het
   aangeroepen diagram meekomt), pins als rand-element (`randVan`, positie relatief; ook pins
   die EA niet tekent), guards uit `PDATA2`, begin/eind/flow-eind uit `NType`, fork/join,
   object, partitie (`bevat`), notitie + notitielijn; action-soort op `data.soort`.
   Getest op UC.NPA.REG.0010 (22 knopen, 17 stromen, 2 aanroepen, 2 pins).
   **Nog open**: activity-parameters (4 overgeslagen), action-soort zichtbaar maken,
   boundary in activity, EA-auto-routing (rechte lijnen).
9. ~~**Use case-lezer**~~ ✅ 08-10 (`qeaNaarUsecase.js`, *Bestand → Importeer Sparx EA* in de
   Use case-activiteit): use case, actor, kader, notitie, **collaboratie** (gestippelde ellips)
   + `realiseert`, klassen van elders als `klasse` (alleen naam), include/extend met
   voorwaarde (`PDATA4`), associatie (ook klasse-relaties, stereotype als label),
   generalisatie, dependency (naam of «stereotype»), notitielijn. Getest op
   UC.NPA.REG.0010 (12 voorkomens, 4 use cases uit vier pakketten, 3 includes met voorwaarde).
10. **Ontbrekende profielen**: Component, Object, Deployment, InteractionOverview, Package,
    Requirements (152 diagrammen).
11. ~~**MIM-lezer**~~ ✅ 08-10 (`qeaNaarMim.js`; *Bestand → Importeer MIM (XMI/XML of Sparx EA
    .qea)…* in de MIM-activiteit, één keuze voor beide formaten): stereotypen `MIM::`/`MIG::`/kaal
    → mim12-typen, tagged values via een naamtabel naar de mim12-properties — met normalisatie
    van EA's oude MDG-namen (`Datum opname attribuutsoort`, `Toelichting relatiesoort`, dubbele
    spaties, trema) en EA's `<memo>` uit NOTES; een MIM-tag mét metaklasse-suffix wint van een
    kale naamgenoot (GEMMA's `herkomst`); Ja/Nee → boolean; de rest blijft in `data.tags`
    (GEMMA-*, domein-*, Waardenverzameling, …). Ook tags op attributen (`t_attributetag`) en
    connectoren (`t_connectortag`). Getest op vier objecttypen uit *Model Kern RSGB* (67
    attribuutsoorten); browserproef op *RSGB Model* (635 elementen, 123 objecttypen, 73
    enumeraties, 75 relatiesoorten). **Nog open**: een "Overig"-vak in de inspector voor
    `data.tags`/`data.stereotypen`; een zwaar extern MIM-model van Mark.

**M3 en metamodel**

12. ~~**`erftVan` en `abstract` op ElementType**~~ ✅ 08-10 als **`erft`/`isAbstract`**
    (namen van V3; afgestemd met M3-MOF): `types/erfenis.js` vlakt uit bij registratie,
    expandeert abstracte typen naar hun concrete afstammelingen in elk bereik, bewaart de
    hiërarchie voor de profiel-ontwerper (▷-pijl *Erft van*, vinkje *abstract*); zie
    STUDIO-05-diagramcore-plan.md §4.2b. **Marks keuze (09-10)**: {Relatie} erft van
    {Gegevenselement} (geen broer; de backend heeft die overerving diep ingebouwd), met
    bron/doel naar {Representatie} en als grens dat een bron of doel nooit zelf een relatie
    is → `isConnector` mag omslaan en een abstract knoop-type expandeert niet naar
    connectoren. ✅ 09-10 canoniek-uml op het patroon: abstracte `representatie`, entiteit en
    gegevenselement eronder, relatie onder gegevenselement (STUDIO.md §Canoniek model).
    **Nog open**: `typenaam` op relatie is geërfd maar afgeleid (terugreis: naam) — een
    `verborgen`-vlag op PropertyType of alleen-lezen tonen (M3-MOF, 09-10); meervoudige overerving, abstract elementtype in een
    model als validatiefout, en een duidelijke melding als een ouder `verbindingsregels` (volle
    vorm) gebruikt en het kind `bron`/`doel` (nu: "doel verplicht"; M3-MOF-review 08-10).

**Terugweg**

13. **Export naar EA**: XMI 2.1 met de bewaarde GUIDs, eigenaarsregel per `.qea`; de vier
    tijd-stereotypen uit de HR-modellen als label behouden.

**Bewust nog niet:** notitie-lijnen (NoteLink; puur-uml heeft geen notitie-connector),
labelposities per lijn, kleur per diagramobject (alleen `t_object.Backcolor`),
operatieparameters (`t_operationparams`), routing per diagram (eerste diagram wint,
§6.9), andere elementtypen dan klasse-achtigen (verslag telt ze; activity/use case
is stap 2), export terug naar EA (XMI 2.1 met de bewaarde GUIDs, §3).

## Bronnen

- EA 16 release notes en bestandsformaten: <https://sparxsystems.com/enterprise_architect_user_guide/16.0/getting_started/relnot_16_0.html>,
  <https://sparxsystems.com/resources/user-guides/17.0/repository/file-based-projects.pdf>
- Native PostgreSQL-verbinding en DDL-script: <https://sparxsystems.com/resources/corporate/postgresql_instructions.html>
- XMI-import (gedrag bij bestaand pakket, Strip GUIDs): <https://sparxsystems.com/enterprise_architect_user_guide/17.0/model_exchange/importxmi.html>
- XMI-export en "Enable full EA Roundtrip": <https://sparxsystems.com/enterprise_architect_user_guide/11/projects_and_teams/exporttoxmi.html>
- Automation-interface (OLE/COM): <https://sparxsystems.com/resources/user-guides/16.1/automation/enterprise-architect-object-model.pdf>
- Pro Cloud Server OSLC/REST en licenties: <https://sparxsystems.com/products/procloudserver/6.1/index.html>,
  <https://www.componentsource.com/product/sparx-procloudserver/prices>
