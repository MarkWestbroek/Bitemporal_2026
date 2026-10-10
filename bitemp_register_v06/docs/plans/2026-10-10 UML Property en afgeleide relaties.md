# UML Property en afgeleide relaties (analyse + opdracht backend)

Datum: 2026-10-10 · Branch `feat/uml-property-afgeleid` (worktree `D:\Git\Bitemporal_2026_uml`)
· Claude-sessie M3-MOF, opdracht Mark via OMNIUM-UI.

Besluiten Mark (10-10):
1. Afgeleide relaties **én** de UML-kernset voor Property/Association, in één branch, twee commits.
2. Een afgeleide relatie krijgt in het register **geen tabel en geen schrijfroutes; ze is alleen
   leesbaar**, berekend uit haar afleidingsregel. Dat deel gaat naar een **backend-chat** (§4).
3. Navigeerbaarheid **per uiteinde**, met migratie van `directioneel`.
4. Nu starten, mergen ná `fix/resize-grip` (OMNIUM-UI), want die raakt ook
   `canoniek-uml/index.js` en `basisShapes.jsx`.

## 1. UML 2.5.1 — wat Property en Association dragen

Een attribuut en een associatie-uiteinde zijn in UML hetzelfde ding: een **Property**
(§9.5). Relevant voor informatiemodellen:

| UML 2.5.1 | Waar | Notatie | Opmerking |
|---|---|---|---|
| `name` | Property | naam / rolnaam | |
| `lower`/`upper` (MultiplicityElement §7.5) | Property | `[0..*]` | onze "kardinaliteit" |
| `isOrdered` | Property | `{ordered}` | default false |
| `isUnique` | Property | `{nonunique}` als false | default **true** |
| `isDerived` | Property **én** Association | `/` voor de naam | §9.5.4, §11.5.4 |
| `isReadOnly` | Property | `{readOnly}` | |
| `isID` | Property | `{id}` | |
| `defaultValue` | Property | `= waarde` | |
| `visibility` | NamedElement | `+ - # ~` | EA-import/XMI-export lezen al `zichtbaarheid` |
| navigeerbaarheid | per uiteinde | pijl (ja), kruisje (nee), niets (niet gespecificeerd) | in UML: eigendom van het uiteinde |
| `aggregation` | per uiteinde | ◇ / ◆ | staat op het Property van het **deel**, de ruit wordt bij het **geheel** getekend |

Bewust buiten de kernset: `isStatic`, `isLeaf` (UML, weinig relevant voor informatiemodellen),
`subsettedProperty`, `redefinedProperty`, `isDerivedUnion`, `qualifier` (later). EA-extra's zonder
UML-tegenhanger: Alias, Containment, Container Type, Is Collection, Transient, Property, Is Literal.

Een **operatie** kan in UML niet afgeleid zijn (`isDerived` staat op Property, niet op Operation);
ook in SysML niet. SysML erft het wel op value properties, parts en references.

## 2. Gebouwd — commit 1: afgeleide relaties

- **M3**: `PropertyType.betekenis: "afgeleid"` (`diagramcore/types/schema.js`). Een profiel wijst
  aan welke van zijn eigenschappen "afgeleid" betekent; de motor kent de namen niet.
  `diagramcore/model/afgeleid.js` → `isAfgeleid(data, type)` (ook `data.afgeleid` en
  `FieldType.afgeleid` van OMNIUM-UI).
- **Motor**: het "/" voor een veld (`VeldRegel`), voor de naam van een kale relatie (eigen
  label-deel, niet inline bewerkbaar) en in de box-gedaante (associatieklasse).
- **Profielen** (`diagramprofielen/umlEigenschappen.js`: `AFGELEID`, `AFLEIDINGSREGEL`,
  `MIM_AFLEIDBAAR`):
  - **puur-uml**: attribuut en associatie;
  - **canoniek**: relatie met `afgeleid` + `afleidingsregel` (CEL); het bestaande
    `afgeleid` op een attribuut kreeg de betekenis;
  - **MIM**: `indicatieAfleidbaar` op attribuutsoort én (nieuw) relatiesoort;
  - **SysML**: value property, part en associatie.
