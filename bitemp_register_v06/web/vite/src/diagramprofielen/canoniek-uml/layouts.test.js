// Auto-layout in de Studio (18-10, Mark): de zes deterministische richtingen van de IDE als
// strategieën van het canonieke profiel. Zelfde invoer = zelfde posities; elke richting geeft een
// andere opstelling; generalisaties sturen de hiërarchische modus.
import { test } from "node:test";
import assert from "node:assert/strict";
import { canoniekUmlDiagramType as d } from "./index.js";

const knoop = (id, type) => ({ id, type, position: { x: 0, y: 0 }, measured: { width: 200, height: 100 }, data: {} });
const flowNodes = [knoop("ouder", "entiteit"), knoop("kind1", "entiteit"), knoop("kind2", "entiteit"), knoop("ge1", "gegevenselement")];
const flowEdges = [
  { id: "g1", source: "kind1", target: "ouder", data: { connectorId: "g1" } },
  { id: "g2", source: "kind2", target: "ouder", data: { connectorId: "g2" } },
  { id: "c1", source: "ouder", target: "ge1", data: { connectorId: "c1" } },
];
const elements = { g1: { elementType: "generalisatie" }, g2: { elementType: "generalisatie" }, c1: { elementType: "compositie" } };
const ronden = (m) => JSON.stringify([...(m instanceof Map ? m : new Map(Object.entries(m)))].map(([k, p]) => [k, Math.round(p.x), Math.round(p.y)]).sort());

test("zes strategieën met id, label en kort symbool; de eerste is van boven naar beneden", () => {
  assert.deepEqual(d.layouts.map((l) => l.id), ["gelaagd", "gelaagd-bt", "gelaagd-lr", "gelaagd-rl", "waaier", "hierarchisch"]);
  for (const l of d.layouts) assert.ok(l.label && l.kort && typeof l.run === "function", l.id);
});

test("deterministisch en per richting verschillend", () => {
  const uit = d.layouts.map((l) => ronden(l.run({ flowNodes, flowEdges, selectieIds: null, elements })));
  assert.deepEqual(d.layouts.map((l) => ronden(l.run({ flowNodes, flowEdges, selectieIds: null, elements }))), uit);
  assert.equal(new Set(uit).size, uit.length, "elke richting een eigen opstelling");
});

test("hiërarchisch: de ouder staat boven zijn kinderen (generalisatie uit de connector)", () => {
  const m = d.layouts.find((l) => l.id === "hierarchisch").run({ flowNodes, flowEdges, selectieIds: null, elements });
  const pos = m instanceof Map ? Object.fromEntries(m) : m;
  assert.ok(pos.ouder.y < pos.kind1.y && pos.ouder.y < pos.kind2.y, JSON.stringify(pos));
});
