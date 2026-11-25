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
