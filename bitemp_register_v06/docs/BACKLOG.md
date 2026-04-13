`# Backlog — Bitemporeel Register v06

> **Samengesteld**: 2026-04-07
> **Bron**: alle `.md` bestanden, Go-code TODOs, planbestanden, ontwerpgedachten en frontend-code in de v06 codebase.
> **Doel**: één overzicht van alle openstaande features, ideeën, verbeterplannen en toekomstige stappen.

---

## 1. README.md — TODO-sectie (lijnnummers 811+)

### API & Backend

```
05  Log àlle requests en responses? (hoe?)
08  Loop tijdsreizen nog eens na (KVK voorbeelden) want corrigeren is nu nog hetzelfde als wijzigen. Je hebt twee soorten tijdreizen (of 3).
10  Testdata, bootstrap
11  Autogen testdata vanuit model
```

### Afgeleide velden

```
15  *Afgeleide velden*
    - opnemen in:
      a. de wijzigings handler: de nu-staat uitrekenen m.b.v. go packages voor CEL etc.
      b. de database (liever niet)
    - opnemen in de API's of niet?
    - maken voor NP naam incl. naamgebruik
```

### Referentielijsten

```
16  Referentielijsten
    - vullen met data
    - meer lijsten
```

### React frontend (bestaande pagina's)

```
20  react - edit popups
    - corrigeren en afvoeren hebben heel weinig met elkaar te maken en staan gebroederlijk naast elkaar
      - functioneel scheiden
        - door niet te klikken maar rechts te klikken: bekijk | bewerk | voer af
        - door eerst een popup met alle data te tonen in een view-kaart
        - op die kaart:
          1 bewerk (= afvoer + nieuwe opvoer) (enkelvoudig is eigenlijk altijd dit)
          2 corrigeer (= corrigeer)
          3 voer af zonder opvolger

21  react pagina's
    - enkelvoudig meervoudig tonen (1 of *)
    - corrigeert registratie r ook een lijntje tekenen?
    - enkele view:
      - inhoudelijke info over wijzigingen
      - Klikken op gerelateerde record: record ophalen en ook tonen, inclusief kinderen en relaties
      - Dan kun je het hele model doorklikken
      - inklappen inclusief kinderen tonen (klein, maar zonder data)?

25  react pagina's uitbreiden met:
    - (latere!) ongedaangemaaktheid van regs tonen
    - dit is een soort 'blik op de toekomst'
```

### UML Model versies

```
30  UML model versies
    - ~~delta tussen een nieuwe en de huidige bepalen~~ ✅ (schemadiff + IDE Delta-knop)
    - ~~impact van de delta bepalen (breaking of niet)~~ ✅ (ernst-classificatie in schemadiff)
    - Export naar MIM linked data json iets
    - kleur uit EA importeren
```

### UML Editor (EditorV2)

```
31  UML editor
    - meerdere canvassen, per domein één (of naar keuze)
    - afhankelijkheid kunnen instellen
    - overerving zelf kunnen tekenen
    - ~~alignen~~ ✅ (context menu align-acties)
    - relatie-visualisatie:
      - ~~met velden: associatieklasse~~ ✅ (ASOC-patroon: anker + 3 edges)
        - ~~probleem: de lijnen tussen A en REL en REL en B zijn geen relaties, maar alleen maar de link~~ ✅
          - ~~ze hebben een richting: hoe visualiseren?~~ ✅ (directioneel checkbox + pijl op anker→B)
      - ~~zonder: alleen een lijn met een label "relatie"~~ ✅ (collapsed badge)
      - labels bij rollen verplaatsbaar (hoe in V3 en metareg?)
    - ~~V3 import ASOC alleen bij velden~~ ✅
    - ~~reverse ASOC behoudt directioneel~~ ✅
    - ~~default bestandsnaam opslaan = versie~~ ✅
    - ~~normaliseer alle relaties (toolbar + context menu)~~ ✅
    - ~~snap alle elementen naar grid (toolbar + context menu)~~ ✅
    - edge-eigenschappen conceptueel incorrect: A-anker en anker-B zijn geen relaties maar links
      - Toekomst: edit via relatie-node, niet via edges
    - grid-grootte instelbaar (optioneel)
```

### IDE

```
35  IDE
    - multiselect in PB
    - drag and drop GE en ENT is er al: relaties moeten getekend
      - niet altijd (reproduce)
    - drag and drop - complete (shift?): ENT + alle GE's (en RELs) mee?
    - auto-order
    - ~~dubbelklik op edge: straighten~~ ✅ (berekenKortsteHandles)
    - undo / redo doet het niet
    - edge types: ~~compositie~~✅, ~~overerving~~✅, ~~associatieklasse~~✅ (!)
    - diagram of any element rename in PB
    - domeinkleur instellen, uberhaupt properties van domein instellen mogelijk
      - welke properties allemaal?
    - layout bar verplaatsbaar
    - any bar
    - afgeleide velden CEL expressie breakout met kleurcodes en autocomplete enzo? Proberen met testwaarden
    - voorbeelden en testwaarden in REPs (t.b.v. expressies bijv. maar ook als document bij example)
    - velden (attr) ook omschrijving
      - meer dan dat: [0..*] enz
    - ~~normaliseer alle relaties~~ ✅ (gedeeld via MetamodelEditor)
    - ~~snap naar grid~~ ✅ (gedeeld via MetamodelEditor)
