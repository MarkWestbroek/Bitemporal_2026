import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestUrl, suggesties, adresNaarVelden, adresRegel } from "./adres.js";

const fields = { straatnaam: "Locatie.adres.straatnaam", huisnummer: "Locatie.adres.huisnummer", postcode: "Locatie.adres.postcode",
  woonplaatsnaam: "Locatie.adres.plaats", gemeentenaam: "Locatie.adres.gemeente", land: "Locatie.adres.land", huisletter: "" };

test("suggest-url en suggesties zonder highlight", () => {
  assert.match(suggestUrl("Oudegracht 1 Utrecht"), /suggest\?q=Oudegracht\+1\+Utrecht&fq=type%3Aadres&rows=8$/);
  assert.deepEqual(suggesties({ response: { docs: [{ id: "adr-1", weergavenaam: "<b>Oudegracht</b> 1, 3511AB Utrecht" }] } }), [{ id: "adr-1", label: "Oudegracht 1, 3511AB Utrecht" }]);
  assert.deepEqual(suggesties(null), []);
});

test("lookup → velden; land is virtueel; ontbrekend wordt leeg; lege koppeling genegeerd", () => {
  const doc = { straatnaam: "Oudegracht", huisnummer: 1, postcode: "3511AB", woonplaatsnaam: "Utrecht", gemeentenaam: "Utrecht" };
  assert.deepEqual(adresNaarVelden(doc, fields), {
    "Locatie.adres.straatnaam": "Oudegracht", "Locatie.adres.huisnummer": "1", "Locatie.adres.postcode": "3511AB",
    "Locatie.adres.plaats": "Utrecht", "Locatie.adres.gemeente": "Utrecht", "Locatie.adres.land": "Nederland",
  });
  assert.equal(adresNaarVelden({}, { huisletter: "X.y.z" })["X.y.z"], "");
});

test("adresregel uit formulierwaarden", () => {
  const w = { "Locatie.adres.straatnaam": "Oudegracht", "Locatie.adres.huisnummer": "1", "Locatie.adres.postcode": "3511AB", "Locatie.adres.plaats": "Utrecht" };
  assert.equal(adresRegel(w, fields), "Oudegracht 1, 3511AB Utrecht");
  assert.equal(adresRegel({}, fields), "");
});
