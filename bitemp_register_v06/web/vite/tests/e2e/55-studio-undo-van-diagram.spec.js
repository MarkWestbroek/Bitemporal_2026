// Studio — Mark, 07-11: "A–B, ik haal A van het diagram; Ctrl+Z geeft alleen A terug, nog een
// Ctrl+Z pas de associatie." React Flow meldde de lijn van A als apart verwijderd; nu is Delete
// één melding (onDelete) en één undo-stap (createDiagramStore.inEenUndoStap).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore, node, wachtOpNode } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const opDiagram = (page) => inStore(page, "diagram05", "return store.getState().diagrams.d_undo.nodes.map((n) => n.elementId).sort();");
const verborgen = (page) => inStore(page, "diagram05", "return store.getState().diagrams.d_undo.verborgenConnectoren || [];");

test("element met relatie van het diagram halen: één Ctrl+Z zet element én lijn terug", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_undo", diagramNaam: "Undo", elementen: [
    { id: "a", naam: "A", type: "entiteit", pos: { x: 200, y: 480 } },
    { id: "b", naam: "B", type: "entiteit", pos: { x: 700, y: 480 } },
    { id: "r", naam: "heeft", type: "relatie", source: "a", target: "b" },
  ] });
  await wachtOpNode(page, "a");
  await expect(page.locator('.react-flow__edge[data-id="conn:r"]')).toHaveCount(1);

  await node(page, "a").click({ position: { x: 20, y: 12 } });
  await page.keyboard.press("Delete");
  await expect.poll(() => opDiagram(page)).toEqual(["b"]);
  // De lijn is niet apart verborgen: hij verdween omdat A er niet meer staat.
  expect(await verborgen(page)).toEqual([]);

  await page.keyboard.press("Control+z");
  await expect.poll(() => opDiagram(page)).toEqual(["a", "b"]);
  await expect(page.locator('.react-flow__edge[data-id="conn:r"]')).toHaveCount(1);
});

test("twee elementen met hun relaties in één Delete: één Ctrl+Z zet alles terug", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_undo", diagramNaam: "Undo", elementen: [
    { id: "a", naam: "A", type: "entiteit", pos: { x: 200, y: 420 } },
    { id: "b", naam: "B", type: "entiteit", pos: { x: 700, y: 420 } },
    { id: "c", naam: "C", type: "entiteit", pos: { x: 200, y: 650 } },
    { id: "r", naam: "heeft", type: "relatie", source: "a", target: "b" },
    { id: "s", naam: "kent", type: "relatie", source: "c", target: "b" },
  ] });
  await wachtOpNode(page, "a");
  await node(page, "a").click({ position: { x: 20, y: 12 } });
  await node(page, "c").click({ position: { x: 20, y: 12 }, modifiers: ["Control"] });
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(2);
  await page.keyboard.press("Delete");
  await expect.poll(() => opDiagram(page)).toEqual(["b"]);
  expect(await verborgen(page)).toEqual([]);

  await page.keyboard.press("Control+z");
  await expect.poll(() => opDiagram(page)).toEqual(["a", "b", "c"]);
  await expect(page.locator('.react-flow__edge[data-id="conn:r"]')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge[data-id="conn:s"]')).toHaveCount(1);
});