```

### Codegenerator

```
40  Generator
    - optie om project leeg te halen voor het genereren
      - optie database drop tables of migreer
      - oppassen met reflijst plumbing in generiek!
```

### Database migratie

```
45  Database migratie / backup naar json
    - dat dus
```

### Overige uit README

```
- Error handling and TODO validation of input data  (lijn 11)
- TODO: implement and enforce singularity/plurality constraints  (lijn 529)
- Reeds afgevoerde records kunnen niet weer afgevoerd worden (todo: goed testen)  (lijn 703)
- Een _data element op een GE (todo, punt 2 eerst)  (lijn 745 — DONE in DB)
```

---

## 2. docs/TODO.md — API Logging

```
## API logging
- [ ] Voeg file-based API logging toe voor requests en responses.
- [ ] Schrijf logs naar een configureerbaar pad via env var (bijv. `API_LOG_FILE`).
- [ ] Voeg logrotatie toe (max size / aantal backups / age).
- [ ] Log minimaal: timestamp, method, path, status, latency, request-id.
- [ ] Maak body logging configureerbaar (uit in productie, aan in debug).
- [ ] Voeg redactie toe voor gevoelige velden (bijv. tokens, bsn, auth headers).
- [ ] Documenteer alle env vars en defaults in README.
```

---

## 3. docs/IDE.md — Toekomstige fasen

### Fase 3 (Multi-diagram) — onvoltooide items

```
- Meerdere diagram-tabs naast elkaar
- Node toevoegen aan diagram ≠ element aanmaken
- Node verwijderen van diagram ≠ element verwijderen
- Diagram-scoped viewport persistentie
```

### Latere-fase items (uit ontwerpbeslissingen)

```
- Lokale persistentie eerst: Zustand persist → localStorage. Database-sync en multi-user is een latere fase.
```

---

## 4. docs/DEVLOOP.md — Geen expliciete TODO's

Documentatie is actueel. Geen openstaande items gevonden.

---

## 5. plans/2026-03-29 Forms plan 01.md — Content Editor Plan

### Toekomstige features (expliciet "buiten scope Iteratie 1-2")

```
- Inline editing in tabeloverzicht
- Bulk-operaties
- Export CSV/Excel
- Tijdreis in editor (peil-/tijdstipkiezer)
- Audit-trail weergave per record
- RBAC op veld-/formulierniveau
- Visuele drag-and-drop formulier-builder
```

---

## 6. plans/2026-03-29 Forms plan 02.md — Content Editor Plan (uitgebreid)

### Iteratie 2 — Custom Formulieren (nog niet geïmplementeerd)

```
15. Formulierdefinitie-schema — JSON-formaat dat layout en veldgroepering beschrijft
16. <CustomFormulier> — Renderer die formulierdefinitie + schema-API data combineert
17. Conditionele zichtbaarheid — Velden/secties tonen/verbergen op basis van andere veldwaarden
18. Formulierdefinities opslaan — In database of als JSON, gekoppeld aan entiteittype
```

### Toekomstige features (buiten scope Iteratie 1-2)

```
- Inline editing in tabeloverzicht
- Bulk-operaties (meerdere records tegelijk bewerken/verwijderen)
- Export naar CSV/Excel
- Formele/materiële tijdreis in de editor (peil-/tijdstipkiezer)
- Audit-trail weergave per record
- Role-based access control op veld-/formulierniveau
- Drag-and-drop formulier-builder (visueel, à la form.io)
```

---

## 7. plans/2026-03-29 referentielijsten PLAN.md

### Openstaande overwegingen

```
- Cross-model referentielijsten: nu buiten scope, maar structuur moet dit niet blokkeren.
  Referentielijsten en gegevenstypen zijn potentieel generiek over modellen heen. Toekomstige iteratie.
- Items-relatie FK constraint: referentielijst_id is altijd het ID van de gebonden instantie.
  Nu via applicatielogica afgedwongen; in toekomstige iteratie evt. DB CHECK constraint.
- Codegenerator aanpassen voor referentielijsten (buiten scope huidig plan).
```

---

## 8. plans/2026-03-31 dynamic graphql plan — Dynamische GraphQL

Volledig plan voor vervanging van de huidige gqlgen-implementatie:

```
Fase 1: Infrastructuur — dependency graphql-go/graphql, directory dynql/ met 7 bestanden
Fase 2: Output types bouwen — per MetaRegistry entry met reflectie
Fase 3: Query resolvers — full entity, lijst, registraties, formeel tijdreizen
Fase 4: Mutation resolvers — registreer mutation → hergebruik registratie-flow
Fase 5: Integratie — vervang gqlgen, verwijder graph/ (~10.300 regels)
Fase 6: Verfijning — field selection, enum types, afgeleide velden, referentielijsten

Verder overwegen:
- Typed mutations later? Generieke data:JSON mutation aanvullen met typed input-types per domein.
- Subscriptions? graphql-go/graphql ondersteunt geen subscriptions out of the box.
```

---

## 9. ontwerpgedachten/2026-04-03 domeinen — Domeinbeheer

```
Uitgangspunten:
- Een schema heeft een primair domein
- "domein" in alle top level elementen opnemen (ENT, enum, gegevenstype)
- schema_domeinen tabel in database met endpoint
- Bij opslaan schema: primair domein checken en toevoegen als het niet in de tabel staat

