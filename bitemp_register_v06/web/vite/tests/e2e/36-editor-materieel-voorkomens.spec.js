// 36-editor-materieel-voorkomens — de inhoud-editor toont een materieel én enkelvoudig element als
// lijst van voorkomens (27-10-2026), met datum/tijd-invoer bij tijdprecisie "tijdstip".
//
// De API is volledig nagebootst (schema, /full, /registratie/): MeldingStatus zoals BACKEND hem
// sinds 27-10 levert (scenario 25: drie statussen op één dag, einde = aanvang van de opvolger).
import { test, expect } from "@playwright/test";

const veld = (naam, extra = {}) => ({ naam, type: "string", ...extra });
const TYPES = [
  {
    typenaam: "Melding", klassenaam: "Melding", metatype: "entiteit", padnaam: "meldingen", meervoud: "meldingen",
    veldnaam: "melding", idKolom: "id",
    onderliggende: [{ doeltype: "Melding_MeldingStatus", rolnaam: "MeldingStatussen", jsonRolnaam: "melding_statussen", momentvoorkomen: "enkelvoudig" }],
    velden: [veld("id", { type: "integer" })],
  },
  {
    typenaam: "Melding_MeldingStatus", klassenaam: "MeldingStatus", metatype: "gegevenselement", ge_subtype: "hub",
    isMaterieel: true, tijdprecisie: "tijdstip", veldnaam: "meldingstatus", padnaam: "melding_statussen",
    idKolom: "rel_id", entiteitIDKolom: "melding_id", momentvoorkomen: "enkelvoudig",
    onderliggende: [
      { doeltype: "Melding_MeldingStatus_Data", rolnaam: "Data", jsonRolnaam: "data", momentvoorkomen: "enkelvoudig" },
      { doeltype: "Melding_MeldingStatus_Aanvang", rolnaam: "Aanvang", jsonRolnaam: "aanvang", momentvoorkomen: "enkelvoudig" },
      { doeltype: "Melding_MeldingStatus_Einde", rolnaam: "Einde", jsonRolnaam: "einde", momentvoorkomen: "enkelvoudig" },
    ],
    velden: [veld("melding_id", { type: "integer" }), veld("rel_id", { type: "integer", autoIncrement: true })],
  },
  {
    typenaam: "Melding_MeldingStatus_Data", metatype: "gegevenselement", ge_subtype: "data", veldnaam: "melding_meldingstatus_data",
    idKolom: "versie", entiteitIDKolom: "melding_id",
    velden: [veld("melding_id", { type: "integer" }), veld("rel_id", { type: "integer" }), veld("versie", { type: "integer" }), veld("status", { verplicht: true })],
  },
  { typenaam: "Melding_MeldingStatus_Aanvang", metatype: "gegevenselement", ge_subtype: "aanvang", tijdprecisie: "tijdstip", veldnaam: "melding_meldingstatus_aanvang", idKolom: "versie", entiteitIDKolom: "melding_id" },
  { typenaam: "Melding_MeldingStatus_Einde", metatype: "gegevenselement", ge_subtype: "einde", tijdprecisie: "tijdstip", veldnaam: "melding_meldingstatus_einde", idKolom: "versie", entiteitIDKolom: "melding_id" },
];

const rec = (relId, extra) => ({ melding_id: 9201, rel_id: relId, versie: 1, opvoer: "2026-10-20T12:00:00Z", afvoer: null, ...extra });
const hub = (relId, status, aanvang, einde) => ({
  melding_id: 9201, rel_id: relId, opvoer: "2026-10-20T12:00:00Z", afvoer: null,
  data: [rec(relId, { status })],
  aanvang: [rec(relId, { datum: aanvang })],
  einde: einde ? [rec(relId, { datum: einde })] : [],
});
// Bewust niet op aanvang gesorteerd: de editor sorteert zelf.
const MELDING = {
  id: 9201, opvoer: "2026-10-20T08:00:00Z", afvoer: null,
  melding_statussen: [
    hub(3, "opgelost", "2026-10-20T10:30:00Z", null),
    hub(1, "nieuw", "2026-10-20T09:00:00Z", "2026-10-20T10:00:00Z"),
    hub(2, "in_behandeling", "2026-10-20T10:00:00Z", "2026-10-20T10:30:00Z"),
  ],
};

