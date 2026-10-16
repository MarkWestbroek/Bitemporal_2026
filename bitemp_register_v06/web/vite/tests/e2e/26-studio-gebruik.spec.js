// Studio — waar wordt een element gebruikt? (melding #5 van Hugo, 16-10): "Gebruikt op" in de
// inspector, klik opent het diagram; op geen enkel diagram = cursief in boom en lijst.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren, node } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("Gebruikt op: diagrammen in de inspector, klik opent; ongebruikt element cursief", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_twee", diagramNaam: "Tweede diagram", open: false, elementen: [
    { id: "a1", naam: "Lid", type: "actor", pos: { x: 40, y: 40 } },
  ] });
  await zetModel(page, { profielId: "usecase05", diagramId: "d_een", diagramNaam: "Eerste diagram", elementen: [
    { id: "a1", naam: "Lid", type: "actor", pos: { x: 420, y: 460 } },
    { id: "wees", naam: "Wees", type: "usecase" },
  ] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Test"); ms.getState().plaatsMeerdere(["usecase05::d_een", "usecase05::d_twee", "el::usecase05::wees"], m);');
  await page.waitForTimeout(300);
  await node(page, "a1").click({ position: { x: 30, y: 10 } });
  const paneel = page.getByTestId("gebruik-paneel");
  await expect(paneel).toContainText("Gebruikt op (2)");
  await expect(paneel).toContainText("Eerste diagram");
  await paneel.getByRole("button", { name: "Tweede diagram" }).click();
  await expect.poll(() => inModelleren(page, "return ms.getState().actieveTab;")).toBe("usecase05::d_twee");
  // Het ongebruikte element: cursief in de boom.
  const weesRij = page.locator('[data-boomsleutel="el:el::usecase05::wees"] .studio-project__ongebruikt');
  await expect(weesRij).toHaveText("Wees");
  await expect(page.locator('[data-boomsleutel="el:el::usecase05::a1"] .studio-project__ongebruikt')).toHaveCount(0);
});
