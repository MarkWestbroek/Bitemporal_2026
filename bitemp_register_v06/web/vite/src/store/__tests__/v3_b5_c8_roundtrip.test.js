import { test } from "node:test";
import assert from "node:assert/strict";
import { storeNaarV3Model, v3ModelNaarStore } from "../adapters.js";

/**
 * Roundtrip-tests voor B5 (label-offsets op edges in benoemde diagrammen)
 * en C8 (notities + constraints met scope-edges) door de adapters.
 *
 * We bouwen een minimale store-state, exporteren naar V3, importeren terug
 * en controleren dat alle relevante data behouden blijft.
 */

function buildMinimaleStoreState() {
  return {
    elements: {
      A: { id: "A", naam: "A", type: "entiteit", domein: "test", data: { meervoud: "as" } },
      B: { id: "B", naam: "B", type: "entiteit", domein: "test", data: { meervoud: "bs" } },
      // C8: notitie en constraint
      note1: {
        id: "note1",
        naam: "note1",
        type: "notitie",
        domein: "test",
        data: { tekst: "Eerste opmerking", positie: { x: 10, y: 20 } },
      },
      cstr1: {
        id: "cstr1",
        naam: "C1",
        type: "constraint",
        domein: "test",
        data: { expressie: "A.x > 0", taal: "ocl", positie: { x: 50, y: 60 } },
      },
    },
    structuralEdges: [
      // C8: scope-edge cstr1 → A
      { id: "scope-cstr1-A", source: "cstr1", target: "A", data: { kind: "scope" } },
    ],
    diagrams: {
      // B5: benoemd diagram met edge die labelOffsets bevat
      mijn_diagram: {
        id: "mijn_diagram",
        naam: "Mijn diagram",
        domein: null,
        nodes: [
          { id: "A", position: { x: 0, y: 0 } },
          { id: "B", position: { x: 200, y: 0 } },
        ],
        edges: [
          {
            id: "edge-AB",
            source: "A",
            target: "B",
            data: {
              labelOffsets: {
                heen: { x: 12, y: -8 },
                terug: { x: 0, y: 15 },
              },
            },
          },
        ],
        viewport: null,
      },
    },
    domains: ["test"],
    domainMeta: {},
    modelMeta: { versie: "v3" },
  };
}

test("B5: labelOffsets overleven storeNaarV3Model + v3ModelNaarStore roundtrip", () => {
  const state = buildMinimaleStoreState();
  const v3Full = storeNaarV3Model(state);

  // Export bevat het diagram met labelOffsets
  const v3Diag = (v3Full.model.diagrammen || []).find((d) => d.id === "mijn_diagram");
  assert.ok(v3Diag, "benoemd diagram in V3-export");
  const v3Edge = v3Diag.edges.find((e) => e.id === "edge-AB");
  assert.ok(v3Edge, "edge AB in V3-export");
  assert.deepEqual(v3Edge.labelOffsets?.heen, { x: 12, y: -8 }, "heen-offset behouden in V3");
  assert.deepEqual(v3Edge.labelOffsets?.terug, { x: 0, y: 15 }, "terug-offset behouden in V3");

  // Import terug
  const r = v3ModelNaarStore(v3Full);
  const diag = r.diagrams["mijn_diagram"];
  assert.ok(diag, "benoemd diagram na re-import");
  const edge = diag.edges.find((e) => e.id === "edge-AB");
  assert.ok(edge, "edge AB na re-import");
  assert.deepEqual(edge.data?.labelOffsets?.heen, { x: 12, y: -8 }, "heen-offset behouden na roundtrip");
  assert.deepEqual(edge.data?.labelOffsets?.terug, { x: 0, y: 15 }, "terug-offset behouden na roundtrip");
});

test("C8: notities overleven storeNaarV3Model + v3ModelNaarStore roundtrip", () => {
  const state = buildMinimaleStoreState();
  const v3Full = storeNaarV3Model(state);

  const v3Notes = v3Full.model.notities || [];
  assert.equal(v3Notes.length, 1, "één notitie in V3-export");
  assert.equal(v3Notes[0].id, "note1");
  assert.equal(v3Notes[0].tekst, "Eerste opmerking");
  assert.deepEqual(v3Notes[0].positie, { x: 10, y: 20 });

  const r = v3ModelNaarStore(v3Full);
  const note = r.elements["note1"];
  assert.ok(note, "notitie na re-import aanwezig");
  assert.equal(note.type, "notitie");
  assert.equal(note.data.tekst, "Eerste opmerking");
  assert.deepEqual(note.data.positie, { x: 10, y: 20 });
});

test("C8: constraints + scopeRefs overleven storeNaarV3Model + v3ModelNaarStore roundtrip", () => {
  const state = buildMinimaleStoreState();
  const v3Full = storeNaarV3Model(state);

  const v3Cs = v3Full.model.constraints || [];
  assert.equal(v3Cs.length, 1, "één constraint in V3-export");
  const c = v3Cs[0];
  assert.equal(c.id, "cstr1");
  assert.equal(c.naam, "C1");
  assert.equal(c.expressie, "A.x > 0");
  assert.equal(c.taal, "ocl");
  assert.deepEqual(c.scopeRefs, ["A"], "scopeRefs uit structurele scope-edges");

  const r = v3ModelNaarStore(v3Full);
  const cstr = r.elements["cstr1"];
  assert.ok(cstr, "constraint na re-import aanwezig");
  assert.equal(cstr.type, "constraint");
  assert.equal(cstr.data.expressie, "A.x > 0");
  // scope-edge teruggekomen als structuurele edge met kind="scope"
  const scopeEdge = (r.structuralEdges || []).find(
    (e) => e.source === "cstr1" && e.target === "A" && e.data?.kind === "scope"
  );
  assert.ok(scopeEdge, "scope-edge cstr1 → A na re-import aanwezig");
});
