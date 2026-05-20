# Chat: Process engine development analysis

- **Datum**: 2026-05-19 18:47
- **Sessie-ID**: `5022d490-be55-478b-8fc4-3081f4798ea2`
- **Berichten**: 5

---

## 🤖 Assistant

# Trade-off: bouwen op een bestaande engine vs. zelf bouwen

Voordat ik een plan maak: hier is mijn analyse. Dit is een denkstuk om op te reageren, geen voorgenomen plan.

## Het landschap (kort)

| Engine | BPMN | DMN | Case/ad-hoc | Stack | Licentie | Status |
|---|---|---|---|---|---|---|
| **Operaton** | volledig (C7-fork) | volledig (FEEL) | CMMN aanwezig (legacy) | JVM/Spring | Apache 2.0 | Actief, community-fork na Camunda 7 EOL |
| **Camunda 7 CE** | volledig | volledig | CMMN | JVM | Apache 2.0 (EOL okt 2025) | End-of-life — niet starten |
| **Camunda 8 / Zeebe** | volledig | apart (DMN-engine) | géén CMMN | JVM + gRPC | Camunda License (source-available, niet OSS) | Actief, cloud-first |
| **Flowable CE** | volledig | volledig | CMMN | JVM | Apache 2.0 | Actief |
| **Valtimo** | bovenop Camunda/Flowable | via onder | ja (case-mgmt opinionated) | JVM/Kotlin + Angular | EUPL/LGPL-achtig | Actief, NL-overheid georiënteerd |
| **jBPM / Activiti** | volledig | volledig | wisselend | JVM | Apache 2.0 | Activiti rustig, jBPM (KIE) actief |
| **Go-native** (bv. shar, temporal-bpmn-experimenten) | beperkt/onvolwassen | nee/beperkt | nee | Go | varieert | Geen serieuze kandidaat voor productie |

Belangrijke realiteit: **er is geen volwassen Go-native BPMN+DMN+CMMN-engine**. Alle serieuze opties zijn JVM. CMMN is door OMG/Camunda effectief afgeschreven; Camunda 8 ondersteunt het bewust niet meer.

## Past dit bij jullie wensen?

Je vereisten gemapt op de opties:

1. **Volledige BPMN incl. sub-process & call-activity** — Operaton/Flowable/Camunda hebben dit allemaal native. Zelfbouw = jaren werk om dezelfde dekking te krijgen (boundary events, compensation, multi-instance, escalation, message correlation, timers).
2. **Data gekoppeld aan canoniek (MetaRegistry) model** — geen enkele engine doet dit out-of-the-box. Process-variabelen zijn typisch JSON/POJO. Dit is hoe dan ook integratie-werk, ongeacht engine-keuze. Hetzelfde geldt voor 5 en 6.
3. **DMN met REPs/velden/afgeleide velden als input** — FEEL accepteert objecten/contexten; je voert gewoon je REP-snapshot in. Output mappen naar jullie types/enums/reflistitems vergt een adapterlaag — vergelijkbaar werk in elke engine.
4. **Script tasks met meerdere talen** — Operaton/Flowable ondersteunen JSR-223 (JavaScript/Groovy/Python via GraalVM/Nashorn). CEL kun je als custom script-engine inpluggen.
5. **CMMN-achtige context-/ad-hoc taken** — jouw beschrijving is # Trade-off: bouwen op een bestaande engine vs. zelf bouwen

Voordat ik een plan maak: hier is mijn analyse. Dit is een denkstuk om op te reageren, geen voorgenomen plan.

## Het landschap (kort)

| Engine | BPMN | DMN | Case/ad-hoc | Stack | Licentie | Status |
|---|---|---|---|---|---|---|
| **Operaton** | volledig (C7-fork) | volledig (FEEL) | CMMN aanwezig (legacy) | JVM/Spring | Apache 2.0 | Actief, community-fork na Camunda 7 EOL |
| **Camunda 7 CE** | volledig | volledig | CMMN | JVM | Apache 2.0 (EOL okt 2025) | End-of-life — niet starten |
| **Camunda 8 / Zeebe** | volledig | apart (DMN-engine) | géén CMMN | JVM + gRPC | Camunda License (source-available, niet OSS) | Actief, cloud-first |
| **Flowable CE** | volledig | volledig | CMMN | JVM | Apache 2.0 | Actief |
| **Valtimo** | bovenop Camunda/Flowable | via onder | ja (case-mgmt opinionated) | JVM/Kotlin + Angular | EUPL/LGPL-achtig | Actief, NL-overheid georiënteerd |
| **jBPM / Activiti** | volledig | volledig | wisselend | JVM | Apache 2.0 | Activiti rustig, jBPM (KIE) actief |
| **Go-native** (bv. shar, temporal-bpmn-experimenten) | beperkt/onvolwassen | nee/beperkt | nee | Go | varieert | Geen serieuze kandidaat voor productie |

