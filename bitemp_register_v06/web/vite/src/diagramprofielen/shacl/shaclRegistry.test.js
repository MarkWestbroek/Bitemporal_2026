// shaclRegistry.test.js — SHACL (Turtle) in en uit via het transformatiepaneel, met nep-stores.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/shacl/shaclRegistry.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { registreerShaclTransformaties, lijktOpShacl, SHACL_PROFIEL_ID } from "./shaclRegistry.js";
import { getTransformaties, detecteerTransformatie } from "../../studio/activities/transformatieRegistry.js";
import { leesTurtle } from "../../transformatie/turtleLezer.js";

const hier = path.dirname(fileURLToPath(import.meta.url));
const KERN = readFileSync(path.resolve(hier, "../../../../../model-exchange/linked-data/odrl22-kern.shacl.ttl"), "utf8");

function nep() {
  const staat = { elements: {}, diagrams: {} };
  const geplaatst = [];
  const downloads = [];
  const store = {
    getState: () => ({
      ...staat,
      importeerModel: (model) => {
        Object.assign(staat.elements, model.elements);
        Object.assign(staat.diagrams, model.diagrams);
      },
    }),
  };
  registreerShaclTransformaties({
    getProfieltype: (id) => (id === SHACL_PROFIEL_ID ? { useStore: store, descriptor: { id: "shacl" } } : null),
    getModellerenState: () => ({ mappen: { m1: { id: "m1", naam: "Linked data" } }, plaatsDiagram: (k, m) => geplaatst.push([k, m]) }),
    collectMapModel: () => ({ [SHACL_PROFIEL_ID]: { elements: staat.elements, diagrams: staat.diagrams } }),
    download: (naam, tekst) => downloads.push({ naam, tekst }),
  });
  return { staat, geplaatst, downloads };
}

test("herkent SHACL-Turtle en kiest de SHACL-import", () => {
  nep();
  assert.ok(lijktOpShacl({ naam: "x.ttl", tekst: KERN }) >= 0.9);
  assert.equal(lijktOpShacl({ naam: "x.ttl", tekst: "@prefix ex: <urn:x> . ex:a ex:b ex:c ." }), 0.1);
  assert.equal(detecteerTransformatie(getTransformaties("import"), { naam: "odrl.ttl", tekst: KERN })?.id, "import-shacl-turtle");
});

test("import in de doelmap en export van de map, ook twee keer na elkaar", async () => {
  const { staat, geplaatst, downloads } = nep();
  const imp = getTransformaties("import").find((t) => t.id === "import-shacl-turtle");
  const r1 = await imp.run({ bron: { naam: "odrl22-kern.shacl.ttl", tekst: KERN }, doelMap: "m1" });
  assert.equal(r1.status, "success");
  assert.match(r1.summary, /^14 shapes ingelezen, geen meldingen\.$/);
  assert.deepEqual(geplaatst, [["shacl05::shapes", "m1"]]);
  // Een tweede import botst niet: de ids worden hernoemd.
  const r2 = await imp.run({ bron: { naam: "odrl22-kern.shacl.ttl", tekst: KERN }, doelMap: "m1" });
  assert.equal(r2.created.diagramIds.length, 1);
  assert.notEqual(r2.created.diagramIds[0], "shapes");
  assert.equal(Object.values(staat.elements).filter((e) => e.elementType === "nodeshape").length, 28);

  const exp = getTransformaties("export").find((t) => t.id === "export-shacl-turtle");
  const r3 = await exp.run({ bronMap: "m1", mapNaam: "Linked data" });
  assert.equal(downloads[0].naam, "Linked-data.ttl");
  assert.doesNotThrow(() => leesTurtle(downloads[0].tekst));
  assert.match(r3.summary, /^Linked-data\.ttl geschreven/);
});

test("een bestand met valkuilen geeft meldingen in het paneel", async () => {
  nep();
  const imp = getTransformaties("import").find((t) => t.id === "import-shacl-turtle");
  const r = await imp.run({
    bron: { naam: "v.ttl", tekst: "@prefix sh: <http://www.w3.org/ns/shacl#> . @prefix ex: <urn:ex:> . ex:S a sh:NodeShape ; sh:targetClass ex:A ; sh:property [ sh:path ( ex:p ex:q ) ] ." },
    doelMap: "m1",
  });
  assert.equal(r.status, "warning");
  assert.ok(r.diagnostics.some((d) => d.code === "SHACL-reekspad" && d.severity === "warning"));
});
