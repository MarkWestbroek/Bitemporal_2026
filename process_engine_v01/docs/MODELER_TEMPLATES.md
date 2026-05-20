# Modeler-templates uit V3 JSON (idee, niet-PoC)

> Status: idee om vast te houden voor na de PoC. Niet implementeren in de huidige fase.

## Het idee

Camunda Modeler ondersteunt **element-templates**: JSON-bestanden die per BPMN-element (service-task, business-rule-task, etc.) een set vooraf-gedefinieerde properties met validatie en defaults aanbieden. Modelleurs krijgen daarmee autocomplete + validatie binnen de standaard editor — zonder dat we een eigen modeler hoeven te bouwen.

Onze MetaRegistry beschrijft alle representatietypes, datatypes, enums en reflistitems van een register al in V3 JSON. Daaruit kunnen we **automatisch** Camunda element-templates genereren:

| Modeler-keuze                              | Gegenereerde template-property                                |
|--------------------------------------------|---------------------------------------------------------------|
| service-task topic = `register-call`       | dropdown `register_id` (uit `registers.yaml`)                |
| `register_id` gekozen                      | dropdown `padnaam` (alleen padnamen uit dat register)         |
| `padnaam` gekozen                          | dropdown `methode` (toegestaan op die handler)                |
| business-rule-task = DMN                   | dropdown `decisionRef` (gedeployde decisions per register)    |
| DMN-input-binding                          | autocomplete op MetaRegistry-velden van een gekozen REP       |
| DMN-output `typeRef`                       | dropdown over basistypen + datatypes + enums + reflists       |

## Waarom past dit bij onze codegen-filosofie

Het hele register-model is al codegen-gedreven vanuit V3 JSON: structs, MetaRegistry-entries, OpenAPI, GraphQL-schema, frontend-rendering. Element-templates zijn precies dezelfde hefboom richting de modeler-kant van de driehoek: één bron (V3 JSON) → meerdere outputs.

## Schets van implementatie (later)

1. Nieuwe CLI-tool `cmd/modeler-templates-export/` in `process_engine_v01/`.
2. Input: één of meerdere V3-JSON-bestanden van geconfigureerde registers + `registers.yaml`.
3. Output: één directory met Camunda Modeler element-templates per BPMN-element-type.
4. Distributie: zip die modelleurs in hun Camunda Modeler `~/.camunda-modeler/resources/element-templates/` droppen.
5. CI-stap: bij elke gepubliceerde modelversie van een register opnieuw genereren.

## Open punten

- Welke Camunda Modeler versie target? Modeler is in actieve ontwikkeling; templates-schema heeft een eigen versie.
- Hoe omgaan met meerdere registers met overlappende padnamen — prefixen met `register_id`?
- Hoe DMN-input-bindings koppelen aan handle-resolutie? Misschien een aparte template voor DMN-tabellen die "REP-aware" zijn.

Bewaren tot na de PoC. Geen actie nu.
