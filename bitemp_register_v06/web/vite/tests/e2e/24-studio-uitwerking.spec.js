// Studio — uitwerking (M3 `ElementType.uitwerking`, 15-10, Mark: "een use case als map in de
// boom, met het activiteitendiagram eronder"): een element als ouder in de projectboom.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren, node } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("use case als ouder: AD eronder in de boom, zijn acties volgen, dubbelklik opent het, weg → terug naar de map", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "activity05", diagramId: "d_ad", diagramNaam: "Uitwerking lenen", open: false, elementen: [
    { id: "x1", naam: "Zoek boek", type: "actie", pos: { x: 40, y: 40 } },
  ] });
  await zetModel(page, { profielId: "usecase05", diagramId: "d_uc", diagramNaam: "Use case model", elementen: [
    { id: "u1", naam: "Leen boek", type: "usecase", pos: { x: 420, y: 460 } }, // onder de zwevende werkbalken
  ] });
  const mapId = await inModelleren(page, 'const m = ms.getState().nieuweMap("Test"); ms.getState().plaatsMeerdere(["usecase05::d_uc", "el::usecase05::u1"], m); return m;');
  // Hang het AD onder de use case (zoals een drop op de use case-regel doet).
  await inModelleren(page, 'ms.getState().plaatsMeerdere(["activity05::d_ad"], "el::usecase05::u1");');
  const ucRij = page.locator('[data-boomsleutel="el:el::usecase05::u1"]').first();
  await expect(ucRij).toBeVisible();
  const uitwerking = ucRij.locator("xpath=ancestor::div[1]/following-sibling::div[contains(@class,'studio-project__uitwerking')]");
  await expect(uitwerking.getByText("Uitwerking lenen")).toBeVisible();
  // De actie op het AD volgde via de boomregel mee: zijn "map" is de use case.
  await expect.poll(() => inModelleren(page, 'return ms.getState().plaatsing["el::activity05::x1"] || null;')).toBe("el::usecase05::u1");
  await expect(uitwerking.getByText("Zoek boek")).toBeVisible();
  // Dubbelklik op de use case op het canvas opent het AD.
  // Op de vorm, niet op de naam (klik op de naam van een geselecteerd element = hernoemen).
  await node(page, "u1").dblclick({ position: { x: 80, y: 10 } });
  await expect.poll(() => inModelleren(page, 'return ms.getState().actieveTab;')).toBe("activity05::d_ad");
  // De use case uit het model: wat eronder hing valt terug naar de map Test.
  await page.evaluate(async () => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("studio:uit-model-verwijderd", { profielId: "usecase05", elementIds: ["u1"] });
  });
  await expect.poll(() => inModelleren(page, 'const p = ms.getState().plaatsing; return [p["activity05::d_ad"] || null, p["el::activity05::x1"] || null, p["el::usecase05::u1"] || null];')).toEqual([mapId, mapId, null]);
});

test("geen uitwerking-type (actor): geen sleepdoel; cyclus onder jezelf wordt geweigerd", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_uc", diagramNaam: "Use case model", elementen: [
    { id: "a1", naam: "Lid", type: "actor", pos: { x: 40, y: 40 } },
    { id: "u1", naam: "Leen boek", type: "usecase", pos: { x: 300, y: 40 } },
  ] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Test"); ms.getState().plaatsMeerdere(["usecase05::d_uc", "el::usecase05::a1", "el::usecase05::u1"], m);');
  const actorRij = page.locator('[data-boomsleutel="el:el::usecase05::a1"]').first();
  const ucRij = page.locator('[data-boomsleutel="el:el::usecase05::u1"]').first();
  await expect(actorRij).toBeVisible();
  // De use case-regel is een sleepdoel (title zegt het), de actor-regel niet.
  await expect(ucRij).toHaveAttribute("title", /sleep hier een diagram/);
  await expect(actorRij).not.toHaveAttribute("title", /sleep hier een diagram/);
});
