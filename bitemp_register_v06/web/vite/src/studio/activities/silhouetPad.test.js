import { test } from "node:test";
import assert from "node:assert/strict";
import { polygonNaarPunten, puntenNaarPad } from "./silhouetPad.js";

test("polygonNaarPunten ontleedt percentages", () => {
  const pts = polygonNaarPunten("polygon(50% 0%, 100% 100%, 0% 100%)");
  assert.deepEqual(pts, [
    { x: 50, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]);
  assert.deepEqual(polygonNaarPunten(""), []);
  assert.deepEqual(polygonNaarPunten(undefined), []);
});

test("puntenNaarPad: leeg bij < 3 punten", () => {
  assert.equal(puntenNaarPad([]), "");
  assert.equal(puntenNaarPad([{ x: 0, y: 0 }, { x: 10, y: 10 }]), "");
});

test("puntenNaarPad: alleen hoekpunten → rechte segmenten (controls == eindpunten)", () => {
  const d = puntenNaarPad([
    { x: 50, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]);
  assert.ok(d.startsWith("M 50 0"));
  assert.ok(d.endsWith(" Z"));
  // recht segment: eerste C heeft controls gelijk aan de twee eindpunten
  // M 50 0 C 50 0 100 100 100 100 ...
  assert.ok(d.includes("C 50 0 100 100 100 100"), d);
});

test("puntenNaarPad: een rond punt introduceert een echte kromme (controls ≠ eindpunt)", () => {
  const hoekig = puntenNaarPad([
    { x: 50, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]);
  const metRonde = puntenNaarPad([
    { x: 50, y: 0, r: true },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]);
  assert.notEqual(hoekig, metRonde);
  // Voor het ronde punt (index 0) wijkt de uitgaande control af van (50,0):
  // out = P0 + (P1 - P_last) * 0.18 = (50 + (100-0)*0.18, 0 + (100-100)*0.18) = (68, 0)
  assert.ok(metRonde.includes("C 68 0"), metRonde);
});
