import test from "node:test";
import assert from "node:assert/strict";
import { zonderWeesPlaatsingen } from "./structuurKern.js";

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
