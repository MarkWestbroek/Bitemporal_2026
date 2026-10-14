// Studio — AI-assistent in context (AI-2, 14-10): rechtsklik op een map → model in een taal,
// rechtsklik op een element → velden. De AI is gemockt (Omnium-proxy met toegangscode).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren, inStore } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const aiProfiel = { actief: "server", profielen: [{ id: "server", label: "Omnium-server (toegangscode)", provider: "openai", endpoint: "/ai/v1/chat/completions", model: "deepseek-chat", sleutel: "mb-test" }] };

async function mockAi(page, antwoord) {
  const vragen = [];
  await page.route("**/ai/v1/chat/completions", async (r) => {
    vragen.push(r.request().postDataJSON());
    await r.fulfill({ json: { model: "test", choices: [{ message: { content: JSON.stringify(antwoord) } }] } });
  });
  return vragen;
}

test.beforeEach(async ({ page }, info) => {
  // De test zonder AI-instelling krijgt geen profiel (en nooit een echte AI-aanroep).
  if (!info.title.startsWith("zonder AI")) await page.addInitScript((p) => localStorage.setItem("omnium.ai.v1", JSON.stringify(p)), aiProfiel);
  await page.route("**/ai/v1/**", (r) => r.fulfill({ status: 401, json: { error: { message: "mock: geen echte AI in de test" } } }));
  await page.addInitScript(() => localStorage.setItem("studio05-assistent-taal", "usecase05"));
  await openStudio(page);
});

test("rechtsklik op een map: use case-model met voorstel, weglatingen en Toepassen", async ({ page }) => {
  const vragen = await mockAi(page, {
    uitleg: "Twee actoren en vier use cases.",
    diagramNaam: "Meldingen",
    elementen: [
      { sleutel: "a1", type: "actor", naam: "Gebruiker" },
      { sleutel: "a2", type: "actor", naam: "Beheerder" },
      { sleutel: "u1", type: "usecase", naam: "Maak feature request" },
      { sleutel: "u2", type: "usecase", naam: "Bekijk status meldingen" },
      { sleutel: "u3", type: "usecase", naam: "Voeg foto of document toe" },
      { sleutel: "u5", type: "usecase", naam: "Behandel meldingen" },
    ],
    connectoren: [
      { sleutel: "c1", type: "associatie", bron: "a1", doel: "u1" },
      { sleutel: "c2", type: "associatie", bron: "a1", doel: "u2" },
      { sleutel: "c4", type: "associatie", bron: "a2", doel: "u5" },
      { sleutel: "c5", type: "extend", bron: "u3", doel: "u2" },
      { sleutel: "c6", type: "extend", bron: "a1", doel: "u2" },
    ],
  });
  await inModelleren(page, 'ms.getState().nieuweMap("Meldingen");');
  await page.waitForTimeout(300);
  await page.getByText("Meldingen", { exact: true }).first().click({ button: "right" });
  await page.getByText("✨ Vraag de assistent…").click();
  const dlg = page.getByTestId("assistent");
  await dlg.locator("textarea").fill("maak een use case model met de actoren gebruiker en beheerder");
  await dlg.getByRole("button", { name: "Vraag" }).click();
  const voorstel = page.getByTestId("assistent-voorstel");
  await expect(voorstel).toContainText("Gebruiker, Beheerder");
  await expect(voorstel).toContainText("Voeg foto of document toe —Extend→ Bekijk status meldingen");
  await expect(dlg.locator(".ast-problemen summary")).toContainText("1 onderdeel");
  // De prompt kent de taal: typen en verbindingsregels uit het profiel.
  expect(vragen[0].messages[0].content).toMatch(/extend/i);
  expect(vragen[0].messages[1].content).toMatch(/map "Meldingen"/);
  await dlg.getByRole("button", { name: "Toepassen" }).click();
  await expect(page.getByTestId("assistent-klaar")).toContainText("6 elementen en 4 relaties");
  const stand = await inStore(page, "usecase05", 'const s = store.getState(); return { els: Object.values(s.elements).length, diagram: Object.values(s.diagrams).find((d) => d.naam === "Meldingen")?.nodes.length };').catch(async () => {
    return page.evaluate(async () => {
      const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
      const s = reg.getProfieltype("usecase05").useStore.getState();
      return { els: Object.values(s.elements).length, diagram: Object.values(s.diagrams).find((d) => d.naam === "Meldingen")?.nodes.length };
    });
  });
  expect(stand).toEqual({ els: 10, diagram: 6 });
  const inMap = await inModelleren(page, 'const s = ms.getState(); const m = Object.values(s.mappen).find((x) => x.naam === "Meldingen"); return Object.entries(s.plaatsing).filter(([k, v]) => v === m.id && k.startsWith("usecase05::")).length;');
  expect(inMap).toBe(1);
});

test("rechtsklik op een element: velden erbij, bestaande niet dubbel; bijsturen houdt het gesprek", async ({ page }) => {
  const vragen = await mockAi(page, { uitleg: "Drie velden.", compartiment: "velden", velden: [{ naam: "aap", type: "string" }, { naam: "noot", type: "int" }, { naam: "mies", type: "tekst" }] });
  await zetModel(page, { profielId: "diagram05", elementen: [
    { id: "ge1", naam: "Persoon", type: "gegevenselement", compartimenten: [{ compartmentType: "velden", velden: [{ naam: "aap", fieldType: "attribuut", data: { typeLabel: "string" } }] }] },
  ] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Map"); ms.getState().plaatsMeerdere(["el::diagram05::ge1"], m);');
  await page.waitForTimeout(400);
  await page.locator('[data-boomsleutel="el:el::diagram05::ge1"]').first().click({ button: "right" });
  await page.getByText("✨ Vraag de assistent…").click();
  const dlg = page.getByTestId("assistent");
  await dlg.locator("textarea").fill("voeg de volgende attributen toe: aap: string, noot: int, mies: tekst");
  await dlg.getByRole("button", { name: "Vraag" }).click();
  await expect(page.getByTestId("assistent-voorstel")).toContainText("noot : int");
  await expect(dlg.locator(".ast-problemen summary")).toContainText("1 onderdeel");
  // Bijsturen: de eerdere beurten gaan mee.
  await dlg.getByLabel("Bijsturen").fill("mies is verplicht");
  await dlg.getByRole("button", { name: "Aanpassen" }).click();
  await expect.poll(() => vragen.length).toBe(2);
  expect(vragen[1].messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
  await dlg.getByRole("button", { name: "Toepassen" }).click();
  await expect(page.getByTestId("assistent-klaar")).toContainText("2 veld(en)");
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
