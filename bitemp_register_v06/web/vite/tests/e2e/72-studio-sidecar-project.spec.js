// Studio — het sidecar-project (PROF-1, Mark 18/19-11): de profielen en transformaties van de tool
// als één project.
//  1. Profiel-ontwerp → Exporteer het sidecar-project levert een werkbestand met een map per profiel
//     (M3-taal) en de regelsets (profiel Transformatie).
//  2. Dat bestand importeren: Modelleren toont de mappen; een profiel-diagram opent met zijn
//     elementtypen; uit het geïmporteerde model is het profiel te activeren.
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1700, height: 1000 } });

test("het sidecar-project exporteren, importeren en een profiel eruit activeren", async ({ page }) => {
  test.setTimeout(120_000);
  await openStudio(page);
  // Activeren schrijft in de dev-server een bestand naar web/vite/profielen/; in deze test niet.
  await page.route("**/__studio05/profielen/**", (r) => (r.request().method() === "PUT" ? r.fulfill({ status: 200, json: {} }) : r.continue()));

  // 1. Exporteren vanuit het Profiel-ontwerp.
  await page.locator(".studio-activitybar [title^='Profiel-ontwerp']").first().click();
  await page.waitForFunction(() => !!window.__profielOntwerpStore);
  await page.locator(".studio-menubar").getByText("Ontwerp", { exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Exporteer het sidecar-project (profielen en transformaties)", exact: true }).click();
  const bestand = await download;
  expect(bestand.suggestedFilename()).toBe("omnium-sidecar.studio-project.json");
  const stream = await bestand.createReadStream();
  const delen = [];
  for await (const deel of stream) delen.push(deel);
  const buffer = Buffer.concat(delen);
  const project = JSON.parse(buffer.toString("utf8"));
  expect(project.project.id).toBe("omnium-sidecar");
  const m3 = project.profielen.m3Profiel05;
  const erd = Object.values(m3.diagrams).find((d) => d.naam === "ERD");
  expect(erd).toBeTruthy();
  expect(Object.keys(project.profielen.transformatie05.elements).length).toBeGreaterThan(11);
  await page.getByRole("dialog").getByRole("button", { name: "OK" }).click();

  // 2. Importeren in Modelleren.
  await page.locator(".studio-activitybar [title^='Modelleren']").first().click();
  await page.locator('[data-tour="menu-project"]').first().click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByText("Importeer project…").first().click();
  await (await chooser).setFiles({ name: "omnium-sidecar.studio-project.json", mimeType: "application/json", buffer });
  await page.getByRole("button", { name: "Importeer", exact: true }).click();
  for (const naam of ["Profielen", "Transformaties"]) await expect(page.getByText(naam, { exact: true }).first()).toBeVisible();

  // Het ERD-diagram opent met zijn elementtypen.
  await page.evaluate(async ({ diagramId }) => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("studio:open-diagram", { profielId: "m3Profiel05", diagramId });
  }, { diagramId: erd.id });
  await expect(page.locator(".react-flow:visible .react-flow__node")).toHaveCount(erd.nodes.length, { timeout: 20_000 });
  await expect(page.locator(".react-flow:visible").getByText("Entiteit", { exact: true }).first()).toBeVisible();

  // Uit het geïmporteerde model een profiel activeren: hetzelfde ERD onder een nieuwe id.
  await page.locator(".studio-menubar").getByText("Profiel (M3)", { exact: true }).click();
  await page.getByRole("menuitem", { name: "Activeer profiel… (registreer/ververs)", exact: true }).click();
  for (const waarde of ["erd-uit-sidecar", "ERD uit het sidecar-project", ""]) {
    const d = page.locator(".studio-dialoog");
    await expect(d).toBeVisible();
    await d.locator("input").first().fill(waarde);
    await d.locator("button").last().click();
  }
  const geregistreerd = await page.evaluate(async () => {
    const { getDiagramType } = await import(location.origin + "/viz/react/src/diagramcore/types/typeRegistry.js");
    const dt = getDiagramType("erd-uit-sidecar");
    return dt && dt.elementTypes.filter((e) => !e._superprofiel).map((e) => e.id).sort();
  });
  expect(geregistreerd).toEqual(["bevat", "domein", "entiteit", "relatie", "subtype"]);
});

test("de profielen uit het project in de tool laden: een wijziging in het model verandert het profiel", async ({ page }) => {
  test.setTimeout(120_000);
  await openStudio(page);
  // Het project maken zoals de export het doet, in de pagina zelf.
  const buffer = Buffer.from(
    await page.evaluate(async () => {
      const base = location.origin + "/viz/react/src/";
      await import(base + "studio/activities/m3ProfielActivity.jsx");
      await import(base + "studio/activities/regelsetsIngebouwd.js");
      const { alleDiagramTypes } = await import(base + "diagramcore/types/typeRegistry.js");
      const { sidecarProject } = await import(base + "studio/sidecarProject.js");
      const descriptors = alleDiagramTypes().filter((d) => d.id === "erd" || d.id === "usecase");
      return JSON.stringify(sidecarProject({ descriptors }));
    }),
    "utf8"
  );
  await page.locator('[data-tour="menu-project"]').first().click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByText("Importeer project…").first().click();
  await (await chooser).setFiles({ name: "sidecar.studio-project.json", mimeType: "application/json", buffer });
  await page.getByRole("button", { name: "Importeer", exact: true }).click();
  await expect(page.getByText("Profielen", { exact: true }).first()).toBeVisible();

  // In het model: de entiteit van ERD krijgt een andere kleur en korte code.
  const diagramId = await page.evaluate(async () => {
    const { getProfieltype } = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const store = getProfieltype("m3Profiel05").useStore;
    const st = store.getState();
    const entiteit = Object.values(st.elements).find((e) => e.elementType === "elementDef" && e.data?.["m3:id"] === "entiteit");
    store.getState().updateElement(entiteit.id, { data: { "m3:kleur": "#123456", "m3:kort": "ENX" } });
    return Object.values(st.diagrams).find((d) => d.naam === "ERD").id;
  });
  await page.evaluate(async ({ diagramId }) => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("studio:open-diagram", { profielId: "m3Profiel05", diagramId });
  }, { diagramId });

  const erdVoor = await page.evaluate(async () => {
    const { getDiagramType } = await import(location.origin + "/viz/react/src/diagramcore/types/typeRegistry.js");
    window.__erdObject = getDiagramType("erd");
    return getDiagramType("erd").elementTypes.find((e) => e.id === "entiteit").kleur;
  });
  expect(erdVoor).toBe("#fef9c3");

  await page.locator(".studio-menubar").getByText("Profiel (M3)", { exact: true }).click();
  await page.getByRole("menuitem", { name: "Laad de profielen uit dit project in de tool", exact: true }).click();
  await page.getByRole("button", { name: "Laad", exact: true }).click();
  const melding = page.locator(".studio-dialoog");
  await expect(melding).toContainText("Vervangen: 2");
  await expect(melding).toContainText("Nieuw: 0");
  await melding.getByRole("button", { name: "OK" }).click();

  const erdNa = await page.evaluate(async () => {
    const { getDiagramType } = await import(location.origin + "/viz/react/src/diagramcore/types/typeRegistry.js");
    const dt = getDiagramType("erd");
    const et = dt.elementTypes.find((e) => e.id === "entiteit");
    return { zelfde: dt === window.__erdObject, kleur: et.kleur, kort: et.kort, superprofiel: dt.elementTypes.some((e) => e.id === "notitie" && e._superprofiel) };
  });
  expect(erdNa).toEqual({ zelfde: true, kleur: "#123456", kort: "ENX", superprofiel: true });
});
