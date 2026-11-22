// Studio — Profiel als container in de M3-taal (Mark 22-11, plan Sidecar-project §9).
//  1. Het sidecar-project: in de map Profielen staat per profiel een Profiel-element; zijn diagram
//     (een view) en zijn elementtypen hangen eronder.
//  2. De eigenschap JSON van het Profiel is afgeleid en alleen-lezen.
//  3. Een tweede view onder hetzelfde Profiel: laden in de tool geeft één profiel, niet twee.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel } from "./helpers/studio.js";

test.use({ viewport: { width: 1700, height: 1000 } });

test("het profiel is een container met views, de JSON afgeleid", async ({ page }) => {
  test.setTimeout(120_000);
  await openStudio(page);
  await zetModel(page, { profielId: "m3Profiel05", diagramId: "leeg", diagramNaam: "Leeg" });
  const melding = page.locator(".studio-dialoog");
  const menu = async (label) => {
    await page.locator(".studio-menubar").getByText("Profiel (M3)", { exact: true }).click();
    await page.getByRole("menuitem", { name: label, exact: true }).click();
  };

  // Een klein sidecar-project (ERD), als eigen project.
  const buffer = Buffer.from(
    await page.evaluate(async () => {
      const base = location.origin + "/viz/react/src/";
      const { getDiagramType } = await import(base + "diagramcore/types/typeRegistry.js");
      const { sidecarProject } = await import(base + "studio/sidecarProject.js");
      return JSON.stringify(sidecarProject({ descriptors: [getDiagramType("erd")] }));
    }),
    "utf8"
  );
  await page.locator('[data-tour="menu-project"]').first().click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByText("Importeer project…").first().click();
  await (await chooser).setFiles({ name: "sidecar.studio-project.json", mimeType: "application/json", buffer });
  await page.getByRole("button", { name: "Importeer", exact: true }).click();
  await expect(page.getByText("Profielen", { exact: true }).first()).toBeVisible();

  // 1. Het Profiel ERD staat als element in de boom; het diagram hangt eronder.
  const profielRij = page.locator('[data-boomsleutel="el:el::m3Profiel05::p_erd_profiel"]');
  await expect(profielRij).toBeVisible();
  // 2. Het Profiel selecteren: de inspector toont de JSON, afgeleid en alleen-lezen.
  await profielRij.click();
  const json = page.getByTestId("inspector-afgeleid-json");
  await expect(json).toBeVisible({ timeout: 10_000 });
  const tekst = await json.locator("pre").textContent();
  const descriptor = JSON.parse(tekst);
  expect(descriptor.id).toBe("erd");
  expect(descriptor.elementTypes.map((e) => e.id)).toContain("entiteit");
  await expect(json.locator("input, textarea")).toHaveCount(0);

  // 3. Een tweede view onder hetzelfde Profiel, met alleen de entiteit: één profiel in de tool.
  await page.evaluate(async () => {
    const { getProfieltype } = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const store = getProfieltype("m3Profiel05").useStore;
    const st = store.getState();
    const entiteit = Object.values(st.elements).find((e) => e.elementType === "elementDef" && e.data?.["m3:id"] === "entiteit");
    st.addDiagram({ id: "dg_erd_2", naam: "ERD — alleen de entiteit", diagramType: "profiel-ontwerp", profiel: "p_erd_profiel", nodes: [{ elementId: entiteit.id, position: { x: 0, y: 0 } }], edges: [] });
    // Een M3-diagram open, zodat het menu Profiel (M3) er is.
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("studio:open-diagram", { profielId: "m3Profiel05", diagramId: "dg_erd" });
  });
  await menu("Laad de profielen uit dit project in de tool");
  await page.getByRole("button", { name: "Laad", exact: true }).click();
  await expect(melding).toContainText("Vervangen: 1");
  await expect(melding).toContainText("Nieuw: 0");
  await expect(melding).not.toContainText("Niet geladen");
});
