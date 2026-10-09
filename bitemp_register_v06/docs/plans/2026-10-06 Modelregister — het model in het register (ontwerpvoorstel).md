# Modelregister — het model bitemporeel in het register (ontwerpvoorstel)

Datum: 2026-10-06 · Status: **voorstel, ter bespreking** · Claude-sessie met Mark.
Hoort bij BACKLOG §27.2 ("Modellen bitemporeel opslaan"), plan §8.5 / fase 7
(`STUDIO-05-diagramcore-plan.md`) en het gebruikersbeheer-dogfood (§38).

Aanleiding: samenwerken aan **één** model vraagt centrale opslag. De VPS-instantie
en het gebruikersbeheer in het register bestaan; het model zelf leeft nog per
browser in localStorage (`studio05-<profiel>`, `studio-modelleren`,
`studio-kruisverbanden`). Dit stuk beantwoordt: *waar* landt het model, *hoe*
ziet het datamodel eruit, wat is er sinds het EA-metamodel aan M3 bijgekomen,
en hoe voorkomen we naamsbotsingen.

---

## 1. Waar: een eigen register-instantie, dezelfde motor

**Voorstel: geen aparte backend-codebase, wél een aparte register-instantie.**

Een register is in Omnium *motor + gegenereerde domeinen + database*. Het
modelregister is daarmee gewoon: de Go-motor, met het domein **`omnium`**
(model + projectstructuur, §2) plus het bestaande domein **`beheer`**
(gebruikers), op een **eigen database** en eigen URL — precies zoals `pf` nu
als tweede instantie draait.

Dat geeft in één keer wat Mark vraagt:

- eigen gebruikersadministratie (domein `beheer` draait er vanzelf mee);
- eigen formulieren/weergaven (domein `configuratie`), niet te verwarren met
  de formulieren op Natuurlijk Persoon of Initiatief;
- geen tabelbotsing met te modelleren domeinen, want die staan in andere
  databases;
- "vanuit daar andere registers genereren": de genereer-actie leest het
  model op een formeel tijdstip, maakt V3 en draait codegen (§5).

**Naamgeving toch beschermen.** Codegen kent nu géén schema- of tabelprefix:
`--prefix` geldt alleen voor bestandsnamen; alle tabellen staan in `public`
als `lower(typenaam)` (`naamgeving/naamgeving.go`). Een domein met `Element`,
`Diagram`, `Project` is dus wél een botsingsrisico zodra iemand model en
register in één database wil (kleine installatie, demo). Twee opties:

| Optie | Wat | Kosten |
|---|---|---|
| A. typenamen met voorvoegsel in het model (`OmnElement`, …) | niets in codegen | lelijk in de modelleer-UI en in de API-paden |
| B. codegen-vlag `--tabelprefix omn_` (tabel = prefix + lower(typenaam)) | één plek in `naamgeving.go` + `conventions.go`; handlers lezen `Tabelnaam` al uit de MetaRegistry | te controleren: plekken die tabelnamen zelf afleiden i.p.v. via de registry |

Aanbeveling: **B**, als goedkope verzekering, ook al draait het modelregister
los. (Een PostgreSQL-schema per domein via `search_path` is netter maar raakt
Bun-queries, dbsetup en migraties breder — later.)

---

## 2. Datamodel domein `omnium` (M1 + projectstructuur)

Niveaus scherp houden: de rijen in dit register zijn **M0 van het domein
`omnium`**; ze *representeren* M1-inhoud (en in stap 2 ook M2-profielen). Het
canonieke model van `omnium` zelf is de Model-kolom van het EA-diagram, vertaald
naar ENT/REL/GE — en dat model is straks zélf een project in het modelregister
(volledig dogfooding).

### 2.1 Entiteiten en relaties

