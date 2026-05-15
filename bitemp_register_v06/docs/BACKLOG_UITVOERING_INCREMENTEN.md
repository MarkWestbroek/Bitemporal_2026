# Backlog — Uitvoeringsplan Increment 3

> Opgesteld: 2026-05-13. Bovenop [BACKLOG.md](BACKLOG.md). Increment 2 (zie BACKLOG §"Visie & Plan") was IDE-georiënteerd en deels uitgevoerd. **Increment 3** legt het accent op de **backend** (typering, validatie, afgeleide klassen, materialisatie, materieel tijdreizen), gevolgd door **PBAC/organisatieregister**, **referentielijst-UX**, **documentatie-by-example**, **testdata-generatie** en **widgets**. Cross-cutting lopen er twee sporen mee: **code-review** en **end-to-end-tests**.

---

## Accenten en ordening

```
A. Backend verrijking (typering → validatie → afgeleide klassen → DB-materialisatie → materieel tijdreizen)
B. PBAC / FTV + organisatieregister
C. Referentielijst-UX
D. Documentatie by example (FE + BE)
E. Testdata-generatie via UI
F. Widgets (na A, dan iteratief)
G. UI/IDE rest-werk (zie BACKLOG Increment 2A/2D/2E)
H. Cross-cutting: code-review + end-to-end-tests
```

A → B → C lopen sequentieel; D, E en F kunnen parallel zodra A.1 (typering) staat. G en H lopen continu naast alles.

---

## Accent A — Backend verrijken

### A.1 Sterkere typering — uitbreiding datatypes (B26)

> **Status**: 🟢 *meerdere iteraties geleverd* (2026-05-13/14). Geïmplementeerd in [`model/datatype_aliases_extra.go`](../model/datatype_aliases_extra.go) en [`model/gegevenstypen_datatype_registry.go`](../model/gegevenstypen_datatype_registry.go).
> Nog open: `GeoLijn`, `GeoVlak`, `Bestand`, `DatumIncompleet`, `RSIN`, `Vestigingsnummer`, `BAGLigplaatsID`, `BAGStandplaatsID`.
> Zie [docs/validatie.md — §Gegevenstypen-catalogus](validatie.md) voor de volledige status per type.

**Doel**: meer first-class datatypes met semantiek, format en (later) eigen widget. Dit is het fundament voor A.2 (validatie) én voor de widget-laag (F).

**Volledige catalogus**: zie [docs/validatie.md — §Gegevenstypen-catalogus](validatie.md) voor alle types met OAS-format, validatie-aanpak en status (✅ geïmplementeerd / 🔄 gepland / ⚠️ overgeslagen).

**Stappen**:
1. Datatype-aliassen in `datatype_aliases.go` (cross-domein); marshal/unmarshal-tests
2. Custom `Bun`-tag mapping (PG-kolomtype: TEXT met CHECK, NUMERIC voor Bedrag, GEOMETRY/JSONB voor geo)
3. Schema-API v3-runtime: `format` + `weergave`-hints uitbreiden
4. `cmd/codegen/`: detectie van nieuwe types (geen breaking change)
5. Codegen-output voor demonstratie-domein (1–2 ENT met enkele nieuwe types)

**Verifieerbaar**: unit-tests per type, OpenAPI-export controleert `format`, GraphQL-input-builder accepteert types.

### A.2 Validatieregels op alle typen (B27)