async function bootsApiNa(page, verzonden) {
  // Alles van de API standaard 404 (auth valt dan terug op "uit"); daarna de echte routes.
  await page.route("http://localhost:8082/**", (r) => r.fulfill({ status: 404, json: { error: "mock" } }));
  await page.route("**/api/schema/model/code", (r) => r.fulfill({ json: { types: TYPES, model: null } }));
  await page.route("**/api/viz/schema/datatypes", (r) => r.fulfill({ json: { datatypes: [] } }));
  await page.route("**/full/meldingen/9201", (r) => r.fulfill({ json: MELDING }));
  await page.route("**/registratie/", (r) => {
    verzonden.push(r.request().postDataJSON());
    r.fulfill({ status: 201, json: { registratie_id: 1 } });
  });
}

test("materieel enkelvoudig: lijst van voorkomens, op aanvang, met 'nu'", async ({ page }) => {
  await bootsApiNa(page, []);
  await page.goto("/viz/react/inhoud.html#/t/meldingen/9201");
  const sectie = page.locator("#ge-Melding_MeldingStatus");
  await expect(sectie).toContainText("materieel op tijdstip");
  await expect(sectie).toContainText("3 voorkomens");
  const rijen = sectie.locator("tbody tr");
  await expect(rijen).toHaveCount(3);
  await expect(rijen.nth(0)).toContainText("nieuw");
  await expect(rijen.nth(1)).toContainText("in_behandeling");
  await expect(rijen.nth(2)).toContainText("opgelost");
  await expect(rijen.nth(0)).toContainText(/20-10-2026 \d{2}:00/); // tijdstip, lokale tijd
  await expect(sectie.locator('tbody tr[data-geldig="nu"]')).toHaveCount(1);
  await expect(rijen.nth(2)).toHaveAttribute("data-geldig", "nu");
});

test("nieuw voorkomen: datum/tijd-invoer, aanvang als RFC 3339 op de hub, zonder rel_id", async ({ page }) => {
  const verzonden = [];
  await bootsApiNa(page, verzonden);
  await page.goto("/viz/react/inhoud.html#/t/meldingen/9201");
  const sectie = page.locator("#ge-Melding_MeldingStatus");
  await sectie.getByRole("button", { name: "+ Nieuw voorkomen MeldingStatus" }).click();
  const aanvang = sectie.locator('input[name="materieel-aanvang"]');
  await expect(aanvang).toHaveAttribute("type", "datetime-local");
  await expect(aanvang).not.toHaveValue(""); // verplicht na een voorganger: staat op "nu"
  await aanvang.fill("2026-10-21T08:15");
  await sectie.locator("input.utrecht-textbox--html-input").first().fill("gesloten");
  await sectie.getByRole("button", { name: "Opslaan" }).click();
  await expect.poll(() => verzonden.length).toBe(1);
  const verwacht = await page.evaluate(() => new Date("2026-10-21T08:15").toISOString().replace(/\.000Z$/, "Z"));
  const { wijzigingen, registratie } = verzonden[0];
  expect(registratie.registratietype).toBe("registratie");
  expect(wijzigingen).toEqual([{ opvoer: { meldingstatus: { melding_id: 9201, status: "gesloten", aanvang: verwacht } } }]);
});

test("einde van een voorkomen corrigeren: eigen opvoer op _Einde met sleutel, geen nieuwe data-versie", async ({ page }) => {
  const verzonden = [];
  await bootsApiNa(page, verzonden);
  await page.goto("/viz/react/inhoud.html#/t/meldingen/9201");
  const sectie = page.locator("#ge-Melding_MeldingStatus");
  await sectie.locator("tbody tr").nth(0).getByTitle("Corrigeren").click();
  const einde = sectie.locator('input[name="materieel-einde"]');
  await expect(einde).not.toHaveValue("");
  await einde.fill("2026-10-20T11:45");
  await sectie.getByRole("button", { name: "Corrigeren" }).last().click();
  await expect.poll(() => verzonden.length).toBe(1);
  const verwacht = await page.evaluate(() => new Date("2026-10-20T11:45").toISOString().replace(/\.000Z$/, "Z"));
  expect(verzonden[0].registratie.registratietype).toBe("correctie");
  expect(verzonden[0].wijzigingen).toEqual([
    { opvoer: { melding_meldingstatus_einde: { melding_id: 9201, rel_id: 1, datum: verwacht } } },
  ]);
});
