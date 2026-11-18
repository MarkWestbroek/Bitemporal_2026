// 65-studio-resize-terug.spec.js — groter en daarna weer kleiner maken (Mark, 16-11).
//
// Melding: een element met de muis vergroten en daarna verkleinen liet de lijnen eindigen waar de
// rand van het grote vak was: de omhulling (waar React Flow meet en de lijnen aanhechten) kromp
// niet mee met het zichtbare vak.
//
// Draaien: zie helpers/studio.js (eigen dev-server, API gemockt).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, node, wachtOpNode } from "./helpers/studio.js";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 1300 });
  await openStudio(page);
});

async function maten(page, id) {
  return node(page, id).evaluate((el) => {
    const vak = el.querySelector(".dc-node") || el.firstElementChild;
    const o = el.getBoundingClientRect();
    const v = vak.getBoundingClientRect();
    return { ow: o.width, oh: o.height, vw: v.width, vh: v.height };
  });
}

/** Afstand (px) van het beginpunt van elke lijn tot de rand van het vak. */
async function lijnAfstand(page, id) {
  return page.evaluate((id) => {
    const n = document.querySelector(`.react-flow__node[data-id="${id}"]`);
    const vak = (n.querySelector(".dc-node") || n.firstElementChild).getBoundingClientRect();
    return [...document.querySelectorAll(".react-flow__edge path.react-flow__edge-path")].map((pad) => {
      const m = pad.getScreenCTM();
      const p0 = pad.getPointAtLength(0);
      const x = m.a * p0.x + m.c * p0.y + m.e;
      const y = m.b * p0.x + m.d * p0.y + m.f;
      const dx = Math.max(vak.left - x, 0, x - vak.right);
      const dy = Math.max(vak.top - y, 0, y - vak.bottom);
      return Math.round(Math.hypot(dx, dy));
    });
  }, id);
}

async function sleepGreep(page, id, dx, dy, klik = true) {
  if (klik) await node(page, id).click();
  const greep = node(page, id).locator(".react-flow__resize-control.bottom.right").first();
  await greep.waitFor({ timeout: 5_000 });
  const g = await greep.boundingBox();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + dx / 2, g.y + dy / 2, { steps: 6 });
  await page.mouse.move(g.x + dx, g.y + dy, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(600);
}

test("groter en weer kleiner: de omhulling krimpt mee met het vak", async ({ page }) => {
  await zetModel(page, {
    profielId: "diagram05",
    diagramId: "d",
    diagramNaam: "D",
    elementen: [
      {
        id: "Aanvraag", naam: "Aanvraag", type: "entiteit", pos: { x: 80, y: 450 },
        compartimenten: [{ compartmentType: "velden", velden: ["id", "aanvraagnummer", "omschrijving", "datum", "status", "risicoklasse", "organisator", "locaties"].map((naam) => ({ naam, type: "string" })) }],
      },
      { id: "Partij", naam: "Partij", type: "entiteit", pos: { x: 700, y: 450 } },
      { id: "AanvraagPartij", naam: "AanvraagPartij", type: "relatie", source: "Aanvraag", target: "Partij" },
    ],
  });
  await wachtOpNode(page, "Aanvraag");
  const voor = await maten(page, "Aanvraag");
  await sleepGreep(page, "Aanvraag", 200, 150);
  const groot = await maten(page, "Aanvraag");
  await sleepGreep(page, "Aanvraag", -150, -250, false);
  const klein = await maten(page, "Aanvraag");
  const afstand = await lijnAfstand(page, "Aanvraag");
  console.log(JSON.stringify({ voor, groot, klein, afstand }));
  expect(groot.vw).toBeGreaterThan(voor.vw + 100);
  expect(klein.vw).toBeLessThan(groot.vw - 100);
  expect(Math.abs(klein.ow - klein.vw)).toBeLessThan(4);
  expect(Math.abs(klein.oh - klein.vh)).toBeLessThan(4);
  for (const a of afstand) expect(a).toBeLessThan(15);
});

