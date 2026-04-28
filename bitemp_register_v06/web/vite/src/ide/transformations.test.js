// transformations.test.js — tests voor IDE-bewerkingen B5/B6/B7.
// Run met: node --test src/ide/transformations.test.js (vanuit web/vite/)

import test from "node:test";
import assert from "node:assert/strict";

import {
  castEntiteitNaarGE,
  splitsEntiteit,
  relatieNaarAssociatieklasse,
} from "./transformations.js";

// === Helpers ===========================================================

function maakEntiteit(id, typenaam, domein = "demo", velden = []) {
  return {
    id,
    naam: typenaam,
    metatype: "entiteit",
    domein,
    data: { typenaam, velden },
  };
}
function maakGE(id, typenaam, domein = "demo") {
  return {
    id,
    naam: typenaam,
    metatype: "gegevenselement",
    domein,
    data: { typenaam, velden: [] },
  };
}
function maakRel(id, typenaam, doelTypenaam, domein = "demo") {
  return {
    id,
    naam: typenaam,
    metatype: "relatie",
    domein,
    data: { typenaam, velden: [], doelEntiteit: doelTypenaam },
  };
}
function maakEdge(id, source, target, data = {}) {
  return { id, source, target, sourceHandle: null, targetHandle: null, data };
}

// =====================================================================
// B5 — castEntiteitNaarGE
// =====================================================================

test("B5: entiteit zonder relaties wordt GE onder parent (compositie toegevoegd)", () => {
  const state = {
    elements: {
      a: maakEntiteit("a", "A"),
      b: maakEntiteit("b", "B"),
    },
    structuralEdges: [],
  };
  const r = castEntiteitNaarGE(state, "b", "a");
  assert.equal(r.ok, true);
  assert.equal(r.elements.b.metatype, "gegevenselement");
  // Eén nieuwe compositie-edge a→b
  const compEdges = r.structuralEdges.filter((e) => e.source === "a" && e.target === "b");
  assert.equal(compEdges.length, 1);
  assert.equal(compEdges[0].data.momentvoorkomen, "enkelvoudig");
});

test("B5: bestaande compositie a→b wordt hergebruikt (niet gedupliceerd)", () => {
  const state = {
    elements: { a: maakEntiteit("a", "A"), b: maakEntiteit("b", "B") },
    structuralEdges: [maakEdge("e1", "a", "b", { momentvoorkomen: "enkelvoudig" })],
  };
  const r = castEntiteitNaarGE(state, "b", "a");
  assert.equal(r.ok, true);
  assert.equal(r.structuralEdges.length, 1);
  assert.equal(r.structuralEdges[0].id, "e1");
});

test("B5: inkomende edge van andere entiteit wordt verwijderd met warning", () => {
  const state = {
    elements: { a: maakEntiteit("a", "A"), b: maakEntiteit("b", "B"), c: maakEntiteit("c", "C") },
    structuralEdges: [maakEdge("e1", "c", "b", {})],
  };
  const r = castEntiteitNaarGE(state, "b", "a");
  assert.equal(r.ok, true);
  assert.equal(r.structuralEdges.find((e) => e.id === "e1"), undefined);
  assert.ok(r.warnings.some((w) => w.includes("verwijderd")));
});

test("B5: uitgaande edge naar entiteit wordt verwijderd met warning", () => {
  const state = {
    elements: { a: maakEntiteit("a", "A"), b: maakEntiteit("b", "B"), c: maakEntiteit("c", "C") },
    structuralEdges: [maakEdge("e1", "b", "c", {})],
  };
  const r = castEntiteitNaarGE(state, "b", "a");
  assert.equal(r.ok, true);
  assert.equal(r.structuralEdges.find((e) => e.id === "e1"), undefined);
  assert.ok(r.warnings.some((w) => w.toLowerCase().includes("uitgaande")));
});

test("B5: foutpad — parent is geen entiteit", () => {
  const state = {
    elements: { a: maakGE("a", "A"), b: maakEntiteit("b", "B") },
    structuralEdges: [],
  };
  const r = castEntiteitNaarGE(state, "b", "a");
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("geen entiteit")));
});

