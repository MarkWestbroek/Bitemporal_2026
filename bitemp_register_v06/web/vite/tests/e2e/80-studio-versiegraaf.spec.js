// Studio — stap 10, de versiegraaf (plan "Sidecar-project" §10; Mark 22-11). API gemockt.
//  1. Versiegraaf…: hoofdlijn en onderhoudslijn als rijen, een merge gestippeld; Onderhoudslijn
//     starten maakt een project op de server en opent het; daarin stelt Breng versie uit… alleen
//     de volgende patch op die lijn voor.
//  2. Terugmergen: de volgende versie van de hoofdlijn vraagt of een reparatie is opgenomen en
//     stuurt dan twee ouders mee.
import { test, expect } from "@playwright/test";
import { openStudio, inModelleren } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const u = (versie, uur, ...ouders) => ({ soort: "profielen", versie, projectId: "omnium-sidecar", projectNaam: "Profielen", uitgebracht: `2026-11-23T0${uur}:00:00Z`, uitgebrachtDoor: "mark", hier: true, ouders: ouders.map((o) => ({ versie: o })) });

async function werkbestand(page, versie) {
  return page.evaluate(async (versie) => {
    const base = location.origin + "/viz/react/src/";
    const { getDiagramType } = await import(base + "diagramcore/types/typeRegistry.js");
    const { sidecarProject } = await import(base + "studio/sidecarProject.js");
    const wb = sidecarProject({ descriptors: [getDiagramType("erd")] });
    wb.project = { ...wb.project, versie, concept: false };
    return wb;
  }, versie);
}

async function projectMenu(page, label) {
  await page.locator('[data-tour="menu-project"]').first().click();
  await page.getByText(label, { exact: true }).first().click();
}

test("versiegraaf en een onderhoudslijn: starten, en alleen de volgende patch uitbrengen", async ({ page }) => {
  await openStudio(page);
  const LIJST = { centrale: "", versies: [u("0.4.0", 1), u("0.5.0", 2, "0.4.0"), u("0.4.1", 3, "0.4.0"), u("0.6.0", 4, "0.5.0", "0.4.1")] };
  const v41 = await werkbestand(page, "0.4.1");
  await page.route("**/api/studio/centraal", (r) => r.fulfill({ json: LIJST }));
  await page.route("**/api/studio/klantaanpassingen", (r) => r.fulfill({ json: { aanpassingen: [{ klant: "gemeente-x", soort: "profielen", versie: "1.0.0", basisVersie: "0.5.0", eenheden: 2, ouders: [] }] } }));
  await page.route("**/api/studio/centraal/profielen/0.4.1", (r) => r.fulfill({ json: { ...u("0.4.1", 3, "0.4.0"), inhoud: v41 } }));
  let aangemaakt = null;
  await page.route("**/api/studio/projecten", (r) => {
    if (r.request().method() !== "POST") return r.fulfill({ json: [] });
    aangemaakt = r.request().postDataJSON();
    return r.fulfill({ status: 201, json: { id: aangemaakt.id, naam: aangemaakt.naam, versie: 1, recht: "beheren" } });
  });
  await page.route("**/api/studio/projecten/omnium-sidecar-0-4/ops**", (r) => r.fulfill({ json: { ops: [], laatsteVolgnummer: 0 } }));
  await page.route("**/api/studio/projecten/omnium-sidecar-0-4", (r) =>
    r.fulfill({ json: { id: aangemaakt.id, naam: aangemaakt.naam, eigenaar: "mark", versie: 1, recht: "beheren", tot_volgnummer: 0, laatste_volgnummer: 0, inhoud: aangemaakt.inhoud } })
  );

  await projectMenu(page, "Versiegraaf…");
  const graaf = page.getByTestId("versiegraaf-profielen");
  await expect(graaf.locator("g[data-versie]")).toHaveCount(4);
  await expect(graaf.locator('g[data-versie="0.4.1"]')).toHaveAttribute("data-lijn", "0.4");
  await expect(graaf.locator('g[data-versie="0.6.0"]')).toHaveAttribute("data-lijn", "hoofd");
  await expect(graaf.locator('path[data-lijn="0.4.1>0.6.0"]')).toHaveAttribute("stroke-dasharray", "4 3");
  await expect(graaf.locator('g[data-versie="0.5.0"]')).toContainText("1 klant");

  // Onderhoudslijn 0.5.x starten (vanaf 0.5.0) zou kunnen; we starten 0.4.x vanaf 0.4.1.
  await page.locator('[data-onderhoud="profielen@0.4"]').click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect.poll(() => inModelleren(page, "return ms.getState().project.id;")).toBe("omnium-sidecar-0-4");
  expect(aangemaakt.inhoud.project).toMatchObject({ id: "omnium-sidecar-0-4", soort: "profielen", versie: "0.4.1", onderhoudslijn: "0.4" });
  expect(await inModelleren(page, "return ms.getState().project.onderhoudslijn;")).toBe("0.4");

  let body = null;
  await page.route("**/api/studio/projecten/omnium-sidecar-0-4/uitbrengen", (r) => {
    body = r.request().postDataJSON();
    r.fulfill({ status: 201, json: { soort: "profielen", versie: body.versie, ouders: [{ versie: "0.4.1" }], lijn: "onderhoud" } });
  });
  await projectMenu(page, "Breng versie uit…");
  const dialoog = page.locator(".studio-dialoog");
  await expect(dialoog.locator("select option")).toHaveCount(1);
  await expect(dialoog.locator("select")).toHaveValue("0.4.2");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await dialoog.locator("textarea").fill("Reparatie");
  await page.getByRole("button", { name: "Volgende", exact: true }).click();
  await page.getByRole("button", { name: "Breng uit", exact: true }).click();
  await expect(page.getByText("Versie uitgebracht", { exact: true })).toBeVisible();
  expect(body.versie).toBe("0.4.2");
  expect(body.ouders ?? null).toBeNull();
});

