// Rooktest voor de render-sidecar: node --test render-svc/
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { maakServer } from "./server.mjs";

const model = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../web/vite/src/diagramsvg/fixtures/musicbrain-v3.json", import.meta.url)), "utf8"));
let server;
let basis;

before(async () => {
  server = maakServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  basis = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (pad, body) => fetch(basis + pad, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("POST /render/svg → SVG, twee keer byte-gelijk", async () => {
  const a = await post("/render/svg", { taal: "v3", model, domein: "catalogus" });
  assert.equal(a.status, 200);
  assert.match(a.headers.get("content-type"), /^image\/svg\+xml/);
  const b = await post("/api/render/svg", { taal: "v3", model, domein: "catalogus" });
  const tekst = await a.text();
  assert.equal(tekst, await b.text());
  // De versie staat in de SVG én in de header, en is die van package.json.
  const versie = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
  assert.match(versie, /^\d+\.\d+\.\d+$/);
  assert.equal(a.headers.get("x-render-versie"), versie);
  assert.match(tekst, new RegExp(`^<svg data-render-versie="${versie.replace(/\./g, "\\.")}" xmlns=`));
});

test("fouten als problem+json", async () => {
  const r = await post("/render/svg", { taal: "v3", model });
  assert.equal(r.status, 400);
  assert.match(r.headers.get("content-type"), /^application\/problem\+json/);
  assert.deepEqual((await r.json()).domeinen, ["catalogus", "site"]);
  const onbekend = await post("/render/svg", { taal: "v3", model, domein: "site", kleur: "rood" });
  assert.equal(onbekend.status, 400);
  assert.deepEqual((await onbekend.json()).parameters, ["kleur"]);
});

test("POST /views", async () => {
  const r = await post("/views", { taal: "v3", model });
  assert.deepEqual(await r.json(), { diagrammen: [], domeinen: ["catalogus", "site"] });
});

// ── taal=studio: de echte profielbundel (npm run bouw) en een echt project ──

const project = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../docs/architectuur/omnium-architectuur.studio-project.json", import.meta.url)), "utf8"));
const bundelUrl = new URL("./dist/studio-profielen.mjs", import.meta.url);
const zonderBundel = fs.existsSync(bundelUrl) ? false : "geen profielbundel: draai eerst npm run bouw";

test("taal=studio: elk diagram van een echt project voldoet aan de eisen, byte-gelijk", { skip: zonderBundel }, async () => {
  const views = await (await post("/views", { taal: "studio", model: project })).json();
  assert.ok(views.weergaven.length > 10);
  for (const w of views.weergaven) {
    const invoer = { taal: "studio", model: project, profiel: w.profiel, diagram: w.id };
    const r = await post("/render/svg", invoer);
    const svg = await r.text();
    assert.equal(r.status, 200, `${w.profiel}/${w.naam}: ${svg.slice(0, 200)}`);
    assert.doesNotMatch(/^<svg[^>]*>/.exec(svg)[0], /\b(width|height)="/);
    assert.doesNotMatch(svg, /<(script|style|foreignObject|image)\b|\son[a-z]+=/i);
    assert.doesNotMatch(svg, /NaN/);
    assert.match(svg, /<title /);
    assert.match(svg, /data-tekenaar="vol"/);
    assert.equal(svg, await (await post("/render/svg", invoer)).text());
  }
});

test("taal=studio: alle profielen registreren zonder browser", { skip: zonderBundel }, async () => {
  const { profielIds, descriptorVan } = await import(bundelUrl);
  assert.equal(profielIds.length, 26); // 26 sinds het SHACL-profiel (studio 0.34.0)
  for (const id of profielIds) assert.ok(descriptorVan(id)?.elementTypes?.length, id);
});

test("taal=studio: V3-opties zijn een 400, v3 kent 'profiel' niet", async () => {
  const a = await post("/render/svg", { taal: "studio", model: project, domein: "x" });
  assert.equal(a.status, 400);
  assert.deepEqual((await a.json()).parameters, ["domein"]);
  assert.equal((await post("/render/svg", { taal: "v3", model, profiel: "x" })).status, 400);
});

// ── V3-export van een Studio-project (07-11) ──────────────────────────────────

test("POST /export/v3: rondreis V3 → Studio-profiel → V3 houdt de entiteiten en hun velden", async () => {
  const { v3NaarProfiel } = await import("./dist/studio-profielen.mjs");
  const profiel = v3NaarProfiel(model);
  const r = await post("/export/v3", { profiel });
  assert.equal(r.status, 200);
  const uit = await r.json();
  const versie = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
  assert.equal(uit.renderVersie, versie);
  const v3 = uit.model.model || uit.model;
  const naam = (m) => (m.entiteiten || []).map((e) => e.typenaam).sort();
  assert.deepEqual(naam(v3), naam(model.model || model));
  assert.ok(Array.isArray(uit.meldingen));
});

test("POST /export/v3: ops ná de snapshot worden nagespeeld; een oude overerving-edge geeft erft", async () => {
  const profiel = {
    elements: {
      A: { id: "A", naam: "Aanvraag", elementType: "entiteit", compartimenten: [], data: {} },
      G: { id: "G", naam: "GpkAanvraag", elementType: "entiteit", compartimenten: [], data: { materieel: true } },
    },
    diagrams: { d: { id: "d", naam: "D", nodes: [{ elementId: "A", position: { x: 0, y: 0 } }, { elementId: "G", position: { x: 0, y: 200 } }], edges: [{ id: "gen-G-A", source: "G", target: "A", data: { bron: { isGeneralization: true } } }] } },
    meta: {},
  };
  const ops = [{ volgnummer: 12, store: "model:diagram05", op: "patchElementen", args: [{ zet: { N: { id: "N", naam: "Nieuw", elementType: "entiteit", compartimenten: [], data: {} } }, wis: [] }] }];
  const uit = await (await post("/export/v3", { profiel, ops })).json();
  assert.equal(uit.nagespeeld, 1);
  const v3 = uit.model.model || uit.model;
  const ent = Object.fromEntries((v3.entiteiten || []).map((e) => [e.typenaam, e]));
  assert.ok(ent.Nieuw, "de entiteit uit de op staat erin");
  assert.equal(ent.GpkAanvraag.erft, "Aanvraag", "erft uit de gevouwen overerving");
  assert.ok(!ent.GpkAanvraag.isMaterieel, "subtype zonder eigen tijdlijn");
});

test("POST /export/v3: fouten in de invoer als problem+json", async () => {
  const zonder = await post("/export/v3", {});
  assert.equal(zonder.status, 400);
  const onbekend = await post("/export/v3", { profiel: {}, kleur: "rood" });
  assert.equal(onbekend.status, 400);
  const opsGeenLijst = await post("/export/v3", { profiel: {}, ops: "x" });
  assert.equal(opsGeenLijst.status, 400);
});
