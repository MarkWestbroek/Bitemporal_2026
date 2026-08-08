// sysml.test.js — de traceerrelaties: vijf soorten, één connector.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/sysml/sysml.test.js
//
// N.B. `index.js` importeert shapes (`.jsx`) en is niet laadbaar in de
// node-testrunner; de logica woont daarom in `traces.js`.

import test from "node:test";
import assert from "node:assert/strict";

import { TRACE_SOORTEN, TRACE_OPTIES, traceLabel, traceLabels } from "./traces.js";

test("alle vijf SysML-traceersoorten zitten erin", () => {
  assert.deepEqual(
    TRACE_SOORTEN.map((t) => t.waarde),
    ["satisfy", "verify", "derive", "refine", "trace"]
  );
});

test("elke soort levert het juiste «stereotype»", () => {
  assert.equal(traceLabel("satisfy"), "«satisfy»");
  assert.equal(traceLabel("verify"), "«verify»");
  // SysML schrijft deriveReqt, niet derive — de waarde is kort, het label niet.
  assert.equal(traceLabel("derive"), "«deriveReqt»");
  assert.equal(traceLabel("refine"), "«refine»");
  assert.equal(traceLabel("trace"), "«trace»");
});

test("zonder (geldige) soort géén label: liever kaal dan misleidend", () => {
  assert.equal(traceLabel(""), null);
  assert.equal(traceLabel(undefined), null);
  assert.equal(traceLabel("verfijn"), null);
  assert.deepEqual(traceLabels({ data: {} }), {});
  assert.deepEqual(traceLabels({}), {});
});

test("het label staat midden op de lijn", () => {
  const labels = traceLabels({ data: { soort: "satisfy" } });
  assert.equal(labels.kaal[0].zijde, "midden");
  assert.equal(labels.kaal[0].delen[0].tekst, "«satisfy»");
});

test("elke keuze-optie heeft uitleg, zodat de inspector zelfverklarend is", () => {
  assert.equal(TRACE_OPTIES.length, TRACE_SOORTEN.length);
  for (const optie of TRACE_OPTIES) {
    assert.match(optie.label, /—/);
  }
});