> **Status (2026-05-14)**: 🟢 *fundament + R1+R2-refactor geleverd*. Implementatie:
> - [model/regels_eval.go](../model/regels_eval.go) — **generieke** evaluator voor `V3Regel.Type` ∈ {`checksum`, `formula`, `function`}; pure-stdlib expressie-engine via `go/parser` + AST-walker (geen externe dependencies). Function-dispatch (`validatieFuncties`) met `iban_mod97` (mod-97 met letter→cijfer) en `geo_range` als escape hatches.
> - [model/validation.go](../model/validation.go) — datadriven: regex (Pattern), lengte (Min/MaxLength) en `Regels[]`. **Geen per-type hardcoding meer** — een modelleur kan in de IDE een nieuw type met regels toevoegen zonder Go-code te wijzigen. Plus `ProblemDetails` / `BuildProblemDetails` helper voor RFC 9457 + NL API Strategie response-vorm (`invalidParams[]`).
> - [model/gegevenstypen_datatype_registry.go](../model/gegevenstypen_datatype_registry.go) — canonieke, handmatig onderhouden registry van algemene cross-domein datatypes met regels (BSN met checksum-regel, IBAN met function-regel, GeoPunt met geo_range, etc.). Wordt als laatste in `init()` uitgevoerd; `registreerOfVervangDatatype` dedupliceert oudere entries uit `register_/cg_/financieel_/extra_`-bestanden zonder die te hoeven aanraken.
> - [model/validation_walker.go](../model/validation_walker.go) — reflectie-walker over Representatie-velden met `schema:"datatype:..."`-tag.
> - [model/validation_test.go](../model/validation_test.go) en [model/regels_eval_test.go](../model/regels_eval_test.go) — tabel-tests voor BSN/IBAN/Postcode/Email/Kleur/GeoPunt + de evaluator + ProblemDetails-mapping.
> - [handlers/registration_core.go](../handlers/registration_core.go) — valideert vóór insert; `strict` = HTTP 422 + rollback **met `application/problem+json`**; `lenient` = errors in response; `warnings-only` = alle violations als warning. `RegistreerError.Problem` doorgegeven naar Gin-adapter.
> - [handlers/registration_handlers.go](../handlers/registration_handlers.go) — query-parameter `?validatiestrengheid=strict|lenient|warnings-only`; bij blokkerende fouten een RFC 9457 problem-response.
>
> Zie ook: [docs/validatie.md](validatie.md) voor het volledige ontwerp.
>
> Nog open: per-veld `Validatieregels []Validatieregel` op `TypeMeta.Velden[i]`, cross-veld regels (B4 CEL-engine), reflectie-cache R3 in walker, client-side preview in editor (B6).

**Doel**: per-datatype én per-veld validatie, optioneel afgedwongen door registratie-API.

**Aanpak**:
1. **Per-datatype**: ingebouwd in datatype-registry (`Validate(value) error`). Voorbeelden: BSN 11-proef, IBAN mod-97, postcode `^[1-9][0-9]{3}\s?[A-Z]{2}$`, e-mail RFC-compliant.
2. **Per veld in MetaRegistry**: nieuw veld op `TypeMeta.Velden[i]`:
   ```go
   Validatieregels []Validatieregel // CEL-expressie + foutbericht + severity (warning/error)
   ```
   Voorbeeld: `length(value) >= 3 && length(value) <= 50` voor Voornaam.
3. **Cross-veld** (op TypeMeta-niveau): regels die meerdere velden binnen één representatie bekijken. Bijv. `aanvang <= einde`. Sluit aan bij B9.
4. **API-flag**: `POST /registratie/?validatiestrengheid=strict|lenient|warnings-only`.
   - `strict` (default): hard fail bij elke `error`
   - `warnings-only`: hard fail bij `error`, return warnings in response
   - `lenient`: alle violations als warning
5. **CEL-validatie bij opslaan in editor** (B6): same regels client-side preview.

**Verifieerbaar**: nieuwe `validation_test.go` met tabel-tests per type; integratietests die registratie-API met opzettelijke schendingen aanvallen.

### A.3 Modelvarianten verder doortesten (B28)

Systematische test-matrix:

| Materieel | Overerving | Hub+_Data | Multipliciteit | Cross-domein-REL |
|---|---|---|---|---|
| × elk × elk × elk × elk | | | | |

Concreet: **fixture-generator** die per combinatie een mini-model bouwt + een replay-file + een suite van API-calls (POST registratie, GET full, PATCH, DELETE, ongedaan maken). Doel: ontdek bugs in minder belopen takken.

### A.4 Berekende klassen — concept introduceren (B29)

**Doel**: niet alleen velden maar **complete representaties** (GE, REL of zelfs ENT) afleiden uit andere model-elementen.

**Ontwerpvragen** (op te lossen vóór implementatie):
- **Berekening**: live in FE, server-side bij read, of gematerialiseerd in DB? Per item te kiezen.
- **Schrijfbaar?** Doorgaans nee; uitzondering: "afgeleid maar overschrijfbaar" (zoals `weergavenaam` met handmatige override).
- **Cache-invalidatie**: dependency-graph van bron-velden → afgeleide records. Bij wijziging van bron-record: triggeren herberekening van afhankelijke afgeleide records.
- **API-zichtbaarheid**: read-only endpoint, met `_afgeleid: true` in response-meta.
- **GraphQL**: aparte resolver-laag die op-aanvraag berekent.
- **Visueel**: oranje randen + cursief in UML-editor (analoog aan afgeleide velden).
- **MetaRegistry-veld**: `IsBerekend bool` + `BerekeningsRegel string` op TypeMeta.

**Concrete startgevallen**:
- "Volwassen" als afgeleid GE op NatuurlijkPersoon op basis van Geboortedatum.
- "ActieveBereikbaarheid" als afgeleide REL die de bereikbaarheid met meest recente aanvang en geen einde selecteert.

