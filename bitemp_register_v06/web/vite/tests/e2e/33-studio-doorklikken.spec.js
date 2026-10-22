// Studio — doorklikken naar een diagram (M3 verwijstNaar, 20-10, Mark): de kiezer "verwijst naar"
// kiest een diagram in elk profiel; het element krijgt de ⧉-badge, dubbelklik en "Open …" in het
// contextmenu openen het diagram — ook in een ander profiel (tab in Modelleren).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inModelleren, inStore, node } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("verwijst naar: kiezen over profielen, badge, dubbelklik en Open … openen het diagram", async ({ page }) => {
  await openStudio(page);
  // Doel: een activiteitendiagram (ander profiel).
  await zetModel(page, { profielId: "activity05", diagramId: "d_doel", diagramNaam: "Uitlenen (AD)", open: false, elementen: [
    { id: "b1", type: "begin", pos: { x: 100, y: 460 } },
  ] });
  // Bron: een use case.
  await zetModel(page, { profielId: "usecase05", diagramId: "d_bron", diagramNaam: "Bibliotheek", elementen: [
    { id: "u1", naam: "Leen boek", type: "usecase", pos: { x: 300, y: 460 } },
  ] });
  await node(page, "u1").click({ position: { x: 20, y: 10 } });
  const kiezer = page.getByTestId("diagram-verwijzing-verwijstNaar");
  await expect(kiezer).toBeVisible();
  // Dezelfde kiezer als elke verwijzing: keuzelijst (optgroup per profiel) + 🔍-minibrowser met
  // zoekveld (Mark, 21-10: lange lijsten). Eerst zoeken en klikken, dan de keuzelijst.
  await kiezer.getByTitle("Bladeren…").click();
  const mini = page.locator(".dc-minibrowser");
  await mini.locator("input").fill("uitlen");
  await expect(mini.locator(".dc-minibrowser-item")).toHaveCount(1);
  await mini.locator(".dc-minibrowser-item").click();
  await expect(kiezer.locator("select")).toHaveValue("activity05::d_doel");
  await kiezer.locator("select").selectOption("");
  await expect(node(page, "u1").locator(".dc-gedrag-badge")).toHaveCount(0);
  await kiezer.locator("select").selectOption("activity05::d_doel");
  await expect(node(page, "u1").locator(".dc-gedrag-badge")).toBeVisible();
  const data = await page.evaluate(async () => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    return reg.getProfieltype("usecase05").useStore.getState().elements.u1.data.verwijstNaar;
  });
  expect(data).toEqual({ profielId: "activity05", diagramId: "d_doel" });

  // Dubbelklik op de vorm (niet op de naam) opent het AD in een tab.
  await node(page, "u1").dblclick({ position: { x: 80, y: 40 } });
  await expect.poll(() => inModelleren(page, "return ms.getState().actieveTab;")).toBe("activity05::d_doel");

  // In het doeldiagram, zonder selectie: "Verwezen door" noemt de use case (Mark, 20-10).
  await expect(page.getByTestId("verwezen-door")).toContainText("Leen boek");
  // Klik: terug naar het diagram van de use case, mét het element geselecteerd (Mark, 22-10).
  await page.getByTestId("verwezen-door").getByRole("button", { name: /Leen boek/ }).click();
  await expect.poll(() => inModelleren(page, "return ms.getState().actieveTab;")).toBe("usecase05::d_bron");
  await expect(node(page, "u1")).toHaveClass(/selected/);

  // Dubbelklik op de náám opent ook (Mark, 20-10: niet hernoemen).
  await inModelleren(page, 'ms.getState().openTab("usecase05", "d_bron");');
  await node(page, "u1").locator(".dc-naam, [data-dc-naam]").first().dblclick();
  await expect.poll(() => inModelleren(page, "return ms.getState().actieveTab;")).toBe("activity05::d_doel");
  await expect(page.locator(".dc-naam-editor")).toHaveCount(0);

  // Terug, en via het contextmenu.
  await inModelleren(page, 'ms.getState().openTab("usecase05", "d_bron");');
  await node(page, "u1").click({ button: "right", position: { x: 20, y: 10 } });
  await page.locator(".dc-contextmenu-item", { hasText: "Open Uitlenen (AD)" }).click();
  await expect.poll(() => inModelleren(page, "return ms.getState().actieveTab;")).toBe("activity05::d_doel");
});

