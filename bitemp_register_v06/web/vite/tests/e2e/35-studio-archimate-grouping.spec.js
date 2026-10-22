// Studio — ArchiMate-grouping als container (ArchiMate 3 §4.5; Mark 20/22-10): een element in een
// grouping slepen legt een aggregatie vanuit de grouping en laat andere relaties (de compositie
// van een component naar zijn deel) met rust.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore, inModelleren, node, wachtOpNode } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("in een grouping slepen: aggregatie erbij, compositie van het component blijft", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "archimate05", diagramId: "d_fe", diagramNaam: "FE", elementen: [
    { id: "fe", naam: "Frontend (FE)", type: "grouping", pos: { x: 80, y: 120 }, size: { width: 420, height: 240 } },
    { id: "studio", naam: "Omnium Studio", type: "app-component", pos: { x: 120, y: 180 } },
    { id: "ea", naam: "EA-lezer", type: "app-component", pos: { x: 700, y: 180 } },
    { id: "r_comp", type: "compositie", source: "studio", target: "ea" },
  ] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Map A"); ms.getState().plaatsDiagram("archimate05::d_fe", m);');
  await wachtOpNode(page, "ea");
  const mapKop = page.locator("[data-boomsleutel^='map:']").first();
  if ((await mapKop.innerText()).includes("▸")) await mapKop.click();
  const rij = page.locator('[data-boomsleutel="el:el::archimate05::ea"]').first();
  await expect(rij).toBeVisible();
  // Uit de boom op de grouping laten vallen (zelfde pad als slepen op het canvas:
  // verhangNaarContainer). De drop-handler hangt op het canvasvlak en zoekt zelf de node onder
  // de cursor; de lagen eroverheen (edges-svg) geven de drop niet door, dus rechtstreeks op het vlak.
  const dropOpGrouping = async () => {
    const f = await node(page, "fe").boundingBox();
    await page.evaluate(async ([b, x, y]) => {
      const dt = new DataTransfer();
      b.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
      const pane = document.querySelector(".react-flow__pane");
      for (const soort of ["dragover", "drop"]) pane.dispatchEvent(new DragEvent(soort, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    }, [await rij.elementHandle(), f.x + 300, f.y + 150]);
  };
  await dropOpGrouping();
  await expect.poll(() => inStore(page, "archimate05", 'return Object.values(store.getState().elements).filter((e) => e.source).map((e) => e.elementType + ":" + e.source + ">" + e.target).sort();'))
    .toEqual(["aggregatie:fe>ea", "compositie:studio>ea"]);
  // Nog eens: geen tweede aggregatie.
  await dropOpGrouping();
  await expect.poll(() => inStore(page, "archimate05", 'return Object.values(store.getState().elements).filter((e) => e.elementType === "aggregatie").length;')).toBe(1);
});
