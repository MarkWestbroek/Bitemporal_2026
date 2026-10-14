// Studio — persoonlijke API-tokens (AI-1, 14-10): maken (één keer zichtbaar) en intrekken.
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("Gebruikers → Mijn API-tokens: maken toont het token één keer, intrekken", async ({ page }) => {
  const log = [];
  let tokens = [];
  await openStudio(page);
  await page.route("**/api/auth/me", (r) => r.fulfill({ json: { gebruikersnaam: "gast", rol: "modelleur" } }));
  await page.route("**/api/gebruikers", (r) => r.fulfill({ status: 403, json: { error: "Onvoldoende rechten." } }));
  await page.route("**/api/auth/tokens**", async (r) => {
    const req = r.request();
    if (req.method() === "POST") {
      log.push(req.postDataJSON());
      tokens = [{ id: 1, naam: "MCP in VS Code", begin: "omt_AbCdEf", aangemaakt: "2026-10-14T03:00:00Z", verloopt: "2027-01-12T03:00:00Z" }];
      return r.fulfill({ status: 201, json: { token: "omt_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefg", id: 1, naam: "MCP in VS Code" } });
    }
    if (req.method() === "DELETE") {
      log.push("DELETE " + new URL(req.url()).pathname);
      tokens = [];
      return r.fulfill({ status: 204, body: "" });
    }
    return r.fulfill({ json: tokens });
  });
  await page.evaluate(async () => {
    const st = await import(location.origin + "/viz/react/src/studio/useStudioStore.js");
    st.default.getState().setActief("gebruikers");
  });
  const sectie = page.getByTestId("mijn-tokens");
  await expect(sectie).toBeVisible();
  await sectie.getByRole("button", { name: "Token maken" }).click();
  await expect(page.getByTestId("nieuw-token")).toContainText("omt_AbCdEf");
  expect(log[0]).toEqual({ naam: "MCP in VS Code", dagen: 90 });
  await sectie.getByRole("button", { name: "Klaar" }).click();
  await expect(page.getByTestId("nieuw-token")).toHaveCount(0);
  await expect(sectie).toContainText("omt_AbCdEf…");
  await sectie.getByRole("button", { name: "Intrekken" }).click();
  await page.locator("button", { hasText: /^Intrekken$/ }).first().click(); // de bevestiging (staat eerder in de DOM)
  await expect.poll(() => log.at(-1)).toBe("DELETE /api/auth/tokens/1");
});
