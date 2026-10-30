// 38-editor-inhoud-weergave — lange inhoud in de Inhoud Editor leesbaar tonen (30-10-2026):
// JSON als gekleurde, inklapbare boom, BPMN-XML als diagram (bpmn-js), en een directe link
// met ?toon=<veld> (voor de payload van een inrichtingsartefact: #/t/artefacten/3?toon=payload).
//
// De API is nagebootst zoals in 36: een Artefact met een materieel ArtefactInhoud.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BPMN = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../src/diagramprofielen/canoniek-uml/fixtures/cg-test/gzac-handwerk/bpmn/aanvraag-oppakken.bpmn"), "utf8");
const OBJECTTYPE = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "GehandicaptenparkeerkaartAanvraag",
  type: "object",
  required: ["aanvrager"],
  properties: { aanvrager: { type: "object", properties: { bsn: { type: "string", maxLength: 9 } } }, rolstoel: { type: "boolean" }, aantal: { type: "integer", minimum: 1 }, toelichting: { type: ["string", "null"], default: null } },
};

const veld = (naam, extra = {}) => ({ naam, type: "string", ...extra });
const TYPES = [
  {
    typenaam: "Artefact", klassenaam: "Artefact", metatype: "entiteit", padnaam: "artefacten", meervoud: "artefacten",
    veldnaam: "artefact", idKolom: "id",
    onderliggende: [{ doeltype: "Artefact_ArtefactInhoud", rolnaam: "ArtefactInhouden", jsonRolnaam: "artefact_inhouden", momentvoorkomen: "enkelvoudig" }],
    velden: [veld("id", { type: "integer" })],
  },
  {
    typenaam: "Artefact_ArtefactInhoud", klassenaam: "ArtefactInhoud", metatype: "gegevenselement", ge_subtype: "hub",
    isMaterieel: true, veldnaam: "artefactinhoud", padnaam: "artefact_inhouden",
    idKolom: "rel_id", entiteitIDKolom: "artefact_id", momentvoorkomen: "enkelvoudig",
    onderliggende: [
      { doeltype: "Artefact_ArtefactInhoud_Data", rolnaam: "Data", jsonRolnaam: "data", momentvoorkomen: "enkelvoudig" },
      { doeltype: "Artefact_ArtefactInhoud_Aanvang", rolnaam: "Aanvang", jsonRolnaam: "aanvang", momentvoorkomen: "enkelvoudig" },
      { doeltype: "Artefact_ArtefactInhoud_Einde", rolnaam: "Einde", jsonRolnaam: "einde", momentvoorkomen: "enkelvoudig" },
    ],
    velden: [veld("artefact_id", { type: "integer" }), veld("rel_id", { type: "integer", autoIncrement: true })],
  },
  {
    typenaam: "Artefact_ArtefactInhoud_Data", metatype: "gegevenselement", ge_subtype: "data", veldnaam: "artefact_artefactinhoud_data",
    idKolom: "versie", entiteitIDKolom: "artefact_id",
    velden: [veld("artefact_id", { type: "integer" }), veld("rel_id", { type: "integer" }), veld("versie", { type: "integer" }), veld("payload", { datatype: "LangeTekst" }), veld("payloadHash")],
  },
  { typenaam: "Artefact_ArtefactInhoud_Aanvang", metatype: "gegevenselement", ge_subtype: "aanvang", veldnaam: "artefact_artefactinhoud_aanvang", idKolom: "versie", entiteitIDKolom: "artefact_id" },
  { typenaam: "Artefact_ArtefactInhoud_Einde", metatype: "gegevenselement", ge_subtype: "einde", veldnaam: "artefact_artefactinhoud_einde", idKolom: "versie", entiteitIDKolom: "artefact_id" },
];

