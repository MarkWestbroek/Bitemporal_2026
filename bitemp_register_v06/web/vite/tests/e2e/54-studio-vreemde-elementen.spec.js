// Studio — Mark, 07-11: een element uit een andere taal op een diagram droppen. Het staat er als
// verwijzing (`<taal>::<id>`, diagramcore/model/vreemd.js), in de notatie van zijn eigen taal; de
// relaties van die taal tussen elementen die er staan, komen vanzelf mee.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, inStore, inModelleren, node, wachtOpNode } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

/** Drop zoals uit de projectboom: ELEMENT_REF_MIME op het canvasvlak. */
async function dropRef(page, ref, x = 700, y = 480) {
  await page.evaluate(([ref, x, y]) => {
    const dt = new DataTransfer();
    dt.setData("application/studio05-element-ref", JSON.stringify(ref));
    dt.effectAllowed = "copyMove";
    const pane = document.querySelector(".react-flow__pane");
    for (const soort of ["dragover", "drop"]) pane.dispatchEvent(new DragEvent(soort, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
  }, [ref, x, y]);
}

test("ArchiMate-elementen op een canoniek diagram: verwijzing, eigen notatie, relatie mee, inspector van de eigen taal", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "archimate05", diagramId: null, open: false, elementen: [
    { id: "studio", naam: "Omnium Studio", type: "app-component" },
    { id: "ea", naam: "EA-lezer", type: "app-component" },
    { id: "r_comp", type: "compositie", source: "studio", target: "ea" },
  ] });
  await zetModel(page, { profielId: "diagram05", diagramId: "d_mix", diagramNaam: "Gemengd", elementen: [
    { id: "np", naam: "NatuurlijkPersoon", type: "entiteit", pos: { x: 120, y: 160 } },
  ] });
  await wachtOpNode(page, "np");

  await dropRef(page, { profielId: "archimate05", elementId: "studio", elementIds: ["studio", "ea"] });
  const opDiagram = () => inStore(page, "diagram05", "return store.getState().diagrams.d_mix.nodes.map((n) => n.elementId).sort();");
  await expect.poll(opDiagram).toEqual(["archimate05::ea", "archimate05::studio", "np"]);

  // Getekend, met de taal als badge; de compositie tussen beide staat er vanzelf.
  await expect(node(page, "archimate05::studio")).toContainText("Omnium Studio");
  await expect(node(page, "archimate05::studio").getByTestId("node-vreemd")).toHaveText(/ArchiMate/);
  await expect(page.locator('.react-flow__edge[data-id="conn:archimate05::r_comp"]')).toHaveCount(1);
  // Het element zelf bleef in zijn eigen taal: geen kopie in canoniek.
  expect(await inStore(page, "diagram05", "return Object.keys(store.getState().elements).sort();")).toEqual(["np"]);

  // Nog eens droppen: niet dubbel.
  await dropRef(page, { profielId: "archimate05", elementId: "ea" });
  await expect.poll(opDiagram).toEqual(["archimate05::ea", "archimate05::studio", "np"]);

  // Selecteren toont het element in de inspector van ArchiMate.
  await node(page, "archimate05::ea").click({ position: { x: 30, y: 30 } });
  await expect(page.locator(".dc-inspector h3")).toHaveText("EA-lezer");

  // Een wijziging in de eigen taal is meteen op dit diagram te zien.
  await inStore(page, "archimate05", 'store.getState().updateElement("ea", { naam: "EA-lezer 2" });');
  await expect(node(page, "archimate05::ea")).toContainText("EA-lezer 2");

  // Rechtsklik op een vreemd element geeft een menu, geen fout.
  const fouten = [];
  page.on("pageerror", (e) => fouten.push(e.message));
  await node(page, "archimate05::ea").click({ button: "right", position: { x: 30, y: 30 } });
  await expect(page.locator(".dc-contextmenu")).toBeVisible();
  await page.keyboard.press("Escape");
  expect(fouten).toEqual([]);

  // In de inspector: "Verwijder uit model" uitgegrijsd; "Van diagram halen" haalt de verwijzing
  // van dít diagram (Mark, 07-11).
  await node(page, "archimate05::studio").click({ position: { x: 30, y: 30 } });
  await expect(page.locator(".dc-inspector h3")).toHaveText("Omnium Studio");
  await expect(page.getByTestId("inspector-verwijzing")).toBeVisible();
  await expect(page.getByTestId("inspector-verwijder-uit-model")).toBeDisabled();
  await page.getByRole("button", { name: "Van diagram halen" }).click();
  await expect.poll(opDiagram).toEqual(["archimate05::ea", "np"]);
  expect(await inStore(page, "archimate05", 'return !!store.getState().elements.studio;')).toBe(true);
  await page.keyboard.press("Control+z");
  await expect.poll(opDiagram).toEqual(["archimate05::ea", "archimate05::studio", "np"]);

  // Delete haalt de verwijzing van het diagram; het element blijft in ArchiMate.
  await node(page, "archimate05::ea").click({ position: { x: 30, y: 30 } });
  await page.keyboard.press("Delete");
  await expect.poll(opDiagram).toEqual(["archimate05::studio", "np"]);
  expect(await inStore(page, "archimate05", 'return !!store.getState().elements.ea;')).toBe(true);
  await expect(page.locator('.react-flow__edge[data-id="conn:archimate05::r_comp"]')).toHaveCount(0);
});

