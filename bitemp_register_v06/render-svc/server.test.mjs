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
  assert.equal(await a.text(), await b.text());
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
