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

// Mark, 07-11 — stap 2: koppelingen (kruisverbanden) als lijnen; een lijn tussen twee talen biedt
// de koppelsoorten aan en komt in de matrix.
/** Klik op een lijn (midden van zijn kader, zoals 11-studio-relaties). */
async function klikLijn(page, lijn) {
  const b = await lijn.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const kruis = (page, body) => page.evaluate(async (body) => {
  const { useKruisStore } = await import(location.origin + "/viz/react/src/studio/activities/koppelingenActivity.jsx");
  return new Function("k", body)(useKruisStore);
}, body);

test("koppeling als lijn: uit de matrix getekend, nieuwe trekken tussen twee talen, verbergen en verwijderen", async ({ page }) => {
  await openStudio(page);
  await kruis(page, 'k.getState().laadLinks([], null);');
  await zetModel(page, { profielId: "archimate05", diagramId: null, open: false, elementen: [
    { id: "studio", naam: "Omnium Studio", type: "app-component" },
    { id: "ea", naam: "EA-lezer", type: "app-component" },
  ] });
  await zetModel(page, { profielId: "diagram05", diagramId: "d_k", diagramNaam: "Koppel", elementen: [
    { id: "np", naam: "NatuurlijkPersoon", type: "entiteit", pos: { x: 200, y: 450 } },
    { id: "loc", naam: "Locatie", type: "entiteit", pos: { x: 200, y: 700 } },
  ] });
  await wachtOpNode(page, "np");
  await dropRef(page, { profielId: "archimate05", elementId: "studio" }, 800, 480);
  await dropRef(page, { profielId: "archimate05", elementId: "ea" }, 800, 730);
  await wachtOpNode(page, "archimate05::ea");

  // Een koppeling uit de matrix staat meteen als lijn op het diagram.
  await kruis(page, 'k.getState().legLink({ profielId: "diagram05", elementId: "np" }, { profielId: "archimate05", elementId: "studio" }, "realiseert");');
  const lijn1 = page.locator('.react-flow__edge[data-id="conn:koppeling:diagram05::np##archimate05::studio"]');
  await expect(lijn1).toHaveCount(1);

  // Een lijn trekken van Locatie naar EA-lezer: het canvas biedt de koppelsoorten aan.
  const lb = await node(page, "loc").boundingBox();
  await page.mouse.click(lb.x + 30, lb.y + lb.height / 2);
  const h = await node(page, "loc").locator('.react-flow__handle[data-handleid="source-right"]').boundingBox();
  const eb = await node(page, "archimate05::ea").boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.locator(".dc-contextmenu-item", { hasText: "komt voort uit" }).click();
  await expect.poll(() => kruis(page, 'return k.getState().links.map((l) => l.id + "|" + l.soort).sort();')).toEqual([
    "diagram05::loc##archimate05::ea|komt voort uit",
    "diagram05::np##archimate05::studio|realiseert",
  ]);
  const lijn2 = page.locator('.react-flow__edge[data-id="conn:koppeling:diagram05::loc##archimate05::ea"]');
  await expect(lijn2).toHaveCount(1);
  // Geen element in de eigen taal erbij.
  expect(await inStore(page, "diagram05", 'return Object.values(store.getState().elements).filter((e) => e.source).length;')).toBe(0);

  // Selecteren: de koppeling-inspector; soort wijzigen.
  await klikLijn(page, lijn1);
  await expect(page.getByTestId("koppeling-inspector")).toBeVisible();
  await expect(page.getByTestId("koppeling-uiteinden")).toContainText("NatuurlijkPersoon");
  await expect(page.getByTestId("koppeling-uiteinden")).toContainText("Omnium Studio");
  // Een vrije soort (Mark, 07-11): getekend als dependency met de soort als stereotype.
  await page.getByTestId("koppeling-soort").fill("gebruikt");
  await page.getByTestId("koppeling-soort").press("Enter");
  await expect.poll(() => kruis(page, 'return k.getState().links.find((l) => l.id === "diagram05::np##archimate05::studio").soort;')).toBe("gebruikt");
  await expect(lijn1).toHaveCount(1);
  await expect(page.locator(".react-flow").first()).toContainText("«gebruikt»");
  // … en komt in de soortenlijst van het project.
  expect(await kruis(page, 'return k.getState().soorten.map((t) => t.soort).includes("gebruikt");')).toBe(true);

  // Van diagram halen: verborgen op dit diagram, de koppeling blijft.
  await page.getByTestId("koppeling-inspector").getByRole("button", { name: "Van diagram halen" }).click();
  await expect(lijn1).toHaveCount(0);
  expect(await kruis(page, 'return k.getState().links.length;')).toBe(2);
  // Opnieuw trekken toont hem weer (zelfde koppeling).
  await inStore(page, "diagram05", 'store.getState().toonConnectorOpDiagram("d_k", "koppeling:diagram05::np##archimate05::studio");');
  await expect(lijn1).toHaveCount(1);

  // Verwijderen: weg uit de koppelingen-store (en dus de matrix).
  await klikLijn(page, lijn2);
  await page.getByTestId("koppeling-inspector").getByRole("button", { name: "Verwijder koppeling" }).click();
  await page.locator("button", { hasText: /^Verwijder$/ }).first().click();
  await expect.poll(() => kruis(page, 'return k.getState().links.map((l) => l.id);')).toEqual(["diagram05::np##archimate05::studio"]);
  await expect(lijn2).toHaveCount(0);
});

// Mark, 07-11: "de stereotypen die je aangemaakt hebt ook in de lijst … dan moet je die lijst wel
// kunnen bewerken". De soortenlijst van het project in de zijbalk van Koppelingen.
test("soortenlijst van het project: eigen soort erbij, hernoemen raakt de koppelingen, in gebruik niet weg", async ({ page }) => {
  await openStudio(page);
  await kruis(page, `k.getState().laadLinks([
    { id: "diagram05::np##archimate05::studio", rij: { profielId: "diagram05", elementId: "np" }, kolom: { profielId: "archimate05", elementId: "studio" }, soort: "triggert", omgekeerd: false },
  ], null);`);
  await page.evaluate(async () => {
    const { default: s } = await import(location.origin + "/viz/react/src/studio/useStudioStore.js");
    s.getState().setActief("koppelingen");
  });
  const lijst = page.getByTestId("koppelsoorten");
  await expect(lijst).toBeVisible();
  // Een soort uit een koppeling staat in de lijst (met het aantal), en is niet te verwijderen.
  const triggert = lijst.locator('[data-soort="triggert"]');
  await expect(triggert).toContainText("(1)");
  await expect(triggert.getByTestId("koppelsoort-verwijder")).toBeDisabled();

  // Nieuwe soort.
  await page.getByTestId("koppelsoort-nieuw").click();
  await page.locator(".studio-dialoog input").first().fill("verandert");
  await page.keyboard.press("Enter");
  await expect(lijst.locator('[data-soort="verandert"]')).toHaveCount(1);
  // En in de linkerklik-keuze van de matrix.
  await expect(page.locator("select option", { hasText: "verandert" }).first()).toHaveCount(1);

  // Hernoemen: ook de koppeling krijgt de nieuwe naam.
  await triggert.getByRole("button", { name: "✎" }).click();
  await page.locator(".studio-dialoog input").first().fill("start");
  await page.keyboard.press("Enter");
  await expect.poll(() => kruis(page, 'return k.getState().links[0].soort;')).toBe("start");
  await expect(lijst.locator('[data-soort="triggert"]')).toHaveCount(0);

  // Ongebruikt: weg uit de lijst.
  await lijst.locator('[data-soort="verfijnt"]').getByTestId("koppelsoort-verwijder").click();
  await expect(lijst.locator('[data-soort="verfijnt"]')).toHaveCount(0);
  // De lijst reist mee in de projectsync: één zetSoorten-operatie per wijziging (kruisNet).
  expect(await kruis(page, 'return k.getState().soorten.map((t) => t.soort).filter((s) => ["start", "verandert", "verfijnt"].includes(s)).sort();')).toEqual(["start", "verandert"]);
});

// Mark, 07-11: "waarom slepen de elementen op het kruisverbanden-diagram zo traag?" — de knoop moet
// tijdens het slepen de muis volgen (niet pas bij loslaten verspringen).
test("grafische kruisverbanden: een knoop volgt de muis tijdens het slepen", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "archimate05", diagramId: null, open: false, elementen: [{ id: "studio", naam: "Omnium Studio", type: "app-component" }] });
  await zetModel(page, { profielId: "diagram05", diagramId: null, open: false, elementen: [{ id: "np", naam: "NatuurlijkPersoon", type: "entiteit" }] });
  await kruis(page, `k.getState().laadLinks([
    { id: "diagram05::np##archimate05::studio", rij: { profielId: "diagram05", elementId: "np" }, kolom: { profielId: "archimate05", elementId: "studio" }, soort: "realiseert", omgekeerd: false },
  ], null); k.getState().zetWeergave("grafisch");`);
  await page.evaluate(async () => {
    const { default: s } = await import(location.origin + "/viz/react/src/studio/useStudioStore.js");
    s.getState().setActief("koppelingen");
  });
  const knoop = page.locator('.react-flow__node[data-id="diagram05::np"]');
  await expect(knoop).toBeVisible();
  const b = await knoop.boundingBox();
  await page.mouse.move(b.x + 20, b.y + 10);
  await page.mouse.down();
  await page.mouse.move(b.x + 80, b.y + 90, { steps: 8 });
  const tijdens = await knoop.boundingBox();
  expect(tijdens.y - b.y).toBeGreaterThan(40);
  await page.mouse.up();
  await expect.poll(() => kruis(page, 'return Math.round(k.getState().posities["diagram05::np"]?.y ?? -1);')).toBeGreaterThan(0);
});
