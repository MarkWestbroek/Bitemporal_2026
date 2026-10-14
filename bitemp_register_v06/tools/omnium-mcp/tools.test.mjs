import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOLS, voerUit } from "./tools.mjs";
import { maakApi } from "./api.mjs";

const melding = {
  id: 5, soort: "wens", status: "nieuw", titel: "Sluitknop", melder: "gast", gemeld_op: "2026-10-14T03:33:00Z",
  context: { pad: "Test" }, bijlagen: [{ bestand: "b1" }], reacties: [{ auteur: "mark", tekst: "Komt eraan", wanneer: "2026-10-14T04:00:00Z" }],
};

function nepApi() {
  const log = [];
  return {
    log,
    basis: "http://test",
    async get(pad) {
      log.push(["GET", pad]);
      if (pad === "/api/meldingen") return { beheerder: true, meldingen: [melding, { ...melding, id: 1, status: "opgelost", titel: "Oud" }] };
      if (pad === "/api/meldingen/5") return melding;
      if (pad === "/api/auth/me") return { gebruikersnaam: "mark", rol: "beheerder" };
      throw new Error("Melding niet gevonden.");
    },
    async post(pad, body) { log.push(["POST", pad, body]); return null; },
    async put(pad, body) { log.push(["PUT", pad, body]); return null; },
    async bestand() { return { data: "iVBOR", mimeType: "image/png" }; },
  };
}

test("tools hebben een naam, beschrijving en schema", () => {
  for (const t of TOOLS) {
    assert.match(t.name, /^[a-z_]+$/);
    assert.ok(t.description.length > 20, t.name);
    assert.equal(t.inputSchema.type, "object");
  }
});

