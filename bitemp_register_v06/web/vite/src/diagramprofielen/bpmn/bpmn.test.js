// bpmn.test.js — de sequence flow-hooks: conditie-label en default flow.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/bpmn/bpmn.test.js
//
// N.B. het profiel zelf (`index.js`) importeert shapes (`.jsx`) en is daarmee
// niet laadbaar in de node-testrunner; vandaar dat de logica in de pure
// module `sequenceFlow.js` woont.

import test from "node:test";
import assert from "node:assert/strict";

import { sequenceFlowPresentatie, sequenceFlowLabels } from "./sequenceFlow.js";

test("default flow krijgt het schuine streepje aan de bronzijde", () => {
  assert.equal(sequenceFlowPresentatie({ data: { standaard: true } }).markerStart, "schuine-streep");
});

test("een gewone sequence flow krijgt géén bronmarker", () => {
  assert.deepEqual(sequenceFlowPresentatie({ data: {} }), {});
  assert.deepEqual(sequenceFlowPresentatie({ data: { standaard: false } }), {});
  assert.deepEqual(sequenceFlowPresentatie({}), {});
});

test("conditie komt als [conditie] midden op de lijn", () => {
  const labels = sequenceFlowLabels({ data: { conditie: "volledig" } });
  assert.equal(labels.kaal[0].zijde, "midden");
  assert.equal(labels.kaal[0].delen[0].tekst, "[volledig]");
});

test("zonder conditie geen label", () => {
  assert.deepEqual(sequenceFlowLabels({ data: {} }), {});
  assert.deepEqual(sequenceFlowLabels({}), {});
});

test("conditie en default flow bijten elkaar niet", () => {
  const conn = { data: { conditie: "volledig", standaard: true } };
  assert.equal(sequenceFlowPresentatie(conn).markerStart, "schuine-streep");
  assert.equal(sequenceFlowLabels(conn).kaal[0].delen[0].tekst, "[volledig]");
});
