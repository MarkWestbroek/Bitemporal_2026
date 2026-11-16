import test from "node:test";
import assert from "node:assert/strict";
import { tabelVoorBewerken, tabelSamenvatting } from "./beslistabelRegels.js";

test("tabelVoorBewerken: zonder tabel een lege met de naam van de beslissing", () => {
  const t = tabelVoorBewerken(undefined, "Bepaal tarief");
  assert.equal(t.naam, "Bepaal tarief");
  assert.equal(t.inputs.length, 1);
  assert.equal(t.outputs.length, 1);
  assert.equal(t.rules.length, 1);
});

test("tabelVoorBewerken: vult een onvolledige tabel aan en laat onbekende eigenschappen staan", () => {
  const opgeslagen = { inputs: [{ id: "in1", naam: "soort", expressie: "count(x)" }], outputs: [], rules: [{ id: "r1" }] };
  const t = tabelVoorBewerken(opgeslagen, "Proef");
  assert.equal(t.hitPolicy, "UNIQUE");
  assert.equal(t.naam, "Proef");
  assert.equal(t.inputs[0].expressie, "count(x)");
  assert.deepEqual(t.rules[0], { id: "r1", inputEntries: {}, outputEntries: {} });
  assert.equal(opgeslagen.rules[0].inputEntries, undefined, "het origineel blijft ongemoeid");
  assert.equal(tabelVoorBewerken({ hitPolicy: "FIRST", inputs: [], outputs: [], rules: [] }).hitPolicy, "FIRST");
});

test("tabelSamenvatting", () => {
  assert.equal(tabelSamenvatting(null), "geen beslistabel");
  assert.equal(tabelSamenvatting({ inputs: [1, 2], outputs: [1], rules: [1] }), "2 in · 1 uit · 1 regel");
  assert.equal(tabelSamenvatting({ inputs: [], outputs: [] }), "0 in · 0 uit · 0 regels");
});
