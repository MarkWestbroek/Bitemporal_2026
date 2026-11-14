import { test } from "node:test";
import assert from "node:assert/strict";
import { startNaam } from "./startNaam.js";

test("startNaam: lidwoord de → Nieuwe…, het of niets → Nieuw… (Mark 14-11)", () => {
  assert.equal(startNaam({ label: "Entiteit", lidwoord: "de" }), "NieuweEntiteit");
  assert.equal(startNaam({ label: "Gegevenselement", lidwoord: "het" }), "NieuwGegevenselement");
  assert.equal(startNaam({ label: "Package (domein)", lidwoord: "het" }), "NieuwPackagedomein");
  assert.equal(startNaam({ label: "Schema" }), "NieuwSchema", "zonder lidwoord: zoals vroeger");
  assert.equal(startNaam({ id: "x1", label: "" }, { tekens: /[^A-Za-z0-9]/g }), "Nieuwx1");
});
