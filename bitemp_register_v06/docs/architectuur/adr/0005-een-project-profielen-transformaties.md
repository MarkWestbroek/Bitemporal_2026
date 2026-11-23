# ADR-0005: Eén project voor profielen en transformaties; de activiteiten zijn zichten

- **Status**: Aanvaard
- **Datum**: 2026-11-22
- **Besloten door**: Mark

## Context

Er waren drie ingangen: de profiel-ontwerper (JSON), Profiel (M3) en Transformaties. Profielen en
transformaties leunen op elkaar.

## Besluit

Er is **één project "profielen en transformaties"** (het sidecar-project). De activiteiten
*Profielen* en *Transformaties* blijven, maar zijn elk een **gefilterde boom** op dat ene project.
De JSON-ontwerper vervalt als ingang; het Profiel-ontwerp blijft als probeerhoek (Mark 23-11).

## Gevolgen

- Eén plek voor versies, branches en uitbrengen van alles wat de tool definieert.
- Gebouwd in studio 0.48.0 (`projectZicht.jsx`, `boomZicht.js`).

## Bronnen

- `docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het project (voorstel).md §9`
- `docs/STUDIO.md (Stap 9)`
