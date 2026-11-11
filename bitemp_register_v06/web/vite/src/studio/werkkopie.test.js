import { test } from "node:test";
import assert from "node:assert/strict";
import { leesIndex, noteerWerkkopie, teVerwijderen, verwijderWerkkopieen, BEWAAR_DAGEN } from "./werkkopie.js";
import { geheugenKv } from "../diagramcore/model/opslag.js";

function nepOpslag(begin = {}) {
  const m = new Map(Object.entries(begin));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), _m: m };
}
const DAG = 24 * 3600_000;
const nu = Date.parse("2026-11-11T12:00:00Z");

test("noteren: hooguit één keer per uur, wel bij een andere naam", () => {
  const ls = nepOpslag();
  noteerWerkkopie({ id: "p1", naam: "Een" }, { ls, nu });
  assert.deepEqual(leesIndex(ls), { p1: { naam: "Een", laatst: "2026-11-11T12:00:00.000Z" } });
  noteerWerkkopie({ id: "p1", naam: "Een" }, { ls, nu: nu + 60_000 });
  assert.equal(leesIndex(ls).p1.laatst, "2026-11-11T12:00:00.000Z");
  noteerWerkkopie({ id: "p1", naam: "Hernoemd" }, { ls, nu: nu + 60_000 });
  assert.equal(leesIndex(ls).p1.naam, "Hernoemd");
  noteerWerkkopie({ id: "p1", naam: "Hernoemd" }, { ls, nu: nu + 3 * 3600_000 });
  assert.equal(leesIndex(ls).p1.laatst, "2026-11-11T15:00:00.000Z");
  noteerWerkkopie({ id: null }, { ls, nu });
  assert.deepEqual(Object.keys(leesIndex(ls)), ["p1"]);
  assert.deepEqual(leesIndex(nepOpslag({ "studio-werkkopieen": "{kapot" })), {});
});

test("te verwijderen: ouder dan de termijn, nooit het project van deze tab", () => {
  const index = {
    eigen: { naam: "Eigen", laatst: new Date(nu - 90 * DAG).toISOString() },
    oud: { naam: "Oud", laatst: new Date(nu - (BEWAAR_DAGEN + 1) * DAG).toISOString() },
    recent: { naam: "Recent", laatst: new Date(nu - 2 * DAG).toISOString() },
    kapot: { naam: "Kapot", laatst: "geen datum" },
  };
  assert.deepEqual(teVerwijderen(index, { eigenId: "eigen", nu }).sort(), ["kapot", "oud"]);
  assert.deepEqual(teVerwijderen({}, { eigenId: "eigen", nu }), []);
});

test("verwijderen: de modelstores en de localStorage-sleutels van dat project, de rest blijft", async () => {
  const kv = geheugenKv();
  for (const k of ["studio05-uml::oud", "studio05-bpmn::oud", "studio05-uml::recent", "studio05-uml"]) await kv.put(k, { state: {} });
  const ls = nepOpslag({
    "studio-werkkopieen": JSON.stringify({ oud: { naam: "Oud", laatst: "x" }, recent: { naam: "Recent", laatst: "y" } }),
    "studio-project::oud": "{}",
    "studio-kruisverbanden::oud": "{}",
    "studio-outbox::oud": "{}",
    "studio-project::recent": "{}",
    "studio-werkruimte:oud": "{}",
  });
  assert.equal(await verwijderWerkkopieen(["oud"], { ls, kv }), 2);
  assert.deepEqual((await kv.sleutels()).sort(), ["studio05-uml", "studio05-uml::recent"]);
  assert.deepEqual([...ls._m.keys()].sort(), ["studio-project::recent", "studio-werkkopieen", "studio-werkruimte:oud"]);
  assert.deepEqual(Object.keys(leesIndex(ls)), ["recent"]);
  assert.equal(await verwijderWerkkopieen([], { ls, kv }), 0);
});
