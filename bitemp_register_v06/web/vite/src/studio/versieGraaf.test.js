// versieGraaf.test.js — hoofdlijn, onderhoudslijnen en terugmergen (stap 10, Mark 22-11).
import test from "node:test";
import assert from "node:assert/strict";
import { lijnen, voorouders, nietTeruggemerged, volgendeOnderhoud, onderhoudStartpunten, graafIndeling } from "./versieGraaf.js";

const v = (versie, uur, ...ouders) => ({ soort: "profielen", versie, uitgebracht: `2026-11-23T${String(uur).padStart(2, "0")}:00:00Z`, ouders: ouders.map((o) => ({ versie: o })) });

// 0.4.0 → 0.5.0 (hoofd); daarna 0.4.1 (onderhoud op 0.4); dan 0.6.0 met ouders 0.5.0 en 0.4.1.
const GRAAF = [v("0.4.0", 1), v("0.5.0", 2, "0.4.0"), v("0.4.1", 3, "0.4.0"), v("0.6.0", 4, "0.5.0", "0.4.1")];

test("lijnen: hoofd als hoger dan alles ervoor, anders de onderhoudslijn", () => {
  const l = lijnen(GRAAF);
  assert.deepEqual(Object.fromEntries(l), { "0.4.0": "hoofd", "0.5.0": "hoofd", "0.4.1": "0.4", "0.6.0": "hoofd" });
});

test("voorouders via beide ouders", () => {
  assert.deepEqual([...voorouders("0.6.0", GRAAF)].sort(), ["0.4.0", "0.4.1", "0.5.0"]);
});

test("niet teruggemerged: de reparatie vóór de merge wel, erna niet meer", () => {
  const voorMerge = GRAAF.slice(0, 3);
  assert.deepEqual(nietTeruggemerged(voorMerge), ["0.4.1"]);
  assert.deepEqual(nietTeruggemerged(GRAAF), []);
  assert.deepEqual(nietTeruggemerged([]), []);
});

test("onderhoud: volgende patch en startpunten per oudere lijn", () => {
  assert.equal(volgendeOnderhoud("0.4", GRAAF), "0.4.2");
  assert.deepEqual(onderhoudStartpunten(GRAAF), [
    { lijn: "0.5", vanaf: "0.5.0", volgende: "0.5.1" },
    { lijn: "0.4", vanaf: "0.4.1", volgende: "0.4.2" },
  ]);
  assert.deepEqual(onderhoudStartpunten([v("1.0.0", 1)]), [], "met één lijn is er niets te onderhouden");
});

test("indeling: kolom op volgorde, rij per lijn, een merge-lijn", () => {
  const g = graafIndeling(GRAAF);
  assert.deepEqual(g.rijen, ["hoofd", "0.4"]);
  assert.deepEqual(g.knopen.map((k) => [k.versie, k.kolom, k.rij]), [["0.4.0", 0, 0], ["0.5.0", 1, 0], ["0.4.1", 2, 1], ["0.6.0", 3, 0]]);
  assert.deepEqual(g.lijnen.filter((l) => l.merge), [{ van: "0.4.1", naar: "0.6.0", merge: true }]);
});
