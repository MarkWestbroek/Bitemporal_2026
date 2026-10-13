// Studio — vormen en vergroten (regressie 2026-10-10/13): BPMN zonder
// opgeslagen maat, vergroten aan zijkant/hoek van een kader, relatie trekken
// vanaf de handle van een geselecteerde vorm.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, node, inStore, wachtOpNode } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await openStudio(page);
});

test("BPMN-event en -gateway zonder opgeslagen maat blijven klein", async ({ page }) => {
  await zetModel(page, { profielId: "bpmnMotor05", diagramId: "db", elementen: [
    { id: "ev", type: "start-event", pos: { x: 200, y: 450 } },
    { id: "gw", type: "exclusief", pos: { x: 420, y: 450 } },
  ] });
  await wachtOpNode(page, "gw");
  for (const id of ["ev", "gw"]) {
    const b = await node(page, id).boundingBox();
    expect(b.width, id).toBeLessThan(100);
    expect(b.height, id).toBeLessThan(100);
  }
});

test("kader: zijkant en hoek vergroten, binnenste rand verplaatst", async ({ page }) => {
  await zetModel(page, { profielId: "usecase05", diagramId: "dr", elementen: [
    { id: "sys", naam: "Kader", type: "systeem", pos: { x: 300, y: 300 }, size: { width: 400, height: 260 } },
  ] });
  await wachtOpNode(page, "sys");
  const maat = () => inStore(page, "usecase05", 'const n = store.getState().diagrams.dr.nodes.find((x) => x.elementId === "sys"); return { x: Math.round(n.position.x), y: Math.round(n.position.y), w: Math.round(n.size.width), h: Math.round(n.size.height) };');
  const sleep = async (x, y, dx, dy) => {
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(300);
  };
  let kb = await node(page, "sys").boundingBox();
  await page.mouse.click(kb.x + 9, kb.y + kb.height / 2); // binnenste rand = selecteren
  await expect(node(page, "sys")).toHaveClass(/selected/);
  let voor = await maat();
  await sleep(kb.x + kb.width + 2, kb.y + kb.height / 2 + 30, 80, 0);
  let na = await maat();
  expect(na.w - voor.w).toBeGreaterThan(60);
  voor = na; kb = await node(page, "sys").boundingBox();
  await sleep(kb.x + kb.width + 3, kb.y + kb.height + 3, 40, 30);
  na = await maat();
  expect(na.w - voor.w).toBeGreaterThan(20);
  expect(na.h - voor.h).toBeGreaterThan(15);
  voor = na; kb = await node(page, "sys").boundingBox();
  await sleep(kb.x + 9, kb.y + kb.height / 2 + 40, 50, 20);
  na = await maat();
  expect(na.x - voor.x).toBeGreaterThan(30);
  expect(na.w).toBe(voor.w);
});

test("relatie trekken vanaf de handle van een geselecteerde vorm (resizer zit er niet voor)", async ({ page }) => {
  await zetModel(page, { profielId: "usecase05", diagramId: "dh", elementen: [
    { id: "a", naam: "Eerste", type: "usecase", pos: { x: 300, y: 450 }, size: { width: 220, height: 80 } },
    { id: "c", naam: "Tweede", type: "usecase", pos: { x: 720, y: 450 } },
  ] });
  await wachtOpNode(page, "c");
  const ab = await node(page, "a").boundingBox();
  await page.mouse.click(ab.x + 30, ab.y + ab.height / 2);
  await expect(node(page, "a")).toHaveClass(/selected/);
  const h = await node(page, "a").locator('.react-flow__handle[data-handleid="source-right"]').boundingBox();
  const cb = await node(page, "c").boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const menu = page.locator(".dc-contextmenu-item").first();
  if (await menu.count()) await menu.click();
  await expect.poll(() => inStore(page, "usecase05", 'return Object.values(store.getState().elements).filter((e) => e.source === "a" && e.target === "c").length')).toBe(1);
});
