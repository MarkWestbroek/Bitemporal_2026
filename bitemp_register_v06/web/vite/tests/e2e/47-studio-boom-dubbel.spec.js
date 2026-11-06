// Studio — Mark, 06-11: "control sleep ENT en daarna control Z een paar keer leverde een kopie op".
// Geen kopie in het model, maar hetzelfde element twee keer in de boom: de relatie (model-undo)
// en de plaats in een map (structuur-undo) hebben elk hun eigen Ctrl+Z. Hangt een element via
// een boomrelatie onder een ouder die in de boom staat, dan toont de boom het alleen daar.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("een element in een package én met een oude plaats in de map staat één keer in de boom", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_x", diagramNaam: "X", open: false, elementen: [
    { id: "pkg", naam: "Domein", type: "package" },
    { id: "ent", naam: "Persoon", type: "entiteit" },
    { id: "ge", naam: "Naam", type: "gegevenselement" },
    { id: "c", type: "compositie", source: "ent", target: "ge" },
  ] });
  const mapId = await inModelleren(page, 'const m = ms.getState().nieuweMap("Nest"); ms.getState().plaatsMeerdere(["el::diagram05::pkg", "el::diagram05::ent"], m); return m;');
  const rijen = page.locator('[data-testid="boom-el-ent"]');
  await expect(rijen).toHaveCount(1);

  // In het package slepen: bevat-relatie, eigen plaats weg.
  await rijen.locator("button.studio-project__element").dragTo(page.getByTestId("boom-el-pkg"));
  await expect.poll(() => inModelleren(page, 'return ms.getState().plaatsing["el::diagram05::ent"] || null;')).toBeNull();

  // Ctrl+Z in de boom draait alleen de structuur terug: de oude plaats in de map komt terug,
  // de bevat-relatie in het model blijft. Toch maar één rij Persoon (onder het package).
  await page.getByTestId("boom-el-pkg").locator("button.studio-project__element").click();
  await page.keyboard.press("Control+z");
  await expect.poll(() => inModelleren(page, 'return ms.getState().plaatsing["el::diagram05::ent"] || null;')).toBe(mapId);
  await inModelleren(page, 'ms.getState().zetBoomUitklap("el::diagram05::pkg");');
  await expect(rijen).toHaveCount(1);
});

// Mark, 06-11: onder een package stond alleen "Nieuw diagram hiermee"; gewoon een nieuw (leeg)
// diagram eronder moet ook kunnen.
test("rechtsklik op een package: Nieuw diagram ▸ taal hangt een leeg diagram eronder", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_y", diagramNaam: "Y", open: false, elementen: [{ id: "pkg", naam: "Domein", type: "package" }] });
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Nest"); ms.getState().plaatsMeerdere(["el::diagram05::pkg"], m);');
  await page.getByTestId("boom-el-pkg").locator("button.studio-project__element").click({ button: "right" });
  const menu = page.locator(".studio-ctxmenu");
  await menu.getByRole("button", { name: /^Nieuw diagram( ▸)?$/ }).click();
  await menu.getByRole("button", { name: "Canoniek model", exact: true }).click();
  const dlg = page.locator(".studio-dialoog");
  await dlg.locator("input").fill("Domeinoverzicht");
  await dlg.getByRole("button", { name: "Aanmaken" }).click();
  await expect.poll(() => inModelleren(page, `
    const [k] = Object.entries(ms.getState().plaatsing).find(([, o]) => o === "el::diagram05::pkg") || [];
    return k || null;`)).toMatch(/^diagram05::/);
});
