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

// Fase 3: canoniek model → SHACL-shapes via het transformatiepaneel, met kruisverbanden.
test("canoniek model in een map → SHACL-shapes in de doelmap, met kruisverbanden", async ({ page }) => {
  const v3 = JSON.parse(readFileSync(path.resolve(hier, "../../src/diagramprofielen/canoniek-uml/fixtures/aanvraag/aanvraag-domein-v3.json"), "utf8"));
  await openStudio(page);
  await shacl(page, "return true;");
  const kaart = await page.evaluate(async (v3) => {
    const { importeerV3 } = await import(location.origin + "/viz/react/src/diagramprofielen/canoniek-uml/serialisatie.js");
    const { getProfieltype } = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const { useModellerenStore: ms } = await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx");
    const { useTransformStore } = await import(location.origin + "/viz/react/src/studio/activities/TransformatiePaneel.jsx");
    const st = getProfieltype("diagram05").useStore;
    st.getState().laadModel(importeerV3(v3));
    const s = st.getState();
    const bron = ms.getState().nieuweMap("Aanvraag");
    const doel = ms.getState().nieuweMap("Linked data");
    ms.getState().plaatsMeerdere([
      ...Object.keys(s.diagrams).map((d) => `diagram05::${d}`),
      ...Object.values(s.elements).filter((e) => !e.source).map((e) => `el::diagram05::${e.id}`),
    ], bron);
    useTransformStore.getState().sluiten();
    useTransformStore.getState().openen(bron, "transform");
    return { bron, doel };
  }, v3);
  await page.locator("select").filter({ has: page.locator("option", { hasText: "— kies een map —" }) }).selectOption(kaart.doel);
  await page.getByText("Canoniek model → SHACL-shapes").click();
  await page.getByRole("button", { name: "Uitvoeren" }).click();
  await expect(page.getByText(/11 node shapes in "Aanvraag \(SHACL\)", 12 kruisverbanden/)).toBeVisible();

  const uit = await page.evaluate(async (kaart) => {
    const { getProfieltype } = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const { useModellerenStore: ms } = await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx");
    const { useKruisStore } = await import(location.origin + "/viz/react/src/studio/activities/koppelingenActivity.jsx");
    const st = getProfieltype("shacl05").useStore.getState();
    const pre = `cs_${kaart.bron}_`.replace(/[^A-Za-z0-9_-]+/g, "_");
    const aanvraag = st.elements[`${pre}can_Aanvraag`];
    return {
      iri: aanvraag?.data?.iri,
      pijlen: Object.values(st.elements).filter((e) => e.elementType === "verwijzing" && e.source === aanvraag?.id).length,
      geplaatst: ms.getState().plaatsing[`shacl05::${pre}diagram`] === kaart.doel,
      kruis: useKruisStore.getState().links.filter((l) => l.soort === "genereert" && l.rij.profielId === "shacl05" && l.kolom.profielId === "diagram05").length,
      kruisAanvraag: useKruisStore.getState().links.some((l) => l.rij.elementId === aanvraag?.id && l.kolom.elementId === "Aanvraag" && l.omgekeerd),
    };
  }, kaart);
  expect(uit).toEqual({ iri: "aanvraag:Aanvraag", pijlen: 5, geplaatst: true, kruis: 12, kruisAanvraag: true });
});

// Ook via Modelleren ▸ Transformeren ▸ Importeren (niet alleen het menu van de SHACL-activiteit).
test("SHACL importeren via het transformatiepaneel", async ({ page }) => {
  await openStudio(page);
  await shacl(page, "return true;");
  const map = await page.evaluate(async () => {
    const { useModellerenStore: ms } = await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx");
    const { useTransformStore } = await import(location.origin + "/viz/react/src/studio/activities/TransformatiePaneel.jsx");
    const id = ms.getState().nieuweMap("SHACL");
    useTransformStore.getState().sluiten();
    useTransformStore.getState().openen(id, "import");
    return id;
  });
  const kiezer = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Kies bestand…" }).click();
  await (await kiezer).setFiles(KERN);
  await page.locator("select").filter({ has: page.locator("option", { hasText: "— kies een map —" }) }).selectOption(map);
  await page.getByText("SHACL (Turtle) → SHACL-model").click();
  await page.getByRole("button", { name: "Uitvoeren" }).click();
  await expect(page.getByText("14 shapes ingelezen, geen meldingen.")).toBeVisible();
  expect(await shacl(page, 'return Object.values(st.elements).filter((e) => e.elementType === "nodeshape").length;')).toBe(14);
});

