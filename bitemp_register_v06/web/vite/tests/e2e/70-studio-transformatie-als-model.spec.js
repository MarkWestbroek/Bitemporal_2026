// Studio — een regelset als model in het profiel Transformatie (TRANS-1, TRANSFORMATIES.md §9.8).
//  1. Transformatie → "Laad de ingebouwde regelsets" zet elke regelset als «transformatie» op een
//     diagram, met zijn regels in volgorde en zijn bron en doel als «taal» of «formaat».
//  2. Een regel wijzigen in het model en aanmelden: de activiteit Transformaties toont en
//     proefdraait de getekende versie (vindplaats: model).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore } from "./helpers/studio.js";

test.use({ viewport: { width: 1700, height: 1000 } });

const PROFIEL = "transformatie05";

async function menu(page, label) {
  await page.locator(".studio-menubar").getByText("Transformatie", { exact: true }).click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
}

test("regelsets als model laden, een regel wijzigen en aanmelden bij de catalogus", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: PROFIEL, diagramId: "leeg", diagramNaam: "Leeg" });
  await menu(page, "Laad de ingebouwde regelsets");

  const stand = await inStore(
    page,
    PROFIEL,
    `const st = store.getState();
     const els = Object.values(st.elements);
     const per = (t) => els.filter((e) => e.elementType === t);
     const mermaid = per("transformatie").find((e) => e.data.code === "mermaid-flowchart-naar-usecase");
     const van = per("van").find((c) => c.target === mermaid.id);
     const naar = per("naar").find((c) => c.source === mermaid.id);
     return {
       transformaties: per("transformatie").length,
       diagram: st.diagrams[st.actiefDiagramId].naam,
       diagramId: st.actiefDiagramId,
       regels: mermaid.compartimenten[0].velden.length,
       id: mermaid.id,
       bron: [st.elements[van.source].elementType, st.elements[van.source].naam],
       doel: [st.elements[naar.target].elementType, st.elements[naar.target].naam],
       talen: per("taal").map((e) => e.naam).sort(),
     };`
  );
  expect(stand).toMatchObject({
    transformaties: 11,
    diagram: "Ingebouwde regelsets",
    regels: 19,
    bron: ["formaat", "mermaid-flowchart"],
    doel: ["taal", "usecase"],
  });
  // Wat het id van een geregistreerd profiel is, is een taal; de rest een formaat.
  expect(stand.talen).toEqual(expect.arrayContaining(["bpmn-motor", "dmn-drd", "usecase"]));

  await page.evaluate(async ({ profielId, diagramId }) => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("studio:open-diagram", { profielId, diagramId });
  }, { profielId: PROFIEL, diagramId: stand.diagramId });
  await expect(page.locator(`.react-flow__node[data-id="${stand.id}"]`)).toContainText("«transformatie»");
  await expect(page.locator(`.react-flow__node[data-id="${stand.id}"]`)).toContainText("Actor (cirkel)");

  // De regel "Actor (cirkel)" maakt voortaan een use case; dat is een wijziging in het model.
  await inStore(
    page,
    PROFIEL,
    `const el = store.getState().elements[arg];
     const compartimenten = el.compartimenten.map((c) =>
       c.compartmentType !== "regels" ? c : { ...c, velden: c.velden.map((v) => (v.naam === "Actor (cirkel)" ? { ...v, data: { ...v.data, dan: JSON.stringify({ ...JSON.parse(v.data.dan), type: "usecase" }) } } : v)) }
     );
     store.setState({ elements: { ...store.getState().elements, [arg]: { ...el, compartimenten } } });`,
    stand.id
  );
  await menu(page, "Meld de transformaties van dit diagram aan");
  await expect(page.getByText("11 transformatie(s) aangemeld")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "OK" }).click();

  await page.locator(".studio-activitybar [title^='Transformaties']").first().click();
  await page.locator('[data-regelset="mermaid-flowchart-naar-usecase"]').first().click();
  const main = page.getByTestId("regelset");
  await expect(main).toContainText("vindplaats: model");
  await expect(main).toContainText("van mermaid-flowchart naar usecase");
  await expect(main.getByTestId("regelset-geldig")).toContainText("19 regels");
  await expect(main.getByTestId("regels-tabel").locator("tbody tr").nth(3)).toContainText("maak usecase");
  // De proefbron van de ingebouwde regelset is meegekomen.
  await main.getByTestId("proef").getByTestId("proef-draai").click();
  await expect(main.getByTestId("proef").locator('tr[data-regel="Actor (cirkel)"]').getByTestId("treffers")).toHaveText("1");
});
