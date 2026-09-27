import { test } from "node:test";
import assert from "node:assert/strict";
import { zetDatatypes, datatypeVanVeld, datatypeMelding } from "./datatypeValidatie.js";

// Zoals /api/viz/schema/datatypes ze levert (ingekort).
zetDatatypes([
  { naam: "BSN", basistype: "string", format: "bsn",
    validatie: { pattern: "^[0-9]{9}$", minLength: 9, maxLength: 9, foutmelding: "Voer een geldig BSN in (9 cijfers, 11-proef)",
      regels: [{ naam: "11-proef", type: "checksum", expressie: "(9*d1 + 8*d2 + 7*d3 + 6*d4 + 5*d5 + 4*d6 + 3*d7 + 2*d8 - 1*d9) % 11 == 0" }] } },
  { naam: "NLPostcode", basistype: "string", format: "nl-postcode", normalisatie: "uppercase_letters",
    validatie: { pattern: "^[1-9][0-9]{3}\\s?[A-Z]{2}$", foutmelding: "Voer een geldige postcode in (bijv. 1234 AB)" } },
  { naam: "IBAN", basistype: "string", format: "iban",
    validatie: { regels: [{ naam: "mod-97", type: "function", expressie: "iban_mod97" }] } },
]);

test("datatype op naam, anders op format", () => {
  assert.equal(datatypeVanVeld({ datatype: "BSN" })?.naam, "BSN");
  assert.equal(datatypeVanVeld({ format: "nl-postcode" })?.naam, "NLPostcode");
  assert.equal(datatypeVanVeld({ datatype: "Onbekend" }), null);
});

test("BSN: patroon én 11-proef (checksum-regel uit het model)", () => {
  const veld = { naam: "bsn", datatype: "BSN" };
  assert.equal(datatypeMelding("123456782", veld), "");
  assert.equal(datatypeMelding("123456789", veld), "Voer een geldig BSN in (9 cijfers, 11-proef)"); // 11-proef faalt
  assert.equal(datatypeMelding("12345", veld), "Voer een geldig BSN in (9 cijfers, 11-proef)");
  assert.equal(datatypeMelding("", veld), ""); // leeg/verplicht regelt de aanroeper
});

test("normalisatie vóór het patroon: '1234 ab' is een geldige postcode", () => {
  assert.equal(datatypeMelding("1234 ab", { datatype: "NLPostcode" }), "");
  assert.notEqual(datatypeMelding("0123 AB", { datatype: "NLPostcode" }), "");
});

test("function-regel (IBAN mod-97)", () => {
  assert.equal(datatypeMelding("NL91ABNA0417164300", { datatype: "IBAN" }), "");
  assert.notEqual(datatypeMelding("NL91ABNA0417164301", { datatype: "IBAN" }), "");
});

test("eigen validatie van het veld geldt aanvullend (bron zonder datatype, of strenger formulier)", () => {
  const code = { naam: "code", validatie: { pattern: "^[a-z0-9-]+$", foutmelding: "Kleine letters, cijfers en koppeltekens." } };
  assert.equal(datatypeMelding("nieuwe-organisatie", code), "");
  assert.equal(datatypeMelding("Nieuwe Organisatie", code), "Kleine letters, cijfers en koppeltekens.");
  // strenger dan het datatype: een geldig BSN dat met 1 moet beginnen
  const streng = { datatype: "BSN", validatie: { pattern: "^1", foutmelding: "Moet met 1 beginnen." } };
  assert.equal(datatypeMelding("123456782", streng), "");
  assert.equal(datatypeMelding("999999990", streng) !== "", true);
});