Belangrijke realiteit: **er is geen volwassen Go-native BPMN+DMN+CMMN-engine**. Alle serieuze opties zijn JVM. CMMN is door OMG/Camunda effectief afgeschreven; Camunda 8 ondersteunt het bewust niet meer.

## Past dit bij jullie wensen?

Je vereisten gemapt op de opties:

1. **Volledige BPMN incl. sub-process & call-activity** — Operaton/Flowable/Camunda hebben dit allemaal native. Zelfbouw = jaren werk om dezelfde dekking te krijgen (boundary events, compensation, multi-instance, escalation, message correlation, timers).
2. **Data gekoppeld aan canoniek (MetaRegistry) model** — geen enkele engine doet dit out-of-the-box. Process-variabelen zijn typisch JSON/POJO. Dit is hoe dan ook integratie-werk, ongeacht engine-keuze. Hetzelfde geldt voor 5 en 6.
3. **DMN met REPs/velden/afgeleide velden als input** — FEEL accepteert objecten/contexten; je voert gewoon je REP-snapshot in. Output mappen naar jullie types/enums/reflistitems vergt een adapterlaag — vergelijkbaar werk in elke engine.
4. **Script tasks met meerdere talen** — Operaton/Flowable ondersteunen JSR-223 (JavaScript/Groovy/Python via GraalVM/Nashorn). CEL kun je als custom script-engine inpluggen.
5. **CMMN-achtige context-/ad-hoc taken** — jouw beschrijving is géén volledige CMMN. Het is: "altijd-beschikbare taken naast een lopend proces" + "event/data-driven taken". Dit is een **case-management-patroon** dat bovenop elke engine te bouwen is (Valtimo doet precies dit). Volledig CMMN-engine implementeren is niet nodig en wordt door de markt verlaten.

## Drie reële paden

### A. Operaton als embedded engine (sidecar JVM)
- **Voor**: snelste time-to-spec-compleetheid; je krijgt BPMN+DMN+CMMN gratis; Apache 2.0; mature tooling (Modeler, Cockpit, history).
- **Tegen**: JVM-sidecar in je Go/PG-stack; je bouwt zelf de canonieke-model-adapter, REST/gRPC-brug en case-management-laag voor ad-hoc taken; je erft een groot oppervlak dat je niet allemaal nodig hebt.
- **Inspanning**: laag tot middel (vooral integratie).

### B. Valtimo als platform
- **Voor**: je krijgt de case-management-laag (jouw CMMN-vervangers) er al bij; opinionated, dus minder zelf bedenken; NL-overheidsfocus past bij jullie domein.
- **Tegen**: zwaarder en opinionated frontend/backend; je verliest controle over je eigen UX en data-model; integratie met jullie MetaRegistry-gedreven frontend is fundamenteel niet de bedoeling van Valtimo.
- **Inspanning**: middel, maar je past je eigen project meer aan dan andersom.

### C. Eigen Go-engine, scope-gestuurd
- **Voor**: één taal/stack; volledige controle; eerste-klas integratie met MetaRegistry, # Trade-off: bouwen op een bestaande engine vs. zelf bouwen

Voordat ik een plan maak: hier is mijn analyse. Dit is een denkstuk om op te reageren, geen voorgenomen plan.

## Het landschap (kort)

| Engine | BPMN | DMN | Case/ad-hoc | Stack | Licentie | Status |
|---|---|---|---|---|---|---|
| **Operaton** | volledig (C7-fork) | volledig (FEEL) | CMMN aanwezig (legacy) | JVM/Spring | Apache 2.0 | Actief, community-fork na Camunda 7 EOL |
| **Camunda 7 CE** | volledig | volledig | CMMN | JVM | Apache 2.0 (EOL okt 2025) | End-of-life — niet starten |
| **Camunda 8 / Zeebe** | volledig | apart (DMN-engine) | géén CMMN | JVM + gRPC | Camunda License (source-available, niet OSS) | Actief, cloud-first |
| **Flowable CE** | volledig | volledig | CMMN | JVM | Apache 2.0 | Actief |
| **Valtimo** | bovenop Camunda/Flowable | via onder | ja (case-mgmt opinionated) | JVM/Kotlin + Angular | EUPL/LGPL-achtig | Actief, NL-overheid georiënteerd |
| **jBPM / Activiti** | volledig | volledig | wisselend | JVM | Apache 2.0 | Activiti rustig, jBPM (KIE) actief |
| **Go-native** (bv. shar, temporal-bpmn-experimenten) | beperkt/onvolwassen | nee/beperkt | nee | Go | varieert | Geen serieuze kandidaat voor productie |

