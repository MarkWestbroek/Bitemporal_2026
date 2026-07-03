// uitlijnen.test.js — pure geometrie-tests voor de core-layoutfuncties.
// Run: npm test  (vanuit web/vite/; node --test)

import test from "node:test";
import assert from "node:assert/strict";

import { berekenUitlijning, berekenRasterSnap, UITLIJN_MODES } from "./uitlijnen.js";

const items = [
  { id: "a", x: 10, y: 20, width: 100, height: 50 },
  { id: "b", x: 50, y: 80, width: 200, height: 60 },
  { id: "c", x: 30, y: 200, width: 100, height: 40 },
];

test("left/right/top/bottom lijnen uit op de uiterste rand", () => {
  const links = berekenUitlijning("left", items);
  assert.equal(links.b.x, 10);
  assert.equal(links.c.x, 10);
  assert.equal(links.a, undefined, "a stond al links → geen wijziging");

  const rechts = berekenUitlijning("right", items);
  assert.equal(rechts.a.x, 150); // maxRand 250 - breedte 100
  assert.equal(rechts.b, undefined, "b bepaalt de rechterrand");

  const boven = berekenUitlijning("top", items);
  assert.equal(boven.b.y, 20);
  const onder = berekenUitlijning("bottom", items);
  assert.equal(onder.a.y, 190); // maxOnder 240 - hoogte 50
});

test("center-h centreert op het gemiddelde middelpunt", () => {
  const twee = [
    { id: "a", x: 0, y: 0, width: 100, height: 50 },
    { id: "b", x: 200, y: 100, width: 100, height: 50 },
  ];
  const res = berekenUitlijning("center-h", twee);
  // middelpunten 50 en 250 → gemiddelde 150 → beide naar x=100
  assert.equal(res.a.x, 100);
  assert.equal(res.b.x, 100);
});

test("distribute-h verdeelt gelijkmatig tussen eerste en laatste", () => {
  const drie = [
    { id: "a", x: 0, y: 0, width: 10, height: 10 },
    { id: "b", x: 10, y: 0, width: 10, height: 10 },
    { id: "c", x: 100, y: 0, width: 10, height: 10 },
  ];
  const res = berekenUitlijning("distribute-h", drie);
  assert.equal(res.b.x, 50);
  assert.equal(res.a, undefined);
  assert.equal(res.c, undefined);
});

test("minder dan 2 items → geen wijzigingen; alle modes bestaan", () => {
  assert.deepEqual(berekenUitlijning("left", [items[0]]), {});
  for (const m of UITLIJN_MODES) {
    assert.ok(typeof m.mode === "string" && m.titel, `mode ${m.mode} compleet`);
  }
});

test("berekenRasterSnap rondt af op het raster en meldt alleen wijzigingen", () => {
  const res = berekenRasterSnap(
    [
      { id: "a", x: 17, y: 30, width: 10, height: 10 },
      { id: "b", x: 32, y: 64, width: 10, height: 10 },
    ],
    16
  );
  assert.deepEqual(res.a, { x: 16, y: 32 });
  assert.equal(res.b, undefined, "b stond al op het raster");
});
