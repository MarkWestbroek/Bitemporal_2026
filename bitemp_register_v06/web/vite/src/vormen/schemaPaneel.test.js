import { test } from "node:test";
import assert from "node:assert/strict";
import { placeholdersIn, sjabloonDelen, soortVan, knoopVoor, paneelBoom, onbekendePlaceholders, lijstAlsTabel, isWaardenlijst, celTekst } from "./schemaPaneel.js";
import { DOSSIER_SCHRIJVER_SCHEMA, ZAAKTYPE_SCHRIJVER_SCHEMA } from "../diagramprofielen/canoniek-uml/inrichtingSchemas.js";
import { CANONIEK_NAAR_DOSSIER } from "../diagramprofielen/canoniek-uml/dossierRegels.js";
import { CANONIEK_NAAR_ZAAKTYPE } from "../diagramprofielen/canoniek-uml/zaaktypeRegels.js";
import { standVan } from "../transformatie/regelsetCatalogus.js";
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

test("de stand van de dossierbundel is geldig, volledig beschreven en ingedeeld per onderdeel", () => {
  const stand = standVan(CANONIEK_NAAR_DOSSIER);
  assert.deepEqual(valideerSchema(stand, DOSSIER_SCHRIJVER_SCHEMA), []);
  const boom = paneelBoom(DOSSIER_SCHRIJVER_SCHEMA, stand);
  assert.deepEqual(boom.onbeschreven, []);
  assert.deepEqual(onbekendePlaceholders(DOSSIER_SCHRIJVER_SCHEMA, stand), []);
  assert.deepEqual(boom.groepen.map((g) => g.naam), ["Dossierdefinitie", "Documentdefinitie", "Dossierformulier", "Tabbladen", "Dossierlijst", "Statussen", "Processen", "Documentkolommen", "Zaaktypekoppeling"]);
  // Elke instelling van de stand staat in het paneel.
  assert.deepEqual(boom.groepen.flatMap((g) => g.knopen.map((k) => k.sleutel)).sort(), Object.keys(stand).sort());

  const componenten = boom.groepen.find((g) => g.naam === "Dossierformulier").knopen.find((k) => k.sleutel === "componenten");
  const tabel = lijstAlsTabel(componenten);
  assert.deepEqual(tabel.kolommen.map((k) => k.titel), ["Regel", "Als het veld", "Component"]);
  assert.deepEqual(tabel.rijen[2].map((c) => c.tekst), ["Getal: number", "type: integer of number", "number"]);
  assert.equal(tabel.rijen[4][1].tekst, "altijd");

  const formats = boom.groepen.find((g) => g.naam === "Documentdefinitie").knopen[0].kinderen.find((k) => k.sleutel === "formats");
  assert.equal(isWaardenlijst(formats), true);
  assert.equal(isWaardenlijst(componenten), false);
  assert.equal(celTekst(true), "ja");
});

test("de stand van het zaaktype is geldig en volledig beschreven", () => {
  const stand = standVan(CANONIEK_NAAR_ZAAKTYPE);
  assert.deepEqual(valideerSchema(stand, ZAAKTYPE_SCHRIJVER_SCHEMA), []);
  const boom = paneelBoom(ZAAKTYPE_SCHRIJVER_SCHEMA, stand);
  assert.deepEqual(boom.onbeschreven, []);
  assert.deepEqual(boom.groepen.map((g) => g.naam), ["Afleidingen", "Volgnummers"]);
  const afleidingen = lijstAlsTabel(boom.groepen[0].knopen[0]);
  assert.deepEqual(afleidingen.rijen[0].map((c) => c.tekst), ["Identificatie uit het aanvraagtype (M0)", "zaaktype.identificatie", "referentielijst: Aanvraagtype; veld: zaaktypeIdentificatie", "altijd"]);
});
