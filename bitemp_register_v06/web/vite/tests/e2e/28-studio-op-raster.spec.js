// Studio — op raster (melding #7 van Hugo, 16-10): schakelaar in de taakbalk Uitlijnen; een nieuw
// element valt op het 16px-raster, en de voorkeur blijft bewaard.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("schakelaar # zet 'op raster' aan; een nieuw element staat op het raster", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_r", diagramNaam: "Raster", elementen: [] });
  const knop = page.locator(".dc-taakbalk").getByRole("button", { name: "#", exact: true });
  await expect(knop).not.toHaveClass(/is-actief/);
  await knop.click();
  await expect(knop).toHaveClass(/is-actief/);
  await page.locator(".dc-taakbalk").getByRole("button", { name: "UC", exact: true }).first().click();
  const pos = await page.evaluate(async () => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const d = reg.getProfieltype("usecase05").useStore.getState().diagrams.d_r;
    return d.nodes[0].position;
  });
  expect(pos.x % 16).toBe(0);
  expect(pos.y % 16).toBe(0);
  await knop.click();
  await expect(knop).not.toHaveClass(/is-actief/);
});
