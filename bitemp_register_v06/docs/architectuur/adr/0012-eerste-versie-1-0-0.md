# ADR-0012: De eerste uitgebrachte versie is 1.0.0; het projectnummer staat los van de profielversies

- **Status**: Aanvaard
- **Datum**: 2026-11-23
- **Besloten door**: voorstel Claude, Mark akkoord met de release

## Context

Mark vroeg of het eerste centrale project met 1.x, lager of 1.0 moet beginnen, of met het hoogste
profielnummer.

## Besluit

- Het **projectnummer staat los** van de versies van de profielen erin; die houden elk hun eigen
  nummer (een nieuw profiel begint bij 0.1.0, Mark 21-11).
- De eerste uitgebrachte versie is **1.0.0**: de profielen draaien al in productie, en vanaf 1.0.0
  betekent een major in semver echt "raakt bestaande modellen". 0.1.0 blijft te kiezen.

## Gevolgen

- *Breng versie uit…* stelt bij de eerste versie 1.0.0 voor.

## Bronnen

- `studio/centraal.js (volgendeVersies)`
