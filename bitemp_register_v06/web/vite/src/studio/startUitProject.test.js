import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { bewaarStart, leesStart, wisStart, pasStartToe } from "./startUitProject.js";
import { geheugenKv } from "../diagramcore/model/opslag.js";
import { geladen, wisGeladen } from "./projectGebruik.js";

beforeEach(() => wisGeladen());

test("bewaren, lezen en wissen per soort", async () => {
  const kv = geheugenKv();
  assert.equal(await leesStart("weergaven", kv), null);
  await bewaarStart("weergaven", { kop: { id: "omnium-weergaven", naam: "W", versie: "0.3.0" }, inhoud: { elements: { a: { naam: "x" } } } }, kv);
  const stand = await leesStart("weergaven", kv);
  assert.deepEqual(stand.kop, { id: "omnium-weergaven", naam: "W", versie: "0.3.0" });
  assert.deepEqual(stand.inhoud, { elements: { a: { naam: "x" } }, diagrams: {} });
  await wisStart("weergaven", kv);
  assert.equal(await leesStart("weergaven", kv), null);
});

test("starten: profielen voor weergaven; een fout laat die soort op de code", async () => {
  const kv = geheugenKv();
  await bewaarStart("weergaven", { kop: { id: "w", versie: "1.0.0", concept: true }, inhoud: { elements: {} } }, kv);
  await bewaarStart("profielen", { kop: { id: "p", versie: "2.0.0", concept: true }, inhoud: { elements: {} } }, kv);
  const volgorde = [];
  const uit = await pasStartToe(
    {
      profielen: () => {
        volgorde.push("profielen");
        throw new Error("kapot");
      },
      weergaven: () => {
        volgorde.push("weergaven");
        return { fouten: ["icoon x: geen SVG"] };
      },
    },
    kv
  );
  assert.deepEqual(volgorde, ["profielen", "weergaven"]);
  assert.deepEqual(uit.toegepast, ["weergaven"]);
  assert.equal(uit.fouten.length, 2);
  assert.match(uit.fouten[0], /profielen: starten uit "p" mislukt \(kapot\); de tool gebruikt de code/);
  assert.equal(geladen("profielen").bron, "code");
  assert.deepEqual(geladen("weergaven"), { bron: "project", id: "w", versie: "1.0.0", concept: true });
});
