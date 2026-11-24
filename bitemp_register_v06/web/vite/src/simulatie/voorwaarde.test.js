// Voorwaarden in de verwachting (§12.5 punt 6): operatoren naar de run state van EA.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isVoorwaarde, toonVoorwaarde, voldoet } from "./voorwaarde.js";

test("isVoorwaarde: alleen een object met uitsluitend operatoren als sleutel", () => {
  assert.equal(isVoorwaarde({ ">": 100 }), true);
  assert.equal(isVoorwaarde({ ">=": 50, "<=": 150 }), true);
  assert.equal(isVoorwaarde({ straat: "Dorpsstraat" }), false, "een gewone samengestelde waarde");
  assert.equal(isVoorwaarde({ ">": 1, straat: "x" }), false);
  assert.equal(isVoorwaarde({}), false);
  assert.equal(isVoorwaarde([1, 2]), false);
  assert.equal(isVoorwaarde(50), false);
});

test("voldoet: gewone waarden blijven precies gelijk", () => {
  assert.equal(voldoet(50, 50), true);
  assert.equal(voldoet("50", 50), false, "zonder operator geen omzetting");
  assert.equal(voldoet({ a: 1 }, { a: 1 }), true);
  assert.equal(voldoet(undefined, null), false, "niet gevonden is niet null");
});

test("voldoet: vergelijken, ook getal als tekst en ISO-datums", () => {
  assert.equal(voldoet(120, { ">": 100 }), true);
  assert.equal(voldoet(100, { ">": 100 }), false);
  assert.equal(voldoet("120", { ">": 100 }), true, "getal als tekst");
  assert.equal(voldoet(100, { ">=": 100 }), true);
  assert.equal(voldoet(75, { ">=": 50, "<=": 150 }), true);
  assert.equal(voldoet(175, { "≥": 50, "≤": 150 }), false);
  assert.equal(voldoet("2026-11-24", { "<": "2026-12-01" }), true);
  assert.equal(voldoet(undefined, { "<": 5 }), false, "niet gevonden voldoet nooit aan een vergelijking");
  assert.equal(voldoet({ a: 1 }, { ">": 0 }), false);
});

test("voldoet: =, ≠, in, niet in, gevuld, bevat", () => {
  assert.equal(voldoet("50", { "=": 50 }), true, "= met operator vergelijkt getallen als getal");
  assert.equal(voldoet("toegekend", { "≠": "afgewezen" }), true);
  assert.equal(voldoet("afgewezen", { "!=": "afgewezen" }), false);
  assert.equal(voldoet("b", { in: ["a", "b"] }), true);
  assert.equal(voldoet("c", { in: ["a", "b"] }), false);
  assert.equal(voldoet("c", { "niet in": ["a", "b"] }), true);
  assert.equal(voldoet("GPK-1", { gevuld: true }), true);
  assert.equal(voldoet("", { gevuld: true }), false);
  assert.equal(voldoet(undefined, { gevuld: false }), true);
  assert.equal(voldoet([], { gevuld: false }), true);
  assert.equal(voldoet("Jan Jansen", { bevat: "Jan" }), true);
  assert.equal(voldoet(["a", "b"], { bevat: "b" }), true);
  assert.equal(voldoet(12, { bevat: "1" }), false);
});

test("toonVoorwaarde: leesbaar, met de tekens ≠ ≤ ≥", () => {
  assert.equal(toonVoorwaarde("Beschikt"), "= Beschikt");
  assert.equal(toonVoorwaarde(false), "= false");
  assert.equal(toonVoorwaarde({ ">": 100 }), "> 100");
  assert.equal(toonVoorwaarde({ ">=": 50, "<=": 150 }), "≥ 50 en ≤ 150");
  assert.equal(toonVoorwaarde({ "!=": "afgewezen" }), "≠ afgewezen");
  assert.equal(toonVoorwaarde({ in: ["a", "b"] }), "in a, b");
  assert.equal(toonVoorwaarde({ gevuld: true }), "is gevuld");
  assert.equal(toonVoorwaarde({ gevuld: false }), "is leeg");
});
