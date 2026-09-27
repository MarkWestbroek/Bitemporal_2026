import { test } from "node:test";
import assert from "node:assert/strict";
import { codeVan, pastBijSleutel, vindDefinitie, sleutelVan, isGeldigeCode } from "./definitieSleutel.js";

const defs = [
  { id: 3, meta: { code: "nieuwe-organisatie", naam: "Nieuwe organisatie" } },
  { id: 21, meta: { naam: "Zonder code" } },
  { id: 5, code: " initiatief-met-vormen " },
];

test("id of code wijst dezelfde definitie aan", () => {
  assert.equal(vindDefinitie(defs, "3"), defs[0]);
  assert.equal(vindDefinitie(defs, 3), defs[0]);
  assert.equal(vindDefinitie(defs, "nieuwe-organisatie"), defs[0]);
  assert.equal(vindDefinitie(defs, "initiatief-met-vormen"), defs[2]);
  assert.equal(vindDefinitie(defs, "21"), defs[1]);
});

test("onbekend, leeg of een getal als code: geen match", () => {
  assert.equal(vindDefinitie(defs, "bestaat-niet"), null);
  assert.equal(vindDefinitie(defs, ""), null);
  assert.equal(vindDefinitie(defs, null), null);
  assert.equal(pastBijSleutel({ id: 9, meta: { code: "12" } }, "12"), false); // getal = id
});

test("sleutelVan: code voor id", () => {
  assert.equal(sleutelVan(defs[0]), "nieuwe-organisatie");
  assert.equal(sleutelVan(defs[1]), "21");
  assert.equal(codeVan(defs[2]), "initiatief-met-vormen");
});

test("isGeldigeCode", () => {
  for (const c of ["", "aanmelding-initiatief", "voorbeeld-vormen-2", "fd3"]) assert.ok(isGeldigeCode(c), c);
  for (const c of ["12", "Hoofdletter", "met spatie", "-begin", "ü"]) assert.ok(!isGeldigeCode(c), c);
});
