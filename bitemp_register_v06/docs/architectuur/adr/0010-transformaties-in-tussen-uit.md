# ADR-0010: Transformaties: in, tussen of uit; een transformatie is een container

- **Status**: Aanvaard
- **Datum**: 2026-11-23
- **Besloten door**: Mark

## Context

De regelsets stonden in het project op één diagram, zonder structuur, en de richting heette
import, export of inrichting.

## Besluit

- Een transformatie is altijd **in** (van buiten → een of meer M1's), **tussen** (M1 → M1) of
  **uit** (M1 → buiten: een formaat of een artefact voor een component).
- Binnen die indeling is een transformatie een **container** in haar M2 (M3 `uitwerking`), met
  haar eigen bron, doel en diagram eronder.
- Combinaties (eerst t1, dan t2, dan t3) heten T-sets of T-scripts en komen later (BACKLOG TRANS-2).

## Gevolgen

- Oude waarden lezen als de nieuwe (import → in, export en inrichting → uit).
- *Tussen* is nog leeg: OAS → canoniek en SHACL ↔ canoniek zijn nog code, geen regelset.
- Gebouwd in studio 0.48.0 (profiel Transformatie 1.1.0).

## Bronnen

- `docs/TRANSFORMATIES.md §9.9`
