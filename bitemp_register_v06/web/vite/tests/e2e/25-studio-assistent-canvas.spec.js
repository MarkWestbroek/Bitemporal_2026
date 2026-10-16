// Studio — AI-assistent vanaf het canvas (AI-2 stap 2, 16-10): rechtsklik op een element of het
// lege vlak, het open diagram als doel, en weghalen via het plan. De AI is gemockt.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren, node } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const aiProfiel = { actief: "server", profielen: [{ id: "server", label: "Omnium-server (toegangscode)", provider: "openai", endpoint: "/ai/v1/chat/completions", model: "deepseek-chat", sleutel: "mb-test" }] };

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

test.beforeEach(async ({ page }) => {
  await page.addInitScript((p) => localStorage.setItem("omnium.ai.v1", JSON.stringify(p)), aiProfiel);
  await page.route("**/ai/v1/**", (r) => r.fulfill({ status: 401, json: { error: { message: "mock" } } }));
  await page.addInitScript(() => localStorage.setItem("studio05-assistent-talen", JSON.stringify(["usecase05"])));
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_uc", diagramNaam: "Use case model", elementen: [
    { id: "a1", naam: "Lid", type: "actor", pos: { x: 420, y: 460 } },
    { id: "u1", naam: "Leen boek", type: "usecase", pos: { x: 700, y: 460 } },
    { id: "r1", naam: "", type: "associatie", source: "a1", target: "u1" },
  ] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Test"); ms.getState().plaatsMeerdere(["usecase05::d_uc"], m);');
  await page.waitForTimeout(300);
});

test("rechtsklik op het lege vlak: gesprek over de map, nieuw element landt op het open diagram", async ({ page }) => {
  const vragen = await mockAi(page, { uitleg: "Een use case erbij.", diagrammen: [{ sleutel: "d1", bestaand: "d_uc" }], elementen: [{ sleutel: "u2", type: "usecase", naam: "Verleng lening", diagram: "d1" }], connectoren: [{ type: "associatie", bron: "a1", doel: "u2" }] });
  await page.locator(".react-flow__pane").click({ button: "right", position: { x: 300, y: 700 } });
  await page.getByText("✨ Vraag de assistent…").click();
  const dlg = page.getByTestId("assistent");
  await expect(dlg).toContainText("Assistent — map Test");
  await dlg.locator("textarea").fill("voeg de use case Verleng lening toe voor het lid");
  await dlg.getByRole("button", { name: "Vraag" }).click();
  await expect(page.getByTestId("assistent-voorstel")).toContainText("Op diagram: Use case model");
  // De AI kreeg het open diagram als doel mee.
  expect(vragen[0].messages[1].content).toMatch(/Het open diagram is "Use case model" \(d_uc/);
  await dlg.getByRole("button", { name: "Toepassen" }).click();
  await expect(dlg.locator(".ast-log__klaar")).toContainText("1 element, 1 relatie");
  const uc = await storeStand(page, "usecase05");
  expect(uc.diagrams.d_uc.nodes.length).toBe(3);
  expect(Object.values(uc.elements).some((e) => e.naam === "Verleng lening")).toBe(true);
});

test("rechtsklik op een element: onderwerp mee; weghalen haalt element, relatie en knoop weg", async ({ page }) => {
  const vragen = await mockAi(page, { uitleg: "De actor Lid gaat weg.", diagrammen: [], elementen: [], connectoren: [], verwijderen: ["a1"] });
  await node(page, "a1").click({ button: "right", position: { x: 30, y: 10 } });
  await page.getByText("✨ Vraag de assistent…").click();
  const dlg = page.getByTestId("assistent");
  await dlg.locator("textarea").fill("haal deze actor weg");
  await dlg.getByRole("button", { name: "Vraag" }).click();
  await expect(page.getByTestId("assistent-voorstel")).toContainText("Weg: Lid");
  expect(vragen[0].messages[1].content).toMatch(/Het gaat om actor "Lid" \(a1\)/);
  await dlg.getByRole("button", { name: "Toepassen" }).click();
  await expect(dlg.locator(".ast-log__klaar")).toContainText("1 weggehaald");
  const uc = await storeStand(page, "usecase05");
  expect(uc.elements.a1).toBeUndefined();
  expect(uc.elements.r1).toBeUndefined();
  expect(uc.elements.u1).toBeDefined();
  expect(uc.diagrams.d_uc.nodes.map((n) => n.elementId)).toEqual(["u1"]);
  expect(await inModelleren(page, 'return ms.getState().plaatsing["el::usecase05::a1"] || null;')).toBeNull();
});
