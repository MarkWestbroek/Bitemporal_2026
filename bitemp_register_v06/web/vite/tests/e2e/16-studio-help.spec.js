// Studio — help (ontwerp 2026-09-10 Begeleiding in de Studio; HELP-1, 14-10): opdrachtenpalet
// met uitleg en groepen, Help-menu met sneltoetsen, lege staat van een diagram, en tips die
// één keer verschijnen.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await openStudio(page);
});

test("opdrachtenpalet: gegroepeerd met uitleg; zoeken op uitleg; naar sneltoetsen", async ({ page }) => {
  await page.keyboard.press("Control+k");
  const palet = page.locator(".studio-palette");
  await expect(palet).toBeVisible();
  await expect(palet.locator(".studio-palette__groep", { hasText: "Help" })).toBeVisible();
  await expect(palet.locator(".studio-palette__item", { hasText: "Sneltoetsen…" }).locator(".studio-palette__uitleg")).toContainText("instelbare");
  await palet.locator("input").fill("instelbare toetsen");
  await expect(palet.locator(".studio-palette__item").first()).toContainText("Sneltoetsen…");
  await page.keyboard.press("Enter");
  const overzicht = page.getByRole("dialog", { name: "Sneltoetsen" });
  await expect(overzicht).toContainText("Hernoemen");
  await expect(overzicht).toContainText("Links uitlijnen");
  await expect(overzicht.locator("kbd", { hasText: "F2" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(overzicht).toHaveCount(0);
});

test("Help-menu: sneltoetsen, tips opnieuw tonen", async ({ page }) => {
  await page.locator(".studio-menubar").getByText("Help", { exact: true }).click();
  await expect(page.getByText("Tips opnieuw tonen")).toBeVisible();
  await page.getByText("Sneltoetsen…").click();
  await expect(page.getByRole("dialog", { name: "Sneltoetsen" })).toBeVisible();
});

test("lege staat: uit het profiel afgeleid, startknop maakt een element; tip één keer", async ({ page }) => {
  await zetModel(page, { profielId: "usecase05", diagramId: "dl", diagramNaam: "Leeg", elementen: [] });
  const leeg = page.getByTestId("lege-canvas");
  await expect(leeg).toBeVisible();
  await expect(leeg).toContainText("Use case");
  await expect(leeg).toContainText("Actor");
  await leeg.locator("button", { hasText: /^\+ / }).first().click();
  await expect(leeg).toHaveCount(0);
  await expect.poll(() => inStore(page, "usecase05", "return store.getState().diagrams.dl.nodes.length")).toBe(1);
  const tip = page.locator(".studio-hint");
  await expect(tip).toHaveAttribute("data-hint-id", "eerste-element");
  await expect(tip).toContainText("F2");
  await tip.getByRole("button", { name: "Begrepen" }).click();
  await expect(tip).toHaveCount(0);
  // Afgeleide tip bij de eerste relatie in dit profiel.
  await inStore(page, "usecase05", `const s = store.getState();
    s.addElement({ id: "u9", naam: "B", elementType: "usecase", data: {}, compartimenten: [] });
    const a = Object.keys(s.elements).find((k) => k !== "u9");
    s.addElement({ id: "as9", naam: "", elementType: "associatie", data: {}, compartimenten: [], source: a, target: "u9" });`);
  await expect(tip).toHaveAttribute("data-hint-id", "eerste-relatie:usecase05");
  await expect(tip).toContainText("soorten relaties");
  await tip.getByRole("button", { name: "Geen tips meer" }).click();
  const opgeslagen = await page.evaluate(() => JSON.parse(localStorage.getItem("studio05-hints-gezien")));
  expect(opgeslagen.uit).toBe(true);
  expect(opgeslagen.gezien["eerste-element"]).toBe(true);
});