Belangrijke realiteit: **er is geen volwassen Go-native BPMN+DMN+CMMN-engine**. Alle serieuze opties zijn JVM. CMMN is door OMG/Camunda effectief afgeschreven; Camunda 8 ondersteunt het bewust niet meer.

## Past dit bij jullie wensen?

Je vereisten gemapt op de opties:

1. **Volledige BPMN incl. sub-process & call-activity** — Operaton/Flowable/Camunda hebben dit allemaal native. Zelfbouw = jaren werk om dezelfde dekking te krijgen (boundary events, compensation, multi-instance, escalation, message correlation, timers).
2. **Data gekoppeld aan canoniek (MetaRegistry) model** — geen enkele engine doet dit out-of-the-box. Process-variabelen zijn typisch JSON/POJO. Dit is hoe dan ook integratie-werk, ongeacht engine-keuze. Hetzelfde geldt voor 5 en 6.
3. **DMN met REPs/velden/afgeleide velden als input** — FEEL accepteert objecten/contexten; je voert gewoon je REP-snapshot in. Output mappen naar jullie types/enums/reflistitems vergt een adapterlaag — vergelijkbaar werk in elke engine.
4. **Script tasks met meerdere talen** — Operaton/Flowable ondersteunen JSR-223 (JavaScript/Groovy/Python via GraalVM/Nashorn). CEL kun je als custom script-engine inpluggen.
5. **CMMN-achtige context-/ad-hoc taken** — jouw beschrijving is géén volledige CMMN. Het is: "altijd-beschikbare taken naast een lopend proces" + "event/data-driven taken". Dit is een **case-management-patroon** dat bovenop elke engine te bouwen is (Valtimo doet precies dit). Volledig CMMN-engine implementeren is niet nodig en wordt door de markt verlaten.

## Drie reële paden

### A. Operaton als embedded engine (sidecar JVM)
- **Voor**: snelste time-to-spec-compleetheid; je krijgt BPMN+DMN+CMMN gratis; Apache 2.0; mature tooling (Modeler, Cockpit, history).
- **Tegen**: JVM-sidecar in je Go/PG-stack; je bouwt zelf de canonieke-model-adapter, REST/gRPC-brug en case-management-laag voor ad-hoc taken; je erft een groot oppervlak dat je niet allemaal nodig hebt.
- **Inspanning**: laag tot middel (vooral integratie).

### B. Valtimo als platform
- **Voor**: je krijgt de case-management-laag (jouw CMMN-vervangers) er al bij; opinionated, dus minder zelf bedenken; NL-overheidsfocus past bij jullie domein.
- **Tegen**: zwaarder en opinionated frontend/backend; je verliest controle over je eigen UX en data-model; integratie met jullie MetaRegistry-gedreven frontend is fundamenteel niet de bedoeling van Valtimo.
- **Inspanning**: middel, maar je past je eigen project meer aan dan andersom.

### C. Eigen Go-engine, scope-gestuurd
- **Voor**: één taal/stack; volledige controle; eerste-klas integratie met MetaRegistry, V3 JSON, CEL, afgeleide velden, schema-API; geen JVM-dependency; perfect bij jullie "alles dynamisch uit metaregistry"-filosofie.
- **Tegen**: BPMN-spec is groot en vol valkuilen (token-flow, compensation, event-subprocess, message correlation, timers met tijdreizen!); DMN met FEEL is een aparte stevige interpreter; je hertekent jaren werk.
- **Inspanning**: hoog tot zeer hoog voor spec-volledigheid.

## Mijn aanbeveling

**Hybride: A + selectieve eigenbouw.** Concreet:

1. **Operaton als runtime** voor BPMN- en DMN-uitvoering, als sidecar achter een dunne Go-gateway. Je hergebruikt jaren werk aan spec-correctheid en tooling (Modeler, Cockpit).
2. **Adapterlaag in Go** die process-variabelen ↔ canonieke MetaRegistry-objecten vertaalt, en service-tasks routeert naar jullie bestaande handlers/GraphQL/REST. Hier maak je de "data # Trade-off: bouwen op een bestaande engine vs. zelf bouwen

Voordat ik een plan maak: hier is mijn analyse. Dit is een denkstuk om op te reageren, geen voorgenomen plan.

## Het landschap (kort)

