// reflijstVeld.test.js — een veld dat een referentielijst gebruikt (plan "Referentielijst-instanties —
// richting, binding en domein" §8, besluit Mark 07/08-11): `$ref` noemt de items-relatie
// (LandenlijstLand: Land → Referentielijst), als overgang mag hij de item-entiteit noemen (Gemeente).
// Het demo-model np-loc heeft beide (Adres.land en Adres.gemeente).
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/canoniek-uml/reflijstVeld.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { v3ModelNaarStore, storeNaarV3Model } from "../../store/adapters.js";
import { vanCanoniekModel, naarCanoniekModel } from "./adapter.js";
import { canoniekUmlDiagramType, isRefLijstItems, controleerItemsRichting } from "./index.js";
import { synchroniseerGebruik, herstelRefTypeLabels } from "./afgeleideConnectoren.js";

const hier = path.dirname(fileURLToPath(import.meta.url));
const map = path.resolve(hier, "../../../../../model/json/model v3");
const bestand = readdirSync(map).find((f) => f.startsWith("demo np-loc-org+geo v1.0") && f.endsWith(".json"));
const demo = JSON.parse(readFileSync(path.join(map, bestand), "utf8"));

const kern = () => vanCanoniekModel(v3ModelNaarStore(structuredClone(demo)));
const opNaam = (elements, naam) => Object.values(elements).find((e) => e.naam === naam);
const veldVan = (el, naam) => el.compartimenten.flatMap((c) => c.velden || []).find((v) => v.naam === naam);
const metLabel = (core, elNaam, veldNaam, label) => {
  const el = opNaam(core.elements, elNaam);
  const compartimenten = el.compartimenten.map((c) => ({ ...c, velden: (c.velden || []).map((v) => (v.naam === veldNaam ? { ...v, data: { ...v.data, typeLabel: label } } : v)) }));
  return { ...core, elements: { ...core.elements, [el.id]: { ...el, compartimenten } } };
};
/** Het V3-veld na de terugreis. */
const v3Veld = (core, veldNaam) => {
  const v3 = storeNaarV3Model(naarCanoniekModel(core));
  const model = v3.model || v3;
  for (const e of model.entiteiten) for (const g of e.gegevenselementen || []) for (const v of g.velden || []) if (v.naam === veldNaam) return v;
  return null;
};

test("heenreis: een $ref-veld toont de naam van de items-relatie (of het item), niet 'integer'", () => {
  const core = kern();
  const adres = opNaam(core.elements, "Adres");
  assert.equal(veldVan(adres, "land").data.typeLabel, "LandenlijstLand");
  assert.equal(veldVan(adres, "gemeente").data.typeLabel, "Gemeente");
  assert.ok(isRefLijstItems(opNaam(core.elements, "LandenlijstLand")));
});

test("terugreis: $ref naar een REL blijft heel; omhangen naar een andere REL; het oude label 'integer' raakt niets", () => {
  const core = kern();
  assert.equal(v3Veld(core, "land")["$ref"], "LandenlijstLand");
  assert.equal(v3Veld(core, "gemeente")["$ref"], "Gemeente");
  // Omhangen naar een andere items-relatie: $ref volgt, het veld is integer (het item-id).
  const om = v3Veld(metLabel(core, "Adres", "land", "AdellijkeTitelsTitel"), "land");
  assert.equal(om["$ref"], "AdellijkeTitelsTitel");
  // Een project van vóór 08-11 heeft nog het label "integer": dat is "niet aangeraakt".
  assert.equal(v3Veld(metLabel(core, "Adres", "land", "integer"), "land")["$ref"], "LandenlijstLand");
  // Echt een ander type kiezen haalt de verwijzing weg.
  assert.equal(v3Veld(metLabel(core, "Adres", "land", "string"), "land")["$ref"], undefined);
});

