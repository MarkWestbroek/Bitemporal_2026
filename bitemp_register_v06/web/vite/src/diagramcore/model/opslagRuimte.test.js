import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  opslagRuimte,
  oudeRuimte,
  sleutelIn,
  neemtOudeOver,
  zetOpslagRuimte,
  markeerLaatsteProject,
  bijRuimteWissel,
  _resetOpslagRuimte,
} from "./opslagRuimte.js";
import { maakStoreOpslag, geheugenKv } from "./opslag.js";

function nepOpslag(begin = {}) {
  const m = new Map(Object.entries(begin));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), _m: m };
}

const vorige = { ls: globalThis.localStorage, ss: globalThis.sessionStorage };
/** Een "tab": eigen sessionStorage, gedeelde localStorage. */
function tab(ls, ss = nepOpslag()) {
  _resetOpslagRuimte();
  globalThis.localStorage = ls;
  globalThis.sessionStorage = ss;
  return ss;
}

beforeEach(() => _resetOpslagRuimte());
afterEach(() => {
  _resetOpslagRuimte();
  globalThis.localStorage = vorige.ls;
  globalThis.sessionStorage = vorige.ss;
});

test("buiten de browser: geen ruimte, sleutels blijven zoals ze waren", () => {
  globalThis.localStorage = undefined;
  globalThis.sessionStorage = undefined;
  assert.equal(opslagRuimte(), null);
  assert.equal(sleutelIn("studio05-x"), "studio05-x");
  assert.equal(neemtOudeOver(), false);
  zetOpslagRuimte("project-a"); // doet niets
  assert.equal(opslagRuimte(), null);
});

test("eerste bezoek: een nieuw id, onthouden voor deze tab", () => {
  const ss = tab(nepOpslag());
  const id = opslagRuimte();
  assert.match(id, /^[A-Za-z0-9_-]{8,64}$/);
  assert.equal(ss.getItem("studio-tab-project"), id);
  assert.equal(sleutelIn("studio05-x"), `studio05-x::${id}`);
  assert.equal(oudeRuimte(), null);
  assert.equal(neemtOudeOver(), false);
  // Herladen (zelfde sessionStorage): hetzelfde project.
  tab(globalThis.localStorage, ss);
  assert.equal(opslagRuimte(), id);
});

test("oude werkkopie: het project uit studio-modelleren neemt de oude sleutels over, een ander niet", () => {
  const ls = nepOpslag({ "studio-modelleren": JSON.stringify({ project: { id: "project-oud", naam: "Oud" } }) });
  tab(ls);
  assert.equal(opslagRuimte(), "project-oud");
  assert.equal(neemtOudeOver(), true);
  assert.equal(ls.getItem("studio-werkkopie-oud-project"), "project-oud");
  // De tab wisselt van project: het oude id blijft vastliggen, het nieuwe project neemt niets over.
  zetOpslagRuimte("project-nieuw");
  assert.equal(opslagRuimte(), "project-nieuw");
  assert.equal(oudeRuimte(), "project-oud");
  assert.equal(neemtOudeOver(), false);
});

test("twee tabs: elk zijn eigen project; een nieuwe tab krijgt het laatst bewerkte", () => {
  const ls = nepOpslag();
  const ss1 = tab(ls);
  zetOpslagRuimte("project-een");
  markeerLaatsteProject();
  // Tab 2 opent: het laatst bewerkte project, en wisselt dan naar een ander.
  const ss2 = tab(ls);
  assert.equal(opslagRuimte(), "project-een");
  zetOpslagRuimte("project-twee");
  markeerLaatsteProject();
  assert.equal(sleutelIn("studio05-x"), "studio05-x::project-twee");
  // Tab 1 herlaadt: nog steeds zijn eigen project, wat tab 2 ook deed.
  tab(ls, ss1);
  assert.equal(opslagRuimte(), "project-een");
  tab(ls, ss2);
  assert.equal(opslagRuimte(), "project-twee");
});

test("wissel: abonnees horen het nieuwe en het vorige project; een ongeldig id wisselt niet", () => {
  tab(nepOpslag());
  zetOpslagRuimte("project-a");
  const gezien = [];
  const af = bijRuimteWissel((nieuw, oud) => gezien.push([nieuw, oud]));
  zetOpslagRuimte("project-b");
  zetOpslagRuimte("project-b"); // zelfde: geen wissel
  zetOpslagRuimte("met spatie"); // ongeldig
  zetOpslagRuimte("");
  assert.deepEqual(gezien, [["project-b", "project-a"]]);
  assert.equal(opslagRuimte(), "project-b");
  af();
  zetOpslagRuimte("project-c");
  assert.equal(gezien.length, 1);
});

test("opslag: de oude sleutel verhuist één keer naar de eigen sleutel", async () => {
  const kv = geheugenKv();
  await kv.put("studio05-x", { state: { elements: { a: 1 } }, version: 0 });
  const opslag = maakStoreOpslag("studio05-x::p1", { kv, localStorage: null, wachtMs: 0, oudeNaam: "studio05-x" });
  assert.deepEqual(await opslag.getItem("studio05-x::p1"), { state: { elements: { a: 1 } }, version: 0 });
  assert.deepEqual(await kv.sleutels(), ["studio05-x::p1"]);
  // Een ander project (zonder oudeNaam) vindt niets, en neemt dus niets over.
  await kv.put("studio05-y", { state: { elements: { b: 1 } }, version: 0 });
  const ander = maakStoreOpslag("studio05-y::p2", { kv, localStorage: null, wachtMs: 0 });
  assert.equal(await ander.getItem("studio05-y::p2"), null);
  assert.ok((await kv.sleutels()).includes("studio05-y"));
  // Staat er al een eigen werkkopie, dan blijft de oude sleutel met rust.
  await kv.put("studio05-z", { state: { oud: true }, version: 0 });
  await kv.put("studio05-z::p1", { state: { eigen: true }, version: 0 });
  const eigen = maakStoreOpslag("studio05-z::p1", { kv, localStorage: null, wachtMs: 0, oudeNaam: "studio05-z" });
  assert.deepEqual(await eigen.getItem("studio05-z::p1"), { state: { eigen: true }, version: 0 });
  assert.ok((await kv.sleutels()).includes("studio05-z"));
});

test("opslag: `geladen` schrijft meteen, zonder eerst te lezen (verhuizing bij een projectwissel)", async () => {
  const kv = geheugenKv();
  const gewoon = maakStoreOpslag("k::p1", { kv, localStorage: null, wachtMs: 0 });
  gewoon.setItem("k::p1", { state: 1 });
  await gewoon.flush();
  assert.deepEqual(await kv.sleutels(), []); // vóór het inladen wordt niet geschreven
  const verhuisd = maakStoreOpslag("k::p2", { kv, localStorage: null, wachtMs: 0, geladen: true });
  verhuisd.setItem("k::p2", { state: 2 });
  await verhuisd.flush();
  assert.deepEqual(await kv.get("k::p2"), { state: 2 });
});
