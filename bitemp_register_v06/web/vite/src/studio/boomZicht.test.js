// boomZicht.test.js — de gefilterde projectboom (stap 9 deel 2, Mark 22-11).
import test from "node:test";
import assert from "node:assert/strict";
import { mappenInZicht, profielVanSleutel, inZicht } from "./boomZicht.js";

const mappen = {
  map_profielen: { id: "map_profielen", ouderId: null },
  map_sub: { id: "map_sub", ouderId: "map_profielen" },
  map_transformaties: { id: "map_transformaties", ouderId: null },
  map_leeg: { id: "map_leeg", ouderId: null },
};
const plaatsing = {
  "el::m3Profiel05::p_erd_profiel": "map_sub",
  "m3Profiel05::dg_erd": "el::m3Profiel05::p_erd_profiel", // een view onder het Profiel
  "transformatie05::dg_transformaties": "map_transformaties",
  "el::transformatie05::rs_1": "map_transformaties",
};

test("profielVanSleutel: element- en diagramsleutels", () => {
  assert.equal(profielVanSleutel("el::m3Profiel05::x"), "m3Profiel05");
  assert.equal(profielVanSleutel("transformatie05::dg"), "transformatie05");
});

test("het zicht Profielen: de mappen met M3-inhoud en hun voormappen", () => {
  assert.deepEqual([...mappenInZicht(mappen, plaatsing, ["m3Profiel05"])].sort(), ["map_profielen", "map_sub"]);
});

test("het zicht Transformaties: alleen de t-map", () => {
  assert.deepEqual([...mappenInZicht(mappen, plaatsing, new Set(["transformatie05"]))], ["map_transformaties"]);
});

test("onder een element zonder map: de root, geen map", () => {
  const p = { "el::m3Profiel05::los": "el::m3Profiel05::nergens" };
  assert.equal(mappenInZicht(mappen, p, ["m3Profiel05"]).size, 0);
});

test("een kring in de structuur loopt niet vast", () => {
  const kring = { a: { id: "a", ouderId: "b" }, b: { id: "b", ouderId: "a" } };
  assert.deepEqual([...mappenInZicht(kring, { "m3Profiel05::d": "a" }, ["m3Profiel05"])].sort(), ["a", "b"]);
});

test("inZicht: zonder zicht alles, met zicht alleen de talen", () => {
  assert.equal(inZicht(null, "x::y"), true);
  const zicht = { talen: new Set(["m3Profiel05"]) };
  assert.equal(inZicht(zicht, "el::m3Profiel05::a"), true);
  assert.equal(inZicht(zicht, "transformatie05::d"), false);
});
