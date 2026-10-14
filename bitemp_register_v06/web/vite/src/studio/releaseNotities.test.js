import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leesChangelog, vergelijkVersie, releasesSinds, kopjes, releaselogUrl } from "./releaseNotities.js";

const md = `# Changelog
## [Unreleased]
### Toegevoegd
- **Nog niet uit** (15-10): komt later.

## [studio/v0.20.0] — 2026-10-14
Melden vanuit Omnium: een bug, wens of
compliment.

### Toegevoegd
- **Melden vanuit Omnium** (14-10, Mark): *Help → Melden…* (Alt+M) voor
  een bug met \`F8\`.
- **Mijn meldingen**: status en gesprek.

### Tests
- **Melden** (14-10): e2e.

## [studio/v0.19.0] — 2026-10-14
Uitnodigen.
### Opgelost
- **Relaties van het diagram halen** (13-10, Mark): werkt nu.
`;

test("leesChangelog: releases, inleiding, groepen, items; Unreleased overgeslagen", () => {
  const r = leesChangelog(md);
  assert.deepEqual(r.map((x) => x.versie), ["0.20.0", "0.19.0"]);
  assert.equal(r[0].datum, "2026-10-14");
  assert.equal(r[0].inleiding, "Melden vanuit Omnium: een bug, wens of compliment.");
  assert.equal(r[0].groepen[0].kop, "Toegevoegd");
  assert.deepEqual(r[0].groepen[0].items[0], { titel: "Melden vanuit Omnium", tekst: "Help → Melden… (Alt+M) voor een bug met F8." });
  assert.equal(r[0].groepen[0].items[1].tekst, "status en gesprek.");
});

test("dezelfde kop twee keer in één release wordt één groep", () => {
  const r = leesChangelog(["## [studio/v1.0.0] — 2026-10-14", "### Toegevoegd", "- **A**: a", "### Tests", "- **T**: t", "### Toegevoegd", "- **B**: b"].join(String.fromCharCode(10)));
  assert.deepEqual(r[0].groepen.map((g) => g.kop), ["Toegevoegd", "Tests"]);
  assert.deepEqual(r[0].groepen[0].items.map((i) => i.titel), ["A", "B"]);
});

test("kopjes: zonder tests, max n", () => {
  const r = leesChangelog(md);
  assert.deepEqual(kopjes(r[0]), ["Melden vanuit Omnium", "Mijn meldingen"]);
  assert.deepEqual(kopjes(r[0], 1), ["Melden vanuit Omnium"]);
  assert.deepEqual(kopjes(undefined), []);
});

test("versies vergelijken en 'sinds je laatste bezoek'", () => {
  assert.ok(vergelijkVersie("0.20.0", "0.19.9") > 0);
  assert.ok(vergelijkVersie("0.9.0", "0.10.0") < 0);
  assert.equal(vergelijkVersie("1.0.0", "1.0"), 0);
  const r = leesChangelog(md);
  assert.deepEqual(releasesSinds(r, "0.18.0", "0.20.0").map((x) => x.versie), ["0.20.0", "0.19.0"]);
  assert.deepEqual(releasesSinds(r, "0.19.0", "0.20.0").map((x) => x.versie), ["0.20.0"]);
  assert.deepEqual(releasesSinds(r, "0.20.0", "0.20.0"), []);
});

test("de echte CHANGELOG is te lezen en de nieuwste versie heeft kopjes", () => {
  const echt = leesChangelog(readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf8"));
  assert.ok(echt.length > 5);
  assert.ok(kopjes(echt[0]).length > 0, `geen kopjes in ${echt[0].versie}`);
  assert.match(releaselogUrl("0.20.0"), /blob\/studio\/v0\.20\.0\//);
  assert.match(releaselogUrl("dev"), /blob\/main\//);
});