// Diagramverwijzing (superprofiel, 20-10; Archi's view reference): een object dat naar een ander
// diagram wijst. Een gewoon modelelement (Mark, 20-10: simpel): in de boom, blijft als je hem van
// het diagram haalt.
test("diagramverwijzing: kiezen bij plaatsen, naam live, in de boom, dubbelklik opent, doel weg = doorgestreept", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "activity05", diagramId: "d_doel", diagramNaam: "Uitlenen (AD)", open: false, elementen: [
    { id: "b1", type: "begin", pos: { x: 100, y: 460 } },
  ] });
  await zetModel(page, { profielId: "usecase05", diagramId: "d_bron", diagramNaam: "Bibliotheek", elementen: [
    { id: "u1", naam: "Leen boek", type: "usecase", pos: { x: 300, y: 460 } },
  ] });
  // De Maken-balk: knop met het kort-glyph (de titel staat in een eigen tooltip).
  await page.getByRole("button", { name: "⧉", exact: true }).first().click();
  const dialoog = page.locator(".studio-dialoog");
  await expect(dialoog).toContainText("Naar welk diagram");
  await dialoog.locator("select").selectOption("activity05::d_doel");
  await dialoog.getByRole("button", { name: "Plaatsen" }).click();

  const verw = page.getByTestId("diagramverwijzing");
  await expect(verw).toContainText("Uitlenen (AD)");
  const id = await inStore(page, "usecase05", 'return Object.values(store.getState().elements).find((e) => e.elementType === "diagramverwijzing")?.id;');
  expect(id).toBeTruthy();

  // Naam live: het doel hernoemen werkt door op de plaat.
  await inStore(page, "activity05", 'store.getState().renameDiagram("d_doel", "Uitlenen");');
  await expect(verw).toContainText("Uitlenen");
  await expect(verw).not.toContainText("(AD)");

  // Een gewoon modelelement: de boomregel zet hem in de map van het diagram, en de boom noemt
  // hem naar zijn doel (Mark, 21-10: "ik zie niets in de boom" — het was "(sp_…)").
  await inModelleren(page, 'const m = ms.getState().nieuweMap("Map A"); ms.getState().plaatsDiagram("usecase05::d_bron", m);');
  await expect.poll(() => inModelleren(page, "return ms.getState().plaatsing['el::usecase05::' + arg] || null;", id)).not.toBeNull();
  const mapKop = page.locator("[data-boomsleutel^='map:']").first();
  if ((await mapKop.innerText()).includes("▸")) await mapKop.click();
  await expect(page.locator(`[data-boomsleutel="el:el::usecase05::${id}"]`)).toContainText("⧉ Uitlenen");

  // Dubbelklik opent het doel; daar noemt "Verwezen door" de verwijzing.
  await verw.dblclick();
  await expect.poll(() => inModelleren(page, "return ms.getState().actieveTab;")).toBe("activity05::d_doel");
  await expect(page.getByTestId("verwezen-door")).toContainText("Bibliotheek");

  // Doel verwijderd: de verwijzing blijft, doorgestreept.
  await inModelleren(page, 'ms.getState().openTab("usecase05", "d_bron");');
  await inStore(page, "activity05", 'store.getState().deleteDiagram("d_doel");');
  await expect(verw.locator(".dc-diagramverwijzing-naam")).toHaveCSS("text-decoration-line", "line-through");

  // Van het diagram halen: blijft in het model (zoals elk element).
  await inStore(page, "usecase05", 'store.getState().removeElementFromDiagram("d_bron", arg);', id);
  expect(await inStore(page, "usecase05", "return !!store.getState().elements[arg];", id)).toBe(true);
});