**Eerst ontwerp-document `docs/berekende-klassen.md`** (analoog aan `afgeleide-velden.md`), pas daarna code.

### A.5 Afgeleide velden materialiseren in DB (B30)

**Inzicht**: opvoer/afvoer zijn al gematerialiseerd op het Hub-record; dat patroon is uit te breiden:

1. **Actuele aanvang/einde op Hub** (materiële plumbing): vandaag staan ze in `_Aanvang`/`_Einde`-versie-records. Voor querysnelheid kan de actuele waarde ook op de Hub geprojecteerd worden — analoog aan opvoer/afvoer. Trigger: na elke nieuwe registratie de Hub-rij updaten.
2. **Andere afgeleide velden**: opt-in per veld via TypeMeta (`MaterializeIn: "hub"|"data"|"none"`).
3. **Dependency-tracking**:
   - Bij CEL-evaluatie: bouw graaf van geraakte velden/records (uit CEL-AST + runtime-context).
   - Bij wijziging van bron-record: query "welke afgeleide records gebruiken dit als bron?" → herregistreer (correctie) die afgeleide records.
   - **Vraag**: is dit wenselijk? Risico op cascade-correcties die de audit-trail vervuilen.
4. **Alternatief**: lazy invalidation — markeer afgeleide records als "verouderd" en herbereken bij eerstvolgende read.

**Beslismoment**: design-review na A.4. Pas implementeren als A.4-ontwerp er staat.

### A.6 Materieel tijdreizen (B31, was B7)

Volgt na A.5 omdat materieel tijdreizen op gematerialiseerde aanvang/einde efficiënter is.

**Implementatie**:
1. Querystring `?geldig_op=YYYY-MM-DD` op alle list/full-endpoints, naast `?t=` (formeel).
2. Bun-query helper: `WHERE aanvang <= geldig_op AND (einde IS NULL OR einde > geldig_op)`.
3. GraphQL: parameter `peil_materieel: Date`.
4. Combinatie `?t=` + `?geldig_op=` levert volledige bitemporele snapshot.
5. Tests: KVK-scenario's uit B14 — uitgebreid met materiële variant.
6. Frontend: peilkiezer met **twee** datum-velden (formeel + materieel), zichtbaar in publicatie + content-editor (F6).

---

## Accent B — PBAC / FTV + organisatieregister

### B.1 Organisatieregister opzetten (AUTH3)

Eigen domein `organisatie/` met bitemporele entiteiten:
- `Organisatie` (naam, KvK?, adres-FK)
- `OrganisatieEenheid` (parent-org, rol)
- `Functie` (titel, niveau)
- `Gebruiker` (login, displayname, e-mail) — uitbreiding van GB1
- `Lidmaatschap` (REL Gebruiker × OrganisatieEenheid × Functie, met aanvang/einde)
- `Rol` (rolnaam, scope) — referentielijst of eigen ENT (GB2)

Codegen-pad. Levert bonus: meteen een realistisch test-domein voor A.3 (modelvarianten).

### B.2 PBAC ophangen aan organisatieregister (AUTH4)

`authz/`-package uitbreiden:
- PIP haalt `principal_attributes` direct uit het org-register (incl. tijdreis: "wie was bevoegd op tijdstip t").
- Policies in CEL of XACML-light JSON.
- PEP-middleware in Gin: blokkeert request, retourneert `403` met policy-id.
- PDP cache (1 minuut TTL).

### B.3 FTV-policy-editor aansluiten (AUTH1)

In de IDE een tab "Policies" — bestaande FTV-editor (extern) wordt geladen via iframe of als embedded React-component, met save naar `/admin/policies`.

### B.4 AuthZEN tokens (AUTH5)

Experimenteer-spike: aparte branch, AuthZEN PEP-client implementeren, vergelijken met directe Go-PDP qua latency en flexibiliteit.

---

## Accent C — Referentielijst-UX (R8/R9/R10)

### C.1 En-masse opvoer-variant voor ref-lijst-items (R8)

Nieuw endpoint `POST /reflijst/{id}/items/bulk` accepteert eenvoudige array `[{code, naam, omschrijving?, aanvang?, einde?}]`. Server bouwt één registratie met N wijzigingen. Vervangt de huidige replay-file-route voor de meeste gevallen.

### C.2 Ref-lijst items wijzigen (R9)

Twee paden in UI:
- **Standaard**: enkel veld bewerken → correctie of opvolger (kies in modal)
- **Specifiek**: full editor met alle velden + audit-trail

### C.3 Materiele tijd in ref-lijsten visualiseren (R10)

