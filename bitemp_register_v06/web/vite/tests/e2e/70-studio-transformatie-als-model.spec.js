// Studio — een transformatie als modelelement (TRANS-1, TRANSFORMATIES.md §9.8, 18-11).
//  1. Ontwerp → "Bekijk de transformaties als ontwerp" zet elke regelset als «transformatie»
//     op een diagram, met zijn regels in volgorde.
//  2. Een regel wijzigen in het model en aanmelden: de activiteit Transformaties toont en
//     proefdraait de getekende versie (vindplaats: ontwerp).
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1700, height: 1000 } });

async function menu(page, label) {
  await page.locator(".studio-menubar").getByText("Ontwerp", { exact: true }).click();
  await page.getByText(label, { exact: true }).click();
}

test("transformaties als ontwerp, een regel wijzigen en aanmelden bij de catalogus", async ({ page }) => {
  await openStudio(page);
  await page.locator(".studio-activitybar [title^='Profiel-ontwerp']").first().click();
  await page.waitForFunction(() => !!window.__profielOntwerpStore);
  await menu(page, "Bekijk de transformaties als ontwerp");

  const stand = await page.evaluate(() => {
    const st = window.__profielOntwerpStore.getState();
    const els = Object.values(st.elements).filter((e) => e.elementType === "transformatieDef");
    const mermaid = els.find((e) => e.data.code === "mermaid-flowchart-naar-usecase");
    return {
      aantal: els.length,
      opDiagram: st.diagrams[st.actiefDiagramId].nodes.length,
      diagram: st.diagrams[st.actiefDiagramId].naam,
      regels: mermaid.compartimenten[0].velden.length,
      id: mermaid.id,
    };
  });
  expect(stand).toMatchObject({ aantal: 11, opDiagram: 11, diagram: "Transformaties", regels: 19 });
  await expect(page.locator(`.react-flow__node[data-id="${stand.id}"]`)).toContainText("«transformatie»");
  await expect(page.locator(`.react-flow__node[data-id="${stand.id}"]`)).toContainText("Actor (cirkel)");

  // De regel "Actor (cirkel)" maakt voortaan een use case; dat is een wijziging in het model.
  await page.evaluate((id) => {
    const store = window.__profielOntwerpStore;
    const el = store.getState().elements[id];
    const compartimenten = el.compartimenten.map((c) =>
      c.compartmentType !== "regels" ? c : { ...c, velden: c.velden.map((v) => (v.naam === "Actor (cirkel)" ? { ...v, data: { ...v.data, dan: JSON.stringify({ ...JSON.parse(v.data.dan), type: "usecase" }) } } : v)) }
    );
    store.setState({ elements: { ...store.getState().elements, [id]: { ...el, compartimenten } } });
  }, stand.id);
  await menu(page, "Meld de transformaties van dit diagram aan");
  await expect(page.getByText("11 transformatie(s) aangemeld")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "OK" }).click();

  await page.locator(".studio-activitybar [title^='Transformaties']").first().click();
  await page.locator('[data-regelset="mermaid-flowchart-naar-usecase"]').first().click();
  const main = page.getByTestId("regelset");
  await expect(main).toContainText("vindplaats: ontwerp");
  await expect(main.getByTestId("regelset-geldig")).toContainText("19 regels");
  await expect(main.getByTestId("regels-tabel").locator("tbody tr").nth(3)).toContainText("maak usecase");
  // De proefbron van de ingebouwde regelset is meegekomen.
  await main.getByTestId("proef").getByTestId("proef-draai").click();
  await expect(main.getByTestId("proef").locator('tr[data-regel="Actor (cirkel)"]').getByTestId("treffers")).toHaveText("1");
});