test("B5: domein wordt gesynced met parent (warning)", () => {
  const state = {
    elements: {
      a: maakEntiteit("a", "A", "domeinX"),
      b: maakEntiteit("b", "B", "domeinY"),
    },
    structuralEdges: [],
  };
  const r = castEntiteitNaarGE(state, "b", "a");
  assert.equal(r.elements.b.domein, "domeinX");
  assert.ok(r.warnings.some((w) => w.includes("Domein gewijzigd")));
});

// =====================================================================
// B6 — splitsEntiteit
// =====================================================================

test("B6: één veld wordt geëxtraheerd naar GE met compositie-edge", () => {
  const state = {
    elements: {
      e1: maakEntiteit("e1", "Persoon", "demo", [
        { naam: "voornaam", type: "string", verplicht: true },
        { naam: "leeftijd", type: "integer", verplicht: false },
      ]),
    },
    structuralEdges: [],
  };
  const r = splitsEntiteit(state, "e1", ["voornaam"]);
  assert.equal(r.ok, true);
  // Originele entiteit heeft nog leeftijd
  assert.equal(r.elements.e1.data.velden.length, 1);
  assert.equal(r.elements.e1.data.velden[0].naam, "leeftijd");
  // Eén nieuwe GE
  assert.equal(r.newIds.length, 1);
  const ge = r.elements[r.newIds[0]];
  assert.equal(ge.type, "gegevenselement");
  assert.equal(ge.data.metatype, "gegevenselement");
  assert.equal(ge.data.typenaam, "Persoon_Voornaam");
  assert.equal(ge.data.velden.length, 1);
  assert.equal(ge.data.velden[0].naam, "voornaam");
  // Compositie-edge e1 → ge
  const edge = r.structuralEdges.find((e) => e.source === "e1" && e.target === ge.id);
  assert.ok(edge);
  assert.equal(edge.data.momentvoorkomen, "enkelvoudig");
  assert.equal(edge.data.kardinaliteit, "1");
});

test("B6: optioneel veld krijgt kardinaliteit 0..1", () => {
  const state = {
    elements: {
      e1: maakEntiteit("e1", "Auto", "demo", [
        { naam: "kleur", type: "string", verplicht: false },
      ]),
    },
    structuralEdges: [],
  };
  const r = splitsEntiteit(state, "e1", ["kleur"]);
  const edge = r.structuralEdges.find((e) => e.source === "e1");
  assert.equal(edge.data.kardinaliteit, "0..1");
});

test("B6: meerdere velden in één call worden allemaal verplaatst", () => {
  const state = {
    elements: {
      e1: maakEntiteit("e1", "Persoon", "demo", [
        { naam: "voornaam", type: "string" },
        { naam: "achternaam", type: "string" },
        { naam: "leeftijd", type: "integer" },
      ]),
    },
    structuralEdges: [],
  };
  const r = splitsEntiteit(state, "e1", ["voornaam", "achternaam"]);
  assert.equal(r.ok, true);
  assert.equal(r.newIds.length, 2);
  assert.equal(r.elements.e1.data.velden.length, 1);
  assert.equal(r.elements.e1.data.velden[0].naam, "leeftijd");
});

test("B6: onbekend veld levert warning maar geen error als er nog geldige zijn", () => {
  const state = {
    elements: {
      e1: maakEntiteit("e1", "X", "demo", [{ naam: "a", type: "string" }]),
    },
    structuralEdges: [],
  };
  const r = splitsEntiteit(state, "e1", ["a", "bestaatNiet"]);
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => w.includes("bestaatNiet")));
});

test("B6: alle veldnamen onbekend → ok=false", () => {
  const state = {
    elements: { e1: maakEntiteit("e1", "X", "demo", [{ naam: "a" }]) },
    structuralEdges: [],
  };
  const r = splitsEntiteit(state, "e1", ["bestaatNiet"]);
  assert.equal(r.ok, false);
});