Op de ref-lijst-detailpagina:
- ⏳ icoon naast items met eindige aanvang/einde
- Tooltip toont begin/eind-datum
- Optioneel: tijdlijn-balkje per item

---

## Accent D — Documentatie by example (DOC1, DOC2)

### D.1 Voorbeelden als first-class element op REPs (DOC1)

- TypeMeta-veld `Voorbeelden []Voorbeeld { Naam, JSON, Toelichting }`.
- V3 JSON roundtrip.
- IDE: "Voorbeelden"-tab in DetailsPanel; voorbeeld bewerken als JSON of via formulier.
- API-docs (Swagger/ReDoc): voorbeelden in `examples`-sectie van OpenAPI 3.1.
- Detailpagina's: voorbeeld-knop opent placeholder-versie van het detail-template.

### D.2 Object-diagrammen voor data-scenario's (DOC2)

- Nieuw element-type `Scenario` in IDE (apart canvas).
- Nodes zijn **instances** (`naam:Klassenaam` lollipop-stijl), edges zijn instance-links.
- Persistentie in V3 als `V3Scenario { Naam, Instanties[], Links[] }`.
- Export naar replay-file (TD4) of direct registratie-API.

---

## Accent E — Testdata-generatie (TD1–TD4)

### E.1 UI-driven generator (TD1)

In de IDE een dialoog:
- Selecteer REPs (multi-select uit project-browser)
- Variatie-eisen: aantal, distributie (uniform/skewed), randwaarden (min/max), talenmix
- Preview (eerste 5 records)
- Publiceer als replay-file of direct als batch-registratie

Backend: `cmd/testdata-gen/` met kerngenerator + `gofakeit` + custom rules per datatype.

### E.2 MCP-koppeling voor AI (TD2)

Eigen MCP-server die de schema-API exposeert. LLM kan dan realistische voorbeelden voorstellen. **Aandachtspunten**:
- Kostenbegrenzing: hard token-cap per dag, configureerbaar
- Authenticatie: per gebruiker een API-key, niet gedeeld
- Rate-limit: max N requests per uur
- Dry-run preview verplicht voor commit

### E.3 Bootstrap-variaties bij rebuild (TD3)

`docker-compose.yml` env var `BOOTSTRAP_VARIANT=empty|minimal|demo|stress`. Bij `up` wordt de overeenkomstige replay-file ingespoeld.

### E.4 Scenario's als fixture-bron (TD4)

Object-diagram (DOC2) → JSON-fixture → replay-file → DB. Eén-klik "scenario inspoelen" in de IDE.

---

## Accent F — Widgets (na A iteratief)

Volledig uitgewerkt in [BACKLOG.md §Increment 2D.2](BACKLOG.md). Afhankelijk van A.1 (datatypes) — elke nieuwe widget heeft een datatype nodig waaraan hij vastzit. **Volgorde**: per datatype-uitbreiding direct de widget toevoegen, in plaats van big-bang.

---

## Accent G — UI/IDE rest-werk

Verwijst naar BACKLOG §Increment 2A en 2E. Hoogste prio's:
- I52 editor-v2 `removeChild` definitief oplossen (acuut)
- I1–I4 multi-diagram (blokkeert grote modellen)
- I10 kardinaliteit `[0..*]` op velden
- DM2/DM5/DM7 actief domein + boundary + verwijderen
- C8-UI notes/constraints rendering (datalaag is ✅)

Loopt continu mee, niet noodzakelijk in lockstep met A.

---

## Accent H — Cross-cutting

### H.1 Code-review-pass (drie blikken)

Drie aparte review-rondes met expliciet andere "bril":

#### H.1.a Senior Go-developer (backend)
**Scope**: `handlers/`, `dynql/`, `model/`, `dbsetup/`, `cmd/`, `routes/`, `middleware/`, `schemadiff/`, `authz/`.

**Checklist**:
- Idiomatisch Go: error-wrapping (`fmt.Errorf("%w")`), context-propagatie, defer-volgorde, geen panics in handlers
- Concurrency: race-condities, transactie-scope (Bun), `sync.Mutex` waar nodig
- Dependency-injection: testbaarheid, geen globals waar vermijdbaar
- Performance: N+1 in Bun-relations, allocaties in hot paths, regex-compilatie buiten loops
- Security: SQL-injectie (Bun raw), pad-traversal in upload, JWT-validatie volledig
- API-consistentie: HTTP-status codes, error-format (RFC 7807?), pagination-headers
- Test-coverage hotspots (`go tool cover -func` controleren <50%-functies)

**Deliverable**: `docs/code-review-go.md` met bevindingen + prioritering.

