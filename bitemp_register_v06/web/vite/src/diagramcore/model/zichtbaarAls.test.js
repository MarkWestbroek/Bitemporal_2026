import test from "node:test";
import assert from "node:assert/strict";
import { isZichtbaar } from "./zichtbaarAls.js";

test("zichtbaarAls: zonder voorwaarde altijd, met {key} als die aan staat, met waarde(n) bij gelijkheid", () => {
  assert.equal(isZichtbaar({ key: "a" }, {}), true);
  const tp = { key: "tijdprecisie", zichtbaarAls: { key: "materieel" } };
  assert.equal(isZichtbaar(tp, {}), false);
  assert.equal(isZichtbaar(tp, { materieel: true }), true);
  assert.equal(isZichtbaar(tp, { tijdprecisie: "" }), false);
  assert.equal(isZichtbaar(tp, { tijdprecisie: "tijdstip" }), true, "gevuld blijft zichtbaar");
  const w = { key: "x", zichtbaarAls: { key: "soort", waarde: ["a", "b"] } };
  assert.equal(isZichtbaar(w, { soort: "b" }), true);
  assert.equal(isZichtbaar(w, { soort: "c" }), false);
  assert.equal(isZichtbaar({ key: "y", zichtbaarAls: { key: "soort", waarde: "a" } }, { soort: "a" }), true);
});
