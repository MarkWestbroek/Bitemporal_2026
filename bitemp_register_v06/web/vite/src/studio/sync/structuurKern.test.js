import test from "node:test";
import assert from "node:assert/strict";
import { zonderWeesPlaatsingen, maakStructuurStore } from "./structuurKern.js";
import { structuurNet } from "./operaties.js";

test("zonderWeesPlaatsingen: wezen van bekende profielen weg, de rest ongemoeid en op volgorde", () => {
  const plaatsing = {
    "usecase05::d1": "m1",
    "el::usecase05::uc_weg": "m1", // element verwijderd via het canvas
    "el::usecase05::uc_er": "m1",
    "usecase05::d_weg": "m2", // diagram bestaat niet meer
    "el::onbekend::x": "m2", // profiel van een andere branch: niet te beoordelen
    "el::leeg::y": "m2", // bekend maar leeg profiel: wees
  };
  const inhoud = { usecase05: { elements: { uc_er: {} }, diagrams: { d1: {} } } };
  const { plaatsing: uit, weggelaten } = zonderWeesPlaatsingen(plaatsing, inhoud, new Set(["usecase05", "leeg"]));
  assert.deepEqual(Object.keys(uit), ["usecase05::d1", "el::usecase05::uc_er", "el::onbekend::x"]);
  assert.deepEqual(weggelaten.sort(), ["el::leeg::y", "el::usecase05::uc_weg", "usecase05::d_weg"]);
});

test("gedeelde diagrambundels (06-11): het vangnet maakt er patchStructuur van, de kern speelt hem na", () => {
  const b1 = { id: "b1", naam: "Overzicht", tabs: [{ profielId: "diagram05", diagramId: "d1" }], volgorde: 1 };
  const voor = { mappen: {}, plaatsing: {}, bundels: {} };
  const na = { mappen: {}, plaatsing: {}, bundels: { b1 } };
  const ops = structuurNet(voor, na);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].op, "patchStructuur");
  assert.deepEqual(ops[0].args[0].zetBundels, { b1 });
  assert.deepEqual(ops[0].args[0].wisBundels, []);
  // Zonder bundel-wijziging geen bundel-velden in de patch (oude ontvangers merken niets).
  const alleenMap = structuurNet(voor, { ...voor, mappen: { m: { id: "m", naam: "M" } } });
  assert.equal("zetBundels" in alleenMap[0].args[0], false);

  const kern = maakStructuurStore();
  kern.getState().patchStructuur(ops[0].args[0]);
  assert.deepEqual(kern.getState().bundels, { b1 });
  kern.getState().patchStructuur(structuurNet(na, voor)[0].args[0]);
  assert.deepEqual(kern.getState().bundels, {});
  kern.getState().laadStructuur({ mappen: {}, plaatsing: {}, bundels: { b1 } });
  assert.deepEqual(kern.getState().bundels, { b1 });
});