#### H.1.b Senior JS/React-developer (frontend)
**Scope**: `web/vite/src/`, `uml-editor/src/`, alle `.jsx`/`.js`.

**Checklist**:
- React: useEffect-deps, geen stale closures, key-prop correctheid, suspense-boundaries
- State-management: Zustand store-shape, `selector`-stabiliteit, persist-compatibiliteit
- Performance: `useMemo`/`useCallback` discipline, bundle-size per entrypoint, lazy-loading
- Accessibility: ARIA, focus-management, keyboard-navigatie
- TypeScript? — overwegen typings via JSDoc + `checkJs`
- Schema-gedrevenheid: nergens hardcoded veldnamen
- Error-boundaries rond riskante panelen

**Deliverable**: `docs/code-review-fe.md`.

#### H.1.c DBA-blik (database)
**Scope**: `dbsetup/`, alle `*_modellen_*.go` Bun-tags, `schemadiff/migration.go`, ddl-scripts.

**Checklist**:
- Indexen: dekken alle WHERE/JOIN-kolommen die in handlers/queries voorkomen
- FK-constraints: ON DELETE-gedrag bewust gekozen
- Partitioning-overwegingen: `wijziging` en `_data`-tabellen kunnen groot worden — overwegen partitionering op registratie-tijdstip
- Datatype-keuzes: TEXT vs VARCHAR, TIMESTAMP vs TIMESTAMPTZ (TZ overal!)
- Materiële plumbing: efficiënte query voor "actuele versie op tijdstip t"
- Migratie-strategie: zero-downtime mogelijk?
- Backup/restore-procedure beschreven

**Deliverable**: `docs/code-review-dba.md`.

### H.2 End-to-end tests (Playwright + integratie)

**Doel**: data-integriteit aanvallen. Bestaande Playwright-skelet (zie BACKLOG 0.9.6) uitbreiden naar 12+ end-to-end-scenario's:

| # | Scenario | Wat het test |
|---|---|---|
| E2E-01 | Opvoer → Lees → Wijzig → Lees | Basis happy-path, audit-trail correct |
| E2E-02 | Opvoer → Corrigeer → Tijdreis vóór correctie | Formeel tijdreizen werkt |
| E2E-03 | Opvoer → Wijzig 3× → Maak laatste 2 ongedaan | Ongedaanmaking-stack |
| E2E-04 | Opvoer met aanvang in toekomst → Materieel tijdreis | Materiële tijd (na A.6) |
| E2E-05 | Twee parallelle correcties op zelfde versie | Conflict-detectie / ETag (N15) |
| E2E-06 | Cascade-delete: ENT verwijderen die nog REL's heeft | FK-integriteit |
| E2E-07 | Registratie met bewuste datatype-violation | Validatieregels A.2 |
| E2E-08 | Bulk-import 10.000 records | Performance + transactie-scope |
| E2E-09 | Wijzigen GE met afgeleid veld → controleer cascade | A.5 dependency-tracking |
| E2E-10 | Ongedaanmaking van een ongedaanmaking (B11) | Diepere audit-edgecase |
| E2E-11 | Schema-rebuild met destructieve migratie → data-behoud check | DDL-migratie veiligheid |
| E2E-12 | PBAC: gebruiker zonder rol → 403; met rol → 200 (na B.2) | Autorisatie |

Elk scenario:
- Eigen `tests/e2e/integriteit/E2E-XX-*.spec.js`
- Zet via fixture-helper een schone DB-state op (Docker testcontainer of `_baseline/`)
- Asserties op zowel HTTP-response als DB-state direct (Bun query in helper)
- Trace-files bij failure

**Continue integratie**: GitHub Actions workflow `e2e.yml` met PG-service en Playwright-headless.

---

## Tijdlijn-suggestie (indicatief, geen estimates)

```
Iteratie I3.1: A.1 typering + A.2 validatie  + H.1.a Go-review        + E2E-01..E2E-03
Iteratie I3.2: A.3 modelvarianten testen    + H.1.c DBA-review       + E2E-06..E2E-08
Iteratie I3.3: A.4 berekende klassen ontwerp + DOC1 voorbeelden       + E2E-07
Iteratie I3.4: A.5 materialisatie + dependency-tracking                + E2E-09
Iteratie I3.5: A.6 materieel tijdreizen                                + E2E-04
Iteratie I3.6: B.1 organisatieregister + B.2 PBAC                      + E2E-12
Iteratie I3.7: C reflijst-UX + D scenarios + F widgets (iteratief)     + E2E-05, E2E-10
Iteratie I3.8: E testdata-generatie + B.3/B.4 PBAC-vervolg             + E2E-08, E2E-11
Cross-cutting: H.1.b FE-review halverwege; backlog-pass per iteratie
```

