// verschuif.test.js — sequence: bericht verticaal verschuiven, horizontaal houden, eronder wegduwen.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/sequence/verschuif.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { verschuifBericht, AFSTAND } from "./verschuif.js";

// Twee levenslijnen (A op y 0, B op y 20) met drie berichten A→B op y 100, 140, 300.
function opzet() {
  const elements = { A: { id: "A", elementType: "levenslijn" }, B: { id: "B", elementType: "levenslijn" } };
  const nodes = [
    { elementId: "A", position: { x: 0, y: 0 } },
    { elementId: "B", position: { x: 200, y: 20 } },
  ];
  const bericht = (id, y, yDoel = y) => {
    elements[`${id}v`] = { id: `${id}v`, elementType: "punt", data: { randVan: "A" } };
    elements[`${id}n`] = { id: `${id}n`, elementType: "punt", data: { randVan: "B" } };
    elements[id] = { id, elementType: "synchroon", source: `${id}v`, target: `${id}n` };
    nodes.push({ elementId: `${id}v`, position: { x: 1, y } }, { elementId: `${id}n`, position: { x: 1, y: yDoel - 20 } });
  };
  bericht("m1", 100, 106); // doel staat 6px scheef
  bericht("m2", 140);
  bericht("m3", 300);
  return { elements, diagram: { nodes } };
}

test("omhoog: beide punten mee, lijn wordt horizontaal, niets anders verschuift", () => {
  const ctx = opzet();
  const uit = verschuifBericht(ctx.elements.m2, -30, ctx);
  assert.deepEqual(uit, { m2v: { x: 1, y: 110 }, m2n: { x: 1, y: 90 } }, "B ligt 20 lager: relatief 90 = absoluut 110");
});

test("een scheve lijn wordt bij verschuiven recht (doel op de hoogte van de bron)", () => {
  const ctx = opzet();
  const uit = verschuifBericht(ctx.elements.m1, -10, ctx);
  assert.equal(uit.m1v.y, 90);
  assert.equal(uit.m1n.y + 20, 90);
});

test("omlaag duwt wat eronder ligt weg, trapsgewijs, en laat verre berichten staan", () => {
  const ctx = opzet();
  const uit = verschuifBericht(ctx.elements.m1, 30, ctx); // m1 → 130; m2 (140) moet naar 130 + AFSTAND
  assert.equal(uit.m1v.y, 130);
  assert.equal(uit.m2v.y, 130 + AFSTAND);
  assert.equal(uit.m2n.y + 20, 130 + AFSTAND);
  assert.equal(uit.m3v, undefined, "m3 ligt ver genoeg weg");
  const ver = verschuifBericht(ctx.elements.m1, 190, ctx); // m1 → 290: m2 → 322, m3 → 354
  assert.equal(ver.m2v.y, 290 + AFSTAND);
  assert.equal(ver.m3v.y, 290 + 2 * AFSTAND);
});

test("een notitie aan een punt schuift mee met dat punt (ook bij wegduwen)", () => {
  const ctx = opzet();
  ctx.elements.n = { id: "n", elementType: "notitie", data: { tekst: "Via event?" } };
  ctx.elements.nl = { id: "nl", elementType: "notitielijn", source: "n", target: "m2n" };
  ctx.diagram.nodes.push({ elementId: "n", position: { x: 400, y: 60 } });
  assert.deepEqual(verschuifBericht(ctx.elements.m2, -30, ctx).n, { x: 400, y: 30 }, "met het bericht mee");
  assert.deepEqual(verschuifBericht(ctx.elements.m1, 30, ctx).n, { x: 400, y: 60 + (130 + AFSTAND - 140) }, "m2 weggeduwd → notitie mee");
  assert.equal(verschuifBericht(ctx.elements.m3, 10, ctx).n, undefined, "ander bericht: notitie blijft");
});

test("zelf-bericht (twee punten op één lijn) houdt zijn haakje; niets te doen", () => {
  const ctx = opzet();
  ctx.elements.zn = { id: "zn", elementType: "punt", data: { randVan: "A" } };
  ctx.diagram.nodes.push({ elementId: "zn", position: { x: 1, y: 315 } });
  ctx.elements.z = { id: "z", elementType: "synchroon", source: "m3v", target: "zn" };
  const uit = verschuifBericht(ctx.elements.z, 10, ctx);
  assert.deepEqual([uit.m3v.y, uit.zn.y], [310, 325]);
  assert.deepEqual(verschuifBericht(ctx.elements.m1, 0, ctx), {});
  assert.deepEqual(verschuifBericht({ id: "onbekend" }, 10, ctx), {});
});
