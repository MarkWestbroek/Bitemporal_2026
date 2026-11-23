# ADR-0008: Een graaf van versies: semver per lijn, onderhoudslijnen, terugmergen

- **Status**: Aanvaard
- **Datum**: 2026-11-22 (besluit), 2026-11-23 (nummering gebouwd)
- **Besloten door**: Mark; nummering voorgesteld door Claude

## Context

Versies van een centraal project zijn geen stamboom maar een graaf: liefst één lijn, maar soms is
een reparatie op een oudere versie nodig terwijl de hoofdlijn verder is.

## Besluit

- Elke uitgebrachte versie noemt haar **ouders**: één bij een opvolger, twee bij een merge.
- **Een nummer komt één keer voor** per soort (voorstel Claude 22-11). Klanten forken niet (hun
  aanpassing is een delta, ADR-0007); een fork is alleen een **onderhoudslijn**: een patch op een
  oudere X.Y (0.4.1 terwijl de hoofdlijn op 0.5.0 staat), uit een eigen project.
- De hoofdlijn komt uit één project per soort; een nieuwe minor of major onder de hoofdlijn bestaat niet.
- **Terugmergen**: de reparatie gaat ook mee in de volgende versie van de hoofdlijn, die dan twee
  ouders heeft. Experimenten blijven concepten in een branch en worden niet uitgebracht.

## Gevolgen

- *Project → Versiegraaf…* toont de lijnen; *Onderhoudslijn starten* maakt het eigen project.
- Gebouwd in api 0.32.0 / studio 0.48.0. Open: de reparatie inhoudelijk overnemen (kan met de delta
  van ADR-0007), branches en releases in de graaf.

## Bronnen

- `docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het project (voorstel).md §10`
- `handlers/studio_versiegraaf.go`
- `studio/versieGraaf.js`
