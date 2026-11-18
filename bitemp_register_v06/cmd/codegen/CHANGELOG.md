# Changelog — Codegenerator

Noemenswaardige wijzigingen aan de generator (`cmd/codegen/`), die uit het canoniek model
(V3/MetaRegistry) de Go-modellen, input-structs, methods en metaregistry genereert.

Formaat: [Keep a Changelog](https://keepachangelog.com); versionering volgens
[`docs/versiebeheer.md`](../../docs/versiebeheer.md) (prefix `codegen/`).

## [Unreleased]

## Met api 0.28.0 — 2026-11-18
- **Nieuw: validatiefout als type/format het gegevenstype tegenspreken** (18-11-2026; gevonden door
  AI-INRICHTEN). Een veld zonder goType met `"type": "string"` en datatype Geheel, JaNee, Datum
  of DatumTijd werd zonder melding een tekstveld. De codegen stopt er nu op en noemt het veld.
  Let op: een model dat dit bevat bouwde tot nu toe wél; zie `docs/CODEGEN.md` §4.
- **Fix: een enum die meerdere domeinen gebruiken wordt nog maar in één domein gegenereerd**
  (18-11-2026; gevonden met het zaakmodel door FACADE en AI-INRICHTEN). Voorheen kwam het type
  met zijn constanten in elk domein dat hem gebruikte en compileerde `model` niet meer. Regel en
  gevolgen: `docs/CODEGEN.md` §8. De rebuild zet de domeinen in de goede volgorde.

## [codegen/v0.1.0] — 2026-07-14  _(baseline op `main`)_
- Eerste expliciete versie-ankerpunt voor de generator. De generator bestond al langer maar
  was niet apart geversioneerd; hij deelde commits en historie met de backend.
- Vanaf hier bumpt `codegen/` bij betekenisvolle generator-wijzigingen (nieuwe conventies,
  wijzigingen in gegenereerde structs/tags, nieuwe outputs).

---

Vóór deze baseline: gezamenlijke historie met de backend; zie `git log -- cmd/codegen`.
