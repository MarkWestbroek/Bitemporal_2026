// Studio — eigenschappenpaneel (regressie 2026-10-12/13): zonder open diagram,
// pijltjes in de boom, opmaak, meegroeiend tekstveld, typekiezer, CSS-lekken.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, node, inModelleren, wachtOpNode } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const inspectorTekst = (page) => page.locator(".dc-inspector").first().innerText().then((t) => t.replace(/\s+/g, " "));
const boomRij = (page, p, e) => page.locator(`[data-boomsleutel="el:el::${p}::${e}"]`).first();

test.beforeEach(async ({ page }) => {
  await openStudio(page);
});

async function zetUseCasesInMap(page) {
  await zetModel(page, { profielId: "usecase05", diagramId: "dk", open: false, elementen: [
    { id: "u1", naam: "Bel op", type: "usecase", data: { beschrijving: "De klant belt. ".repeat(12) }, pos: { x: 300, y: 450 } },
    { id: "u2", naam: "Voer gesprek", type: "usecase" },
  ] });
  await zetModel(page, { profielId: "archimate05", elementen: [{ id: "a1", naam: "Zaaksysteem", type: "app-component" }] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Map"); ms.getState().plaatsMeerdere(["el::usecase05::u1", "el::usecase05::u2", "el::archimate05::a1"], m);');
  await page.waitForTimeout(400);
}

test("eigenschappen zonder open diagram, en de pijltjes volgen", async ({ page }) => {
  await zetUseCasesInMap(page);
  await boomRij(page, "usecase05", "u1").click();
  await expect.poll(() => inspectorTekst(page)).toContain("Bel op");
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => inspectorTekst(page)).toContain("Voer gesprek");
});

test("element uit een ander profiel dan de actieve tab; canvasklik neemt het weer over", async ({ page }) => {
  await zetUseCasesInMap(page);
  await page.evaluate(async () => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("studio:open-diagram", { profielId: "usecase05", diagramId: "dk" });
  });
  await wachtOpNode(page, "u1");
  await boomRij(page, "archimate05", "a1").click();
  await expect.poll(() => inspectorTekst(page)).toContain("Zaaksysteem");
  const b = await node(page, "u1").boundingBox();
  await page.mouse.click(b.x + 20, b.y + b.height / 2);
  await expect.poll(() => inspectorTekst(page)).toContain("Bel op");
  expect(await inModelleren(page, "return ms.getState().elementSelectie")).toEqual({ profielId: "usecase05", elementId: "u1" });
});

test("opmaak zonder diagram: label naast het veld; lange beschrijving groeit mee", async ({ page }) => {
  await zetUseCasesInMap(page);
  await boomRij(page, "usecase05", "u1").click();
  const rij = page.locator(".dc-inspector .dc-inspector-rij").filter({ has: page.locator("textarea") }).first();
  await expect(rij).toHaveCSS("display", "flex");
  const ta = rij.locator("textarea");
  const maat = await ta.evaluate((t) => ({ w: t.getBoundingClientRect().width, h: t.getBoundingClientRect().height, scroll: t.scrollHeight }));
  expect(maat.w).toBeGreaterThan(200);
  expect(maat.h).toBeGreaterThan(60); // meer dan 2 regels: groeit met de inhoud
  expect(Math.abs(maat.h - maat.scroll)).toBeLessThanOrEqual(4);
});

test("globale CSS van de schemapagina's lekt niet in de Studio", async ({ page }) => {
  await zetUseCasesInMap(page);
  await page.evaluate(async () => {
    await import(location.origin + "/viz/react/src/pages/TijdlijnSchemaPage.jsx");
  });
  await page.waitForTimeout(300);
  const stijl = await page.evaluate(() => {
    const l = document.createElement("label");
    const k = document.createElement("button");
    const host = document.querySelector(".studio-project") || document.body;
    host.append(l, k);
    const uit = { label: getComputedStyle(l).flexDirection + " " + getComputedStyle(l).display, knop: getComputedStyle(k).backgroundColor };
    l.remove(); k.remove();
    return uit;
  });
  expect(stijl.label).not.toContain("column");
  expect(stijl.knop).not.toBe("rgb(15, 118, 110)"); // tijdlijn-accent #0f766e
});

test.describe("smal venster", () => {
  test.use({ viewport: { width: 1100, height: 760 } });
  test("typekiezer blijft binnen het venster", async ({ page }) => {
    await zetModel(page, { profielId: "diagram05", diagramId: "dt", elementen: [
      { id: "np", naam: "NatuurlijkPersoon", type: "entiteit", pos: { x: 120, y: 560 }, compartimenten: [
        { compartmentType: "velden", velden: [{ naam: "weergavenaam", fieldType: "attribuut", data: { typeLabel: "string" } }] },
      ] },
    ] });
    await wachtOpNode(page, "np");
    // Via de elementenlijst: in dit smalle venster dekken taakbalken en minimap het canvas.
    await page.locator('div[draggable="true"][title^="NatuurlijkPersoon"]').first().click();
    await page.locator('.dc-inspector button[title="Bladeren…"]').first().click();
    const pop = await page.locator(".dc-minibrowser").first().boundingBox();
    expect(pop.x).toBeGreaterThanOrEqual(0);
    expect(pop.x + pop.width).toBeLessThanOrEqual(1100);
    expect(pop.y + pop.height).toBeLessThanOrEqual(760);
    await page.locator(".dc-minibrowser-item", { hasText: "integer" }).first().click();
    await expect(page.locator(".dc-minibrowser")).toHaveCount(0);
  });
});
