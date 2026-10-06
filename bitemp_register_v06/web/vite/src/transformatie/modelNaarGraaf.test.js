import test from "node:test";
import assert from "node:assert/strict";

import { modelNaarGraaf } from "./modelNaarGraaf.js";

const elementTypes = [{ id: "systeem", containerVoor: "bevat" }, { id: "usecase" }, { id: "bevat", isConnector: true }, { id: "include", isConnector: true }];
const elements = {
  s: { id: "s", naam: "Systeem", elementType: "systeem", data: { toelichting: "kader" } },
  a: { id: "a", naam: "A", elementType: "usecase", data: {} },
  b: { id: "b", naam: "B", elementType: "usecase", data: {} },
  los: { id: "los", naam: "Los", elementType: "usecase", data: {} },
  sa: { id: "sa", naam: "", elementType: "bevat", source: "s", target: "a" },
  sb: { id: "sb", naam: "", elementType: "bevat", source: "s", target: "b" },
  ab: { id: "ab", naam: "ja", elementType: "include", source: "a", target: "b" },
  al: { id: "al", naam: "", elementType: "include", source: "a", target: "los" },
};

test("elementen worden knopen met aard, tekst, eigenschappen en groep; connectoren verbindingen", () => {
  const graaf = modelNaarGraaf({ elements, elementTypes });
  assert.deepEqual(graaf.knopen.map((k) => [k.id, k.aard, k.tekst, k.groep]), [
    ["s", "systeem", "Systeem", null],
    ["a", "usecase", "A", "s"],
    ["b", "usecase", "B", "s"],
    ["los", "usecase", "Los", null],
  ]);
  assert.equal(graaf.knopen[0].eigenschappen.toelichting, "kader");
  assert.deepEqual(graaf.verbindingen.map((v) => [v.id, v.aard, v.bron, v.doel, v.label]), [
    ["sa", "bevat", "s", "a", ""],
    ["sb", "bevat", "s", "b", ""],
    ["ab", "include", "a", "b", "ja"],
    ["al", "include", "a", "los", ""],
  ]);
  assert.deepEqual(graaf.groepen, []);
});

test("een bereik beperkt de graaf; een connector gaat alleen mee met beide uiteinden", () => {
  const graaf = modelNaarGraaf({ elements, elementTypes, bereik: ["s", "a", "b"] });
  assert.deepEqual(graaf.knopen.map((k) => k.id), ["s", "a", "b"]);
  assert.deepEqual(graaf.verbindingen.map((v) => v.id), ["sa", "sb", "ab"]);
  // Zonder profielkennis is er geen lidmaatschap.
  assert.equal(modelNaarGraaf({ elements }).knopen[1].groep, null);
});
