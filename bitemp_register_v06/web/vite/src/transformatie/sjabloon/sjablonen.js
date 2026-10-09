/**
 * sjabloon/sjablonen — de ingebouwde documentsjablonen.
 *
 * Per sjabloon: id, label, profielTypes (profieltype-id's waarvoor het geldt,
 * "*" = elk), toelichting en de sjabloontekst (zie renderer.js voor de
 * notatie). Eigen sjablonen in het project komen later (ontwerpvoorstel §3.1).
 * Hier als JS-strings (en niet als .md?raw) zodat de node-tests ze ook zien.
 */

export const SJABLOON_USE_CASE_OVERZICHT = `---
titel: Use case-overzicht {{map.naam}}
---
# Use case-overzicht — {{map.naam}}

{{#elk diagrammen sorteer=naam}}
## Diagram: {{naam}}

{{svg}}

{{#if beschrijving}}{{beschrijving}}

{{/if}}Op dit diagram: {{elementen}}.

{{/elk}}
# Actoren

{{#elk elementen type=actor sorteer=naam}}
## {{naam}}

{{#if toelichting}}{{toelichting}}

{{/if}}{{#elk verbindingen type=associatie}}- {{ander.naam}}
{{/elk}}
{{/elk}}
# Use cases

{{#elk elementen type=usecase sorteer=naam}}
## {{naam}}

{{#if toelichting}}{{toelichting}}

{{/if}}| | |
|---|---|
| Actoren | {{#elk verbindingen type=associatie}}{{ander.naam}}{{#unless laatste}}, {{/unless}}{{/elk}} |
| Bevat (include) | {{#elk verbindingen type=include richting=uit}}{{doel.naam}}{{#unless laatste}}, {{/unless}}{{/elk}} |
| Uitgebreid door (extend) | {{#elk verbindingen type=extend richting=in}}{{bron.naam}}{{#unless laatste}}, {{/unless}}{{/elk}} |
| Specialiseert | {{#elk verbindingen type=generalisatie richting=uit}}{{doel.naam}}{{#unless laatste}}, {{/unless}}{{/elk}} |
| Op diagram | {{diagrammen}} |

{{/elk}}
`;

export const SJABLOON_MAP_OVERZICHT = `---
titel: Overzicht {{map.naam}}
---
# {{map.naam}}

{{#elk profielen}}
## {{label}}

{{#elk diagrammen sorteer=naam}}
### Diagram: {{naam}}

{{svg}}

{{#if beschrijving}}{{beschrijving}}

{{/if}}{{/elk}}
### Elementen

{{#elk elementen sorteer=naam}}
- **{{naam}}** ({{type.label}}){{#if toelichting}} — {{toelichting}}{{/if}}{{#elk velden}}
  - {{naam}}{{#if type}}: {{type}}{{/if}}{{/elk}}
{{/elk}}
{{/elk}}
`;

export const SJABLOON_GEGEVENSWOORDENBOEK = `---
titel: Gegevenswoordenboek {{map.naam}}
---
# Gegevenswoordenboek — {{map.naam}}

{{#elk diagrammen sorteer=naam}}
## Diagram: {{naam}}

{{svg}}

{{/elk}}
{{#elk elementen sorteer=naam}}
{{#if velden}}
## {{naam}}{{#if type.label}} ({{type.label}}){{/if}}

{{#if toelichting}}{{toelichting}}

{{/if}}| Veld | Type | Compartiment |
|---|---|---|
{{#elk velden}}| {{naam}} | {{type}} | {{compartiment}} |
{{/elk}}
{{/if}}{{/elk}}
`;

export const INGEBOUWDE_SJABLONEN = [
  {
    id: "use-case-overzicht",
    label: "Use case-overzicht",
    profielTypes: ["usecase05"],
    toelichting: "Per diagram de tekening, dan actoren en use cases met include/extend en de diagrammen waarop ze staan.",
    tekst: SJABLOON_USE_CASE_OVERZICHT,
  },
  {
    id: "gegevenswoordenboek",
    label: "Gegevenswoordenboek",
    profielTypes: ["diagram05", "uml05", "mim05", "erd05", "graphql05", "oas05"],
    toelichting: "Per element met velden een tabel van velden en typen; diagrammen als tekening.",
    tekst: SJABLOON_GEGEVENSWOORDENBOEK,
  },
  {
    id: "map-overzicht",
    label: "Map-overzicht (generiek)",
    profielTypes: "*",
    toelichting: "Alles in de map per profiel: diagrammen als tekening, elementen met hun velden.",
    tekst: SJABLOON_MAP_OVERZICHT,
  },
];
