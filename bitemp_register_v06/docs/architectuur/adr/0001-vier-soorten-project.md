# ADR-0001: Vier soorten project: M1, weergaven, M2 + transformaties, M3

- **Status**: Aanvaard
- **Datum**: 2026-11-21
- **Besloten door**: Mark

## Context

De Studio haalt zijn profielen, transformaties en vormen uit de code. Mark wilde die als
modellen beheren, met de gewone voordelen van een project (sync, historie, branches). De vraag
was hoe de lagen zich tot elkaar verhouden.

## Besluit

Er zijn vier soorten project, elk leunend op het project eronder:

| Project | Inhoud | Ontbreekt het? |
|---|---|---|
| **M1** | de modellen (het gewone project) | — |
| **weergaven** | vormen, iconen, renderers op id, en de koppeling elementtype → weergave | de code tekent |
| **M2 + transformaties** | de profielen en de regelsets (het sidecar-project) | de profielen uit de code |
| **M3** | het metametamodel; in feite een view op de code | de code |

Inhoud en vorm zijn gescheiden: een M2 zegt *wat* er is, het weergaveproject *hoe* het eruitziet.
Het M1-project noemt in zijn kop welke M2- en weergaveversie het gebruikt; bij een verschil met wat
geladen is volgt een waarschuwing, geen fout.

## Gevolgen

- Dezelfde profielen zijn met een andere huisstijl te leveren (andere iconen, zelfde M2).
- De onderste drie projecten mogen ontbreken; dan valt de tool terug op de code (ADR-0002).
- Er komen weinig M2- en weergaveprojecten; ze worden beheerd (ADR-0003).

## Bronnen

- `docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het project (voorstel).md §2`
