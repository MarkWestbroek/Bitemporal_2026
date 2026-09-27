import { test } from "node:test";
import assert from "node:assert/strict";
import { splitsVormBlokken, zonderVormBlokken, vormPaden, ruweWaarde, alsSleutels } from "./vormBlokken.js";

const tpl = `# {{producten.naam}}

{{#vorm image-map producten.CG_laag}}
{ "image": "/x.svg", "areas": [ { "value": "Laag 1", "shape": "rect", "coords": [0, 0, 1, 1] } ] }
{{/vorm}}

Tekst ertussen.
{{vorm chips initiatief_api_standaarden.apistandaard.api_standaard_namen.naam}}
{{#vorm nl-map initiatief_gemeenten}}
{ "codeField": "gemeente.gemeentegegevens.code", "labelField": "gemeente.gemeentegegevens.naam",
  "groups": [ { "label": "Realiseert", "color": "#e11d48", "filter": { "rol": "Realiseert" } } ] }
{{/vorm}}
{{#vorm period}}{ "startPath": "planningen.startdatum", "endPath": "planningen.ready_for_use" }{{/vorm}}
{{#vorm scale-bars bijdragen}}{ kapot }{{/vorm}}`;

test("splitsen in tekst en vormen, met config en foutmelding bij kapotte JSON", () => {
  const s = splitsVormBlokken(tpl);
  assert.deepEqual(s.map((x) => x.soort === "vorm" ? `${x.naam}:${x.pad ?? "-"}` : "T"),
    ["T", "image-map:producten.CG_laag", "T", "chips:initiatief_api_standaarden.apistandaard.api_standaard_namen.naam", "T", "nl-map:initiatief_gemeenten", "T", "period:-", "T", "scale-bars:bijdragen"]);
  assert.equal(s[1].config.areas[0].value, "Laag 1");
  assert.match(s[9].fout, /geen geldige JSON/);
  assert.deepEqual(s[9].config, {});
  assert.ok(!zonderVormBlokken(tpl).includes("vorm"));
  assert.ok(zonderVormBlokken(tpl).includes("Tekst ertussen."));
});

test("vormPaden: pad, Field relatief, Path absoluut, filtervelden van groepen", () => {
  assert.deepEqual(vormPaden(tpl).sort(), [
    "bijdragen",
    "initiatief_api_standaarden.apistandaard.api_standaard_namen.naam",
    "initiatief_gemeenten",
    "initiatief_gemeenten.gemeente.gemeentegegevens.code",
    "initiatief_gemeenten.gemeente.gemeentegegevens.naam",
    "initiatief_gemeenten.rol",
    "planningen.ready_for_use",
    "planningen.startdatum",
    "producten.CG_laag",
  ]);
});

test("ruweWaarde: lijsten blijven lijsten, filters, data overslaan; alsSleutels", () => {
  const ctx = {
    producten: { data: { CG_laag: "Laag 1;Utility" } },
    initiatief_gemeenten: [
      { rol: "Realiseert", gemeente: { gemeentegegevens: [{ code: "GM0344", naam: "Utrecht" }] } },
      { rol: "Maakt gebruik van", gemeente: { gemeentegegevens: [{ code: "GM1959", naam: "Altena" }] } },
    ],
  };
  assert.equal(ruweWaarde(ctx, "producten.data.CG_laag"), "Laag 1;Utility");
  assert.deepEqual(ruweWaarde(ctx, "initiatief_gemeenten[rol=Realiseert].gemeente.gemeentegegevens.code"), ["GM0344"]);
  assert.equal(ruweWaarde(ctx, "initiatief_gemeenten").length, 2);
  assert.equal(ruweWaarde(ctx, "bestaat.niet"), null);
  assert.deepEqual(alsSleutels("Laag 1;Utility"), ["Laag 1", "Utility"]);
  assert.deepEqual(alsSleutels(["a", "b;c"]), ["a", "b", "c"]);
  assert.deepEqual(alsSleutels("Opschaling (draait bij enkele gemeenten, nu op zoek)"), ["Opschaling (draait bij enkele gemeenten, nu op zoek)"], "komma splitst niet");
});

test("cbsGemeentecode: getal, cijfers en GM-code", async () => {
  const { cbsGemeentecode } = await import("./vormBlokken.js");
  assert.equal(cbsGemeentecode(1680), "GM1680");
  assert.equal(cbsGemeentecode("344"), "GM0344");
  assert.equal(cbsGemeentecode("gm0014"), "GM0014");
  assert.equal(cbsGemeentecode(""), null);
});

test("telSleutels: uniek, in volgorde, met aantal", async () => {
  const { telSleutels } = await import("./vormBlokken.js");
  assert.deepEqual(telSleutels(["b", "a", "b"]), [{ sleutel: "b", n: 2 }, { sleutel: "a", n: 1 }]);
});