---

## Backlog-hygiëne (BH1)

**Probleem**: items zijn al gebouwd maar niet ✅-gemarkeerd.

**Aanpak**:
1. **Per increment-afsluiting** een handmatige backlog-pass: loop alle openstaande items langs, vink af met datum + bestand-link.
2. **Convention**: in code/commit-message een `BACKLOG_REF: B27` regel opnemen wanneer een item geraakt wordt.
3. **Optionele tooling**: `cmd/backlog-check/` script dat:
   - alle `BACKLOG_REF: XX` greppt uit de codebase
   - vergelijkt met openstaande items in BACKLOG.md
   - rapporteert "in code aangeraakt maar niet ✅" en "afgevinkt maar geen code-referentie"
4. **Nu (eenmalig)**: een review-sessie waarin we de backlog van boven naar beneden doorlopen en items afvinken die in recente release-notes (`RELEASE.md`) of git-log opduiken.

---

## Uitwerking van de "N"-ideeën uit de chat

Voor de volledigheid hier dezelfde N1–N15 die in de chat-respons stonden, nu met meer context, motivatie en een schets van de minimale eerste implementatie.

### N1. Snapshot/diff-viewer "view in tijd"
**Wat**: een UI die dezelfde entiteit in twee toestanden naast elkaar toont — links toestand op formeel tijdstip A, rechts op B. Veld voor veld kleurt het verschil rood/groen. Beide assen (formeel én materieel) onafhankelijk te kiezen.
**Waarom**: bitemporeel registreren wordt pas concreet als je de "voor"/"na" letterlijk kunt zien. Cruciaal voor audits, voor uitleg aan beheerders, en voor het opsporen van foutieve correcties.
**Minimale eerste versie**: nieuwe pagina `/diff/<entiteitstype>/<id>?t1=...&t2=...`, twee `<RepresentatieDetail>`-componenten naast elkaar, een derde kolom met diff-status per veld.
**Afhankelijk van**: A.6 materieel tijdreizen (voor materiële vergelijking); werkt al met formeel.

### N2. Webhooks / change-stream per registratie
**Wat**: wanneer een nieuwe registratie wordt vastgelegd, push een HTTP POST naar geconfigureerde URLs met de registratie-payload (eventueel geprojecteerd op specifieke domeinen of types).
**Waarom**: maakt integratie met externe systemen triviaal. Huidig alternatief is polling, wat traag en duur is. Combineert mooi met B20–B23 (domein-tracking in registraties is er al).
**Minimale eerste versie**: een `Webhook`-ENT in configuratie-domein (URL, secret, domein-filter, type-filter). Hook in `RegistreerCore` na succesvolle commit: in een goroutine fire-and-forget POST met HMAC-signature header. Retry met exponential backoff. Dead-letter-tabel voor permanente failures.
**Afhankelijk van**: niets blokkerend.

### N3. Saved queries / named views
**Wat**: een gebruiker bouwt een filter+sort+kolomkeuze+peiltijdstip op de publicatie- of contentpagina, geeft het een naam, en krijgt een deelbare URL. Net als "saved searches" in Jira/GitHub.
**Waarom**: gebruikers hergebruiken filters constant; herhaaldelijk samenstellen is irritant en foutgevoelig. Verschil met F22 (WeergaveDefinitie): WeergaveDef is publicatie-breed beheerd, saved query is **per gebruiker** persoonlijk.
**Minimale eerste versie**: `SavedView`-ENT (gebruiker-FK, naam, querystring). Knop "💾 Bewaar deze weergave" naast filter-balk. Sidebar met persoonlijke bewaarde weergaven.
**Afhankelijk van**: GB1 Gebruiker-ENT (anders geen scoping).

### N4. Bulk-importer met dry-run + delta-rapport
**Wat**: upload CSV/Excel/JSON → kolom-mapping naar MetaRegistry-velden → preview "deze 47 records worden opgevoerd, deze 3 zijn correcties op bestaande, deze 2 hebben validatiefouten" → confirm → commit als één registratie met N wijzigingen.
**Waarom**: bestaand replay-file-mechanisme is voor ontwikkelaars; eindgebruikers willen Excel kunnen droppen. Sluit aan bij F4 (bulk-operaties) en B24 (mass-registratie zonder per-wijziging-overhead).
**Minimale eerste versie**: nieuwe pagina `/import`, drop-zone, kolom-mapper-component, preview-tabel met gekleurde rijen (groen=nieuw, geel=correctie, rood=fout), commit-knop. Backend: `POST /import/dry-run` en `POST /import/commit`. Hergebruikt `RegistreerCore`.
**Afhankelijk van**: A.2 validatie (voor goede dry-run).

