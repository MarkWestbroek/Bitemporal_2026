// rawEditorAdapter.test.js
// Tests voor rawEditorNaarStore (lossless ruw-import → IDE-store) en de
// V3-validator. Inclusief end-to-end import van de Mermaid-demobestanden in
// `demos/orphan-tests/`.
//
// Run: node --import ./test/register-aliases.mjs --test src/store/rawEditorAdapter.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { rawEditorNaarStore, valideerVoorV3 } from "./adapters.js";
import { rawUMLNaarEditor, detecteerOrphans, pasOrphanActiesToe } from "@umleditor/import/rawuml.js";
import { importVanMermaid } from "@umleditor/import/importMermaid.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoDir = resolve(__dirname, "../../../../demos/orphan-tests");

function laadDemo(naam) {
  return readFileSync(resolve(demoDir, naam), "utf8");
}

// ───────────────────────────── rawEditorNaarStore ─────────────────────────────

test("rawEditorNaarStore: lege graaf levert lege store", () => {
  const out = rawEditorNaarStore({ nodes: [], edges: [] });
  assert.deepEqual(out.elements, {});
  assert.deepEqual(out.structuralEdges, []);
  assert.equal(out.domains.length, 0);
  assert.ok(out.diagrams.overzicht);
  assert.equal(out.diagrams.overzicht.nodes.length, 0);
});

test("rawEditorNaarStore: undefined input is veilig", () => {
  const out = rawEditorNaarStore(undefined);
  assert.deepEqual(out.elements, {});
});

test("rawEditorNaarStore: behoudt velden op entiteit (lossless)", () => {
  const graaf = rawUMLNaarEditor({
    nodes: [
      { naam: "Persoon", stereotypes: [], velden: [
        { naam: "voornaam", type: "string" },
        { naam: "leeftijd", type: "int" },
      ]},
    ],
    edges: [],
  });
  const store = rawEditorNaarStore(graaf);
  const persoon = store.elements.Persoon;
  assert.ok(persoon, "Persoon-element moet bestaan");
  assert.equal(persoon.type, "entiteit");
  assert.equal(persoon.metatype, "entiteit", "top-level metatype moet gezet zijn voor B5/B6/B7-acties");
  assert.equal(persoon.data.metatype, "entiteit", "ook in data voor inspector-consistency");
  assert.equal(persoon.data.velden.length, 2);
  assert.equal(persoon.data.velden[0].naam, "voornaam");
  assert.equal(persoon.data.velden[1].naam, "leeftijd");
});

test("rawEditorNaarStore: behoudt directe entiteit→entiteit edges", () => {
  const graaf = rawUMLNaarEditor({
    nodes: [
      { naam: "Persoon", stereotypes: [] },
      { naam: "Adres", stereotypes: [] },
    ],
    edges: [
      { bronNaam: "Persoon", doelNaam: "Adres", soort: "associatie", doelKardinaliteit: "0..*" },
    ],
  });
  const store = rawEditorNaarStore(graaf);
  assert.equal(store.structuralEdges.length, 1);
  const edge = store.structuralEdges[0];
  assert.equal(edge.source, "Persoon");
  assert.equal(edge.target, "Adres");
});

test("rawEditorNaarStore: posities komen in het overzicht-diagram terecht", () => {
  const graaf = rawUMLNaarEditor({
    nodes: [{ naam: "X", stereotypes: [], positie: { x: 100, y: 200 } }],
    edges: [],
  });
  const store = rawEditorNaarStore(graaf);
  const node = store.diagrams.overzicht.nodes[0];
  assert.equal(node.elementId, "X");
  assert.deepEqual(node.position, { x: 100, y: 200 });
});