- **V3 (frontend)**: `buildV3Relatie` en de importpaden schrijven/lezen `afgeleid`,
  `afleidingsregel` en `afleidingsregelTaal` (dezelfde namen als `V3Veld`).
- **EA-import**: de lezer haalt `SourceStyle`/`DestStyle` (en geordend/wijzigbaarheid) op als
  die kolommen bestaan; een associatie is afgeleid als de naam met "/" begint of een rol
  `Derived=1` heeft (`afgeleidUitConnector`). Puur-uml → `afgeleid`, MIM → `indicatieAfleidbaar`.
- **XMI-export**: `isDerived="true"` op de Association en op attributen (ook MIM).
- **MIM-XMI-import**: `isDerived` op de associatie of een uiteinde → `indicatieAfleidbaar`.

## 3. Gebouwd — commit 2: de kernset

- **M3**: `PropertyType.betekenis` kent nu ook `kardinaliteit`, `standaardwaarde`,
  `zichtbaarheid`, `geordend`, `nietUniek`, `alleenLezen` en `id`. De motor
  (`veldAanvulling` in `diagramcore/model/afgeleid.js`, `VeldRegel`) toont een veld dan als
  `+/naam : Type [0..*] = 5 {ordered, nonunique, readOnly, id}`. Zonder die betekenissen ziet
  een veld er exact uit als voorheen.
- **Motor**: marker `kruisje` (×, UML "niet navigeerbaar") aan beide uiteinden; de open pijl aan
  de bron bestond al.
- **Profielen** (`umlEigenschappen.js`: `ATTRIBUUT_KERNSET`, `uiteinde(kant)`,
  `navigeerbaar`, `navigatiePresentatie`, `uiteindeLabels`):
  - **puur-uml**: attribuut met de hele kernset; associatie, aggregatie en compositie met per
    uiteinde rolnaam, kardinaliteit, navigeerbaar (ja/nee/niet gespecificeerd), geordend,
    niet-uniek, alleen-lezen. De rolnamen die de EA-import al op `data` zette, zijn nu zichtbaar
    en bewerkbaar. Bij aggregatie/compositie gaat de ruit vóór een bron-pijl;
  - **SysML**: value property met de kernset, associatie met de uiteinden;
  - **MIM**: `kardinaliteit` en `identificerend` kregen hun betekenis (`[0..1]`, `{id}`), verder
    blijft MIM zijn eigen metamodel (`unidirectioneel` telt mee als doel navigeerbaar);
  - **canoniek**: ongewijzigd behalve afgeleid (commit 1); zijn relatie hangt aan V3
    (`directioneel`, `geordend`) — per-uiteinde-navigatie daar pas na de backend.
- **Migratie**: `directioneel: true` (en MIM `unidirectioneel`) leest als doel navigeerbaar,
  bron niet gespecificeerd; een expliciete waarde wint. Data wordt niet herschreven.
- **EA-import**: attributen `IsOrdered`, `AllowDuplicates`, `Const` (readOnly), `Default`;
  uiteinden `…Style` (Navigable, AllowDuplicates), `…IsNavigable`, `…IsOrdered`,
  `…Changeable=frozen` (`rolEigenschappen`), met de aggregatie-oriëntatie goed.
- **XMI-export**: `isOrdered`, `isUnique="false"`, `isReadOnly`, `isID`, `defaultValue` en de
  echte zichtbaarheid op attributen; dezelfde vlaggen op uiteinden; `navigableOwnedEnd` op de
  Association.

**Bekend, niet aangepast:** de XMI-export zet `aggregation` op het uiteinde van het *geheel*
(zoals EA het verwacht); UML 2.5.1 zet het op het uiteinde dat naar het *deel* wijst. Eerst met
een echte EA-import toetsen voordat we het omdraaien.

## 4. Opdracht voor de backend-chat: afgeleide relatie = geen tabel, alleen lezen

