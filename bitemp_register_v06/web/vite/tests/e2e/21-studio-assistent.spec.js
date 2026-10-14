// Studio — AI-assistent in context (AI-2): rechtsklik op een map → gesprek over die map (nieuwe
// modellen, submappen, meerdere talen, bestaande elementen), rechtsklik op een element → velden.
// Stap 1b (14-10): bestaande elementen, mappen, doorpraten na Toepassen. De AI is gemockt.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const aiProfiel = { actief: "server", profielen: [{ id: "server", label: "Omnium-server (toegangscode)", provider: "openai", endpoint: "/ai/v1/chat/completions", model: "deepseek-chat", sleutel: "mb-test" }] };

/** Mock de AI; `antwoorden` = één antwoord of een lijst (per vraag het volgende). */
async function mockAi(page, antwoorden) {
  const lijst = Array.isArray(antwoorden) ? antwoorden : [antwoorden];
  const vragen = [];
  await page.route("**/ai/v1/chat/completions", async (r) => {
    vragen.push(r.request().postDataJSON());
    const a = lijst[Math.min(vragen.length - 1, lijst.length - 1)];
    await r.fulfill({ json: { model: "test", choices: [{ message: { content: JSON.stringify(a) } }] } });
  });
  return vragen;
}

const storeStand = (page, profielId) => page.evaluate(async (pid) => {
  const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
  const s = reg.getProfieltype(pid).useStore.getState();
  return { elements: s.elements, diagrams: s.diagrams };
}, profielId);

test.beforeEach(async ({ page }, info) => {
  // De test zonder AI-instelling krijgt geen profiel (en nooit een echte AI-aanroep).
  if (!info.title.startsWith("zonder AI")) await page.addInitScript((p) => localStorage.setItem("omnium.ai.v1", JSON.stringify(p)), aiProfiel);
  await page.route("**/ai/v1/**", (r) => r.fulfill({ status: 401, json: { error: { message: "mock: geen echte AI in de test" } } }));
  await page.addInitScript(() => localStorage.setItem("studio05-assistent-talen", JSON.stringify(["usecase05"])));
  await openStudio(page);
});

