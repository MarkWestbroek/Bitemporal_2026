// mappenMetBeschrijving — oude map-`omschrijving` migreert naar `beschrijving` (13-10).
import test from "node:test";
import assert from "node:assert/strict";
import { mappenMetBeschrijving } from "./structuurKern.js";

test("mappenMetBeschrijving: omschrijving wordt beschrijving; bestaande beschrijving wint; ongewijzigd blijft hetzelfde object", () => {
  const uit = mappenMetBeschrijving({ a: { id: "a", naam: "A", omschrijving: "oud" }, b: { id: "b", naam: "B", beschrijving: "nieuw", omschrijving: "oud" }, c: { id: "c", naam: "C" } });
  assert.deepEqual(uit.a, { id: "a", naam: "A", beschrijving: "oud" });
  assert.deepEqual(uit.b, { id: "b", naam: "B", beschrijving: "nieuw" });
  assert.deepEqual(uit.c, { id: "c", naam: "C" });
  const zelfde = { c: { id: "c", naam: "C" } };
  assert.equal(mappenMetBeschrijving(zelfde), zelfde);
  assert.equal(mappenMetBeschrijving(null), null);
});