test("B6: lege velden-selectie → ok=false met error", () => {
  const state = { elements: { e1: maakEntiteit("e1", "X") }, structuralEdges: [] };
  const r = splitsEntiteit(state, "e1", []);
  assert.equal(r.ok, false);
  assert.ok(r.errors.length > 0);
});

// =====================================================================
// B7 — relatieNaarAssociatieklasse
// =====================================================================

test("B7: directe ENT→ENT edge wordt vervangen door bron→rel→doel", () => {
  const state = {
    elements: {
      a: maakEntiteit("a", "Persoon"),
      b: maakEntiteit("b", "Bedrijf"),
    },
    structuralEdges: [maakEdge("e1", "a", "b", { rolnaam: "werknemer" })],
  };
  const r = relatieNaarAssociatieklasse(state, "e1");
  assert.equal(r.ok, true);
  // Origineel weg
  assert.equal(r.structuralEdges.find((e) => e.id === "e1"), undefined);
  // Nieuw relatie-element
  assert.equal(r.newIds.length, 1);
  const rel = r.elements[r.newIds[0]];
  assert.equal(rel.metatype, "relatie");
  assert.equal(rel.data.typenaam, "Rel_Persoon_Bedrijf");
  assert.deepEqual(rel.data.velden, []); // collapsed-vorm: nog geen velden
  // Twee nieuwe edges
  const ownerEdge = r.structuralEdges.find((e) => e.source === "a" && e.target === rel.id);
  const doelEdge = r.structuralEdges.find((e) => e.source === rel.id && e.target === "b");
  assert.ok(ownerEdge);
  assert.ok(doelEdge);
  // rolnaam wordt overgenomen op de owner-edge
  assert.equal(ownerEdge.data.rolnaam, "werknemer");
});

test("B7: custom relatieNaam wordt gebruikt", () => {
  const state = {
    elements: { a: maakEntiteit("a", "X"), b: maakEntiteit("b", "Y") },
    structuralEdges: [maakEdge("e1", "a", "b", {})],
  };
  const r = relatieNaarAssociatieklasse(state, "e1", { relatieNaam: "WerktVoor" });
  const rel = r.elements[r.newIds[0]];
  assert.equal(rel.data.typenaam, "WerktVoor");
});

test("B7: directioneel-vlag wordt overgenomen", () => {
  const state = {
    elements: { a: maakEntiteit("a", "X"), b: maakEntiteit("b", "Y") },
    structuralEdges: [maakEdge("e1", "a", "b", { directioneel: true })],
  };
  const r = relatieNaarAssociatieklasse(state, "e1");
  assert.equal(r.elements[r.newIds[0]].data.directioneel, true);
});

test("B7: foutpad — bron is geen entiteit", () => {
  const state = {
    elements: { a: maakGE("a", "A"), b: maakEntiteit("b", "B") },
    structuralEdges: [maakEdge("e1", "a", "b", {})],
  };
  const r = relatieNaarAssociatieklasse(state, "e1");
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((m) => m.includes("Bron")));
});

test("B7: foutpad — edge bestaat niet", () => {
  const state = {
    elements: { a: maakEntiteit("a", "A"), b: maakEntiteit("b", "B") },
    structuralEdges: [],
  };
  const r = relatieNaarAssociatieklasse(state, "onbekend");
  assert.equal(r.ok, false);
});

// =====================================================================
// Integratie: relatie-element via B7 + extra veld → ASOC-vorm
// =====================================================================

test("integratie: na B7 + veld toevoegen herkent asoc-helper de ASOC-vorm", async () => {
  const { isAsoc } = await import("../shared/asoc.js");
  const state = {
    elements: { a: maakEntiteit("a", "X"), b: maakEntiteit("b", "Y") },
    structuralEdges: [maakEdge("e1", "a", "b", {})],
  };
  const r = relatieNaarAssociatieklasse(state, "e1");
  const rel = r.elements[r.newIds[0]];
  // collapsed initieel
  assert.equal(isAsoc(rel), false);
  // Voeg veld toe → ASOC
  rel.data.velden.push({ naam: "rol", type: "string" });
  assert.equal(isAsoc(rel), true);
});
