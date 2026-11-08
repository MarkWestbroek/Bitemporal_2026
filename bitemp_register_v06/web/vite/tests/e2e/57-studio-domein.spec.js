// Studio — Mark, 08-11: "Entiteiten lijken geen domein te hebben" en "wat domineert?". Het domein
// komt uit het package in de boom; een GE volgt zijn entiteit, een relatie haar bron. De inspector
// toont het als alleen-lezen regel; een GE heeft geen eigen domein-veld meer.
import { test, expect } from "@playwright/test";
import { openStudio, zetModel, wachtOpNode } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

test("inspector: domein uit het package, GE volgt de entiteit, geen invulveld", async ({ page }) => {
  await openStudio(page);
  await zetModel(page, { profielId: "diagram05", diagramId: "d_dom", diagramNaam: "Domein", elementen: [
    { id: "pkg", naam: "relatiebeheer", type: "package" },
    { id: "partij", naam: "Partij", type: "entiteit", pos: { x: 100, y: 200 }, data: { domein: "oud" } },
    { id: "naam", naam: "Naam", type: "gegevenselement", pos: { x: 500, y: 200 }, data: { domein: "fout" } },
    { id: "b1", naam: "", type: "bevat", source: "pkg", target: "partij" },
    { id: "c1", naam: "", type: "compositie", source: "partij", target: "naam" },
  ] });
  await wachtOpNode(page, "partij");

  await page.locator('.react-flow__node[data-id="partij"]').click();
  const regel = page.getByTestId("inspector-afgeleid-domein");
  await expect(regel).toContainText("relatiebeheer");
  await expect(regel).toContainText("package");
  await expect(page.locator(".dc-inspector-sub")).toContainText("relatiebeheer");

  await page.locator('.react-flow__node[data-id="naam"]').click();
  await expect(regel).toContainText("relatiebeheer");
  await expect(regel).toContainText("van Partij");
  await expect(page.locator(".dc-inspector-sub")).not.toContainText("fout");
  // Geen invulbaar domein-veld meer bij het GE.
  await expect(page.locator(".dc-inspector-rij:not(.is-afgeleid) .dc-veldlabel", { hasText: /^domein$/ })).toHaveCount(0);
});
