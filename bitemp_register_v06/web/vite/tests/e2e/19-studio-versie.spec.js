// Studio — nieuwe versie en wat is er nieuw (14-10: Hugo kreeg de release pas na een F5), plus
// de meldingen #5 (sluitknop) en #7 (F8 met Mijn meldingen open).
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const emit = (page, ev) => page.evaluate(async (ev) => {
  const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
  menuBus.emit(ev);
}, ev);

test("nieuwe build op de server: strook met kopjes, Later verbergt hem", async ({ page }) => {
  await openStudio(page);
  await page.route("**/viz/react/versie.json**", (r) => r.fulfill({ json: { versie: "9.9.9", build: "9.9.9+abc", nieuw: ["Melden vanuit Omnium", "Mijn meldingen"] } }));
  await emit(page, "help:versie-controleren");
  const strook = page.getByTestId("nieuwe-versie");
  await expect(strook).toContainText("Nieuwe versie van Omnium (9.9.9)");
  await expect(strook).toContainText("Melden vanuit Omnium");
  await expect(strook.getByRole("button", { name: "Herladen" })).toBeVisible();
  await strook.getByRole("button", { name: "Later" }).click();
  await expect(strook).toHaveCount(0);
});

test("dezelfde build: geen strook", async ({ page }) => {
  await openStudio(page);
  const eigen = await page.evaluate(async () => (await fetch("/viz/react/versie.json")).json());
  await page.route("**/viz/react/versie.json**", (r) => r.fulfill({ json: eigen }));
  await emit(page, "help:versie-controleren");
  await page.waitForTimeout(500);
  await expect(page.getByTestId("nieuwe-versie")).toHaveCount(0);
});

test("na een update: één keer 'wat is er nieuw sinds je vorige bezoek'", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("studio05-tour-v1", "gezien");
    if (!sessionStorage.getItem("al")) { localStorage.setItem("studio05-versie-gezien", "0.0.1"); sessionStorage.setItem("al", "1"); }
  });
  // Zonder openStudio: die klikt na het laden op Modelleren, en die klik sluit het venster.
  await page.route("**/api/auth/status", (r) => r.fulfill({ json: { auth_enabled: true, ingelogd: true, gebruikersnaam: "test", rol: "editor" } }));
  await page.route("**/api/**", (r) => r.fulfill({ status: 404, json: { error: "mock" } }));
  await page.goto("/viz/react/studio/", { waitUntil: "domcontentloaded" });
  const venster = page.getByTestId("wat-is-nieuw");
  await expect(venster).toContainText("sinds je vorige bezoek");
  await expect(venster.locator("h3").first()).toContainText("Versie");
  await expect(venster.getByRole("link", { name: "Volledige releaselog" })).toHaveAttribute("href", /CHANGELOG\.md/);
  await page.keyboard.press("Escape");
  await expect(venster).toHaveCount(0);
  await page.reload();
  await page.waitForSelector(".studio-activitybar");
  await page.waitForTimeout(800);
  await expect(page.getByTestId("wat-is-nieuw")).toHaveCount(0);
});

test("Help → Wat is er nieuw… en de releaselog", async ({ page }) => {
  await openStudio(page);
  await page.locator('[data-tour="menu-help"]').click();
  await expect(page.getByText("Releaselog (CHANGELOG)…")).toBeVisible();
  await page.getByText("Wat is er nieuw…").click();
  await expect(page.getByTestId("wat-is-nieuw").locator("h3").first()).toContainText("Versie");
});

test("melding #5: Mijn meldingen heeft een sluitknop; #7: F8 met Mijn meldingen open houdt die in beeld", async ({ page }) => {
  await openStudio(page);
  await page.route("**/api/meldingen**", (r) => r.fulfill({ json: { meldingen: [], beheerder: false } }));
  await emit(page, "help:mijn-meldingen");
  const lijst = page.getByRole("dialog", { name: "Mijn meldingen" });
  await expect(lijst).toBeVisible();
  // #7: F8 terwijl de lijst open is — het bevroren beeld bevat hem, de lijst sluit pas daarna.
  await page.keyboard.press("F8");
  await expect(page.locator(".mld-kaderlaag__beeld")).toBeVisible({ timeout: 15_000 });
  await expect(lijst).toBeVisible();
  await page.mouse.click(700, 400);
  await expect(page.getByTestId("meld-formulier")).toBeVisible();
  await expect(lijst).toHaveCount(0);
  // #5: zichtbare sluitknop
  await page.getByRole("dialog", { name: "Melden" }).getByRole("button", { name: "Sluiten" }).click();
  await expect(page.getByTestId("meld-formulier")).toHaveCount(0);
});
