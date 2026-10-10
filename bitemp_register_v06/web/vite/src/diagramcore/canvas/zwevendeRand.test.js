// zwevendeRand.test.js — het aanhechtpunt op de rand, en de terugval.
// Run: node --import ./test/register-aliases.mjs --test src/diagramcore/canvas/zwevendeRand.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { aanhechtpunt, middelpunt, nodeRechthoek, zwevendeUiteinden, richtpuntOfAanhechtpunt, orthogonaleUiteinden, naarOmtrek } from "./zwevendeRand.js";
import { besteZijde, aanhechtpuntenVan } from "./materialiseerConnectoren.js";
import { kortsteToppen, toppenVan } from "./zwevendeRand.js";

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

test("knikpunten sturen het uiteinde: richtpunt óp de rand wordt exact het uiteinde, op die zijde", () => {
  // Doos 200x100; een geïmporteerd aanhechtpunt op de bovenrand bij x=30
  // (schuin t.o.v. het middelpunt → aanhechtpunt zou 'left' kiezen).
  const s = richtpuntOfAanhechtpunt(DOOS, { x: 30, y: 0 });
  assert.deepEqual([s.x, s.y, s.zijde], [30, 0, "top"]);
  const t = richtpuntOfAanhechtpunt(DOOS, { x: 200, y: 90 });
  assert.deepEqual([t.x, t.y, t.zijde], [200, 90, "right"]);
  // Niet op de rand: gewoon het snijpunt richting dat punt (niet richting de andere doos).
  const doel = { x: 1000, y: 0, width: 200, height: 100 };
  const uit = zwevendeUiteinden({
    bronRect: DOOS, doelRect: doel, zwevendBron: true, zwevendDoel: true,
    vast: { sourceX: 0, sourceY: 0, targetX: 0, targetY: 0, sourcePosition: "right", targetPosition: "left" },
    bronRicht: { x: 100, y: 400 }, doelRicht: { x: 1100, y: 400 },
  });
  assert.equal(uit.sourcePosition, "bottom");
  assert.equal(uit.targetPosition, "bottom");
});

test("omtrek ruit en ellips: het snijpunt ligt op de vorm, niet op de rechthoek", () => {
  const ruit = { x: 0, y: 0, width: 28, height: 28 }; // middelpunt (14,14)
  const r = aanhechtpunt(ruit, { x: 200, y: 14 }, 8, "ruit");
  assert.deepEqual([Math.round(r.x), Math.round(r.y), r.zijde], [28, 14, "right"], "rechter punt van de ruit");
  const s45 = aanhechtpunt(ruit, { x: 100, y: 100 }, 8, "ruit");
  assert.ok(Math.abs(s45.x - 21) < 0.01 && Math.abs(s45.y - 21) < 0.01, "diagonaal: midden van de zijde");
  const el = { x: 0, y: 0, width: 100, height: 40 };
  const e = aanhechtpunt(el, { x: 50, y: 300 }, 8, "ellips");
  assert.deepEqual([Math.round(e.x), Math.round(e.y), e.zijde], [50, 40, "bottom"]);
  const e45 = aanhechtpunt(el, { x: 150, y: 120 }, 8, "ellips");
  // op de ellips: (x/50)² + (y/20)² = 1
  const nx = (e45.x - 50) / 50, ny = (e45.y - 20) / 20;
  assert.ok(Math.abs(nx * nx + ny * ny - 1) < 1e-9);
  // Richtpunt op de omhullende rechthoek van een ruit wordt op de ruit gezet.
  const rp = richtpuntOfAanhechtpunt(ruit, { x: 0, y: 14 }, 1.5, "ruit");
  assert.deepEqual([Math.round(rp.x), Math.round(rp.y)], [0, 14]);
});

test("orthogonaleUiteinden: boven elkaar → één verticale lijn midden in de x-overlap", () => {
  const u = orthogonaleUiteinden({ x: 0, y: 0, width: 200, height: 60 }, { x: 100, y: 200, width: 200, height: 60 });
  assert.deepEqual(u, { sourceX: 150, sourceY: 60, sourcePosition: "bottom", targetX: 150, targetY: 200, targetPosition: "top" });
});

test("orthogonaleUiteinden: naast elkaar → één horizontale lijn; diagonaal → één hoek", () => {
  const h = orthogonaleUiteinden({ x: 0, y: 0, width: 100, height: 100 }, { x: 300, y: 40, width: 100, height: 100 });
  assert.deepEqual(h, { sourceX: 100, sourceY: 70, sourcePosition: "right", targetX: 300, targetY: 70, targetPosition: "left" });
  const l = orthogonaleUiteinden({ x: 0, y: 0, width: 100, height: 100 }, { x: 400, y: 300, width: 100, height: 100 });
  assert.equal(l.sourcePosition, "right");
  assert.equal(l.targetPosition, "top");
  assert.deepEqual([l.sourceX, l.sourceY, l.targetX, l.targetY], [100, 50, 450, 300]);
});

test("zwevendeUiteinden met orthogonaal: alleen als beide kanten vrij zijn en er geen knikken zijn", () => {
  const bron = { x: 0, y: 0, width: 200, height: 60 }, doel = { x: 100, y: 200, width: 200, height: 60 };
  const vast = { sourceX: 1, sourceY: 1, targetX: 2, targetY: 2, sourcePosition: "left", targetPosition: "left" };
  const recht = zwevendeUiteinden({ bronRect: bron, doelRect: doel, zwevendBron: true, zwevendDoel: true, vast, orthogonaal: true });
  assert.equal(recht.sourceX, recht.targetX);
  const metKnik = zwevendeUiteinden({ bronRect: bron, doelRect: doel, zwevendBron: true, zwevendDoel: true, vast, orthogonaal: true, bronRicht: { x: 10, y: 100 }, doelRicht: { x: 10, y: 100 } });
  assert.notEqual(metKnik.sourceX, metKnik.targetX, "met knikken mikt elk uiteinde op zijn knik");
});

