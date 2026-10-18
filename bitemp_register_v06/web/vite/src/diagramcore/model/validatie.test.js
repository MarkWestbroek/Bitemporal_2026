import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseerMeldingen, valideerElement } from "./validatie.js";

test("normaliseerMeldingen: niets, tekst, lijst met teksten en objecten; onbekend niveau = waarschuwing", () => {
  assert.deepEqual(normaliseerMeldingen(undefined), []);
  assert.deepEqual(normaliseerMeldingen("Geen trigger"), [{ niveau: "waarschuwing", tekst: "Geen trigger" }]);
  assert.deepEqual(normaliseerMeldingen(["a", { niveau: "fout", tekst: "b" }, { niveau: "raar", tekst: "c" }, { tekst: "" }, "  "]), [
    { niveau: "waarschuwing", tekst: "a" },
    { niveau: "fout", tekst: "b" },
    { niveau: "waarschuwing", tekst: "c" },
  ]);
});

test("valideerElement: roept de hook met element en context; een gooiende hook geeft geen meldingen", () => {
  let gezien = null;
  const et = { hooks: { valideer: (el, ctx) => { gezien = [el.id, Object.keys(ctx.elements)]; return [{ niveau: "info", tekst: "ok" }]; } } };
  assert.deepEqual(valideerElement(et, { id: "u1" }, { elements: { u1: {} } }), [{ niveau: "info", tekst: "ok" }]);
  assert.deepEqual(gezien, ["u1", ["u1"]]);
  assert.deepEqual(valideerElement({ hooks: { valideer: () => { throw new Error("stuk"); } } }, { id: "x" }), []);
  assert.deepEqual(valideerElement({}, { id: "x" }), []);
});
