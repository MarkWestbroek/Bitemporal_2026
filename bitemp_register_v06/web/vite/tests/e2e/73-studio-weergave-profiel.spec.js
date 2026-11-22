// Studio — het profiel Weergave (plan 2026-11-21 Sidecar-project §7 stap 1).
//  1. Weergave → "Laad de vormen van de tool" zet alle vormen als model neer, met een diagram per
//     profiel; een vorm tekent zich op het canvas in zijn eigen gedaante.
//  2. Een vorm wijzigen in het model en "Laad de vormen uit dit project in de tool": de tool
//     tekent daarmee (een concept uitproberen).
//  3. Een icoon met de SVG-editor: het voorbeeld toont alleen de geschoonde SVG.
//  4. Het geëxporteerde weergaveproject importeren: de mappen en alle vormen komen terug.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore, node } from "./helpers/studio.js";

test.use({ viewport: { width: 1700, height: 1000 } });

const PROFIEL = "weergave05";

async function menu(page, label) {
  await page.locator(".studio-menubar").getByText("Weergave", { exact: true }).click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
}

test("de vormen als model laden, een vorm wijzigen en in de tool laden", async ({ page }) => {
  test.setTimeout(120_000);
  await openStudio(page);
  await zetModel(page, { profielId: PROFIEL, diagramId: "leeg", diagramNaam: "Leeg" });
  await menu(page, "Laad de vormen van de tool");
  const melding = page.locator(".studio-dialoog");
  await expect(melding).toContainText("vormen in");
  await melding.getByRole("button", { name: "OK" }).click();

  const stand = await inStore(
    page,
    PROFIEL,
    `const st = store.getState();
     const els = Object.values(st.elements);
     const bpmn = Object.values(st.diagrams).find((d) => d.naam === "Vormen van BPMN");
     return { vormen: els.filter((e) => e.elementType === "vorm").length, bpmn: bpmn.id, taak: els.find((e) => e.naam === "bpmn-taak").id };`
  );
  expect(stand.vormen).toBeGreaterThan(80);

  // Het diagram van BPMN: de taak staat er in zijn eigen gedaante (afgeronde rechthoek met naam).
  await page.evaluate(async ({ profielId, diagramId }) => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("studio:open-diagram", { profielId, diagramId });
  }, { profielId: PROFIEL, diagramId: stand.bpmn });
  await expect(node(page, stand.taak)).toContainText("bpmn-taak");
  // De gateway is een ruit (het pad van de BPMN-renderer), geen rechthoek.
  const gateway = await inStore(page, PROFIEL, `return Object.values(store.getState().elements).find((e) => e.naam === "bpmn-gateway").id;`);
  await expect(node(page, gateway).locator(`svg path[d^="M17 2 L32 17"]`).first()).toBeVisible();

  // De taak krijgt in het model een andere kleinste maat; in de tool laden.
  await inStore(page, PROFIEL, `store.getState().updateElement(arg, { data: { minMaat: { w: 260, h: 90 } } });`, stand.taak);
  await menu(page, "Laad de vormen uit dit project in de tool");
  await page.getByRole("button", { name: "Laad", exact: true }).click();
  await expect(melding).toContainText("Vervangen: ");
  await expect(melding).toContainText("Nieuw: 0");
  await melding.getByRole("button", { name: "OK" }).click();
  const minMaat = await page.evaluate(async () => {
    const { getShapeType } = await import(location.origin + "/viz/react/src/diagramcore/types/shapeType.js");
    return getShapeType("bpmn-taak").minMaat;
  });
  expect(minMaat).toEqual({ w: 260, h: 90 });
});

test("een icoon met de SVG-editor: het voorbeeld is geschoond", async ({ page }) => {
  test.setTimeout(120_000);
  await openStudio(page);
  await zetModel(page, {
    profielId: PROFIEL,
    diagramId: "iconen",
    diagramNaam: "Iconen",
    elementen: [{ id: "ic1", naam: "vlag", type: "icoon", pos: { x: 80, y: 80 }, data: { monochroom: true } }],
  });
  await node(page, "ic1").click();
  const editor = page.getByTestId("svg-editor-svg");
  await expect(editor).toBeVisible();
  await editor.locator("textarea").fill('<svg viewBox="0 0 24 24"><path d="M5 3v18" onclick="alert(1)"/><script>alert(2)</script></svg>');
  await expect(page.getByTestId("svg-voorbeeld-svg").locator("path")).toHaveCount(1);
  await expect(page.getByTestId("svg-voorbeeld-svg").locator("script")).toHaveCount(0);
  await expect(editor).toContainText("Niet getekend:");
  await expect(editor).toContainText("onclick (gebeurtenis)");
  // Op het canvas tekent het icoon zich in de tegel.
  await expect(node(page, "ic1").locator(".dc-weergave-icoon path")).toHaveCount(1);
});

test("het geëxporteerde weergaveproject importeren: mappen per profiel en de vormen", async ({ page }) => {
  test.setTimeout(120_000);
  await openStudio(page);
  // Het project maken zoals de export het doet, in de pagina zelf.
  const buffer = Buffer.from(
    await page.evaluate(async () => {
      const base = location.origin + "/viz/react/src/";
      await import(base + "studio/activities/weergaveActivity.jsx");
      const { weergaveProject } = await import(base + "studio/weergaveProject.js");
      const { alleShapeTypes } = await import(base + "diagramcore/types/shapeType.js");
      const { alleDiagramTypes, getDiagramType } = await import(base + "diagramcore/types/typeRegistry.js");
      return JSON.stringify(weergaveProject({ shapeTypes: alleShapeTypes(), descriptors: alleDiagramTypes(), taalDescriptor: getDiagramType("weergave") }));
    }),
    "utf8"
  );
  await page.locator('[data-tour="menu-project"]').first().click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByText("Importeer project…").first().click();
  await (await chooser).setFiles({ name: "omnium-weergaven.studio-project.json", mimeType: "application/json", buffer });
  await page.getByRole("button", { name: "Importeer", exact: true }).click();
  await expect(page.getByText("Vormen", { exact: true }).first()).toBeVisible();
  const stand = await page.evaluate(async (profielId) => {
    const { getProfieltype } = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const st = getProfieltype(profielId).useStore.getState();
    return { vormen: Object.values(st.elements).filter((e) => e.elementType === "vorm").length, bpmn: Object.values(st.diagrams).some((d) => d.naam === "Vormen van BPMN") };
  }, PROFIEL);
  expect(stand.vormen).toBeGreaterThan(80);
  expect(stand.bpmn).toBe(true);
});