test("naarOmtrek: haaks naar binnen tot de cirkel of ruit; rechthoek blijft", () => {
  const r = { x: 0, y: 0, width: 40, height: 40 }; // middelpunt (20,20), straal 20
  assert.deepEqual(naarOmtrek(r, { x: 40, y: 20 }, "right", "rechthoek"), { x: 40, y: 20 });
  assert.deepEqual(naarOmtrek(r, { x: 40, y: 20 }, "right", "ellips"), { x: 40, y: 20 }, "op de as: de rand zelf");
  const p = naarOmtrek(r, { x: 40, y: 32 }, "right", "ellips");
  assert.equal(p.y, 32);
  assert.ok(Math.abs(p.x - (20 + 16)) < 1e-9, "12 onder het midden: x = 20 + sqrt(400-144)");
  const q = naarOmtrek(r, { x: 30, y: 0 }, "top", "ruit");
  assert.deepEqual(q, { x: 30, y: 10 }, "ruit: lineair naar binnen");
  assert.deepEqual(naarOmtrek(r, { x: 0, y: 99 }, "left", "ellips"), { x: 0, y: 20 }, "buiten bereik: midden van de zijde");
});

test("hoekig zonder knikken, event naar taak: rechte lijn ook met een ronde bron (BPMN, 10-10)", () => {
  const event = { x: 0, y: 30, width: 30, height: 30 }; // midden y=45
  const taak = { x: 100, y: 20, width: 110, height: 60 }; // y 20..80
  const u = zwevendeUiteinden({ bronRect: event, doelRect: taak, zwevendBron: true, zwevendDoel: true, vast: {}, orthogonaal: true, bronOmtrek: "ellips" });
  assert.equal(u.sourceY, u.targetY, "horizontaal");
  assert.equal(u.targetX, 100);
  const afstand = Math.hypot(u.sourceX - 15, u.sourceY - 45);
  assert.ok(Math.abs(afstand - 15) < 1e-6, "het beginpunt ligt op de cirkel");
});

// ── Toppen (ElementType.aanhechtpunten, 2026-10-10) ──────────────────────
const r = (x, y, width, height) => ({ x, y, width, height });
const VAST_T = { sourceX: 0, sourceY: 0, targetX: 0, targetY: 0, sourcePosition: "right", targetPosition: "left" };
const zijden = (u) => u && `${u.sourcePosition}->${u.targetPosition}`;

test("aanhechtpuntenVan: default uit de omtrek, expliciet wint", () => {
  assert.equal(aanhechtpuntenVan({ omtrek: "ellips" }), "toppen");
  assert.equal(aanhechtpuntenVan({ omtrek: "ruit" }), "toppen");
  assert.equal(aanhechtpuntenVan({}), "snijpunt");
  assert.equal(aanhechtpuntenVan({ omtrek: "ellips", aanhechtpunten: "snijpunt" }), "snijpunt");
  assert.equal(aanhechtpuntenVan(undefined), "snijpunt");
});

test("toppenVan: vier uiterste punten midden op de zijden", () => {
  assert.deepEqual(toppenVan(r(0, 0, 200, 100)).map((t) => [t.zijde, t.x, t.y]), [
    ["left", 0, 50], ["right", 200, 50], ["top", 100, 0], ["bottom", 100, 100],
  ]);
});

test("kortsteToppen: naast elkaar links/rechts, boven elkaar boven/onder (Marks use cases)", () => {
  // Bekijk voortgang (rechtsonder) -> Vraag product/dienst aan (linksboven).
  assert.equal(zijden(kortsteToppen({ bronRect: r(1104, 1116, 236, 76), doelRect: r(626, 1039, 236, 76), vast: VAST_T, bron: "toppen", doel: "toppen" })), "left->right");
  // Maak een afspraak recht boven Vraag product/dienst aan.
  assert.equal(zijden(kortsteToppen({ bronRect: r(628, 808, 236, 76), doelRect: r(626, 1039, 236, 76), vast: VAST_T, bron: "toppen", doel: "toppen" })), "bottom->top");
  // Actor (rechthoek, zwevend) links van een use case: naar de linkertop.
  assert.equal(kortsteToppen({ bronRect: r(340, 880, 40, 60), doelRect: r(844, 897, 186, 72), vast: VAST_T, bron: "zwevend", doel: "toppen" }).targetPosition, "left");
});

test("kortsteToppen: overlappende vormen -> null; zwevendeUiteinden zonder toppen ongewijzigd", () => {
  assert.equal(kortsteToppen({ bronRect: r(0, 0, 100, 50), doelRect: r(50, 20, 100, 50), vast: VAST_T, bron: "toppen", doel: "toppen" }), null);
  const zonder = zwevendeUiteinden({ bronRect: r(0, 0, 200, 100), doelRect: r(400, 300, 200, 100), zwevendBron: true, zwevendDoel: true, vast: VAST_T, bronOmtrek: "ellips", doelOmtrek: "ellips" });
  const met = zwevendeUiteinden({ bronRect: r(0, 0, 200, 100), doelRect: r(400, 300, 200, 100), zwevendBron: true, zwevendDoel: true, vast: VAST_T, bronOmtrek: "ellips", doelOmtrek: "ellips", bronToppen: true, doelToppen: true });
  assert.notDeepEqual(zonder, met);
  assert.ok(toppenVan(r(0, 0, 200, 100)).some((t) => t.x === met.sourceX && t.y === met.sourceY), "bron op een top");
});
