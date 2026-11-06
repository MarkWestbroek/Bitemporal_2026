// Studio — rechtsklik op een tab (sluiten: andere, links, rechts, alle) en diagrambundels
// (Mark, 06-11): de open tabs bewaren als bundel in je werkruimte, een bundel openen vóegt zijn
// diagrammen toe aan de open tabs, en delen zet een kopie in het project.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const NAMEN = ["Een", "Twee", "Drie", "Vier"];
const open = async (page) => (await page.locator(".studio-tabbalk .studio-tab__naam").allInnerTexts()).filter((n) => NAMEN.includes(n));
const tab = (page, naam) => page.locator(".studio-tab", { has: page.locator(".studio-tab__naam", { hasText: new RegExp(`^${naam}$`) }) });
const menu = (page) => page.locator(".studio-ctxmenu");

async function maakVier(page) {
  await openStudio(page);
  for (const n of NAMEN) await zetModel(page, { profielId: "usecase05", diagramId: `d_b_${n}`, diagramNaam: n });
  await expect.poll(() => open(page)).toEqual(NAMEN);
}

test("rechtsklik op een tab: sluit rechts, links, andere en alle", async ({ page }) => {
  await maakVier(page);
  await tab(page, "Drie").click({ button: "right" });
  await menu(page).getByRole("button", { name: "Sluit alle tabs rechts (1)" }).click();
  await expect.poll(() => open(page)).toEqual(["Een", "Twee", "Drie"]);

  await tab(page, "Twee").click({ button: "right" });
  await menu(page).getByRole("button", { name: "Sluit alle tabs links (1)" }).click();
  await expect.poll(() => open(page)).toEqual(["Twee", "Drie"]);

  await tab(page, "Drie").click({ button: "right" });
  await menu(page).getByRole("button", { name: "Sluit andere tabs" }).click();
  await expect.poll(() => open(page)).toEqual(["Drie"]);
  await expect(tab(page, "Drie")).toHaveClass(/is-actief/);

  await tab(page, "Drie").click({ button: "right" });
  await menu(page).getByRole("button", { name: "Sluit alle tabs", exact: true }).click();
  await expect(page.locator(".studio-tabbalk")).toHaveCount(0);
});

test("bundel: bewaren, openen voegt toe, delen met het project", async ({ page }) => {
  await maakVier(page);
  // Alleen Een en Twee open houden en die bewaren.
  await tab(page, "Twee").click({ button: "right" });
  await menu(page).getByRole("button", { name: /Sluit alle tabs rechts/ }).click();
  await expect.poll(() => open(page)).toEqual(["Een", "Twee"]);

  await page.getByTestId("bundel-bewaar").click();
  const dialoog = page.locator(".studio-dialoog");
  await dialoog.locator("input").fill("Kern");
  await dialoog.getByRole("button", { name: "Bewaar" }).click();
  const rij = page.getByTestId("bundels").locator(".studio-bundel", { hasText: "Kern" });
  await expect(rij).toHaveCount(1);
  await expect(rij).toContainText("2");

  // Openen voegt toe: Vier staat open, Een en Twee komen erbij, Vier blijft.
  await tab(page, "Twee").click({ button: "right" });
  await menu(page).getByRole("button", { name: "Sluit alle tabs", exact: true }).click();
  await inModelleren(page, `ms.getState().openTab("usecase05", "d_b_Vier");`);
  await expect.poll(() => open(page)).toEqual(["Vier"]);
  await rij.click();
  await expect.poll(() => open(page)).toEqual(["Vier", "Een", "Twee"]);
  await expect(tab(page, "Een")).toHaveClass(/is-actief/);

  // De bundel staat in de werkruimte (niet in het project).
  const werkruimte = await inModelleren(page, `const s = ms.getState(); return JSON.parse(localStorage.getItem("studio-werkruimte:" + s.project.id)).bundels;`);
  expect(werkruimte.map((b) => [b.naam, b.tabs.map((t) => t.diagramId)])).toEqual([["Kern", ["d_b_Een", "d_b_Twee"]]]);
  expect(await inModelleren(page, `return Object.keys(ms.getState().bundels).length;`)).toBe(0);

  // Delen: een kopie in het project (👥), de eigen blijft.
  await rij.click({ button: "right" });
  await menu(page).getByRole("button", { name: "Deel met het project" }).click();
  const rijen = page.getByTestId("bundels").locator(".studio-bundel", { hasText: "Kern" });
  await expect(rijen).toHaveCount(2);
  await expect(rijen.first()).toContainText("👥");
  const gedeeld = await inModelleren(page, `return Object.values(ms.getState().bundels).map((b) => [b.naam, b.tabs.map((t) => t.diagramId)]);`);
  expect(gedeeld).toEqual([["Kern", ["d_b_Een", "d_b_Twee"]]]);
  // En het gaat mee in het projectbestand (structuur.bundels) — via de opslag van de projectlaag.
  const inProject = await inModelleren(page, `return Object.values(JSON.parse(localStorage.getItem("studio-modelleren")).bundels || {}).map((b) => b.naam);`);
  expect(inProject).toEqual(["Kern"]);
});
