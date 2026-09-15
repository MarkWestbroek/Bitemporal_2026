// scheidingen.test.js — groepsscheidingen in afgeleide taakbalken.
// Run: node --import ./test/register-aliases.mjs --test src/diagramcore/taskbar/scheidingen.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { metGroepScheidingen } from "./scheidingen.js";

const actie = (id) => ({ id });
const ids = (lijst) => lijst.map((a) => (a.sep ? "|" : a.id)).join(" ");

test("zonder groepen geen scheidingen — bestaande profielen veranderen niet", () => {
  const uit = metGroepScheidingen([actie("a"), actie("b"), actie("c")], () => undefined);
  assert.equal(ids(uit), "a b c");
});

test("een streepje op elke groepsgrens, nooit vooraan", () => {
  const groepen = ["business", "business", "app", "app", "motivatie"];
  const uit = metGroepScheidingen(groepen.map((_, i) => actie(`e${i}`)), (i) => groepen[i]);
  assert.equal(ids(uit), "e0 e1 | e2 e3 | e4");
});

test("overgang van en naar ongegroepeerd telt ook als grens", () => {
  const groepen = ["business", undefined, "overig"];
  const uit = metGroepScheidingen(groepen.map((_, i) => actie(`e${i}`)), (i) => groepen[i]);
  assert.equal(ids(uit), "e0 | e1 | e2");
});

test("lege lijst blijft leeg", () => {
  assert.deepEqual(metGroepScheidingen([], () => "x"), []);
});
