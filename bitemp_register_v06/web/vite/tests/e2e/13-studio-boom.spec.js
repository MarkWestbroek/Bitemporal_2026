// Studio — projectboom en beschrijvingen (regressie 2026-10-12/13): kinderen
// onder een domein slepen en vinden, relatie onder zijn entiteit,
// map-beschrijving (oude `omschrijving`) en diagram-beschrijving.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore, inModelleren, sleepNaar } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const rij = (page, e) => page.locator(`[data-boomsleutel="el:el::diagram05::${e}"]`).first();

test.beforeEach(async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "dleeg", diagramNaam: "Leeg", elementen: [
    { id: "pkg", naam: "np-loc", type: "package" },
    { id: "np", naam: "NatuurlijkPersoon", type: "entiteit" },
    { id: "loc", naam: "Locatie", type: "entiteit" },
    { id: "b1", type: "bevat", source: "pkg", target: "np" },
    { id: "b2", type: "bevat", source: "pkg", target: "loc" },
    { id: "rel", naam: "woontOp", type: "relatie", source: "np", target: "loc" },
  ] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Canoniek model"); ms.getState().plaatsDiagram("el::diagram05::pkg", m);');
  await page.waitForTimeout(500);
});

test("zoeken in de projectboom vindt een kind onder het domein, en de relatie onder zijn entiteit", async ({ page }) => {
  await page.evaluate(async () => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("studio:zoek-in-boom", { profielId: "diagram05", elementId: "rel" });
  });
  await expect(rij(page, "rel")).toBeVisible();
  await expect(rij(page, "rel").locator("xpath=ancestor::div[contains(@class,'studio-project__elementrij')]").first()).toHaveClass(/is-flits/);
  // De relatie hangt onder NatuurlijkPersoon (zelfde subboom).
  const onderNp = await page.evaluate(() => {
    const r = document.querySelector('[data-boomsleutel="el:el::diagram05::rel"]');
    const np = document.querySelector('[data-boomsleutel="el:el::diagram05::np"]');
    return !!r && !!np && np.closest("div").parentElement.contains(r);
  });
  expect(onderNp).toBe(true);
  await page.evaluate(async () => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("studio:zoek-in-boom", { profielId: "diagram05", elementId: "np" });
  });
  await expect(rij(page, "np").locator("xpath=ancestor::div[contains(@class,'studio-project__elementrij')]").first()).toHaveClass(/is-flits/);
  await expect(rij(page, "pkg").locator("xpath=ancestor::div[contains(@class,'studio-project__elementrij')]").first()).not.toHaveClass(/is-flits/);
});

test("een element onder het domein is naar het diagram te slepen; het domein blijft", async ({ page }) => {
  await page.evaluate(async () => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("studio:zoek-in-boom", { profielId: "diagram05", elementId: "np" }); // klapt het domein open
  });
  await expect(rij(page, "np")).toHaveAttribute("draggable", "true");
  await sleepNaar(page, rij(page, "np"), page.locator(".react-flow__pane").first(), { x: 400, y: 450 });
  await expect.poll(() => inStore(page, "diagram05", 'return store.getState().diagrams.dleeg.nodes.map((n) => n.elementId)')).toEqual(["np"]);
  await expect(page.locator('.react-flow__node[data-id="np"]')).toBeVisible();
  expect(await inStore(page, "diagram05", 'return !!store.getState().elements.b1')).toBe(true);
});

test("map met oude 'omschrijving' toont 'beschrijving'; diagram-beschrijving wordt bewaard", async ({ page }) => {
  await inModelleren(page, 'ms.getState().patchStructuur({ zetMappen: { m_oud: { id: "m_oud", naam: "Hoofdstuk", ouderId: null, volgorde: 9, omschrijving: "Oude inleiding." } } }); ms.getState().selecteerMap("m_oud");');
  expect(await inModelleren(page, 'return ms.getState().mappen.m_oud')).toEqual({ id: "m_oud", naam: "Hoofdstuk", ouderId: null, volgorde: 9, beschrijving: "Oude inleiding." });
  const label = await page.evaluate(() => [...document.querySelectorAll("textarea")].find((t) => t.value === "Oude inleiding.")?.closest("label")?.querySelector("span")?.textContent);
  expect(label).toBe("beschrijving");
  await inModelleren(page, 'ms.getState().selecteerDiagram("diagram05", "dleeg");');
  const ta = page.locator('textarea[placeholder^="Wat laat dit diagram zien"]').first();
  await ta.fill("Alle personen en hun adressen.");
  await ta.blur();
  await expect.poll(() => inStore(page, "diagram05", 'return store.getState().diagrams.dleeg.beschrijving')).toBe("Alle personen en hun adressen.");
});
