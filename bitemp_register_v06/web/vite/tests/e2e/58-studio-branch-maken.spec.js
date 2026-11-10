// Studio — "Branch maken…" op een map (10-11, Mark). De API is gemockt: lijst van projecten en
// POST …/afsplitsen. Controleert: niet op de server → melding; nieuwe branch met mapId en
// voorgestelde naam; bestaande branch voor de map → aanbieden in plaats van een tweede; een 409
// branch_bestaat van de server → de bestaande aanbieden.
import { test, expect } from "@playwright/test";
import { openStudio, inModelleren } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const PID = "proj-main-0001";

/** Project "Inrichten" met map "Diensten"; desgewenst als serverproject (zonder live sync). */
async function zetProjectMetMap(page, { opServer = true } = {}) {
  return inModelleren(page, `
    const s = ms.getState();
    s.zetProject({ id: "${PID}", naam: "Inrichten", serverVersie: ${opServer ? 3 : "null"}, liveSync: false, herkomst: null });
    const id = ms.getState().nieuweMap("Diensten");
    return id;
  `);
}

async function wisOutbox(page) {
  await page.evaluate(async () => {
    const { useOutboxStore } = await import(location.origin + "/viz/react/src/studio/sync/outbox.js");
    useOutboxStore.getState().wis();
  });
}

async function klikBranchMaken(page) {
  await page.getByText("Diensten", { exact: true }).first().click({ button: "right" });
  await page.getByText("Branch maken…", { exact: true }).click();
}

test("niet op de server: melding, geen afsplitsen", async ({ page }) => {
  await openStudio(page);
  let afgesplitst = false;
  await page.route("**/afsplitsen", (r) => { afgesplitst = true; r.fulfill({ status: 500, json: {} }); });
  await zetProjectMetMap(page, { opServer: false });
  await klikBranchMaken(page);
  await expect(page.getByText(/staat nog niet op de server/)).toBeVisible();
  expect(afgesplitst).toBe(false);
});

test("nieuwe branch: naam voorgesteld, mapId mee, daarna openen of blijven", async ({ page }) => {
  await openStudio(page);
  await page.route("**/api/studio/projecten", (r) => r.fulfill({ json: [{ id: PID, naam: "Inrichten", herkomst: null }] }));
  let body = null;
  await page.route(`**/api/studio/projecten/${PID}/afsplitsen`, (r) => {
    body = r.request().postDataJSON();
    r.fulfill({ status: 201, json: { id: "tak-0001", naam: body.naam } });
  });
  const mapId = await zetProjectMetMap(page);
  await wisOutbox(page);
  await klikBranchMaken(page);
  const invoer = page.locator("input[type=text], input:not([type])").last();
  await expect(invoer).toHaveValue("Inrichten — Diensten");
  await page.getByRole("button", { name: "Maken", exact: true }).click();
  await expect(page.getByText("Branch gemaakt", { exact: true })).toBeVisible();
  expect(body).toEqual({ naam: "Inrichten — Diensten", mapId });
  await page.getByRole("button", { name: "Hier blijven", exact: true }).click();
  expect(await inModelleren(page, `return ms.getState().project.id;`)).toBe(PID);
});

test("bestaande branch voor de map: aanbieden, geen tweede", async ({ page }) => {
  await openStudio(page);
  let afgesplitst = false;
  await page.route(`**/api/studio/projecten/${PID}/afsplitsen`, (r) => { afgesplitst = true; r.fulfill({ status: 500, json: {} }); });
  const mapId = await zetProjectMetMap(page);
  await page.route("**/api/studio/projecten", (r) => r.fulfill({ json: [
    { id: PID, naam: "Inrichten", herkomst: null },
    { id: "tak-oud", naam: "Inrichten — Diensten", eigenaar: "werkplaats", bijgewerkt: "2026-11-10T10:00:00Z", herkomst: { ouderProject: PID, mapId, gearchiveerd: false } },
  ] }));
  await klikBranchMaken(page);
  await expect(page.getByText("Er is al een branch voor deze map", { exact: true })).toBeVisible();
  await expect(page.getByText(/werkplaats/).first()).toBeVisible();
  await page.getByRole("button", { name: "Annuleren", exact: true }).click();
  expect(afgesplitst).toBe(false);
});

test("409 branch_bestaat van de server: de bestaande aanbieden", async ({ page }) => {
  await openStudio(page);
  await page.route("**/api/studio/projecten", (r) => r.fulfill({ json: [{ id: PID, naam: "Inrichten", herkomst: null }] }));
  await page.route(`**/api/studio/projecten/${PID}/afsplitsen`, (r) =>
    r.fulfill({ status: 409, json: { error: "Er is al een branch voor deze map", reden: "branch_bestaat", projectId: "tak-tegelijk" } }));
  await zetProjectMetMap(page);
  await wisOutbox(page);
  await klikBranchMaken(page);
  await page.getByRole("button", { name: "Maken", exact: true }).click();
  await expect(page.getByText("Er is al een branch voor deze map", { exact: true })).toBeVisible();
});
