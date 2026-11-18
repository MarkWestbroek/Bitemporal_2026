import { test } from "node:test";
import assert from "node:assert/strict";
import { placeholdersIn, sjabloonDelen, soortVan, knoopVoor, paneelBoom, onbekendePlaceholders } from "./schemaPaneel.js";
import { valideerSchema } from "./schemaValidatie.js";
import { BPMN_SCHRIJVER_SCHEMA } from "../diagramprofielen/bpmn/bpmnSchrijverSchema.js";
import { BPMN_NAAR_GZAC } from "../diagramprofielen/bpmn/bpmnGzacRegels.js";

test("placeholders: {naam} en {naam|filter}, maar niet ${…}", () => {
  const t = "${documentDelegateService.setInternalStatus(execution, '{dossierstatus|kebab}')}";
  assert.deepEqual(placeholdersIn(t), [{ naam: "dossierstatus", filter: "kebab" }]);
  assert.deepEqual(placeholdersIn("${true}"), []);
  assert.deepEqual(placeholdersIn("${STATUSTYPE_URL:{zaaktype}:{volgnummer}}").map((p) => p.naam), ["zaaktype", "volgnummer"]);
  assert.deepEqual(sjabloonDelen("a {b} c"), [{ tekst: "a " }, { placeholder: "{b}", naam: "b", filter: null }, { tekst: " c" }]);
});

test("de soort volgt uit het schema, anders uit de waarde", () => {
  assert.equal(soortVan({ type: "boolean" }, true), "ja_nee");
  assert.equal(soortVan({ enum: ["a", "b"] }, "a"), "keuze");
  assert.equal(soortVan({}, 14), "getal");
  assert.equal(soortVan({}, "vast"), "tekst");
  assert.equal(soortVan({}, "{formulier}"), "sjabloon");
  assert.equal(soortVan({ type: "string", "x-placeholders": ["x"] }, "vast"), "sjabloon");
  assert.equal(soortVan({ type: "object", additionalProperties: { type: "string" } }, { a: "1" }), "tabel");
  assert.equal(soortVan({ type: "object", additionalProperties: {} }, { a: "1", b: 2 }), "tabel");
  assert.equal(soortVan({ type: "object", additionalProperties: {} }, { a: [] }), "groep");
  assert.equal(soortVan({}, { a: "1" }), "groep");
  assert.equal(soortVan({}, []), "lijst");
});

test("een knoop: titel, vorm, afwijking van de standaard, onbeschreven kinderen", () => {
  const schema = { type: "object", properties: { aan: { type: "boolean", default: false, "x-titel": "Aan" }, naam: { type: "string" } } };
  const k = knoopVoor(schema, { aan: true, naam: "x", extra: 3 });
  assert.deepEqual(k.kinderen.map((c) => [c.sleutel, c.titel, c.soort, c.vorm, c.afwijkend, c.onbeschreven]), [
    ["aan", "Aan", "ja_nee", "switch", true, false],
    ["naam", "naam", "tekst", "text", false, false],
    ["extra", "extra", "getal", "number", false, true],
  ]);
  assert.deepEqual(paneelBoom(schema, { aan: true, extra: 3 }).onbeschreven, ["extra"]);
});

test("de GZAC-stand is geldig voor het schema van de BPMN-schrijver en volledig beschreven", () => {
  const { id, versie, titel, ...stand } = BPMN_NAAR_GZAC;
  assert.deepEqual(valideerSchema(stand, BPMN_SCHRIJVER_SCHEMA), []);
  const boom = paneelBoom(BPMN_SCHRIJVER_SCHEMA, stand);
  assert.deepEqual(boom.groepen.map((g) => g.naam), ["Engine", "Wachtpunten en lussen", "Taken", "Variabelen en berichten", "Proceskoppeling"]);
  // Komt er in de code een instelling bij, dan hoort hij hier een beschrijving te krijgen.
  assert.deepEqual(boom.onbeschreven, []);
  assert.deepEqual(onbekendePlaceholders(BPMN_SCHRIJVER_SCHEMA, stand), []);

  const taken = boom.groepen.find((g) => g.naam === "Taken").knopen[0];
  assert.deepEqual(taken.kinderen.map((k) => k.sleutel), ["userTask", "serviceTask", "businessRuleTask", "callActivity"]);
  const service = taken.kinderen.find((k) => k.sleutel === "serviceTask");
  assert.deepEqual(service.kinderen.map((k) => [k.sleutel, k.soort]), [["attributen", "tabel"], ["asyncAfter", "ja_nee"], ["uitData", "lijst"]]);
  const dan = service.kinderen[2].kinderen[0].kinderen.find((k) => k.sleutel === "attributen");
  assert.deepEqual(dan.rijen[0].placeholders, [{ naam: "dossierstatus", filter: "kebab", bekend: true }]);
});

test("een onbekende placeholder in een sjabloonwaarde wordt gevonden", () => {
  const { id, versie, titel, ...stand } = BPMN_NAAR_GZAC;
  const fout = JSON.parse(JSON.stringify(stand));
  fout.berichten.variabel = "execution.getVariable('{variabel}')";
  assert.deepEqual(onbekendePlaceholders(BPMN_SCHRIJVER_SCHEMA, fout), [{ pad: "berichten.variabel", naam: "variabel" }]);
});
