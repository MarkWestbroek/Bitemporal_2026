// 61-studio-klembord-ander-project.spec.js — kopiëren in het ene project, plakken in het andere
// (KLEM-1, 11-11).
//
// Het klembord draagt de inhoud van wat je kopieerde en staat in localStorage, dus het overleeft
// een projectwissel (en is te lezen in een andere tab). Plakken in een ander project vraagt:
// als hetzelfde element (id en uuid blijven) of als kopie (nieuw id, geen uuid).
// Regels: src/studio/klembord.js.
//
// Draaien: zie helpers/studio.js (eigen dev-server, API gemockt).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore, inModelleren, node, wachtOpNode } from "./helpers/studio.js";

test.beforeEach(async ({ page }) => {
  await openStudio(page);
  await inModelleren(page, `ms.getState().zetProject({ id: "project-een", naam: "Project één" });`);
  await zetModel(page, {
    profielId: "diagram05",
    diagramId: "bron",
    diagramNaam: "Bron",
    elementen: [
      { id: "Aanvraag", naam: "Aanvraag", type: "entiteit", data: { uuid: "uuid-aanvraag" }, pos: { x: 80, y: 450 } },
      { id: "Partij", naam: "Partij", type: "entiteit", data: { uuid: "uuid-partij" }, pos: { x: 80, y: 700 } },
    ],
  });
  await wachtOpNode(page, "Aanvraag");
  // Kopieer beide elementen.
  await node(page, "Aanvraag").click({ position: { x: 30, y: 10 } });
  await node(page, "Partij").click({ position: { x: 30, y: 10 }, modifiers: ["Control"] });
  await page.keyboard.press("Control+c");
  // Het klembord staat in localStorage, met het project en de inhoud erbij.
  const kb = JSON.parse(await page.evaluate(() => localStorage.getItem("studio-klembord:elementen")));
  expect([kb.projectId, kb.elementIds.sort(), Object.keys(kb.inhoud.elements).sort()]).toEqual(["project-een", ["Aanvraag", "Partij"], ["Aanvraag", "Partij"]]);
  // "Ander project": nieuwe identiteit, leeg model met één leeg diagram.
  await inStore(page, "diagram05", `store.getState().clear();`);
  await inModelleren(page, `ms.getState().zetProject({ id: "project-twee", naam: "Project twee" });`);
});

/** De entiteiten in het model: [id, naam, uuid]. */
const entiteiten = (page) =>
  inStore(
    page,
    "diagram05",
    `return Object.values(store.getState().elements).filter((e) => e.elementType === "entiteit").map((e) => [e.id, e.naam, e.data?.uuid ?? null]).sort();`,
  );

test("plakken als hetzelfde element: id en uuid blijven; wat er al staat wordt niet overschreven", async ({ page }) => {
  // In het doelproject staat Partij al, met een eigen naam.
  await zetModel(page, {
    profielId: "diagram05",
    diagramId: "doel",
    diagramNaam: "Doel",
    elementen: [{ id: "Partij", naam: "Partij hier", type: "entiteit", data: { uuid: "uuid-partij" } }],
  });
  await page.keyboard.press("Control+v");
  await expect(page.getByText('Plakken uit "Project één"')).toBeVisible();
  await page.getByRole("button", { name: "Plak", exact: true }).click();
  await wachtOpNode(page, "Aanvraag");
  await wachtOpNode(page, "Partij");
  expect(await entiteiten(page)).toEqual([
    ["Aanvraag", "Aanvraag", "uuid-aanvraag"],
    ["Partij", "Partij hier", "uuid-partij"],
  ]);
  await expect(page.getByText(/1 element stond al in dit project en is niet overschreven/)).toBeVisible();
});

test("plakken als kopie (Ctrl+Shift+V): nieuwe id's, geen uuid", async ({ page }) => {
  await zetModel(page, { profielId: "diagram05", diagramId: "doel", diagramNaam: "Doel", elementen: [] });
  await page.keyboard.press("Control+Shift+v");
  await expect.poll(async () => (await entiteiten(page)).length).toBe(2);
  const uit = await entiteiten(page);
  expect(uit.map((e) => e[1]).sort()).toEqual(["Aanvraag", "Partij"]);
  expect(uit.every((e) => e[2] === null)).toBe(true);
  expect(uit.some((e) => e[0] === "Aanvraag" || e[0] === "Partij")).toBe(false);
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
});

test("diagram kopiëren in de boom en in een ander project plakken, met dezelfde elementen", async ({ page }) => {
  // Eigen opzet: project één met een diagram, een entiteit met een gegevenselement eronder.
  await zetModel(page, { profielId: "diagram05", diagramId: "d_org", diagramNaam: "Origineel", elementen: [
    { id: "po", naam: "Persoon", type: "entiteit", pos: { x: 80, y: 450 }, data: { uuid: "u-po" } },
    { id: "ao", naam: "Adres", type: "entiteit", pos: { x: 80, y: 700 }, data: { uuid: "u-ao" } },
    { id: "ge", naam: "Naam", type: "gegevenselement" },
    { id: "cg", type: "compositie", source: "po", target: "ge" },
  ] });
  await inModelleren(page, 'ms.getState().zetProject({ id: "project-een", naam: "Project één" }); const a = ms.getState().nieuweMap("Bron"); ms.getState().plaatsDiagram("diagram05::d_org", a);');
  const ctx = page.locator(".studio-ctxmenu");
  await page.locator('[data-boomsleutel="diag:diagram05::d_org"]').click({ button: "right" });
  await ctx.getByRole("button", { name: "Kopieer diagram", exact: true }).click();

  // Project twee: Adres staat er al (zelfde uuid, ander id), verder leeg.
  await inStore(page, "diagram05", "store.getState().clear();");
  await zetModel(page, { profielId: "diagram05", diagramId: null, elementen: [{ id: "adres_hier", naam: "Adres hier", type: "entiteit", data: { uuid: "u-ao" } }] });
  const doelMap = await inModelleren(page, 'ms.getState().zetProject({ id: "project-twee", naam: "Project twee" }); return ms.getState().nieuweMap("Doel");');
  await page.locator(`[data-boomsleutel="map:${doelMap}"]`).click({ button: "right" });
  await ctx.getByRole("button", { name: /^Plak diagram "Origineel" uit "Project één"( ▸)?$/ }).click();
  await ctx.getByRole("button", { name: /Met dezelfde elementen/ }).click();

  await expect.poll(() => inStore(page, "diagram05", "return Object.keys(store.getState().diagrams).length;")).toBe(1);
  const uit = await inStore(page, "diagram05", `
    const s = store.getState();
    const d = Object.values(s.diagrams)[0];
    return { naam: d.naam, nodes: d.nodes.map((n) => n.elementId).sort(), elementen: Object.values(s.elements).map((e) => [e.id, e.naam || "", e.data?.uuid || null, e.source || null, e.target || null]).sort() };
  `);
  expect(uit.naam).toBe("Origineel");
  // Persoon komt mee met zijn gegevenselement en de compositie; Adres wijst naar het element dat er al stond.
  expect(uit.nodes).toEqual(["adres_hier", "po"]);
  expect(uit.elementen).toEqual([
    ["adres_hier", "Adres hier", "u-ao", null, null],
    ["cg", "", null, "po", "ge"],
    ["ge", "Naam", null, null, null],
    ["po", "Persoon", "u-po", null, null],
  ]);
  await expect(page.getByText(/1 element stond al in dit project en is niet overschreven/)).toBeVisible();
});
