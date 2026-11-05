/**
 * Tests voor het ob-object-ShapeType (plan 2026-11-04 Eén tekenaar, stap 4).
 * Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/object/vormen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { OBJECT_SHAPETYPES, objectKop } from "./vormen.js";
import { tekenbareVorm } from "../../diagramcore/types/shapeType.js";
import { bouwVoorkomen, tekenVoorkomen, basisVanPalet } from "../../diagramcore/tekenaar/voorkomen.js";
import { zetHost, _resetHostVoorTests } from "../../diagramcore/tekenaar/host.js";
import { maakPalet } from "../../diagramsvg/thema.js";

const basis = basisVanPalet(maakPalet("light"));
const ET = { id: "object", shape: "ob-object", kleur: "#fef9c3", compartments: [{ id: "slots", label: null, fieldType: "slot" }], hooks: { naamWeergave: objectKop } };
const FT = { slot: { id: "slot", viewer: "naam-type" } };
const teken = (element, elementType = ET) => {
  const vormInfo = tekenbareVorm("ob-object");
  assert.ok(vormInfo);
  const box = bouwVoorkomen({ element, elementType, ...vormInfo, basis, idPrefix: "a", fieldTypesById: FT, compartmentTypesById: { slots: { id: "slots", label: null } } });
  const uit = tekenVoorkomen(box, { controleer: true });
  assert.deepEqual(uit.fouten, []);
  return { box, ...uit, teksten: uit.inhoud.kinderen.filter((k) => k.tag === "text") };
};

test("objectKop: naam : Klasse [toestand]; klasse via de host (instantieVan) of klassifierLabel; anoniem = ': Klasse'", () => {
  assert.equal(objectKop({ naam: "jan", data: { klassifierLabel: "Persoon" } }), "jan : Persoon");
  assert.equal(objectKop({ naam: "", data: { klassifierLabel: "Persoon", toestand: "[actief]" } }), " : Persoon [actief]");
  assert.equal(objectKop({ naam: "jan", data: {} }), "jan");
  assert.equal(objectKop({ naam: "", data: {} }), "(object)");
  const ref = { profielId: "puur-uml", elementId: "k1" };
  assert.equal(objectKop({ naam: "jan", data: { instantieVan: ref, klassifierLabel: "Oud" } }, { verwijzingLabel: (r) => (r === ref ? "Klant" : null) }), "jan : Klant", "de host wint");
  assert.equal(objectKop({ naam: "jan", data: { instantieVan: ref, klassifierLabel: "Oud" } }, { verwijzingLabel: () => null }), "jan : Oud", "host kent het doel niet → label");
  assert.equal(objectKop({ naam: "jan", data: { instantieVan: ref, klassifierLabel: "Oud" } }), "jan : Oud", "zonder host (server) → label");
});

test("object: kop onderstreept als weergavenaam, slots als 'attribuut = waarde'; multi-object = binnenlijn", () => {
  for (const st of OBJECT_SHAPETYPES) assert.ok(tekenbareVorm(st.id), st.id);
  const element = { id: "o", naam: "jan", elementType: "object", data: { klassifierLabel: "Persoon" }, compartimenten: [{ compartmentType: "slots", velden: [{ fieldType: "slot", naam: "leeftijd", data: { typeLabel: "42" } }] }] };
  const o = teken(element);
  assert.equal(o.omtrek.tag, "rect");
  assert.equal(o.omtrek.attrs.fill, "#fef9c3");
  const kop = o.teksten.find((k) => k.attrs["data-dc-naam"] !== undefined);
  assert.equal(kop.kinderen[0], "jan : Persoon");
  assert.equal(kop.attrs["text-decoration"], "underline");
  assert.ok(o.teksten.some((k) => k.kinderen[0] === "leeftijd"));
  assert.ok(o.teksten.some((k) => k.kinderen[0] === "= 42"), "typePrefix '= '");
  const multi = teken(element, { ...ET, id: "multiobject", randDikte: 3 });
  assert.equal(multi.omtrek.tag, "g");
  assert.equal(multi.omtrek.kinderen.length, 2, "buiten- en binnenlijn");
});

test("op het canvas levert de host de klasse uit het andere profiel", () => {
  try {
    zetHost({ verwijzingLabel: (ref) => (ref?.elementId === "k1" ? "Klant" : null) });
    const o = teken({ id: "o", naam: "jan", elementType: "object", data: { instantieVan: { profielId: "p", elementId: "k1" } }, compartimenten: [] });
    assert.equal(o.teksten.find((k) => k.attrs["data-dc-naam"] !== undefined).kinderen[0], "jan : Klant");
  } finally {
    _resetHostVoorTests();
  }
});
