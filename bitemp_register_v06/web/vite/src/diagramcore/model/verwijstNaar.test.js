// verwijstNaar.test.js — de vaste M3-doorklik naar een diagram (ook in een ander profiel).
// Run: node --import ./test/register-aliases.mjs --test src/diagramcore/model/verwijstNaar.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { VERWIJST_NAAR, heeftVerwijstNaar, metVerwijstNaar, normaliseerVerwijzing, doorklikVan } from "./verwijstNaar.js";

const gedrag = { key: "gedragDiagramId", datatype: "diagram-verwijzing", betekenis: "verwijzing" };

test("op knopen wel; niet op connectoren, notities of waar het type hem uitzet", () => {
  assert.equal(heeftVerwijstNaar({ shape: "class-box" }), true);
  assert.equal(heeftVerwijstNaar({ isConnector: true }), false);
  assert.equal(heeftVerwijstNaar({ shape: "note" }), false);
  assert.equal(heeftVerwijstNaar({ verwijstNaar: false }), false);
  assert.equal(heeftVerwijstNaar(null), false);
});

test("de motor zet hem achteraan, behalve als het profiel een eigen verwijzing heeft", () => {
  assert.deepEqual(metVerwijstNaar([{ key: "kleur" }], { shape: "class-box" }).map((p) => p.key), ["kleur", "verwijstNaar"]);
  const eigen = [gedrag];
  assert.equal(metVerwijstNaar(eigen, {}), eigen, "gedragsverwijzing ís de doorklik");
  assert.deepEqual(metVerwijstNaar([], { isConnector: true }), []);
  assert.equal(VERWIJST_NAAR.betekenis, "verwijzing");
});

test("waarde: object over profielen heen; een kale string is het eigen profiel", () => {
  assert.deepEqual(normaliseerVerwijzing("d1", "uml"), { profielId: "uml", diagramId: "d1" });
  assert.deepEqual(normaliseerVerwijzing({ profielId: "archimate05", diagramId: "d2" }, "uml"), { profielId: "archimate05", diagramId: "d2" });
  assert.deepEqual(normaliseerVerwijzing({ diagramId: "d3" }, "uml"), { profielId: "uml", diagramId: "d3" });
  assert.equal(normaliseerVerwijzing(null), null);
  assert.equal(normaliseerVerwijzing({ profielId: "x" }), null);
});

test("doorklik: eerst de gedragsverwijzing, anders de vaste verwijstNaar", () => {
  const aanroep = { properties: [gedrag] };
  assert.deepEqual(doorklikVan({ data: { gedragDiagramId: "ad1", verwijstNaar: { profielId: "p", diagramId: "x" } } }, aanroep, "activity05"), { profielId: "activity05", diagramId: "ad1" });
  const comp = { shape: "archimate-box", properties: [] };
  assert.deepEqual(doorklikVan({ data: { verwijstNaar: { profielId: "archimate05", diagramId: "studio" } } }, comp), { profielId: "archimate05", diagramId: "studio" });
  assert.equal(doorklikVan({ data: {} }, comp), null);
  assert.equal(doorklikVan({ data: { verwijstNaar: { diagramId: "x" } } }, { isConnector: true }), null, "connector: geen doorklik");
});
