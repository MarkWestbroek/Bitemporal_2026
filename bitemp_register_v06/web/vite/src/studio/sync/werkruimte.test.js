// werkruimte.test.js — werkruimte (tabs, open mappen) naar en van de server, laatste schrijver wint.
// Run: node --import ./test/register-aliases.mjs --test src/studio/sync/werkruimte.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { configureerWerkruimte, werkruimteGewijzigd, verstuur, haalWerkruimteOp, nieuwste, _resetWerkruimteVoorTest } from "./werkruimte.js";

test("nieuwste kiest op bijgewerkt; zonder tijd is lokaal het oudst", () => {
  assert.equal(nieuwste({ bijgewerkt: "2026-10-08T10:00:00Z" }, { bijgewerkt: "2026-10-08T10:05:00Z" }), "server");
  assert.equal(nieuwste({ bijgewerkt: "2026-10-08T10:05:00Z" }, { bijgewerkt: "2026-10-08T10:00:00Z" }), "lokaal");
  assert.equal(nieuwste({ bijgewerkt: null }, { bijgewerkt: "2026-10-08T10:00:00Z" }), "server");
  assert.equal(nieuwste({ bijgewerkt: "2026-10-08T10:00:00Z" }, { bijgewerkt: "2026-10-08T10:00:00Z" }), "lokaal");
});

test("verstuur: alleen als het project op de server staat, en niet tweemaal hetzelfde", async () => {
  _resetWerkruimteVoorTest();
  const puts = [];
  let actief = false;
  configureerWerkruimte({ actief: () => actief, slaWerkruimteOp: async (id, body) => (puts.push({ id, body }), { bijgewerkt: body.bijgewerkt, overgenomen: true }) });
  werkruimteGewijzigd("p1", { tabs: [{ id: "a" }], actieveTab: "a", mapOpen: {} }, "2026-10-08T10:00:00Z");
  assert.equal(await verstuur(), false, "niet op de server: niets sturen");
  actief = true;
  werkruimteGewijzigd("p1", { tabs: [{ id: "a" }], actieveTab: "a", mapOpen: {} }, "2026-10-08T10:00:01Z");
  assert.equal(await verstuur(), true);
  assert.equal(puts.length, 1);
  assert.equal(puts[0].id, "p1");
  assert.deepEqual(puts[0].body.inhoud.tabs, [{ id: "a" }]);
  // Zelfde inhoud nogmaals → geen PUT
  werkruimteGewijzigd("p1", { tabs: [{ id: "a" }], actieveTab: "a", mapOpen: {} }, "2026-10-08T10:00:02Z");
  assert.equal(await verstuur(), false);
  assert.equal(puts.length, 1);
});

test("haalWerkruimteOp: null zonder server of zonder inhoud", async () => {
  _resetWerkruimteVoorTest();
  configureerWerkruimte({ actief: () => true, haalWerkruimteOp: async () => ({ inhoud: { tabs: [] }, bijgewerkt: "2026-10-08T10:00:00Z" }) });
  const uit = await haalWerkruimteOp("p1");
  assert.deepEqual(uit.inhoud, { tabs: [] });
  configureerWerkruimte({ haalWerkruimteOp: async () => { const e = new Error("geen"); e.status = 404; throw e; } });
  assert.equal(await haalWerkruimteOp("p1"), null);
  configureerWerkruimte({ actief: () => false });
  assert.equal(await haalWerkruimteOp("p1"), null);
});
