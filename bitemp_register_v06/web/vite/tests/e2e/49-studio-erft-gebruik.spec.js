// Studio — ERFT-1 en GEBR-1 (Mark 06-11, via FUNDAMENT): overerving en «gebruikt» zijn
// modelgegevens (connectoren), getekend op elk diagram waar beide uiteinden staan.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const connectoren = (page, type) =>
  inStore(page, "diagram05", `return Object.values(store.getState().elements).filter((e) => e.elementType === "${type}").map((e) => e.source + "->" + e.target).sort();`);

test("een veldtype naar een enumeratie geeft een «gebruikt»-lijn; een oude overerving-lijn wordt een connector", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_eg", diagramNaam: "Erft en gebruik", elementen: [
    { id: "ge", naam: "Naam", type: "gegevenselement", pos: { x: 300, y: 460 }, compartimenten: [{ compartmentType: "velden", velden: [{ naam: "soort", fieldType: "attribuut", data: { typeLabel: "Soort" } }] }] },
    { id: "st", naam: "Soort", type: "enumeratie", pos: { x: 650, y: 460 } },
    { id: "a", naam: "Aanvraag", type: "entiteit", pos: { x: 300, y: 650 } },
    { id: "g", naam: "GpkAanvraag", type: "entiteit", pos: { x: 650, y: 650 } },
  ] });
  // GEBR-1: de migratie legt de «gebruikt»-connector uit het veldtype.
  await expect.poll(() => connectoren(page, "gebruik")).toEqual(["ge->st"]);
  // ...en het canvas tekent hem.
  await expect(page.locator('.react-flow__edge[data-id*="gebr_ge__st"], .react-flow__edge[data-testid*="gebr_ge__st"]').first()).toBeAttached();

  // ERFT-1: een oude presentatie-edge met isGeneralization (zoals na een V3-import) wordt een connector.
  await inStore(page, "diagram05", `store.setState((s) => ({ diagrams: { ...s.diagrams, d_eg: { ...s.diagrams.d_eg, edges: [...(s.diagrams.d_eg.edges || []), { id: "gen-g-a", source: "g", target: "a", data: { bron: { isGeneralization: true } } }] } } }));`);
  await expect.poll(() => connectoren(page, "generalisatie")).toEqual(["g->a"]);
  expect(await inStore(page, "diagram05", 'return (store.getState().diagrams.d_eg.edges || []).filter((e) => e.data?.bron?.isGeneralization).length;')).toBe(0);

  // Het veld krijgt een gewoon type: de afgeleide «gebruikt» verdwijnt.
  await inStore(page, "diagram05", `const el = store.getState().elements.ge; store.getState().updateElement("ge", { compartimenten: [{ compartmentType: "velden", velden: [{ naam: "soort", fieldType: "attribuut", data: { typeLabel: "string" } }] }] });`);
  await expect.poll(() => connectoren(page, "gebruik")).toEqual([]);
});