### N5. Modeldocumentatie-generator
**Wat**: één commando produceert een complete documentatieset (HTML + PDF + Markdown) van het hele model: alle entiteiten, GE's, relaties, afgeleide velden, enums, voorbeelden (DOC1), validatieregels (A.2), referentielijst-overzicht.
**Waarom**: huidige docs zijn handgeschreven en lopen achter. Modelgedreven docs lopen per definitie niet achter.
**Minimale eerste versie**: `cmd/modeldocs-gen/` dat de MetaRegistry inleest en via Go templates HTML produceert. CSS gestolen uit ReDoc. Bonus: `make docs` als one-liner.
**Afhankelijk van**: niets blokkerend (DOC1 maakt het rijker).

### N6. Validatieregels als first-class element
**Wat**: `Validatieregel`-ENT in een eigen domein, met `expressie` (CEL), `scope` (entiteit/GE/REL/veld), `severity` (warning/error), `bericht`. Wordt server-side bij `RegistreerCore` én client-side bij `SchemaFormField` afgedwongen.
**Waarom**: A.2 doet validatie deels, maar als modelelement in plaats van code wordt het beheerbaar door functioneel beheerders. Sluit ook aan op I42 ("business rule in model").
**Minimale eerste versie**: ENT toevoegen, CEL-evaluator hergebruiken (B4), in registratie-handler een loop "voor elke geraakte entiteit: pas alle scope-matchende regels toe". UI: lijstpagina + edit-formulier.
**Afhankelijk van**: A.2 (basis validatie-infrastructuur), B4 (CEL in Go).

### N7. Notificaties / abonnementen
**Wat**: een gebruiker zegt "stuur mij een notificatie als een nieuwe NatuurlijkPersoon wordt opgevoerd in domein X" of "als een specifieke entiteit wordt gewijzigd". Notificatie via e-mail of in-app.
**Waarom**: huidige inzicht is pull-based; sommige use-cases (bewaking van een specifieke instantie) vragen push.
**Minimale eerste versie**: `Abonnement`-ENT (gebruiker, predicaat als CEL, kanaal, actief). Hook in `RegistreerCore` (zelfde plek als N2): evalueer alle abonnementen tegen de wijziging, fire matching ones.
**Afhankelijk van**: GB1 Gebruiker, eventueel B4 CEL-go.

### N8. Replay-mode (audit-trail-animatie)
**Wat**: een tijdlijn-scrub-bar van de eerste registratie tot nu. Sleep en de huidige UI-toestand "speelt af" — zie hoe de data is ontstaan.
**Waarom**: krachtige uitleg-tool. Demonstreert direct de waarde van bitemporeel registreren. Bouwt op de bestaande `RegistratieReplayPage`.
**Minimale eerste versie**: extra control op replay-pagina: i.p.v. discreet "volgende registratie"-knop een continue scrub-bar; render-staat wordt periodiek opnieuw opgehaald op het gekozen tijdstip via `?t=`.
**Afhankelijk van**: niets blokkerend; profiteert van A.6 voor materiële variant.

### N9. Schema-evolutie wizard met datamigratie-suggesties
**Wat**: bij IDE-rebuild detecteert schemadiff niet alleen DDL-veranderingen (✅) maar ook kandidaat-datatransformaties: kolom-rename → `UPDATE ... SET nieuw=oud`, type-conversie met fallback, default-fill-strategie. Toont preview op steekproef van bestaande data.
**Waarom**: huidige migratie kan structuur, niet inhoud. Bij rename verlies je alle data — onnodig.
**Minimale eerste versie**: in `schemadiff/migration.go` een nieuwe categorie "data-migratie-suggestie" met heuristieken (rename op basis van naam-similarity, type-compatibility-matrix). Preview als SQL-script dat de gebruiker bewerkt.
**Afhankelijk van**: bestaande schemadiff-infra (✅).

### N10. Embedded REST/GraphQL playground per entiteit
**Wat**: op iedere ENT-detailpagina een tabblad "API" met curl-snippet, GraphQL-query, OpenAPI-link voor exact deze entiteit en deze ID. Ook met live "voer uit"-knop.
**Waarom**: zelfdocumentatie. Drempel verlagen voor ontwikkelaars die met de API willen integreren.
**Minimale eerste versie**: nieuwe component `<ApiSnippetTab entiteitId, typeMeta>` die templates rendert op basis van TypeMeta. Geen backend-werk — TypeMeta is alles wat nodig is.
**Afhankelijk van**: niets.

