// Studio — het BPMN-data-object met een type (15-11, Mark; ontwerp Simulatie §11.8): het type wijst
// naar een element met M3-aard "gegevens" in een andere taal (hier een cm-entiteit); rol invoer
// geeft het open pijltje (Data Input); de toestand staat onder de naam als "[ingediend]";
// (lezen en schrijven op de data-associatie: unit-test in bpmn/vormen.test.js).
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, node, wachtOpNode } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("data-object: type uit het cm kiezen, rol invoer, toestand onder de naam", async ({ page }) => {
  await openStudio(page);
  // Gegevens: een cm-entiteit en een UML-klasse (twee talen met aard "gegevens"); een
  // gegevenselement telt niet mee.
  await zetModel(page, { profielId: "diagram05", diagramId: "d_cm", diagramNaam: "Aanvragen", open: false, elementen: [
    { id: "e_aanvraag", naam: "Aanvraag", type: "entiteit", pos: { x: 100, y: 100 } },
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
});
