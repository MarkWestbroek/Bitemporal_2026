# ADR-0007: Een klantaanpassing is een delta op de vastgepinde basisversie

- **Status**: Aanvaard
- **Datum**: 2026-11-22
- **Besloten door**: Mark

## Context

Klanten willen uitbreidingen (+) of een eenvoudiger toolset (−). Kopieën per klant lopen uit
elkaar en zijn bij elke nieuwe centrale versie opnieuw werk (*practice what you preach*).

## Besluit

- Een klantaanpassing is **alleen de delta** van de klant op een uitgebrachte basisversie. De
  klantversie wordt gegenereerd: basis + delta.
- Bij een nieuwe basis wordt de delta erop gezet, met per wijziging: **past**, **botst** (de
  beheerder kiest) of **al opgenomen** (valt uit de delta, die kleiner of leeg wordt).
- De delta is zelf beheerd: onveranderlijke versies per klant, met de vorige als ouder.
- Vorm (Claude 23-11, technisch): een lijst eenheden (element, diagram, map, plaatsing, …) met de
  waarde van de klant of "weg", geen operaties. Samenvoegen gaat per veld (`voegSamen`).

## Gevolgen

- Een lege delta betekent: de klant kan de centrale versie gewoon gebruiken.
- Gebouwd in api 0.32.0 / studio 0.48.0. Open: starten met een klantversie (waar stel je per
  instantie de klant in?), keuze per botsing.

## Bronnen

- `docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het project (voorstel).md §10`
- `studio/takken/klantDelta.js`
- `handlers/studio_klantaanpassing.go`
