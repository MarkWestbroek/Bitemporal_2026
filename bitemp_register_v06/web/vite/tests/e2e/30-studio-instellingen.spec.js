// Studio-instellingen openen zonder crash (16-10, Mark): de vormvoorbeelden tekenden de
// sequence-levenslijn buiten een React Flow-canvas, en die leest de canvas-store (React Flow #001).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("Studio-instellingen: vormvoorbeelden zonder React Flow-fout", async ({ page }) => {
  const fouten = [];
  page.on("pageerror", (e) => fouten.push(String(e.message)));
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_x", diagramNaam: "X", elementen: [{ id: "a1", naam: "Lid", type: "actor", pos: { x: 300, y: 460 } }] });
  await page.locator('[title*="Studio-instellingen"], [aria-label*="Studio-instellingen"]').first().click();
  await expect(page.getByTestId("voorkeur-op-raster")).toBeVisible();
  await page.waitForTimeout(800);
  expect(fouten.filter((f) => /React Flow|zustand provider/.test(f))).toEqual([]);
});
