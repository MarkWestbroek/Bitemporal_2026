// Studio — fase 1 van "Linked data als M2" (§12): SHACL (Turtle) importeren via het menu van het
// shacl-profiel. De ODRL 2.2-kern komt zonder meldingen binnen en wordt getekend; een bestand met
// de valkuilen van §11 geeft eerst een dialoog met de meldingen.
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { openStudio, zetModel } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const hier = path.dirname(fileURLToPath(import.meta.url));
const KERN = path.resolve(hier, "../../../../model-exchange/linked-data/odrl22-kern.shacl.ttl");

/** De store van het shacl-profiel (wacht tot de activiteit geregistreerd is). */
const shacl = (page, body) =>
  page.evaluate(async (body) => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    let p = null;
    for (let i = 0; i < 150 && !p; i++) {
      p = reg.getProfieltype("shacl05");
      if (!p) await new Promise((r) => setTimeout(r, 100));
    }
    return new Function("st", body)(p.useStore.getState());
  }, body);

/**
 * Het import-menu van het profiel, met het bestand in de bestandskiezer. Het menu luistert pas
 * als een diagram van het profiel open is: eerst een leeg diagram openen.
 */
async function importeer(page, bestand) {
  await zetModel(page, { profielId: "shacl05", diagramId: "leeg", diagramNaam: "Leeg" });
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 20_000 });
  const kiezer = page.waitForEvent("filechooser");
  await page.evaluate(async () => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("shacl05:import-bestand");
  });
  await (await kiezer).setFiles(bestand);
}

test("ODRL-kern importeren: shapes, regels en pijlen; getekend op het diagram", async ({ page }) => {
  await openStudio(page);
  await shacl(page, "return true;");
  await importeer(page, KERN);
  await expect.poll(() => shacl(page, 'return Object.values(st.elements).filter((e) => e.elementType === "nodeshape").length;')).toBe(14);
  // Geen meldingen, dus geen dialoog.
  await expect(page.locator(".studio-dialoog")).toHaveCount(0);
  expect(await shacl(page, 'return Object.values(st.elements).filter((e) => e.elementType === "verwijzing" && e.source === "ns_ok_RuleShape" && e.data.of).map((e) => e.target).sort();')).toEqual([
    "ns_ok_ConstraintShape",
    "ns_ok_LogicalConstraintShape",
  ]);
  // Op het canvas: de Policy-box met het alternatieve pad.
  const diagramId = "shapes";
  await page.evaluate(async (diagramId) => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("studio:open-diagram", { profielId: "shacl05", diagramId });
  }, diagramId);
  const policy = page.locator('.react-flow__node[data-id="ns_ok_PolicyShape"]');
  await expect(policy).toBeVisible({ timeout: 20_000 });
  await expect(policy).toContainText("odrl:permission|odrl:prohibition|odrl:obligation");
});

test("een bestand met valkuilen geeft eerst de meldingen, daarna de import", async ({ page }) => {
  const map = mkdtempSync(path.join(tmpdir(), "shacl-"));
  const bestand = path.join(map, "valkuilen.ttl");
  writeFileSync(
    bestand,
    `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://voorbeeld.org/ns#> .
ex:Set a sh:NodeShape ; sh:targetClass ex:Set ;
  sh:property [ sh:path ( ex:permission ex:prohibition ) ; sh:minCount 1 ] .
ex:Regel a sh:SPARQLConstraint ; sh:targetClass ex:Set ; sh:select "SELECT $this WHERE { $this ex:p ?x }" .
`
  );
  await openStudio(page);
  await shacl(page, "return true;");
  await importeer(page, bestand);
  const dialoog = page.locator(".studio-dialoog");
  await expect(dialoog).toContainText("is een REEKS");
  await expect(dialoog).toContainText("draait nooit");
  await dialoog.getByRole("button", { name: "Importeer" }).click();
  await expect.poll(() => shacl(page, 'return st.elements.ns_ex_Set?.compartimenten?.[0]?.velden?.[0]?.naam || null;')).toBe("ex:permission/ex:prohibition");
});

test("exporteren na een wijziging: Turtle met de wijziging, zonder meldingen", async ({ page }) => {
  await openStudio(page);
  await shacl(page, "return true;");
  await importeer(page, KERN);
  await expect.poll(() => shacl(page, 'return Object.keys(st.elements).length;')).toBeGreaterThan(20);
  // Hernoem Party: de IRI blijft ok:PartyShape, het label wordt "Partij".
  await page.evaluate(async () => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    reg.getProfieltype("shacl05").useStore.getState().updateElement("ns_ok_PartyShape", { naam: "Partij" });
  });
  const download = page.waitForEvent("download");
  await page.evaluate(async () => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("shacl05:export-bestand");
  });
  const bestand = await download;
  expect(bestand.suggestedFilename()).toMatch(/\.ttl$/);
  const tekst = readFileSync(await bestand.path(), "utf8");
  expect(tekst).not.toMatch(/^# /m);
  expect(tekst).toContain('ok:PartyShape\n    a sh:NodeShape ;\n    rdfs:label "Partij" ;');
  expect(tekst).toContain("sh:alternativePath ( odrl:permission odrl:prohibition odrl:obligation )");
});
