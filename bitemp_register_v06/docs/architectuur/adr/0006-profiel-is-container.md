# ADR-0006: Een profiel is een container in het M3; diagrammen zijn views; de JSON is afgeleid

- **Status**: Aanvaard
- **Datum**: 2026-11-22
- **Besloten door**: Mark

## Context

Het diagram droeg het profiel: één diagram was één profiel. Een profiel kan ingewikkeld zijn en
meerdere views vragen; het model is één.

## Besluit

- Het M3 definieert **Profiel als container** (vorm map), zoals het domein in het canonieke model.
  De kopgegevens zijn eigenschappen van dat element, met historie.
- De diagrammen in die container zijn **views**.
- De **JSON** (de descriptor) is een **afgeleide, alleen-lezen** eigenschap: te kopiëren en te
  exporteren, niet te bewerken. Een descriptor binnenhalen blijft een import die elementen maakt.

## Gevolgen

- Een oud project (diagram met `m3Profiel`, zonder container) blijft werken.
- Nu een profiel een container is, kun je er mappen omheen zetten (ADR-0010).
- Gebouwd in studio 0.48.0 (M3-taal 1.1.0, `profielContainer.js`).

## Bronnen

- `docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het project (voorstel).md §9`
- `studio/activities/profielContainer.js`