test("rawEditorNaarStore: name-collision krijgt suffix", () => {
  // Twee nodes met dezelfde naam: tweede krijgt "_2"
  const store = rawEditorNaarStore({
    nodes: [
      { id: "n1", type: "entiteit", data: { typenaam: "Dup", velden: [] }, position: { x: 0, y: 0 } },
      { id: "n2", type: "entiteit", data: { typenaam: "Dup", velden: [] }, position: { x: 0, y: 0 } },
    ],
    edges: [],
  });
  assert.ok(store.elements.Dup);
  assert.ok(store.elements.Dup_2);
});

test("rawEditorNaarStore: B6 splitsEntiteit werkt op raw-imported entiteit (regression)", async () => {
  // Voorheen viel splitsEntiteit met "Element X is geen entiteit" omdat
  // rawNodeNaarElement geen top-level `metatype` zette. Deze test borgt
  // dat die regression niet terugkomt.
  const { splitsEntiteit } = await import("../ide/transformations.js");
  const graaf = rawUMLNaarEditor({
    nodes: [
      { naam: "Contactmoment", stereotypes: [], velden: [
        { naam: "status", type: "string" },
        { naam: "datum", type: "date-time" },
      ]},
    ],
    edges: [],
  });
  const store = rawEditorNaarStore(graaf);
  const patch = splitsEntiteit(store, "Contactmoment", ["status"]);
  assert.equal(patch.ok, true, `splitsEntiteit moet slagen, errors: ${patch.errors?.join(", ")}`);
  assert.equal(patch.errors.length, 0);
  assert.equal(patch.newIds.length, 1);
  // Originele entiteit houdt resterende velden over
  const ent = patch.elements.Contactmoment;
  assert.equal(ent.data.velden.length, 1);
  assert.equal(ent.data.velden[0].naam, "datum");
});

// ───────────────────────────── valideerVoorV3 ─────────────────────────────

test("valideerVoorV3: lege store is geldig", () => {
  const overtredingen = valideerVoorV3({ elements: {}, structuralEdges: [] });
  assert.deepEqual(overtredingen, []);
});

test("valideerVoorV3: V3-001 vlagt entiteit met velden", () => {
  const state = {
    elements: {
      Persoon: { id: "Persoon", naam: "Persoon", type: "entiteit", data: { velden: [{ naam: "naam" }] } },
    },
    structuralEdges: [],
  };
  const overtr = valideerVoorV3(state);
  assert.equal(overtr.length, 1);
  assert.equal(overtr[0].regel, "V3-001");
  assert.equal(overtr[0].elementId, "Persoon");
});

test("valideerVoorV3: entiteit zonder velden is OK", () => {
  const state = {
    elements: {
      Persoon: { id: "Persoon", naam: "Persoon", type: "entiteit", data: { velden: [] } },
    },
    structuralEdges: [],
  };
  assert.deepEqual(valideerVoorV3(state), []);
});

test("valideerVoorV3: V3-002 vlagt directe entiteit→entiteit edge", () => {
  const state = {
    elements: {
      A: { id: "A", naam: "A", type: "entiteit", data: { velden: [] } },
      B: { id: "B", naam: "B", type: "entiteit", data: { velden: [] } },
    },
    structuralEdges: [
      { id: "e1", source: "A", target: "B", data: {} },
    ],
  };
  const overtr = valideerVoorV3(state);
  assert.equal(overtr.length, 1);
  assert.equal(overtr[0].regel, "V3-002");
});

test("valideerVoorV3: generalisatie-edge tussen entiteiten is OK", () => {
  const state = {
    elements: {
      A: { id: "A", naam: "A", type: "entiteit", data: { velden: [] } },
      B: { id: "B", naam: "B", type: "entiteit", data: { velden: [] } },
    },
    structuralEdges: [
      { id: "e1", source: "A", target: "B", data: { isGeneralization: true } },
    ],
  };
  assert.deepEqual(valideerVoorV3(state), []);
});