| Engine | BPMN | DMN | Case/ad-hoc | Stack | Licentie | Status |
|---|---|---|---|---|---|---|
| **Operaton** | volledig (C7-fork) | volledig (FEEL) | CMMN aanwezig (legacy) | JVM/Spring | Apache 2.0 | Actief, community-fork na Camunda 7 EOL |
| **Camunda 7 CE** | volledig | volledig | CMMN | JVM | Apache 2.0 (EOL okt 2025) | End-of-life — niet starten |
| **Camunda 8 / Zeebe** | volledig | apart (DMN-engine) | géén CMMN | JVM + gRPC | Camunda License (source-available, niet OSS) | Actief, cloud-first |
| **Flowable CE** | volledig | volledig | CMMN | JVM | Apache 2.0 | Actief |
| **Valtimo** | bovenop Camunda/Flowable | via onder | ja (case-mgmt opinionated) | JVM/Kotlin + Angular | EUPL/LGPL-achtig | Actief, NL-overheid georiënteerd |
| **jBPM / Activiti** | volledig | volledig | wisselend | JVM | Apache 2.0 | Activiti rustig, jBPM (KIE) actief |
| **Go-native** (bv. shar, temporal-bpmn-experimenten) | beperkt/onvolwassen | nee/beperkt | nee | Go | varieert | Geen serieuze kandidaat voor productie |

Belangrijke realiteit: **er is geen volwassen Go-native BPMN+DMN+CMMN-engine**. Alle serieuze opties zijn JVM. CMMN is door OMG/Camunda effectief afgeschreven; Camunda 8 ondersteunt het bewust niet meer.

## Past dit bij jullie wensen?

Je vereisten gemapt op de opties:

1. **Volledige BPMN incl. sub-process & call-activity** — Operaton/Flowable/Camunda hebben dit allemaal native. Zelfbouw = jaren werk om dezelfde dekking te krijgen (boundary events, compensation, multi-instance, escalation, message correlation, timers).
2. **Data gekoppeld aan canoniek (MetaRegistry) model** — geen enkele engine doet dit out-of-the-box. Process-variabelen zijn typisch JSON/POJO. Dit is hoe dan ook integratie-werk, ongeacht engine-keuze. Hetzelfde geldt voor 5 en 6.
3. **DMN met REPs/velden/afgeleide velden als input** — FEEL accepteert objecten/contexten; je voert gewoon je REP-snapshot in. Output mappen naar jullie types/enums/reflistitems vergt een adapterlaag — vergelijkbaar werk in elke engine.
4. **Script tasks met meerdere talen** — Operaton/Flowable ondersteunen JSR-223 (JavaScript/Groovy/Python via GraalVM/Nashorn). CEL kun je als custom script-engine inpluggen.
5. **CMMN-achtige context-/ad-hoc taken** — jouw beschrijving is géén volledige CMMN. Het is: "altijd-beschikbare taken naast een lopend proces" + "event/data-driven taken". Dit is een **case-management-patroon** dat bovenop elke engine te bouwen is (Valtimo doet precies dit). Volledig CMMN-engine implementeren is niet nodig en wordt door de markt verlaten.

## Drie reële paden

### A. Operaton als embedded engine (sidecar JVM)
- **Voor**: snelste time-to-spec-compleetheid; je krijgt BPMN+DMN+CMMN gratis; Apache 2.0; mature tooling (Modeler, Cockpit, history).
- **Tegen**: JVM-sidecar in je Go/PG-stack; je bouwt zelf de canonieke-model-adapter, REST/gRPC-brug en case-management-laag voor ad-hoc taken; je erft een groot oppervlak dat je niet allemaal nodig hebt.
- **Inspanning**: laag tot middel (vooral integratie).

### B. Valtimo als platform
- **Voor**: je krijgt de case-management-laag (jouw CMMN-vervangers) er al bij; opinionated, dus minder zelf bedenken; NL-overheidsfocus past bij jullie domein.
- **Tegen**: zwaarder en opinionated frontend/backend; je verliest controle over je eigen UX en data-model; integratie met jullie MetaRegistry-gedreven frontend is fundamenteel niet de bedoeling van Valtimo.
- **Inspanning**: middel, maar je past je eigen project meer aan dan andersom.

### C. Eigen Go-engine, scope-gestuurd
- **Voor**: één taal/stack; volledige controle; eerste-klas integratie met MetaRegistry, V3 JSON, CEL, afgeleide velden, schema-API; geen JVM-dependency; perfect bij jullie "alles dynamisch uit metaregistry"-filosofie.
- **Tegen**: BPMN-spec is groot en vol valkuilen (token-flow, compensation, event-subprocess, message correlation, timers met tijdreizen!); DMN met FEEL is een aparte stevige interpreter; je hertekent jaren werk.
- **Inspanning**: hoog tot zeer hoog voor spec-volledigheid.

## Mijn aanbeveling

