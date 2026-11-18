// Studio — Transformaties: regelsets bekijken en proefdraaien (TRANS-1 stap 1, 18-11).
//  1. De lijst toont de ingebouwde regelsets; een regelset toont zijn regels in volgorde.
//  2. Proefdraaien op geplakte Mermaid: treffers per regel, items zonder regel, wat er gemaakt wordt.
//  3. Proefdraaien op een map uit het project (use case-model) geeft de Mermaid-tekst.
//  4. Een regelset met instellingen is te bekijken, niet proef te draaien.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel } from "./helpers/studio.js";

test.use({ viewport: { width: 1700, height: 1000 } });

async function open(page) {
  await openStudio(page);
  await page.locator(".studio-activitybar [title^='Transformaties']").first().click();
  await expect(page.getByTestId("regelset-lijst")).toBeVisible();
}

test("de lijst toont de ingebouwde regelsets en een regelset toont zijn regels", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("regelset-lijst").locator("button")).toHaveCount(10);
  await expect(page.locator('[data-richting="import"] button')).toHaveCount(3);
  await expect(page.locator('[data-richting="export"] button')).toHaveCount(2);
  await expect(page.locator('[data-richting="inrichting"] button')).toHaveCount(5);
  await page.locator('[data-regelset="mermaid-flowchart-naar-usecase"]').first().click();
  const main = page.getByTestId("regelset");
  await expect(main).toContainText("Mermaid flowchart → use case-model");
  await expect(main.getByTestId("regelset-geldig")).toContainText("19 regels");
  const tabel = main.getByTestId("regels-tabel");
  await expect(tabel.locator("tbody tr")).toHaveCount(19);
  await expect(tabel.locator("tbody tr").nth(3)).toContainText("Actor (cirkel)");
  await expect(tabel.locator("tbody tr").nth(3)).toContainText("vorm: cirkel of dubbele-cirkel");
  await expect(tabel.locator("tbody tr").nth(3)).toContainText("maak actor");
});

test("proefdraaien op geplakte Mermaid: treffers per regel en items zonder regel", async ({ page }) => {
  await open(page);
  await page.locator('[data-regelset="mermaid-flowchart-naar-usecase"]').first().click();
  const proef = page.getByTestId("proef");
  const tekst = await proef.getByTestId("proef-tekst").inputValue();
  await proef.getByTestId("proef-tekst").fill(`${tekst}  vreemd{Ruit}\n`);
  await proef.getByTestId("proef-draai").click();
  await expect(proef.getByTestId("proef-telling")).toContainText("1 zonder regel");
  await expect(proef.getByTestId("proef-zonder-regel")).toContainText("Ruit");
  const perRegel = proef.getByTestId("proef-per-regel");
  await expect(perRegel.locator('tr[data-regel="Use case (stadion)"]').getByTestId("treffers")).toHaveText("2");
  await expect(perRegel.locator('tr[data-regel="Include"]').getByTestId("treffers")).toHaveText("1");
  await expect(perRegel.locator('tr[data-regel="Extend"]').getByTestId("treffers")).toHaveText("0");
  await expect(proef.getByTestId("proef-plan")).toContainText("Bestelling plaatsen");
  // Onleesbare bron: een melding, geen crash.
  await page.locator('[data-regelset="bpmn-xml-naar-bpmn-motor"]').first().click();
  const bpmn = page.getByTestId("proef");
  await bpmn.getByTestId("proef-tekst").fill("<geen-bpmn/>");
  await bpmn.getByTestId("proef-draai").click();
  await expect(bpmn.getByTestId("proef-fout")).toContainText("niet te lezen");
});

test("proefdraaien op een map uit het project geeft de doeltekst", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "usecase05", diagramId: "d_uc", diagramNaam: "Winkel", elementen: [
    { id: "klant", naam: "Klant", type: "actor", pos: { x: 100, y: 200 } },
    { id: "bestellen", naam: "Bestellen", type: "usecase", pos: { x: 400, y: 200 } },
    { id: "a1", naam: "", type: "associatie", source: "klant", target: "bestellen" },
  ] });
  await page.locator(".studio-activitybar [title^='Transformaties']").first().click();
  await page.locator('[data-regelset="usecase-naar-mermaid-flowchart"]').first().click();
  const proef = page.getByTestId("proef");
  const kies = proef.getByTestId("proef-map");
  await kies.selectOption({ label: "Het hele model van dit profiel" });
  await proef.getByTestId("proef-draai").click();
  await expect(proef.getByTestId("proef-telling")).toContainText("0 zonder regel");
  await expect(proef.getByTestId("proef-doeltekst")).toContainText("flowchart");
  await expect(proef.getByTestId("proef-doeltekst")).toContainText("Klant");
});

test("een regelset met instellingen is te bekijken, niet proef te draaien", async ({ page }) => {
  await open(page);
  await page.locator('[data-regelset="bpmn-naar-gzac"]').first().click();
  const main = page.getByTestId("regelset");
  // BPMN voor GZAC is een stand van de BPMN-schrijver: een paneel uit het schema, in groepen.
  const paneel = main.getByTestId("schema-paneel");
  await expect(main.getByTestId("regelset-geldig")).toContainText("schema van de schrijver");
  await expect(paneel.locator("section[data-groep]")).toHaveCount(5);
  await expect(paneel.locator('[data-pad="taken.userTask.attributen"]')).toContainText("camunda:candidateGroups");
  await expect(paneel.locator('[data-pad="taken.serviceTask.asyncAfter"] [role="switch"]')).toHaveAttribute("aria-checked", "true");
  await expect(paneel.locator('[data-placeholder="dossierstatus"]')).toHaveCount(1);
  await expect(paneel.getByTestId("onbeschreven")).toHaveCount(0);
  await expect(main.getByTestId("proef")).toHaveCount(0);
  // Een stand zonder schema blijft JSON.
  await page.locator('[data-regelset="canoniek-naar-zaaktype"]').first().click();
  await expect(main.getByTestId("schema-paneel")).toHaveCount(0);
  await expect(main.getByTestId("regelset-instellingen")).toContainText("zaaktype.identificatie");
  // Een regelset met regels maar een samengestelde bron: regels wel, proef nog niet.
  await page.locator('[data-regelset="canoniek-naar-objecttype"]').first().click();
  await expect(main.getByTestId("regels-tabel").locator("tbody tr")).toHaveCount(14);
  await expect(main.getByTestId("proef-geen")).toContainText("samengesteld");
});