test("kiezer: de groep Referentielijsten biedt de items-relaties aan, vóór de item-entiteiten", () => {
  const core = kern();
  const { referenceResolvers, fieldTypes } = canoniekUmlDiagramType;
  const refs = fieldTypes.find((f) => f.id === "attribuut").properties.find((p) => p.key === "typeLabel").referenceTypes;
  assert.ok(refs.indexOf("reflijst") >= 0 && refs.indexOf("reflijst") < refs.indexOf("refitem"));
  const lijst = referenceResolvers.reflijst({ elements: core.elements });
  const land = lijst.find((k) => k.waarde === "LandenlijstLand");
  assert.ok(land, "LandenlijstLand staat erin");
  // Het label noemt het item, in welke richting de relatie ook loopt (het demo-model: lijst → item).
  assert.equal(land.label, "LandenlijstLand (items: Land)");
  assert.equal(land.groep, "Referentielijsten");
  assert.ok(!lijst.some((k) => k.waarde === "Land"), "geen item-entiteiten in deze groep");
  assert.ok(referenceResolvers.refitem({ elements: core.elements }).some((k) => k.waarde === "Gemeente"));
});

test("«gebruikt»: van het veld naar de items-relatie (afgeleid en handmatig)", () => {
  const core = kern();
  const adres = opNaam(core.elements, "Adres");
  const rel = opNaam(core.elements, "LandenlijstLand");
  const uit = synchroniseerGebruik(core) || core;
  assert.ok(Object.values(uit.elements).some((c) => c.elementType === "gebruik" && c.source === adres.id && c.target === rel.id));
  const gebruik = canoniekUmlDiagramType.elementTypes.find((t) => t.id === "gebruik");
  assert.equal(gebruik.hooks.magVerbinden(adres, rel), true);
  const gewoneRel = Object.values(core.elements).find((e) => e.elementType === "relatie" && !isRefLijstItems(e));
  if (gewoneRel) assert.equal(gebruik.hooks.magVerbinden(adres, gewoneRel), false);
});

test("migratie: een bestaand project met het label 'integer' krijgt de verwijzingsnaam; idempotent", () => {
  const oud = metLabel(kern(), "Adres", "land", "integer");
  const uit = herstelRefTypeLabels(oud);
  assert.equal(veldVan(opNaam(uit.elements, "Adres"), "land").data.typeLabel, "LandenlijstLand");
  assert.equal(herstelRefTypeLabels(uit), null);
  // Een label dat de modelleur zelf koos, blijft.
  assert.equal(herstelRefTypeLabels(metLabel(kern(), "Adres", "land", "string")), null);
});

test("verbindingsregel: een items-relatie loopt van het item naar de referentielijst", () => {
  const core = kern();
  const rel = opNaam(core.elements, "LandenlijstLand");
  const ctx = { elements: core.elements };
  const bron = core.elements[rel.source];
  const doel = core.elements[rel.target];
  // Het demo-model is van vóór het besluit (lijst → item): dan de melding "draai om".
  assert.equal(bron.data.entiteitSubtype, "referentielijst");
  assert.equal(doel.data.entiteitSubtype, "referentielijst_item");
  assert.match(controleerItemsRichting(rel, ctx), /andersom/);
  // De goede richting (item → lijst): geen melding; het element-type valideert hem ook zo.
  const goed = { ...rel, source: rel.target, target: rel.source };
  assert.equal(controleerItemsRichting(goed, ctx), null);
  // Tussen item en lijst maar zonder dat subtype (Mark 08-11, ModuleType): zet het subtype.
  assert.match(controleerItemsRichting({ ...rel, data: { ...rel.data, relatieSubtype: "" } }, ctx), /subtype op referentielijst_items/);
  // Een relatie tussen gewone entiteiten: geen melding.
  const gewoon = Object.values(core.elements).find((e) => e.elementType === "relatie" && !isRefLijstItems(e));
  if (gewoon) assert.equal(controleerItemsRichting(gewoon, ctx), null);
});
