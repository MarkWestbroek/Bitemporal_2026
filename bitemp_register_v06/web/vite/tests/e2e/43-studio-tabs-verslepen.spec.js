// Studio — diagram-tabs verslepen naar een andere plek (Mark, 06-11: "kunnen de tabs door de
// gebruiker in een andere volgorde geplaatst worden?"). De volgorde hoort bij de werkruimte.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const namen = (page) => page.locator(".studio-tabbalk .studio-tab__naam").allInnerTexts();

test("een tab naar links en naar rechts slepen; de volgorde staat in de werkruimte", async ({ page }) => {
  await openStudio(page);
  for (const n of ["Een", "Twee", "Drie"]) {
    await zetModel(page, { profielId: "usecase05", diagramId: `d_tab_${n}`, diagramNaam: n });
  }
  await expect.poll(() => namen(page)).toEqual(expect.arrayContaining(["Een", "Twee", "Drie"]));
  const begin = (await namen(page)).filter((n) => ["Een", "Twee", "Drie"].includes(n));
  expect(begin).toEqual(["Een", "Twee", "Drie"]);

  const tab = (naam) => page.locator(".studio-tab", { has: page.locator(".studio-tab__naam", { hasText: new RegExp(`^${naam}$`) }) });
  // Drie naar links, vóór Een.
  await tab("Drie").dragTo(tab("Een"), { targetPosition: { x: 4, y: 10 } });
  await expect.poll(async () => (await namen(page)).filter((n) => ["Een", "Twee", "Drie"].includes(n))).toEqual(["Drie", "Een", "Twee"]);
  // Drie weer naar rechts, achter Twee.
  const b = await tab("Twee").boundingBox();
  await tab("Drie").dragTo(tab("Twee"), { targetPosition: { x: b.width - 4, y: 10 } });
  await expect.poll(async () => (await namen(page)).filter((n) => ["Een", "Twee", "Drie"].includes(n))).toEqual(["Een", "Twee", "Drie"]);

  // De werkruimte bewaart de volgorde (localStorage, en zo naar de server).
  const bewaard = await inModelleren(page, `const s = ms.getState(); return JSON.parse(localStorage.getItem("studio-werkruimte:" + s.project.id)).tabs.map((t) => t.diagramId);`);
  expect(bewaard.filter((id) => id.startsWith("d_tab_"))).toEqual(["d_tab_Een", "d_tab_Twee", "d_tab_Drie"]);
});
