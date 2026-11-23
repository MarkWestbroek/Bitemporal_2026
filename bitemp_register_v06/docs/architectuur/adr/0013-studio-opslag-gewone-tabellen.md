# ADR-0013: De opslag van de Studio blijft voorlopig in gewone tabellen, niet in het register

- **Status**: Aanvaard
- **Datum**: 2026-11-23
- **Besloten door**: Mark

## Context

Bij stap 5 kwam de vraag of de uitgebrachte versies via het bitemporele register (EYODF) moesten
lopen in plaats van een gewone tabel.

## Besluit

- `studio_project_uitgaven` en `studio_klant_aanpassingen` zijn **gewone tabellen**, zoals
  `studio_projecten` en de operaties.
- Later in één keer naar het register (BACKLOG STUDIO-REG), samen met de gedeelde plaatjes (SHARE-1 e):
  dan krijgen ze toegang via beleid, GraphQL en historie (bv. een uitgave intrekken met notificatie).

## Gevolgen

- Een uitgebrachte versie is onveranderlijk, dus de formele en materiële tijd voegen nu weinig toe.
- Geen rebuild nodig op de instanties voor deze stap.

## Bronnen

- `docs/BACKLOG.md STUDIO-REG`
