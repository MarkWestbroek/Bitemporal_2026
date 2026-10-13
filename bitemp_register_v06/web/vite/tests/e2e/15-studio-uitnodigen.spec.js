// Studio — uitnodigen en toegang per project (plan 2026-10-12 Gebruikers uitnodigen §5,
// "alles dicht tenzij"). API gemockt: acceptatiepagina, uitnodigformulier in Gebruikers en
// het paneel "Toegang…" in Van server ophalen. De serverkant zelf testen de Go-tests
// (handlers/studio_project_toegang_test.go, gebruikers/uitnodiging_test.go).
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const TOKEN = "Abcdefghijklmnopqrstuvwxyz0123456789_-XYZ";
const PROJECTEN = [
  { id: "probeer-0001", naam: "Probeer", eigenaar: "mark", versie: 3, recht: "beheren", bijgewerkt: "2026-10-14T09:00:00Z", grootte: 2048 },
  { id: "productie-01", naam: "Productie", eigenaar: "hugo", versie: 40, recht: "lezen", bijgewerkt: "2026-10-14T08:00:00Z", grootte: 4096 },
];

test("uitnodiging accepteren: gebruikersnaam voorgesteld, wachtwoordcontrole, juiste POST", async ({ page }) => {
  let verzonden = null;
  await page.route("**/api/**", (r) => r.fulfill({ status: 404, json: { error: "mock" } }));
  await page.route(`**/api/uitnodiging/${TOKEN}`, (r) => r.fulfill({ json: {
    email: "anna.de-vries@voorbeeld.nl", rol: "modelleur", verloopt: "2026-10-21T12:00:00Z", uitgenodigd_door: "mark",
    projecten: [{ id: "probeer-0001", naam: "Probeer", recht: "schrijven" }], min_wachtwoord: 10,
  } }));
  await page.route(`**/api/uitnodiging/${TOKEN}/accepteer`, (r) => {
    verzonden = r.request().postDataJSON();
    r.fulfill({ status: 201, json: { gebruikersnaam: verzonden.gebruikersnaam, rol: "modelleur", ingelogd: true } });
  });
  await page.goto(`/viz/react/studio/#uitnodiging=${TOKEN}`, { waitUntil: "domcontentloaded" });
  const kaart = page.getByTestId("uitnodiging");
  await expect(kaart).toContainText("mark");
  await expect(kaart).toContainText("modelleur");
  await expect(kaart).toContainText("Probeer");
  await expect(page.locator("#uitn-naam")).toHaveValue("anna.de-vries");
  const knop = kaart.locator("button[type=submit]");
  await page.locator("#uitn-ww").fill("kort");
  await expect(knop).toBeDisabled();
  await page.locator("#uitn-ww").fill("een-lang-wachtwoord");
  await page.locator("#uitn-herhaal").fill("iets-anders-dan-dat");
  await expect(kaart).toContainText("niet gelijk");
  await expect(knop).toBeDisabled();
  await page.locator("#uitn-naam").fill("anna");
  await page.locator("#uitn-herhaal").fill("een-lang-wachtwoord");
  await expect(knop).toBeEnabled();
  await Promise.all([page.waitForURL((u) => !u.hash.includes("uitnodiging")), knop.click()]);
  expect(verzonden).toEqual({ gebruikersnaam: "anna", wachtwoord: "een-lang-wachtwoord" });
});

