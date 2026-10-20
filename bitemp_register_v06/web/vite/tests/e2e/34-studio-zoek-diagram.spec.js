// Studio — rechtsklik op het lege canvas: "Zoek in projectboom" voor het open diagram (Mark,
// 20-10). Dichte (sub)mappen klappen open en de diagramregel licht op.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("Zoek in projectboom vindt het diagram in een dichte submap", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_zoek", diagramNaam: "Gezocht diagram", elementen: [
    { id: "u1", naam: "Leen boek", type: "usecase", pos: { x: 300, y: 460 } },
  ] });
  const mappen = await inModelleren(page, `
    const s = ms.getState();
    const boven = s.nieuweMap("Bovenmap");
    const onder = s.nieuweMap("Ondermap", boven);
    s.plaatsMeerdere(["usecase05::d_zoek"], onder);
    ms.setState({ mapOpen: { ...ms.getState().mapOpen, [boven]: false, [onder]: false } });
    return [boven, onder];`);
  await expect(page.locator('[data-boomsleutel="diag:usecase05::d_zoek"]')).toBeHidden();
  await page.locator(".react-flow__pane").first().click({ button: "right", position: { x: 600, y: 300 }, force: true });
  // Bovenaan het kopje "Diagram" (zoals "Element" bij een element), met zoeken en de assistent.
  await expect(page.locator(".dc-contextmenu-kop").first()).toHaveText("Diagram");
  await page.locator(".dc-contextmenu-item", { hasText: "Zoek in projectboom" }).click();
  const regel = page.locator('[data-boomsleutel="diag:usecase05::d_zoek"]');
  await expect(regel).toBeVisible();
  await expect(regel).toHaveClass(/is-flits/);
  const open = await inModelleren(page, "const o = ms.getState().mapOpen; return [o[arg[0]], o[arg[1]]];", mappen);
  expect(open).toEqual([true, true]);
});