| ENT | Kern-GE's (enkelvoudig, `_Data`) | Relaties |
|---|---|---|
| **Project** | naam, beschrijving | `Project_Lid` → Gebruiker (`beheer`), meervoudig, attr. rol (eigenaar/bewerker/lezer) |
| **Map** (ProjectFolder) | naam, kleur, volgorde, **soort** (`map` \| `domein`) · GE `Map_Domein` (alleen bij soort domein: prefix, versie, beschrijving — de V3Domein-velden) | `Map_Project` (1), `Map_Ouder` → Map (0..1) |
| **Diagram** | naam, diagramType (profiel-id), viewport, stijl (shapeSet, typeWeergave) | `Diagram_Map` (1) |
| **Element** | naam, profielId, elementType (id), soort (`element` \| `connector`) · GE `Element_Eigenschap` (meervoudig: sleutel, waarde, datatype) = het huidige `data{}` | `Element_Map` (1, "woont in") · `Element_Bron` / `Element_Doel` → Element (0..1, alleen connectoren) · `Element_Verwijzing` → Element (meervoudig; attr. sleutel, referenceType) · `Kruisverband` → Element (meervoudig; attr. soort — de koppelingen-matrix) |
| **Veld** (Field) | naam, fieldType · GE `Veld_Eigenschap` (meervoudig: sleutel, waarde, datatype) = Property | `Veld_Element` (1; attr. **compartmentType**, volgorde) · `Veld_Verwijzing` → Element (meervoudig; attr. sleutel, referenceType) = Reference |
| **Publicatie** (modelversie) | versielabel, hash, V3-snapshot (JSONB of IdeBestand-verwijzing), doelregister, opmerking | `Publicatie_Map` (1: project of domein-map) |

**REL `Voorkomen` (Diagram → Element, meervoudig)** — dit is de EA-klasse
*Position*, en dankzij `rel_id` zijn meerdere voorkomens van één element op één
diagram vanzelf mogelijk. Attributen: x, y, width, height, gedaante,
layoutLocked, z; voor connectoren: sourceHandle, targetHandle, knikken,
labelOffsets, verborgen, bronVoorkomen/doelVoorkomen (`connectorVoorkomens`),
ankerPositie.

Commentaar bij de keuzes van Mark:

- **Element = ENT, Connector = Element** — ja. Het register heeft overerving
  (TPT, `overerving-analyse.md` §7), maar hier volstaat `soort` + twee
  optionele relaties; een aparte subtype-tabel voegt niets toe.
- **Compartment** hoeft géén eigen object: het is `compartmentType` als
  attribuut op `Veld_Element`. Een compartiment draagt op instantieniveau
  niets (label en volgorde komen uit M2). Mocht het later wél iets krijgen
  (ingeklapt, label-override), dan als meervoudige GE onder Element — de deur
  staat open.
- **Field = ENT, Property = GE van Field** — ja, maar let op: het hub+_Data-
  patroon kent **geen GE onder GE**; Property kan dus alleen een GE zijn als
  Field een ENT is. Dat is ook inhoudelijk juist: een attribuut `bsn` heeft
  eigen identiteit en eigen historie ("wanneer kreeg het type BSN?").
- **Reference** is de property waarvan de *waarde een ander element is*
  (basistype, gegevenstype, enum, referentielijst-item — `PropertyType.
  referenceTypes`, geleverd door een ReferenceResolver). In het register is
  dat geen tekstwaarde maar een **REL** (`Veld_Verwijzing`). Daarmee wordt
  "welke attributen gebruiken gegevenstype X" een query, en kan een registratie
  die X verwijdert de verwijzingen controleren.
- **Domain ↔ Map met soort `domein`** — ja. V3 heeft `domein` als string op
  elk element; bij export wordt dat de dichtstbijzijnde voorouder-map met
  soort domein. `Map_Domein` draagt prefix/versie/kleur. Zo is het domein weer
  een eersteklas begrip zonder apart object.
- **Projectmap vs. "map in een profiel"**: in een profiel (M2) bestaat geen
  map-begrip; het enige containerconcept is een ElementType met `containerVoor`
  (package) — dat is *modelinhoud* (M1, een Element met lidmaatschaps-
  connectoren), geen projectstructuur. Twee verschillende dingen; alleen de
  projectmap komt in `omnium`.
- **Presentatie die nu modelbreed in `element.data` zit** (`knikken`,
  `labelOffsets`, `sourceHandle`/`targetHandle` op connectoren, `randVan`)
  verhuist naar `Voorkomen` — dit is het moment om die afwijking van het
  metamodel recht te trekken.
- **Workspace / TaskbarConfiguration / User**: Gebruiker bestaat (`beheer`).
  Werkruimte-stand (open tabs, mapOpen, favorieten) is geen modelinhoud en
  hoeft niet bitemporeel: localStorage, of hooguit een enkelvoudige GE
  `Gebruiker_Werkruimte` (JSON) in `beheer`.

### 2.2 Gebeurtenissen en samenwerking

- **Elke bewerking = registratie**, samengevoegd per gebruikershandeling:
  slepen → één registratie op `Voorkomen` bij loslaten; naam typen → één op
  `Element_Data` bij blur; "alle actoren naar map Actoren" → één registratie
  met 13 `Element_Map`-mutaties. Dit is de fijnmazige historie die Mark wil.
