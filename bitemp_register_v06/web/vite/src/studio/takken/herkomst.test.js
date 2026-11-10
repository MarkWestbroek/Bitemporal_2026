import { test } from "node:test";
import assert from "node:assert/strict";
import { herkomstRegel, isBranch } from "./herkomst.js";

test("herkomstRegel: leeg voor een gewoon project, anders ouder, map, basis en wie", () => {
  assert.equal(herkomstRegel(null), "");
  assert.equal(isBranch({ ouderProject: "inrichten" }), true);
  const h = { ouderProject: "inrichten", basisVolgnummer: 4412, mapId: "map_1", afgesplitstOp: "2026-11-09T10:00:00Z", afgesplitstDoor: "mark", gearchiveerd: false };
  const r = herkomstRegel(h, { ouderNaam: "Inrichten", mapNaam: "E-dienst GPK" });
  assert.match(r, /^Branch van "Inrichten" · map "E-dienst GPK" · basis #4412 · afgesplitst .+ door mark$/);
  assert.equal(herkomstRegel({ ouderProject: "x", basisVolgnummer: 3 }), "Branch van x · basis #3");
  assert.match(herkomstRegel({ ...h, gearchiveerd: true }), / · gearchiveerd$/);
});
