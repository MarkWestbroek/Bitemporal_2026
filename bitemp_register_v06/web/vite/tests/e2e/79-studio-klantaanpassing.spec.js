// Studio — stap 8, klantaanpassingen als delta (plan "Sidecar-project" §10; Mark 22-11). API gemockt.
//  1. Een centrale versie openen als project: zonder wijziging is er niets vast te leggen (geen
//     schijnverschillen door het laden); na één wijziging bevat de delta precies die wijziging.
//  2. Klantaanpassingen… → op een nieuwe basis zetten: de wijziging die de basis zelf overnam
//     valt uit de delta; vastleggen op de nieuwe basisversie.
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

/** Een sidecar-project met alleen ERD, gemaakt door de Studio zelf; met een versie in de kop. */
async function werkbestand(page, versie, hernoem = null) {
  return page.evaluate(async ({ versie, hernoem }) => {
    const base = location.origin + "/viz/react/src/";
    const { getDiagramType } = await import(base + "diagramcore/types/typeRegistry.js");
    const { sidecarProject } = await import(base + "studio/sidecarProject.js");
    const wb = sidecarProject({ descriptors: [getDiagramType("erd")] });
    wb.project = { ...wb.project, versie, concept: false };
    if (hernoem) {
      const els = wb.profielen.m3Profiel05.elements;
      const el = Object.values(els).find((e) => e.elementType === "elementDef");
      el.naam = hernoem;
    }
    return wb;
  }, { versie, hernoem });
}

async function projectMenu(page, label) {
  await page.locator('[data-tour="menu-project"]').first().click();
  await page.getByText(label, { exact: true }).first().click();
}

const kies = async (page, waarde) => {
  await page.locator(".studio-dialoog select").selectOption(waarde);
  await page.getByRole("button", { name: "OK", exact: true }).click();
};