**Hybride: A + selectieve eigenbouw.** Concreet:

1. **Operaton als runtime** voor BPMN- en DMN-uitvoering, als sidecar achter een dunne Go-gateway. Je hergebruikt jaren werk aan spec-correctheid en tooling (Modeler, Cockpit).
2. **Adapterlaag in Go** die process-variabelen ↔ canonieke MetaRegistry-objecten vertaalt, en service-tasks routeert naar jullie bestaande handlers/GraphQL/REST. Hier maak je de "data spreekt jullie taal"-belofte waar.
3. **CEL als script-engine in Operaton** via JSR-223 custom binding — zo zijn afgeleide-veld-expressies, formulier-expressies en script-tasks één taal.
4. **Eigen lichtgewicht case/ad-hoc laag in Go** naast de engine, niet CMMN-conform maar geïnspireerd op jullie 4 voorbeelden (vraag-aan-collega, derde-partij-taak, review, feedback-aanhechting). Modelleer als event-getriggerde "taakdefinities" die altijd op een case-instantie kunnen worden aangezet, gestuurd door dezelfde MetaRegistry. Dit is fundamenteel simpeler dan CMMN en past bij jouw waarneming dat ze "het procesaxioma niet gehoorzamen".
5. **DMN-output mapping** naar enums/reflistitems via een typed result-converter in dezelfde adapterlaag.

**Hoofdtrade-off**: je accepteert een JVM-sidecar (operationele complexiteit, geheugen, een tweede deploybaar artefact, een tweede DB-schema voor history) in ruil voor dat je géén BPMN-token-engine + FEEL-interpreter hoeft te schrijven. Dat is m.i. de juiste ruil — het procesengine-gedeelte is geen onderscheidende waarde voor jullie product; de **canonieke-model-integratie wel**, en die bouw je hoe dan ook.

**Niet doen**: volledige CMMN # Trade-off: bouwen op een bestaande engine vs. zelf bouwen

Voordat ik een plan maak: hier is mijn analyse. Dit is een denkstuk om op te reageren, geen voorgenomen plan.

## Het landschap (kort)

| Engine | BPMN | DMN | Case/ad-hoc | Stack | Licentie | Status |
|---|---|---|---|---|---|---|
| **Operaton** | volledig (C7-fork) | volledig (FEEL) | CMMN aanwezig (legacy) | JVM/Spring | Apache 2.0 | Actief, community-fork na Camunda 7 EOL |
| **Camunda 7 CE** | volledig | volledig | CMMN | JVM | Apache 2.0 (EOL okt 2025) | End-of-life — niet starten |
| **Camunda 8 / Zeebe** | volledig | apart (DMN-engine) | géén CMMN | JVM + gRPC | Camunda License (source-available, niet OSS) | Actief, cloud-first |
| **Flowable CE** | volledig | volledig | CMMN | JVM | Apache 2.0 | Actief |
| **Valtimo** | bovenop Camunda/Flowable | via onder | ja (case-mgmt opinionated) | JVM/Kotlin + Angular | EUPL/LGPL-achtig | Actief, NL-overheid georiënteerd |
| **jBPM / Activiti** | volledig | volledig | wisselend | JVM | Apache 2.0 | Activiti rustig, jBPM (KIE) actief |
| **Go-native** (bv. shar, temporal-bpmn-experimenten) | beperkt/onvolwassen | nee/beperkt | nee | Go | varieert | Geen serieuze kandidaat voor productie |

Belangrijke realiteit: **er is geen volwassen Go-native BPMN+DMN+CMMN-engine**. Alle serieuze opties zijn JVM. CMMN is door OMG/Camunda effectief afgeschreven; Camunda 8 ondersteunt het bewust niet meer.

## Past dit bij jullie wensen?

Je vereisten gemapt op de opties:

1. **Volledige BPMN incl. sub-process & call-activity** — Operaton/Flowable/Camunda hebben dit allemaal native. Zelfbouw = jaren werk om dezelfde dekking te krijgen (boundary events, compensation, multi-instance, escalation, message correlation, timers).
2. **Data gekoppeld aan canoniek (MetaRegistry) model** — geen enkele engine doet dit out-of-the-box. Process-variabelen zijn typisch JSON/POJO. Dit is hoe dan ook integratie-werk, ongeacht engine-keuze. Hetzelfde geldt voor 5 en 6.
3. **DMN met REPs/velden/afgeleide velden als input** — FEEL accepteert objecten/contexten; je voert gewoon je REP-snapshot in. Output mappen naar jullie types/enums/reflistitems vergt een adapterlaag — vergelijkbaar werk in elke engine.
4. **Script tasks met meerdere talen** — Operaton/Flowable ondersteunen JSR-223 (JavaScript/Groovy/Python via GraalVM/Nashorn). CEL kun je als custom script-engine inpluggen.
5. **CMMN-achtige context-/ad-hoc taken** — jouw beschrijving is géén volledige CMMN. Het is: "altijd-beschikbare taken naast een lopend proces" + "event/data-driven taken". Dit is een **case-management-patroon** dat bovenop elke engine te bouwen is (Valtimo doet precies dit). Volledig CMMN-engine implementeren is niet nodig en wordt door de markt verlaten.

