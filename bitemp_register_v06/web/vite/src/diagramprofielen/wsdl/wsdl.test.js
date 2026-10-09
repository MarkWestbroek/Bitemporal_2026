// wsdl.test.js — WSDL-profiel: descriptor geldig, wsdlElement als bereik, EA-tabel sluitend.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/wsdl/wsdl.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { valideerDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { normaliseerErfenis, kopieVoorNormalisatie } from "../../diagramcore/types/erfenis.js";
import { wsdlDiagramType, elementTypes } from "./descriptor.js";
import { OBJECTEN, CONNECTOREN } from "./eaMapping.js";

test("descriptor is geldig", () => {
  assert.deepEqual(valideerDiagramType(wsdlDiagramType), []);
});

test("wsdlElement → service, portType, binding, message, types", () => {
  const dt = kopieVoorNormalisatie(wsdlDiagramType);
  assert.deepEqual(normaliseerErfenis(dt), []);
  const dep = dt.elementTypes.find((t) => t.id === "dependency");
  assert.deepEqual(dep.bron.elementTypes, ["service", "portType", "binding", "message", "types", "namespace"]);
  for (const id of ["service", "portType", "binding", "message", "types"]) {
    assert.ok(dt.elementTypes.find((t) => t.id === id).properties.some((p) => p.key === "toelichting"), id);
  }
});

test("operatie → message draagt operatie + rol als label", () => {
  const c = elementTypes.find((t) => t.id === "gebruiktMessage");
  assert.equal(c.hooks.edgeLabels({ data: { operatie: "Opvragen", rol: "output" } }).kaal[0].delen[0].tekst, "Opvragen «output»");
  assert.equal(c.hooks.edgeLabels({ data: {} }).kaal[0].delen[0].tekst, "«input»");
});

test("EA-tabel sluit op de descriptor; service/portType/binding/message/types gedekt", () => {
  const perId = new Map(elementTypes.map((t) => [t.id, t]));
  for (const r of OBJECTEN) {
    const t = perId.get(r.elementType);
    assert.ok(t && !t.isConnector && !t.isAbstract, r.elementType);
  }
  for (const r of CONNECTOREN) assert.ok(perId.get(r.elementType)?.isConnector, r.elementType);
  for (const st of ["wsdlservice", "wsdlporttype", "wsdlbinding", "wsdlmessage", "wsdltypes"]) {
    assert.ok(OBJECTEN.some((r) => r.stereotype === st), st);
  }
});
