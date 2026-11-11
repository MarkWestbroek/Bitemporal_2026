// 62-studio-werkkopie-per-project.spec.js — de werkkopie in de browser is per project (TAB-1, 11-11).
//
// Tot 11-11 had de browser één werkkopie. Twee tabs met twee projecten schreven naar dezelfde
// plek: na herladen had een tab de naam van het ene project met de inhoud van het andere, en
// een snapshot stuurde dat mengsel naar de server. Nu heeft elke bewaarde sleutel het project-id
// erachter en onthoudt een tab zelf zijn project (src/diagramcore/model/opslagRuimte.js).
//
// Draaien: zie helpers/studio.js (eigen dev-server, API gemockt).
import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { openStudio, zetModel } from "./helpers/studio.js";

/** Wat de tab in het geheugen heeft: "project-id: entiteit, entiteit". */
const stand = (page) =>
  page.evaluate(async () => {
    const base = location.origin + "/viz/react/";
    const { useModellerenStore } = await import(base + "src/studio/activities/modellerenActivity.jsx");
    const reg = await import(base + "src/studio/profieltypeRegistry.js");
    let p = null;
    for (let i = 0; i < 100 && !p; i++) {
      p = reg.getProfieltype("diagram05");
      if (!p) await new Promise((r) => setTimeout(r, 100));
    }
    const namen = Object.values(p.useStore.getState().elements).filter((e) => e.elementType === "entiteit").map((e) => e.naam).sort();
    return `${useModellerenStore.getState().project.id}: ${namen.join(", ")}`;
  });

/** Wat een snapshot naar de server zou sturen (Exporteer project is dezelfde inhoud). */
async function exporteer(page) {
  await page.locator('[data-tour="menu-project"]').first().click();
  const download = page.waitForEvent("download");
  await page.getByText("Exporteer project (structuur + modellen)…").first().click();
  const d = JSON.parse(fs.readFileSync(await (await download).path(), "utf8"));
  const namen = Object.values(d.profielen?.diagram05?.elements || {}).filter((e) => e.elementType === "entiteit").map((e) => e.naam).sort();
  return { ruw: d, kort: `${d.project.id}: ${namen.join(", ")}` };
}

const zetProject = (page, id, naam) =>
  page.evaluate(async ({ id, naam }) => {
    const { useModellerenStore } = await import(location.origin + "/viz/react/src/studio/activities/modellerenActivity.jsx");
    useModellerenStore.getState().zetProject({ id, naam });
  }, { id, naam });

async function herlaad(page) {
  await page.bringToFront();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".studio-activitybar");
  await page.waitForTimeout(2500); // de stores laden asynchroon uit IndexedDB
}

