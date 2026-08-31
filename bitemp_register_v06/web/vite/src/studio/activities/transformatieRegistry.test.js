import test from "node:test";
import assert from "node:assert/strict";

import {
  getTransformaties,
  acceptVoor,
  detecteerTransformatie,
  normaliseerTransformatieResultaat,
  registreerTransformatie,
  standaardOpties,
  wisTransformaties,
} from "./transformatieRegistry.js";

test.afterEach(() => wisTransformaties());

test("oude en uitgebreide transformatiedescriptors blijven compatibel", async () => {
  registreerTransformatie({
    id: "oud",
    label: "Oud",
    richting: "export",
    profielTypes: "*",
    run: async () => undefined,
  });
  registreerTransformatie({
    id: "standaardformaat",
    label: "Standaardformaat",
    richting: "import",
    profielTypes: ["archimate05"],
    bron: {
      types: ["file"],
      accept: [".xml", ".archimate"],
      mediaTypes: ["application/xml"],
      detecteer: ({ tekst }) => tekst.includes("<model") ? 1 : 0,
    },
    opties: [{ key: "taal", label: "Taal", datatype: "string", default: "nl" }],
    run: async () => ({ status: "success", summary: "Gelukt", diagnostics: [] }),
  });

  assert.deepEqual(getTransformaties("export").map((t) => t.id), ["oud"]);
  const uitgebreid = getTransformaties("import", ["archimate05"])[0];
  assert.deepEqual(uitgebreid.bron.accept, [".xml", ".archimate"]);
  assert.equal(uitgebreid.bron.detecteer({ tekst: "<model/>", naam: "x.xml" }), 1);
  assert.equal((await uitgebreid.run()).status, "success");
  assert.equal(acceptVoor(uitgebreid), ".xml,.archimate");
  assert.deepEqual(standaardOpties(uitgebreid), { taal: "nl" });
  assert.equal(detecteerTransformatie([uitgebreid], { tekst: "<model/>", naam: "x.xml" }).id, "standaardformaat");
  assert.deepEqual(normaliseerTransformatieResultaat(undefined), {
    status: "success",
    summary: "Gelukt.",
    diagnostics: [],
    created: null,
  });
});

test("registratie weigert een onbekende richting", () => {
  assert.throws(
    () => registreerTransformatie({ id: "fout", richting: "zijwaarts", run: async () => {} }),
    /Onbekende transformatierichting/
  );
});