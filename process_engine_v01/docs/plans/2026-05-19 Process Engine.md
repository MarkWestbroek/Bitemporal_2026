# Plan: Process Engine — UML-BPMN-DMN driehoek met Operaton sidecar

> Status: plan, nog niet geïmplementeerd. Datum: 2026-05-19. Doel: PoC.

PoC waarin **Operaton** (Camunda 7-fork, Apache 2.0) als JVM-sidecar BPMN+DMN draait, een dunne Go-gateway de brug vormt naar **één of meerdere bitemporele registers**, **CEL via external-task-pattern** in Go wordt uitgevoerd, en context-/ad-hoc taken in een **eigen lichte Go-laag** leven (geen CMMN). **Camunda Modeler wordt hergebruikt** — Operaton consumeert dezelfde standaard `.bpmn`/`.dmn` XML 1-op-1 (directe fork van Camunda 7 CE).

## Positionering t.o.v. het bitemp register

De Process Engine is **bovenop** het bitemporele register gebouwd. Harde, eenrichtingsafhankelijkheid:

```
process_engine_v01  ──consumeert──►  bitemp_register_v06 (één of meer instanties)
```

- Geen wijzigingen in `bitemp_register_v06/` nodig om de engine te laten werken; de engine spreekt het register aan via zijn publieke REST/GraphQL/schema-API en hergebruikt waar nuttig Go-pakketten zoals het V3-formaat, MetaRegistry-types en de CEL-evaluator.
- De engine is een **eigen deployable**: eigen Go-binary, eigen container, eigen Postgres-database voor Operaton-history. Het register draait als zelfstandige service ernaast.
- Productie: aparte containers, mogelijk aparte hosts. Tijdens bouw/test mag de Process Engine-DB in dezelfde Postgres-instantie als het register leven — **als aparte database** (niet hetzelfde schema).

## De driehoek (conceptueel anker)

- **UML (MetaRegistry, V3 JSON)** = canonieke data: REPs, velden, datatypes, enums, reflistitems, afgeleide velden.
- **BPMN** = control-flow: volgorde, taken, sub-processen, call-activities, events. Procesvariabelen verwijzen naar UML-types.
- **DMN** = pure beslissingen: input getypeerd tegen UML-velden; output mag **elk basistype, elk MetaRegistry-datatype, elke enum of reflistitem** zijn.
- **Context-taken** (niet CMMN) = event/data/user-getriggerde acties die _altijd_ kunnen, niet aan token-flow gebonden.

Deze driehoek is het ontwerpcontract; alle code daaronder respecteert het.

## Multi-register, multi-domein

De engine koppelt aan **één of meer registers**, op **één of meer adressen**, en kiest per register **welke domeinen** beschikbaar zijn voor BPMN/DMN. Dit is configuratie, geen code.

Configuratiebestand `process_engine_v01/config/registers.yaml`:

```yaml
registers:
  - id: hoofdregister
    base_url: http://bitemp-v06:8082
    auth:
      type: bearer
      token_env: BITEMP_HOOFD_TOKEN
    domeinen: [np_loc, configuratie, abuvwxy]
  - id: portfolio
    base_url: http://bitemp-portfolio:8082
    auth:
      type: none
    domeinen: [cg]
```

Alle adapter-aanroepen (procesvariabele-resolutie, DMN-input-binding, service-task-delegatie, schema-lookup) gaan via een `RegisterRegistry` die op basis van `register_id` + `domein` de juiste client kiest. Een procesvariabele die naar een REP verwijst, draagt altijd het tripel `(register_id, typenaam, ent_id, t?)`.

## Fases

### Fase 0 — Conceptueel ontwerp & contracten (blokkeert alles)