- **Undo** = `maakt_ongedaan_registratie_id` — bestaat al; eindelijk een echte
  gebruiker voor dat veld.
- **Conflicten**: optimistisch — een mutatie draagt de `versie` die de client
  zag; bij een tussenliggende versie weigeren en herladen. Live-updates (SSE)
  komen daarna.
- **Lezen** = het hele project op formeel tijdstip `t`. Twee harde
  randvoorwaarden: (1) **snapshot-consistente reads** — bevinding 002 /
  BACKLOG §32 is nu niet meer optioneel; (2) een **bulk-endpoint** "project op
  t" (één query per tabel, gefilterd op project) — per-element lezen is te
  traag bij duizenden elementen. localStorage wordt cache/offline-buffer.
- **Actor op de registratie** (open punt §38) is nodig voor "wie deed wat".

---

## 3. M2 en M3 in het register

Stap 1 (hierboven) zet M1 en de projectstructuur centraal; `Element.elementType`
blijft een string-id in het profiel. Daarna:

- **Stap 2a — profielen als document**: ENT `Profiel` (id, label, kern-JSON =
  het huidige `web/vite/profielen/<id>.json`, versielabel) en net zo `Vorm` en
  `Icoon` (zijn al data: `vormen/*.json`, `iconen/*.json`). Centraal, gedeeld,
  tijdreisbaar — kleine stap. Hooks blijven frontend-code op id (plan §8.5).
- **Stap 2b — profielen gedecomponeerd**: de Definitie-kolom van het EA-model
  (DiagramType, ElementType, FieldType, CompartmentType, PropertyType,
  ReferenceType, Verbindingsregel, TaskbarType, ActionType, LayoutStrategie)
  als eigen ENT/GE's; `Element.elementType` wordt dan een REL. Pas als de
  profiel-ontwerper (trede 2) het gat uit `PROFIELEDITOR-GAP.md` gedicht heeft,
  anders ontwerpen we twee keer.
- **MOF-toets** (2026-10-07, `MOF_VERGELIJKING.md`): Element/Veld/
  Verwijzing/Eigenschap zijn het EMOF-deel (Class-instantie, Property,
  Property→Class, Tag); `Voorkomen` is het DI-deel. Vóór stap 2b:
  `ElementType.erft`/`isAbstract` toevoegen aan het M3.
- **M3** blijft code (`diagramcore/types/schema.js`). "M3 in het register" is
  niets anders dan het canonieke model van het domein `omnium` zelf — het EA-
  diagram vertaald — en dat model staat als project in het modelregister.

---

## 4. Wat er sinds het EA-metamodel aan M3 bijkwam

Bron: `diagramcore/types/schema.js`, `diagramcore/model/schema.js`,
`profielOntwerp.js`, `profielRegistratie.jsx`, `koppelingenActivity.jsx`.

**Definitie**

- `ElementType` draagt nu zelf **PropertyTypes** (EA: alleen FieldType) en
  een reeks declaratieve kenmerken: `naamLabel`, `randAanhechting`,
  vormgrammatica (`randDikte`, `hoekRadius`, `randStijl`), `handleStijl`,
  `resizebaar`/`minBreedte`/`minHoogte`, `achtergrond`, `meerdereVoorkomens`,
  `kort`, `taakbalkGroep`, `omschrijving`, `icoon`, `standaardDichtInBoom`,
  `edgePresentatie`.
- Structuurprimitieven op ElementType: `containerVoor` (package),
  `afbakeningVoor` + `overbrugt` (BPMN pools/message flow),
  `randElement{ouderTypes, klem}` (boundary events, pins),
  `gedragsVerwijzing` (submachine/call activity), `samentrekking{gedaante,…}`
  (lollipop) en `opname{gedaante, compartiment,…}` (deel als sub-vak).
- `ConnectorEindpunt` (bron/doel: `elementTypes[]`, `kardinaliteiten[]`) —
  EA's Verbindingsregel heeft één sourceType/targetType; code heeft lijsten én
  kardinaliteiten; `verbindingsregels[]` is EA's 1..*.
- `DiagramType`: `hierarchie` (boom-connector, evt. `omgekeerd`), `shapeSets`
  (EA: ShapeSet onder ElementtypeSet; code: per DiagramType, afbeelding
  elementType → shape), `typeWeergave`, `randAanhechting`,
  `meerdereVoorkomens`, `referenceTypes`, `layouts`.
