// gerelateerd.test.js — "Gerelateerde elementen toevoegen" (Mark, 07-11).
import test from "node:test";
import assert from "node:assert/strict";

import { gerelateerdeElementen, ringPosities } from "./gerelateerd.js";

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

test("ringPosities: één ring per niveau, niets op dezelfde plek", () => {
  const pos = ringPosities({ x: 0, y: 0 }, [{ id: "a", niveau: 1 }, { id: "b", niveau: 1 }, { id: "c", niveau: 2 }]);
  const plekken = new Set(Object.values(pos).map((p) => `${p.x},${p.y}`));
  assert.equal(plekken.size, 3);
  const afstand = (p) => Math.hypot(p.x, p.y);
  assert.ok(afstand(pos.c) > afstand(pos.a) + 300);
});