1. Schrijf `process_engine_v01/docs/CONTRACTEN.md` met de driehoek-uitleg en vier expliciete contracten:
   - **Procesvariabele-contract**: hoe een MetaRegistry-instantie als Operaton-procesvariabele wordt gerepresenteerd. Voorstel: lazy handle `{ "__kind": "rep_handle", "register_id": "...", "typenaam": "NatuurlijkPersoon", "ent_id": "...", "t": "..." }` + on-demand resolutie via gateway.
   - **Service-task-contract**: external-task topics → Go-workers die bestaande register-handlers aanroepen (REST/GraphQL).
   - **DMN-IO-contract**: input variabelen ↔ MetaRegistry-velden of plain literals; output ↔ elk basistype, datatype, enum of reflistitem (typed via `__type` discriminator).
   - **Script-task-contract**: CEL als enige scripttaal, uitgevoerd door Go-worker (hergebruik `cel-go` zoals bij afgeleide velden).
2. Kies één PoC-domein en concreet scenario (zie [Verificatie](#verificatie)).

### Fase 1 — Operaton sidecar bring-up *(parallel met fase 0)*

1. `process_engine_v01/docker-compose.yml`: Operaton image + eigen Postgres-database.
   - Productieprofiel: aparte Postgres-container.
   - Dev-profiel: zelfde Postgres-instantie als register, maar **eigen database** (`process_engine`).
2. Configureer Operaton REST API + Cockpit; admin-credentials via env.
3. Smoke-test: deploy hello-world `.bpmn` via REST, start instantie, complete user-task.
4. Documenteer Modeler-workflow: Camunda Modeler → export `.bpmn`/`.dmn` → upload via gateway. Bevestig roundtrip.

### Fase 2 — Go gateway *(depends Fase 1)*

1. Nieuwe Go-module `process_engine_v01/`:
   - `cmd/process-engine/main.go` — entrypoint (gateway + workers).
   - `internal/operaton/client.go` — dunne HTTP-client tegen Operaton REST.
   - `internal/gateway/router.go` — Gin-routes `/api/process/*` (deploy, start, lijst, taakacties).
   - `internal/registers/registry.go` — `RegisterRegistry` met de multi-register configuratie.
   - Auth: hergebruik Bearer-tokens richting registers; gateway-eigen auth volgt PBAC-ontwerp later.
2. Unit tests met fake Operaton (`httptest`).

### Fase 3 — Canonieke data-adapter *(depends Fase 2)*

1. `internal/adapter/variables.go`: bidirectionele mapping `MetaRegistry-instance ↔ Operaton typed JSON variable`.
   - Gebaseerd op `bitemp_register_v06/model/v3_format.go` als externe go module-import (read-only).
   - Discriminator-veld `__kind` (`rep_handle` | `rep_inline` | `scalar` | `enum_value` | `reflist_item`) + `__typenaam`.
2. `internal/adapter/resolver.go`: lazy fetch van een REP-snapshot via het schema-API van het juiste register. Cache-vrij in deze laag — caching gebeurt later in een eventuele GraphQL-laag, niet in consumers.
3. Datatype-aliassen (BSN, Datum, NLPostcode, Emailadres, etc.) round-trippen via dezelfde definitielijst als het register.

### Fase 4 — External-task workers in Go *(depends Fase 3, parallel met 5)*

1. `internal/worker/` package, gebaseerd op Operaton's external-task long-poll API.
2. Twee worker-types:
   - **Service-task worker** (`topic: register-call`): roept een register-handler aan via REST/GraphQL; topic-config bepaalt `register_id`, doel-padnaam, methode, mapping.
   - **CEL-script worker** (`topic: cel-eval`): evalueert een CEL-expressie tegen de procesvariabele-context; hergebruik bestaande CEL-evaluator uit afgeleide velden (via go module-import).
3. Workers draaien in dezelfde Go-binary als gateway (één deployable).

### Fase 5 — DMN integratie *(depends Fase 3)*

1. Endpoint `POST /api/process/dmn/:key/evaluate` in gateway: input = handle, REP-instantie of veldenmap; output = typed result.
2. Output-converter: DMN result → basistype / datatype / enum / reflistitem via lookup in MetaRegistry van het bron-register.
3. Decision-deployment via gateway met validatie: alle inputvelden bestaan in MetaRegistry; alle outputtypes resolveren naar bekende basistypen, datatypes, enums of reflistitems.

### Fase 6 — Context-/ad-hoc taken laag *(parallel met 4-5)*

Geen CMMN. Eigen lichte modellering, **in het register** (waar het thuishoort), **niet** in de engine:

1. Twee nieuwe REPs in een nieuw domein `proces_` in `bitemp_register_v06/` (codegen via V3 JSON):
   - `ContextTaakDefinitie` (entiteit): naam, trigger (`event` | `datastate` | `user`), conditie-expressie (CEL), doelhandler.
   - `ContextTaakInstantie` (entiteit): FK naar definitie, FK naar case-id (Operaton process-instance-id of standalone), status, payload, audit-trail via standaard wijziging/registratie.
2. Vier vooraf-gedefinieerde definities die de gegeven voorbeelden dekken: vraag-aan-collega, delegeer-derde-partij, vraag-review, hecht-feedback.
3. De engine biedt een **subscriber** op Operaton history-events (process started/completed) die event-getriggerde context-taken automatisch in het register aanmaakt via diens API.
4. Endpoint in de engine `POST /api/context_taak/start` als gemak-gateway; achter de schermen vallend op de register-API.

> Opmerking: het toevoegen van het `proces_` domein aan het register is wel een register-wijziging, maar volgt de bestaande codegen-flow en raakt geen kern-architectuur. Dit is de enige plek waar de PoC het register raakt.

### Fase 7 — PoC-scenario & verificatie *(depends 4, 5, 6)*

Concreet end-to-end demo (zie [Verificatie](#verificatie)).

### Fase 8 — Frontend stub *(optioneel, na PoC-validatie)*

Minimale view in een nieuwe `process_engine_v01/web/` (eigen Vite-project, parallel aan register-frontend):

- Lijst gedeployde processen + DMN-tabellen.
- Start-knop met dynamisch formulier op basis van procesvariabele-schema.
- Taken-inbox (BPMN user-tasks + open context-taken samengevoegd).
- Hergebruikt schema-API van het juiste register voor dynamische rendering — geen hardcoded velden.

## Mappenstructuur

Parallel aan `bitemp_register_v06/`, op repo-root:

```
process_engine_v01/
├── go.mod                          # eigen module
├── docker-compose.yml              # Operaton + eigen PG
├── docker-compose.dev.yml          # override: deelt PG-instantie met register
├── Dockerfile
├── config/
│   └── registers.yaml              # multi-register configuratie
├── cmd/
│   └── process-engine/
│       └── main.go                 # gateway + workers in één binary
├── internal/
│   ├── operaton/                   # REST-client + types
│   ├── gateway/                    # Gin-routes
│   ├── registers/                  # RegisterRegistry, multi-register/-domein
│   ├── adapter/                    # variables.go, resolver.go
│   ├── worker/                     # service-task + cel-script workers
│   └── dmn/                        # evaluatie + output-conversie
├── deployments/
│   └── poc/                        # voorbeeld-BPMN + DMN voor PoC-scenario
├── postman/                        # end-to-end collectie
├── docs/
│   ├── CONTRACTEN.md               # de vier contracten (Fase 0)
│   ├── PROCES_ENGINE.md            # gebruikershandleiding
│   ├── MULTI_REGISTER.md           # configuratiehandleiding
│   ├── MODELER_TEMPLATES.md        # ideeën-document (Fase 8+)
│   └── plans/
│       └── 2026-05-19 Process Engine.md   # dit document
└── web/                            # optioneel, Fase 8
```

## Hergebruik vanuit `bitemp_register_v06/`

Via Go module replace of als externe import:

- `model/v3_format.go` — V3 JSON-types (read-only gebruik).
- `model/datatype_aliases.go` — BSN, Datum, NLPostcode, Emailadres, etc.
- CEL-evaluator (afgeleide velden) — exact dezelfde semantiek voor script-tasks en afgeleide velden.

Geen code in het register hoeft te wijzigen, behoudens het toevoegen van het `proces_` domein in Fase 6.

## Verificatie

PoC-scenario (concreet, één keuze maken in Fase 0):

- **BPMN**: hoofdproces met
  - (a) één service-task die een bestaande register-handler aanroept,
  - (b) één sub-process,
  - (c) één call-activity naar een tweede BPMN,
  - (d) één user-task,
  - (e) één business-rule-task die naar DMN verwijst,
  - (f) één timer-boundary-event.
- **DMN**: één tabel met inputs uit een MetaRegistry-REP en outputs in **drie smaken**: een basistype (string/int), een datatype (Datum), een enum-waarde — om de output-flexibiliteit te bewijzen.
- **CEL script-task**: één scripttask die een afgeleid-veld-achtige expressie evalueert tegen de procesvariabele-context.
- **Context-taak**: tijdens een lopend proces "vraag-aan-collega" starten en afronden; verifieer dat dit los van token-flow werkt.
- **Multi-register**: voeg een tweede register toe in `registers.yaml` en bewijs dat een service-task naar dat tweede register routeert op basis van topic-config.

Validatiestappen:

1. `go build ./...` en `go test ./...` groen in `process_engine_v01/`.
2. `docker compose -f docker-compose.yml up` start Operaton + PG cleanly (productieprofiel).
3. `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` deelt PG-instantie met register, eigen database (dev-profiel).
4. Modeler-roundtrip: open PoC-`.bpmn` in Camunda Modeler, edit, redeploy via gateway, run.
5. End-to-end run van scenario via Postman-collectie; assert dat procesvariabelen typed blijven door de pipeline.
6. Manual UI-check Cockpit: history toont service-call + DMN-evaluatie + user-task completion.
7. Context-taak start/complete tijdens lopend proces zonder token-flow-impact.
8. Tweede register-doel werkt zonder code-wijziging, alleen config.

## Beslissingen & scope

- **Operaton** als runtime (niet Camunda 8: licentie/cloud-aannames; niet Flowable: geen voordeel boven Operaton voor C7-lineage).
- **Camunda Modeler** hergebruikt — geen eigen modeler.
- **Gescheiden Postgres-database** voor Operaton history; eigen container in productie, gedeelde instantie met aparte DB tijdens dev/test.
- **CEL** als enige scripttaal; uitgevoerd door Go external-task workers (geen JVM-CEL nodig).
- **External-task pattern** voor alle service-/script-tasks → blijft idiomatic Go en houdt JVM-side stateless.
- **Geen CMMN-engine**. Context-taken als eigen lichte REPs in het bitemp register, met dezelfde bitemporele audit-eigenschappen als de rest.
- **Multi-register, multi-domein** vanaf dag 1 als configuratie-aspect, niet als latere bolt-on.
- **Data bij de bron**: lazy fetch van REP-snapshots; geen caching in de engine. Caching komt later in een eventuele GraphQL-laag.
- **Valtimo niet nu** — separaat onderzoek t.z.t. (relatie met GZAC, hoofdleverancier-context); deze PoC blijft onafhankelijk.
- **Buiten scope PoC**: BPMN message-correlation across systems, geavanceerde forms-engine, autorisatie-policies (PBAC komt later), multi-tenant.

## BPMN-spec dekking PoC (optie A)

Wel: token-flow, sub-process, call-activity, user-task, service-task, business-rule-task, één timer-boundary-event.
Niet (uitgesteld): compensation, escalation, multi-instance, complex gateway, signal events.

## Vasthouden voor later

**Modeler-extensie voor MetaRegistry-aware autocompletion.** Camunda Modeler element-templates die uit V3 JSON gegenereerd worden — past bij jullie codegen-filosofie. In de PoC niet bouwen, wel als idee bewaren in `docs/MODELER_TEMPLATES.md`.

## Open punten

- Exacte versie/image van Operaton vastleggen (laatste stable release).
- Auth-strategie tussen engine en registers (Bearer voor PoC; later PBAC-aligned).
- Process-instance-correlatie met case-id in het register: voorstel `processInstanceId` is de business-key, gespiegeld als veld in `ContextTaakInstantie`.
