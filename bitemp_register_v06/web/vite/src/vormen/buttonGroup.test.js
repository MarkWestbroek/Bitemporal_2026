import { test } from "node:test";
import assert from "node:assert/strict";
import { sorteerKnoppen, knoppenUitOpties } from "./buttonGroup.js";

const items = knoppenUitOpties([
  { id: 12, label: "OAS 10" }, { id: 3, label: "NLGov REST API Design Rules" }, { id: 7, label: "OAS 2" },
  { id: 1, label: "digikoppeling" }, { id: "x", label: "Zonder id" },
]);

test("A–Z: hoofdletterongevoelig, getallen op waarde", () => {
  assert.deepEqual(sorteerKnoppen(items, "alpha").map((i) => i.label),
    ["digikoppeling", "NLGov REST API Design Rules", "OAS 2", "OAS 10", "Zonder id"]);
});

test("order: op id (volgorde van registratie), zonder order achteraan", () => {
  assert.deepEqual(sorteerKnoppen(items, "order").map((i) => i.value), ["1", "3", "7", "12", "x"]);
});

test("none laat de volgorde staan; de invoer wordt niet gemuteerd", () => {
  const kopie = items.map((i) => i.value);
  sorteerKnoppen(items, "alpha");
  assert.deepEqual(items.map((i) => i.value), kopie);
  assert.deepEqual(sorteerKnoppen(items, "none").map((i) => i.value), kopie);
});

test("enum-waarden worden knoppen", () => {
  assert.deepEqual(knoppenUitOpties(["A", "", null, "B"]), [{ value: "A", label: "A" }, { value: "B", label: "B" }]);
});
