// Studio — "Maat aanpassen aan inhoud" in het rechtsklikmenu werkt op de hele selectie (Mark, 06-11:
// "werkt niet op een selectie"). Tot dan wiste het menu alleen de maat van het aangeklikte
// element; Alt+Z deed de selectie al wel.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const maten = (page) =>
  inStore(page, "usecase05", 'const s = store.getState(); return Object.fromEntries(s.diagrams[s.actiefDiagramId].nodes.map((n) => [n.elementId, n.size ? Math.round(n.size.width) : null]));');

test("rechtsklik op een element in een selectie van twee: beide krijgen hun inhoud-maat, de rest blijft", async ({ page }) => {
  await openStudio(page);
  const maat = { width: 230, height: 80 };
  await zetModel(page, { profielId: "usecase05", diagramId: "d_maat", diagramNaam: "Maat", elementen: [
    { id: "u1", naam: "Importeer een model (ArchiMate, OAS, Mermaid, JSON)", type: "usecase", pos: { x: 200, y: 200 }, size: maat },
    { id: "u2", naam: "Exporteer een model", type: "usecase", pos: { x: 200, y: 360 }, size: maat },
    { id: "u3", naam: "Leg een kruisverband", type: "usecase", pos: { x: 200, y: 520 }, size: maat },
  ] });
  await expect.poll(() => maten(page)).toEqual({ u1: 230, u2: 230, u3: 230 });

  const knoop = (id) => page.locator(`.react-flow__node[data-id="${id}"]`);
  await knoop("u1").click();
  await knoop("u2").click({ modifiers: ["Control"] });
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(2);

  await knoop("u2").click({ button: "right" });
  const item = page.locator(".dc-contextmenu").getByRole("button", { name: /Maat aanpassen aan inhoud \(2 geselecteerd\)/ });
  await expect(item).toBeVisible();
  await item.click();
  await expect.poll(() => maten(page)).toEqual({ u1: null, u2: null, u3: 230 });
});

test("rechtsklik op één element zonder selectie: alleen dat element", async ({ page }) => {
  await openStudio(page);
  const maat = { width: 230, height: 80 };
  await zetModel(page, { profielId: "usecase05", diagramId: "d_maat1", diagramNaam: "Maat 1", elementen: [
    { id: "u1", naam: "Eén", type: "usecase", pos: { x: 200, y: 200 }, size: maat },
    { id: "u2", naam: "Twee", type: "usecase", pos: { x: 200, y: 360 }, size: maat },
  ] });
  await expect.poll(() => maten(page)).toEqual({ u1: 230, u2: 230 });
  await page.locator('.react-flow__node[data-id="u1"]').click({ button: "right" });
  await page.locator(".dc-contextmenu").getByRole("button", { name: /^◱?\s*Maat aanpassen aan inhoud$/ }).click();
  await expect.poll(() => maten(page)).toEqual({ u1: null, u2: 230 });
});
