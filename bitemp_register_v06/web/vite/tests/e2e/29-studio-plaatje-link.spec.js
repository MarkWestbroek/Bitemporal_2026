// Studio — gedeelde plaatjes (16-10, Mark): bij "Kopieer voor Teams/Confluence" kunnen de
// diagrammen als link mee (Confluence laat ingebedde plaatjes weg). De server is hier nagebootst:
// we controleren wat Studio stuurt (PNG + herkomst) en wat er op het klembord komt (<img src=adres>).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";

test("Kopieer met plaatjes als link: PNG naar de server, <img> met het adres op het klembord; intrekken", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const verstuurd = [];
  let ingetrokken = null;
  await openStudio(page);
  // Alles van de server dat deze test niet nabootst: 404 (werkruimte, sync). Latere routes winnen.
  await page.route("**/api/**", (r) => r.fulfill({ status: 404, json: { error: "mock" } }));
  const meta = (soort) => ({
    token: TOKEN, pad: `/api/beeld/${TOKEN}.png`, profiel_id: "usecase05", diagram_id: "d_1", diagram_naam: "Overzicht",
    soort, hash: "abc", grootte: 100, breedte: 300, hoogte: 120, aangemaakt: "2026-10-16T12:00:00Z", bijgewerkt: "2026-10-16T12:00:00Z", door: "mark",
  });
  await page.route("**/api/studio/projecten/test-beeld-01/beelden**", async (r) => {
    const req = r.request();
    if (req.method() === "POST") {
      const body = req.postDataJSON();
      verstuurd.push(body);
      return r.fulfill({ status: 201, json: meta(body.soort) });
    }
    if (req.method() === "DELETE") {
      ingetrokken = req.url().split("/").pop();
      return r.fulfill({ status: 204, body: "" });
    }
    return r.fulfill({ json: { beelden: ingetrokken ? [] : [meta("momentopname")] } });
  });

  await page.evaluate(async () => {
    const { useModellerenStore } = await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx");
    // Project "op de server", zonder live-sync (geen poll/SSE in deze test).
    useModellerenStore.setState((s) => ({ project: { ...s.project, id: "test-beeld-01", serverVersie: 1, liveSync: false } }));
    const { merkHerkomst } = await import(location.origin + "/viz/react/src/transformatie/sjabloon/rijkKopieren.js");
    const { useDocumentStore } = await import(location.origin + "/viz/react/src/studio/activities/documentVoorbeeld.jsx");
    const svg = merkHerkomst(
      '<svg width="300" height="120" viewBox="0 0 300 120"><title>Overzicht</title><rect x="10" y="10" width="280" height="100" fill="#bae6fd" stroke="#0369a1"/><text x="40" y="70">Leen boek</text></svg>',
      { profielId: "usecase05", diagramId: "d_1", naam: "Overzicht" }
    );
    const markdown = `# Testdocument\n\n## Diagram: Overzicht\n\n${svg}\n`;
    useDocumentStore.getState().toon({ titel: "Testdocument", markdown, html: `<html><body>${svg}</body></html>` });
  });

  await page.getByTestId("kopieer-plaatjes").selectOption("momentopname");
  await page.getByTestId("kopieer-rijk").click();
  await expect(page.getByTestId("document-melding")).toContainText("1 plaatje als link");

  expect(verstuurd).toHaveLength(1);
  expect(verstuurd[0]).toMatchObject({ profiel_id: "usecase05", diagram_id: "d_1", diagram_naam: "Overzicht", soort: "momentopname", breedte: 300, hoogte: 120 });
  expect(verstuurd[0].png).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/=]{200,}$/);

  const klembord = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    return { html: await (await item.getType("text/html")).text(), tekst: await (await item.getType("text/plain")).text() };
  });
  expect(klembord.html).not.toContain("<svg");
  expect(klembord.html).not.toContain("data:image");
  expect(klembord.html).toMatch(new RegExp(`<img src="https?://[^"]+/api/beeld/${TOKEN}\\.png" width="300" height="120" alt="Overzicht">`));
  expect(klembord.tekst).toMatch(new RegExp(`!\\[Diagram 1\\]\\(https?://[^)]+/api/beeld/${TOKEN}\\.png\\)`));

  // Keuze onthouden; beheerpaneel met intrekken.
  expect(await page.evaluate(() => localStorage.getItem("studio-kopieer-plaatjes"))).toBe("momentopname");
  await page.getByTestId("gedeelde-plaatjes").click();
  await expect(page.getByTestId("gedeeld-plaatje")).toHaveCount(1);
  await page.getByTestId("plaatje-intrekken").click();
  await page.getByRole("dialog").getByRole("button", { name: "Intrekken" }).click();
  await expect(page.getByTestId("gedeeld-plaatje")).toHaveCount(0);
  expect(ingetrokken).toBe(TOKEN);
});