test("meldingen_lijst: standaard alleen open, met melder voor de beheerder", async () => {
  const r = await voerUit(nepApi(), "meldingen_lijst", {});
  assert.match(r.content[0].text, /^1 melding\(en\) \(beheerder/);
  assert.match(r.content[0].text, /#5 \[wens, nieuw\] Sluitknop — gast/);
  assert.doesNotMatch(r.content[0].text, /Oud/);
  const alle = await voerUit(nepApi(), "meldingen_lijst", { filter: "alle" });
  assert.match(alle.content[0].text, /#1 \[wens, opgelost\] Oud/);
});

test("melding_bekijken: tekst met context en gesprek, plus de afbeelding", async () => {
  const r = await voerUit(nepApi(), "melding_bekijken", { id: 5 });
  assert.match(r.content[0].text, /pad: Test/);
  assert.match(r.content[0].text, /mark \(.*\): Komt eraan/);
  assert.deepEqual(r.content[1], { type: "image", data: "iVBOR", mimeType: "image/png" });
});

test("reageren en behandelen sturen de juiste verzoeken; fouten worden isError", async () => {
  const api = nepApi();
  await voerUit(api, "melding_reageren", { id: 5, tekst: " Opgelost " });
  await voerUit(api, "melding_behandelen", { id: 5, status: "opgelost", toelichting: "In 0.20.2" });
  assert.deepEqual(api.log.slice(-2), [
    ["POST", "/api/meldingen/5/reacties", { tekst: "Opgelost" }],
    ["PUT", "/api/meldingen/5/behandeling", { status: "opgelost", toelichting: "In 0.20.2" }],
  ]);
  const leeg = await voerUit(api, "melding_behandelen", { id: 5 });
  assert.equal(leeg.isError, true);
  const weg = await voerUit(api, "melding_bekijken", { id: 99 });
  assert.equal(weg.isError, true);
  assert.match(weg.content[0].text, /niet gevonden/);
});

test("api: Bearer-token in de header, 401 wordt een duidelijke melding", async () => {
  let kop;
  const api = maakApi({ basis: "http://x/", token: "omt_abc", fetchFn: async (url, opt) => { kop = opt.headers; return new Response("{}", { status: 401 }); } });
  await assert.rejects(api.get("/api/meldingen"), /OMNIUM_TOKEN/);
  assert.equal(kop.Authorization, "Bearer omt_abc");
});

// ── Modeltools (AI-1 stap 2) ──

/** Nep-server met één project: map Test met een use case-diagram (gebruiker, test). */
function nepProjectApi({ recht = "schrijven" } = {}) {
  const log = [];
  const inhoud = {
    formaat: "studio-project", versie: 3, project: { id: "p1", naam: "Zandbak" },
    structuur: { mappen: { m1: { id: "m1", naam: "Test", ouderId: null, volgorde: 1 } }, plaatsing: { "usecase05::d_uc": "m1" } },
    kruisverbanden: [],
    profielen: {
      usecase05: {
        diagramTypeId: "usecase",
        elements: { e_gebr: { id: "e_gebr", naam: "gebruiker", elementType: "actor", compartimenten: [], data: {} } },
        diagrams: { d_uc: { id: "d_uc", naam: "Use case model", diagramType: "usecase", nodes: [{ elementId: "e_gebr", position: { x: 40, y: 40 } }], edges: [] } },
      },
    },
  };
  // Eén operatie ná de snapshot: de use case "test" (moet meegenomen worden).
  const ops = [{ volgnummer: 8, store: "model:usecase05", op: "patchElementen", args: [{ zet: { e_test: { id: "e_test", naam: "test", elementType: "usecase", compartimenten: [], data: {} } }, wis: [] }] },
    { volgnummer: 9, store: "model:usecase05", op: "patchDiagrammen", args: [{ zet: { d_uc: { ...inhoud.profielen.usecase05.diagrams.d_uc, nodes: [...inhoud.profielen.usecase05.diagrams.d_uc.nodes, { elementId: "e_test", position: { x: 300, y: 40 } }] } }, wis: [] }] }];
  return {
    log,
    basis: "http://test",
    async get(pad) {
      log.push(["GET", pad]);
      if (pad === "/api/studio/projecten") return [{ id: "p1", naam: "Zandbak", recht, versie: 3 }];
      if (pad === "/api/studio/projecten/p1") return { id: "p1", naam: "Zandbak", versie: 3, tot_volgnummer: 7, recht, inhoud };
      if (pad.startsWith("/api/studio/projecten/p1/ops?vanaf=7")) return { ops, laatste: 9, meer: false };
      throw new Error(`onverwacht ${pad}`);
    },
    async post(pad, body) { log.push(["POST", pad, body]); return { van: 10, tot: 10 + body.ops.length - 1 }; },
    async put() { throw new Error("niet verwacht"); },
  };
}

test("modeltalen: lijst en één taal met regels en aanwijzingen", async () => {
  const lijst = await voerUit(nepProjectApi(), "modeltalen", {});
  assert.match(lijst.content[0].text, /usecase05 — Use case/);
  const uc = await voerUit(nepProjectApi(), "modeltalen", { taal: "usecase05" });
  assert.match(uc.content[0].text, /associatie: Associatie — actor → usecase/);
  assert.match(uc.content[0].text, /Aanwijzingen:/);
});

test("project_bekijken: boom, en de inhoud van een map met ids (snapshot + ops)", async () => {
  const boom = await voerUit(nepProjectApi(), "project_bekijken", { project: "zandbak" });
  assert.match(boom.content[0].text, /▸ Test\n {2}◇ Use case model \[Use case, d_uc\]/);
  const map = await voerUit(nepProjectApi(), "project_bekijken", { project: "Zandbak", map: "Test" });
  assert.match(map.content[0].text, /element e_gebr: actor "gebruiker"/);
  assert.match(map.content[0].text, /element e_test: usecase "test"/);
});

test("model_wijzigen: voorstel stuurt niets; toepassen stuurt de operaties", async () => {
  const plan = { uitleg: "verbind", diagrammen: [], elementen: [], connectoren: [{ type: "associatie", bron: "e_test", doel: "e_gebr" }] };
  const api = nepProjectApi();
  const voorstel = await voerUit(api, "model_wijzigen", { project: "Zandbak", map: "Test", plan });
  assert.match(voorstel.content[0].text, /Voorstel \(nog niet toegepast\).*1 relatie/);
  assert.match(voorstel.content[0].text, /\+ associatie: gebruiker → test/);
  assert.match(voorstel.content[0].text, /omgedraaid/);
  assert.equal(api.log.filter(([m]) => m === "POST").length, 0);
  const klaar = await voerUit(api, "model_wijzigen", { project: "Zandbak", map: "Test", plan, toepassen: true });
  assert.match(klaar.content[0].text, /^Toegepast/);
  const [, pad, body] = api.log.find(([m]) => m === "POST");
  assert.equal(pad, "/api/studio/projecten/p1/ops");
  assert.match(body.clientId, /^mcp-/);
  assert.deepEqual(body.ops.map((o) => `${o.store}:${o.op}`), ["model:usecase05:patchElementen"]);
  const con = Object.values(body.ops[0].args[0].zet)[0];
  assert.deepEqual([con.source, con.target], ["e_gebr", "e_test"]);
});

test("model_wijzigen: met alleen leesrecht weigert toepassen", async () => {
  const r = await voerUit(nepProjectApi({ recht: "lezen" }), "model_wijzigen", { project: "Zandbak", plan: { diagrammen: [], elementen: [], connectoren: [] }, toepassen: true });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /leesrecht/);
});