### N11. Read-only tijdreis-deep-link
**Wat**: URL-pattern `/r/<type>/<id>?op=<formele-tijd>&geldig=<materiele-tijd>` rendert exact de toestand van toen, zonder controls (dus echt een "screenshot"). Bookmarkable bewijs voor audits, juridische zaken, e-mail-bijlagen.
**Waarom**: combineert audit + presentatie in één URL. Iemand kan een link naar een rapport sturen die ook over een jaar nog hetzelfde toont.
**Minimale eerste versie**: aparte route `/r/...` die bestaande detail-component rendert in "frozen mode" (geen edit-knoppen, watermerk met tijdstip). Combineert met N1.
**Afhankelijk van**: A.6 voor materiële variant.

### N12. CEL-evaluatie-cache voor afgeleide velden
**Wat**: memoization van CEL-evaluaties per `(entiteitstype, veld, versie)` in een aparte tabel of materialized view. Bij read: kijk in cache; bij wijziging van bron: invalideer.
**Waarom**: CEL is flexibel maar niet gratis. Bij grote queries (lijsten) kan herhaalde evaluatie expensive zijn.
**Minimale eerste versie**: tabel `afgeleid_veld_cache (typenaam, ent_id, veldnaam, registratie_id, waarde, berekend_op)`. Cache-aside-patroon in handler. Trigger-of-event voor invalidatie. Pas optimaliseren als profiling het vraagt.
**Afhankelijk van**: B4 CEL-go, A.5 dependency-tracking.

### N13. Modelvergelijker tussen domeinen
**Wat**: visuele diff tussen twee domeinen (bijv. NP-loc-domein vs. CG-portfolio): welke entiteiten zijn vergelijkbaar, welke verschillen, kunnen ze geharmoniseerd worden tot een gedeeld supertype?
**Waarom**: ontdekt herbruikbaarheid en standaardisatie-kans. Vooral bij meerdere registers met overlap.
**Minimale eerste versie**: nieuwe IDE-tab "Domein-vergelijking", twee dropdowns, uitvoer als tabel "ENT in A — ENT in B — overeenkomst-score — actie".
**Afhankelijk van**: niets.

### N14. Homepage-feed met laatste registraties
**Wat**: simpele tegel op de homepage met de N meest recente registraties, gefilterd op domeinen waar de gebruiker rol in heeft.
**Waarom**: onboarding-feature. Laat zien dat het systeem leeft. Helpt bij dagelijks "wat is er gewijzigd?"-overzicht.
**Minimale eerste versie**: REST-call naar `/registraties?limit=20`, render als kaartjes met klik door naar detail.
**Afhankelijk van**: niets.

### N15. Conflict-detectie bij parallelle correcties
**Wat**: wanneer twee gebruikers gelijktijdig dezelfde GE-versie corrigeren detecteert het systeem het en presenteert een conflict-resolver. Mechanisme: ETag/If-Match (al ontworpen in `docs/REST_CRUD.md`).
**Waarom**: zonder dit overschrijft de tweede correctie stilletjes de eerste — inconsistent met de bitemporele filosofie waarin elk verschil een audit-spoor verdient.
**Minimale eerste versie**: implementatie van het al-ontworpen ETag-mechanisme; bij `412 Precondition Failed` toont UI een conflict-modal met "behoud mijn versie / overneem hun versie / merge handmatig".
**Afhankelijk van**: niets blokkerend; sluit aan bij I5 multi-user (geparkeerd).

---

## Open punten / vragen

1. **A.5 dependency-tracking**: wenselijk dat correcties cascade-effect hebben? Eerst experimenteren met lazy invalidation (gemarkeerd als "verouderd") in plaats van eager re-registratie?
2. **B.4 AuthZEN**: spike-only of volledige integratie? Begin met spike.
3. **N12 cache**: alleen toevoegen als profiling het vraagt — voorkom premature optimalisatie.
4. **D.2 scenario-editor**: zelfde codebase als IDE-canvas (React Flow) of apart?
5. **H.1 code-review**: doorvoeren als drie aparte iteraties of parallel? Aparte iteraties geeft focus.

---

## Verifieerbare stappen (algemeen)

- `go test ./...` en `go test ./... -coverprofile coverage.out`
- Vitest in `web/vite/` (bestaande suite, 110+ groen — uitbreiden)
- Playwright e2e (zie H.2 — uitbreiden van skelet 0.9.6)
- OpenAPI-export `go run ./cmd/openapi-export`
- Schemadiff CLI voor C/D/A.5-items
- Voor elke increment: backlog-pass (BH1)