// Mark, 07-11: "Toon gebruik in de projectboom toont geen gebruik op vreemde talen."
test("gebruik telt ook diagrammen van andere talen: Toon gebruik in de boom en Gebruikt op in de inspector", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "archimate05", diagramId: "d_archi", diagramNaam: "Applicaties", elementen: [
    { id: "studio", naam: "Omnium Studio", type: "app-component", pos: { x: 120, y: 480 } },
    { id: "los", naam: "Los", type: "app-component" },
  ] });
  await zetModel(page, { profielId: "diagram05", diagramId: "d_mix", diagramNaam: "Gemengd", elementen: [
    { id: "np", naam: "NatuurlijkPersoon", type: "entiteit", pos: { x: 120, y: 480 } },
  ] });
  await wachtOpNode(page, "np");
  await dropRef(page, { profielId: "archimate05", elementId: "studio" });
  await dropRef(page, { profielId: "archimate05", elementId: "los" }, 900, 480);
  await wachtOpNode(page, "archimate05::studio");

  // Boom: rechtsklik → Toon gebruik (2), met de taal achter het canonieke diagram.
  await inModelleren(page, 'const m = ms.getState().nieuweMap("ArchiMate"); ms.getState().plaatsMeerdere(["el::archimate05::studio", "el::archimate05::los"], m);');
  const menu = page.locator(".studio-ctxmenu");
  await page.getByTestId("boom-el-studio").locator("button.studio-project__element").click({ button: "right" });
  await menu.getByRole("button", { name: /^Toon gebruik \(2\)( ▸)?$/ }).click();
  await expect(menu.getByRole("button", { name: "Applicaties" })).toBeVisible();
  await expect(menu.getByRole("button", { name: /^Gemengd — / })).toBeVisible();
  await page.keyboard.press("Escape");
  // "Los" staat alleen als verwijzing: geen ◌ (staat op geen diagram).
  await expect(page.getByTestId("boom-el-los").getByTestId("geen-diagram")).toHaveCount(0);

  // Inspector: Gebruikt op (2), het open diagram gemarkeerd.
  await node(page, "archimate05::studio").click({ position: { x: 30, y: 30 } });
  const paneel = page.getByTestId("gebruik-paneel");
  await expect(paneel).toContainText("Gebruikt op (2)");
  await expect(paneel.locator(".dc-gebruik-diagram.is-actief")).toContainText("Gemengd");
});
