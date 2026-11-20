// Studio — Toegangverlening: ODRL (Turtle, ODRL-AP-NL) exporteren en weer importeren (18-11).
//  1. De export draagt de klare taal mee; onbewerkt geïmporteerd komt dezelfde tekst terug.
//  2. Elders bewerkte ODRL: de structuur wint van de meegegeven tekst, met een melding.
//  3. ODRL van elders (eigen vocabulaire, meer beleiden): beleid kiezen, weggelaten regels, meldingen.
//  4. Het paneel ODRL: dezelfde export als Turtle of JSON-LD; de JSON-LD-download.
import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers/studio.js";

test.use({ viewport: { width: 1700, height: 1000 } });

async function open(page) {
  await openStudio(page);
  await page.locator(".studio-activitybar [title^='Toegangverlening']").first().click();
  await expect(page.locator("textarea.toegangsspraak-textarea")).toHaveValue(/Beleid "Inzage naam bij schuldhulp"/);
}
const menu = async (page, regel) => {
  await page.locator(".studio-menubar").getByText("Beleid", { exact: true }).click();
  await page.getByText(regel).click();
};
async function exporteer(page) {
  const download = page.waitForEvent("download");
  await menu(page, "Exporteer ODRL (Turtle, ODRL-AP-NL)…");
  const bestand = await download;
  expect(bestand.suggestedFilename()).toBe("Inzage_naam_bij_schuldhulp.odrl.ttl");
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
  expect(turtle).toContain('ts:brontekst """Beleid "Inzage naam bij schuldhulp".');
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
  await expect(editor).toHaveValue(/als de achternaam van de namen van de betrokkene met "B" begint/);
  await expect(page.getByText("zegt niet hetzelfde als de ODRL")).toBeVisible();
});

test("ODRL van elders: beleid kiezen, weggelaten regels en de meldingen", async ({ page }) => {
  await open(page);
  const turtle = fs.readFileSync(new URL("../../src/toegangsspraak/fixtures/odrl-van-elders.ttl", import.meta.url), "utf8");
  const editor = page.locator("textarea.toegangsspraak-textarea");
  // Twee beleiden in het bestand: de keuze staat op het eerste met regels. Daarna de vraag of de
  // weggelaten toestemmingen toch (ruimer) mee moeten: eerst nee.
  const dialogen = [];
  let ruimer = false;
  page.on("dialog", async (d) => {
    dialogen.push({ soort: d.type(), tekst: d.message(), standaard: d.defaultValue() });
    if (d.type() === "prompt") await d.accept(d.defaultValue());
    else if (ruimer) await d.accept();
    else await d.dismiss();
  });
  await importeer(page, turtle);
  await expect(editor).toHaveValue(/Beleid "Parkeervergunningen: bevragen van voertuigen"\./);
  expect(dialogen[0].soort).toBe("prompt");
  expect(dialogen[0].tekst).toContain("1. Stelselafspraken (0 regels)");
  expect(dialogen[0].tekst).toContain("2. Parkeervergunningen: bevragen van voertuigen (5 regels)");
  expect(dialogen[0].standaard).toBe("2");
  expect(dialogen[1].soort).toBe("confirm");
  expect(dialogen[1].tekst).toContain("2 van de 5 regels zijn weggelaten");
  await expect(editor).toHaveValue(/het zoektype van de aanvraag is "zoeken op kenteken"\./);
  await expect(editor).not.toHaveValue(/Verstrekken aan de gemeente/);
  await expect(page.getByText("ODRL van elders: 3 van de 5 regels overgenomen.")).toBeVisible();
  await expect(page.getByText('De toestemming "Verstrekken aan de gemeente" is niet overgenomen')).toBeVisible();
  // De tekst is geldige Toegangsspraak: geen parseerfouten onder de editor.
  await expect(page.getByText(/^Regel \d+: /)).toHaveCount(0);

  // Nog eens, nu ja: de toestemmingen staan er, met de waarschuwing dat ze ruimer zijn.
  ruimer = true;
  await importeer(page, turtle);
  await expect(editor).toHaveValue(/De Gemeente Waterstede mag alle gegevens van een voertuiggegevens exporteren\./);
  await expect(page.getByText("ODRL van elders: 5 van de 5 regels overgenomen.")).toBeVisible();
  await expect(page.getByText('De toestemming "Verstrekken aan de gemeente" is ruimer dan in de ODRL')).toBeVisible();
});

test("het paneel ODRL toont dezelfde export als Turtle of JSON-LD, en de JSON-LD is te downloaden", async ({ page }) => {
  await open(page);
  const weergave = page.getByTestId("odrl-weergave");
  // Standaard Turtle.
  await expect(weergave).toContainText("b:beleid a odrl:Set ;");
  await expect(weergave).toContainText("odrl:conflict odrl:prohibit ;");
  await page.getByTestId("odrl-schrijfvorm").getByText("JSON-LD", { exact: true }).click();
  await expect(weergave).toContainText('"@graph": [');
  await expect(weergave).toContainText('"@id": "b:regel-inzage-naam"');
  await expect(weergave).not.toContainText("a odrl:Set ;");
  await page.getByTestId("odrl-schrijfvorm").getByText("Turtle", { exact: true }).click();
  await expect(weergave).toContainText("b:beleid a odrl:Set ;");

  // De download is dezelfde ODRL-AP-NL, niet meer de oude vorm met NLGov-termen.
  const download = page.waitForEvent("download");
  await menu(page, "Exporteer ODRL (JSON-LD)…");
  const bestand = await download;
  expect(bestand.suggestedFilename()).toBe("Inzage_naam_bij_schuldhulp.odrl.jsonld");
  const document = JSON.parse(fs.readFileSync(await bestand.path(), "utf8"));
  const set = document["@graph"].find((k) => k["@id"] === "b:beleid");
  expect(set["@type"]).toBe("odrl:Set");
  expect(set["odrl:permission"]).toEqual({ "@id": "b:regel-inzage-naam" });
  expect(JSON.stringify(document)).not.toContain("nlgov:");
});
