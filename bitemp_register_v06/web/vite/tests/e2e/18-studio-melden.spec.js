// Studio — melden (plan docs/plans/meldingen/, HELP-3, 14-10): Help → Melden, F8 met kader en
// schermafbeelding, rechtsklik met pad, Mijn meldingen (reageren, behandelen) en melden.html.
// API gemockt; de serverkant testen meldingen/handlers_test.go en de end-to-end-run.
import { test, expect } from "@playwright/test";
import { openStudio, inModelleren } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

/** Mock de meldingen-API; geeft een object dat de verzoeken bijhoudt. */
async function mockMeldingen(page, { beheerder = false } = {}) {
  const log = { meldingen: [], bijlagen: [], reacties: [], behandelingen: [] };
  const lijst = [
    { id: 7, soort: "bug", titel: "Knop doet niets", beschrijving: "Klik, niets.", status: "in_behandeling", toelichting: "We kijken ernaar.",
      prioriteit: "hoog", melder: "gast", behandelaar: "mark", gemeld_op: "2026-10-14T10:00:00Z", context: { pad: "Map/X" },
      bijlagen: [], reacties: [{ tekst: "Welke browser?", auteur: "mark", wanneer: "2026-10-14T11:00:00Z" }] },
  ];
  await page.route("**/api/meldingen**", async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    if (req.method() === "POST" && url.pathname.endsWith("/api/meldingen")) {
      log.meldingen.push(req.postDataJSON());
      return r.fulfill({ status: 201, json: { id: 42 } });
    }
    if (req.method() === "POST" && url.pathname.endsWith("/bijlagen")) {
      log.bijlagen.push({ type: req.headers()["content-type"], grootte: (req.postDataBuffer() || Buffer.alloc(0)).length, png: (req.postDataBuffer() || Buffer.alloc(0)).includes(Buffer.from("PNG")) });
      return r.fulfill({ status: 201, json: { bestand: "abc" } });
    }
    if (req.method() === "POST" && url.pathname.endsWith("/reacties")) {
      log.reacties.push(req.postDataJSON());
      return r.fulfill({ status: 204, body: "" });
    }
    if (req.method() === "PUT" && url.pathname.endsWith("/behandeling")) {
      log.behandelingen.push(req.postDataJSON());
      return r.fulfill({ status: 204, body: "" });
    }
    return r.fulfill({ json: { meldingen: lijst, beheerder } });
  });
  return log;
}

test("Help → Melden: context gaat mee, melding verstuurd", async ({ page }) => {
  await openStudio(page);
  const log = await mockMeldingen(page);
  await page.locator('[data-tour="menu-help"]').click();
  await page.getByText("Melden… (bug, wens, vraag)").click();
  const form = page.getByTestId("meld-formulier");
  await expect(form).toBeVisible();
  await form.getByLabel("Wens").check();
  await form.getByLabel("Titel").fill("Donker thema voor het palet");
  await form.locator("textarea").fill("Zou fijn zijn.");
  await form.getByRole("button", { name: /Dit gaat mee/ }).click();
  await expect(form).toContainText("studio");
  await form.getByRole("button", { name: "Versturen" }).click();
  await expect(page.getByTestId("melding-verstuurd")).toContainText("#42");
  expect(log.meldingen[0]).toMatchObject({ soort: "wens", titel: "Donker thema voor het palet", beschrijving: "Zou fijn zijn." });
  expect(log.meldingen[0].context.studioversie).toMatch(/^studio /);
  expect(log.meldingen[0].context.browser).toBeTruthy();
});

test("F8: kader trekken geeft een schermafbeelding als bijlage, met de plek", async ({ page }) => {
  await openStudio(page);
  const log = await mockMeldingen(page);
  await page.keyboard.press("F8");
  await expect(page.getByTestId("kaderlaag")).toBeVisible();
  await page.mouse.move(80, 120);
  await page.mouse.down();
  await page.mouse.move(380, 420, { steps: 8 });
  await page.mouse.up();
  const form = page.getByTestId("meld-formulier");
  await expect(form).toBeVisible({ timeout: 15_000 });
  await expect(form.locator(".mld-bijlage img")).toHaveCount(1);
  await form.getByLabel("Titel").fill("Boom toont dubbele map");
  await form.getByRole("button", { name: "Versturen" }).click();
  await expect(page.getByTestId("melding-verstuurd")).toBeVisible();
  expect(log.meldingen[0].context.plek).toBeTruthy();
  expect(log.bijlagen).toHaveLength(1);
  expect(log.bijlagen[0].type).toContain("multipart/form-data");
  expect(log.bijlagen[0].png).toBe(true);
});

test("Esc tijdens het kader trekken annuleert", async ({ page }) => {
  await openStudio(page);
  await mockMeldingen(page);
  await page.keyboard.press("F8");
  await expect(page.getByTestId("kaderlaag")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("kaderlaag")).toHaveCount(0);
  await expect(page.getByTestId("meld-formulier")).toHaveCount(0);
});

