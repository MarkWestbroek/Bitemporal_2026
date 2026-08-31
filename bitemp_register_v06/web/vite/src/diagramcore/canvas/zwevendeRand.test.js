// zwevendeRand.test.js — het aanhechtpunt op de rand, en de terugval.
// Run: node --import ./test/register-aliases.mjs --test src/diagramcore/canvas/zwevendeRand.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { aanhechtpunt, middelpunt, nodeRechthoek, zwevendeUiteinden } from "./zwevendeRand.js";
import { besteZijde } from "./materialiseerConnectoren.js";

// Een doos van 200x100 met middelpunt (100, 50).
const DOOS = { x: 0, y: 0, width: 200, height: 100 };

test("recht naar rechts hecht midden op de rechterzijde", () => {
  const s = aanhechtpunt(DOOS, { x: 500, y: 50 });
  assert.deepEqual([s.x, s.y, s.zijde], [200, 50, "right"]);
});

test("recht omhoog hecht midden op de bovenzijde", () => {
  const s = aanhechtpunt(DOOS, { x: 100, y: -300 });
  assert.deepEqual([s.x, s.y, s.zijde], [100, 0, "top"]);
});

test("de zijde is exact wat besteZijde zou kiezen", () => {
  // Dít is de afspraak: zwevend verandert nooit de zijde, alleen de plek erop.
  // Zou dat wél verschillen, dan gaan bestaande diagrammen er anders uitzien
  // dan de gebruiker ze heeft neergelegd.
  const c = middelpunt(DOOS);
  for (const doel of [
    { x: 500, y: 60 }, { x: -400, y: 20 }, { x: 120, y: 900 },
    { x: 80, y: -700 }, { x: 300, y: 250 }, { x: -50, y: -60 },
  ]) {
    assert.equal(aanhechtpunt(DOOS, doel).zijde, besteZijde(c, doel), JSON.stringify(doel));
  }
});

test("buren aan dezelfde zijde waaieren uit over die zijde", () => {
  // De hele reden voor zwevende aanhechting: met vier handles zouden beide
  // lijnen door hetzelfde punt (200, 50) knijpen.
  const boven = aanhechtpunt(DOOS, { x: 600, y: -200 });
  const onder = aanhechtpunt(DOOS, { x: 600, y: 300 });
  assert.equal(boven.zijde, "right");
  assert.equal(onder.zijde, "right");
  assert.equal(boven.x, onder.x); // zelfde zijde
  assert.notEqual(boven.y, onder.y); // andere plek erop
  assert.ok(boven.y < onder.y);
});

test("het punt blijft binnen de zijde, met marge tot de hoeken", () => {
  // Een buur ver naar boven zou zonder klem ver bóven de node aanhechten.
  const s = aanhechtpunt(DOOS, { x: 210, y: -5000 });
  assert.equal(s.zijde, "top"); // dy domineert nu
  const ver = aanhechtpunt(DOOS, { x: 5000, y: -3000 });
  assert.equal(ver.zijde, "right");
  assert.ok(ver.y >= 8 && ver.y <= 92, `y=${ver.y} moet binnen de zijde blijven`);
});

test("marge krimpt mee op een kleine node", () => {
  const punt = { x: 0, y: 0, width: 16, height: 16 };
  const s = aanhechtpunt(punt, { x: 900, y: -900 });
  assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y));
  assert.ok(s.y >= 0 && s.y <= 16);
});

test("doel op het middelpunt levert een geldig punt, geen NaN", () => {
  const s = aanhechtpunt(DOOS, middelpunt(DOOS));
  assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y));
});

test("nodeRechthoek geeft null zolang de node niet gemeten is", () => {
  assert.equal(nodeRechthoek(undefined), null);
  assert.equal(nodeRechthoek({ internals: { positionAbsolute: { x: 1, y: 2 } } }), null);
  assert.deepEqual(
    nodeRechthoek({ internals: { positionAbsolute: { x: 1, y: 2 } }, measured: { width: 10, height: 20 } }),
    { x: 1, y: 2, width: 10, height: 20 }
  );
});

const VAST = {
  sourceX: 1, sourceY: 2, targetX: 3, targetY: 4,
  sourcePosition: "right", targetPosition: "left",
};

test("zonder zwevende kant blijven de handle-coordinaten staan", () => {
  const uit = zwevendeUiteinden({
    bronRect: DOOS, doelRect: DOOS, zwevendBron: false, zwevendDoel: false, vast: VAST,
  });
  assert.deepEqual(uit, VAST);
});

test("ongemeten node valt terug op de handle-coordinaten", () => {
  const uit = zwevendeUiteinden({
    bronRect: null, doelRect: DOOS, zwevendBron: true, zwevendDoel: true, vast: VAST,
  });
  assert.deepEqual(uit, VAST);
});

test("een kant kan zweven terwijl de andere op zijn handle blijft", () => {
  // Precies het geval "gebruiker heeft aan de doelkant zelf een handle gekozen".
  const doel = { x: 500, y: 0, width: 200, height: 100 };
  const uit = zwevendeUiteinden({
    bronRect: DOOS, doelRect: doel, zwevendBron: true, zwevendDoel: false, vast: VAST,
  });
  assert.deepEqual([uit.sourceX, uit.sourceY, uit.sourcePosition], [200, 50, "right"]);
  assert.deepEqual([uit.targetX, uit.targetY, uit.targetPosition], [3, 4, "left"]);
});

test("beide kanten zwevend: de lijn loopt van omtrek naar omtrek", () => {
  const doel = { x: 500, y: 0, width: 200, height: 100 };
  const uit = zwevendeUiteinden({
    bronRect: DOOS, doelRect: doel, zwevendBron: true, zwevendDoel: true, vast: VAST,
  });
  assert.deepEqual([uit.sourceX, uit.sourceY, uit.sourcePosition], [200, 50, "right"]);
  assert.deepEqual([uit.targetX, uit.targetY, uit.targetPosition], [500, 50, "left"]);
});
