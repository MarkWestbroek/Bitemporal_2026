# ADR-0009: De ontwerper werkt in een branch; MAIN van een centraal project is van de beheerder

- **Status**: Aanvaard
- **Datum**: 2026-11-21 (rollen), 2026-11-23 (uitwerking)
- **Besloten door**: Mark; uitwerking door Claude

## Context

De modelleur leest profielen alleen (besluit 16-10). Transformaties, profielen en weergaven maakt
een rol tussen modelleur en beheerder; concepten moeten uit te proberen zijn.

## Besluit

- De **ontwerper** maakt een branch van een centraal project en werkt daarin (een concept); de
  **beheerder** voegt samen en brengt uit.
- Uitwerking (Claude 23-11): een project is **centraal** zodra er op deze instantie een versie van
  is uitgebracht. Op zijn MAIN houdt wie geen beheerder is alleen leesrecht (ook de eigenaar); een
  branch maken vraagt minstens ontwerper; uitbrengen kan niet vanaf een branch.
- De server bepaalt "centraal" uit de uitgebrachte versies, niet uit de soort in de kop: hij kijkt
  niet in de blob, en vóór de eerste versie is er niets centraals te beschermen.

## Gevolgen

- Het recht wordt op één plek afgetopt (`projectRechtVan`), dus alle schrijfroutes weigeren vanzelf.
- Gebouwd in api 0.32.0 / studio 0.48.0.

## Bronnen

- `docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het project (voorstel).md §6 en §10`
- `handlers/studio_centraal_rol.go`
