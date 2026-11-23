# ADR-0011: Profielen in groepsmappen (voorlopige indeling)

- **Status**: Voorlopig
- **Datum**: 2026-11-23
- **Besloten door**: Mark (indeling); aanvulling door Claude

## Context

Met 30 profielen in één lijst is de boom onoverzichtelijk. Nu een profiel een container is,
kunnen er mappen omheen.

## Besluit

Een eerste indeling: UML (Statisch, Dynamisch), Gegevensmodellering (MIM, ERD), ArchiMate,
Schema's (GraphQL, OAS, WSDL, XSD), Business (BPMN, CMMN, DMN, Eriksson-Penker), UI (Formulier),
Linked data (SHACL, OWL, Graaf), Plumbing (Toegangsregel, Transformatie, Simulatiemodel, Weergave).
Door Claude ingedeeld, te bevestigen: Canoniek datamodel bij Gegevensmodellering; SysML en
Requirements als eigen groep; wat geen groep heeft, in Overig. Het overzicht "begin met een nieuw
diagram" volgt dezelfde groepen.

## Gevolgen

- Mark denkt na over de definitieve indeling (BACKLOG PROF-2).
- Wens: statisch/dynamisch als eigenschap van het profiel in het M3, zodat de mappen eruit volgen.

## Bronnen

- `studio/profielGroepen.js`
- `docs/BACKLOG.md PROF-2`
