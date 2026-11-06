// Studio — Mark, 06-11: "ik kan op een REL niet zien wie A en B zijn". De inspector van een
// connector toont zijn uiteinden: bron → doel.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("de inspector van een relatie toont tussen welke entiteiten hij loopt", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_rel", diagramNaam: "Relatie", elementen: [
    { id: "p", naam: "Persoon", type: "entiteit", pos: { x: 300, y: 460 } },
    { id: "a", naam: "Adres", type: "entiteit", pos: { x: 700, y: 460 } },
    { id: "r", naam: "woontOp", type: "relatie", source: "p", target: "a", pos: { x: 500, y: 600 },
      compartimenten: [{ compartmentType: "velden", velden: [{ naam: "sinds", fieldType: "attribuut", data: { typeLabel: "date" } }] }] },
  ] });
  // Klik op de doos van de relatie (een relatie met velden, zoals ArtefactAfhankelijkheid).
  const { node } = await import("./helpers/studio.js");
  await node(page, "r").click({ position: { x: 20, y: 12 } });
  const uiteinden = page.getByTestId("inspector-uiteinden");
  await expect(uiteinden).toHaveText(/Persoon\s*→\s*Adres/);
});

// Mark, 06-11: "ik heb nu een REL onder Artefact, maar ik weet niet waar ik de andere ENT vandaan
// moet halen" — rechtsklik op de relatie → het ontbrekende uiteinde op het diagram zetten.
test("rechtsklik op een relatie zet het ontbrekende uiteinde op het diagram", async ({ page }) => {
  const { inStore, node } = await import("./helpers/studio.js");
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_rel2", diagramNaam: "Relatie 2", elementen: [
    { id: "art", naam: "Artefact", type: "entiteit", pos: { x: 300, y: 460 } },
    { id: "ver", naam: "Versie", type: "entiteit" },
    { id: "afh", naam: "ArtefactAfhankelijkheid", type: "relatie", source: "art", target: "ver", pos: { x: 560, y: 460 },
      compartimenten: [{ compartmentType: "velden", velden: [{ naam: "reden", fieldType: "attribuut", data: { typeLabel: "KorteTekst" } }] }] },
  ] });
  await expect(node(page, "afh")).toBeVisible();
  await node(page, "afh").click({ button: "right", position: { x: 20, y: 12 } });
  await page.locator(".dc-contextmenu-item", { hasText: "Zet Versie op dit diagram" }).click();
  await expect.poll(() => inStore(page, "diagram05", 'return store.getState().diagrams.d_rel2.nodes.map((n) => n.elementId).sort();')).toEqual(["afh", "art", "ver"]);
});
