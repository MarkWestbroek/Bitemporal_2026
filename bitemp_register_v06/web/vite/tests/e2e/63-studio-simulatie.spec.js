// Studio — simulatie van BPMN en DMN met cm-objecten (fase 2, 13-11): het
// onder-dock van de BPMN-activiteit. GPK-voorbeeld laden, starten, het token
// op het diagram, een gat met de hand vullen en doorlopen tot het einde.
// Ontwerp: docs/plans/2026-11-12 Simulatie van BPMN en DMN met cm-objecten.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, node, wachtOpNode } from "./helpers/studio.js";

test.use({ viewport: { width: 1600, height: 1000 } });

const SCHERM = process.env.SIMULATIE_SCHERMAFBEELDINGEN || null;
const foto = async (page, naam) => {
  if (SCHERM) await page.screenshot({ path: `${SCHERM}/${naam}.png` });
};

test("GPK: token op het diagram, gat met de hand, doorlopen tot Beschikt", async ({ page }) => {
  // De tips (BEGELEIDING) uit: ze schuiven over het paneel.
  await page.addInitScript(() => localStorage.setItem("studio05-hints-gezien", JSON.stringify({ gezien: {}, uit: true })));
  await openStudio(page);
  await zetModel(page, { profielId: "bpmnMotor05", diagramId: "leeg", elementen: [{ id: "t", naam: "Taak", type: "taak", pos: { x: 200, y: 200 } }] });
  await wachtOpNode(page, "t");
  const paneel = page.getByTestId("sim-paneel");
  await expect(paneel).toBeVisible();
  await expect(page.getByTestId("sim-start")).toBeDisabled();

  // Het voorbeeld: drie processen, beslistabel, e-dienstmodel en scenario 4.
  await page.getByTestId("sim-laad-gpk").click();
  await wachtOpNode(page, "bp_ontvankelijkheid_toetsen");
  const scenario = page.getByTestId("sim-scenario");
  await expect(scenario).toHaveValue(/GPK 4: toegekend/);
  // De beoordeling met de hand; de rest uit de fixture.
  const sc = JSON.parse(await scenario.inputValue());
  sc.vulwijze.perGat = { "aanvraag-beoordelen": "hand" };
  await scenario.fill(JSON.stringify(sc, null, 2));

  await page.getByTestId("sim-start").click();
  await expect(page.getByTestId("sim-stand")).toHaveText(/Loopt/);
  // Het token staat op het startevent: een rand in de kleur van "kan verder".
  await expect(node(page, "bp_start")).toHaveCSS("outline-color", "rgb(99, 102, 241)");
  await foto(page, "1-gestart");

  await page.getByTestId("sim-stap").click();
  await page.getByTestId("sim-stap").click();
  await expect(page.getByTestId("sim-log")).toContainText("Ontvankelijkheid toetsen");
  await expect(page.getByTestId("sim-log")).toContainText("regel r_ok");
  await expect(node(page, "bp_start")).toHaveCSS("outline-color", "rgba(34, 211, 238, 0.55)"); // bezocht
  await foto(page, "2-na-beslistabel");

  // Doorlopen: stopt bij het gat; het diagram volgt het token naar het beoordelingsproces.
  await page.getByTestId("sim-loop").click();
  await expect(page.getByTestId("sim-stand")).toHaveText(/Wacht op invoer: Aanvraag beoordelen/);
  await wachtOpNode(page, "bp_aanvraag_beoordelen");
  await expect(node(page, "bp_aanvraag_beoordelen")).toHaveCSS("outline-color", "rgb(245, 158, 11)");
  const gat = page.getByTestId("sim-gat");
  await expect(gat).toContainText("formulier aanvraag-beoordelen");
  await foto(page, "3-gat-aanvraag-beoordelen");

  // Een verplicht veld leeg laten wordt geweigerd; daarna invullen.
  await page.getByTestId("sim-vul").click();
  await expect(gat).toContainText("verplicht");
  await page.getByTestId("sim-veld-beoordeling").selectOption("toegekend");
  await page.getByTestId("sim-veld-beoordelingToelichting").fill("Advies positief.");
  await page.getByTestId("sim-vul").click();
  await page.getByTestId("sim-loop").click();
  await expect(page.getByTestId("sim-stand")).toHaveText(/Klaar\..*aanvraag-behandelen: Beschikt/);
  await expect(page.getByTestId("sim-objecten")).toContainText("zaakAanmaken");
  await expect(page.getByTestId("sim-objecten")).toContainText('"beoordeling": "toegekend"');
  await foto(page, "4-klaar");

  // Terugspoelen: klik op de regel van de beslistabel; het token staat weer vóór de gateway.
  await page.getByTestId("sim-log").getByText("Ontvankelijkheid toetsen", { exact: true }).click();
  await expect(page.getByTestId("sim-stand")).toHaveText(/Loopt/);
  await wachtOpNode(page, "bp_ontvankelijk");
  await expect(node(page, "bp_ontvankelijk")).toHaveCSS("outline-color", "rgb(99, 102, 241)");
  await foto(page, "5-teruggespoeld");

  // Stop: het token gaat van het diagram.
  await page.getByTestId("sim-stop").click();
  await expect(page.getByTestId("sim-token-stijl")).toHaveCount(0);
});
