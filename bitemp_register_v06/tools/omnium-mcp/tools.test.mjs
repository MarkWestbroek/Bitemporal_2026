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
