// Studio — de centrale plek (plan Sidecar-project §8, stap 5; Mark 22-11). De API is gemockt.
//  1. Breng versie uit…: een profielenproject op de server; de voorgestelde versie is de minor na
//     de laatst uitgebrachte; het werkbestand gaat mee met de nieuwe versie in de kop en het
//     laatste volgnummer; daarna draagt de projectkop het nummer.
//  2. Centrale versies…: de lijst met ouders; een versie in de tool laden.
import { test, expect } from "@playwright/test";
import { openStudio, inModelleren } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const LIJST = {
  centrale: "",
  versies: [
    { soort: "profielen", versie: "0.1.0", projectId: "omnium-sidecar", ouders: [], uitgebracht: "2026-11-20T10:00:00Z", uitgebrachtDoor: "mark", hier: true },
    { soort: "profielen", versie: "0.2.0", projectId: "omnium-sidecar", ouders: [{ versie: "0.1.0" }], uitgebracht: "2026-11-22T10:00:00Z", uitgebrachtDoor: "mark", hier: true, notitie: "ERD erbij" },
  ],
};

async function projectMenu(page, label) {
  await page.locator('[data-tour="menu-project"]').first().click();
  await page.getByText(label, { exact: true }).first().click();
}

test("Breng versie uit…: minor na de laatste, werkbestand met versie en volgnummer", async ({ page }) => {
  await openStudio(page);
  await page.route("**/api/studio/centraal", (r) => r.fulfill({ json: LIJST }));
  let body = null;
  await page.route("**/api/studio/projecten/omnium-sidecar/uitbrengen", (r) => {
    body = r.request().postDataJSON();
    r.fulfill({ status: 201, json: { soort: "profielen", versie: body.versie, ouders: [{ versie: "0.2.0" }] } });
  });
  await inModelleren(page, `ms.getState().zetProject({ id: "omnium-sidecar", naam: "Profielen", soort: "profielen", versie: "0.2.0", serverVersie: 4, laatsteVolgnummer: 17, liveSync: false, herkomst: null });`);
  await page.evaluate(async () => {
    const { useOutboxStore } = await import(location.origin + "/viz/react/src/studio/sync/outbox.js");
    useOutboxStore.getState().wis();
  });

  await projectMenu(page, "Breng versie uit…");
  const dialoog = page.locator(".studio-dialoog");
  await expect(dialoog).toContainText("Laatst uitgebracht: 0.2.0");
  await expect(dialoog.locator("select")).toHaveValue("0.3.0");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await dialoog.locator("textarea").fill("Weergave van de ERD-kraaienpoten");
  await page.getByRole("button", { name: "Volgende", exact: true }).click();
  await page.getByRole("button", { name: "Breng uit", exact: true }).click();
  await expect(page.getByText("Versie uitgebracht", { exact: true })).toBeVisible();
  expect(body.versie).toBe("0.3.0");
  expect(body.totVolgnummer).toBe(17);
  expect(body.notitie).toBe("Weergave van de ERD-kraaienpoten");
  expect(body.inhoud.formaat).toBe("studio-project");
  expect(body.inhoud.project).toMatchObject({ id: "omnium-sidecar", soort: "profielen", versie: "0.3.0" });
  expect(await inModelleren(page, `return ms.getState().project.versie;`)).toBe("0.3.0");
});

test("Centrale versies…: lijst met ouders; een versie in de tool laden", async ({ page }) => {
  await openStudio(page);
  await page.route("**/api/studio/centraal", (r) => r.fulfill({ json: LIJST }));
  // De versie: een sidecar-project met alleen ERD, gemaakt door de Studio zelf.
  const werkbestand = await page.evaluate(async () => {
    const base = location.origin + "/viz/react/src/";
    const { getDiagramType } = await import(base + "diagramcore/types/typeRegistry.js");
    const { sidecarProject } = await import(base + "studio/sidecarProject.js");
    return sidecarProject({ descriptors: [getDiagramType("erd")] });
  });
  await page.route("**/api/studio/centraal/profielen/0.2.0", (r) =>
    r.fulfill({ json: { soort: "profielen", versie: "0.2.0", projectId: "omnium-sidecar", projectNaam: "Profielen", ouders: [{ versie: "0.1.0" }], inhoud: werkbestand } })
  );

  await projectMenu(page, "Centrale versies…");
  const dialoog = page.locator(".studio-dialoog");
  await expect(dialoog).toContainText("Deze instantie is de centrale.");
  await expect(dialoog).toContainText("profielen uit de code");
  const select = dialoog.locator("select");
  // Nieuwste eerst; de ouder staat erbij.
  await expect(select.locator("option").first()).toContainText("0.2.0 · na 0.1.0");
  await select.selectOption("profielen@0.2.0");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await dialoog.locator("select").selectOption("laad");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByText("profielen 0.2.0 geladen", { exact: true })).toBeVisible();
  const g = await page.evaluate(async () => {
    const { geladen } = await import(location.origin + "/viz/react/src/studio/projectGebruik.js");
    return geladen("profielen");
  });
  expect(g).toMatchObject({ bron: "project", id: "omnium-sidecar", versie: "0.2.0", concept: false });
});
