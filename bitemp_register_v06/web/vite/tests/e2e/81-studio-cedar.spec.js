// Studio — Cedar-profiel (fase 1 van "2026-11-25 Cedar als M2"): de PABC-vormige voorbeeldpolicies
// importeren via het menu van het profiel. De meldingen (actie niet van type Action, een policy
// die nooit geldt, schema afgeleid) komen eerst in een dialoog; daarna staan de policies als
// kaarten op het diagram, en export geeft dezelfde tekst, ook na een wijziging in een policy.
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";
import { openStudio, zetModel } from "./helpers/studio.js";

test.use({ viewport: { width: 1440, height: 900 } });

const hier = path.dirname(fileURLToPath(import.meta.url));
const VOORBEELD = path.resolve(hier, "../../src/diagramprofielen/cedar/fixtures/pabc-voorbeeld.cedar");

const cedar = (page, body) =>
  page.evaluate(async (body) => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    let p = null;
    for (let i = 0; i < 150 && !p; i++) {
      p = reg.getProfieltype("cedar05");
      if (!p) await new Promise((r) => setTimeout(r, 100));
    }
    return new Function("st", body)(p.useStore.getState());
  }, body);

const menu = (page, gebeurtenis) =>
  page.evaluate(async (g) => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit(g);
  }, gebeurtenis);

test("PABC-voorbeeld: meldingen, kaarten op het diagram, export gelijk en na een wijziging", async ({ page }) => {
  await openStudio(page);
  await cedar(page, "return true;");
  await zetModel(page, { profielId: "cedar05", diagramId: "leeg", diagramNaam: "Leeg" });
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 20_000 });
  const kiezer = page.waitForEvent("filechooser");
  await menu(page, "cedar05:import-bestand");
  await (await kiezer).setFiles(VOORBEELD);

  const dialoog = page.locator(".studio-dialoog");
  await expect(dialoog).toContainText("moet een actie type Action hebben");
  await expect(dialoog).toContainText("geldt nooit");
  await dialoog.getByRole("button", { name: "Importeer" }).click();
  await expect.poll(() => cedar(page, 'return Object.values(st.elements).filter((e) => e.elementType === "policy").length;')).toBe(5);
  expect(await cedar(page, 'return Object.values(st.elements).filter((e) => e.elementType === "entiteittype").map((e) => e.naam).sort();')).toEqual(["pabc_applicatie", "pabc_entiteittype", "pabc_gebruiker"]);

  // Op het canvas: de kaart met «permit», de scope en de conditie.
  const diagramId = await cedar(page, "return Object.keys(st.diagrams).find((d) => d !== 'leeg');");
  await page.evaluate(async (diagramId) => {
    const { menuBus } = await import(location.origin + "/viz/react/src/studio/menuBus.js");
    menuBus.emit("studio:open-diagram", { profielId: "cedar05", diagramId });
  }, diagramId);
  const kaart = page.locator('.react-flow__node[data-id="pol_policy1"]');
  await expect(kaart).toBeVisible({ timeout: 20_000 });
  await expect(kaart).toContainText("«permit»");
  await expect(kaart).toContainText("principal is pabc_gebruiker");
  await expect(kaart).toContainText('resource.domeinen.contains("voorbeeld-a")');

  // Export zonder wijziging: dezelfde tekst.
  let download = page.waitForEvent("download");
  await menu(page, "cedar05:export-bestand");
  expect(readFileSync(await (await download).path(), "utf8")).toBe(readFileSync(VOORBEELD, "utf8"));

  // Een policy wijzigen (permit → forbid): de kaart volgt, de export ook.
  await page.evaluate(async () => {
    const reg = await import(location.origin + "/viz/react/src/studio/profieltypeRegistry.js");
    const st = reg.getProfieltype("cedar05").useStore.getState();
    const el = st.elements.pol_policy1;
    st.updateElement("pol_policy1", { data: { ...el.data, tekst: el.data.tekst.replace("permit (", "forbid (") } });
  });
  await expect(kaart).toContainText("«forbid»");
  download = page.waitForEvent("download");
  await menu(page, "cedar05:export-bestand");
  const tekst = readFileSync(await (await download).path(), "utf8");
  expect(tekst).toContain('@reason("medewerkers: domein voorbeeld-a")\nforbid (');
  expect(tekst.match(/^permit \(/gm).length).toBe(4);
});

