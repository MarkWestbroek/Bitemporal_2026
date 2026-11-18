// Studio — Toegangverlening: ODRL (Turtle, ODRL-AP-NL) exporteren en weer importeren (18-11).
//  1. De export draagt de klare taal mee; onbewerkt geïmporteerd komt dezelfde tekst terug.
//  2. Elders bewerkte ODRL: de structuur wint van de meegegeven tekst, met een melding.
import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1700, height: 1000 } });

async function open(page) {
  await openStudio(page);
  await page.locator(".studio-activitybar [title^='Toegangverlening']").first().click();
  await expect(page.locator("textarea.toegangsspraak-textarea")).toHaveValue(/Beleid "Inzage inkomen bij schuldhulp"/);
}
const menu = async (page, regel) => {
  await page.locator(".studio-menubar").getByText("Beleid", { exact: true }).click();
  await page.getByText(regel).click();
};
async function exporteer(page) {
  const download = page.waitForEvent("download");
  await menu(page, "Exporteer ODRL (Turtle, ODRL-AP-NL)…");
  const bestand = await download;
  expect(bestand.suggestedFilename()).toBe("Inzage_inkomen_bij_schuldhulp.odrl.ttl");
  return fs.readFileSync(await bestand.path(), "utf8");
}
async function importeer(page, turtle) {
  const kiezer = page.waitForEvent("filechooser");
  await menu(page, "Importeer ODRL (Turtle");
  await (await kiezer).setFiles({ name: "beleid.odrl.ttl", mimeType: "text/turtle", buffer: Buffer.from(turtle, "utf8") });
}

test("exporteren en importeren geeft dezelfde tekst terug", async ({ page }) => {
  await open(page);
  const editor = page.locator("textarea.toegangsspraak-textarea");
  const origineel = await editor.inputValue();
  const turtle = await exporteer(page);
  expect(turtle).toContain("b:beleid a odrl:Set");
  expect(turtle).toContain('ts:brontekst """Beleid "Inzage inkomen bij schuldhulp".');
  expect(turtle).toContain("ts:volgorde 2");

  await editor.fill('Beleid "Leeg".\n');
  await importeer(page, turtle);
  await expect(editor).toHaveValue(origineel);
  await expect(page.getByText("Teruglezen:")).toHaveCount(0);
});

test("bewerkte ODRL: de structuur wint en dat wordt gemeld", async ({ page }) => {
  await open(page);
  const turtle = (await exporteer(page)).replace('odrl:rightOperand "A" .', 'odrl:rightOperand "B" .');
  await importeer(page, turtle);
  const editor = page.locator("textarea.toegangsspraak-textarea");
  await expect(editor).toHaveValue(/als de achternaam van de naam van de betrokkene met "B" begint/);
  await expect(page.getByText("zegt niet hetzelfde als de ODRL")).toBeVisible();
});
