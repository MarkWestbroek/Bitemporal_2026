// tekenBounds.test.js — het exportkader komt van wat er getekend staat.
// Run: node --import ./test/register-aliases.mjs --test src/diagramcore/export/tekenBounds.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { tekenBounds } from "./tekenBounds.js";
import { maakExportFilter } from "./exportFilter.js";

/** Minimaal DOM-dubbel: alleen wat tekenBounds/het filter aanraken. */
function el({ klassen = [], data = {}, rect, kinderen = [], tag = "div", overflow = "" }) {
  const zelf = {
    tagName: tag,
    style: { overflow },
    classList: { contains: (c) => klassen.includes(c) },
    getAttribute: (naam) => data[naam] ?? null,
    // Genoeg voor `.react-flow__edge` binnen een <svg>-wikkel.
    querySelector: (sel) => kinderen.find((k) => k.classList.contains(sel.replace(".", ""))) || null,
    children: kinderen,
    getBoundingClientRect: () =>
      rect ? { ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height } : { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 },
  };
  return zelf;
}

const OORSPRONG = { left: 100, top: 50 };

test("het kader volgt de tekening tot buiten de node-box", () => {
  // Een graaf-bol: kern van 92x92, met een satelliet-svg die er rondom
  // uitsteekt. Op de node-box alleen zou de satelliet zijn afgesneden.
  const satelliet = el({ tag: "circle", rect: { left: 150, top: 100, width: 38, height: 38 } });
  const bol = el({
    klassen: ["react-flow__node"],
    data: { "data-id": "n1" },
    rect: { left: 200, top: 150, width: 92, height: 92 },
    kinderen: [el({ tag: "svg", overflow: "visible", rect: { left: 144, top: 94, width: 204, height: 204 }, kinderen: [satelliet] })],
  });
  const b = tekenBounds({ wortels: [bol], oorsprong: OORSPRONG, zoom: 1 });
  // Van de satelliet linksboven (50,50) tot de rechteronderhoek van de kern.
  assert.deepEqual(b, { x: 50, y: 50, width: 142, height: 142 });
});

test("een overflow-visible tekenvlak telt zelf niet mee, zijn inhoud wel", () => {
  // Het satelliet-vlak van de bol is een vierkant van 204 rond de kern, maar de
  // bolletjes staan op een cirkelbaan en vullen de hoeken niet. Meten we het
  // vlak, dan krijgt de export een onnodig royale rand.
  const vlak = el({
    tag: "svg",
    overflow: "visible",
    rect: { left: 100, top: 100, width: 204, height: 204 },
    kinderen: [el({ tag: "circle", rect: { left: 130, top: 130, width: 40, height: 40 } })],
  });
  const b = tekenBounds({ wortels: [vlak], oorsprong: { left: 100, top: 100 }, zoom: 1 });
  assert.deepEqual(b, { x: 30, y: 30, width: 40, height: 40 });
});

test("een gewoon (overflow:hidden) tekenvlak is wél de grens", () => {
  const vlak = el({ tag: "svg", rect: { left: 100, top: 100, width: 60, height: 60 } });
  const b = tekenBounds({ wortels: [vlak], oorsprong: { left: 100, top: 100 }, zoom: 1 });
  assert.deepEqual(b, { x: 0, y: 0, width: 60, height: 60 });
});

test("defs en andere niet-getekende SVG-plumbing rekken het kader niet op", () => {
  const node = el({
    klassen: ["react-flow__node"],
    data: { "data-id": "n1" },
    rect: { left: 200, top: 150, width: 100, height: 50 },
    kinderen: [el({ tag: "defs", rect: { left: 0, top: 0, width: 500, height: 500 } })],
  });
  const b = tekenBounds({ wortels: [node], oorsprong: OORSPRONG, zoom: 1 });
  assert.deepEqual(b, { x: 100, y: 100, width: 100, height: 50 });
});

test("zoom rekent terug naar flow-eenheden", () => {
  const node = el({ klassen: ["react-flow__node"], data: { "data-id": "n1" }, rect: { left: 200, top: 150, width: 100, height: 50 } });
  const b = tekenBounds({ wortels: [node], oorsprong: OORSPRONG, zoom: 2 });
  assert.deepEqual(b, { x: 50, y: 50, width: 50, height: 25 });
});

test("chrome (handles, resize-blokjes) rekt het kader niet op", () => {
  const node = el({
    klassen: ["react-flow__node"],
    data: { "data-id": "n1" },
    rect: { left: 200, top: 150, width: 100, height: 50 },
    kinderen: [
      el({ klassen: ["react-flow__handle"], rect: { left: 190, top: 140, width: 6, height: 6 } }),
      el({ klassen: ["react-flow__resize-control"], rect: { left: 195, top: 145, width: 110, height: 60 } }),
    ],
  });
  const b = tekenBounds({ wortels: [node], oorsprong: OORSPRONG, zoom: 1, neemMee: maakExportFilter() });
  assert.deepEqual(b, { x: 100, y: 100, width: 100, height: 50 });
});

test("bij een selectie-export tellen alleen de geselecteerde elementen mee", () => {
  const binnen = el({ klassen: ["react-flow__node"], data: { "data-id": "n1" }, rect: { left: 200, top: 150, width: 100, height: 50 } });
  const buiten = el({ klassen: ["react-flow__node"], data: { "data-id": "n2" }, rect: { left: 600, top: 400, width: 100, height: 50 } });
  const lijn = el({ klassen: ["react-flow__edge"], data: { "data-id": "e1" }, rect: { left: 250, top: 120, width: 40, height: 40 } });
  const label = el({ data: { "data-edge-id": "e1" }, rect: { left: 240, top: 110, width: 30, height: 14 } });
  const labelBuiten = el({ data: { "data-edge-id": "e2" }, rect: { left: 900, top: 900, width: 30, height: 14 } });
  const neemMee = maakExportFilter({ beperkTot: { nodeIds: new Set(["n1"]), edgeIds: new Set(["e1"]) } });
  const b = tekenBounds({ wortels: [binnen, buiten, lijn, label, labelBuiten], oorsprong: OORSPRONG, zoom: 1, neemMee });
  // n1 (100,100..200,150) plus de lijn en zijn label die erboven uitsteken.
  assert.deepEqual(b, { x: 100, y: 60, width: 100, height: 90 });
});

test("een <svg>-wikkel om een lijn erft de beslissing van die lijn", () => {
  // html-to-image kloont <svg> in één keer diep: het filter komt nooit langs de
  // <g> erbinnen, dus de wikkel moet zelf al "nee" zeggen.
  const gBinnen = el({ tag: "g", klassen: ["react-flow__edge"], data: { "data-id": "e2" }, rect: { left: 600, top: 600, width: 40, height: 40 } });
  const wikkel = el({ tag: "svg", kinderen: [gBinnen], rect: { left: 0, top: 0, width: 2000, height: 2000 } });
  const neemMee = maakExportFilter({ beperkTot: { nodeIds: new Set(["n1"]), edgeIds: new Set(["e1"]) } });
  assert.equal(neemMee(wikkel), false);
  assert.equal(neemMee(gBinnen), false);
  const meeWikkel = maakExportFilter({ beperkTot: { nodeIds: new Set(["n1"]), edgeIds: new Set(["e1", "e2"]) } });
  assert.equal(meeWikkel(wikkel), true);
});

test("niets te meten geeft null (de aanroeper valt terug op het modelkader)", () => {
  assert.equal(tekenBounds({ wortels: [], oorsprong: OORSPRONG, zoom: 1 }), null);
});
