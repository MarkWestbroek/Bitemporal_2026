import { test } from "node:test";
import assert from "node:assert/strict";
import { bestaandeBranch, standaardBranchNaam, waaromGeenBranch } from "./branchMaken.js";

test("bestaandeBranch: zelfde ouder en map, niet gearchiveerd; de laatst bijgewerkte", () => {
  const lijst = [
    { id: "main", herkomst: null },
    { id: "oud", bijgewerkt: "2026-11-09T10:00:00Z", herkomst: { ouderProject: "main", mapId: "m1" } },
    { id: "nieuw", bijgewerkt: "2026-11-10T10:00:00Z", herkomst: { ouderProject: "main", mapId: "m1" } },
    { id: "archief", bijgewerkt: "2026-11-11T10:00:00Z", herkomst: { ouderProject: "main", mapId: "m1", gearchiveerd: true } },
    { id: "andere-map", herkomst: { ouderProject: "main", mapId: "m2" } },
    { id: "andere-ouder", herkomst: { ouderProject: "x", mapId: "m1" } },
  ];
  assert.equal(bestaandeBranch(lijst, "main", "m1").id, "nieuw");
  assert.equal(bestaandeBranch(lijst, "main", "m3"), null);
  assert.equal(bestaandeBranch(null, "main", "m1"), null);
});

test("standaardBranchNaam en waaromGeenBranch", () => {
  assert.equal(standaardBranchNaam("Inrichten", "Gehandicaptenparkeerkaart"), "Inrichten — Gehandicaptenparkeerkaart");
  assert.equal(standaardBranchNaam("", ""), "Project — branch");
  assert.match(waaromGeenBranch({ serverVersie: null }), /nog niet op de server/);
  assert.match(waaromGeenBranch({ serverVersie: 3, herkomst: { ouderProject: "main" } }), /al een branch/);
  assert.equal(waaromGeenBranch({ serverVersie: 3, herkomst: null }), null);
});
