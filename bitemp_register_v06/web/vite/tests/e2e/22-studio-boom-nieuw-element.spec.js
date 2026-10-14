// Studio — een nieuw element op een diagram landt in de map van dat diagram (14-10, Mark:
// "vanzelf waar de context is: het diagram"), niet onder "Niet ingedeeld".
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("paletknop: het nieuwe element staat in de map van het open diagram", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_uc", diagramNaam: "Use case model", elementen: [
    { id: "e_gebr", naam: "gebruiker", type: "actor", pos: { x: 40, y: 60 } },
  ] });
  const mapId = await inModelleren(page, 'const m = ms.getState().nieuweMap("Test"); ms.getState().plaatsMeerdere(["usecase05::d_uc"], m); return m;');
  await page.waitForTimeout(300);
  await page.locator(".dc-taakbalk").getByRole("button", { name: "UC", exact: true }).first().click();
  await expect.poll(() => inModelleren(page, 'const s = ms.getState(); return Object.entries(s.plaatsing).filter(([k, v]) => k.startsWith("el::usecase05::") && k !== "el::usecase05::e_gebr" && v === arg).length;', mapId)).toBe(1);
  // Het bestaande, nooit geplaatste element blijft waar het was (niet ingedeeld).
  expect(await inModelleren(page, 'return ms.getState().plaatsing["el::usecase05::e_gebr"] || null;')).toBeNull();
});

test("diagram zonder map: het element blijft niet ingedeeld", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_los", diagramNaam: "Los", elementen: [] });
  await page.waitForTimeout(300);
  await page.locator(".dc-taakbalk").getByRole("button", { name: "UC", exact: true }).first().click();
  await page.waitForTimeout(300);
  expect(await inModelleren(page, 'return Object.keys(ms.getState().plaatsing).filter((k) => k.startsWith("el::")).length;')).toBe(0);
});
