// 59-studio-maat-per-diagram.spec.js — de maat van een node hoort bij zijn diagram (10-11).
//
// Melding Mark (evenementen-branch): op diagram "Evenementen" eindigden de lijnen naar "Aanvraag"
// naast het vak in het niets. Aanvraag stond daar zonder eigen maat; op diagram "Besluit" was hij
// 462 breed gemaakt. Het canvas heeft geen key per diagram en hergebruikte bij de wissel de React
// Flow-node met dezelfde id (= elementId), mét zijn oude maat: het vak tekende smal, de omhulling
// en de aanhechtpunten bleven 462 breed.
//
// Draaien: zie helpers/studio.js (eigen dev-server, API gemockt).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore, node, wachtOpNode } from "./helpers/studio.js";

test.beforeEach(async ({ page }) => {
  await openStudio(page);
});

/** Breedte van de React Flow-omhulling en van het zichtbare vak (schermpixels). */
async function breedtes(page, id) {
  return node(page, id).evaluate((el) => {
    const vak = el.querySelector(".dc-node") || el.firstElementChild;
    return { omhulling: el.getBoundingClientRect().width, vak: vak.getBoundingClientRect().width };
  });
}

test("wissel van diagram: een node neemt de maat van het vorige diagram niet mee", async ({ page }) => {
  await zetModel(page, {
    profielId: "diagram05",
    diagramId: "besluit",
    diagramNaam: "Besluit",
    elementen: [
      { id: "Aanvraag", naam: "Aanvraag", type: "entiteit", pos: { x: 80, y: 450 } },
      { id: "Partij", naam: "Partij", type: "entiteit", pos: { x: 80, y: 700 } },
      { id: "AanvraagPartij", naam: "AanvraagPartij", type: "relatie", source: "Aanvraag", target: "Partij" },
    ],
  });
  await wachtOpNode(page, "Aanvraag");
  // Met de muis groter maken: dán zet React Flow zelf width/height op zijn node (een maat die
  // alleen in de store staat, liet de fout niet zien).
  const voor = await breedtes(page, "Aanvraag");
  await node(page, "Aanvraag").click();
  const greep = node(page, "Aanvraag").locator(".react-flow__resize-control.bottom.right").first();
  await greep.waitFor({ timeout: 5_000 });
  const g = await greep.boundingBox();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + 150, g.y + 20, { steps: 6 });
  await page.mouse.move(g.x + 300, g.y + 40, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const op1 = await breedtes(page, "Aanvraag");
  expect(op1.omhulling).toBeGreaterThan(voor.omhulling + 200);

  // Tweede diagram: dezelfde elementen, Aanvraag zonder eigen maat; openen in hetzelfde canvas.
  await inStore(page, "diagram05", `
    const s = store.getState();
    s.addDiagram({ id: "evenementen", naam: "Evenementen", diagramType: "diagram05" });
    s.addElementToDiagram("evenementen", "Aanvraag", { x: 0, y: 0 });
    s.addElementToDiagram("evenementen", "Partij", { x: 700, y: 200 });
    s.updateDiagramViewport("evenementen", { x: 0, y: 0, zoom: 1 });
    s.setActiefDiagram("evenementen");
  `);
  await page.evaluate(async () => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("studio:open-diagram", { profielId: "diagram05", diagramId: "evenementen" });
  });
  await page.waitForTimeout(1200);
  const op2 = await breedtes(page, "Aanvraag");
  // Zonder eigen maat is het vak smaller dan 462, en de omhulling (waar de lijnen aanhechten) valt
  // daarmee samen.
  expect(op2.vak).toBeLessThan(400);
  expect(Math.abs(op2.omhulling - op2.vak)).toBeLessThan(4);
});
