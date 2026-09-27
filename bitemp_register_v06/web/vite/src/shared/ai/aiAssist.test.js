import { test } from "node:test";
import assert from "node:assert/strict";
import { bouwVraag, voegVoorstelIn, ACTIES } from "./aiAssist.js";
import { leesInstellingen, zetProfiel, actiefProfiel, endpointVoor, bewaarInstellingen, OPSLAGSLEUTEL } from "./aiProfielen.js";

const geheugen = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

test("bouwVraag: actie, eigen opdracht, context; alleen veld en tekst gaan mee", () => {
  const v = bouwVraag({ actie: "korter", tekst: "Een lange tekst.", veldLabel: "Omschrijving", formulier: "Aanmelding" });
  assert.match(v.systeem, /ALLEEN de nieuwe tekst/);
  assert.match(v.vraag, /Formulier: Aanmelding/);
  assert.match(v.vraag, /Opdracht: Maak deze tekst korter/);
  assert.match(v.vraag, /<<<\nEen lange tekst.\n>>>/);
  const eigen = bouwVraag({ actie: "korter", eigenOpdracht: "schrijf een korte samenvatting van onze doelstellingen", tekst: "" });
  assert.match(eigen.vraag, /Opdracht: schrijf een korte samenvatting/);
  assert.match(eigen.vraag, /Het veld is nog leeg/);
  assert.equal(bouwVraag({ actie: "bestaat-niet" }), null);
  assert.ok(ACTIES.length >= 4);
});

test("voegVoorstelIn: achter de tekst met een witregel", () => {
  assert.equal(voegVoorstelIn("Eerste.  ", "Tweede."), "Eerste.\n\nTweede.");
  assert.equal(voegVoorstelIn("", "Tweede."), "Tweede.");
});

test("profielen: bewaren, actief, endpoint; zonder sleutel niet actief", () => {
  const opslag = geheugen();
  let inst = leesInstellingen(opslag);
  assert.equal(actiefProfiel(inst), null);
  inst = zetProfiel(inst, "server", { sleutel: "" });
  assert.equal(actiefProfiel(inst), null, "zonder code is AI niet ingesteld");
  inst = zetProfiel(inst, "server", { sleutel: "om-abc" });
  assert.ok(bewaarInstellingen(opslag, inst));
  const terug = leesInstellingen(opslag);
  assert.equal(actiefProfiel(terug).sleutel, "om-abc");
  assert.equal(endpointVoor(actiefProfiel(terug), "http://localhost:8082/"), "http://localhost:8082/ai/v1/chat/completions");
  const claude = actiefProfiel(zetProfiel(terug, "claude", { sleutel: "sk-ant-x" }));
  assert.equal(claude.model, "claude-opus-5");
  assert.equal(claude.provider, "anthropic");
  // kapotte opslag breekt niets
  opslag.setItem(OPSLAGSLEUTEL, "{kapot");
  assert.deepEqual(leesInstellingen(opslag), { actief: "", profielen: [] });
  assert.deepEqual(leesInstellingen({ getItem: () => { throw new Error("geblokkeerd"); } }), { actief: "", profielen: [] });
});

test("profielen met een eigen endpoint (Alibaba, andere OpenAI-compatibele dienst)", () => {
  let inst = { actief: "", profielen: [] };
  inst = zetProfiel(inst, "alibaba", { sleutel: "sk-ali" });
  assert.equal(actiefProfiel(inst), null, "zonder endpoint niet ingesteld");
  inst = zetProfiel(inst, "alibaba", { sleutel: "sk-ali", endpoint: "http://onveilig/v1/chat/completions" });
  assert.equal(actiefProfiel(inst), null, "alleen https");
  inst = zetProfiel(inst, "alibaba", { sleutel: "sk-ali", endpoint: "https://ws1.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions" });
  const p = actiefProfiel(inst);
  assert.equal(p.model, "qwen-plus");
  assert.equal(endpointVoor(p, "http://localhost:8082"), "https://ws1.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions");
  // een vast endpoint (DeepSeek) is niet te overschrijven
  const ds = actiefProfiel(zetProfiel(inst, "deepseek", { sleutel: "sk-ds", endpoint: "https://elders.example/x" }));
  assert.equal(ds.endpoint, "https://api.deepseek.com/chat/completions");
});
