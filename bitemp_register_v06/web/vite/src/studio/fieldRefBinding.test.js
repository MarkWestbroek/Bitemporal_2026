// fieldRefBinding.test.js — FieldRef gebonden via de uuid van het modelveld (31-10).
// Run: node --import ./test/register-aliases.mjs --test src/studio/fieldRefBinding.test.js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pickerTypesUitV3 } from "../modelpicker/pickerTypesUitV3.js";
import { bouwModelTree, fieldRefsOpUuid, verversFieldRef } from "../modelpicker/modelTree.js";
import { verversDiep, fieldRefPatches } from "./fieldRefBinding.js";

const CG_TEST = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../diagramprofielen/canoniek-uml/fixtures/cg-test/omnium-model-cg-test-v3.json"), "utf8"));
const UUID = "33333333-3333-4333-8333-333333333333";

/** cg-test met een uuid op het kaartnummer van de GPK. */
function metUuid(veldnaam = "kaartnummer") {
  const v3 = JSON.parse(JSON.stringify(CG_TEST));
  const ge = v3.model.entiteiten.find((e) => e.typenaam === "Gehandicaptenparkeerkaart").gegevenselementen.find((g) => (g.velden || []).some((v) => v.naam === veldnaam));
  const veld = ge.velden.find((v) => v.naam === veldnaam);
  veld.uuid = UUID;
  return { v3, ge, veld };
}

const refVan = (types, uuid) => fieldRefsOpUuid(types).get(uuid);

test("pickerTypesUitV3: zelfde vorm als het register (hub, plumbing, collecties) en de uuid op het veld", () => {
  const { v3, ge } = metUuid();
  const types = pickerTypesUitV3(v3);
  const ent = types.find((t) => t.typenaam === "Gehandicaptenparkeerkaart");
  assert.equal(ent.metatype, "entiteit");
  assert.ok(ent.velden.some((v) => v.naam === "id"));
  assert.ok(ent.velden.some((v) => v.format === "array" && v.type === `Gehandicaptenparkeerkaart_${ge.naam}`));
  const hub = types.find((t) => t.typenaam === `Gehandicaptenparkeerkaart_${ge.naam}`);
  assert.equal(hub.ge_subtype, "hub");
  assert.deepEqual(hub.velden.slice(0, 2).map((v) => v.naam), ["gehandicaptenparkeerkaart_id", "rel_id"]);
  const ref = refVan(types, UUID);
  assert.equal(ref.veldnaam, "kaartnummer");
  assert.equal(ref.uuid, UUID);
  assert.match(ref.veldpad, /^Gehandicaptenparkeerkaart\.[a-z_]+\.kaartnummer$/);
});

test("verversFieldRef: na een hernoeming volgt het naampad de uuid; keuzes in de ref blijven", () => {
  const { v3 } = metUuid();
  const oud = { ...refVan(pickerTypesUitV3(v3), UUID), tDimensie: "materieel" };
  const { v3: hernoemd, veld } = metUuid();
  veld.naam = "pasnummer";
  const index = fieldRefsOpUuid(pickerTypesUitV3(hernoemd));
  const nieuw = verversFieldRef(oud, index);
  assert.equal(nieuw.veldnaam, "pasnummer");
  assert.match(nieuw.veldpad, /\.pasnummer$/);
  assert.equal(nieuw.tDimensie, "materieel", "eigen keuze van de ref blijft");
  assert.equal(verversFieldRef(nieuw, index), nieuw, "niets veranderd = dezelfde ref");
});

test("verversFieldRef: zonder uuid of met een onbekende uuid blijft de ref gelijk", () => {
  const index = fieldRefsOpUuid(pickerTypesUitV3(CG_TEST));
  const zonder = { veldpad: "A.b.c", veldnaam: "c" };
  assert.equal(verversFieldRef(zonder, index), zonder);
  const onbekend = { veldpad: "A.b.c", veldnaam: "c", uuid: "nergens" };
  assert.equal(verversFieldRef(onbekend, index), onbekend);
});

test("fieldRefPatches: een DMN-beslistabel in element-data krijgt het nieuwe naampad", () => {
  const { v3 } = metUuid();
  const ref = refVan(pickerTypesUitV3(v3), UUID);
  const state = {
    elements: {
      d1: { id: "d1", elementType: "decision", data: { beslistabel: { inputs: [{ id: "in1", naam: "kaart", fieldRef: ref }, { id: "in2", fieldRef: { veldpad: "envelop:bsn", veldnaam: "bsn" } }] }, iets: 1 } },
      d2: { id: "d2", elementType: "decision", data: { beslistabel: { inputs: [] } } },
    },
  };
  const { v3: hernoemd, veld } = metUuid();
  veld.naam = "pasnummer";
  const patches = fieldRefPatches(state, fieldRefsOpUuid(pickerTypesUitV3(hernoemd)));
  assert.deepEqual(Object.keys(patches), ["d1"]);
  assert.deepEqual(Object.keys(patches.d1.data), ["beslistabel"]);
  const inputs = patches.d1.data.beslistabel.inputs;
  assert.equal(inputs[0].fieldRef.veldnaam, "pasnummer");
  assert.equal(inputs[1], state.elements.d1.data.beslistabel.inputs[1], "een ref zonder uuid blijft hetzelfde object");
});

test("verversDiep: een bericht in lokale state (velden[].ref)", () => {
  const { v3 } = metUuid();
  const bericht = { naam: "B", velden: [{ ref: refVan(pickerTypesUitV3(v3), UUID), verplicht: true }] };
  const { v3: hernoemd, veld } = metUuid();
  veld.naam = "pasnummer";
  const uit = verversDiep(bericht, fieldRefsOpUuid(pickerTypesUitV3(hernoemd)));
  assert.notEqual(uit, bericht);
  assert.equal(uit.velden[0].ref.veldnaam, "pasnummer");
  assert.equal(uit.velden[0].verplicht, true);
  assert.equal(verversDiep(uit, fieldRefsOpUuid(pickerTypesUitV3(hernoemd))), uit);
});

test("bouwModelTree op de Studio-types: zelfde boom als uit de API-vorm (domeinen, entiteiten)", () => {
  const tree = bouwModelTree(pickerTypesUitV3(CG_TEST));
  assert.ok(tree.some((d) => d.naam === "parkeren"));
  assert.ok(tree.find((d) => d.naam === "parkeren").entiteiten.some((e) => e.type.typenaam === "Gehandicaptenparkeerkaart"));
});
