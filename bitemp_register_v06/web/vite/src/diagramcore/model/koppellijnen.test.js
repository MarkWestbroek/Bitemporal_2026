import { test } from "node:test";
import assert from "node:assert/strict";
import { metKoppelingen, canvasIdVan, refVanCanvasId, isKoppelingId, linkIdVan, KOPPEL_TYPE_PREFIX, ANDERE_SOORT_TYPE } from "./koppellijnen.js";
import { vindConnectorTypes } from "../canvas/materialiseerConnectoren.js";
import { ontleedVreemdeId } from "./vreemd.js";

const SOORTEN = [
  { soort: "komt voort uit", stijl: "afhankelijk" },
  { soort: "realiseert", stijl: "realisatie" },
];
const descriptor = { elementTypes: [{ id: "entiteit" }, { id: "archi::app" }, { id: "rel", isConnector: true }] };
const elements = {
  np: { id: "np", elementType: "entiteit" },
  loc: { id: "loc", elementType: "entiteit" },
  "archi::a": { id: "archi::a", elementType: "archi::app", data: { vreemd: { profielId: "archi", elementId: "a" } } },
};
const diagram = { nodes: [{ elementId: "np" }, { elementId: "loc" }, { elementId: "archi::a" }] };
const link = (id, rij, kolom, soort = "realiseert", omgekeerd = false) => ({ id, rij, kolom, soort, omgekeerd });

test("canvas-id en ref zijn elkaars omgekeerde; een koppeling-id is geen verwijzing", () => {
  assert.equal(canvasIdVan({ profielId: "uml", elementId: "np" }, "uml"), "np");
  assert.equal(canvasIdVan({ profielId: "archi", elementId: "a" }, "uml"), "archi::a");
  assert.deepEqual(refVanCanvasId("archi::a", "uml"), { profielId: "archi", elementId: "a" });
  assert.deepEqual(refVanCanvasId("np", "uml"), { profielId: "uml", elementId: "np" });
  assert.equal(ontleedVreemdeId("koppeling:uml::np##archi::a"), null);
  assert.ok(isKoppelingId("koppeling:x"));
  assert.equal(linkIdVan("koppeling:x##y"), "x##y");
});

test("een koppeling met beide uiteinden op het diagram wordt een lijn, in de richting van de link", () => {
  const links = [
    link("L1", { profielId: "uml", elementId: "np" }, { profielId: "archi", elementId: "a" }),
    link("L2", { profielId: "uml", elementId: "loc" }, { profielId: "archi", elementId: "a" }, "komt voort uit", true),
    link("L3", { profielId: "uml", elementId: "np" }, { profielId: "archi", elementId: "weg" }),
  ];
  const uit = metKoppelingen({ elements, descriptor, diagram, eigenProfielId: "uml", links, soorten: SOORTEN });
  const k1 = uit.elements["koppeling:L1"];
  assert.equal(k1.source, "np");
  assert.equal(k1.target, "archi::a");
  assert.equal(k1.elementType, KOPPEL_TYPE_PREFIX + "realiseert");
  const k2 = uit.elements["koppeling:L2"];
  assert.equal(k2.source, "archi::a", "omgekeerd: kolom → rij");
  assert.equal(k2.target, "loc");
  assert.equal(uit.elements["koppeling:L3"], undefined, "uiteinde niet op het diagram");
  const typen = uit.descriptor.elementTypes.filter((t) => t.koppeling);
  assert.deepEqual(typen.map((t) => t.id), [KOPPEL_TYPE_PREFIX + "komt voort uit", KOPPEL_TYPE_PREFIX + "realiseert", ANDERE_SOORT_TYPE]);
  // Dependency (gestippeld, open pijl); alleen realiseert is een realisatie.
  assert.equal(typen[0].edgePresentatie.markerEnd, "pijl-open");
  assert.equal(typen[0].edgePresentatie.lijn, "dash-6-3");
  assert.equal(typen[1].edgePresentatie.markerEnd, "driehoek");
});

test("het canvas biedt de koppelsoorten alleen aan tussen twee talen", () => {
  const uit = metKoppelingen({ elements, descriptor, diagram, eigenProfielId: "uml", links: [], soorten: SOORTEN });
  const tussenTalen = vindConnectorTypes(uit.descriptor, elements.np, elements["archi::a"]).map((t) => t.id);
  assert.deepEqual(tussenTalen, [KOPPEL_TYPE_PREFIX + "komt voort uit", KOPPEL_TYPE_PREFIX + "realiseert", ANDERE_SOORT_TYPE]);
  const binnenTaal = vindConnectorTypes(uit.descriptor, elements.np, elements.loc).filter((t) => t.koppeling);
  assert.deepEqual(binnenTaal, []);
});

test("een vrije soort krijgt een eigen type, getekend als dependency met de soort als stereotype", () => {
  const links = [link("V", { profielId: "uml", elementId: "np" }, { profielId: "archi", elementId: "a" }, "gebruikt")];
  const uit = metKoppelingen({ elements, descriptor, diagram, eigenProfielId: "uml", links, soorten: SOORTEN });
  assert.equal(uit.elements["koppeling:V"].elementType, KOPPEL_TYPE_PREFIX + "gebruikt");
  const t = uit.descriptor.elementTypes.find((x) => x.id === KOPPEL_TYPE_PREFIX + "gebruikt");
  assert.equal(t.edgePresentatie.markerEnd, "pijl-open");
  assert.equal(t.edgePresentatie.labels[0].delen[0].tekst, "«gebruikt»");
});
