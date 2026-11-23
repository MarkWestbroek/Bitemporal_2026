// Studio — stap 7, de rol ontwerper (plan "Sidecar-project" §10; Mark 22/23-11). De MAIN van een
// centraal project is van de beheerder; wie het opent met alleen leesrecht, krijgt uitgelegd
// dat hij in een branch werkt. De serverregel zelf testen de Go-tests
// (handlers/studio_centraal_rol_test.go). API gemockt.
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const META = { id: "omnium-sidecar", naam: "Profielen", eigenaar: "mark", versie: 5, recht: "lezen", bijgewerkt: "2026-11-23T09:00:00Z", grootte: 2048 };

test("een centraal project met alleen leesrecht: melding met de weg naar een branch", async ({ page }) => {
  await openStudio(page);
  await page.route("**/api/studio/projecten", (r) => r.fulfill({ json: [META] }));
  await page.route("**/api/studio/projecten/omnium-sidecar/ops**", (r) => r.fulfill({ json: { ops: [], laatsteVolgnummer: 0 } }));
  await page.route("**/api/studio/projecten/omnium-sidecar", (r) =>
    r.fulfill({
      json: {
        ...META,
        tot_volgnummer: 0,
        laatste_volgnummer: 0,
        centraal: true,
        inhoud: { formaat: "studio-project", versie: 4, project: { id: "omnium-sidecar", naam: "Profielen", soort: "profielen", versie: "1.0.0" }, profielen: {} },
      },
    })
  );
  await page.locator('[data-tour="menu-project"]').first().click();
  await page.getByText("Van server ophalen…", { exact: true }).first().click();
  await page.locator('tr[data-project-id="omnium-sidecar"]').locator("button", { hasText: "Ophalen" }).click();
  const ok = page.getByRole("button", { name: /Ophalen|Vervang|OK/ });
  if (await ok.count()) await ok.first().click().catch(() => {});
  const melding = page.locator(".studio-dialoog").filter({ hasText: "Centraal project" });
  await expect(melding).toContainText("alleen de beheerder wijzigt het");
  await expect(melding).toContainText("Branch maken");
});
