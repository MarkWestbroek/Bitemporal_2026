import { test } from "node:test";
import assert from "node:assert/strict";
import { herkomstRegel, isBranch, projectKop } from "./herkomst.js";

test("herkomstRegel: leeg voor een gewoon project, anders ouder, map, basis en wie", () => {
  assert.equal(herkomstRegel(null), "");
  assert.equal(isBranch({ ouderProject: "inrichten" }), true);
  const h = { ouderProject: "inrichten", basisVolgnummer: 4412, mapId: "map_1", afgesplitstOp: "2026-11-09T10:00:00Z", afgesplitstDoor: "mark", gearchiveerd: false };
  const r = herkomstRegel(h, { ouderNaam: "Inrichten", mapNaam: "E-dienst GPK" });
  assert.match(r, /^Branch van "Inrichten" · map "E-dienst GPK" · basis #4412 · afgesplitst .+ door mark$/);
  assert.equal(herkomstRegel({ ouderProject: "x", basisVolgnummer: 3 }), "Branch van x · basis #3");
  assert.match(herkomstRegel({ ...h, gearchiveerd: true }), / · gearchiveerd$/);
});

test("projectKop: naam naast de menutitel, branch met ⑂ en de naam van MAIN", () => {
  assert.deepEqual(projectKop({ naam: "Inrichten", herkomst: null }), { naast: "Inrichten", naastTitel: "Project: Inrichten" });
  assert.equal(projectKop({ naam: "  " }).naast, "Naamloos project");
  const b = projectKop({ naam: "Inrichten — GPK", herkomst: { ouderProject: "p1", basisVolgnummer: 4564, mapId: "m1" }, ouderNaam: "Inrichten" }, { mapNaam: "Gehandicaptenparkeerkaart" });
  assert.equal(b.naast, "⑂ Inrichten — GPK (van Inrichten)");
  assert.equal(b.naastSoort, "branch");
  assert.match(b.naastTitel, /^Branch: Inrichten — GPK\nBranch van "Inrichten" · map "Gehandicaptenparkeerkaart" · basis #4564$/);
  // Naam van MAIN nog niet bekend (eerste render): alleen de branchnaam.
  assert.equal(projectKop({ naam: "B", herkomst: { ouderProject: "p1" } }).naast, "⑂ B");
});
