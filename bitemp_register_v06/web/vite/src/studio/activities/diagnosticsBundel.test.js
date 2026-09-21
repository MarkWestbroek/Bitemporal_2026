// diagnosticsBundel.test.js — bundeling van identieke paneel-meldingen.
// Run: node --import ./test/register-aliases.mjs --test src/studio/activities/diagnosticsBundel.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { bundelDiagnostics } from "./diagnosticsBundel.js";

const stijl = (sourceId) => ({ severity: "info", code: "AMX-LOSS-STIJL", message: "Stijl bewaard.", sourceId, path: "/views/v1" });

test("acht identieke meldingen worden één bundel met acht items", () => {
  const uit = bundelDiagnostics([...Array(8)].map((_, i) => stijl(`id-${i}`)));
  assert.equal(uit.length, 1);
  assert.equal(uit[0].items.length, 8);
  assert.equal(uit[0].items[0].sourceId, "id-0");
});

test("verschillende severity, code of message bundelen niet samen", () => {
  const uit = bundelDiagnostics([
    stijl("a"),
    { ...stijl("b"), severity: "warning" },
    { ...stijl("c"), code: "AMX-LOSS-ROUTING" },
    { ...stijl("d"), message: "Iets anders." },
  ]);
  assert.equal(uit.length, 4);
});

test("volgorde van eerste voorkomen blijft leidend", () => {
  // De warnings die eerst kwamen, blijven bovenaan — bundeling mag de
  // leesvolgorde van het paneel niet hersorteren.
  const uit = bundelDiagnostics([
    { severity: "warning", code: "A", message: "eerst" },
    stijl("x"),
    { severity: "warning", code: "A", message: "eerst" },
  ]);
  assert.deepEqual(uit.map((b) => b.message), ["eerst", "Stijl bewaard."]);
  assert.equal(uit[0].items.length, 2);
});

test("lege of ontbrekende invoer geeft een lege lijst", () => {
  assert.deepEqual(bundelDiagnostics([]), []);
  assert.deepEqual(bundelDiagnostics(undefined), []);
});