// Fase 2: Cedar ↔ Toegangsspraak via het transformatiepaneel. De Open FTV-lijst in een map, naar
// Toegangsspraak (download), de tekst bewerken, terug in dezelfde map: de gewijzigde policy houdt
// @reason, de rest blijft letterlijk, en de Open FTV-export geeft de bewerkte lijst.
const LIJST = path.resolve(hier, "../../src/diagramprofielen/cedar/fixtures/pabc-voorbeeld.openftv.json");

test("Toegangsspraak heen en terug in een map; ongewijzigde policies letterlijk; ODRL-AP-NL", async ({ page }) => {
  await openStudio(page);
  await cedar(page, "return true;");
  const map = await page.evaluate(async () => {
    const { useModellerenStore: ms } = await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx");
    return ms.getState().nieuweMap("PABC");
  });
  const run = (richting, id, arg) =>
    page.evaluate(async ({ richting, id, arg }) => {
      const { getTransformaties } = await import(location.origin + "/viz/react/src/studio/activities/transformatieRegistry.js");
      const r = await getTransformaties(richting).find((t) => t.id === id).run(arg);
      return { status: r.status, summary: r.summary };
    }, { richting, id, arg });

  const lijst = readFileSync(LIJST, "utf8");
  expect((await run("import", "import-cedar", { bron: { naam: "pabc.openftv.json", tekst: lijst }, doelMap: map })).summary).toMatch(/^5 policies/);

  let download = page.waitForEvent("download");
  const heen = await run("export", "export-cedar-toegangsspraak", { bronMap: map, mapNaam: "PABC" });
  expect(heen.summary).toMatch(/PABC\.toegangsspraak\.txt geschreven: 4 policies vertaald/);
  const tekst = readFileSync(await (await download).path(), "utf8");
  expect(tekst).toContain('Iemand met rol "medewerkers" mag alle gegevens van een pabc entiteittype raadpleger');

  // Fase 3: dezelfde map als ODRL-AP-NL (via Toegangsspraak), gelijk aan het gouden bestand.
  download = page.waitForEvent("download");
  expect((await run("export", "export-cedar-odrl", { bronMap: map, mapNaam: "PABC" })).summary).toBe("PABC.odrl.ttl geschreven, 1 melding(en).");
  const odrl = readFileSync(await (await download).path(), "utf8");
  expect(odrl).toBe(readFileSync(path.resolve(hier, "../../src/diagramprofielen/cedar/fixtures/pabc-voorbeeld.odrl.ttl"), "utf8").replace(/\r\n/g, "\n"));

  const terug = await run("import", "import-toegangsspraak-cedar", { bron: { naam: "pabc.txt", tekst: tekst.replace('"voorbeeld-b"', '"voorbeeld-c"') }, doelMap: map });
  expect(terug.summary).toBe("3 ongewijzigd, 1 gewijzigd, 0 nieuw, 1 behouden.");
  const gewijzigd = await cedar(page, 'return st.elements["pol_voorbeeld_medewerkers_domein-b"].data.tekst;');
  expect(gewijzigd).toMatch(/^@reason\("medewerkers: domein voorbeeld-b"\)\npermit \([\s\S]*contains\("voorbeeld-c"\)/);

  download = page.waitForEvent("download");
  await run("export", "export-cedar-openftv", { bronMap: map, mapNaam: "PABC" });
  const uit = readFileSync(await (await download).path(), "utf8");
  expect(uit).toBe(lijst.replace(/\r\n/g, "\n").replace('contains(\\"voorbeeld-b\\")', 'contains(\\"voorbeeld-c\\")'));
});