Verkend op main `b6bd2810` (bestand:regel; zie de verkenning in deze sessie).

**Huidige stand**
- `V3Veld.Afgeleid` (`model/v3_format.go:257`) doet in de backend **niets**: zo'n veld wordt een
  gewone, schrijfbare kolom (`contentField` conventions.go:197, `inputContentField` :291) en de
  exporter (`model/v3_exporter.go:156-185`) zet de vlag niet terug.
- Afgeleide velden op representatieniveau (`V3AfgeleidVeld` → `TypeMeta.AfgeleideVelden`) werken
  wél, maar de evaluator is zelfgeschreven en dubbel (`handlers/full_handlers.go:398`
  `evalueerCELConcatenatie`, `dynql/query_resolvers.go:1071`) en kan **niet naar andere entiteiten
  navigeren** — `ouder.ouder` werkt nergens. De frontend heeft een rijkere evaluator
  (`web/vite/src/shared/celEvaluator.js`).
- `V3Relatie` heeft geen `geordend` (en de frontend-export verloor hem al); neem hem mee.
- BACKLOG §9 "Afgeleide associaties / GE's / RELs" (docs/BACKLOG.md:191-197) vraagt eerst een
  ontwerpdocument (live of gematerialiseerd, cache, read-only veld vs. virtueel endpoint).

**Voorstel (minst invasief)**
1. `V3Relatie`: `Afgeleid bool`, `AfleidingsregelTaal`, `Afleidingsregel` (json `afgeleid`,
   `afleidingsregelTaal`, `afleidingsregel` — de frontend schrijft ze al), plus `Geordend`.
2. `cmd/codegen/main.go`: direct na het domeinfilter (~:138) de afgeleide relaties uit
   `ent.Relaties` halen en apart meegeven via `codegenOptions` (conventions.go:12). Dan vallen
   struct, `_Data`, Input, methoden, hub-/data-entries en de regel in
   `OnderliggendeGegevenselementen` in één keer weg → geen tabel (createModelTables), geen
   routes, geen GraphQL-type/mutatie, geen afvoer-cascade.
3. `TypeMeta.AfgeleideRelaties []AfgeleideRelatie{Rolnaam, JSONRolnaam, DoelEntiteit,
   Momentvoorkomen, AfleidingsregelTaal, Afleidingsregel}` (metaregistry_plumbing.go ~:211),
   geschreven door `writeEntiteitEntry` (gen_registry.go:252) zoals `writeAfgeleideVelden`.
   **Niet** als vlag op `OnderliggendGegevenselement`: dat vraagt filters op ~15 plekken
   (full-read joins, afvoer, normalizer, wijziging_builder, dynql input/typed mutations, filter.go).
4. Lezen: één gedeelde Go-evaluator die naar doelentiteiten springt (batch-laden, peiltijdstip),
   gebruikt door `full_handlers.go:240` én `dynql` (`verrijkEigenAfgeleideVelden` + veld in
   type_builder.go:250). Let op leesconsistentie op het formele leesmoment (BACKLOG §32).
5. Rondreis: `ExportMetaRegistryToV3`/`v3RelatieVanMeta` (v3_exporter.go:297/488) geeft
   afgeleide relaties terug als `V3Relatie{Afgeleid:true}` — anders verdwijnen ze via
   `/api/schema/model/code` en de rebuild. En meteen `V3Veld.Afgeleid` terugzetten.
6. Migraties: `schemadiff/diff.go:389` en `naamgeving.AlleDerivedTypes` (:275) slaan afgeleide
   relaties over; `validateV3Model` eist een afleidingsregel en verbiedt `Velden`.
7. Schema-API/OAS: `viz_schema_handler.go:456`, `openapi_generator.go:590` (alleen-lezen).

Tests om mee te nemen: `model/v3_exporter_test.go`, `schemadiff/diff_test.go`,
`handlers/full_handlers_test.go`, `dynql/handler_test.go`, `routes/addroutes_test.go`. Codegen
heeft geen golden files; `_baseline/model/` en `_pre_rebuild/model/` zijn rebuild-kopieën.
