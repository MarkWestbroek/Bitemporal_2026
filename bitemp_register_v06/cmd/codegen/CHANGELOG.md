# Changelog — Codegenerator

Noemenswaardige wijzigingen aan de generator (`cmd/codegen/`), die uit het canoniek model
(V3/MetaRegistry) de Go-modellen, input-structs, methods en metaregistry genereert.

Formaat: [Keep a Changelog](https://keepachangelog.com); versionering volgens
[`docs/VERSIONERING.md`](../../docs/VERSIONERING.md) (prefix `codegen/`).

## [codegen/v0.1.0] — 2026-07-14  _(baseline op `main`)_
- Eerste expliciete versie-ankerpunt voor de generator. De generator bestond al langer maar
  was niet apart geversioneerd; hij deelde commits en historie met de backend.
- Vanaf hier bumpt `codegen/` bij betekenisvolle generator-wijzigingen (nieuwe conventies,
  wijzigingen in gegenereerde structs/tags, nieuwe outputs).

---

Vóór deze baseline: gezamenlijke historie met de backend; zie `git log -- cmd/codegen`.
