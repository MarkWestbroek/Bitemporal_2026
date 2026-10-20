// Studio — doorklikken naar een diagram (M3 verwijstNaar, 20-10, Mark): de kiezer "verwijst naar"
// kiest een diagram in elk profiel; het element krijgt de ⧉-badge, dubbelklik en "Open …" in het
// contextmenu openen het diagram — ook in een ander profiel (tab in Modelleren).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren, node } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("verwijst naar: kiezen over profielen, badge, dubbelklik en Open … openen het diagram", async ({ page }) => {
  await openStudio(page);
  // Doel: een activiteitendiagram (ander profiel).
  await zetModel(page, { profielId: "activity05", diagramId: "d_doel", diagramNaam: "Uitlenen (AD)", open: false, elementen: [
    { id: "b1", type: "begin", pos: { x: 100, y: 460 } },
  ] });
  // Bron: een use case.
  await zetModel(page, { profielId: "usecase05", diagramId: "d_bron", diagramNaam: "Bibliotheek", elementen: [
    { id: "u1", naam: "Leen boek", type: "usecase", pos: { x: 300, y: 460 } },
  ] });
  await node(page, "u1").click({ position: { x: 20, y: 10 } });
  const kiezer = page.getByTestId("diagram-verwijzing-verwijstNaar");
  await expect(kiezer).toBeVisible();
  // De kiezer kent diagrammen in andere profielen (optgroup per profiel).
  await kiezer.selectOption("activity05::d_doel");
  await expect(node(page, "u1").locator(".dc-gedrag-badge")).toBeVisible();
  const data = await page.evaluate(async () => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    return reg.getProfieltype("usecase05").useStore.getState().elements.u1.data.verwijstNaar;
  });
  expect(data).toEqual({ profielId: "activity05", diagramId: "d_doel" });

  // Dubbelklik op de vorm (niet op de naam) opent het AD in een tab.
  await node(page, "u1").dblclick({ position: { x: 80, y: 40 } });
  await expect.poll(() => inModelleren(page, "return ms.getState().actieveTab;")).toBe("activity05::d_doel");

  // In het doeldiagram, zonder selectie: "Verwezen door" noemt de use case (Mark, 20-10).
  await expect(page.getByTestId("verwezen-door")).toContainText("Leen boek");

  // Terug, en via het contextmenu.
  await inModelleren(page, 'ms.getState().openTab("usecase05", "d_bron");');
  await node(page, "u1").click({ button: "right", position: { x: 20, y: 10 } });
  await page.locator(".dc-contextmenu-item", { hasText: "Open Uitlenen (AD)" }).click();
  await expect.poll(() => inModelleren(page, "return ms.getState().actieveTab;")).toBe("activity05::d_doel");
});
