import { test } from "node:test";
import assert from "node:assert/strict";
import { rolNiveau, rolToegestaan, isBeheerder, TOEKENBARE_ROLLEN } from "./rollen.js";

test("rangorde en aliassen gelijk aan middleware/rollen.go", () => {
  assert.equal(rolNiveau("viewer"), rolNiveau("lezer"));
  assert.equal(rolNiveau("editor"), rolNiveau("bouwer"));
  assert.equal(rolNiveau("admin"), rolNiveau("beheerder"));
  assert.ok(rolNiveau("lezer") < rolNiveau("modelleur") && rolNiveau("modelleur") < rolNiveau("ontwerper"));
  assert.ok(rolNiveau("ontwerper") < rolNiveau("bouwer") && rolNiveau("bouwer") < rolNiveau("beheerder"));
  assert.equal(rolNiveau("onbekend"), 0);
  assert.equal(rolNiveau(undefined), 0);
});

test("rolToegestaan: lezer komt in de Studio, modelleur niet in de editor-routes", () => {
  assert.ok(rolToegestaan("lezer", "lezer"));
  assert.ok(rolToegestaan("admin", "lezer"));
  assert.ok(!rolToegestaan("modelleur", "editor"));
  assert.ok(rolToegestaan("editor", "bouwer"));
  assert.ok(!rolToegestaan("admin", "onbekend"));
  assert.ok(isBeheerder("admin") && isBeheerder("beheerder") && !isBeheerder("bouwer"));
  assert.deepEqual(TOEKENBARE_ROLLEN, ["lezer", "modelleur", "ontwerper", "bouwer", "beheerder"]);
});
