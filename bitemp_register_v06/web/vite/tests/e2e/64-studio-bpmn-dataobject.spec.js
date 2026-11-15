// Studio — het BPMN-data-object met een type (15-11, Mark; ontwerp Simulatie §11.8): het type wijst
// naar een element met M3-aard "gegevens" in een andere taal (hier een cm-entiteit); rol invoer
// geeft het open pijltje (Data Input); de toestand staat onder de naam als "[ingediend]";
// (lezen en schrijven op de data-associatie: unit-test in bpmn/vormen.test.js).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, node, wachtOpNode, inStore } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("data-object: type uit het cm kiezen, rol invoer, toestand onder de naam", async ({ page }) => {
  await openStudio(page);
  // Gegevens: een cm-entiteit en een UML-klasse (twee talen met aard "gegevens"); een
  // gegevenselement telt niet mee.
  await zetModel(page, { profielId: "diagram05", diagramId: "d_cm", diagramNaam: "Aanvragen", open: false, elementen: [
    { id: "e_aanvraag", naam: "Aanvraag", type: "entiteit", pos: { x: 100, y: 100 } },
    { id: "e_partij", naam: "Partij", type: "entiteit", pos: { x: 400, y: 100 } },
    { id: "r_aanvrager", naam: "aanvrager", type: "relatie", source: "e_aanvraag", target: "e_partij" },
  ] });
  await zetModel(page, { profielId: "puurUml05", diagramId: "d_uml", diagramNaam: "Klassen", open: false, elementen: [
    { id: "k_besluit", naam: "Besluit", type: "klasse", pos: { x: 100, y: 100 } },
  ] });
  await zetModel(page, { profielId: "bpmnMotor05", diagramId: "d_proces", diagramNaam: "Oppakken", elementen: [
    { id: "t1", naam: "Toets", type: "taak", pos: { x: 300, y: 600 } },
    { id: "do1", naam: "Aanvraag", type: "data-object", pos: { x: 320, y: 420 } },
    { id: "a1", type: "data-associatie", source: "do1", target: "t1" },
  ] });
  await wachtOpNode(page, "do1");
  await node(page, "do1").click({ position: { x: 24, y: 14 } });

  const kiezer = page.getByTestId("element-verwijzing-type");
  await expect(kiezer).toBeVisible();
  // Eerst de taal: alleen talen met een element met aard "gegevens" (hier cm en UML; BPMN niet).
  const taal = kiezer.locator('select[title="profiel"]');
  const talen = await taal.locator("option").evaluateAll((os) => os.map((o) => o.value));
  expect(talen).toEqual(expect.arrayContaining(["diagram05", "puurUml05"]));
  expect(talen).not.toContain("bpmnMotor05");
  await taal.selectOption("diagram05");
  await kiezer.locator("select").nth(1).selectOption("e_aanvraag");
  const data = () =>
    page.evaluate(async () => {
      const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
      return reg.getProfieltype("bpmnMotor05").useStore.getState().elements;
    });
  expect((await data()).do1.data.type).toEqual({ profielId: "diagram05", elementId: "e_aanvraag" });

  // Rol invoer (Data Input) en de toestand.
  const rij = (label) => page.locator(".dc-inspector, .studio-inspector, body").getByTitle(label).first();
  await rij("rol in het proces").selectOption("invoer");
  await expect(node(page, "do1").locator('[data-dc-rol="invoer"]')).toHaveCount(1);
  const toestand = page.getByPlaceholder("bv. ingediend");
  await toestand.fill("ingediend");
  await expect(node(page, "do1")).toContainText("[ingediend]");
  expect((await data()).do1.data.rol).toBe("invoer");

  // Het type is ook de tracering (15-11): Gerelateerde elementen biedt de cm-Aanvraag aan; op het
  // diagram komt hij als verwijzing, met de afgeleide lijn «traceert naar».
  await node(page, "do1").click({ button: "right", position: { x: 24, y: 14 } });
  await page.locator(".dc-contextmenu-item", { hasText: "Gerelateerde elementen toevoegen" }).click();
  const dialoog = page.locator(".studio-dialoog");
  await expect(dialoog).toContainText("Aanvraag (Entiteit");
  await expect(dialoog).toContainText("«traceert naar»");
  await dialoog.getByRole("button", { name: "Toevoegen" }).click();
  await expect(node(page, "diagram05::e_aanvraag")).toBeVisible();
  const lijn = page.locator('.react-flow__edge[data-id="conn:koppeling:afgeleid:bpmnMotor05:do1:type"]');
  await expect(lijn).toHaveCount(1);
  // Het label staat in de label-laag van React Flow, niet in de edge zelf.
  await expect(page.locator(".react-flow").getByText("«traceert naar»")).toBeVisible();
  // Afgeleid uit het type: niet als element bewaard; de inspector van de lijn zegt dat.
  await page.locator(".react-flow").getByText("«traceert naar»").click();
  await expect(page.getByTestId("koppeling-afgeleid")).toBeVisible();
  expect(await inStore(page, "bpmnMotor05", 'return Object.keys(store.getState().elements).filter((k) => k.startsWith("koppeling:")).length;')).toBe(0);

  // Vanaf het cm-element verder in het cm (Mark 15-11): de titel noemt de naam, Partij komt erbij.
  // (De ring rond het data-object zet hem onder de werkbalken; eerst opzij.)
  await inStore(page, "bpmnMotor05", 'store.getState().updateNodePosition("d_proces", "diagram05::e_aanvraag", { x: 600, y: 420 });');
  await node(page, "diagram05::e_aanvraag").click({ button: "right", position: { x: 20, y: 12 } });
  await page.locator(".dc-contextmenu-item", { hasText: "Gerelateerde elementen toevoegen" }).click();
  await expect(dialoog).toContainText("Gerelateerde elementen van Aanvraag");
  await expect(dialoog).toContainText("Partij (Entiteit");
  await dialoog.getByRole("button", { name: "Toevoegen" }).click();
  await expect(node(page, "diagram05::e_partij")).toBeVisible();

  // Autoklik: zonder eigen "verwijst naar" opent een dubbelklik op het data-object het cm-diagram
  // waarop zijn type staat.
  await node(page, "do1").dblclick({ position: { x: 24, y: 14 } });
  await expect.poll(() => inStore(page, "diagram05", "return store.getState().actiefDiagramId;")).toBe("d_cm");
});