test("terugmergen: de reparatie als tweede ouder", async ({ page }) => {
  await openStudio(page);
  const LIJST = { centrale: "", versies: [u("0.4.0", 1), u("0.5.0", 2, "0.4.0"), u("0.4.1", 3, "0.4.0")] };
  await page.route("**/api/studio/centraal", (r) => r.fulfill({ json: LIJST }));
  let body = null;
  await page.route("**/api/studio/projecten/omnium-sidecar/uitbrengen", (r) => {
    body = r.request().postDataJSON();
    r.fulfill({ status: 201, json: { soort: "profielen", versie: body.versie, ouders: body.ouders.map((versie) => ({ versie })), lijn: "hoofd" } });
  });
  await inModelleren(page, `ms.getState().zetProject({ id: "omnium-sidecar", naam: "Profielen", soort: "profielen", versie: "0.5.0", serverVersie: 4, laatsteVolgnummer: 9, liveSync: false, herkomst: null, onderhoudslijn: null });`);
  await page.evaluate(async () => {
    const { useOutboxStore } = await import(location.origin + "/viz/react/src/studio/sync/outbox.js");
    useOutboxStore.getState().wis();
  });
  await projectMenu(page, "Breng versie uit…");
  const dialoog = page.locator(".studio-dialoog");
  await expect(dialoog.locator("select")).toHaveValue("0.6.0");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await expect(dialoog).toContainText("terugmergen");
  await dialoog.locator("select").selectOption("0.4.1");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await dialoog.locator("textarea").fill("Met de reparatie uit 0.4.1");
  await page.getByRole("button", { name: "Volgende", exact: true }).click();
  await expect(dialoog).toContainText("na 0.5.0 en 0.4.1");
  await page.getByRole("button", { name: "Breng uit", exact: true }).click();
  await expect(page.getByText("Versie uitgebracht", { exact: true })).toBeVisible();
  expect(body).toMatchObject({ versie: "0.6.0", ouders: ["0.5.0", "0.4.1"] });
});