## Drie reële paden

### A. Operaton als embedded engine (sidecar JVM)
- **Voor**: snelste time-to-spec-compleetheid; je krijgt BPMN+DMN+CMMN gratis; Apache 2.0; mature tooling (Modeler, Cockpit, history).
- **Tegen**: JVM-sidecar in je Go/PG-stack; je bouwt zelf de canonieke-model-adapter, REST/gRPC-brug en case-management-laag voor ad-hoc taken; je erft een groot oppervlak dat je niet allemaal nodig hebt.
- **Inspanning**: laag tot middel (vooral integratie).

### B. Valtimo als platform
- **Voor**: je krijgt de case-management-laag (jouw CMMN-vervangers) er al bij; opinionated, dus minder zelf bedenken; NL-overheidsfocus past bij jullie domein.
- **Tegen**: zwaarder en opinionated frontend/backend; je verliest controle over je eigen UX en data-model; integratie met jullie MetaRegistry-gedreven frontend is fundamenteel niet de bedoeling van Valtimo.
- **Inspanning**: middel, maar je past je eigen project meer aan dan andersom.

### C. Eigen Go-engine, scope-gestuurd
- **Voor**: één taal/stack; volledige controle; eerste-klas integratie met MetaRegistry, V3 JSON, CEL, afgeleide velden, schema-API; geen JVM-dependency; perfect bij jullie "alles dynamisch uit metaregistry"-filosofie.
- **Tegen**: BPMN-spec is groot en vol valkuilen (token-flow, compensation, event-subprocess, message correlation, timers met tijdreizen!); DMN met FEEL is een aparte stevige interpreter; je hertekent jaren werk.
- **Inspanning**: hoog tot zeer hoog voor spec-volledigheid.

## Mijn aanbeveling

**Hybride: A + selectieve eigenbouw.** Concreet:

1. **Operaton als runtime** voor BPMN- en DMN-uitvoering, als sidecar achter een dunne Go-gateway. Je hergebruikt jaren werk aan spec-correctheid en tooling (Modeler, Cockpit).
2. **Adapterlaag in Go** die process-variabelen ↔ canonieke MetaRegistry-objecten vertaalt, en service-tasks routeert naar jullie bestaande handlers/GraphQL/REST. Hier maak je de "data spreekt jullie taal"-belofte waar.
3. **CEL als script-engine in Operaton** via JSR-223 custom binding — zo zijn afgeleide-veld-expressies, formulier-expressies en script-tasks één taal.
4. **Eigen lichtgewicht case/ad-hoc laag in Go** naast de engine, niet CMMN-conform maar geïnspireerd op jullie 4 voorbeelden (vraag-aan-collega, derde-partij-taak, review, feedback-aanhechting). Modelleer als event-getriggerde "taakdefinities" die altijd op een case-instantie kunnen worden aangezet, gestuurd door dezelfde MetaRegistry. Dit is fundamenteel simpeler dan CMMN en past bij jouw waarneming dat ze "het procesaxioma niet gehoorzamen".
5. **DMN-output mapping** naar enums/reflistitems via een typed result-converter in dezelfde adapterlaag.

**Hoofdtrade-off**: je accepteert een JVM-sidecar (operationele complexiteit, geheugen, een tweede deploybaar artefact, een tweede DB-schema voor history) in ruil voor dat je géén BPMN-token-engine + FEEL-interpreter hoeft te schrijven. Dat is m.i. de juiste ruil — het procesengine-gedeelte is geen onderscheidende waarde voor jullie product; de **canonieke-model-integratie wel**, en die bouw je hoe dan ook.

**Niet doen**: volledige CMMN nastreven, of Camunda 8 (licentie en cloud-aannames passen niet).

## Wat ik van jou nodig heb om hieruit een plan te maken

Een paar richtinggevende keuzes:

