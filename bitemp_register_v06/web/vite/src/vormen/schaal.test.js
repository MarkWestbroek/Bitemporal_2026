import { test } from "node:test";
import assert from "node:assert/strict";
import { maakSchaal, stapKleur } from "./schaal.js";

test("lijst-schaal volgt de enum-volgorde", () => {
  const s = maakSchaal({ items: [{ value: "Schaal 1" }, { value: "Schaal 2" }, { value: "Schaal 3" }, { value: "Schaal 4", label: "groot" }], config: { labels: { "Schaal 1": "klein" } } });
  assert.equal(s.soort, "lijst");
  assert.equal(s.max, 3);
  assert.equal(s.naarIndex("Schaal 3"), 2);
  assert.equal(s.naarIndex(""), -1);
  assert.equal(s.naarWaarde(7), "Schaal 4", "begrensd");
  assert.equal(s.label(0), "klein");
  assert.equal(s.label(3), "groot");
});

test("getal-schaal met stap en afronding", () => {
  const s = maakSchaal({ config: { min: 1, max: 10, step: 1 } });
  assert.equal(s.n, 10);
  assert.equal(s.naarIndex("4"), 3);
  assert.equal(s.naarWaarde(3), "4");
  assert.equal(s.naarIndex(""), -1);
  const h = maakSchaal({ config: { min: 0, max: 1, step: 0.1 } });
  assert.equal(h.n, 11);
  assert.equal(h.naarWaarde(3), "0.3", "geen 0.30000000000000004");
});

test("stapkleuren: per stap of verloop", () => {
  assert.equal(stapKleur(["#000000", "#ffffff"], 0, 3), "#000000");
  assert.equal(stapKleur(["#000000", "#ffffff"], 1, 3), "#808080");
  assert.equal(stapKleur(["#a", "#b", "#c"], 2, 3), "#c");
  assert.equal(stapKleur(null, 0, 3), null);
});