test("GraphQL-type: groter en weer kleiner, de omhulling krimpt mee", async ({ page }) => {
  await zetModel(page, {
    profielId: "graphql05",
    diagramId: "d",
    diagramNaam: "D",
    elementen: [
      {
        id: "Aanvraag", naam: "Aanvraag", type: "object", pos: { x: 80, y: 450 },
        compartimenten: [{ compartmentType: "velden", velden: ["id", "aanvraagnummer", "omschrijving", "datum", "status", "risicoklasse", "organisator", "locaties"].map((naam) => ({ naam, type: "String" })) }],
      },
      { id: "Partij", naam: "Partij", type: "object", pos: { x: 700, y: 450 } },
      { id: "AanvraagPartij", naam: "AanvraagPartij", type: "veldtype", source: "Aanvraag", target: "Partij", data: { rolnaam: "partij", typeLabel: "Partij!" } },
    ],
  });
  await wachtOpNode(page, "Aanvraag");
  const voor = await maten(page, "Aanvraag");
  await sleepGreep(page, "Aanvraag", 200, 150);
  const groot = await maten(page, "Aanvraag");
  await sleepGreep(page, "Aanvraag", -150, -250, false);
  const klein = await maten(page, "Aanvraag");
  const afstand = await lijnAfstand(page, "Aanvraag");
  console.log(JSON.stringify({ voor, groot, klein, afstand }));
  expect(groot.vw).toBeGreaterThan(voor.vw + 100);
  expect(klein.vw).toBeLessThan(groot.vw - 100);
  expect(Math.abs(klein.ow - klein.vw)).toBeLessThan(4);
  expect(Math.abs(klein.oh - klein.vh)).toBeLessThan(4);
  for (const a of afstand) expect(a).toBeLessThan(15);
});

test("GraphQL-type op zoom 0,75", async ({ page }) => {
  await zetModel(page, {
    profielId: "graphql05",
    diagramId: "d",
    diagramNaam: "D",
    zoom: 0.75,
    elementen: [
      {
        id: "Aanvraag", naam: "Aanvraag", type: "object", pos: { x: 80, y: 450 },
        compartimenten: [{ compartmentType: "velden", velden: ["id", "aanvraagnummer", "omschrijving", "datum", "status", "risicoklasse", "organisator", "locaties"].map((naam) => ({ naam, type: "String" })) }],
      },
      { id: "Partij", naam: "Partij", type: "object", pos: { x: 700, y: 450 } },
      { id: "AanvraagPartij", naam: "AanvraagPartij", type: "veldtype", source: "Aanvraag", target: "Partij", data: { rolnaam: "partij", typeLabel: "Partij!" } },
    ],
  });
  await wachtOpNode(page, "Aanvraag");
  const voor = await maten(page, "Aanvraag");
  await sleepGreep(page, "Aanvraag", 200, 150);
  const groot = await maten(page, "Aanvraag");
  await sleepGreep(page, "Aanvraag", -150, -250, false);
  const klein = await maten(page, "Aanvraag");
  const afstand = await lijnAfstand(page, "Aanvraag");
  console.log(JSON.stringify({ voor, groot, klein, afstand }));
  expect(groot.vw).toBeGreaterThan(voor.vw + 100);
  expect(klein.vw).toBeLessThan(groot.vw - 100);
  expect(Math.abs(klein.ow - klein.vw)).toBeLessThan(4);
  expect(Math.abs(klein.oh - klein.vh)).toBeLessThan(4);
  for (const a of afstand) expect(a).toBeLessThan(15);
});

test("groter en dan ongedaan maken: de omhulling volgt de teruggezette maat", async ({ page }) => {
  await zetModel(page, {
    profielId: "graphql05",
    diagramId: "d",
    diagramNaam: "D",
    elementen: [
      { id: "Aanvraag", naam: "Aanvraag", type: "object", pos: { x: 80, y: 450 } },
      { id: "Partij", naam: "Partij", type: "object", pos: { x: 700, y: 450 } },
      { id: "AanvraagPartij", naam: "AanvraagPartij", type: "veldtype", source: "Aanvraag", target: "Partij", data: { rolnaam: "partij", typeLabel: "Partij!" } },
    ],
  });
  await wachtOpNode(page, "Aanvraag");
  const voor = await maten(page, "Aanvraag");
  await sleepGreep(page, "Aanvraag", 200, 150);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(600);
  const terug = await maten(page, "Aanvraag");
  const afstand = await lijnAfstand(page, "Aanvraag");
  console.log(JSON.stringify({ voor, terug, afstand }));
  expect(Math.abs(terug.vw - voor.vw)).toBeLessThan(4);
  expect(Math.abs(terug.ow - terug.vw)).toBeLessThan(4);
  expect(Math.abs(terug.oh - terug.vh)).toBeLessThan(4);
  for (const a of afstand) expect(a).toBeLessThan(15);
});