1. **Stack-tolerantie**: is een JVM-sidecar (Operaton) acceptabel, of is "alles Go" een harde eis? Dat bepaalt A vs C.
2. **Scope eerste iteratie**: PoC met één BPMN + één DMN + één ad-hoc taak, of breder?
3. **Tooling**: willen jullie de Camunda/Operaton Modeler gebruiken voor BPMN/DMN-diagrammen, of moet dat ook in jullie eigen UML-editor-familie?
4. **Persistentie**: Operaton-history in dezelfde PostgreSQL als jullie register (apart schema), of strikt gescheiden?
5. **Valtimo serieus overwegen?** Of valt die af vanwege opinionated frontend/UX-conflict met jullie schema-gedreven frontend?

Geef antwoord op (in elk geval) 1, 2 en 5, dan schrijf ik een concreet plan met fases, bestanden en verificatiestappen.

---

## 🧑 User

1 JVM sidecare is okee.
2 okee
3 nee, de bestaande modeler is okee. Deze kan toch wel bpmn en dmn importeren en exporteren?
4 beter gescheiden
5 we werken al met de hoofd-ontwikkelaar en leverancier van valtimo, maar dan is het denk ik vaak met een GZAC schil eromheen. Ik moet dat nog beter uitzoeken. Ik wil echter graag het patroon "de UML-BPMN-DMM driehoek" helder en werkbaar maken, zonder teveel opsmuk.

---

## 🤖 Assistant

## Plan: Process Engine — UML-BPMN-DMN driehoek met Operaton sidecar

PoC waarin **Operaton** (Camunda 7-fork, Apache 2.0) als JVM-sidecar BPMN+DMN draait, een dunne Go-gateway de brug vormt naar de bestaande MetaRegistry/handlers, **CEL via external-task-pattern** in Go wordt uitgevoerd, en context-/ad-hoc taken in een **eigen lichte Go-laag** leven (geen CMMN). **Camunda Modeler wordt hergebruikt** — Operaton consumeert dezelfde standaard `.bpmn`/`.dmn` XML 1-op-1 (het is een directe fork van Camunda 7 CE).

### De driehoek (conceptueel anker)

- **UML (MetaRegistry, V3 JSON)** = canonieke data: REPs, velden, datatypes, enums, reflistitems, afgeleide velden.
- **BPMN** = control-flow; procesvariabelen verwijzen naar UML-types.
- **DMN** = pure beslissingen; input getypeerd tegen UML-velden, output tegen UML-enums/reflistitems.
- **Context-taken** (niet CMMN) = event/data/user-getriggerd, _altijd_ mogelijk, niet aan token-flow gebonden.

### Fases

0. **Conceptueel & contracten** — schrijf vier expliciete contracten (procesvariabele, service-task, DMN-IO, script-task), kies PoC-domein.
1. **Operaton sidecar bring-up** *(parallel met 0)* — `docker-compose.process.yml`, eigen PG-DB, Cockpit, smoke-test, Modeler-roundtrip bevestigen.
2. **Go gateway** *(depends 1)* — `processengine/` pakket: dunne HTTP-client + Gin-routes `/api/process/*`.
3. **Canonieke data-adapter** *(depends 2)* — bidirectionele mapping MetaRegistry-instance ↔ Operaton typed JSON variable; lazy snapshot via `(ent_id, t)`-handle om history niet te laten ontploffen.
4. **External-task workers in Go** *(depends 3)* — `topic: api-call` (delegeert naar bestaande handlers) + `topic: cel-eval` (hergebruikt bestaande CEL-evaluator van afgeleide velden).
5. **DMN integratie** *(parallel met 4)* — endpoint + output-converter naar enums/reflistitems via `EnumRegistry`.
6. **Context-/ad-hoc taken laag** *(parallel met 4-5)* — twee nieuwe REPs in nieuw `proces_` domein via codegen: `ContextTaakDefinitie`, `ContextTaakInstantie`. Vier vooraf-gedefinieerde definities (vraag-collega, delegeer-derde-partij, vraag-review, hecht-feedback). Bitemporele audit "for free".
7. **PoC-scenario end-to-end**.
8. **Frontend stub** *(optioneel, na PoC-validatie)* — schema-gedreven proces/taken-inbox in `web/vite/`.

### Relevante bestanden

- `bitemp_register_v06/docker-compose.process.yml` — nieuw.
- `bitemp_register_v06/processengine/` — nieuw pakket: `client.go`, `gateway.go`, `variables.go`, `dmn.go`, `worker/service_task.go`, `worker/cel_script.go`.
-  — registreer `/api/process/*` en `/api/context_taak/*`.
- `bitemp_register_v06/model/proces_*.go` — codegen-output (uit `proces_model.json`) voor de twee context-taak REPs.
-  — start gateway + workers in dezelfde binary.
- Hergebruik: bestaande CEL-evaluator, `handlers/`, `model/v3_format.go`, MetaRegistry.
- `bitemp_register_v06/docs/PROCESS_ENGINE.md` — nieuw, driehoek + contracten.

