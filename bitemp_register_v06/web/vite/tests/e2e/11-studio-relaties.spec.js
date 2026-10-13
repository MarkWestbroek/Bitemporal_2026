// Studio — relaties: van het diagram halen vs. uit het model, relatiepaneel en
// de voorkeur "relaties mee terug" (regressie 2026-10-13).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, node, inStore, wachtOpNode, sleepNaar } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const MODEL = [
  { id: "act", naam: "Klant", type: "actor", pos: { x: 60, y: 450 } },
  { id: "u1", naam: "Zet issue door", type: "usecase", pos: { x: 360, y: 440 } },
  { id: "u2", naam: "Naar collega", type: "usecase", pos: { x: 640, y: 440 } },
  { id: "u3", naam: "Elders", type: "usecase" },
  { id: "as", type: "associatie", source: "act", target: "u1" },
  { id: "ge", type: "generalisatie", source: "u2", target: "u1" },
  { id: "as2", type: "associatie", source: "act", target: "u3" },
];
const stand = (page) =>
  inStore(page, "usecase05", 'const s = store.getState(); return { model: ["as", "ge", "as2"].filter((c) => s.elements[c]), verborgen: s.diagrams.dr.verborgenConnectoren || [] };');
const lijnen = (page) => page.locator(".react-flow__edge").count();
const rijen = (page) => page.locator(".dc-relatie").allInnerTexts().then((t) => t.map((x) => x.replace(/\s+/g, " ").trim()));

test.beforeEach(async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "dr", elementen: MODEL });
  await wachtOpNode(page, "u2");
});

async function selecteer(page, id) {
  const b = await node(page, id).boundingBox();
  await page.mouse.click(b.x + Math.min(30, b.width / 2), b.y + Math.min(20, b.height / 2));
  await page.waitForTimeout(250);
}

test("relatiepaneel: standaard ingeklapt; toont richting, ander uiteinde en stand", async ({ page }) => {
  await selecteer(page, "act");
  await expect(page.locator(".dc-relaties-kop")).toContainText("Relaties (2");
  await expect(page.locator(".dc-relatie")).toHaveCount(0);
  await page.locator(".dc-relaties-kop").click();
  expect(await rijen(page)).toEqual([
    expect.stringContaining("Associatie Zet issue door op dit diagram"),
    expect.stringContaining("Associatie Elders andere kant niet op dit diagram"),
  ]);
  // De open-stand is een voorkeur: blijft open bij een volgend element.
  await selecteer(page, "u1");
  expect(await rijen(page)).toEqual([
    expect.stringContaining("Associatie Klant op dit diagram"),
    expect.stringContaining("Generalisatie Naar collega op dit diagram"),
  ]);
});

test("van diagram en weer tonen via het paneel: model houdt de relatie", async ({ page }) => {
  await selecteer(page, "u1");
  await page.locator(".dc-relaties-kop").click();
  await page.locator(".dc-relatie", { hasText: "Generalisatie" }).locator("button", { hasText: "van diagram" }).click();
  await expect.poll(() => stand(page)).toEqual({ model: ["as", "ge", "as2"], verborgen: ["ge"] });
  await expect.poll(() => lijnen(page)).toBe(1);
  await page.locator(".dc-relatie", { hasText: "Generalisatie" }).locator("button", { hasText: "toon" }).click();
  await expect.poll(() => stand(page)).toEqual({ model: ["as", "ge", "as2"], verborgen: [] });
  await expect.poll(() => lijnen(page)).toBe(2);
});

test("Delete op een lijn haalt hem van het diagram; Ctrl+Delete uit het model", async ({ page }) => {
  const lijn = page.locator(".react-flow__edge").first();
  let b = await lijn.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect(page.locator(".react-flow__edge.selected")).toHaveCount(1);
  const id = await page.locator(".react-flow__edge.selected").evaluate((e) => e.getAttribute("data-id") || e.getAttribute("data-testid"));
  await page.keyboard.press("Delete");
  await expect.poll(() => lijnen(page)).toBe(1);
  expect((await stand(page)).model).toEqual(["as", "ge", "as2"]);
  // Weer tonen en dan Ctrl+Delete: na bevestiging uit het model.
  await inStore(page, "usecase05", 'const s = store.getState(); for (const c of [...(s.diagrams.dr.verborgenConnectoren || [])]) s.toonConnectorOpDiagram("dr", c);');
  await expect.poll(() => lijnen(page)).toBe(2);
  b = await page.locator(".react-flow__edge").first().boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.keyboard.press("Control+Delete");
  await page.locator("button", { hasText: /^Verwijder$/ }).first().click();
  await expect.poll(async () => (await stand(page)).model.length).toBe(2);
  expect(id).toBeTruthy();
});

test("'Van diagram halen' in de inspector werkt ook voor een verbinding", async ({ page }) => {
  const b = await page.locator(".react-flow__edge").first().boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.locator(".dc-inspector button", { hasText: "Van diagram halen" }).first().click();
  await expect.poll(() => lijnen(page)).toBe(1);
  expect((await stand(page)).model).toEqual(["as", "ge", "as2"]);
  expect((await stand(page)).verborgen.length).toBe(1);
});

for (const aan of [true, false]) {
  test(`voorkeur 'relaties mee terug' ${aan ? "aan" : "uit"}`, async ({ page }) => {
    await page.evaluate(async (aan) => {
      const st = await import(location.origin + "/viz/react/src/studio/useStudioStore.js");
      st.default.getState().zetVoorkeur("relatiesMeeTerug", aan);
    }, aan);
    await inStore(page, "usecase05", 'const s = store.getState(); s.verbergConnectorOpDiagram("dr", "as"); s.removeElementFromDiagram("dr", "u1");');
    await sleepNaar(page, page.locator('div[draggable="true"][title^="Zet issue door"]').first(), page.locator(".react-flow__pane").first(), { x: 520, y: 360 });
    await expect.poll(() => inStore(page, "usecase05", 'return store.getState().diagrams.dr.nodes.some((n) => n.elementId === "u1")')).toBe(true);
    expect((await stand(page)).verborgen.includes("as")).toBe(!aan);
  });
}
