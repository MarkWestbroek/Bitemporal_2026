// Studio — Mark, 07-11: de dikke leesrichtingspijl bij een relatie in het canonieke model
// ("▶ label heen", "◀ label terug") wijst langs de lijn: horizontaal goed, maar verticaal en
// schuin draaide hij niet mee (diagramcore/canvas/leesrichting.js).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, wachtOpNode } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const hoeken = (page) =>
  page.locator('.react-flow__edgelabel-renderer [data-edge-id="conn:r"] .dc-leesrichting').evaluateAll((els) => els.map((e) => Number(e.dataset.hoek)));

test("leesrichtingspijl volgt de lijn: horizontaal, verticaal en schuin", async ({ page }) => {
  await openStudio(page);
  const relatie = { id: "r", naam: "LINKSMIDDEN", type: "relatie", source: "links", target: "midden", data: { naamLabelHeen: "label heen", naamLabelTerug: "label terug" } };
  const zet = (posLinks, posMidden) =>
    zetModel(page, { profielId: "diagram05", diagramId: "d_l", diagramNaam: "Leesrichting", elementen: [
      { id: "links", naam: "LINKS", type: "entiteit", pos: posLinks },
      { id: "midden", naam: "MIDDEN", type: "entiteit", pos: posMidden },
      relatie,
    ] });

  // Horizontaal: links → rechts.
  await zet({ x: 100, y: 300 }, { x: 600, y: 300 });
  await wachtOpNode(page, "midden");
  await expect.poll(() => hoeken(page)).toEqual([0, 180]);

  // Verticaal: LINKS onder, MIDDEN boven → heen wijst omhoog.
  await zet({ x: 300, y: 600 }, { x: 300, y: 150 });
  await expect.poll(() => hoeken(page)).toEqual([-90, 90]);

  // Schuin: heen wijst niet meer horizontaal of verticaal.
  await zet({ x: 100, y: 600 }, { x: 600, y: 150 });
  await expect.poll(async () => {
    const [heen] = await hoeken(page);
    return heen < -10 && heen > -80;
  }).toBe(true);
});
