// Studio — een nieuw element op een diagram landt in de map van dat diagram (14-10, Mark:
// "vanzelf waar de context is: het diagram"), niet onder "Niet ingedeeld".
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("paletknop: het nieuwe element staat in de map van het open diagram", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_uc", diagramNaam: "Use case model", elementen: [
    { id: "e_gebr", naam: "gebruiker", type: "actor", pos: { x: 40, y: 60 } },
  ] });
  const mapId = await inModelleren(page, 'const m = ms.getState().nieuweMap("Test"); ms.getState().plaatsMeerdere(["usecase05::d_uc"], m); return m;');
  await page.waitForTimeout(300);
  await page.locator(".dc-taakbalk").getByRole("button", { name: "UC", exact: true }).first().click();
  await expect.poll(() => inModelleren(page, 'const s = ms.getState(); return Object.entries(s.plaatsing).filter(([k, v]) => k.startsWith("el::usecase05::") && k !== "el::usecase05::e_gebr" && v === arg).length;', mapId)).toBe(1);
  // Het bestaande element volgde al toen het diagram in de map kwam (boomregel).
  expect(await inModelleren(page, 'return ms.getState().plaatsing["el::usecase05::e_gebr"] || null;')).toBe(mapId);
});

test("diagram zonder map: het element blijft niet ingedeeld", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_los", diagramNaam: "Los", elementen: [] });
  await page.waitForTimeout(300);
  await page.locator(".dc-taakbalk").getByRole("button", { name: "UC", exact: true }).first().click();
  await page.waitForTimeout(300);
  expect(await inModelleren(page, 'return Object.keys(ms.getState().plaatsing).filter((k) => k.startsWith("el::")).length;')).toBe(0);
});

test("diagram in een map plaatsen: zijn niet-ingedeelde elementen volgen (import, migratie)", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_imp", diagramNaam: "Geïmporteerd", open: false, elementen: [
    { id: "i1", naam: "Lid", type: "actor", pos: { x: 40, y: 60 } },
    { id: "i2", naam: "Leen boek", type: "usecase", pos: { x: 300, y: 60 } },
    { id: "i3", naam: "Wees", type: "usecase" },
  ] });
  const mapId = await inModelleren(page, 'const m = ms.getState().nieuweMap("Import"); ms.getState().plaatsMeerdere(["usecase05::d_imp"], m); return m;');
  await expect.poll(() => inModelleren(page, 'const p = ms.getState().plaatsing; return [p["el::usecase05::i1"], p["el::usecase05::i2"], p["el::usecase05::i3"] || null];')).toEqual([mapId, mapId, null]);
});

test("boom opgeruimd (stap 4): lege profielen zwijgen, elementenlijst toont alleen wezen", async ({ page }) => {
  await openStudio(page);
  // Geen kop "Niet ingedeeld" meer (16-11): diagrammen zonder map staan in de root. De vaste
  // documenten van de klassieke editors staan daar alleen voor een beheerder; hier staat de login
  // uit, dus zie je ze (Canoniek model IDE (v1) e.a.).
  await expect(page.getByText("geen diagrammen")).toHaveCount(0);
  await expect(page.locator(".studio-project__sectie")).toHaveCount(0);
  await expect(page.getByTestId("boom-root")).toContainText("Canoniek model IDE (v1)");
  await expect(page.getByTestId("nieuw-diagram-los")).toBeVisible();
  // Een diagram in een map met twee elementen erop: beide volgen de boomregel → geen wezen.
  await zetModel(page, { profielId: "usecase05", diagramId: "d_uc", diagramNaam: "Use case model", elementen: [
    { id: "a1", naam: "Lid", type: "actor", pos: { x: 40, y: 40 } },
    { id: "u1", naam: "Leen boek", type: "usecase", pos: { x: 300, y: 40 } },
    { id: "zwerver", naam: "Zwerver", type: "usecase" },
  ] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Test"); ms.getState().plaatsMeerdere(["usecase05::d_uc"], m);');
  await expect.poll(() => inModelleren(page, 'return Object.keys(ms.getState().plaatsing).filter((k) => k.startsWith("el::")).length;')).toBe(2);
  // De zwerver staat nergens: de elementenlijst toont hem (en alleen hem).
  await expect(page.locator(".studio-project__elementen")).toContainText("Zwerver");
  await expect(page.locator(".studio-project__elementen")).not.toContainText("Leen boek");
  // Zwerver ook in een map: lijst klapt in tot één regel.
  await inModelleren(page, 'const m = Object.values(ms.getState().mappen)[0].id; ms.getState().plaatsMeerdere(["el::usecase05::zwerver"], m);');
  // Geen wezen: dan is er geen elementenvak (16-11).
  await expect(page.getByTestId("elementen-wezen")).toHaveCount(0);
  // Het use case-diagram staat in een map, dus niet in de root.
  await expect(page.getByTestId("boom-root")).not.toContainText("Use case model");
});

test("startpagina: een nieuw diagram komt in de root van de projectboom; uit een map slepen kan terug", async ({ page }) => {
  await openStudio(page);
  await page.locator(".studio-modelleren__leeg-knop", { hasText: "Use case" }).first().click();
  const dlg = page.locator(".studio-dialoog");
  await dlg.locator("input").fill("Mijn use cases");
  await dlg.getByRole("button", { name: "Aanmaken" }).click();
  const root = page.getByTestId("boom-root");
  await expect(root).toContainText("Mijn use cases");
  // In een map en weer terug naar de root (Verplaats naar → root gebeurt met plaatsDiagram(…, null)).
  const sleutel = await inModelleren(page, 'const t = ms.getState().actieveTab; const m = ms.getState().nieuweMap("Map"); ms.getState().plaatsDiagram(t, m); return t;');
  await expect(root).not.toContainText("Mijn use cases");
  await inModelleren(page, "ms.getState().plaatsDiagram(arg, null);", sleutel);
  await expect(root).toContainText("Mijn use cases");
});
