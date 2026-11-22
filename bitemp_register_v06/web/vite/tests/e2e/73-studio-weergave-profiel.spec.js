// Studio — het profiel Weergave (plan 2026-11-21 Sidecar-project §7 stap 1).
//  1. Weergave → "Open het weergaveproject van de tool" opent alle vormen en iconen als eigen project
//     (nooit in het gewone project, Mark 22-11), met een diagram per
//     profiel; een vorm tekent zich op het canvas in zijn eigen gedaante.
//  2. Een vorm en een icoon wijzigen in het model en "Laad de weergaven uit dit project in de
//     tool": de tool tekent daarmee (een concept uitproberen).
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

test("het weergaveproject openen, een vorm en icoon wijzigen en in de tool laden", async ({ page }) => {
  test.setTimeout(120_000);
  await openStudio(page);
  await zetModel(page, { profielId: PROFIEL, diagramId: "leeg", diagramNaam: "Leeg" });
  await menu(page, "Open het weergaveproject van de tool");
  const melding = page.locator(".studio-dialoog");
  await expect(melding).toContainText("is een eigen project");
  await page.getByRole("button", { name: "Openen", exact: true }).click();
  await page.getByRole("button", { name: "Niet exporteren", exact: true }).click();
  const projectId = await page.evaluate(async () => (await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx")).huidigProjectId());
  expect(projectId).toBe("omnium-weergaven");
  // Het "Leeg"-diagram van het vorige project is weg: het weergaveproject verving het.
  expect(await inStore(page, PROFIEL, `return !!store.getState().diagrams.leeg;`)).toBe(false);

  const stand = await inStore(
    page,
    PROFIEL,
    `const st = store.getState();
     const els = Object.values(st.elements);
     const bpmn = Object.values(st.diagrams).find((d) => d.naam === "Vormen van BPMN");
     return { vormen: els.filter((e) => e.elementType === "vorm").length, iconen: els.filter((e) => e.elementType === "icoon").length, bpmn: bpmn.id, taak: els.find((e) => e.naam === "bpmn-taak").id, klasse: els.find((e) => e.naam === "klasse").id };`
  );
  expect(stand.vormen).toBeGreaterThan(80);
  expect(stand.iconen).toBeGreaterThan(150);
  // Het icoon tekent zich als tegel op zijn eigen diagram.
  await page.evaluate(async ({ profielId }) => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    const { getProfieltype } = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const d = Object.values(getProfieltype(profielId).useStore.getState().diagrams).find((x) => x.naam === "Standaard per vorm");
    menuBus.emit("studio:open-diagram", { profielId, diagramId: d.id });
  }, { profielId: PROFIEL });
  const standaard = await inStore(page, PROFIEL, `return Object.values(store.getState().elements).find((e) => e.naam === "vorm:class-box").id;`);
  await expect(node(page, standaard).locator(".dc-weergave-icoon rect").first()).toBeVisible();

  // Het diagram van BPMN: de taak staat er in zijn eigen gedaante (afgeronde rechthoek met naam).
  await page.evaluate(async ({ profielId, diagramId }) => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("studio:open-diagram", { profielId, diagramId });
  }, { profielId: PROFIEL, diagramId: stand.bpmn });
  await expect(node(page, stand.taak)).toContainText("bpmn-taak");
  // De gateway is een ruit (het pad van de BPMN-renderer), geen rechthoek.
  const gateway = await inStore(page, PROFIEL, `return Object.values(store.getState().elements).find((e) => e.naam === "bpmn-gateway").id;`);
  await expect(node(page, gateway).locator(`svg path[d^="M17 2 L32 17"]`).first()).toBeVisible();

  // De taak krijgt in het model een andere kleinste maat, het klasse-icoon een andere SVG; in de tool laden.
  await inStore(page, PROFIEL, `store.getState().updateElement(arg, { data: { minMaat: { w: 260, h: 90 } } });`, stand.taak);
  await inStore(page, PROFIEL, `store.getState().updateElement(arg, { data: { svg: '<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5"/></svg>' } });`, stand.klasse);
  await menu(page, "Laad de weergaven uit dit project in de tool");
  await page.getByRole("button", { name: "Laad", exact: true }).click();
  await expect(melding).toContainText("Vormen — vervangen: ");
  await expect(melding).toContainText("nieuw: 0");
  await expect(melding).not.toContainText("Niet geladen");
  await melding.getByRole("button", { name: "OK" }).click();
  const naLaden = await page.evaluate(async () => {
    const { getShapeType } = await import(location.origin + "/viz/react/src/diagramcore/types/shapeType.js");
    const { getTypeIcoon } = await import(location.origin + "/viz/react/src/diagramcore/shapes/typeIconen.jsx");
    return { minMaat: getShapeType("bpmn-taak").minMaat, icoon: getTypeIcoon("klasse").name };
  });
  expect(naLaden).toEqual({ minMaat: { w: 260, h: 90 }, icoon: "DataIcoon" });
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
test("Haal de weergaven uit dit project: ruimt een gewoon project op", async ({ page }) => {
  test.setTimeout(120_000);
  await openStudio(page);
  await zetModel(page, {
    profielId: PROFIEL,
    diagramId: "per-ongeluk",
    diagramNaam: "Per ongeluk",
    elementen: [{ id: "v1", naam: "bpmn-taak", type: "vorm", pos: { x: 40, y: 40 }, data: { renderer: "bpmn-taak" } }],
  });
  await menu(page, "Haal de weergaven uit dit project");
  await page.getByRole("button", { name: "Verwijder", exact: true }).click();
  await expect(page.locator(".studio-dialoog")).toContainText("1 weergave(n) en 1 diagram(men) verwijderd");
  expect(await inStore(page, PROFIEL, `const s = store.getState(); return Object.keys(s.elements).length + Object.keys(s.diagrams).length;`)).toBe(0);
});

test("een koppeling: de BPMN-taak als ruit in de tabel, in de tool laden", async ({ page }) => {
  test.setTimeout(120_000);
  await openStudio(page);
  await zetModel(page, { profielId: PROFIEL, diagramId: "leeg", diagramNaam: "Leeg" });
  await menu(page, "Open het weergaveproject van de tool");
  await page.getByRole("button", { name: "Openen", exact: true }).click();
  await page.getByRole("button", { name: "Niet exporteren", exact: true }).click();
  const stand = await page.evaluate(async (profielId) => {
    const { getProfieltype } = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const { getDiagramType } = await import(location.origin + "/viz/react/src/diagramcore/types/typeRegistry.js");
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    const st = getProfieltype(profielId).useStore.getState();
    const kp = Object.values(st.elements).find((e) => e.elementType === "koppeling" && e.data.profiel === "bpmn-motor" && !e.data.set);
    const dg = Object.values(st.diagrams).find((d) => d.nodes.some((n) => n.elementId === kp.id));
    menuBus.emit("studio:open-diagram", { profielId, diagramId: dg.id });
    const taak = getDiagramType("bpmn-motor").elementTypes.find((et) => et.shape === "bpmn-taak");
    return { kp: kp.id, taak: taak.id };
  }, PROFIEL);
  // De koppeling tekent zich als kaart met regels.
  await expect(node(page, stand.kp).locator(".dc-weergave-koppeling text").first()).toBeVisible();
  await node(page, stand.kp).click();
  const cel = page.getByTestId(`koppeling-${stand.taak}-shape`);
  await expect(cel).toHaveValue("bpmn-taak");
  await cel.fill("ruit");
  await menu(page, "Laad de weergaven uit dit project in de tool");
  await page.getByRole("button", { name: "Laad", exact: true }).click();
  const melding = page.locator(".studio-dialoog");
  await expect(melding).toContainText("Koppelingen — toegepast:");
  await expect(melding).not.toContainText("Niet geladen");
  const shape = await page.evaluate(async (taak) => {
    const { getDiagramType } = await import(location.origin + "/viz/react/src/diagramcore/types/typeRegistry.js");
    return getDiagramType("bpmn-motor").elementTypes.find((et) => et.id === taak).shape;
  }, stand.taak);
  expect(shape).toBe("ruit");
});
