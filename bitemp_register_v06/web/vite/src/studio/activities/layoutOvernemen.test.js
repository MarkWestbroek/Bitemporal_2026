// layoutOvernemen.test.js — een diagram schikken zoals een voorbeeld in een andere taal.
// Run: node --import ./test/register-aliases.mjs --test src/studio/activities/layoutOvernemen.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { layoutOvernemen, maakPartnersVan, naamSleutel } from "./layoutOvernemen.js";

const overlapt = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("naamSleutel vergelijkt over talen heen", () => {
  assert.equal(naamSleutel("odrl:PolicyShape"), "policy");
  assert.equal(naamSleutel("Policy"), "policy");
  assert.equal(naamSleutel("<http://x/y#LeftOperand>"), "leftoperand");
});

test("posities van de partners, geschaald naar de grotere dozen, zonder overlap", () => {
  const voorbeeld = new Map([
    ["c::P", { x: 0, y: 0, w: 200, h: 100, naam: "Policy" }],
    ["c::R", { x: 0, y: 200, w: 200, h: 100, naam: "Rule" }],
    ["c::A", { x: 300, y: 0, w: 200, h: 100, naam: "Asset" }],
  ]);
  const links = [
    { rij: { profielId: "s", elementId: "ps" }, kolom: { profielId: "c", elementId: "P" } },
    { rij: { profielId: "s", elementId: "rs" }, kolom: { profielId: "c", elementId: "R" } },
  ];
  const doelNodes = [
    { id: "ps", naam: "Policy", x: 500, y: 500, w: 340, h: 200 },
    { id: "rs", naam: "Rule", x: 0, y: 0, w: 340, h: 150 },
    { id: "as", naam: "Asset", x: 900, y: 100, w: 340, h: 120 }, // zonder link: op naam
    { id: "graaf", naam: "Shapes graph", x: 0, y: 0, w: 260, h: 60 }, // zonder partner
  ];
  const uit = layoutOvernemen({ voorbeeld, doelNodes, partnersVan: maakPartnersVan(links, "s", voorbeeld) });
  assert.equal(uit.overgenomen, 3);
  assert.deepEqual(uit.los, ["graaf"]);
  assert.equal(uit.schaal.x, 1.7);
  const p = (id) => ({ ...uit.posities.get(id), ...doelNodes.find((n) => n.id === id) && { w: doelNodes.find((n) => n.id === id).w, h: doelNodes.find((n) => n.id === id).h } });
  // De ordening blijft: Rule onder Policy, Asset rechts ervan; de graaf erboven.
  assert.ok(p("rs").y > p("ps").y);
  assert.ok(p("as").x > p("ps").x);
  assert.ok(p("graaf").y < p("ps").y);
  const alle = ["ps", "rs", "as", "graaf"].map(p);
  for (let i = 0; i < alle.length; i++) for (let j = i + 1; j < alle.length; j++) assert.ok(!overlapt(alle[i], alle[j]), `${i} en ${j} overlappen`);
});

test("bij meer partners wint die met dezelfde naam; vaste schaal kan ook", () => {
  const voorbeeld = new Map([
    ["c::Perm", { x: 0, y: 300, w: 200, h: 100, naam: "Permission" }],
    ["c::Rule", { x: 0, y: 0, w: 200, h: 100, naam: "Rule" }],
  ]);
  const links = ["Perm", "Rule"].map((k) => ({ rij: { profielId: "s", elementId: "RuleShape" }, kolom: { profielId: "c", elementId: k } }));
  const uit = layoutOvernemen({ voorbeeld, doelNodes: [{ id: "RuleShape", naam: "Rule", x: 50, y: 50, w: 300, h: 100 }], partnersVan: maakPartnersVan(links, "s", voorbeeld), schaal: 2 });
  assert.deepEqual(uit.posities.get("RuleShape"), { x: 50, y: 50 });
  assert.deepEqual(uit.schaal, { x: 2, y: 2 });
});