test("rechtsklik op een map: submap met use case-model én activiteitendiagram, verband, weglatingen", async ({ page }) => {
  const vragen = await mockAi(page, {
    uitleg: "Een use case-model en de uitwerking van lenen.",
    diagrammen: [
      { sleutel: "d1", taal: "usecase05", naam: "Use case model", map: "Use case model" },
      { sleutel: "d2", taal: "activity05", naam: "Leen boek", map: "Use case model" },
    ],
    elementen: [
      { sleutel: "a1", type: "actor", naam: "Lid", diagram: "d1" },
      { sleutel: "u1", type: "usecase", naam: "Leen boek", diagram: "d1" },
      { sleutel: "b", type: "begin", naam: "", diagram: "d2" },
      { sleutel: "x1", type: "actie", naam: "Zoek boek", diagram: "d2" },
      { sleutel: "e", type: "eind", naam: "", diagram: "d2" },
    ],
    connectoren: [
      { type: "associatie", bron: "u1", doel: "a1" },
      { type: "extend", bron: "a1", doel: "u1" },
      { type: "controlestroom", bron: "b", doel: "x1" },
      { type: "controlestroom", bron: "x1", doel: "e" },
    ],
    verbanden: [{ van: "x1", naar: "u1", soort: "realiseert" }],
  });
  await inModelleren(page, 'ms.getState().nieuweMap("Bibliotheek");');
  await page.waitForTimeout(300);
  await page.getByText("Bibliotheek", { exact: true }).first().click({ button: "right" });
  await page.getByText("✨ Vraag de assistent…").click();
  const dlg = page.getByTestId("assistent");
  await dlg.locator("textarea").fill("maak een map use case model met een use case-model en een activiteitendiagram voor lenen");
  await dlg.getByRole("button", { name: "Vraag" }).click();
  const voorstel = page.getByTestId("assistent-voorstel");
  await expect(voorstel).toContainText("Nieuwe map: Use case model");
  await expect(voorstel).toContainText("Lid —Associatie→ Leen boek");
  await expect(voorstel).toContainText("omgedraaid");
  await expect(voorstel).toContainText("Zoek boek realiseert Leen boek");
  await expect(dlg.locator(".ast-problemen summary")).toContainText("1 onderdeel");
  // De prompt: beide talen ("activiteitendiagram" haalt Activity erbij), met de aanwijzingen.
  expect(vragen[0].messages[0].content).toMatch(/## usecase05 — Use case/);
  expect(vragen[0].messages[0].content).toMatch(/## activity05 — Activity/);
  expect(vragen[0].messages[0].content).toMatch(/map "Bibliotheek"/);
  await dlg.getByRole("button", { name: "Toepassen" }).click();
  await expect(dlg.locator(".ast-log__klaar")).toContainText("Toegepast: 1 map, 2 diagrammen, 5 elementen, 3 relaties, 1 verband");
  // Mappen en plaatsing: Bibliotheek / Use case model met beide diagrammen en de elementen.
  const boom = await inModelleren(page, `const s = ms.getState();
    const bieb = Object.values(s.mappen).find((m) => m.naam === "Bibliotheek");
    const sub = Object.values(s.mappen).find((m) => m.naam === "Use case model");
    const erin = Object.entries(s.plaatsing).filter(([, v]) => v === sub.id).map(([k]) => k.split("::")[0] === "el" ? "el:" + k.split("::")[1] : k.split("::")[0]);
    return { ouder: sub.ouderId === bieb.id, erin: erin.sort() };`);
  expect(boom.ouder).toBe(true);
  expect(boom.erin).toEqual(["activity05", "el:activity05", "el:activity05", "el:activity05", "el:usecase05", "el:usecase05", "usecase05"]);
  const uc = await storeStand(page, "usecase05");
  const assoc = Object.values(uc.elements).find((e) => e.elementType === "associatie");
  expect(uc.elements[assoc.source].elementType).toBe("actor");
  // Het gesprek blijft open na Toepassen.
  await expect(dlg.locator("textarea")).toBeVisible();
});

test("bestaande elementen: relatie leggen zonder nieuw diagram; daarna doorpraten", async ({ page }) => {
  await zetModel(page, { profielId: "usecase05", diagramId: "d_uc", diagramNaam: "Use case model", open: false, elementen: [
    { id: "e_gebr", naam: "gebruiker", type: "actor", pos: { x: 40, y: 200 } },
    { id: "e_test", naam: "test", type: "usecase", pos: { x: 300, y: 40 } },
  ] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Test"); ms.getState().plaatsMeerdere(["usecase05::d_uc"], m);');
  const vragen = await mockAi(page, [
    { uitleg: "Associatie tussen gebruiker en test.", diagrammen: [], elementen: [], connectoren: [{ type: "associatie", bron: "e_gebr", doel: "e_test" }] },
    { uitleg: "Hernoemd.", diagrammen: [], elementen: [{ bestaand: "e_test", naam: "Test uitvoeren" }], connectoren: [] },
  ]);
  await page.waitForTimeout(300);
  await page.getByText("Test", { exact: true }).first().click({ button: "right" });
  await page.getByText("✨ Vraag de assistent…").click();
  const dlg = page.getByTestId("assistent");
  await dlg.locator("textarea").fill("wil je een associatie maken tussen gebruiker en test?");
  await dlg.getByRole("button", { name: "Vraag" }).click();
  await expect(page.getByTestId("assistent-voorstel")).toContainText("gebruiker —Associatie→ test");
  // De AI kent wat er al is, met ids.
  expect(vragen[0].messages[0].content).toMatch(/element e_gebr: actor "gebruiker" op d_uc/);
  await dlg.getByRole("button", { name: "Toepassen" }).click();
  await expect(dlg.locator(".ast-log__klaar")).toContainText("Toegepast: 1 relatie");
  let uc = await storeStand(page, "usecase05");
  expect(Object.keys(uc.diagrams)).toEqual(["d_uc"]);
  expect(Object.values(uc.elements).filter((e) => e.source).map((e) => `${e.source}>${e.target}`)).toEqual(["e_gebr>e_test"]);
  // Doorpraten: de geschiedenis gaat mee, met de melding dat het vorige is toegepast.
  await dlg.locator("textarea").fill("noem test liever Test uitvoeren");
  await dlg.getByRole("button", { name: "Vraag" }).click();
  await expect.poll(() => vragen.length).toBe(2);
  expect(vragen[1].messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
  expect(vragen[1].messages[3].content).toMatch(/vorige voorstel is toegepast/);
  await expect(page.getByTestId("assistent-voorstel")).toContainText("test → Test uitvoeren");
  await dlg.getByRole("button", { name: "Toepassen" }).click();
  await expect(dlg.locator(".ast-log__klaar").last()).toContainText("1 hernoemd");
  uc = await storeStand(page, "usecase05");
  expect(uc.elements.e_test.naam).toBe("Test uitvoeren");
});

test("rechtsklik op een element: velden erbij, bestaande niet dubbel; bijsturen houdt het gesprek", async ({ page }) => {
  const vragen = await mockAi(page, { uitleg: "Drie velden.", compartiment: "velden", velden: [{ naam: "aap", type: "string" }, { naam: "noot", type: "int" }, { naam: "mies", type: "tekst" }] });
  await zetModel(page, { profielId: "diagram05", elementen: [
    { id: "ge1", naam: "Persoon", type: "gegevenselement", compartimenten: [{ compartmentType: "velden", velden: [{ naam: "aap", fieldType: "attribuut", data: { typeLabel: "string" } }] }] },
  ] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Map"); ms.getState().plaatsMeerdere(["el::diagram05::ge1"], m);');
  await page.waitForTimeout(400);
  await page.locator('[data-boomsleutel="el:el::diagram05::ge1"]').first().click({ button: "right" });
  await page.getByText("✨ Velden toevoegen met de assistent…").click();
  const dlg = page.getByTestId("assistent");
  await dlg.locator("textarea").fill("voeg de volgende attributen toe: aap: string, noot: int, mies: tekst");
  await dlg.getByRole("button", { name: "Vraag" }).click();
  await expect(page.getByTestId("assistent-voorstel")).toContainText("noot : int");
  await expect(dlg.locator(".ast-problemen summary")).toContainText("1 opmerking");
  // Bijsturen: de eerdere beurten gaan mee.
  await dlg.locator("textarea").fill("mies is verplicht");
  await dlg.getByRole("button", { name: "Aanpassen" }).click();
  await expect.poll(() => vragen.length).toBe(2);
  expect(vragen[1].messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
  await dlg.getByRole("button", { name: "Toepassen" }).click();
  await expect(dlg.locator(".ast-log__klaar")).toContainText("2 veld(en)");
  const velden = await page.evaluate(async () => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const el = reg.getProfieltype("diagram05").useStore.getState().elements.ge1;
    return el.compartimenten.find((c) => c.compartmentType === "velden").velden.map((v) => `${v.naam}:${v.data.typeLabel}`);
  });
  expect(velden).toEqual(["aap:string", "noot:int", "mies:tekst"]);
});

test("zonder AI-instelling: eerst de instellingen", async ({ page }) => {
  await page.evaluate(async () => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("assistent:open", { soort: "model", mapId: null, mapNaam: "" });
  });
  const dlg = page.getByTestId("assistent");
  await dlg.locator("textarea").fill("iets");
  await dlg.getByRole("button", { name: "Vraag" }).click();
  await expect(dlg).toContainText("Kies eerst een AI-dienst");
});

test("uitlijnen (melding #11): naast elkaar met de getekende maten — middens gelijk, zoals de werkbalk", async ({ page }) => {
  await zetModel(page, { profielId: "usecase05", diagramId: "d_uc", diagramNaam: "Use case model", elementen: [
    { id: "e_gebr", naam: "gebruiker", type: "actor", pos: { x: 40, y: 60 } },
    { id: "e_test", naam: "test", type: "usecase", pos: { x: 300, y: 140 }, size: { width: 200, height: 90 } },
  ] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Test"); ms.getState().plaatsMeerdere(["usecase05::d_uc"], m);');
  await mockAi(page, { uitleg: "Op één rij.", diagrammen: [], elementen: [], connectoren: [], opstelling: [{ diagram: "d_uc", actie: "naast-elkaar", elementen: [] }] });
  await page.waitForTimeout(400);
  await page.getByText("Test", { exact: true }).first().click({ button: "right" });
  await page.getByText("✨ Vraag de assistent…").click();
  const dlg = page.getByTestId("assistent");
  await dlg.locator("textarea").fill("lijn alles horizontaal uit");
  await dlg.getByRole("button", { name: "Vraag" }).click();
  await expect(page.getByTestId("assistent-voorstel")).toContainText("naast-elkaar");
  await dlg.getByRole("button", { name: "Toepassen" }).click();
  await expect(dlg.locator(".ast-log__klaar")).toContainText("opnieuw opgesteld");
  await dlg.getByRole("button", { name: "Sluiten" }).click();
  await page.waitForTimeout(300);
  const midden = async (id) => { const b = await page.locator(`.react-flow__node[data-id="${id}"]`).boundingBox(); return b.y + b.height / 2; };
  expect(Math.abs((await midden("e_gebr")) - (await midden("e_test")))).toBeLessThan(2);
});

test("een voorstel dat niets verandert: eerlijk, zonder Toepassen", async ({ page }) => {
  await mockAi(page, { uitleg: "Ik verwijder de actor.", diagrammen: [], elementen: [], connectoren: [] });
  await page.evaluate(async () => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("assistent:open", { soort: "model", mapId: null, mapNaam: "" });
  });
  const dlg = page.getByTestId("assistent");
  await dlg.locator("textarea").fill("verwijder de actor");
  await dlg.getByRole("button", { name: "Vraag" }).click();
  await expect(page.getByTestId("assistent-niets")).toContainText("verandert niets");
  await expect(dlg.getByRole("button", { name: "Toepassen" })).toHaveCount(0);
});