test("rechtsklik op een map: melden over dit item, met pad en onderwerp", async ({ page }) => {
  await openStudio(page);
  const log = await mockMeldingen(page);
  await inModelleren(page, 'const a = ms.getState().nieuweMap("Hoofdstuk"); ms.getState().nieuweMap("Sectie", a);');
  await page.waitForTimeout(300);
  await page.getByText("Sectie", { exact: true }).first().click({ button: "right" });
  await page.getByText("Melden over dit item…").click();
  const form = page.getByTestId("meld-formulier");
  await form.getByRole("button", { name: /Dit gaat mee/ }).click();
  await expect(form).toContainText("Hoofdstuk/Sectie");
  await form.getByLabel("Titel").fill("Sectie verdwijnt");
  await form.getByRole("button", { name: "Versturen" }).click();
  await expect(page.getByTestId("melding-verstuurd")).toBeVisible();
  expect(log.meldingen[0].context.pad).toBe("Hoofdstuk/Sectie");
  expect(log.meldingen[0].context.onderwerpid).toMatch(/^map\//);
});

test("Mijn meldingen: status en gesprek; beheerder reageert en behandelt", async ({ page }) => {
  await openStudio(page);
  const log = await mockMeldingen(page, { beheerder: true });
  await page.evaluate(async () => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("help:mijn-meldingen");
  });
  const lijst = page.getByTestId("mijn-meldingen");
  await expect(lijst).toContainText("Alle meldingen");
  await expect(lijst).toContainText("in behandeling");
  await lijst.getByText("#7 Knop doet niets").click();
  const detail = page.getByTestId("melding-detail");
  await expect(detail).toContainText("We kijken ernaar.");
  await expect(detail).toContainText("Welke browser?");
  await detail.getByLabel("Reactie").fill("Firefox 140.");
  await detail.getByRole("button", { name: "Stuur" }).click();
  await expect.poll(() => log.reacties).toEqual([{ tekst: "Firefox 140." }]);
  const beh = page.getByTestId("behandeling");
  await beh.locator("select").first().selectOption("opgelost");
  await beh.locator('input[placeholder^="bv. opgelost"]').fill("In 0.19.1.");
  await beh.getByRole("button", { name: "Opslaan" }).click();
  await expect.poll(() => log.behandelingen).toEqual([{ status: "opgelost", toelichting: "In 0.19.1." }]);
});

test("F8 en Alt+M staan in het sneltoetsenoverzicht", async ({ page }) => {
  await openStudio(page);
  await page.locator('[data-tour="menu-help"]').click();
  await page.getByText("Sneltoetsen…").click();
  const ov = page.getByRole("dialog", { name: "Sneltoetsen" });
  await expect(ov).toContainText("Melden met schermafbeelding");
  await expect(ov.locator("kbd", { hasText: "F8" })).toBeVisible();
});

test("melden.html: formulier buiten de Studio", async ({ page }) => {
  const log = await mockMeldingen(page);
  await page.route("**/api/auth/status", (r) => r.fulfill({ json: { auth_enabled: true, ingelogd: true, gebruikersnaam: "gast", rol: "modelleur" } }));
  await page.goto("/viz/react/melden.html", { waitUntil: "domcontentloaded" });
  const form = page.getByTestId("meld-formulier");
  await expect(form).toBeVisible({ timeout: 30_000 });
  await form.getByLabel("Titel").fill("Studio laadt niet");
  await form.getByRole("button", { name: "Versturen" }).click();
  await expect(page.getByTestId("melding-verstuurd")).toBeVisible();
  expect(log.meldingen[0].context.studioversie).toContain("melden.html");
  await page.getByRole("button", { name: "Mijn meldingen" }).first().click();
  await expect(page.getByTestId("mijn-meldingen")).toContainText("Knop doet niets");
});

test("F8 met een open rechtsklikmenu: het beeld is bevroren vóór de klik die het menu sluit (melding #3)", async ({ page }) => {
  await openStudio(page);
  await mockMeldingen(page);
  await inModelleren(page, 'ms.getState().nieuweMap("Hoofdstuk");');
  await page.waitForTimeout(300);
  await page.getByText("Hoofdstuk", { exact: true }).first().click({ button: "right" });
  await expect(page.locator(".studio-ctxmenu")).toBeVisible();
  await page.keyboard.press("F8");
  // Het bevroren beeld staat er, en het menu is nog open (het zit dus in het beeld).
  await expect(page.locator(".mld-kaderlaag__beeld")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".studio-ctxmenu")).toBeVisible();
  const menu = await page.locator(".studio-ctxmenu").boundingBox();
  await page.mouse.move(menu.x - 10, menu.y - 10);
  await page.mouse.down();
  await page.mouse.move(menu.x + menu.width + 10, menu.y + menu.height + 10, { steps: 6 });
  await page.mouse.up();
  const form = page.getByTestId("meld-formulier");
  await expect(form.locator(".mld-bijlage img")).toHaveCount(1);
  await form.getByRole("button", { name: /Dit gaat mee/ }).click();
  await expect(form.locator("dt", { hasText: "plek" })).toHaveCount(1);
});

test("+ schermafbeelding in het formulier: tekst blijft staan, bijlage erbij (melding #2)", async ({ page }) => {
  await openStudio(page);
  const log = await mockMeldingen(page);
  await page.keyboard.press("Alt+m");
  const form = page.getByTestId("meld-formulier");
  await form.getByLabel("Titel").fill("Twee afbeeldingen");
  await form.getByRole("button", { name: "+ schermafbeelding" }).click();
  await expect(page.locator(".mld-kaderlaag__beeld")).toBeVisible({ timeout: 15_000 });
  await expect(form).toBeHidden();
  await page.mouse.click(700, 400); // klik = hele venster
  await expect(form).toBeVisible();
  await expect(form.getByLabel("Titel")).toHaveValue("Twee afbeeldingen");
  await expect(form.locator(".mld-bijlage img")).toHaveCount(1);
  await form.getByLabel("Compliment").check();
  await form.getByRole("button", { name: "Versturen" }).click();
  await expect(page.getByTestId("melding-verstuurd")).toBeVisible();
  expect(log.meldingen[0].soort).toBe("compliment");
  expect(log.bijlagen).toHaveLength(1);
});
