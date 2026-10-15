// Studio — sequence van nul tekenen (2026-10-15, op verzoek van Mark): levenslijnen in
// een rij, berichten van lijn naar lijn op muishoogte, genest, zelf-bericht (haakje +
// rugzak), overslaan, verschuiven met wegduwen, kruisen, notitie die meeschuift.
// Draaien: zie helpers/studio.js (dev-server 5175, PLAYWRIGHT_API_URL naar een dode poort).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, node, inStore, wachtOpNode } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const P = "sequence05";

/** Levenslijnen op het diagram, gesorteerd op x: [{id, x, y}]. */
const lijnen = (page) =>
  inStore(page, P, `const s = store.getState(); const d = s.diagrams.dq;
    return d.nodes.filter((n) => s.elements[n.elementId]?.elementType === "levenslijn").map((n) => ({ id: n.elementId, x: n.position.x, y: n.position.y })).sort((a, b) => a.x - b.x);`);

/** Berichten met hun punten (relatieve y + levenslijn): [{id, type, van:{lijn,y}, naar:{lijn,y}}]. */
const berichten = (page) =>
  inStore(page, P, `const s = store.getState(); const d = s.diagrams.dq;
    const pos = (id) => d.nodes.find((n) => n.elementId === id)?.position;
    const punt = (id) => { const e = s.elements[id]; return e ? { id, type: e.elementType, lijn: e.data?.randVan || null, y: pos(id)?.y ?? null } : null; };
    return Object.values(s.elements).filter((e) => ["synchroon", "asynchroon", "retour"].includes(e.elementType))
      .map((e) => ({ id: e.id, type: e.elementType, van: punt(e.source), naar: punt(e.target) }));`);

async function sleep(page, x1, y1, x2, y2) {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x1 + 3, y1 + 2);
  await page.mouse.move(x2, y2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(350);
}

/** Trek een bericht van lijn `a` naar lijn `b` op canvas-hoogte `y` (verbind-modus staat aan). */
async function bericht(page, a, b, y, yEind = y) {
  const ab = await node(page, a).boundingBox();
  const bb = await node(page, b).boundingBox();
  await sleep(page, ab.x + 7, ab.y + y, bb.x + 7, bb.y + yEind);
}

const knop = (page, tekst) => page.locator(".dc-taakbalk-knop", { hasText: tekst }).first();

test.beforeEach(async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: P, diagramId: "dq", diagramNaam: "Van nul", elementen: [] });
  await page.waitForSelector(".dc-taakbalk-knop", { timeout: 20_000 });
});

test("levenslijnen uit het palet komen naast elkaar; punt en activatie staan niet in het palet", async ({ page }) => {
  await expect(knop(page, /^Punt/)).toHaveCount(0);
  await expect(knop(page, /^Activ/)).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    await knop(page, /^Lijn$/).click();
    await page.waitForTimeout(200);
  }
  const l = await lijnen(page);
  expect(l.length).toBe(3);
  expect(l[1].x - l[0].x).toBeGreaterThan(120);
  expect(l[2].x - l[1].x).toBeGreaterThan(120);
  expect(l[0].y).toBe(l[1].y);
  expect(l[1].y).toBe(l[2].y);
});

