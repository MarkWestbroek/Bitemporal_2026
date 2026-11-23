import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { bewaarStart, leesStart, wisStart, pasStartToe, leesCentraal } from "./startUitProject.js";
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

// ── De vastgepinde centrale versie (stap 5, Mark 22-11) ──
test("centraal: zonder lokale keuze de vastgepinde versie, bewaard als reserve", async () => {
  const kv = geheugenKv();
  const gevraagd = [];
  const centraal = {
    pins: { profielen: "0.3.0", weergaven: null },
    haal: async (soort, versie) => {
      gevraagd.push(`${soort}@${versie}`);
      return { kop: { id: "omnium-sidecar", naam: "P" }, inhoud: { elements: { a: {} } } };
    },
  };
  let kreeg = null;
  const uit = await pasStartToe({ profielen: (inhoud) => ((kreeg = inhoud), {}), weergaven: () => ({}) }, kv, centraal);
  assert.deepEqual(gevraagd, ["profielen@0.3.0"]);
  assert.deepEqual(uit.toegepast, ["profielen"]);
  assert.deepEqual(kreeg, { elements: { a: {} }, diagrams: {} });
  assert.deepEqual(geladen("profielen"), { bron: "project", id: "omnium-sidecar", naam: "P", versie: "0.3.0", concept: false });
  assert.equal((await leesCentraal("profielen", kv)).kop.versie, "0.3.0");
});

test("centraal: een lokale keuze (concept) gaat voor de vastgepinde versie", async () => {
  const kv = geheugenKv();
  await bewaarStart("profielen", { kop: { id: "p", versie: "0.4.0", concept: true }, inhoud: { elements: {} } }, kv);
  let gehaald = false;
  const uit = await pasStartToe({ profielen: () => ({}) }, kv, { pins: { profielen: "0.3.0" }, haal: async () => ((gehaald = true), { kop: {}, inhoud: {} }) });
  assert.equal(gehaald, false);
  assert.deepEqual(uit.toegepast, ["profielen"]);
  assert.equal(geladen("profielen").concept, true);
});

test("centraal: ophalen mislukt → de laatst opgehaalde van dezelfde versie, anders de code", async () => {
  const kv = geheugenKv();
  const goed = { pins: { profielen: "0.3.0" }, haal: async () => ({ kop: { id: "p" }, inhoud: { elements: { x: {} } } }) };
  await pasStartToe({ profielen: () => ({}) }, kv, goed);
  wisGeladen();
  const kapot = (pin) => ({ pins: { profielen: pin }, haal: async () => { throw new Error("offline"); } });
  let uit = await pasStartToe({ profielen: () => ({}) }, kv, kapot("0.3.0"));
  assert.deepEqual(uit.toegepast, ["profielen"]);
  assert.match(uit.fouten[0], /laatst opgehaalde kopie/);
  wisGeladen();
  uit = await pasStartToe({ profielen: () => ({}) }, kv, kapot("0.4.0"));
  assert.deepEqual(uit.toegepast, []);
  assert.match(uit.fouten[0], /gebruikt de code/);
  assert.equal(geladen("profielen").bron, "code");
});
