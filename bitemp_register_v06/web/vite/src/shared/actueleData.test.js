import { test } from "node:test";
import assert from "node:assert/strict";
import { actueleData, actueleHubData } from "./actueleData.js";

test("afgevoerde hub telt niet mee, ook niet als terugval (FD 18)", () => {
  const fd18 = { formulier_definitie_metas: [
    { rel_id: 1, opvoer: "t1", afvoer: "t5", data: [{ versie: 1, opvoer: "t1", afvoer: "t2", naam: "RAW" }, { versie: 2, opvoer: "t2", naam: "RAW-v2" }] },
    { rel_id: 2, opvoer: "t5", data: [] },
  ] };
  assert.equal(actueleData(fd18, "formulier_definitie_metas"), null);
});

test("laatst opgevoerde actieve hub wint; rel_id mee", () => {
  const hubs = [
    { rel_id: 1, opvoer: "2026-01-01", data: [{ opvoer: "2026-01-01", naam: "oud" }] },
    { rel_id: 2, opvoer: "2026-02-01", data: [{ opvoer: "2026-02-01", afvoer: "2026-02-02", naam: "v1" }, { opvoer: "2026-02-02", naam: "nieuw" }] },
  ];
  assert.deepEqual(actueleHubData(hubs), { data: hubs[1].data[1], relId: 2 });
});

test("alleen afgevoerde versies → null; lege invoer → null", () => {
  assert.equal(actueleData({ x: [{ rel_id: 1, data: [{ opvoer: "a", afvoer: "b" }] }] }, "x"), null);
  assert.equal(actueleData(null, "x"), null);
});