test("ongeldige uitnodiging: duidelijke melding, geen formulier", async ({ page }) => {
  await page.route("**/api/**", (r) => r.fulfill({ status: 410, json: { error: "Deze uitnodiging is ongeldig, verlopen, ingetrokken of al gebruikt." } }));
  await page.goto(`/viz/react/studio/#uitnodiging=${TOKEN}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("uitnodiging")).toContainText("verlopen");
  await expect(page.locator("#uitn-naam")).toHaveCount(0);
});

test("Gebruikers → uitnodigen met rol en alleen het probeerproject", async ({ page }) => {
  let verzonden = null;
  await openStudio(page);
  await page.route("**/api/auth/me", (r) => r.fulfill({ json: { gebruikersnaam: "mark", rol: "admin" } }));
  await page.route("**/api/gebruikers", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/studio/projecten", (r) => r.fulfill({ json: PROJECTEN }));
  await page.route("**/api/gebruikers/uitnodigingen", (r) => {
    if (r.request().method() === "POST") {
      verzonden = r.request().postDataJSON();
      return r.fulfill({ status: 201, json: { link: `http://localhost/viz/react/studio.html#uitnodiging=${TOKEN}`, gemaild: false, mailfout: "" } });
    }
    return r.fulfill({ json: { aan: true, mail: false, rollen: ["lezer", "modelleur", "ontwerper", "bouwer", "beheerder"], uitnodigingen: [] } });
  });
  await page.evaluate(async () => {
    const st = await import(location.origin + "/viz/react/src/studio/useStudioStore.js");
    st.default.getState().setActief("gebruikers");
  });
  const sectie = page.getByTestId("uitnodigen");
  await expect(sectie).toContainText("geen mailserver");
  await sectie.locator("input[type=email]").fill("anna@voorbeeld.nl");
  await expect(sectie.locator("select").first()).toHaveValue("modelleur");
  await sectie.locator('[data-project-id="probeer-0001"] select').selectOption("schrijven");
  await sectie.locator("button[type=submit]").click();
  await expect.poll(() => verzonden).toEqual({
    email: "anna@voorbeeld.nl", weergavenaam: "", rol: "modelleur", dagen: 7,
    projecten: [{ id: "probeer-0001", recht: "schrijven" }],
  });
  await expect(page.getByTestId("uitnodiging-link")).toContainText(`#uitnodiging=${TOKEN}`);
});

test("Van server ophalen: alleen-lezen-project zonder beheer; Toegang… opslaan", async ({ page }) => {
  let opgeslagen = null;
  await openStudio(page);
  await page.route("**/api/studio/projecten", (r) => r.fulfill({ json: PROJECTEN }));
  await page.route("**/api/studio/projecten/probeer-0001/toegang", (r) => {
    if (r.request().method() === "PUT") {
      opgeslagen = r.request().postDataJSON();
      return r.fulfill({ status: 204, body: "" });
    }
    return r.fulfill({ json: { project_id: "probeer-0001", eigenaar: "mark", toegang: [{ subject: "*", recht: "lezen" }] } });
  });
  await page.evaluate(async () => {
    const { useProjectServerStore } = await import(location.origin + "/viz/react/src/studio/activities/ProjectServerDialoog.jsx");
    useProjectServerStore.getState().openen({ onKies: () => {} });
  });
  const prod = page.locator('tr[data-project-id="productie-01"]');
  const probeer = page.locator('tr[data-project-id="probeer-0001"]');
  await expect(prod).toContainText("alleen lezen");
  await expect(prod.locator("button", { hasText: "Toegang" })).toHaveCount(0);
  await expect(prod.locator("button", { hasText: "Verwijder" })).toHaveCount(0);
  await probeer.locator("button", { hasText: "Toegang" }).click();
  const paneel = page.getByTestId("project-toegang");
  await expect(paneel).toContainText("Iedereen die is ingelogd");
  await expect(paneel).toContainText("mark");
  await paneel.locator("button", { hasText: "+ gebruiker" }).click();
  await paneel.locator('input[aria-label="Gebruikersnaam"]').fill(" anna ");
  await paneel.locator("button", { hasText: "Opslaan" }).click();
  await expect(paneel).toContainText("Opgeslagen");
  expect(opgeslagen).toEqual({ toegang: [{ subject: "*", recht: "lezen" }, { subject: "anna", recht: "schrijven" }] });
});