Editor:
- Domein als "actief domein"
- Nieuwe base types automatisch het domein geven
- GE met domein Y niet koppelbaar aan ENT uit domein X → melden, vragen om verplaatsing
- Validatie vóór publish/rebuild:
  o waarschuwing als meerdere domeinen door elkaar staan
  o waarschuwing als domein leeg is
- Rebuild alleen toestaan voor het geselecteerde domein

Visualisatie:
- Niet-actieve domein-elementen fletser
- Domein-boundary (dashed rounded-corners-rechthoek) als hulp-element
```

---

## 10. UML_EDITOR_INTEGRATIE.md — Editor toekomst

### uml-editor/README.md — Toekomstige mogelijkheden

```
- MetaRegistry-generatie: editor-output omzetten naar Go-code (MetaRegistry entries + struct definities)
- Validatie: controle op naamconventies, verplichte velden, referentiële integriteit
```

---

## 11. GRAPHQL.md — Next Steps

```
1. Implement Task Resolvers — Start with the existing Task model since you already have it
2. Implement Entity Resolvers — Use Entity A/B as templates
3. Add Filtering — Enhance queries with filter inputs
4. Add Sorting — Support ordering results
5. Batching — Use DataLoader for N+1 query prevention
6. Authorization — Add middleware for security
```

N.B. deze worden potentieel vervangen door het dynamische GraphQL plan (item 8).

---

## 12. afgeleide-velden.md — Toekomstige doorontwikkeling

```
1. Code-generatie: afgeleide velden vertalen naar berekende Go-methoden op de entiteit-struct,
   zodat de API ze automatisch meelevert bij GET-responses.

4. CEL-evaluatie in Go: implementatie van een CEL-runtime (github.com/google/cel-go)

5. Validatie: afleidingsregels valideren bij opslaan in de editor (syntax-check via CEL-compiler)
```

---

## 13. CEL-evaluatie-js.md — Frontend CEL

```
Korte termijn: Huidige subset-evaluator behouden, gericht uitbreiden.
Middellange termijn: Proof of concept met @marcbachmann/cel-js of cel-js library.
Lange termijn: Overweeg afleiding backend-first te maken.
```

---

## 14. materiele_tijd.md — Toekomstige uitbreidingen

```
- Materiële tijdreizen: queryparameter geldig_op=2023-06-15 om de toestand op een
  materieel peiltijdstip te bevragen (combinatie met formeel peiltijdstip → volledige bitemporaliteit).
- Aanvang/einde voor gegevenselementen en relaties: tabellen bestaan al (bijv. a_w_aanvang),
  maar de handler-, struct- en UI-ondersteuning is nog niet uitgewerkt.
- Materiële validatie: controle dat einde >= aanvang, en dat periodes niet overlappen
  bij een nieuw opgevoerde aanvang/einde.
```

---

## 15. RELEASE.md — Runtime fix

```
- TODO: na Bun-upgrade opnieuw valideren en callback-filter op geneste relaties herstellen.
```

---

## 16. Go code TODOs

### handlers/core_handlers.go (lijn 22)

```go
// TODO: full entity get and post to include all fields, not just ID.
```

### dbsetup/createmodeltables.go (lijn 4)

```go
/*
TODO: omschrijven naar een meer generieke aanpak,
waarbij de tabellen automatisch worden gemaakt op basis van
- de metadata in model/metamodel.go en
- de structuren in model/modellen_ge_rel.go en model/modellen_entiteiten.go
*/
```

### handlers/full_handlers.go (lijn 18)

```go
/* GENERAL TODO:
Full entity get and post to include all fields, not just ID.
This will require changes to the model structs and the handlers
to bind JSON to the full struct instead of just an ID field.
*/
```

### handlers/registration_handlers.go (lijn 284)

```go
/* ### TODO ###
ONGEDAANMAKING VAN EEN ONGEDAANMAKING
- check of de te ongedaan maken registratie zelf een ongedaanmaking is
- dat is op zich te doen, want je doet dan gewoon weer het omgekeerde van de eerste ongedaanmaking
- check of er wijzigingen zijn doorgevoerd sinds de ongedaanmaking die we nu willen ongedaan maken
*/
```

### handlers/registration_handlers.go (lijn 368)

```go
// TODO: hier komt de nieuwe aanpak van registratie, waarbij we de registratie en
// wijziging(en) in één endpoint verwerken
```

---

## 17. model/ontwerpkeuzen.md — Delta-analyse ✅ GEÏMPLEMENTEERD

**Status**: volledig geïmplementeerd in `schemadiff/` package + `cmd/schemadiff/` CLI + `--diff`/`--diff-only` in codegen + IDE integratie via `POST /admin/diff/:password`.
Zie [docs/schemadiff.md](schemadiff.md) voor volledige documentatie.

Oorspronkelijk plan:
```
Bij een upgrade van het metamodel is het waardevol om een delta te bepalen tussen de
huidige en de voorgestelde versie. Deze delta kan achterhalen of de upgrade breaking of
non-breaking is.

