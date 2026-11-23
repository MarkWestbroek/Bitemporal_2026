# ADR-0004: De projectversie gaat alleen omhoog bij uitbrengen; daartussen is het een concept

- **Status**: Aanvaard
- **Datum**: 2026-11-22
- **Besloten door**: Mark (keuze A)

## Context

Een profielen- of weergaveproject verandert voortdurend. De vraag was of elke wijziging een
nieuw versienummer geeft, of alleen een bewust moment.

## Besluit

Het nummer in de projectkop gaat **alleen omhoog bij uitbrengen** (door de beheerder). Wat
daartussen gewijzigd is, is een concept ("0.3.0 + concept").

## Gevolgen

- Een M1-project dat zegt "gemaakt met profielen 1.0.0" verwijst naar iets onveranderlijks.
- De server zet bij uitbrengen het nummer in de kop, ook van het project zelf (gevonden met de
  rooktest van 23-11).

## Bronnen

- `docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het project (voorstel).md §7 stap 4`
- `studio/projectGebruik.js`