- Nieuwe klasse **LayoutStrategie** (Definitie: id/label; Implementatie: `run`).
- `CompartmentType`: `alleenWeergave`, `verbergInInspector`.
  `FieldType.viewer` incl. `sub-vak`. `PropertyType`: `key`, `datatype`,
  `opties` (keuze), `verplicht`, `placeholder`, `referenceTypes`.
- `TaskbarType.acties` als afleidingsregel (`elementTypes` | `connectorTypes`
  | `layouts`) óf lijst; `ActionType.icoon`, `shortcut`.
- **ElementtypeSet** uit EA bestaat niet in code (DiagramType heeft
  `elementTypes` direct) — schrappen of als toekomst markeren.

**Stijl / Implementatie**

- **Vorm** (`grondvorm`, `randDikte`, `vulling`, `clipPath`, `randStijl`) en
  **Icoon** (`svg`, `monochroom`) zijn *data*, geen code: in EA als data-
  subklassen onder ShapeType, niet in Implementatie.
- Implementatie-hooks op ElementType: `valideer`, `extraCompartimenten`,
  `edgeLabels`, `edgePresentatie`, `stereotype`, `ontvangtDrop`; op
  DiagramType: `migreerModel`, `hierarchieParen`, `menus`, `serialisatie`.
- **Adapter/Notatie** (profieltype-`koppeling`: importeerV3/exporteerV3/
  exportBestand/importBestand) en **Transformatie** (lezer → regelset →
  toepasser, `TRANSFORMATIES.md`) — als eigen pakket naast Implementatie.
- `ReferenceResolver` per ReferenceType in `DiagramType.referenceResolvers`.

**Model**

- `DiagramNode`: `nodeId` (voorkomen), `gedaante`, `layoutLocked`,
  `ankerPosition`; `Diagram`: `verborgenConnectoren`, `connectorVoorkomens`,
  `viewport`, `gedaanteOverrides`, stijl.
- `Element.data`: `randVan`, `knikken`, `labelOffsets`, `gedragDiagramId`.
- **Kruisverband** (Element ↔ Element, soort) — de koppelingen-matrix.
- **Project**, **ProjectFolder** (met `soort`), **Publicatie/Modelversie**.

**EA bijwerken.** Twee routes: (1) met de lijst hierboven handmatig in EA;
(2) het M3 voortaan in Omnium zelf bijhouden (puur-uml/canoniek) als bron en
de EA-tekening eenmalig via MIM-XMI-export → EA-import proberen (niet getest;
MIM-stereotypen komen mee). Gezien dogfooding: optie 2, met EA als archief.

---

## 5. Publicatie en doelregisters

- **Genereer-actie** = model lezen op formeel tijdstip `t` → V3 → codegen →
  release. Een `Publicatie`-rij legt vast *welke* modelversie (hash + V3-
  snapshot) naar *welk* doelregister ging. Tijdreizen op het model betekent
  dus ook: "genereer het register zoals het model op 1 maart was".
- Het **doelregister** krijgt in zijn `configuratie_`-domein een
  `Modelversie` (hash, publicatie-id, bron-URL van het modelregister). Dat is
  de grofmazige historie die Mark beschrijft; de fijnmazige historie blijft in
  het modelregister en is via de publicatie-id bereikbaar (cross-register
  verwijzing — de "This could be cross-model!"-notitie uit het EA-diagram).

---

## 6. Stappen

0. (klein) `--tabelprefix` in codegen — §1 optie B.
1. Domein `omnium` modelleren in Studio (canoniek-uml) = §2 → V3 → codegen →
   eigen instantie "modelregister" met `beheer` + `configuratie`.
2. Bulk-endpoints: project lezen op `t`; registratie met meerdere mutaties;
   snapshot-consistente reads (bevinding 002); actor op registratie.
3. Studio: ContentStore-laag (BACKLOG §27.2) — profiel-stores en
   modelleren-store lezen/schrijven via de API, localStorage als cache;
   migratie-import van bestaande `studio-project`-JSON.
4. Publicatie + genereer-actie; `Modelversie` in het doelregister.
5. M2: Profiel/Vorm/Icoon als JSON-ENT's (2a); decompositie (2b) later.

Open vragen voor Mark: rolmodel per project (alleen `beheer`-rollen, of
projectleden?), en of de **lees-API** van het modelregister ook de bron voor
de live-MetaRegistry van doelregisters moet worden (nu: V3 + codegen, bewust
losgekoppeld).
