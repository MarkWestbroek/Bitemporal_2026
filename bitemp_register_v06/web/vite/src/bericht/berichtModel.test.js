// berichtModel.test.js — tests voor de pure Berichttype-helpers.
// Run met: node --test src/bericht/berichtModel.test.js  (vanuit web/vite/)

import test from "node:test";
import assert from "node:assert/strict";

import {
  nieuwBerichttype,
  voegVeldToe,
  verwijderVeld,
  zetVerplicht,
  verplaatsVeld,
  valideerBerichttype,
  naarOperatonType,
  naarOperatonMessage,
  naarJSONSchema,
  naarBpmnExtensionElements,
  naarV3Berichttype,
  berichtVeldKey,
} from "./berichtModel.js";

const bsnRef = {
  typenaam: "NP_Naam_Data",
  veldnaam: "bsn",
  veldpad: "NatuurlijkPersoon.namen.bsn",
  datatype: "BSN",
  type: "string",
  format: "",
  enum: [],
  afgeleid: false,
  tDimensie: "formeel",
};

const leeftijdRef = {
  typenaam: "NatuurlijkPersoon",
  veldnaam: "leeftijd",
  veldpad: "NatuurlijkPersoon.leeftijd",
  datatype: "",
  type: "integer",
  format: "",
  enum: [],
  afgeleid: true,
  tDimensie: "materieel",
};

const geboorteRef = {
  typenaam: "NatuurlijkPersoon",
  veldnaam: "geboortedatum",
  veldpad: "NatuurlijkPersoon.geboortedatum",
  type: "string",
  format: "date",
  enum: [],
  afgeleid: false,
  tDimensie: "formeel",
};

test("nieuwBerichttype is leeg met naam", () => {
  const bt = nieuwBerichttype("InwonerAanmelding");
  assert.equal(bt.naam, "InwonerAanmelding");
  assert.deepEqual(bt.velden, []);
});

test("voegVeldToe voegt veld toe en dedupliceert", () => {
  let bt = nieuwBerichttype();
  bt = voegVeldToe(bt, bsnRef);
  bt = voegVeldToe(bt, bsnRef); // zelfde sleutel → genegeerd
  assert.equal(bt.velden.length, 1);
  assert.equal(berichtVeldKey(bt.velden[0]), "NP_Naam_Data::bsn");
});

test("zetVerplicht en verwijderVeld werken op sleutel", () => {
  let bt = voegVeldToe(nieuwBerichttype(), bsnRef);
  bt = zetVerplicht(bt, "NP_Naam_Data::bsn", true);
  assert.equal(bt.velden[0].verplicht, true);
  bt = verwijderVeld(bt, "NP_Naam_Data::bsn");
  assert.equal(bt.velden.length, 0);
});

test("verplaatsVeld wisselt volgorde", () => {
  let bt = nieuwBerichttype();
  bt = voegVeldToe(bt, bsnRef);
  bt = voegVeldToe(bt, leeftijdRef);
  bt = verplaatsVeld(bt, "NP_Naam_Data::bsn", +1);
  assert.equal(bt.velden[0].ref.veldnaam, "leeftijd");
  assert.equal(bt.velden[1].ref.veldnaam, "bsn");
});

test("valideerBerichttype meldt lege projectie en lege naam", () => {
  const leeg = { naam: "", velden: [] };
  const meldingen = valideerBerichttype(leeg);
  assert.equal(meldingen.filter((m) => m.niveau === "fout").length, 2);
});

test("valideerBerichttype is schoon bij geldige projectie", () => {
  const bt = voegVeldToe(nieuwBerichttype("X"), bsnRef);
  const meldingen = valideerBerichttype(bt);
  assert.equal(meldingen.filter((m) => m.niveau === "fout").length, 0);
  assert.equal(meldingen.filter((m) => m.niveau === "info").length, 1);
});

test("naarOperatonType mapt OAS-types correct", () => {
  assert.equal(naarOperatonType("integer"), "Long");
  assert.equal(naarOperatonType("number"), "Double");
  assert.equal(naarOperatonType("boolean"), "Boolean");
  assert.equal(naarOperatonType("string", "date"), "Date");
  assert.equal(naarOperatonType("string"), "String");
});

test("naarOperatonMessage levert messageName + getypeerde variabelen met lineage", () => {
  let bt = nieuwBerichttype("InwonerAanmelding");
  bt = voegVeldToe(bt, bsnRef, { verplicht: true });
  bt = voegVeldToe(bt, geboorteRef);
  const msg = naarOperatonMessage(bt);
  assert.equal(msg.messageName, "InwonerAanmelding");
  assert.equal(msg.processVariables.bsn.type, "String");
  assert.equal(msg.processVariables.geboortedatum.type, "Date");
  assert.equal(msg.processVariables.bsn.valueInfo._canoniek.veldpad, "NatuurlijkPersoon.namen.bsn");
  assert.equal(msg.processVariables.bsn.valueInfo._canoniek.verplicht, true);
});

test("naarJSONSchema bouwt geldige property-set met required en enum", () => {
  let bt = nieuwBerichttype("Aanmelding");
  bt = voegVeldToe(bt, bsnRef, { verplicht: true });
  bt = voegVeldToe(bt, geboorteRef);
  const schema = naarJSONSchema(bt);
  assert.equal(schema.type, "object");
  assert.equal(schema.properties.bsn.type, "string");
  assert.equal(schema.properties.geboortedatum.format, "date");
  assert.deepEqual(schema.required, ["bsn"]);
  assert.equal(schema.properties.bsn["x-canoniek"].typenaam, "NP_Naam_Data");
});

test("naarBpmnExtensionElements bevat message + fieldRef-regels", () => {
  let bt = nieuwBerichttype("InwonerAanmelding");
  bt = voegVeldToe(bt, bsnRef, { verplicht: true });
  const xml = naarBpmnExtensionElements(bt);
  assert.match(xml, /<bpmn:message id="Message_InwonerAanmelding" name="InwonerAanmelding">/);
  assert.match(xml, /<canoniek:berichttype/);
  assert.match(xml, /veldpad="NatuurlijkPersoon.namen.bsn"/);
  assert.match(xml, /verplicht="true"/);
});

test("naarV3Berichttype platslaat velden naar V3-formaat", () => {
  let bt = nieuwBerichttype("X");
  bt = voegVeldToe(bt, leeftijdRef, { verplicht: false });
  const v3 = naarV3Berichttype(bt);
  assert.equal(v3.naam, "X");
  assert.equal(v3.velden[0].veldpad, "NatuurlijkPersoon.leeftijd");
  assert.equal(v3.velden[0].afgeleid, true);
  assert.equal(v3.velden[0].tDimensie, "materieel");
});
