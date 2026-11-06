// Studio — Mark, 06-11: "Klikken op de diagram-achtergrond zou de eigenschappen van het diagram
// rechts moeten tonen". Een element-klik daarna toont weer het element.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren, node } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("klik op de achtergrond toont de diagrameigenschappen; een element-klik daarna het element", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_acht", diagramNaam: "Achtergrond", elementen: [
    { id: "lid", naam: "Lid", type: "actor", pos: { x: 400, y: 460 } },
  ] });
  await expect(node(page, "lid")).toBeVisible();
  await node(page, "lid").click({ position: { x: 10, y: 10 } });
  await expect.poll(() => inModelleren(page, "return ms.getState().diagramSelectie;")).toBeNull();

  await page.locator(".react-flow__pane").first().click({ position: { x: 250, y: 520 }, force: true });
  await expect.poll(() => inModelleren(page, "return ms.getState().diagramSelectie;")).toEqual({ profielId: "usecase05", diagramId: "d_acht" });
  // De inspector toont het diagram (naam in het naamveld).
  await expect(page.locator(".studio-inspector, [data-paneel='inspector'], body").locator("input[value='Achtergrond']").first()).toBeVisible();

  await node(page, "lid").click({ position: { x: 10, y: 10 } });
  await expect.poll(() => inModelleren(page, "return ms.getState().diagramSelectie;")).toBeNull();
  expect(await inModelleren(page, "return ms.getState().elementSelectie?.elementId;")).toBe("lid");
});
