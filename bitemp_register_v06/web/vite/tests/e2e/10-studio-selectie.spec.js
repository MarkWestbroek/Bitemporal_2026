// Studio — selecteren en deselecteren op het canvas (regressie 2026-10-09/13).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, node, geselecteerd, klikMetBeweging, inStore, wachtOpNode } from "./helpers/studio.js";

const ACTOREN = [
  { id: "a1", naam: "Klant", type: "actor", pos: { x: 150, y: 460 } },
  { id: "a2", naam: "Medewerker", type: "actor", pos: { x: 420, y: 460 } },
  { id: "a3", naam: "Beheerder", type: "actor", pos: { x: 300, y: 620 } },
];

// Vaste maat: het apparaatprofiel in de config zou 1280×720 geven (minimap over het canvas).
test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await openStudio(page);
});

test("klik op leeg deselecteert, ook als de muis een paar pixels beweegt", async ({ page }) => {
  await zetModel(page, { profielId: "usecase05", diagramId: "dsel", elementen: ACTOREN });
  await wachtOpNode(page, "a2");
  const nb = await node(page, "a2").boundingBox();
  const pane = await page.locator(".react-flow__pane").boundingBox();
  const leeg = { x: pane.x + 25, y: pane.y + pane.height / 2 + 40 };
  // 0–5px: React Flow-klik (clickDistance 6); 7px: eigen pointerup-deselectie (tot 8px).
  for (const dx of [0, 1, 5, 7]) {
    await page.mouse.click(nb.x + nb.width / 2, nb.y + 20);
    await expect.poll(() => geselecteerd(page)).toEqual(["a2"]);
    await klikMetBeweging(page, leeg.x, leeg.y, dx);
    await expect.poll(() => geselecteerd(page), { message: `beweging ${dx}px` }).toEqual([]);
  }
  // Echt slepen (40px) is pannen: selectie blijft.
  await page.mouse.click(nb.x + nb.width / 2, nb.y + 20);
  await klikMetBeweging(page, leeg.x, leeg.y, 40);
  await expect.poll(() => geselecteerd(page)).toEqual(["a2"]);
});

test("in een systeemkader: klik naast een element deselecteert; naam en rand pakken het kader", async ({ page }) => {
  await zetModel(page, { profielId: "usecase05", diagramId: "dkad", elementen: [
    { id: "sys", naam: "Gemeentelijke dienstverlening", type: "systeem", pos: { x: 200, y: 260 }, size: { width: 600, height: 400 } },
    { id: "u1", naam: "Bel op", type: "usecase", pos: { x: 260, y: 360 } },
  ] });
  await wachtOpNode(page, "u1");
  const ub = await node(page, "u1").boundingBox();
  await page.mouse.click(ub.x + 10, ub.y + ub.height / 2);
  await expect.poll(() => geselecteerd(page)).toEqual(["u1"]);
  await page.mouse.click(ub.x + ub.width + 120, ub.y + ub.height / 2);
  await expect.poll(() => geselecteerd(page)).toEqual([]);
  // Rand (3px binnen) selecteert het kader.
  const kb = await node(page, "sys").boundingBox();
  await page.mouse.click(kb.x + 3, kb.y + kb.height / 2 + 40);
  await expect.poll(() => geselecteerd(page)).toEqual(["sys"]);
  // Binnenvlak slepen verplaatst het kader niet.
  await page.keyboard.press("Escape");
  const voor = await inStore(page, "usecase05", 'return store.getState().diagrams.dkad.nodes.find((n) => n.elementId === "sys").position');
  await page.mouse.move(kb.x + kb.width - 80, kb.y + kb.height - 80);
  await page.mouse.down();
  await page.mouse.move(kb.x + kb.width - 20, kb.y + kb.height - 40, { steps: 6 });
  await page.mouse.up();
  const na = await inStore(page, "usecase05", 'return store.getState().diagrams.dkad.nodes.find((n) => n.elementId === "sys").position');
  expect(na).toEqual(voor);
});

test("geen groepskader na Shift+slepen; samen slepen werkt", async ({ page }) => {
  await zetModel(page, { profielId: "usecase05", diagramId: "dgrp", elementen: ACTOREN });
  await wachtOpNode(page, "a3");
  const b1 = await node(page, "a1").boundingBox();
  const b3 = await node(page, "a3").boundingBox();
  await page.keyboard.down("Shift");
  await page.mouse.move(b1.x - 30, b1.y - 30);
  await page.mouse.down();
  await page.mouse.move(b3.x + b3.width + 200, b3.y + b3.height + 30, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect.poll(async () => (await geselecteerd(page)).length).toBe(3);
  await expect(page.locator(".react-flow__nodesselection-rect")).toHaveCount(0);
  const x0 = (await node(page, "a3").boundingBox()).x;
  const b2 = await node(page, "a2").boundingBox();
  await page.mouse.move(b2.x + b2.width / 2, b2.y + 20);
  await page.mouse.down();
  await page.mouse.move(b2.x + b2.width / 2 + 60, b2.y + 20, { steps: 8 });
  await page.mouse.up();
  expect((await node(page, "a3").boundingBox()).x).toBeGreaterThan(x0 + 30);
});