Dit kan later als aparte CLI tool (cmd/schemadiff/) naast cmd/codegen/, die twee
v3-JSON's vergelijkt en een migratierapport genereert. Eventueel ook DDL-migratiescripts
(ALTER TABLE ADD COLUMN ...).
```

---

## 18. docs/API-standaarden-analyse.md — Aanbevelingen

```
- gRPC/Connect als toekomstige optie: als er behoefte komt aan sterk getypeerde,
  gegenereerde clients voor de command-kant, dan is gRPC/Connect een sterkere kandidaat
  dan GraphQL-mutations
- Voeg pas in een latere fase aparte corrigeer en maakOngedaan mutations toe,
  of modelleer die eerst als varianten van registreer via registratietype.
```

---

## 19. docs/codegen_analyse_roundtrip.md — Volgende stappen

```
1. Fix alle 9 gaps in de codegen
2. Definieer V3 JSON voor RegisterDomein (4 GE's: Naam, Omschrijving, Code, Schema)
3. Genereer RegisterDomein code via codegen
4. Roundtrip-test: exporteer np-loc model → genereer → diff met hand-geschreven code
5. Itereer tot diff leeg is (of alleen verwachte volgorde-verschillen bevat)
```

---

## 20. docs/overerving-analyse.md — Volgende stappen

```
1. TypeMeta uitbreiden met SupertypeRef en IsAbstract
2. Database createtables aanpassen voor PFK-structuur
3. Generieke handler uitbreiden voor supertype-join
4. Schema-API uitbreiden met overervingsvelden
5. Editor: generalisatie-edge visueel weergeven (driehoek-pijl)
6. Frontend: geërfde velden tonen in formulieren
```

---

## 21. docs/inhoud-editor-technisch.md — Bekende aandachtspunten

```
1. CSS-bundlegrootte: Utrecht CSS + design tokens ~553 KB (49 KB gzip). Overwegen: tree-shaking.
2. API-paginering: client-side max 1000 records. Bij grote datasets: server-side paginering nodig.
3. Registratie-payload: test met werkelijke backend.
4. Toetsenbordnavigatie: verdere ARIA-attributen kunnen worden toegevoegd.
5. Responsive design: zijbalk 240px vast. Op smalle schermen: uitklapbare/hamburger variant.
6. Secondaire entiteit-ID: Optie B (toekomstig): Select Combobox / zoekinterface voor >100 opties.
7. Ongedaan maken: andere interface nodig dan per-GE acties. Wordt apart ontworpen.
```

---

## 22. docs/inhoud-editor-handleiding.md — FAQ-items

```
- Records verwijderen: In de huidige versie (Iteratie 1) nog niet beschikbaar via de editor.
- Tijdreizen: Nog niet. Gepland voor een toekomstige iteratie.
```

---

## 23. Referentielijsten.md — Openstaande items

```
- Fase B t/m H: Gepland maar status uit plan zegt ✅ Compleet (check: de Referentielijsten.md
  zelf toont nog "Gepland" maar het plan-bestand zegt ✅ Compleet → deze md is mogelijk achterhaald)
- Cross-model referentielijsten: toekomstige iteratie
- Items-relatie FK constraint: later evt. DB CHECK constraint
- Code generator aanpassen: buiten scope huidig plan
- Referentielijst-omschrijvingen updaten naar logische definities (NP, Locatie, Adres, BAGLocatie)
```

---

## 24. web/vite/src/ide/ActionDialog.jsx

```
Lijn 4: "Gebaseerd op het patroon uit EditorV2 ActionDialog, aangepast voor de IDE."
```

Geen expliciete TODOs in de IDE .jsx/.js bestanden gevonden.

---

## 25. Samenvatting per categorie

### Backend / API

| # | Item | Bron |
|---|------|------|
| B1 | API file-based logging met logrotatie | docs/TODO.md |
| B2 | Validatie van input data | README.md |
| B3 | Enforce singularity/plurality constraints | README.md |
| B4 | Afgeleide velden in wijzigingshandler (CEL evaluatie in Go) | README.md, afgeleide-velden.md |
| B5 | Afgeleide velden meegeven in API responses | afgeleide-velden.md |
| B6 | Afleidingsregels valideren bij opslaan (syntax-check) | afgeleide-velden.md |
| B7 | Materiële tijdreizen (queryparameter geldig_op) | materiele_tijd.md |
| B8 | Aanvang/einde voor GE's en relaties (handler+struct+UI) | materiele_tijd.md |
| B9 | Materiële validatie (einde >= aanvang, geen overlap) | materiele_tijd.md |
| B10 | Bun-upgrade + callback-filter op geneste relaties herstellen | RELEASE.md |
| B11 | Ongedaanmaking van een ongedaanmaking | registration_handlers.go |
| B12 | Nieuwe registratie-aanpak (één endpoint) | registration_handlers.go |
| B13 | Testdata bootstrap / autogen vanuit model | README.md |
| B14 | Tijdsreizen nalopen (KVK voorbeelden, 2-3 soorten) | README.md |
| B15 | Database migratie / backup naar JSON | README.md |
| B16 | Server-side sort/filter op lijstendpoints | Forms plan 02 |
| B17 | Zoek-endpoint referentielijsten (?q= met ILIKE) | Forms plan 02 |
| B18 | gRPC/Connect als toekomstige command-API | API-standaarden-analyse.md |
| B19 | enums hebben ook een beschrijving van de term | |

### Database / DDL

| # | Item | Bron |
|---|------|------|
| D1 | createmodeltables.go → meer generieke aanpak | dbsetup/createmodeltables.go |
| D2 | Generator: optie om project leeg te halen / drop tables / migreer | README.md |
| ~~D3~~ | ~~Delta-analyse CLI tool (cmd/schemadiff/)~~ **✅ DONE** — zie docs/schemadiff.md | model/ontwerpkeuzen.md |
| ~~D4~~ | ~~DDL-migratiescripts genereren (ALTER TABLE ADD COLUMN)~~ **✅ DONE** — schemadiff/migration.go | model/ontwerpkeuzen.md |
| D5 | Items-relatie FK constraint (DB CHECK) | Referentielijsten.md |

### GraphQL

| # | Item | Bron |
|---|------|------|
| G1 | Dynamische GraphQL-laag vanuit MetaRegistry (volledig plan) | plans/2026-03-31 dynamic graphql plan |
| G2 | Implement entity resolvers | GRAPHQL.md |
| G3 | Add filtering op queries | GRAPHQL.md |
| G4 | Add sorting op queries | GRAPHQL.md |
| G5 | DataLoader batching (N+1 preventie) | GRAPHQL.md |
| G6 | Authorization middleware | GRAPHQL.md |
| G7 | Typed mutations (per domein, naast generieke) | dynamic graphql plan |
| G8 | Subscriptions | dynamic graphql plan |

### Codegenerator

| # | Item | Bron |
|---|------|------|
| C1 | Fix alle 9 gaps in de codegen | codegen_analyse_roundtrip.md |
| C2 | V3 JSON voor RegisterDomein genereren | codegen_analyse_roundtrip.md |
| C3 | Roundtrip-test np-loc model | codegen_analyse_roundtrip.md |
| C4 | Codegenerator aanpassen voor referentielijsten | Referentielijsten.md |

### Overerving

| # | Item | Bron |
|---|------|------|
| O1 | ✅ TypeMeta uitbreiden met `IsAbstract` en `ParentTypenaam` | overerving-analyse.md |
| O2 | ✅ Database + Codegen voor PFK-structuur: codegen genereert PFK-veld + belongs-to relatie op subtypes, `entiteitRelatieFieldPK` voor has-many joins met juiste PK-kolom, `createmodeltables` met topologische sort (parent-before-child) + `ensureSubtypeFK` voor FK-constraint | overerving-analyse.md |
| O3 | ✅ Generieke handlers voor supertype-join: `addOnderliggendeRelations` laadt parent via `Relation("Parent{Type}")`, `laadHubKinderenNaQuery` recursief voor parent hub-children, `ensureParentRecordBijOpvoer` maakt transparant parent-record aan in registratie-handler (TPT) | overerving-analyse.md |
| O4 | ✅ Schema-API met overervingsvelden: `IsAbstract`, `ParentTypenaam`, `GeerfdeVelden` (recursief) in DTO + builder | overerving-analyse.md |
| O5 | ✅ Editor: generalisatie-edge (driehoek-pijl) — rendering ✅, sidebar-dropdown ✅, toolbar edge-mode ✅ | overerving-analyse.md |
| O6 | ✅ Frontend: geërfde velden in formulieren. Codegen: parent belongs-to JSON tag fix (`json:"-"` → `json:"parent_{lower},omitempty"`). RepresentatieFormulier: geërfde velden boven eigen velden, bewerkbaar, twee-wijziging patroon (parent vóór child). EntiteitFormulier: cross-GE save met parent velden (isParentVeld marker, shared PK), standaard-weergave met aparte parent sectie. | overerving-analyse.md |
| O7 | ✅ V3 JSON roundtrip: `isAbstract` + `erft` velden op V3Entiteit, export/import generalisatie-edges | — |
| O8 | ✅ Codegen: schrijft `IsAbstract` + `ParentTypenaam` naar gegenereerde MetaRegistry | — |
| O9 | ✅ Exporters: XMI (dynamisch isAbstract + UML:Generalization), Mermaid (--|>), PlantUML (<|--) | — |
| O10 | ✅ Bugfix: afgeleide velden in subklassen tonen nu correct (shallow equality fix in useOvergeerfdeVelden) | — |
| O11 | ✅ Schemadiff: `isAbstract`-wijziging (→ modificatie), `erft`-wijziging (toevoegen → modificatie, verwijderen/wijzigen → destructief), DDL-migratie voor PFK-constraints. 7 tests. | — |

### UML Editor (EditorV2)

| # | Item | Bron |
|---|------|------|
| E1 | Meerdere canvassen per domein | README.md |
| E2 | Afhankelijkheid instellen | README.md |
| E3 | Overerving zelf tekenen | README.md |
| E4 | Relatie-visualisatie: associatieklasse | README.md |
| E5 | Labels bij rollen verplaatsbaar | README.md |
| E6 | MetaRegistry-generatie vanuit editor | uml-editor/README.md |
| E7 | Validatie: naamconventies, verplichte velden, referentiële integriteit | uml-editor/README.md |
| E8 | Export naar MIM linked data JSON | README.md |
| E9 | Kleur uit EA importeren | README.md |
| E10| (ook IDE) Extra REP veld "Alias" | nieuw |
| E11| ✅ Node resize: gebruiker kan nodes groter/kleiner maken (React Flow `<NodeResizer>`) + CSS max-width verwijderd | nieuw |
| E12| ✅ ENT-node dikkere rand als standaardstijl (border-width 3px vast) | nieuw |
| E13| ✅ ENT→ENT edge trekken = nieuwe REL aanmaken (collapsed/ASOC-small, geen velden) + genormaliseerde handles | nieuw |
| E14| ✅ Alt-drag vanuit ENT source-handle naar canvas = nieuwe GE aanmaken, genormaliseerde edge (was Ctrl-drag, gewijzigd wegens conflict met multiSelectionKeyCode) | nieuw |
| E15| ✅ Edge-mode toolbar: Compositie (◆) en Generalisatie (▷) knoppen — selecteer mode, sleep edge, auto-reset | nieuw |
| E16| ✅ Edge-mode indicator: visuele banner + crosshair cursor bij actieve mode, Escape om te annuleren | nieuw |


### IDE (metamodel-ontwerp omgeving)

| # | Item | Bron |
|---|------|------|
| I1 | Multi-diagram: tabs naast elkaar | docs/IDE.md |
| I2 | Node toevoegen ≠ element aanmaken | docs/IDE.md |
| I3 | Node verwijderen ≠ element verwijderen | docs/IDE.md |
| I4 | Diagram-scoped viewport persistentie | docs/IDE.md |
| I5 | Database-sync en multi-user | docs/IDE.md |
| I6 | Drag & drop: Complete ENT + alle GE's drag & drop (shift D&D?) | README.md |
| I7 | PB: Auto-order; custom order;  | README.md |
| I8 | CEL expressie breakout met kleurcodes en autocomplete | README.md |
| I9 | Voorbeelden en testwaarden in REPs | README.md |
| I10 | Velden: kardinaliteit [0..*] enz | README.md |
| I11 | Layout bar verplaatsbaar | README.md |
| I12 | Any bar: custom bar met functies? | README.md |
| I13 | ✅ Edge types: compositie, overerving, associatieklasse — rendering ✅, toolbar edge-mode (comp+gen) ✅ | README.md |
| I14 | Document by example compartiment in klassen | readme.md |
| I15 | Testwaarden in REPs (t.b.v. expressies bijv. maar ook als document bij example) | README.md |
| I16 | IDE toolbar: knoppen voor aanmaken nieuwe REPs (ENT, GE, REL, reflijst, type, enum) | nieuw |
| I17 | IDE toolbar + rechtsklik: normaliseer en snap-to-grid knoppen toevoegen | nieuw |
| I18 | Verplaatsbare toolbars: drag naar gewenste positie, snap verticaal bij zijranden / horizontaal bij boven-/onderrand | nieuw |
| I19 | PB rechtsklik: "Nieuw element" per type (rechtsklik op ENT → nieuw GE, etc.) | nieuw |
| I20 | ✅ PB rechtsklik: "Verwijder uit model" element verwijderen inclusief alle diagrammen | nieuw |
| I21 | ✅ Domein auto-toevoegen: updateElement voegt nieuw domein automatisch toe aan domeinlijst | nieuw |
| I22 | ✅ AlignToolbar verticale layout: toolbar wisselt correct naar kolom-layout bij verticale snap | nieuw |
| I23 | ✅ Lege veldencompartimenten verbergen: ENT toont geen velden-compartiment, GE/REL tonen leeg vak i.p.v. "— geen velden —" | nieuw |
| I24 | ✅ NodeEditPanel: velden-sectie verborgen voor entiteiten (alleen afgeleide velden beschikbaar) | nieuw |


### Frontend — Content Editor (Inhoud-editor)

| # | Item | Bron |
|---|------|------|
| F1 | ✅ Iteratie 2: custom formulierdefinities in JSON — FormulierDefinitie als bitemporale entiteit (configuratie-domein) + CustomFormulierRenderer + useFormulierDefinitie hook + integratie in EntiteitFormulier | Forms plan 02, F1-Q1Q2Q3 plan |
| F2 | ✅ Conditionele zichtbaarheid — `evalueerConditie()` in CustomFormulierRenderer (==, !=, truthy, falsy) | Forms plan 02, F1-Q1Q2Q3 plan |
| F3 | Inline editing in tabeloverzicht | Forms plan 02 |
| F4 | Bulk-operaties | Forms plan 02 |
| F5 | Export CSV/Excel | Forms plan 02 |
| F6 | Tijdreis in editor (peil-/tijdstipkiezer) | Forms plan 02, handleiding |
| F7 | Audit-trail weergave per record | Forms plan 02 |
| F8 | RBAC op veld-/formulierniveau | Forms plan 02 |
| F9 | Drag-and-drop formulier-builder | Forms plan 02 |
| F10 | Records verwijderen via editor | inhoud-editor-handleiding.md |
| F11 | Ongedaan maken registraties: aparte interface | inhoud-editor-technisch.md |
| F12 | Secondaire entiteit-ID: Select Combobox voor >100 opties | inhoud-editor-technisch.md |
| F13 | Responsive design / hamburger menu | inhoud-editor-technisch.md |
| F14 | Verdere ARIA-attributen / toetsenbordnavigatie | inhoud-editor-technisch.md |
| F15 | CSS tree-shaking Utrecht components | inhoud-editor-technisch.md |
| F16 | Server-side paginering bij grote datasets | inhoud-editor-technisch.md |
| F17 | Zoek-endpoint referentielijsten (?q= met ILIKE) | inhoud-editor-technisch.md |
| F18 | Labels-configuratie voor veldnamen e.d. (InitiatiefDomein -> domein) | nieuw |
| F19 | ✅ Betekenisvolle gegevenstypen (MIM): presentatie-datatypes + weergave-hints | F1-Q1Q2Q3 plan |
| F20 | ✅ API endpoint `/api/viz/schema/datatypes` | F1-Q1Q2Q3 plan |
| F21 | ✅ SchemaFormField: widget-rendering op basis van datatype weergave-hints | F1-Q1Q2Q3 plan |
| F22 | ✅ Custom tabelweergaven (WeergaveDefinitie ENT + PublicatieTabel + TabelConfig kolom-selectie/sortering) | F1-Q1Q2Q3 Fase Q2 |
| F23 | ✅ Server-side zoek/filter endpoint: `?filter.*`, `?sort=`, `?order=`, `total_count` in response | F1-Q1Q2Q3 Fase Q2 |
| F24 | ✅ Detail-pagina template renderer (PublicatieDetail met `{{veldpad}}` inserts via CEL-paden) | F1-Q1Q2Q3 Fase Q2 |
| F31 | ✅ WeergaveDefinitie bitemporale entiteit (codegen configuratie-domein: ENT + Meta/TabelConfig/DetailTemplate GE's) | F1-Q1Q2Q3 Fase Q2 |
| F32 | ✅ useWeergaveDefinitie hook + publicatie.html apart entrypoint (HashRouter, server-side paginering) | F1-Q1Q2Q3 Fase Q2 |
| F33 | ✅ Replay file: standaard WeergaveDefinities voor NatuurlijkPersoon, Initiatief, A en Land (v0.1, hub-veldnamen, definitie_versie) | F1-Q1Q2Q3 Fase Q2 |
| F25 | ✅ FormulierDefinitie bitemporale entiteit (codegen configuratie-domein: ENT + Meta GE + Layout GE) | F1-Q1Q2Q3 Fase B |
| F26 | ✅ CustomFormulierRenderer.jsx (layout JSON → formulier met groep/rij/veld/conditioneel) | F1-Q1Q2Q3 Fase B |
| F27 | ✅ useFormulierDefinitie hook (fetch actieve FormulierDefinitie voor een doeltype) | F1-Q1Q2Q3 Fase B |
| F28 | ✅ EntiteitFormulier integratie: toggle custom/standaard weergave bij actieve FormulierDefinitie | F1-Q1Q2Q3 Fase B |
| F29 | ✅ Custom formulier: editable modus met cross-GE save (één registratie, meerdere GE-wijzigingen) | F1-Q1Q2Q3 Fase B vervolg |
| F30 | Visuele FormulierDefinitie layout-editor (drag-and-drop veldindeling) | F1-Q1Q2Q3 Fase B vervolg |
| F34 | ✅ JSON- en Markdown-widget: side-by-side editor + live preview, full-width grid spanning, `widget: "json"` en `widget: "markdown"` in layout | inhoud-editor-technisch.md |
| F35 | Geïntegreerde code-editor (één paneel, type "in" de gekleurde code). Opties: **react-simple-code-editor** (~3 KB, licht), **CodeMirror 6** (~150 KB, volledig), **Monaco** (~2 MB, overkill). Zie §12.8 in inhoud-editor-technisch.md | inhoud-editor-technisch.md |
| F36 | Code splitting per doelgroep: publicatie (mobiel/licht), inhoud-editor (desktop), IDE (zwaar/desktop). Vite multi-entry is al ingericht. | inhoud-editor-technisch.md |


### Frontend — Bestaande pagina's (Index/Tijdlijn/Registraties)

| # | Item | Bron |
|---|------|------|
| V1 | Edit popups: functioneel scheiden (bekijk/bewerk/voer af) | README.md |
| V2 | Enkelvoudig/meervoudig tonen (1 of *) | README.md |
| V3 | Corrigeert registratie: lijntje tekenen | README.md |
| V4 | Doorklikken naar gerelateerd record | README.md |
| V5 | Ongedaangemaaktheid van registraties tonen | README.md |

### Domeinen

| # | Item | Bron |
|---|------|------|
| DM1 | schema_domeinen tabel in database met endpoint | ontwerpgedachten/domeinen |
| DM2 | Domein als "actief domein" in editor | ontwerpgedachten/domeinen |
| DM3 | Validatie vóór publish: waarschuwing bij meerdere domeinen door elkaar | ontwerpgedachten/domeinen |
| DM4 | Rebuild alleen voor geselecteerd domein | ontwerpgedachten/domeinen |
| DM5 | Domein-boundary visualisatie | ontwerpgedachten/domeinen |
| DM6 | Cross-model referentielijsten | Referentielijsten.md |

### CEL / Evaluatie

| # | Item | Bron |
|---|------|------|
| CEL1 | CEL-evaluatie in Go (github.com/google/cel-go) | afgeleide-velden.md |
| CEL2 | Frontend CEL: evalueren overstap naar library | CEL-evaluatie-js.md |
| CEL3 | Afleiding backend-first overwegen (lange termijn) | CEL-evaluatie-js.md |

### Referentielijst-specifiek

| # | Item | Bron |
|---|------|------|
| R1 | Referentielijsten vullen met data | README.md |
| R2 | Meer referentielijsten toevoegen | README.md |
| R3 | Cross-model referentielijsten | Referentielijsten.md |
| R4 | Items-relatie FK constraint (DB CHECK) | Referentielijsten.md |
| R5 | Codegenerator aanpassen voor referentielijsten | Referentielijsten.md |
| R6 | Omschrijvingen updaten (NP, Locatie, Adres, BAGLocatie) | Referentielijsten.md |

---

## Visie & Plan — Increment 2

Onderstaande indeling is een voorstel voor de volgende ontwikkelfasen, gebaseerd op de afhankelijkheden en de waarde die elk blok levert.

### Increment 2A — IDE verdiepen (fundamenten)

Focus: de IDE robuust en productief maken voor dagelijks modelwerk.

| Prio | Items | Reden |
|------|-------|-------|
| 1 | **I1–I4** Multi-diagram (tabs, node ≠ element, viewport) | Ontgrendelt werken met grotere modellen |
| 2 | **I10** Kardinaliteit [0..*] op velden | Essentieel voor correcte modellering |
| 3 | ~~**O5** Generalisatie-edge in IDE~~ **✅ DONE** | Rendering + toolbar edge-mode knoppen |
| 4 | **I6** Drag & drop: ENT + alle GE's mee | Kwaliteit van leven bij herindelen |
| 5 | **I7** Auto-order | Layout-kwaliteit bij grotere diagrammen |
| 6 | **DM2–DM5** Domein als actief domein, validatie, boundary | Domeinscheiding zichtbaar en afdwingbaar |
| 7 | **E11** Node resize | Gebruiker kan nodes groter/kleiner maken |
| 8 | **E13** ENT→ENT edge = maak REL | Snelle relatie-creatie op canvas |
| 9 | ~~**E14** Alt-drag vanuit ENT → maak GE~~ **✅ DONE** | Snelle GE-creatie op canvas |
| 10 | ~~**I16–I17** IDE toolbar: create-knoppen + normaliseer/snap~~ **✅ DONE** | Volledige IDE-werkbalk |
| 11 | ~~**E15–E16** Edge-mode toolbar (comp+gen)~~ **✅ DONE** | Associatietype kiezen en tekenen |
| 11 | **I18** Verplaatsbare toolbars | Professionele IDE-layout |
| 12 | **I19** PB rechtsklik: nieuw element per type | Creëren vanuit projectbrowser |

### Increment 2B — Codegenerator betrouwbaar

Focus: van IDE-model naar werkende Go-code zonder handmatig bijwerken.

| Prio | Items | Reden |
|------|-------|-------|
| 1 | **C1** Fix alle 9 gaps in codegen | Basisbetrouwbaarheid |
| 2 | **C3** Roundtrip-test np-loc model | Bewijs dat codegen correct is |
| ~~3~~ | ~~**O1** ✅, **O7–O10** ✅, **O2–O4** ✅ Overerving in DB, handlers, schema-API~~ **✅ DONE** | Foundations voor generalisatie |
| ~~4~~ | ~~**D3–D4** Delta-analyse CLI + DDL-migratie~~ **✅ DONE** | Veilig upgraden van modellen |
| 5 | **C4** Codegen voor referentielijsten | Referentielijsten mee laten genereren |

### Increment 2C — Backend verrijking

Focus: de API sterker en completer maken.

| Prio | Items | Reden |
|------|-------|-------|
| 1 | **B7–B9** Materiële tijdreizen + validatie | Kernvaardigheid bitemporeel register |
| 2 | **B4–B6** Afgeleide velden (CEL in Go, validatie, API) | Modelgedreven berekende waarden |
| 3 | **B11–B12** Nieuwe registratie-aanpak + ongedaanmaking² | Registratie-flow compleet |
| 4 | **G1** Dynamische GraphQL-laag | Vervangt gqlgen, minder code |
| 5 | **B1** API logging met logrotatie | Operationele volwassenheid |
| 6 | **B14** Tijdsreizen nalopen (KVK voorbeelden) | Validatie van het bitemporele model |

### Increment 2D — Frontend: content editor iteratie 2

Focus: content editor (formulieren) doorontwikkelen.

| Prio | Items | Reden |
|------|-------|-------|
| 1 | **F1** Custom formulierdefinities in JSON | Flexibele formulieren |
| 2 | **F2** Conditionele zichtbaarheid | Gebruiksvriendelijkheid |
| 3 | **F6** Tijdreis in editor (peil-/tijdstipkiezer) | Kernfeature voor eindgebruikers |
| 4 | **F7** Audit-trail weergave per record | Transparantie |
| 5 | **F10–F11** Records verwijderen + ongedaan maken | Basis CRUD afronden |
| 6 | **V1–V5** Bestaande pagina's verbeteren | Views, doorklikken, corrigeren |

### Horizon (later, bewust geparkeerd)

| Items | Reden om te wachten |
|-------|---------------------|
| **I5** Multi-user / database-sync | Eerst lokaal solide maken |
| **F8** RBAC op veldniveau | Pas relevant bij multi-user |
| **F9** Drag-and-drop formulier-builder | Hoge complexiteit, lage urgentie |
| **B18** gRPC/Connect | Pas overwegen bij typed-client behoefte |
| **G7–G8** Typed mutations, subscriptions | GraphQL eerst basaal werkend |
| **CEL3** Afleiding backend-first | Eerst CEL in Go en frontend stabiel |
