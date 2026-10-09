// communication.test.js — descriptor geldig; EA-berichten samenvouwen tot links.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/communication/communication.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { valideerDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { communicationDiagramType, elementTypes } from "./descriptor.js";
import { OBJECTEN, CONNECTOREN, vouwBerichtenTotLinks } from "./eaMapping.js";

test("descriptor is geldig; de link draagt de berichten als compartiment", () => {
  assert.deepEqual(valideerDiagramType(communicationDiagramType), []);
  const link = elementTypes.find((t) => t.id === "link");
  assert.ok(link.isConnector);
  assert.deepEqual(link.compartments.map((c) => c.id), ["berichten"]);
});

test("EA-tabel sluit op de descriptor", () => {
  const perId = new Map(elementTypes.map((t) => [t.id, t]));
  for (const r of OBJECTEN) assert.ok(perId.get(r.elementType) && !perId.get(r.elementType).isConnector, r.elementType);
  for (const r of CONNECTOREN) assert.ok(perId.get(r.elementType)?.isConnector, r.elementType);
});

test("berichten tussen hetzelfde paar worden één link, gesorteerd op volgnummer, met richting als pijl", () => {
  const links = vouwBerichtenTotLinks([
    { id: "m2", source: "b", target: "a", seqNo: "1.1", naam: "antwoord" },
    { id: "m1", source: "a", target: "b", seqNo: "1", naam: "vraag()" },
    { id: "m3", source: "a", target: "c", seqNo: "2", naam: "log()", soort: "async" },
    { id: "m4", source: "a", target: "b", seqNo: "10", naam: "later()" },
  ]);
  assert.equal(links.length, 2);
  const ab = links.find((l) => l.id === "m2");
  assert.equal(ab.source, "b");
  assert.deepEqual(
    ab.berichten.map((m) => `${m.naam} ${m.typeLabel}`),
    ["1 ← vraag()", "1.1 → antwoord", "10 ← later()"]
  );
  assert.equal(links.find((l) => l.id === "m3").berichten[0].soort, "async");
});