test("vastleggen: zonder wijziging niets, na één wijziging precies die in de delta", async ({ page }) => {
  await openStudio(page);
  const v1 = await werkbestand(page, "1.0.0");
  await page.route("**/api/studio/centraal", (r) => r.fulfill({ json: { centrale: "", versies: [{ soort: "profielen", versie: "1.0.0", projectId: "omnium-sidecar", ouders: [], hier: true }] } }));
  await page.route("**/api/studio/centraal/profielen/1.0.0", (r) => r.fulfill({ json: { soort: "profielen", versie: "1.0.0", projectId: "omnium-sidecar", projectNaam: "Profielen", ouders: [], inhoud: v1 } }));
  await page.route("**/api/studio/klantaanpassingen", (r) => {
    if (r.request().method() === "POST") {
      body = r.request().postDataJSON();
      return r.fulfill({ status: 201, json: { ...body, delta: undefined } });
    }
    return r.fulfill({ json: { aanpassingen: [] } });
  });
  let body = null;

  // De centrale versie als project openen.
  await projectMenu(page, "Centrale versies…");
  await kies(page, "profielen@1.0.0");
  await kies(page, "open");
  await page.getByRole("button", { name: "Openen", exact: true }).click();
  // Alleen als het huidige project inhoud had, vraagt de Studio eerst om te exporteren.
  const nietExporteren = page.getByRole("button", { name: "Niet exporteren", exact: true });
  if (await nietExporteren.waitFor({ timeout: 1500 }).then(() => true, () => false)) await nietExporteren.click();
  await expect.poll(() => page.evaluate(async () => (await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx")).huidigProjectId())).toBe("omnium-sidecar");

  // Zonder wijziging: niets vast te leggen.
  await projectMenu(page, "Klantaanpassing vastleggen…");
  await expect(page.locator(".studio-dialoog")).toContainText("niets anders dan profielen 1.0.0");
  await page.getByRole("button", { name: "OK" }).click();

  // Eén element hernoemen.
  const id = await page.evaluate(async () => {
    const { getProfieltype } = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const st = getProfieltype("m3Profiel05").useStore;
    const el = Object.values(st.getState().elements).find((e) => e.elementType === "elementDef");
    st.getState().updateElement(el.id, { naam: "Entiteit (klant)" });
    return el.id;
  });

  await projectMenu(page, "Klantaanpassing vastleggen…");
  await page.locator(".studio-dialoog input").fill("gemeente-x");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await kies(page, "1.0.0");
  await page.locator(".studio-dialoog textarea").fill("Eigen naam");
  await page.getByRole("button", { name: "Volgende", exact: true }).click();
  await expect(page.locator(".studio-dialoog")).toContainText("1 wijziging(en) (1 element)");
  await page.getByRole("button", { name: "Leg vast", exact: true }).click();
  await expect(page.getByText("Klantaanpassing vastgelegd", { exact: true })).toBeVisible();
  expect(body).toMatchObject({ klant: "gemeente-x", soort: "profielen", versie: "1.0.0", basisVersie: "1.0.0", notitie: "Eigen naam" });
  expect(body.delta.eenheden).toHaveLength(1);
  expect(body.delta.eenheden[0]).toMatchObject({ soort: "element", profielId: "m3Profiel05", id });
  expect(body.delta.eenheden[0].waarde.naam).toBe("Entiteit (klant)");
});

test("op een nieuwe basis: de wijziging die de basis overnam, valt uit de delta", async ({ page }) => {
  await openStudio(page);
  const v1 = await werkbestand(page, "1.0.0");
  const v2 = await werkbestand(page, "1.1.0", "Entiteit (klant)"); // de basis nam de klantnaam over
  const el = Object.values(v1.profielen.m3Profiel05.elements).find((e) => e.elementType === "elementDef");
  const delta = { formaat: "studio-klantdelta", soort: "profielen", basisVersie: "1.0.0", eenheden: [{ soort: "element", profielId: "m3Profiel05", id: el.id, waarde: { ...el, naam: "Entiteit (klant)" } }] };
  const rij = { klant: "gemeente-x", soort: "profielen", versie: "1.0.0", basisVersie: "1.0.0", eenheden: 1, ouders: [] };
  await page.route("**/api/studio/centraal", (r) => r.fulfill({ json: { centrale: "", versies: [
    { soort: "profielen", versie: "1.0.0", ouders: [], hier: true },
    { soort: "profielen", versie: "1.1.0", ouders: [{ versie: "1.0.0" }], hier: true, notitie: "klantnaam overgenomen" },
  ] } }));
  await page.route("**/api/studio/centraal/profielen/1.0.0", (r) => r.fulfill({ json: { soort: "profielen", versie: "1.0.0", projectNaam: "Profielen", inhoud: v1 } }));
  await page.route("**/api/studio/centraal/profielen/1.1.0", (r) => r.fulfill({ json: { soort: "profielen", versie: "1.1.0", projectNaam: "Profielen", inhoud: v2 } }));
  await page.route("**/api/studio/klantaanpassingen/gemeente-x/profielen/1.0.0", (r) => r.fulfill({ json: { ...rij, delta } }));
  let body = null;
  await page.route("**/api/studio/klantaanpassingen", (r) => {
    if (r.request().method() === "POST") {
      body = r.request().postDataJSON();
      return r.fulfill({ status: 201, json: { ...body, delta: undefined } });
    }
    return r.fulfill({ json: { aanpassingen: [rij] } });
  });

  await projectMenu(page, "Klantaanpassingen…");
  await kies(page, "gemeente-x|profielen|1.0.0");
  await kies(page, "basis");
  await kies(page, "1.1.0");
  const dialoog = page.locator(".studio-dialoog");
  await expect(dialoog).toContainText("past: 0 · botst: 0 · al opgenomen: 1");
  await expect(dialoog).toContainText("De delta is nu leeg");
  await page.getByRole("button", { name: "Leg vast", exact: true }).click();
  await expect(page.getByText("Klantaanpassing op nieuwe basis", { exact: true })).toBeVisible();
  expect(body).toMatchObject({ klant: "gemeente-x", soort: "profielen", versie: "1.1.0", basisVersie: "1.1.0" });
  expect(body.delta.eenheden).toHaveLength(0);
});
