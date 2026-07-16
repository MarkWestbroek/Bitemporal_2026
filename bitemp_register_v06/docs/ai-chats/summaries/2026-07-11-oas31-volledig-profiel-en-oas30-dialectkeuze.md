# Chat Samenvatting

> **Claude**-sessie (Claude Code, model Fable 5) — de map heet historisch
> `copilot-chats`.

## Metadata

- Datum: 2026-07-10 t/m 2026-07-11
- Titel: Volledig OAS 3.1-profiel + OAS 3.0-dialectkeuze in de Studio
- Bestandstamnaam: 2026-07-11-oas31-volledig-profiel-en-oas30-dialectkeuze
- Gerelateerde export: exports/2026-07-11-oas31-volledig-profiel-en-oas30-dialectkeuze.md
- Gerelateerde branch/commit: `feat/studio01-oas-31-30` — `8c3a2f7` + vervolgcommit (3.0-dialect)

## Doel

Het oas31-diagramprofiel uitbouwen van "schemas + operaties" naar een
(vrijwel) volledige OAS 3.1-representatie — servers, paths-details en
description/format/example per schema-property — en aansluitend OAS
3.0-documenten kunnen inlezen/wegschrijven via een dialectkeuze.

## Beslissingen

- **«api»- en «server»-elementen** in het metamodel (info-object en
  servers-items), verbonden met een servers-connector; auto-layout zet ze op
  de bovenste rij.
- **Property-details** (description/example/pattern/default) als
  veld-properties; **parameters- en responses-compartimenten** (álle
  statussen, ook 4xx/5xx) op de operatie.
- **Pass-through-principe**: benoemde componenten
  (requestBodies/responses/parameters), tags, security en overige
  document-sleutels reizen onvertaald mee in `meta`; lokale `$refs` ernaar
  worden alleen voor de wéérgave gevolgd en blijven in de export staan.
- **Geen apart OAS 3.0-profiel** maar een **versie-schakelaar in één
  adapter**: descriptor identiek, dialectkeuze bij import (auto/3.0/3.1,
  default auto = volg het openapi-veld), en **`oas-version` als property van
  het api-element** die de export stuurt.
- **Intern model is 3.1-vormig**: 3.0-`nullable` → `|null`-type-label;
  export vouwt voor 3.0 terug (`nullable: true`, geen $ref-siblings).
- Logius-voorbeeldspec (3.0.2) alleen als smoke test gebruikt.

## Waarom deze keuze

De verschillen tussen 3.0 en 3.1 zitten vrijwel volledig in de serialisatie,
niet in de betekenis — één intern (3.1-vormig) model met een
dialect-schakelaar op de terugreis houdt de descriptor, de PE-weergave en de
adapter enkelvoudig, en geeft er gratis een lichte 3.0↔3.1-transformatie bij
(oas-version omzetten = ander dialect exporteren). Spiegel + delta blijft het
leidende principe: alles wat de tekening niet beheert blijft byte-getrouw uit
de bron komen.

## Gewijzigde onderdelen

- Bestanden: `web/vite/src/diagramprofielen/oas31/index.js` (descriptor),
  `adapter.js` (+`bepaalOasVersie`/`naarDialect`), `adapter.test.js`,
  `oas31.test.js`, `web/vite/src/studio/activities/oasActivity.jsx`
  (importkeuze), `web/vite/profielen/oas31.json` (PE-layout),
  `docs/STUDIO.md`, `docs/BACKLOG.md` (0.0.2)
- API routes: n.v.t. (puur frontend/Studio)
- DB/SQL: n.v.t.
- Frontend: Studio 0.5 — OAS-activiteit + profiel-editor

## Open punten

- Volledige 3.0↔3.1-transformatie (exclusiveMinimum/Maximum,
  content-vormen, `example`→`examples`-promotie, pass-through-delen
  meevertalen) — BACKLOG 0.0.2-restpunt.
- securitySchemes/headers/links als eigen elementen; inline oneOf-varianten.

## Volgende stap

Met een echte 3.0-spec (bv. de Logius "logboek-extensie-lezen") de
import-keuzedialoog en de 3.0-export in de browser doorlopen; daarna t.z.t.
het transformatie-restpunt oppakken.
