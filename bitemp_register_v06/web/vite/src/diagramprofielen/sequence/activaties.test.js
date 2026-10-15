// activaties.test.js — sequence: activaties afleiden uit berichten (aanroepstapel, zoals EA).
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/sequence/activaties.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { leidActivatiesAf, MARGE } from "./activaties.js";

/** Marks diagram "Sequence" (Zandbak MW), EA-hoogtes positief. */
const MARK = [
  { id: "1", bron: "Partij", doel: "FS", y: 152 },
  { id: "2", bron: "Partij", doel: "FS", y: 200 },
  { id: "3", bron: "FS", doel: "Bijlage", y: 223 },
  { id: "4", bron: "Partij", doel: "FS", y: 270 },
  { id: "5", bron: "fs", doel: "AS", y: 365 },
  { id: "6", bron: "AS", doel: "Aanvraag", y: 427 },
  { id: "7", bron: "fs", doel: "Doc", y: 475 },
  { id: "8", bron: "fs", doel: "fs", y: 531, yEind: 546 },
  { id: "9", bron: "AS", doel: "VS", y: 569 },
  { id: "10", bron: "VS", doel: "Aanvraag", y: 611 },
];
const van = (uit, lijn) => uit.filter((a) => a.lijn === lijn).sort((a, b) => a.van - b.van);

test("episodes: de zender die niet op de stapel staat, opent een nieuwe (EA-beeld)", () => {
  const uit = leidActivatiesAf(MARK);
  const partij = van(uit, "Partij");
  assert.equal(partij.length, 1, "Partij: één activatie over drie aanroepen");
  assert.deepEqual([partij[0].van, partij[0].tot], [152, 270 + MARGE]);
  const fs = van(uit, "FS");
  assert.deepEqual(fs.map((a) => [a.van, a.tot]), [[152, 152 + MARGE], [200, 223 + MARGE], [270, 270 + MARGE]], "korte balkjes; de tweede omvat de aanroep naar Bijlage");
  assert.deepEqual(van(uit, "Bijlage").map((a) => [a.van, a.tot]), [[223, 223 + MARGE]]);
  const fsk = van(uit, "fs");
  assert.deepEqual(fsk.map((a) => [a.van, a.tot, a.diepte]), [[365, 546 + MARGE, 0], [546, 546 + MARGE, 1]], "wortel + rugzak vanaf het ontvangpunt");
  assert.deepEqual(van(uit, "AS").map((a) => [a.van, a.tot]), [[365, 427 + MARGE], [569, 569 + MARGE]], "twee episodes");
  assert.deepEqual(van(uit, "VS").map((a) => [a.van, a.tot]), [[569, 611 + MARGE]]);
});

test("retour sluit de activatie op de hoogte van de retour", () => {
  const uit = leidActivatiesAf([
    { id: "a", bron: "A", doel: "B", y: 100 },
    { id: "b", bron: "B", doel: "C", y: 120 },
    { id: "r", bron: "B", doel: "A", y: 200, soort: "retour" },
    { id: "c", bron: "A", doel: "B", y: 260 },
  ]);
  assert.deepEqual(van(uit, "B").map((a) => [a.van, a.tot]), [[100, 200], [260, 260 + MARGE]]);
  assert.deepEqual(van(uit, "C").map((a) => [a.van, a.tot]), [[120, 200]], "C sluit mee met de retour van B");
  assert.deepEqual(van(uit, "A").map((a) => [a.van, a.tot]), [[100, 260 + MARGE]]);
});

test("leeg en ongesorteerd", () => {
  assert.deepEqual(leidActivatiesAf([]), []);
  const uit = leidActivatiesAf([{ id: "2", bron: "A", doel: "B", y: 50 }, { id: "1", bron: "A", doel: "B", y: 10 }]);
  assert.deepEqual(van(uit, "A").map((a) => a.berichten), [["1", "2"]]);
});
