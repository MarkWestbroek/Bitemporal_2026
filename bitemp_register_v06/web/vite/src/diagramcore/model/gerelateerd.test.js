// gerelateerd.test.js — "Gerelateerde elementen toevoegen" (Mark, 07-11).
import test from "node:test";
import assert from "node:assert/strict";

import { gerelateerdeElementen } from "./gerelateerd.js";

const types = {
  entiteit: { label: "Entiteit" },
  gegevenselement: { label: "Gegevenselement" },
  relatie: { label: "Relatie", isConnector: true },
  compositie: { label: "Compositie", isConnector: true },
};
const el = (id, elementType, extra = {}) => ({ id, naam: id, elementType, ...extra });
// NP —Woonlocatie→ Loc, NP —Bereikbaarheid→ Loc, Loc —Ligt in→ Gemeente; GE Naam ◆ NP.
const elements = {
  NP: el("NP", "entiteit"),
  Loc: el("Loc", "entiteit"),
  Gem: el("Gem", "entiteit"),
  Naam: el("Naam", "gegevenselement"),
  woon: el("woon", "relatie", { source: "NP", target: "Loc" }),
  bereik: el("bereik", "relatie", { source: "NP", target: "Loc" }),
  ligt: el("ligt", "relatie", { source: "Loc", target: "Gem" }),
  comp: el("comp", "compositie", { source: "Naam", target: "NP" }),
};

const ids = (lijst) => lijst.map((k) => `${k.id}@${k.niveau}`);

test("niveau 1: alle direct verbonden elementen, elk soort verbinding; geen verbindingen zelf", () => {
  const r = gerelateerdeElementen({ startIds: ["NP"], elements, opDiagram: new Set(["NP"]), elementTypesById: types, diepte: 1 });
  assert.deepEqual(ids(r), ["Loc@1", "Naam@1"]);
  assert.equal(r.find((k) => k.id === "Naam").via.typeLabel, "Compositie");
});

test("diepte 2 en oneindig lopen door; wat al op het diagram staat telt mee maar komt niet in de lijst", () => {
  const twee = gerelateerdeElementen({ startIds: ["NP"], elements, opDiagram: new Set(["NP", "Loc"]), elementTypesById: types, diepte: 2 });
  assert.deepEqual(ids(twee), ["Naam@1", "Gem@2"]);
  const alles = gerelateerdeElementen({ startIds: ["NP"], elements, opDiagram: new Set(["NP"]), elementTypesById: types, diepte: Infinity });
  assert.deepEqual(ids(alles), ["Loc@1", "Naam@1", "Gem@2"]);
});

test("een relatie als startpunt (associatieklasse-box) expandeert naar haar uiteinden", () => {
  const r = gerelateerdeElementen({ startIds: ["bereik"], elements, opDiagram: new Set(["bereik", "Loc"]), elementTypesById: types, diepte: 1 });
  assert.deepEqual(ids(r), ["NP@1"]);
});

test("vrijePosities: rechts van het anker, per niveau een kolom, naar beneden, nooit boven het anker en niet over een bestaand element", async () => {
  const { vrijePosities } = await import("./gerelateerd.js");
  const anker = { x: 100, y: 200, width: 120 };
  const bezet = [{ x: 100, y: 200, width: 120, height: 80 }, { x: 330, y: 340, width: 160, height: 80 }]; // het anker en een buur rechtsonder
  const pos = vrijePosities(anker, [{ id: "a", niveau: 1 }, { id: "b", niveau: 1 }, { id: "c", niveau: 2 }], bezet);
  assert.ok(Object.values(pos).every((p) => p.y >= anker.y), "niets boven het anker");
  assert.ok(Object.values(pos).every((p) => p.x > anker.x + anker.width), "rechts van het anker");
  assert.equal(pos.a.x, pos.b.x, "één kolom per niveau");
  assert.ok(pos.c.x > pos.a.x);
  const raakt = (p, b) => p.x < b.x + b.width && b.x < p.x + 180 && p.y < b.y + b.height && b.y < p.y + 90;
  assert.ok(!Object.values(pos).some((p) => bezet.some((b) => raakt(p, b))), "niet over een bestaand element");
  assert.ok(pos.b.y > pos.a.y);
});
