import { test } from "node:test";
import assert from "node:assert/strict";
import { VORMEN, valideerVormConfig, isWeergaveVorm } from "./vormen.js";
import { valideerSchema } from "./schemaValidatie.js";

test("elke vorm met config heeft een schema; weergave-modus aanwezig", () => {
  for (const [naam, v] of Object.entries(VORMEN)) {
    assert.ok(v.modi.length > 0, naam);
    assert.ok(v.help, `${naam} heeft help`);
  }
  for (const n of ["image-map", "rating-grid", "button-group", "switch", "range", "rotary", "cards", "drag-sort", "period", "address-search", "nl-map", "stepper", "scale-bars", "chips"]) {
    assert.ok(VORMEN[n]?.configSchema, `${n} heeft een configSchema`);
  }
  assert.ok(isWeergaveVorm("image-map") && isWeergaveVorm("scale-bars") && isWeergaveVorm("radio"));
});

test("image-map: geldige config zonder fouten, fouten met pad", () => {
  const goed = { image: "/x.svg", units: "px", width: 600, height: 420, areas: [{ value: "Laag 1", shape: "rect", coords: [0, 0, 10, 10] }], accentColor: "#f59e0b" };
  assert.deepEqual(valideerVormConfig("image-map", goed), []);
  const fout = { units: "cm", areas: [{ value: "a", shape: "star", coords: [1, 2] }], accentColor: "oranje" };
  assert.deepEqual(valideerVormConfig("image-map", fout), [
    "image: ontbreekt",
    "units: moet een van fraction, px zijn",
    "areas[0].shape: moet een van rect, circle, poly, ellipse zijn",
    "areas[0].coords: minimaal 3 element(en)",
    'accentColor: ongeldige waarde "oranje"',
  ]);
});

test("rating-grid: rijen als string of object; kolomkleur als CSS-variabele", () => {
  assert.deepEqual(valideerVormConfig("rating-grid", { rows: ["Regie", { value: "Wendbaarheid", description: "x" }], columns: [{ value: "Schaal 1", color: "var(--cg-blauw, #2563eb)" }] }), []);
  assert.deepEqual(valideerVormConfig("rating-grid", { rows: [{ label: "zonder value" }] }), ["rows[0]: heeft niet de verwachte vorm"]);
});

test("onbekende vorm en vorm zonder schema", () => {
  assert.deepEqual(valideerVormConfig("bestaat-niet", {}), ["onbekende vorm: bestaat-niet"]);
  assert.deepEqual(valideerVormConfig("text-area", { wat: 1 }), []);
  assert.deepEqual(valideerVormConfig("image-map", undefined), []);
});

test("validator: types, grenzen, additionalProperties", () => {
  const schema = { type: "object", properties: { n: { type: "integer", minimum: 1, maximum: 6 } }, additionalProperties: { type: "string" } };
  assert.deepEqual(valideerSchema({ n: 7, x: 3 }, schema), ["n: maximaal 6", "x: moet string zijn"]);
  assert.deepEqual(valideerSchema({ n: 2.5 }, schema), ["n: moet integer zijn"]);
});
