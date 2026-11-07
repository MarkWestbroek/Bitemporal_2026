// Studio — Mark, 07-11: navigeren via relaties, gerelateerde elementen toevoegen, boomstijl naar
// alle kanten.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore, node } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const MODEL = [
  { id: "np", naam: "NatuurlijkPersoon", type: "entiteit", pos: { x: 500, y: 420 } },
  { id: "loc", naam: "Locatie", type: "entiteit" },
  { id: "gem", naam: "Gemeente", type: "entiteit" },
  { id: "woon", naam: "Woonlocatie", type: "relatie", source: "np", target: "loc" },
  { id: "ligt", naam: "LigtIn", type: "relatie", source: "loc", target: "gem" },
];

test("relatiepaneel: klik op het andere element selecteert dát element; in de relatie zijn de uiteinden klikbaar", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_nav", diagramNaam: "Navigatie", elementen: MODEL });
  await node(page, "np").click({ position: { x: 20, y: 12 } });
  const paneel = page.locator(".dc-relaties");
  const kop = paneel.locator(".dc-relaties-kop");
  if ((await kop.getAttribute("aria-expanded")) !== "true") await kop.click();
  // De relatie zelf.
  await paneel.locator(".dc-relatie-zelf").first().click();
  await expect(page.getByTestId("inspector-uiteinden")).toHaveText(/NatuurlijkPersoon\s*→\s*Locatie/);
  // Vanuit de relatie naar Locatie.
  await page.getByTestId("inspector-uiteinden").getByRole("button", { name: "Locatie" }).click();
  await expect(page.locator(".dc-inspector h3")).toHaveText("Locatie");
  // En vanuit Locatie via het paneel direct naar Gemeente.
  await page.locator(".dc-relaties .dc-relatie-ander", { hasText: "Gemeente" }).click();
  await expect(page.locator(".dc-inspector h3")).toHaveText("Gemeente");
});

test("gerelateerde elementen toevoegen: diepte 1 en daarna alles", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_ger", diagramNaam: "Gerelateerd", elementen: MODEL });
  const opDiagram = () => inStore(page, "diagram05", 'return store.getState().diagrams.d_ger.nodes.map((n) => n.elementId).sort();');

  await node(page, "np").click({ button: "right", position: { x: 20, y: 12 } });
  await page.locator(".dc-contextmenu-item", { hasText: "Gerelateerde elementen toevoegen" }).click();
  const dialoog = page.locator(".studio-dialoog");
  await expect(dialoog).toContainText("Locatie (Entiteit)");
  await expect(dialoog).not.toContainText("Gemeente");
  // Diepte "alles": Gemeente komt erbij (via Locatie).
  await dialoog.getByTestId("review-instellingen").locator("select").selectOption({ label: "alles wat bereikbaar is" });
  await expect(dialoog).toContainText("Gemeente (Entiteit)");
  await dialoog.getByRole("button", { name: "Toevoegen" }).click();
  await expect.poll(opDiagram).toEqual(["gem", "loc", "np"]);
  // Eén undo-stap.
  await page.keyboard.press("Control+z");
  await expect.poll(opDiagram).toEqual(["np"]);
});

test("boomstijl: ook ouder onder en ouder rechts", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_boom", diagramNaam: "Boom", elementen: [
    { id: "o", naam: "Ouder", type: "entiteit", pos: { x: 500, y: 600 } },
    { id: "k", naam: "Kind", type: "entiteit", pos: { x: 500, y: 380 } },
    { id: "r", naam: "R", type: "relatie", source: "o", target: "k" },
  ] });
  await node(page, "o").click({ button: "right", position: { x: 20, y: 12 } });
  await page.locator(".dc-contextmenu-item", { hasText: "deze ouder onder" }).click();
  await expect.poll(() => inStore(page, "diagram05", 'const l = store.getState().diagrams.d_boom.lijnen?.r; return l ? [l.vorm, l.sourceHandle, l.targetHandle] : null;'))
    .toEqual(["boom", "source-top", "target-bottom"]);
});

// Mark, 07-11: "bij overerving is ouder rechts/links/boven/onder omgedraaid, en 'deze ouder …' op
// de ouder neemt overerving niet mee" — een generalisatie wijst van kind naar ouder.
test("boomstijl bij overerving: de ouder is het doel van de generalisatie", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_erf", diagramNaam: "Erf", elementen: [
    { id: "o", naam: "NieuwEntiteit", type: "entiteit", pos: { x: 500, y: 380 } },
    { id: "k", naam: "kind1", type: "entiteit", pos: { x: 500, y: 620 } },
    { id: "g", naam: "", type: "generalisatie", source: "k", target: "o" },
  ] });
  await node(page, "o").click({ button: "right", position: { x: 20, y: 12 } });
  await page.locator(".dc-contextmenu-item", { hasText: "deze ouder boven" }).click();
  await expect.poll(() => inStore(page, "diagram05", 'const l = store.getState().diagrams.d_erf.lijnen?.g; return l ? [l.sourceHandle, l.targetHandle, l.boomOuder] : null;'))
    .toEqual(["source-top", "target-bottom", "doel"]);
});