test("twee tabs, twee projecten: na herladen heeft elke tab nog zijn eigen project", async ({ context }) => {
  const t1 = await context.newPage();
  await openStudio(t1);
  await zetProject(t1, "project-een", "Evenementen");
  await zetModel(t1, { profielId: "diagram05", diagramId: "d1", diagramNaam: "D1", elementen: [{ id: "Evenement", naam: "Evenement", type: "entiteit", pos: { x: 80, y: 450 } }] });
  await t1.waitForTimeout(1500);
  const een = await exporteer(t1);
  expect(een.kort).toBe("project-een: Evenement");

  // Tab 2 opent (het laatst bewerkte project) en importeert daar een ander project.
  const t2 = await context.newPage();
  await openStudio(t2);
  await t2.waitForTimeout(1500);
  expect(await stand(t2)).toBe("project-een: Evenement");
  const twee = JSON.parse(JSON.stringify(een.ruw).replaceAll("Evenement", "Parkeerkaart"));
  twee.project = { id: "project-twee", naam: "GPK" };
  await t2.locator('[data-tour="menu-project"]').first().click();
  const chooser = t2.waitForEvent("filechooser");
  await t2.getByText("Importeer project…").first().click();
  await (await chooser).setFiles({ name: "gpk.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(twee)) });
  await t2.getByRole("button", { name: "Importeer", exact: true }).click();
  await t2.waitForTimeout(1500);
  expect(await stand(t2)).toBe("project-twee: Parkeerkaart");

  // Tab 1 werkt door in Evenementen.
  await t1.bringToFront();
  await t1.evaluate(() => window.__stores.diagram05.getState().addElement({ id: "Locatie", naam: "Locatie", elementType: "entiteit", data: {}, compartimenten: [] }));
  await t1.waitForTimeout(1500);

  // Herladen: elk zijn eigen project, met zijn eigen inhoud. Ook in wat er naar de server zou gaan.
  await herlaad(t1);
  expect(await stand(t1)).toBe("project-een: Evenement, Locatie");
  expect((await exporteer(t1)).kort).toBe("project-een: Evenement, Locatie");
  await herlaad(t2);
  expect(await stand(t2)).toBe("project-twee: Parkeerkaart");
  expect((await exporteer(t2)).kort).toBe("project-twee: Parkeerkaart");

  // Een nieuwe tab krijgt het project van de tab die je het laatst gebruikte: hier tab 1.
  await t1.bringToFront();
  await t1.evaluate(() => window.dispatchEvent(new Event("focus")));
  const t3 = await context.newPage();
  await openStudio(t3);
  await t3.waitForTimeout(2500);
  expect(await stand(t3)).toBe("project-een: Evenement, Locatie");
});

test("de werkkopie van vóór 11-11 (zonder project in de sleutel) verhuist mee naar haar project", async ({ context }) => {
  const t1 = await context.newPage();
  await openStudio(t1);
  await zetProject(t1, "project-oud", "Van vroeger");
  await zetModel(t1, { profielId: "diagram05", diagramId: "d1", diagramNaam: "D1", elementen: [{ id: "Aanvraag", naam: "Aanvraag", type: "entiteit", pos: { x: 80, y: 450 } }] });
  await t1.waitForTimeout(1500);

  // Zet de opslag terug in de oude vorm: sleutels zonder project-id, geen tab-geheugen.
  await t1.evaluate(async () => {
    const db = await new Promise((ok, fout) => { const r = indexedDB.open("omnium-studio", 1); r.onsuccess = () => ok(r.result); r.onerror = () => fout(r.error); });
    const tx = (mode) => db.transaction("profielstores", mode).objectStore("profielstores");
    const vraag = (r) => new Promise((ok, fout) => { r.onsuccess = () => ok(r.result); r.onerror = () => fout(r.error); });
    for (const k of await vraag(tx("readonly").getAllKeys())) {
      const i = String(k).lastIndexOf("::");
      if (i < 0) continue;
      const waarde = await vraag(tx("readonly").get(k));
      await vraag(tx("readwrite").put(waarde, String(k).slice(0, i)));
      await vraag(tx("readwrite").delete(k));
    }
    localStorage.setItem("studio-modelleren", localStorage.getItem("studio-project::project-oud"));
    for (const k of Object.keys(localStorage)) if (k.includes("::") || k === "studio-werkkopie-oud-project" || k === "studio-laatste-project" || k === "studio-werkkopieen") localStorage.removeItem(k);
    sessionStorage.removeItem("studio-tab-project");
  });

  await herlaad(t1);
  expect(await stand(t1)).toBe("project-oud: Aanvraag");
  const sleutels = await t1.evaluate(async () => {
    const db = await new Promise((ok, fout) => { const r = indexedDB.open("omnium-studio", 1); r.onsuccess = () => ok(r.result); r.onerror = () => fout(r.error); });
    const r = db.transaction("profielstores", "readonly").objectStore("profielstores").getAllKeys();
    const alle = await new Promise((ok) => { r.onsuccess = () => ok(r.result.map(String)); });
    return alle.filter((k) => k.startsWith("studio05-canoniek-uml"));
  });
  expect(sleutels).toEqual(["studio05-canoniek-uml::project-oud"]);

  // Een ander project in een tweede tab neemt de oude werkkopie niet over.
  const t2 = await context.newPage();
  await openStudio(t2);
  await zetProject(t2, "project-nieuw", "Nieuw");
  await herlaad(t2);
  expect((await stand(t2)).startsWith("project-nieuw:")).toBe(true);
  await herlaad(t1);
  expect(await stand(t1)).toBe("project-oud: Aanvraag");
});
