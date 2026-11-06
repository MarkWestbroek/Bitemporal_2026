// Studio — Mark, 06-11: "de twee RELs tussen Partij en Medisch advies kan ik niet anders scheiden
// dan door te knikken; ik wil ze recht houden en eentje kunnen pakken en schuiven".
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

/** Begin- en eindpunt van het pad van een edge (eerste en laatste coördinaat). */
const uiteinden = (page, id) =>
  page.evaluate((id) => {
    const p = document.querySelector(`.react-flow__edge[data-id="${id}"] path.react-flow__edge-path, .react-flow__edge[data-id="${id}"] path`);
    const getallen = (p?.getAttribute("d") || "").match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
    return getallen.length >= 4 ? { x1: getallen[0], y1: getallen[1], x2: getallen[getallen.length - 2], y2: getallen[getallen.length - 1] } : null;
  }, id);

test("twee relaties tussen hetzelfde paar staan naast elkaar; een lijn zijwaarts slepen houdt hem recht", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_par", diagramNaam: "Parallel", elementen: [
    { id: "P", naam: "Partij", type: "entiteit", pos: { x: 450, y: 420 } },
    { id: "M", naam: "MedischAdvies", type: "entiteit", pos: { x: 450, y: 640 } },
    { id: "r1", naam: "Adviseur", type: "relatie", source: "P", target: "M" },
    { id: "r2", naam: "Betrokkene", type: "relatie", source: "P", target: "M" },
  ] });
  await expect.poll(async () => !!(await uiteinden(page, "conn:r1")) && !!(await uiteinden(page, "conn:r2"))).toBe(true);
  const a = await uiteinden(page, "conn:r1");
  const b = await uiteinden(page, "conn:r2");
  // Uitgewaaierd: niet over elkaar.
  expect(Math.abs(a.x1 - b.x1)).toBeGreaterThan(10);

  // r2 pakken en 40 px naar rechts slepen (scherm), op het midden van de lijn.
  const hit = page.locator('.react-flow__edge[data-id="conn:r2"] path[stroke="transparent"]').first();
  const box = await hit.boundingBox();
  // Niet op het midden: daar ligt het label (dat is zelf versleepbaar).
  const mx = box.x + box.width / 2;
  const my = box.y + box.height * 0.25;
  await page.mouse.move(mx, my);
  await page.mouse.down();
  await page.mouse.move(mx + 20, my, { steps: 4 });
  await page.mouse.move(mx + 40, my, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => inStore(page, "diagram05", 'return store.getState().diagrams.d_par.lijnen?.r2?.verschuiving ?? null;')).not.toBeNull();
  const na = await uiteinden(page, "conn:r2");
  // Nog steeds recht: begin en eind op dezelfde x (verticale lijn), en verschoven t.o.v. eerst.
  expect(Math.abs(na.x1 - na.x2)).toBeLessThan(1.5);
  expect(na.x1).toBeGreaterThan(b.x1 + 10);
  // Geen knikken gemaakt.
  expect(await inStore(page, "diagram05", 'return (store.getState().diagrams.d_par.lijnen?.r2?.knikken || []).length;')).toBe(0);
});
