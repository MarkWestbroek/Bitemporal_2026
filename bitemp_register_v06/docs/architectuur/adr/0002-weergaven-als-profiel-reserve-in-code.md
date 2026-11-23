# ADR-0002: Weergaven als elementen in een eigen profiel; volledige reserve in de code

- **Status**: Aanvaard
- **Datum**: 2026-11-21
- **Besloten door**: Mark

## Context

Vormen en iconen moesten in een project komen. Twee vragen: als bijlage of als modelelementen,
en hoeveel er in de code moet blijven voor als het project ontbreekt of kapot is.

## Besluit

- Vormen en iconen zijn **elementen** in een eigen M2, *Weergave*, niet bewerkbaar voor de
  modelleur. Zo reizen ze mee met sync, historie, branches en samenvoegen per veld zonder eigen spoor.
- Een icoon staat als SVG-tekst in het project, een vorm als gegevens; een renderer is code en
  staat in het project alleen op id.
- **Reserve in de code: volledig** (niveau 3 van 3). Elke weergave staat ook in de code, zodat een
  kapot of ontbrekend weergaveproject nooit een onleesbare tool geeft.

## Gevolgen

- Elke weergave staat twee keer; een rondreistest bewaakt dat project en code gelijk tekenen.
- SVG uit een project wordt altijd geschoond.
- Gebouwd in studio 0.48.0: profiel Weergave, 187 iconen als SVG-tekst, de koppeling.

## Bronnen

- `docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het project (voorstel).md §3–§4`
- `docs/STUDIO.md (Het weergaveproject)`