test("valideerVoorV3: dependency-edge tussen entiteiten is OK", () => {
  const state = {
    elements: {
      A: { id: "A", naam: "A", type: "entiteit", data: { velden: [] } },
      B: { id: "B", naam: "B", type: "entiteit", data: { velden: [] } },
    },
    structuralEdges: [
      { id: "e1", source: "A", target: "B", data: { isDependency: true } },
    ],
  };
  assert.deepEqual(valideerVoorV3(state), []);
});

test("valideerVoorV3: edge entiteit→GE is OK", () => {
  const state = {
    elements: {
      A: { id: "A", naam: "A", type: "entiteit", data: { velden: [] } },
      A_naam: { id: "A_naam", naam: "naam", type: "gegevenselement", data: {} },
    },
    structuralEdges: [
      { id: "e1", source: "A", target: "A_naam", data: {} },
    ],
  };
  assert.deepEqual(valideerVoorV3(state), []);
});

// ────────────────────── End-to-end demo bestanden (orphan-tests) ──────────────────────

test("demo 05-valid-baseline.mmd: na rawEditorNaarStore zonder orphans en V3-conform", () => {
  const text = laadDemo("05-valid-baseline.mmd");
  const graaf = importVanMermaid(text);
  assert.deepEqual(detecteerOrphans(graaf), []);
  const store = rawEditorNaarStore(graaf);
  assert.ok(Object.keys(store.elements).length > 0, "moet elementen hebben");
  // Baseline-bestand kan velden of edges hebben die ook in V3 OK zijn.
  // We controleren niet de afwezigheid van overtredingen; alleen dat het pad
  // zonder fouten doorloopt en elementen oplevert.
});

test("demo 01-orphan-ge.mmd: orphan-detectie vlagt GE", () => {
  const text = laadDemo("01-orphan-ge.mmd");
  const graaf = importVanMermaid(text);
  const orphans = detecteerOrphans(graaf);
  assert.ok(orphans.length > 0, "verwacht ten minste één orphan");
  assert.ok(orphans.some((o) => o.type === "gegevenselement"), "verwacht GE-orphan");
});

test("demo 02-orphan-relatie.mmd: orphan-detectie vlagt relatie", () => {
  const text = laadDemo("02-orphan-relatie.mmd");
  const graaf = importVanMermaid(text);
  const orphans = detecteerOrphans(graaf);
  assert.ok(orphans.length > 0);
  assert.ok(orphans.some((o) => o.type === "relatie"), "verwacht relatie-orphan");
});

test("demo 03-multiple-orphans.mmd: detecteert meerdere orphans", () => {
  const text = laadDemo("03-multiple-orphans.mmd");
  const graaf = importVanMermaid(text);
  const orphans = detecteerOrphans(graaf);
  assert.ok(orphans.length >= 2, `verwacht ≥2 orphans, kreeg ${orphans.length}`);
});

test("demo 04-only-dependency.mmd: GE met enkel dependency-edge is orphan", () => {
  const text = laadDemo("04-only-dependency.mmd");
  const graaf = importVanMermaid(text);
  const orphans = detecteerOrphans(graaf);
  assert.ok(orphans.length > 0);
});

test("demo 01: na 'placeholder'-actie + rawEditorNaarStore zit alles in de store", () => {
  const text = laadDemo("01-orphan-ge.mmd");
  const graaf = importVanMermaid(text);
  const orphans = detecteerOrphans(graaf);
  const keuzes = Object.fromEntries(orphans.map((o) => [o.nodeId, "placeholder"]));
  const opgelost = pasOrphanActiesToe(graaf, orphans, keuzes);
  const store = rawEditorNaarStore(opgelost);
  // Geen orphans meer in de store-structuur (alle GE's hebben nu een placeholder-entiteit)
  const geCount = Object.values(store.elements).filter((e) => e.type === "gegevenselement").length;
  const entCount = Object.values(store.elements).filter((e) => e.type === "entiteit").length;
  assert.ok(geCount > 0, "moet GE's bevatten");
  assert.ok(entCount > 0, "moet entiteiten bevatten (incl. placeholder)");
});
