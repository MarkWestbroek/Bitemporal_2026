import { test } from "node:test";
import assert from "node:assert/strict";
import { korteConditie } from "./formulierConditie.js";

test("korteConditie: laatste padstuk, = en ≠, woorden voor leeg/ingevuld, ja/nee", () => {
  assert.equal(korteConditie({ veld: "Gehandicaptenparkeerkaartaanvraag.gpkaanvraag_kaarten.eerdereKaart", op: "==", waarde: true }), "eerdereKaart = ja");
  assert.equal(korteConditie({ veld: "A.b.soort", op: "==", waarde: "bestuurder" }), "soort = bestuurder");
  assert.equal(korteConditie({ veld: "A.b.soort", op: "!=", waarde: "false" }), "soort ≠ nee");
  assert.equal(korteConditie({ veld: "A.b.kenteken", op: "nietleeg" }), "kenteken is ingevuld");
  assert.equal(korteConditie({ veld: "kenteken" }), "kenteken is ingevuld");
  assert.equal(korteConditie({ veld: "A.b.kenteken", op: "leeg" }), "kenteken is leeg");
  assert.equal(korteConditie(null), "");
});