const artefact = (id, payload) => {
  const rec = (extra) => ({ artefact_id: id, rel_id: 1, versie: 1, opvoer: "2026-10-28T12:00:00Z", afvoer: null, ...extra });
  return {
    id, opvoer: "2026-10-28T12:00:00Z", afvoer: null,
    artefact_inhouden: [{
      artefact_id: id, rel_id: 1, opvoer: "2026-10-28T12:00:00Z", afvoer: null,
      data: [rec({ payload, payloadHash: "ab".repeat(32) })],
      aanvang: [rec({ datum: "2026-10-28" })],
      einde: [],
    }],
  };
};

async function bootsApiNa(page) {
  await page.route("http://localhost:8082/**", (r) => r.fulfill({ status: 404, json: { error: "mock" } }));
  await page.route("**/api/schema/model/code", (r) => r.fulfill({ json: { types: TYPES, model: null } }));
  await page.route("**/api/viz/schema/datatypes", (r) => r.fulfill({ json: { datatypes: [{ naam: "LangeTekst", weergave: { multiline: true } }] } }));
  await page.route("**/full/artefacten/3", (r) => r.fulfill({ json: artefact(3, JSON.stringify(OBJECTTYPE)) }));
  await page.route("**/full/artefacten/7", (r) => r.fulfill({ json: artefact(7, BPMN) }));
}

test("JSON-payload: knop in de tabel, gekleurde boom, inklappen", async ({ page }) => {
  await bootsApiNa(page);
  await page.goto("/viz/react/inhoud.html#/t/artefacten/3");
  const sectie = page.locator("#ge-Artefact_ArtefactInhoud");
  const knop = sectie.locator('[data-bekijk-inhoud="payload"]');
  await expect(knop).toContainText("JSON-object · 5 sleutels");
  await expect(sectie.locator("tbody")).not.toContainText("json-schema.org"); // geen lap tekst in de cel
  await knop.click();
  const boom = sectie.locator(".cg-json-boom");
  await expect(boom).toBeVisible();
  const sleutel = boom.locator(".cg-json-boom__sleutel", { hasText: '"title"' });
  await expect(sleutel).toHaveCSS("color", "rgb(11, 111, 164)");
  await expect(boom.locator(".cg-json-boom__string", { hasText: '"GehandicaptenparkeerkaartAanvraag"' })).toHaveCSS("color", "rgb(30, 125, 58)");
  await expect(boom.locator(".cg-json-boom__getal").first()).toHaveCSS("color", "rgb(194, 77, 0)");
  await expect(boom.locator(".cg-json-boom__null", { hasText: "null" })).toHaveCSS("color", "rgb(138, 43, 226)");
  await sectie.getByRole("button", { name: "inklappen" }).click();
  await expect(boom).toContainText("… 4 sleutels"); // properties ingeklapt
  await expect(boom).not.toContainText('"bsn"');
  await sectie.getByRole("tab", { name: "Tekst" }).click();
  await expect(sectie.locator(".cg-inhoud-weergave__tekst")).toContainText('"title":"GehandicaptenparkeerkaartAanvraag"');
});

test("directe link ?toon=payload opent de weergave meteen", async ({ page }) => {
  await bootsApiNa(page);
  await page.goto("/viz/react/inhoud.html#/t/artefacten/3?toon=payload");
  await expect(page.locator("#inhoud-Artefact_ArtefactInhoud-payload .cg-json-boom")).toBeVisible();
  await page.getByTitle("Sluiten").click();
  await expect(page.locator(".cg-json-boom")).toHaveCount(0);
});

test("BPMN-payload als diagram (bpmn-js)", async ({ page }) => {
  await bootsApiNa(page);
  await page.goto("/viz/react/inhoud.html#/t/artefacten/7?toon=payload");
  const weergave = page.locator('[data-inhoud-soort="bpmn"]');
  await expect(weergave).toContainText("BPMN · 1 proces");
  await expect(weergave.locator(".djs-container svg")).toBeVisible();
  await expect.poll(() => weergave.locator(".djs-element.djs-shape").count()).toBeGreaterThan(3);
  await weergave.getByRole("tab", { name: "Tekst" }).click();
  await expect(weergave.locator(".cg-inhoud-weergave__tekst")).toContainText("bpmn:definitions");
});
