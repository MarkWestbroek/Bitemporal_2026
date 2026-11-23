# ADR-0003: Eén centrale plek; lezen met een leestoken; een release pint exact vast; een klant-centrale is een spiegel

- **Status**: Aanvaard
- **Datum**: 2026-11-22
- **Besloten door**: Mark

## Context

De M2- en weergaveprojecten zijn verweven met wat de applicatie kan (hooks en renderers zijn
code). Alle instanties (app, Fundament, pf) moeten dezelfde versies kunnen gebruiken.

## Besluit

- De **centrale instantie is app**. Daar staan de projecten en daar brengt de beheerder versies uit.
- Andere instanties lezen met een **leestoken**: een gewoon API-token van een lezer-account op app,
  één per instantie (`CENTRAAL_URL` + `CENTRAAL_TOKEN`). De API haalt een versie bij de centrale
  en bewaart een kopie.
- Een **release pint de versies exact vast** (`centraalVersies.js`); volgen van "de nieuwste" kan niet.
- Een **klant-centrale is een spiegel**; interne voorstellen van een klant worden centraal beoordeeld.
- Elke versie bewaart vanaf de eerste haar **ouders** (zie ADR-0008).
- Bij het starten geldt per soort: een lokale keuze (concept) → de vastgepinde versie → de laatst
  opgehaalde kopie → de code.

## Gevolgen

- Een uitgebrachte versie is onveranderlijk en blijft bestaan als het project wordt verwijderd.
- Een nieuwe versie in gebruik nemen is een (kleine) release.
- Gebouwd in api 0.32.0 / studio 0.48.0; nog niets vastgepind. Open: leesaccounts per instantie,
  interne voorstellen van een klant-centrale.

## Bronnen

- `docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het project (voorstel).md §6 en §8`
- `docs/STUDIO.md (Stap 5)`
- `handlers/studio_centraal.go`
