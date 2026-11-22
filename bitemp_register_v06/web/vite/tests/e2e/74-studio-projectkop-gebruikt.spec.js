// Studio — de projectkop noemt welke profielen en weergaven een project gebruikt (plan 2026-11-21
// Sidecar-project §7 stap 4; studio/projectGebruik.js).
//  1. Een gewoon project met in de kop "gemaakt met weergaven 0.3.0 uit Omnium weergaven" openen,
//     terwijl de tool uit de code draait: een waarschuwing, het project opent wel.
//  2. Het weergaveproject openen: soort "weergaven" met een versie; Projectinformatie toont dat.
//  3. Starten uit het project (stap 6, lokaal): bewaard voor het starten, na een herlaad tekent de
//     tool met de weergaven uit het project; zonder die stand weer met de code.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel } from "./helpers/studio.js";

test.use({ viewport: { width: 1600, height: 1000 } });

async function importeer(page, data) {
  await page.locator('[data-tour="menu-project"]').first().click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByText("Importeer project…").first().click();
  await (await chooser).setFiles({ name: "p.studio-project.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data), "utf8") });
  await page.getByRole("button", { name: "Importeer", exact: true }).click();
}

test("een project gemaakt met een ander weergaveproject: waarschuwing bij het openen", async ({ page }) => {
  test.setTimeout(120_000);
  await openStudio(page);
  await importeer(page, {
    formaat: "studio-project",
    versie: 4,
    project: {
      id: "proef-gebruikt",
      naam: "Proef gebruikt",
      gebruikt: { weergaven: { bron: "project", id: "omnium-weergaven", naam: "Omnium weergaven", versie: "0.3.0", concept: false } },
    },
    structuur: { mappen: {}, plaatsing: {} },
    profielen: {},
  });
  const melding = page.locator(".studio-dialoog");
  await expect(melding).toContainText("Andere profielen of weergaven");
  await expect(melding).toContainText('weergaven: gemaakt met 0.3.0 uit "Omnium weergaven", nu uit de code');
  await melding.getByRole("button", { name: "OK" }).click();
  // Het project is wel open, en bij het bewaren noteert het wat er nu geladen is.
  const kop = await page.evaluate(async () => {
    const m = await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx");
    return m.huidigProjectKop();
  });
  expect(kop.id).toBe("proef-gebruikt");
});

test("het weergaveproject: soort en versie in de kop, zichtbaar in Projectinformatie", async ({ page }) => {
  test.setTimeout(120_000);
  await openStudio(page);
  await zetModel(page, { profielId: "weergave05", diagramId: "leeg", diagramNaam: "Leeg" });
  await page.locator(".studio-menubar").getByText("Weergave", { exact: true }).click();
  await page.getByRole("menuitem", { name: "Open het weergaveproject van de tool", exact: true }).click();
  await page.getByRole("button", { name: "Openen", exact: true }).click();
  await page.getByRole("button", { name: "Niet exporteren", exact: true }).click();
  const kop = await page.evaluate(async () => (await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx")).huidigProjectKop());
  expect(kop.soort).toBe("weergaven");
  expect(kop.versie).toBeTruthy();
  await page.locator('[data-tour="menu-project"]').first().click();
  await page.getByText("Projectinformatie…").first().click();
  const melding = page.locator(".studio-dialoog");
  await expect(melding).toContainText("Soort: weergaven");
  await expect(melding).toContainText(`Versie: ${kop.versie}`);
  await expect(melding).toContainText("nu geladen: uit de code");
});

test("starten uit het project: na een herlaad tekent de tool met de bewaarde weergaven; terug naar de code", async ({ page }) => {
  test.setTimeout(180_000);
  await openStudio(page);
  await zetModel(page, { profielId: "weergave05", diagramId: "leeg", diagramNaam: "Leeg" });
  const menu = async (label) => {
    await page.locator(".studio-menubar").getByText("Weergave", { exact: true }).click();
    await page.getByRole("menuitem", { name: label, exact: true }).click();
  };
  await menu("Open het weergaveproject van de tool");
  await page.getByRole("button", { name: "Openen", exact: true }).click();
  await page.getByRole("button", { name: "Niet exporteren", exact: true }).click();
  // De taak een andere kleinste maat; een Weergave-diagram openen voor het menu.
  await page.evaluate(async () => {
    const { getProfieltype } = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    const store = getProfieltype("weergave05").useStore;
    const taak = Object.values(store.getState().elements).find((e) => e.naam === "bpmn-taak");
    store.getState().updateElement(taak.id, { data: { minMaat: { w: 333, h: 77 } } });
    menuBus.emit("studio:open-diagram", { profielId: "weergave05", diagramId: Object.keys(store.getState().diagrams)[0] });
  });
  await menu("Laad de weergaven uit dit project in de tool");
  await page.getByRole("button", { name: "Laad", exact: true }).click();
  await page.locator(".studio-dialoog").getByRole("button", { name: "OK" }).click();
  await page.getByRole("button", { name: "Bij het starten gebruiken", exact: true }).click();
  await expect(page.locator(".studio-dialoog")).toContainText("start voortaan met de weergaven");
  await page.locator(".studio-dialoog").getByRole("button", { name: "OK" }).click();

  // Herladen: de tool start met de bewaarde weergaven.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".studio-activitybar", { timeout: 60_000 });
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const { getShapeType } = await import(location.origin + "/viz/react/src/diagramcore/types/shapeType.js");
        return getShapeType("bpmn-taak").minMaat;
      })
    )
    .toEqual({ w: 333, h: 77 });
  const geladen = await page.evaluate(async () => (await import(location.origin + "/viz/react/src/studio/projectGebruik.js")).geladen("weergaven"));
  expect(geladen).toMatchObject({ bron: "project", id: "omnium-weergaven", concept: true });

  // Terug naar de code: na een herlaad weer de maat uit de code.
  await page.evaluate(async () => {
    const { wisStart } = await import(location.origin + "/viz/react/src/studio/startUitProject.js");
    await wisStart("weergaven");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".studio-activitybar", { timeout: 60_000 });
  const naCode = await page.evaluate(async () => {
    const { getShapeType } = await import(location.origin + "/viz/react/src/diagramcore/types/shapeType.js");
    return getShapeType("bpmn-taak").minMaat;
  });
  expect(naCode).not.toEqual({ w: 333, h: 77 });
});
