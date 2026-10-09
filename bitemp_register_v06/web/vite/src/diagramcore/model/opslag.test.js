// opslag.test.js — IndexedDB-bewaarplaats van de profielstores (met een Map-backend):
// migratie uit localStorage, gebundeld schrijven pas ná hydratatie, fouten melden.
// Run: node --import ./test/register-aliases.mjs --test src/diagramcore/model/opslag.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { maakStoreOpslag, geheugenKv, opslagFouten } from "./opslag.js";

function nepLocalStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m };
}
const slaap = (ms) => new Promise((r) => setTimeout(r, ms));

test("migratie: oude JSON in localStorage komt eenmalig in de kv en verdwijnt uit localStorage", async () => {
  const kv = geheugenKv();
  const ls = nepLocalStorage({ "studio05-x": JSON.stringify({ state: { elements: { a: 1 } }, version: 0 }) });
  const o = maakStoreOpslag("studio05-x", { kv, localStorage: ls, wachtMs: 5 });
  const waarde = await o.getItem("studio05-x");
  assert.deepEqual(waarde, { state: { elements: { a: 1 } }, version: 0 });
  assert.deepEqual(kv.map.get("studio05-x"), waarde, "in de kv gezet");
  assert.equal(ls.getItem("studio05-x"), null, "uit localStorage gehaald");
});

test("schrijven: gebundeld, de laatste stand wint, en nooit vóór de hydratatie", async () => {
  const kv = geheugenKv();
  const o = maakStoreOpslag("studio05-y", { kv, localStorage: nepLocalStorage(), wachtMs: 5 });
  o.setItem("studio05-y", { state: { n: 1 }, version: 0 });
  await slaap(20);
  assert.equal(kv.map.has("studio05-y"), false, "vóór hydratatie wordt niets weggeschreven");
  assert.equal(await o.getItem("studio05-y"), null);
  await slaap(20);
  assert.equal(kv.map.has("studio05-y"), false, "een stand van vóór de hydratatie wordt ook daarna niet weggeschreven");
  o.setItem("studio05-y", { state: { n: 2 }, version: 0 });
  o.setItem("studio05-y", { state: { n: 3 }, version: 0 });
  await slaap(20);
  assert.deepEqual(kv.map.get("studio05-y"), { state: { n: 3 }, version: 0 }, "gebundeld: alleen de laatste");
});

test("regressie 10-10: een lege beginstand vóór de hydratatie wist de bewaarde store niet", async () => {
  // Zustand 5 zet de store vóór het inladen (koppelingen, migraties) en
  // schrijft de geladen stand daarna niet zelf terug. De gebufferde lege
  // stand werd ná de hydratatie weggeschreven: de volgende herlaad was leeg.
  const kv = geheugenKv(new Map([["studio05-z", { state: { elements: { a: 1 } }, version: 0 }]]));
  const o = maakStoreOpslag("studio05-z", { kv, localStorage: nepLocalStorage(), wachtMs: 5 });
  o.setItem("studio05-z", { state: { elements: {} }, version: 0 }); // vóór de hydratatie
  const geladen = await o.getItem("studio05-z");
  assert.deepEqual(geladen, { state: { elements: { a: 1 } }, version: 0 });
  await slaap(30);
  assert.deepEqual(kv.map.get("studio05-z"), { state: { elements: { a: 1 } }, version: 0 }, "bewaarde stand blijft staan");
  o.setItem("studio05-z", { state: { elements: { a: 1, b: 2 } }, version: 0 }); // ná de hydratatie telt wél
  await slaap(30);
  assert.deepEqual(kv.map.get("studio05-z").state.elements, { a: 1, b: 2 });
});

test("flush schrijft meteen; removeItem haalt weg uit kv én localStorage", async () => {
  const kv = geheugenKv();
  const ls = nepLocalStorage({ "studio05-z": "{}" });
  const o = maakStoreOpslag("studio05-z", { kv, localStorage: ls, wachtMs: 10000 });
  await o.getItem("studio05-z");
  o.setItem("studio05-z", { state: { n: 1 }, version: 0 });
  await o.flush();
  assert.deepEqual(kv.map.get("studio05-z"), { state: { n: 1 }, version: 0 });
  await o.removeItem("studio05-z");
  assert.equal(kv.map.has("studio05-z"), false);
  assert.equal(ls.getItem("studio05-z"), null);
});

test("fout in de kv: gemeld in opslagFouten, de store werkt door; lezen valt terug op localStorage", async () => {
  const kapot = { get: async () => { throw new Error("kapot"); }, put: async () => { throw new Error("vol"); }, del: async () => {} };
  const ls = nepLocalStorage({ "studio05-f": JSON.stringify({ state: { n: 9 }, version: 0 }) });
  const o = maakStoreOpslag("studio05-f", { kv: kapot, localStorage: ls, wachtMs: 5 });
  const waarde = await o.getItem("studio05-f");
  assert.deepEqual(waarde, { state: { n: 9 }, version: 0 }, "terugval op localStorage");
  o.setItem("studio05-f", { state: { n: 10 }, version: 0 });
  await slaap(20);
  assert.ok(opslagFouten.has("studio05-f"));
  assert.equal(opslagFouten.get("studio05-f").message, "vol");
});
