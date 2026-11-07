import { test } from "node:test";
import assert from "node:assert/strict";
import { splitsLeesrichting, leesrichtingHoek, driehoekPunten } from "./leesrichting.js";

test("het leesrichtingsteken gaat van de tekst af", () => {
  assert.deepEqual(splitsLeesrichting("▶ label heen"), { richting: "heen", rest: "label heen" });
  assert.deepEqual(splitsLeesrichting("◀ label terug"), { richting: "terug", rest: "label terug" });
  assert.deepEqual(splitsLeesrichting("gewoon"), { richting: null, rest: "gewoon" });
});

test("de pijl wijst langs de lijn: horizontaal, verticaal, schuin; terug is andersom", () => {
  const links = { x: 0, y: 0 };
  assert.equal(leesrichtingHoek("heen", links, { x: 100, y: 0 }), 0);
  assert.equal(leesrichtingHoek("terug", links, { x: 100, y: 0 }), 180);
  // Bron onder, doel boven (Marks verticale voorbeeld): heen wijst omhoog.
  assert.equal(leesrichtingHoek("heen", { x: 0, y: 100 }, { x: 0, y: 0 }), -90);
  assert.equal(leesrichtingHoek("terug", { x: 0, y: 100 }, { x: 0, y: 0 }), 90);
  assert.equal(leesrichtingHoek("heen", links, { x: 100, y: 100 }), 45);
  // Hoekig: de dominante as.
  assert.equal(leesrichtingHoek("heen", links, { x: 100, y: 30 }, { hoekig: true }), 0);
  assert.equal(leesrichtingHoek("heen", links, { x: 30, y: -100 }, { hoekig: true }), -90);
});

test("de driehoek wijst naar zijn hoek", () => {
  assert.equal(driehoekPunten(0, 0, 10, 0), "5,0 -5,-4.25 -5,4.25");
  const [punt] = driehoekPunten(0, 0, 10, -90).split(" ");
  assert.equal(punt, "0,-5");
});