test("Project niet op de server: alleen ingebed te kiezen", async ({ page }) => {
  await openStudio(page);
  await page.evaluate(async () => {
    const { useDocumentStore } = await import(location.origin + "/viz/react/src/studio/activities/documentVoorbeeld.jsx");
    useDocumentStore.getState().toon({ titel: "Lokaal", markdown: "# Lokaal\n", html: "<html><body>Lokaal</body></html>" });
  });
  await expect(page.getByTestId("kopieer-plaatjes")).toHaveValue("ingebed");
  await expect(page.getByTestId("kopieer-plaatjes").locator('option[value="actueel"]')).toBeDisabled();
  await expect(page.getByTestId("gedeelde-plaatjes")).toHaveCount(0);
});

test("Houd up to date: na een wijziging in het diagram gaat er vanzelf een nieuw plaatje naar hetzelfde adres", async ({ page }) => {
  const verstuurd = [];
  await openStudio(page);
  await page.route("**/api/**", (r) => r.fulfill({ status: 404, json: { error: "mock" } }));
  await page.route("**/api/studio/projecten/test-beeld-02/beelden**", async (r) => {
    const req = r.request();
    const actueel = { token: TOKEN, pad: `/api/beeld/${TOKEN}.png`, profiel_id: "usecase05", diagram_id: "d_live", diagram_naam: "Live", soort: "actueel", bijgewerkt: "2026-10-16T12:00:00Z" };
    if (req.method() === "POST") {
      verstuurd.push(req.postDataJSON());
      return r.fulfill({ json: actueel });
    }
    return r.fulfill({ json: { beelden: [actueel] } });
  });
  await zetModel(page, { profielId: "usecase05", diagramId: "d_live", diagramNaam: "Live", elementen: [
    { id: "uc1", naam: "Boek lenen", type: "usecase", pos: { x: 300, y: 460 } },
  ] });
  await page.evaluate(async () => {
    const { useModellerenStore } = await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx");
    useModellerenStore.setState((s) => ({ project: { ...s.project, id: "test-beeld-02", serverVersie: 1, liveSync: false } }));
  });
  // Bij openen één keer bijwerken (vangt wijzigingen buiten Studio om, bv. via de MCP).
  await expect.poll(() => verstuurd.length, { timeout: 15000 }).toBe(1);
  expect(verstuurd[0]).toMatchObject({ profiel_id: "usecase05", diagram_id: "d_live", soort: "actueel", alleen_bijwerken: true });
  // Wijziging → na een korte stilte een nieuw plaatje.
  await inStore(page, "usecase05", 'store.getState().updateElement("uc1", { naam: "Boek verlengen" });');
  await expect.poll(() => verstuurd.length, { timeout: 15000 }).toBe(2);
  expect(verstuurd[1].png).not.toBe(verstuurd[0].png);
  // Geen wijziging → niets meer.
  await page.waitForTimeout(5000);
  expect(verstuurd).toHaveLength(2);
  // Rechtsklik op het lege canvas biedt de plaatje-link aan.
  await page.locator(".react-flow__pane").first().click({ button: "right", position: { x: 700, y: 250 }, force: true });
  await expect(page.getByText("Kopieer als plaatje-link (Confluence)")).toBeVisible();
});
