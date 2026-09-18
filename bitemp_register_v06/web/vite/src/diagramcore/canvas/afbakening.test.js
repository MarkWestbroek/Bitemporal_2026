// afbakening.test.js — het primitief "afbakening" (backlog §31.4).
// Run: npm test  (vanuit web/vite/; node --test)

import test from "node:test";
import assert from "node:assert/strict";

import { afbakeningVan, toetsAfbakening, weigeringTekst } from "./afbakening.js";
import { containerVanElementen } from "./nesting.js";
import { vindConnectorTypes, vindConnectorType, geweigerdDoorAfbakening } from "./materialiseerConnectoren.js";

const FLOW = ["taak", "boundary"];
const diagramType = {
  id: "mini-bpmn",
  elementTypes: [
    { id: "pool", label: "Pool", containerVoor: "bevat", afbakeningVoor: ["sequence"] },
    { id: "lane", label: "Lane", containerVoor: "bevat" },
    { id: "taak", label: "Task" },
    { id: "boundary", label: "Boundary", randElement: { ouderTypes: ["taak"] } },
    { id: "sequence", label: "Sequence flow", isConnector: true, bron: { elementTypes: FLOW }, doel: { elementTypes: FLOW } },
    {
      id: "message",
      label: "Message flow",
      isConnector: true,
      overbrugt: ["pool"],
      bron: { elementTypes: [...FLOW, "pool"] },
      doel: { elementTypes: [...FLOW, "pool"] },
    },
    { id: "bevat", label: "Lidmaatschap", isConnector: true, bron: { elementTypes: ["pool", "lane"] }, doel: { elementTypes: ["lane", "taak"] } },
  ],
};
const elementTypesById = Object.fromEntries(diagramType.elementTypes.map((et) => [et.id, et]));
const el = (id, elementType, extra = {}) => ({ id, elementType, ...extra });
const bevat = (id, source, target) => el(id, "bevat", { source, target });

// Pool A: lane LA met taak A1 (+ boundary BA op A1) en taak A2 direct in de pool.
// Pool B: taak B1. Los: taak X en taak Y (impliciete deelnemer).
const elements = Object.fromEntries(
  [
    el("PA", "pool"), el("PB", "pool"), el("LA", "lane"),
    el("A1", "taak"), el("A2", "taak"), el("B1", "taak"), el("X", "taak"), el("Y", "taak"),
    el("BA", "boundary", { data: { randVan: "A1" } }),
    bevat("m1", "PA", "LA"), bevat("m2", "LA", "A1"), bevat("m3", "PA", "A2"), bevat("m4", "PB", "B1"),
  ].map((e) => [e.id, e])
);
const ouders = containerVanElementen(elements, elementTypesById);

test("afbakeningVan: dichtstbijzijnde voorouder van het type, ook via lane en gastheer", () => {
  assert.equal(afbakeningVan(elements.A1, ["pool"], elements, ouders), "PA", "taak → lane → pool");
  assert.equal(afbakeningVan(elements.A2, ["pool"], elements, ouders), "PA");
  assert.equal(afbakeningVan(elements.BA, ["pool"], elements, ouders), "PA", "rand-element via zijn gastheer");
  assert.equal(afbakeningVan(elements.PB, ["pool"], elements, ouders), "PB", "een pool is zijn eigen afbakening");
  assert.equal(afbakeningVan(elements.X, ["pool"], elements, ouders), null, "impliciete deelnemer");
});

test("afbakeningVoor: de verbinding blijft binnen dezelfde afbakening", () => {
  const seq = elementTypesById.sequence;
  assert.equal(toetsAfbakening(diagramType, seq, elements.A1, elements.A2, elements), null, "door een lane heen mag");
  assert.equal(toetsAfbakening(diagramType, seq, elements.X, elements.Y, elements), null, "beide zonder pool mag");
  assert.equal(toetsAfbakening(diagramType, seq, elements.A1, elements.B1, elements)?.reden, "kruist");
  assert.equal(toetsAfbakening(diagramType, seq, elements.A1, elements.X, elements)?.reden, "kruist", "pool ↔ geen pool");
  assert.equal(toetsAfbakening(diagramType, seq, elements.BA, elements.A2, elements), null, "boundary telt bij zijn taak");
});

test("overbrugt: de verbinding móet de grens kruisen", () => {
  const msg = elementTypesById.message;
  assert.equal(toetsAfbakening(diagramType, msg, elements.A1, elements.B1, elements), null);
  assert.equal(toetsAfbakening(diagramType, msg, elements.A1, elements.PB, elements), null, "naar een black-box pool");
  assert.equal(toetsAfbakening(diagramType, msg, elements.A1, elements.X, elements), null, "pool ↔ impliciete deelnemer");
  assert.equal(toetsAfbakening(diagramType, msg, elements.A1, elements.A2, elements)?.reden, "overbrugt-niet");
  assert.equal(toetsAfbakening(diagramType, msg, elements.X, elements.Y, elements)?.reden, "overbrugt-niet", "zelfde impliciete deelnemer");
});

test("vindConnectorTypes: met elements telt de afbakening mee, zonder niet", () => {
  const ids = (l) => l.map((ct) => ct.id);
  assert.deepEqual(ids(vindConnectorTypes(diagramType, elements.A1, elements.B1)), ["sequence", "message"], "zonder elements: alleen typeregels");
  assert.deepEqual(ids(vindConnectorTypes(diagramType, elements.A1, elements.B1, elements)), ["message"]);
  assert.deepEqual(ids(vindConnectorTypes(diagramType, elements.A1, elements.A2, elements)), ["sequence"]);
  assert.equal(vindConnectorType(diagramType, elements.A1, elements.B1, "sequence", elements), null);
  assert.equal(vindConnectorType(diagramType, elements.A1, elements.B1, null, elements).id, "message");
});

test("geweigerdDoorAfbakening geeft de reden, weigeringTekst maakt hem leesbaar", () => {
  const g = geweigerdDoorAfbakening(diagramType, elements.A1, elements.B1, elements);
  assert.deepEqual(g.map((x) => x.connectorType.id), ["sequence"]);
  assert.match(weigeringTekst(g[0].connectorType, g[0].weigering), /Sequence flow mag de grens van een Pool niet kruisen/);
  const h = geweigerdDoorAfbakening(diagramType, elements.A1, elements.A2, elements);
  assert.match(weigeringTekst(h[0].connectorType, h[0].weigering), /Message flow verbindt verschillende Pools/);
});

test("een nog-niet-bestaand element krijgt zijn plek via een eigen containerVan", () => {
  const nieuw = { id: "__nieuw", elementType: "taak" };
  const metPlek = new Map(ouders).set("__nieuw", "LA");
  assert.deepEqual(vindConnectorTypes(diagramType, elements.A1, nieuw, elements, metPlek).map((c) => c.id), ["sequence"]);
  assert.deepEqual(vindConnectorTypes(diagramType, elements.A1, nieuw, elements, new Map(ouders)).map((c) => c.id), ["message"]);
});
