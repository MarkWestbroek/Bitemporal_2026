# Chat: Update Copilot instructions for V06 enhancements

- **Datum**: 2026-04-15 10:54
- **Sessie-ID**: `44d880fc-95b8-470a-ab7a-0bfdbcdb866a`
- **Berichten**: 2

---

## 🧑 User

zou je de copilot instructies aan jezelf willen bijwerken? Het is in de basis nog wel goed, maar we hebben in V06 toch wel veel toegevoegd, bijv. overerving en associatieklasse-weergave, GraphQL gegenereerd, de DEVLOOP, enz.

Ik wil hem graag reviewen als je hem gemaakt hebt.

---

## 🤖 Assistant



*Created 3 todos*

Let me gather context about the current v06 state from multiple sources. 

<details>
<summary><em>Read model</em> (+15 meer)</summary>

- Read model
- Read handlers
- Read routes
- Read cmd
- Read GRAPHQL.md
- Read README.md, lines 1 to 500
- Read RELEASE.md
- Read v06-active.instructions.md
- Read uml-editor
- Read dynql
- Read openapi
- Read schemadiff
- Read DEVLOOP.md
- Read afgeleide-velden.md, lines 1 to 300
- Read materiele_tijd.md, lines 1 to 200
- Read ONTWERP_DATA_PATTERN.md, lines 1 to 300
</details>



<details>
<summary><em>Read autoriseren</em> (+14 meer)</summary>

- Read autoriseren
- Read naamgeving
- Read src
- Read docs
- Read metaregistry_plumbing.go, lines 1 to 250
- Read codegen
- Read openapi-export
- Read BACKLOG.md, lines 1 to 200
- Read CODEGEN.md, lines 1 to 200
- Read autoriseren.md, lines 1 to 200
- Read OPENAPI.md, lines 1 to 200
- Read dynamische-graphql-laag.md, lines 1 to 150
- Read 3D_UNIVERSUM.md, lines 1 to 200
- Read overerving-analyse.md, lines 1 to 100
- Read frontend-viz-design.md
</details>



<details>
<summary><em>Read model</em> (+31 meer)</summary>

- Read model
- Read handlers
- Read routes
- Read cmd
- Read GRAPHQL.md
- Read README.md, lines 1 to 500
- Read RELEASE.md
- Read v06-active.instructions.md
- Read uml-editor
- Read dynql
- Read openapi
- Read schemadiff
- Read DEVLOOP.md
- Read afgeleide-velden.md, lines 1 to 300
- Read materiele_tijd.md, lines 1 to 200
- Read ONTWERP_DATA_PATTERN.md, lines 1 to 300
- Read autoriseren
- Read naamgeving
- Read src
- Read docs
- Read metaregistry_plumbing.go, lines 1 to 250
- Read codegen
- Read openapi-export
- Read BACKLOG.md, lines 1 to 200
- Read CODEGEN.md, lines 1 to 200
- Read autoriseren.md, lines 1 to 200
- Read OPENAPI.md, lines 1 to 200
- Read dynamische-graphql-laag.md, lines 1 to 150
- Read 3D_UNIVERSUM.md, lines 1 to 200
- Read overerving-analyse.md, lines 1 to 100
- Read frontend-viz-design.md
- Read content.txt, lines 1 to 500
</details>

Now let me read the v06-active instructions for completeness: 

*Read v06-active.instructions.md · Starting: *Draft updated copilot-instructions.md* (2/3)*

Now I have full context. Let me draft the updated copilot-instructions.md. The current file is 

*Read v06-active.instructions.md · Starting: *Draft updated copilot-instructions.md* (2/3)*

Now I have full context. Let me draft the updated copilot-instructions.md. The current file is v05-focused; I'll rewrite it to reflect the v06 reality while keeping v05 as reference. 

*Read copilot-instructions.md, lines 1 to 10*




*Read copilot-instructions.md, lines 1 to 10*




*Completed: *Draft updated copilot-instructions.md* (2/3)*

Het bestand `copilot-instructions.md` is volledig herschreven. Dit zijn de belangrijkste wijzigingen ten opzichte van de oude v05-versie:

### Wat is nieuw/gewijzigd:

| Onderwerp | Oud (v05) | Nieuw (v06) |
|-----------|-----------|-------------|
| **Titel & scope** | "Bitemporal Go API v05", v06 als toekomstplan | "Bitemporeel Register v06", v05 als archief/referentie |
| **Hub + _Data patroon** | Niet aanwezig | Volledige sectie met hub/data/aanvang/einde uitleg |
| **Multi-domein** | Niet aanwezig | 5 domeinen met prefixes, 7 bestanden per domein, init-volgorde |
| **GraphQL** | "gqlgen (experimenteel)" | Volledige sectie: `graphql-go/graphql`, dynamisch, queries/mutations/reverse relaties |
| **Codegen** | Niet aanwezig | CLI-tool met standalone/additive mode, V3 JSON roundtrip |
| **Devloop** | Niet aanwezig | Self-rebuilding workflow, Docker exit-42, fallback/rollback |
| **OpenAPI 3.1** | Niet aanwezig | Dynamisch gegenereerd, NL API Strategie, Swagger/ReDoc |
| **UML-Editor** | Niet aanwezig | React Flow editor met ASOC-patroon, XMI, directioneel, afgeleide velden |
| **Afgeleide velden** | Niet aanwezig | CEL-expressietaal, twee niveaus, weergaveveld |
| **Overerving** | Niet aanwezig | TPT-analyse, status: ontwerp gereed |
| **3D Universum** | Niet aanwezig | force-graph-3d, 3 view-modes, wormhole, REST/GraphQL toggle |
| **Schema-diff** | Niet aanwezig | Delta-berekening, migratiesuggesties, versioning |
| **Autorisatie** | Niet aanwezig | PBAC/XACML 3.0 ontwerp |
| **Handlers** | 5 generieke handlers | + schema/admin/diff/bestanden/docs handlers |
| **CLI-tools** | Niet aanwezig | codegen, export_v3, openapi-export, schemadiff |
| **Referentiedocs** | Niet aanwezig | Tabel met 17 documenten |
| **V3 JSON formaat** | Niet aanwezig | Volledige beschrijving als uitwisselingsformaat |
| **TypeMeta velden** | ~10 velden beschreven | ~20+ velden incl. GESubtype, Domein, AfgeleideVelden, EditorLayout, Directioneel |

Je kunt het bestand nu reviewen in .

---