// De omgekeerde richting: de ODRL-kern als UML (canoniek model), met supertypes en kardinaliteiten.
test("SHACL-shapes → canoniek model: ODRL 2.2 als UML-diagram", async ({ page }) => {
  await openStudio(page);
  await shacl(page, "return true;");
  const kaart = await page.evaluate(async () => {
    const { useModellerenStore: ms } = await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx");
    const { useTransformStore } = await import(location.origin + "/viz/react/src/studio/activities/TransformatiePaneel.jsx");
    const bron = ms.getState().nieuweMap("SHACL");
    const doel = ms.getState().nieuweMap("ODRL als UML");
    useTransformStore.getState().sluiten();
    useTransformStore.getState().openen(bron, "import");
    return { bron, doel };
  });
  const kiezer = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Kies bestand…" }).click();
  await (await kiezer).setFiles(KERN);
  await page.locator("select").filter({ has: page.locator("option", { hasText: "— kies een map —" }) }).selectOption(kaart.bron);
  await page.getByText("SHACL (Turtle) → SHACL-model").click();
  await page.getByRole("button", { name: "Uitvoeren" }).click();
  await expect(page.getByText("14 shapes ingelezen, geen meldingen.")).toBeVisible();

  await page.evaluate(async (bron) => {
    const { useTransformStore } = await import(location.origin + "/viz/react/src/studio/activities/TransformatiePaneel.jsx");
    useTransformStore.getState().sluiten();
    useTransformStore.getState().openen(bron, "transform");
  }, kaart.bron);
  await page.locator("select").filter({ has: page.locator("option", { hasText: "— kies een map —" }) }).selectOption(kaart.doel);
  await page.getByText("SHACL-shapes → canoniek model (UML)").click();
  await page.getByRole("button", { name: "Uitvoeren" }).click();
  await expect(page.getByText(/18 entiteiten, 31 relaties, 6 generalisaties in "ODRL 2\.2 — kern van het informatiemodel \(testbestand\) \(UML\)"/)).toBeVisible();

  const uit = await page.evaluate(async (kaart) => {
    const { getProfieltype } = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const { useModellerenStore: ms } = await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx");
    const { useKruisStore } = await import(location.origin + "/viz/react/src/studio/activities/koppelingenActivity.jsx");
    const st = getProfieltype("diagram05").useStore.getState();
    const pre = `vs_${kaart.bron}_`.replace(/[^A-Za-z0-9_-]+/g, "_");
    ms.getState().openTab("diagram05", `${pre}diagram`);
    return {
      policy: st.elements[`${pre}sc_odrl_Policy`]?.naam,
      geplaatst: ms.getState().plaatsing[`diagram05::${pre}diagram`] === kaart.doel,
      kruis: useKruisStore.getState().links.filter((l) => l.soort === "genereert" && l.rij.profielId === "shacl05" && l.kolom.profielId === "diagram05" && !l.omgekeerd).length,
    };
  }, kaart);
  expect(uit.policy).toBe("Policy");
  expect(uit.geplaatst).toBe(true);
  expect(uit.kruis).toBeGreaterThan(17);
  await expect(page.locator(".react-flow__node").filter({ hasText: "LogicalConstraint" }).first()).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    const { useTransformStore } = await import(location.origin + "/viz/react/src/studio/activities/TransformatiePaneel.jsx");
    useTransformStore.getState().sluiten();
  });
  await page.locator(".react-flow__controls-fitview").click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator(".react-flow").screenshot({ path: test.info().outputPath("odrl-uml.png") });
});

// Layout overnemen: het SHACL-diagram volgt de (met de hand gezette) ordening van het CM.
test("layout overnemen: SHACL-diagram geschikt zoals het canonieke model", async ({ page }) => {
  await openStudio(page);
  await shacl(page, "return true;");
  const kaart = await page.evaluate(async () => {
    const { useModellerenStore: ms } = await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx");
    const { getTransformaties } = await import(location.origin + "/viz/react/src/studio/activities/transformatieRegistry.js");
    const bron = ms.getState().nieuweMap("SHACL");
    const cm = ms.getState().nieuweMap("CM");
    return { bron, cm, ids: getTransformaties("transform").map((t) => t.id) };
  });
  expect(kaart.ids).toContain("layout-overnemen");
  const tekst = readFileSync(KERN, "utf8");
  const uit = await page.evaluate(async ({ kaart, tekst }) => {
    const { getTransformaties } = await import(location.origin + "/viz/react/src/studio/activities/transformatieRegistry.js");
    const { getProfieltype } = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const run = (richting, id, arg) => getTransformaties(richting).find((t) => t.id === id).run(arg);
    await run("import", "import-shacl-turtle", { bron: { naam: "kern.ttl", tekst }, doelMap: kaart.bron });
    await run("transform", "shacl-naar-canoniek", { bronMap: kaart.bron, doelMap: kaart.cm });
    // Het CM met de hand ordenen: Asset links boven, Policy rechts, Rule onder Policy.
    const cm = getProfieltype("diagram05").useStore;
    const pre = `vs_${kaart.bron}_`.replace(/[^A-Za-z0-9_-]+/g, "_");
    const plek = { sc_odrl_Asset: { x: 0, y: 0 }, sc_odrl_Policy: { x: 900, y: 0 }, sc_odrl_Rule: { x: 900, y: 600 } };
    const s = cm.getState();
    const did = `${pre}diagram`;
    cm.setState({ diagrams: { ...s.diagrams, [did]: { ...s.diagrams[did], nodes: s.diagrams[did].nodes.map((n) => ({ ...n, position: plek[n.elementId.slice(pre.length)] || n.position })) } } });
    const r = await run("transform", "layout-overnemen", { bronMap: kaart.cm, doelMap: kaart.bron });
    const sh = getProfieltype("shacl05").useStore.getState();
    const pos = (id) => Object.values(sh.diagrams).flatMap((d) => d.nodes).find((n) => n.elementId === id)?.position;
    return { summary: r.summary, asset: pos("ns_ok_AssetShape"), policy: pos("ns_ok_PolicyShape"), rule: pos("ns_ok_RuleShape") };
  }, { kaart, tekst });
  expect(uit.summary).toMatch(/21 element\(en\) geschikt/);
  expect(uit.asset.x).toBeLessThan(uit.policy.x);
  expect(uit.rule.y).toBeGreaterThan(uit.policy.y);
  expect(Math.abs(uit.rule.x - uit.policy.x)).toBeLessThan(200);
});