### Verificatie

PoC-scenario: BPMN met service-task + sub-process + call-activity + user-task + business-rule-task → DMN; daarnaast één CEL script-task en één tijdens-het-proces gestarte context-taak.

1. `go build .` en `go test .` groen.
2. `docker compose -f docker-compose.process.yml up` clean.
3. Camunda Modeler roundtrip: open → edit → redeploy via gateway → run.
4. End-to-end run via Postman-collectie; procesvariabelen blijven typed door de pipeline.
5. Cockpit-history toont service-call + DMN-evaluatie + user-task.
6. Context-taak start/complete tijdens lopend proces zonder token-flow-impact.

### Beslissingen

- **Operaton** (niet Camunda 8: licentie; niet Flowable: geen voordeel boven Operaton voor C7-lineage).
- Camunda Modeler hergebruikt; geen eigen modeler.
- **Gescheiden PG-database** voor Operaton history.
- **CEL als enige scripttaal**, uitgevoerd in Go (geen JVM-CEL nodig).
- **External-task pattern** overal → idiomatic Go, JVM-side stateless.
- **Geen CMMN-engine**; context-taken zijn gewone bitemporele REPs in MetaRegistry.
- **Valtimo nu niet** — separaat onderzoek t.z.t. (GZAC-relatie); PoC blijft daar onafhankelijk van.
- **Buiten scope**: cross-system message correlation, forms-engine, PBAC, multi-tenant.

### Verdere overwegingen

1. **BPMN-spec dekking PoC**: voorstel minimaal token-flow + sub-process + call-activity + user/service/business-rule-task + één timer-boundary-event. Compensation/escalation/multi-instance uitstellen. **Optie A** dit. **Optie B** breder (incl. compensation). **Optie C** smaller (alleen plain flow).
2. **Procesvariabele-strategie**: volledige REP-snapshot inline in Operaton vs. alleen `(ent_id, t)`-handle + lazy-fetch via gateway. **Aanbeveling**: handle + lazy-fetch (history blijft schoon, jullie tijdreis-semantiek blijft authoritative bij register, niet bij Operaton).
3. **Modeler-extensie voor MetaRegistry-aware autocompletion**: voor PoC nee; later optioneel via Camunda Modeler element-templates uit V3 JSON gegenereerd — past bij jullie codegen-filosofie.

---

Plan staat in  is jouw plek; ik heb een werkversie in session-memory gezet (`/memories/session/plan.md`). Wil je dat ik 'm ook in dat openstaande markdown-bestand schrijf? En wat is je voorkeur op de drie verdere overwegingen — vooral #1 (BPMN-scope) en #2 (snapshot vs. handle)?

---

## 🧑 User

over de tekst:
"DMN = pure beslissingen; input getypeerd tegen UML-velden, output tegen UML-enums/reflistitems." -> output natuurlijk ook mogelijk in alle basis gegevenstypen
"Canonieke data-adapter" of uberhaupt alle connectie naar het metamodel: keuze van een of meer registers (er kunnen er meer zijn op meerdere adressen) mogelijk en daarvan een keuze welke domeinen. Dat is configuratie.

## overwegingen
- 1 optie A
- 2 we houden zoveel mogelijk data bij de bron, zoals we dat noemen, dus ja, lazy fetch. We gaan misschien zien dat vaste gegevens: typen, ref lijsten die vaak gebruikt worden gechachet moeten, maar dat lossen we liever in een graphQL laag op dan in een consumer.
- 3 interessant idee, deze templates. Zeker dat idee vasthouden.

Je plant nu, dus ik heb geen document. Ik heb je omgezet naar Agent, dus nu kun je het plan schrijven.

## een paar belangrijke dingen
1. Ik heb deze vraag in hetzelfde project als bitemporal gesteld, vanwege de kennis die hier zit. De afhankelijkheid is echter volledig: Process Engine naar register. Het moet iets zijn dat **bovenop** de kennis, API's en programmatuur van het bitemp register is gebouwd.
2. UIteindelijk moet het ook als containers gaan draaien in docker, maar afzonderlijke
3. tijdens bouw en test mag het eigenlijk wel in dezelfde postgres container / instantie landen, dat is wel gemakkelijker. Een andere database daarin dan wel.
4. qua mappenstructuur kan het wellicht in hetzelfde VS project, maar parallel aan bitem_register_06 map?

Weet je genoeg om het plan eventueel iets bij te werken, de map te maken en het plan als bestand te schrijven?

---

## 🤖 Assistant

Ik ga het plan bijwerken met je feedback en het als bestand neerzetten in een nieuwe parallel-map `process_engine_v01/`. 

---
