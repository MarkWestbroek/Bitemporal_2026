import test from "node:test";
import assert from "node:assert/strict";
import { schuifVeld } from "./velden.js";

const el = {
  id: "k",
  compartimenten: [
    { compartmentType: "velden", velden: [{ naam: "a" }, { naam: "b" }, { naam: "c" }] },
    { compartmentType: "operaties", velden: [{ naam: "op" }] },
  ],
};

test("schuifVeld: omlaag wisselt met de buur en geeft de nieuwe index", () => {
  const uit = schuifVeld(el, "velden", 0, "omlaag");
  assert.equal(uit.nieuweIndex, 1);
  assert.deepEqual(uit.compartimenten[0].velden.map((v) => v.naam), ["b", "a", "c"]);
  // Andere compartimenten en de invoer blijven ongemoeid.
  assert.equal(uit.compartimenten[1], el.compartimenten[1]);
  assert.deepEqual(el.compartimenten[0].velden.map((v) => v.naam), ["a", "b", "c"]);
});

test("schuifVeld: omhoog op de eerste, omlaag op de laatste, onbekend → null", () => {
  assert.equal(schuifVeld(el, "velden", 0, "omhoog"), null);
  assert.equal(schuifVeld(el, "velden", 2, "omlaag"), null);
  assert.equal(schuifVeld(el, "bestaat-niet", 0, "omlaag"), null);
  assert.equal(schuifVeld(el, "velden", 7, "omhoog"), null);
});
