// Studio — auto-layout als submenu (18-10, Mark): de zes deterministische richtingen van de IDE
// staan onder "Auto-layout ▸" in het rechtsklikmenu, niet als hoofditems. Toetsenbord: → opent,
// ← gaat terug.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const posities = (page) =>
  inStore(page, "diagram05", 'const s = store.getState(); return Object.fromEntries(s.diagrams[s.actiefDiagramId].nodes.map((n) => [n.elementId, [Math.round(n.position.x), Math.round(n.position.y)]]));');

test("Rechtsklik: Auto-layout ▸ toont de zes richtingen; kiezen verplaatst de elementen", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_lay", diagramNaam: "Layout", elementen: [
    { id: "e1", naam: "Persoon", type: "entiteit", pos: { x: 300, y: 460 } },
    { id: "e2", naam: "Adres", type: "entiteit", pos: { x: 320, y: 480 } },
    { id: "e3", naam: "Woonplaats", type: "entiteit", pos: { x: 340, y: 500 } },
  ] });
  const voor = await posities(page);

  await page.locator(".react-flow__pane").first().click({ button: "right", position: { x: 600, y: 300 }, force: true });
  const ouder = page.locator(".dc-contextmenu-item--sub", { hasText: "Auto-layout" });
  await expect(ouder).toBeVisible();
  // Geen layout-richtingen als hoofditem.
  await expect(page.locator(".dc-contextmenu:not(.dc-contextmenu--sub) >> text=Gelaagd, van links naar rechts")).toHaveCount(0);
  await ouder.hover();
  const sub = page.getByTestId("contextmenu-sub");
  await expect(sub.getByRole("menuitem")).toHaveCount(6);
  await expect(sub).toContainText("Hiërarchisch");
  await sub.getByRole("menuitem", { name: /van links naar rechts/ }).click();
  await expect(page.locator(".dc-contextmenu")).toHaveCount(0);
  await expect.poll(() => posities(page)).not.toEqual(voor);
});

test("Toetsenbord: → opent het submenu, ← gaat terug naar Auto-layout", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_lay2", diagramNaam: "Layout 2", elementen: [
    { id: "e1", naam: "Persoon", type: "entiteit", pos: { x: 300, y: 460 } },
  ] });
  await page.locator(".react-flow__pane").first().click({ button: "right", position: { x: 600, y: 300 }, force: true });
  const ouder = page.locator(".dc-contextmenu-item--sub", { hasText: "Auto-layout" });
  await ouder.focus();
  await page.keyboard.press("ArrowRight");
  const sub = page.getByTestId("contextmenu-sub");
  await expect(sub.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(sub).toHaveCount(0);
  await expect(ouder).toBeFocused();
  // Het hoofdmenu is nog open.
  await expect(page.locator(".dc-contextmenu")).toHaveCount(1);
});

// Andere profielen (18-10, Mark): de algemene layout op de leesvolgorde van het profiel. Use case:
// standaard van links naar rechts — actoren links, het systeemkader met de use cases rechts.
test("Use case: Auto-layout ▸ leesvolgorde; actor links van het kader, het kader groeit om zijn use cases", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_uclay", diagramNaam: "UC layout", elementen: [
    { id: "sys", naam: "Bibliotheek", type: "systeem", pos: { x: 200, y: 460 }, size: { width: 200, height: 120 } },
    { id: "lid", naam: "Lid", type: "actor", pos: { x: 600, y: 460 } },
    { id: "u1", naam: "Leen boek", type: "usecase", pos: { x: 220, y: 500 } },
    { id: "u2", naam: "Verleng", type: "usecase", pos: { x: 240, y: 520 } },
    { id: "b1", type: "bevat", source: "sys", target: "u1" },
    { id: "b2", type: "bevat", source: "sys", target: "u2" },
    { id: "a1", type: "associatie", source: "lid", target: "u1" },
    { id: "a2", type: "associatie", source: "lid", target: "u2" },
  ] });
  await page.locator(".react-flow__pane").first().click({ button: "right", position: { x: 600, y: 300 }, force: true });
  await page.locator(".dc-contextmenu-item--sub", { hasText: "Auto-layout" }).hover();
  const sub = page.getByTestId("contextmenu-sub");
  await expect(sub.getByRole("menuitem")).toHaveCount(4);
  await expect(sub.getByRole("menuitem").first()).toContainText("van links naar rechts (standaard)");
  await sub.getByRole("menuitem").first().click();
  const stand = () => inStore(page, "usecase05", 'const s = store.getState(); const d = s.diagrams[s.actiefDiagramId]; return Object.fromEntries(d.nodes.map((n) => [n.elementId, { ...n.position, ...(n.size || {}) }]));');
  await expect.poll(async () => { const p = await stand(); return p.lid.x < p.sys.x; }).toBe(true);
  const p = await stand();
  for (const u of ["u1", "u2"]) {
    expect(p[u].x).toBeGreaterThanOrEqual(p.sys.x);
    expect(p[u].y).toBeGreaterThanOrEqual(p.sys.y);
    expect(p[u].y).toBeLessThan(p.sys.y + p.sys.height);
  }
});

test("Sequence: geen Auto-layout in het menu (de volgorde is de tekening)", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "sequence05", diagramId: "d_seqlay", diagramNaam: "Seq", elementen: [
    { id: "l1", naam: "Klant", type: "levenslijn", pos: { x: 200, y: 460 } },
  ] });
  await page.locator(".react-flow__pane").first().click({ button: "right", position: { x: 600, y: 300 }, force: true });
  await expect(page.locator(".dc-contextmenu")).toBeVisible();
  await expect(page.locator(".dc-contextmenu-item--sub", { hasText: "Auto-layout" })).toHaveCount(0);
});
