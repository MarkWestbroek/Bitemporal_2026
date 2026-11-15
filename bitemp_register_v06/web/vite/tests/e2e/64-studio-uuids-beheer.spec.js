// Studio — uuid's tonen in de eigenschappen, als beheer-instelling (Mark 15-11: "een instelling
// voor de admin"). Een modelleur ziet de instelling niet; een beheerder zet haar aan en ziet dan
// de uuid van het element en van zijn velden (alleen-lezen); ontbrekende vult de Studio aan.
import { test, expect } from "@playwright/test";
import { zetModel, inModelleren } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const instellingen = (page) => page.locator('[title*="Studio-instellingen"], [aria-label*="Studio-instellingen"]').first();
const boomRij = (page, p, e) => page.locator(`[data-boomsleutel="el:el::${p}::${e}"]`).first();

/** Als openStudio, maar met een gekozen rol. */
async function openAls(page, rol) {
  await page.addInitScript(() => localStorage.setItem("studio05-tour-v1", "gezien"));
  await page.route("**/api/**", (r) => r.fulfill({ status: 404, json: { error: "mock" } }));
  // Op een Vite-poort gaat de auth-check naar een ander adres (apiBase): met CORS-headers, anders
  // ziet de Studio de login als "uit" (en dan mag iedereen de uuid's zien).
  await page.route("**/api/auth/status", (r) => r.fulfill({
    json: { auth_enabled: true, ingelogd: true, gebruikersnaam: "test", rol },
    headers: { "Access-Control-Allow-Origin": new URL(page.url() || "http://localhost:5176").origin, "Access-Control-Allow-Credentials": "true" },
  }));
  await page.goto("/viz/react/studio/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".studio-activitybar", { timeout: 60_000 });
}

test("modelleur: de instelling staat er niet", async ({ page }) => {
  await openAls(page, "modelleur");
  await instellingen(page).click();
  await expect(page.getByTestId("voorkeur-op-raster")).toBeVisible();
  await expect(page.getByTestId("voorkeur-toon-uuids")).toHaveCount(0);
});

test("beheerder: instelling aan, dan de uuid van element en veld in de eigenschappen", async ({ page }) => {
  await openAls(page, "beheerder");
  await instellingen(page).click();
  await page.getByTestId("voorkeur-toon-uuids").check();
  const modelleren = page.locator(".studio-activitybar [title^='Modelleren']").first();
  await modelleren.click();
  await zetModel(page, { profielId: "diagram05", elementen: [
    { id: "e1", naam: "Persoon", type: "entiteit", data: { uuid: "3f2a1b7c-0000-4000-8000-00000000c1d9" } },
    { id: "g1", naam: "Naam", type: "gegevenselement", compartimenten: [{ compartmentType: "velden", velden: [
      { naam: "achternaam", fieldType: "attribuut", data: { uuid: "aaaaaaaa-1111-4000-8000-000000000001" } },
      { naam: "voornaam", fieldType: "attribuut", data: {} },
    ] }] },
  ] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Map"); ms.getState().plaatsMeerdere(["el::diagram05::e1", "el::diagram05::g1"], m);');
  await boomRij(page, "diagram05", "e1").click();
  const regel = page.locator(".dc-inspector").first().getByTestId("uuid-regel").first();
  await expect(regel).toContainText("uuid: 3f2a1b7c…c1d9");
  await boomRij(page, "diagram05", "g1").click();
  // Projectformaat 4 (15-11): wat nog geen uuid had, krijgt er meteen een (afgeleid, v5);
  // een bestaande uuid blijft staan.
  const regels = page.locator(".dc-inspector").first().getByTestId("uuid-regel");
  await expect(regels.first()).toContainText(/uuid: [0-9a-f]{8}…[0-9a-f]{4}/, { timeout: 5000 });
  await expect(regels.nth(1)).toContainText("aaaaaaaa…0001");
  await expect(regels.nth(2)).toContainText(/uuid: [0-9a-f]{8}…[0-9a-f]{4}/);
});
