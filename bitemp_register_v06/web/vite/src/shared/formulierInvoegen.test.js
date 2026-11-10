import { test } from "node:test";
import assert from "node:assert/strict";
import { losInvoegingenOp, invoegCodes, FormulierInvoegFout } from "./formulierInvoegen.js";

const aanvraag = { type: "formulier", elementen: [{ type: "veld", veld: "Aanvraag.aanvrager.bsn" }, { type: "veld", veld: "Aanvraag.indienen.akkoord" }] };

test("invoegen: vervangt het element door de elementen van het sjabloon, op dezelfde plek", () => {
  const layout = {
    type: "formulier",
    elementen: [
      { type: "stap", label: "Kaart", elementen: [{ type: "veld", veld: "Gpk.kaart.soort" }] },
      { type: "stap", label: "Indienen", elementen: [{ type: "invoegen", formulier: "aanvraag-algemeen" }, { type: "veld", veld: "Gpk.x" }] },
    ],
  };
  const uit = losInvoegingenOp(layout, (c) => (c === "aanvraag-algemeen" ? aanvraag : null));
  assert.deepEqual(uit.elementen[1].elementen.map((e) => e.veld), ["Aanvraag.aanvrager.bsn", "Aanvraag.indienen.akkoord", "Gpk.x"]);
  assert.equal(layout.elementen[1].elementen[0].type, "invoegen", "origineel onaangeroerd");
  assert.deepEqual(invoegCodes(layout), ["aanvraag-algemeen"]);
});

test("invoegen: ook in een conditioneel (dan) en genest", () => {
  const b = { type: "formulier", elementen: [{ type: "invoegen", formulier: "a" }] };
  const layout = { type: "formulier", elementen: [{ type: "conditioneel", conditie: { veld: "x", op: "nietleeg" }, dan: [{ type: "invoegen", formulier: "b" }] }] };
  const uit = losInvoegingenOp(layout, (c) => ({ a: aanvraag, b })[c]);
  assert.equal(uit.elementen[0].dan.length, 2);
});

test("invoegen: cyclus, onbekende code en lege code geven een fout", () => {
  const a = { type: "formulier", elementen: [{ type: "invoegen", formulier: "b" }] };
  const b = { type: "formulier", elementen: [{ type: "invoegen", formulier: "a" }] };
  assert.throws(() => losInvoegingenOp(a, (c) => ({ a, b })[c], { code: "a" }), (e) => e instanceof FormulierInvoegFout && /a → b → a/.test(e.message));
  assert.throws(() => losInvoegingenOp(a, () => null), /Onbekend formulier om in te voegen: "b"/);
  assert.throws(() => losInvoegingenOp({ type: "formulier", elementen: [{ type: "invoegen" }] }, () => null), /zonder formulier-code/);
});