test("van nul: berichten op muishoogte, genest, zelf, overslaan, duwen, kruisen, notitie mee", async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await knop(page, /^Lijn$/).click();
    await page.waitForTimeout(150);
  }
  const [A, B, C] = (await lijnen(page)).map((l) => l.id);
  await wachtOpNode(page, C);
  // Verbind-modus: synchroon bericht.
  await knop(page, "Synchroon bericht").click();
  await expect(page.locator(".dc-canvas")).toHaveClass(/dc-verbindmodus/);

  // 1. A → B op hoogte 150: punten op beide lijnen, horizontaal, op de muishoogte.
  await bericht(page, A, B, 150);
  let m = await berichten(page);
  expect(m.length).toBe(1);
  const m1 = m[0];
  expect(m1.van.type).toBe("punt");
  expect(m1.van.lijn).toBe(A);
  expect(m1.naar.lijn).toBe(B);
  expect(Math.abs(m1.van.y - (150 - 6))).toBeLessThanOrEqual(3);
  expect(m1.naar.y).toBe(m1.van.y);

  // 2. Genest: B → C op 220 (binnen de activatie van B). Balken afgeleid: B één balk
  //    van 150 tot 220+18, C een kort balkje, A de wortel-episode.
  await bericht(page, B, C, 220);
  m = await berichten(page);
  expect(m.length).toBe(2);
  const balk = async (lijn) => node(page, lijn).locator(".dc-seq-activatie").evaluateAll((els) => els.map((e) => ({ top: Math.round(parseFloat(e.style.top)), h: Math.round(parseFloat(e.style.height)), d: e.dataset.diepte })));
  const bB = await balk(B);
  expect(bB.length).toBe(1);
  expect(Math.abs(bB[0].top - 150)).toBeLessThanOrEqual(3);
  expect(Math.abs(bB[0].h - (220 + 18 - 150))).toBeLessThanOrEqual(4);
  expect((await balk(C)).length).toBe(1);
  expect((await balk(A)).length).toBe(1);

  // 3. Zelf-bericht op A op 300: twee punten 15px uit elkaar, rugzak (diepte 1) op A.
  await bericht(page, A, A, 300, 304);
  m = await berichten(page);
  expect(m.length).toBe(3);
  const zelf = m.find((x) => x.van.lijn === A && x.naar.lijn === A);
  expect(zelf).toBeTruthy();
  expect(zelf.naar.y - zelf.van.y).toBe(15);
  expect((await balk(A)).some((b) => b.d === "1")).toBe(true);

  // 4. Overslaan: A → C op 400, B krijgt geen punt.
  await bericht(page, A, C, 400);
  m = await berichten(page);
  const over = m.find((x) => x.van.lijn === A && x.naar.lijn === C);
  expect(over).toBeTruthy();
  const puntenOpB = await inStore(page, P, `return Object.values(store.getState().elements).filter((e) => e.elementType === "punt" && e.data?.randVan === "${B}").length`);
  expect(puntenOpB).toBe(2);

  // 5. Duwen: bericht 1 (150) 100 omlaag → 250; bericht 2 (220) wordt weggeduwd naar 250+32.
  await knop(page, "Synchroon bericht").click(); // verbind-modus uit, anders begint de sleep een lijn
  await expect(page.locator(".dc-canvas")).not.toHaveClass(/dc-verbindmodus/);
  const edge = (id) => page.locator(`.react-flow__edge[data-id="conn:${id}"]`);
  let eb = await edge(m1.id).boundingBox();
  await sleep(page, eb.x + eb.width * 0.4, eb.y + eb.height / 2, eb.x + eb.width * 0.4, eb.y + eb.height / 2 + 100);
  m = await berichten(page);
  const n1 = m.find((x) => x.id === m1.id);
  const n2 = m.find((x) => x.van.lijn === B && x.naar.lijn === C);
  expect(Math.abs(n1.van.y - (250 - 6))).toBeLessThanOrEqual(3);
  expect(n1.naar.y).toBe(n1.van.y);
  expect(n2.van.y - n1.van.y).toBe(32);
  expect(n2.naar.y).toBe(n2.van.y);

  // 6. Kruisen: bericht 2 omhoog tot boven bericht 1 (vrij, geen duwen).
  eb = await edge(n2.id).boundingBox();
  await sleep(page, eb.x + eb.width * 0.5, eb.y + eb.height / 2, eb.x + eb.width * 0.5, eb.y + eb.height / 2 - 180);
  m = await berichten(page);
  const k2 = m.find((x) => x.id === n2.id);
  expect(k2.van.y).toBeLessThan(n1.van.y);
  expect(m.find((x) => x.id === m1.id).van.y).toBe(n1.van.y);

  // 7. Notitie aan het ontvangpunt van bericht 1 schuift mee met het bericht.
  await inStore(page, P, `const s = store.getState();
    s.addElement({ id: "not", naam: "", elementType: "notitie", compartimenten: [], data: { tekst: "Via event?" } });
    s.addElementToDiagram("dq", "not", { x: 700, y: 40 });
    s.addElement({ id: "notl", naam: "", elementType: "notitielijn", source: "not", target: "${n1.naar.id}", compartimenten: [], data: {} });`);
  await wachtOpNode(page, "not");
  eb = await edge(m1.id).boundingBox();
  await sleep(page, eb.x + eb.width * 0.4, eb.y + eb.height / 2, eb.x + eb.width * 0.4, eb.y + eb.height / 2 + 50);
  const notY = await inStore(page, P, `return store.getState().diagrams.dq.nodes.find((n) => n.elementId === "not").position.y`);
  expect(Math.abs(notY - 90)).toBeLessThanOrEqual(3);
});

test("verwijderen en Ctrl+Z: een bericht gaat met zijn punten, en komt in één stap terug", async ({ page }) => {
  for (let i = 0; i < 2; i++) {
    await knop(page, /^Lijn$/).click();
    await page.waitForTimeout(150);
  }
  const [A, B] = (await lijnen(page)).map((l) => l.id);
  await wachtOpNode(page, B);
  await knop(page, "Synchroon bericht").click();
  await bericht(page, A, B, 150);
  await bericht(page, A, B, 220);
  await knop(page, "Synchroon bericht").click();
  const punten = () => inStore(page, P, `return Object.values(store.getState().elements).filter((e) => e.elementType === "punt").length`);
  expect(await berichten(page)).toHaveLength(2);
  expect(await punten()).toBe(4);

  // Tekenen is één undo-stap: Ctrl+Z haalt het tweede bericht mét zijn punten weg.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(300);
  expect(await berichten(page)).toHaveLength(1);
  expect(await punten()).toBe(2);

  // Delete op een bericht: uit het model, punten mee; Ctrl+Z zet beide terug.
  const [m1] = await berichten(page);
  const eb = await page.locator(`.react-flow__edge[data-id="conn:${m1.id}"]`).boundingBox();
  await page.mouse.click(eb.x + eb.width * 0.4, eb.y + eb.height / 2);
  await page.waitForTimeout(200);
  await page.keyboard.press("Delete");
  await page.waitForTimeout(300);
  expect(await berichten(page)).toHaveLength(0);
  expect(await punten()).toBe(0);
  expect(await node(page, A).locator(".dc-seq-activatie").count()).toBe(0);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(300);
  expect(await berichten(page)).toHaveLength(1);
  expect(await punten()).toBe(2);
  expect(await node(page, B).locator(".dc-seq-activatie").count()).toBe(1);
});
