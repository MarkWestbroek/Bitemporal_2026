// global-setup.js — logt eenmalig in via de API en slaat de auth-cookie op.
// Alle tests hergebruiken de opgeslagen state (geen herhaalde login-flows).
//
// Vereiste env vars (of defaults):
//   PLAYWRIGHT_USERNAME  (default: "admin")
//   PLAYWRIGHT_PASSWORD  (default: "admin123")
//   PLAYWRIGHT_API_URL   (default: "http://localhost:8082")
//
// Opgeslagen state: tests/e2e/.auth/user.json (uitgesloten van git)

import { chromium } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AUTH_STATE_PATH = path.join(__dirname, ".auth", "user.json");

export default async function globalSetup() {
  const apiUrl = process.env.PLAYWRIGHT_API_URL || "http://localhost:8082";
  const gebruikersnaam = process.env.PLAYWRIGHT_USERNAME || "admin";
  const wachtwoord = process.env.PLAYWRIGHT_PASSWORD || "admin123";

  // Auth-state map aanmaken als die nog niet bestaat
  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });

  // Check auth status — als auth uitgeschakeld is, slaan we login over
  let authEnabled = false;
  try {
    const statusRes = await fetch(`${apiUrl}/api/auth/status`);
    const status = await statusRes.json();
    authEnabled = status.auth_enabled === true;
  } catch (e) {
    console.warn("[global-setup] API niet bereikbaar op", apiUrl, "— auth-check overgeslagen.");
    // Schrijf lege state zodat tests door kunnen gaan
    fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  if (!authEnabled) {
    console.log("[global-setup] AUTH_ENABLED=false — login overgeslagen, lege state opgeslagen.");
    fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  // Login via browser (zodat httpOnly cookie correct wordt opgeslagen door Playwright)
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Ga naar de login-pagina (triggert AuthBeschermd redirect)
  const viteUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5174";
  await page.goto(`${viteUrl}/viz/react/ide/`, { waitUntil: "domcontentloaded" });

  // Vul het login-formulier in
  await page.locator('input[name="gebruikersnaam"], input[type="text"]').first().fill(gebruikersnaam);
  await page.locator('input[type="password"]').first().fill(wachtwoord);
  await page.locator('button[type="submit"]').first().click();

  // Wacht tot we daadwerkelijk ingelogd zijn (window.__useModelStore beschikbaar)
  await page.waitForFunction(() => !!window.__useModelStore, null, { timeout: 15_000 })
    .catch(async () => {
      await page.screenshot({ path: "playwright-report/global-setup-login-failed.png", fullPage: true });
      throw new Error(
        `[global-setup] Login mislukt. Controleer PLAYWRIGHT_USERNAME en PLAYWRIGHT_PASSWORD.\n` +
        `Gebruikersnaam: ${gebruikersnaam} | API: ${apiUrl}\n` +
        `Zie: playwright-report/global-setup-login-failed.png`
      );
    });

  // Sla cookies op
  await context.storageState({ path: AUTH_STATE_PATH });
  console.log(`[global-setup] Ingelogd als "${gebruikersnaam}" — auth state opgeslagen.`);

  await browser.close();
}
