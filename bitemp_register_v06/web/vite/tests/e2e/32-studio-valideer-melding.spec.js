// Studio — meldingen van ElementType.hooks.valideer bovenaan de inspector (18-10). De use case
// krijgt zo'n controle van M3-MOF (geen primaire actor én geen trigger); hier zetten we een hook
// in de test zelf, zodat de inspector-kant los getest is.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, node } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("valideer-hook: melding bovenaan de inspector; geen melding zonder hook-uitkomst", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_val", diagramNaam: "Val", elementen: [
    { id: "u1", naam: "Leen boek", type: "usecase", pos: { x: 300, y: 460 } },
    { id: "u2", naam: "Verleng", type: "usecase", pos: { x: 600, y: 460 } },
  ] });
  await page.evaluate(async () => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const et = reg.getProfieltype("usecase05").descriptor.elementTypes.find((t) => t.id === "usecase");
    et.hooks = { ...(et.hooks || {}), valideer: (el) => (el.naam === "Leen boek" ? [{ niveau: "waarschuwing", tekst: "Geen primaire actor en geen trigger." }] : []) };
  });
  await node(page, "u1").click({ position: { x: 20, y: 10 } });
  await expect(page.getByTestId("inspector-meldingen")).toContainText("Geen primaire actor en geen trigger.");
  await node(page, "u2").click({ position: { x: 20, y: 10 } });
  await expect(page.getByTestId("inspector-meldingen")).toHaveCount(0);
});

test("use case (M3-MOF, Cockburn): zonder primaire actor en trigger een waarschuwing; met primaire associatie weg", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_val2", diagramNaam: "Val 2", elementen: [
    { id: "u1", naam: "Leen boek", type: "usecase", pos: { x: 300, y: 460 } },
    { id: "a1", naam: "Lid", type: "actor", pos: { x: 100, y: 460 } },
    { id: "as1", type: "associatie", source: "a1", target: "u1" },
  ] });
  await node(page, "u1").click({ position: { x: 20, y: 10 } });
  await expect(page.getByTestId("inspector-meldingen")).toBeVisible();
  await page.evaluate(async () => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    reg.getProfieltype("usecase05").useStore.getState().updateElement("as1", { data: { primair: true } });
  });
  await node(page, "a1").click({ position: { x: 20, y: 10 } });
  await node(page, "u1").click({ position: { x: 20, y: 10 } });
  await expect(page.getByTestId("inspector-meldingen")).toHaveCount(0);
});
