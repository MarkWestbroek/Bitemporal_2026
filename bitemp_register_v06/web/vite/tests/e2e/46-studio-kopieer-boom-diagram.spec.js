// Studio — wensen van Mark (06-11) bij de projectboom en het canvas:
//   - elementen kopiëren uit een diagram en plakken op een ander (Ctrl+C / Ctrl+V, "werkte in de IDE");
//   - ook kinderen (GE onder ENT) Ctrl-selecteren, en Ctrl-slepen = mét kinderen op een diagram;
//   - een diagram onder een package hangen (M3 uitwerking), zoals onder een UC-realisatie.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren, inStore, node } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const opDiagram = (page, dId) => inStore(page, "diagram05", `return (store.getState().diagrams["${dId}"]?.nodes || []).map((n) => n.elementId).sort();`);

test("Ctrl+C / Ctrl+V: elementen naar een ander diagram, als verwijzing", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_bron", diagramNaam: "Bron", elementen: [
    { id: "p", naam: "Persoon", type: "entiteit", pos: { x: 300, y: 460 } },
    { id: "a", naam: "Adres", type: "entiteit", pos: { x: 600, y: 460 } },
  ] });
  await zetModel(page, { profielId: "diagram05", diagramId: "d_doel", diagramNaam: "Doel", elementen: [] });
  await inModelleren(page, 'ms.getState().activeer("diagram05::d_bron");');
  await expect(node(page, "p")).toBeVisible();
  await node(page, "p").click({ position: { x: 30, y: 10 } });
  await node(page, "a").click({ position: { x: 30, y: 10 }, modifiers: ["Control"] });
  await page.keyboard.press("Control+c");
  await inModelleren(page, 'ms.getState().activeer("diagram05::d_doel");');
  await page.locator(".react-flow__pane").first().click({ position: { x: 500, y: 600 }, force: true });
  await page.keyboard.press("Control+v");
  await expect.poll(() => opDiagram(page, "d_doel")).toEqual(["a", "p"]);
  // Verwijzing, geen kopie: het model heeft nog steeds twee entiteiten.
  expect(await inStore(page, "diagram05", 'return Object.values(store.getState().elements).filter((e) => e.elementType === "entiteit").length;')).toBe(2);
  // Nog eens plakken: alles staat er al.
  await page.keyboard.press("Control+v");
  await expect.poll(() => opDiagram(page, "d_doel")).toEqual(["a", "p"]);
});

test("kinderen Ctrl-selecteren in de boom, en Ctrl-slepen zet een entiteit mét GE's op een diagram", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_leeg", diagramNaam: "Leeg", elementen: [
    { id: "ent", naam: "Persoon", type: "entiteit" },
    { id: "ge1", naam: "Naam", type: "gegevenselement" },
    { id: "ge2", naam: "Geboorte", type: "gegevenselement" },
    { id: "c1", type: "compositie", source: "ent", target: "ge1" },
    { id: "c2", type: "compositie", source: "ent", target: "ge2" },
  ] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Model"); ms.getState().plaatsMeerdere(["el::diagram05::ent"], m); ms.getState().zetBoomUitklap("el::diagram05::ent");');
  const kind = (id) => page.getByTestId(`boom-el-${id}`).locator("button.studio-project__element");
  await expect(kind("ge1")).toBeVisible();
  // Kinderen zijn Ctrl-selecteerbaar.
  await kind("ge1").click({ modifiers: ["Control"] });
  await kind("ge2").click({ modifiers: ["Control"] });
  expect(await inModelleren(page, "return ms.getState().multiSelectie;")).toEqual(["el::diagram05::ge1", "el::diagram05::ge2"]);
  await inModelleren(page, "ms.getState().wisMulti();");

  // Ctrl-slepen van de entiteit naar het canvas: entiteit + beide GE's.
  await page.keyboard.down("Control");
  await kind("ent").dragTo(page.locator(".react-flow__pane").first(), { targetPosition: { x: 400, y: 550 }, force: true });
  await page.keyboard.up("Control");
  await expect.poll(() => opDiagram(page, "d_leeg")).toEqual(["ent", "ge1", "ge2"]);
});

test("een diagram onder een package hangen (uitwerking), in het canonieke model", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_pkg", diagramNaam: "Overzicht", elementen: [{ id: "pkg", naam: "Personen", type: "package" }] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Model"); ms.getState().plaatsMeerdere(["el::diagram05::pkg", "diagram05::d_pkg"], m);');
  const diagramRij = page.locator('[data-boomsleutel="diag:diagram05::d_pkg"]');
  await expect(diagramRij).toBeVisible();
  await diagramRij.dragTo(page.getByTestId("boom-el-pkg"));
  await expect.poll(() => inModelleren(page, 'return ms.getState().plaatsing["diagram05::d_pkg"];')).toBe("el::diagram05::pkg");
});
