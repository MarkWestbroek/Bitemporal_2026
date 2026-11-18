// indeling.test.js — de UML-indeling van een metamodel-eigenschap (indeling.js): de regel zelf, en
// dat het M3 en het projectmetamodel er volledig mee in te delen zijn.
import test from "node:test";
import assert from "node:assert/strict";

import { indelingVan, typeSoortVan } from "./indeling.js";
import { M3_KLASSEN, M3_ENUMERATIES } from "../../diagramcore/types/m3.js";
import { PROJECT_KLASSEN, PROJECT_ENUMERATIES } from "../projectMetamodel.js";

const MODEL = {
  klassen: [
    { naam: "A", pakket: "P", soort: "klasse", eigenschappen: [] },
    { naam: "B", pakket: "P", soort: "klasse", eigenschappen: [] },
    { naam: "D", pakket: "P", soort: "datatype", eigenschappen: [] },
  ],
  enumeraties: [{ naam: "E", pakket: "P", waarden: ["x"] }],
};
const [A, , D] = MODEL.klassen;
const eig = (type, extra = {}) => ({ naam: "e", type, kard: "0..1", ...extra });

test("typeSoortVan: klasse, datatype, enumeratie, anders primitief", () => {
  assert.equal(typeSoortVan(MODEL, "A"), "klasse");
  assert.equal(typeSoortVan(MODEL, "D"), "datatype");
  assert.equal(typeSoortVan(MODEL, "E"), "enumeratie");
  assert.equal(typeSoortVan(MODEL, "string"), "primitief");
});

test("indelingVan: de regel", () => {
  assert.equal(indelingVan(MODEL, A, eig("B")), "associatie");
  assert.equal(indelingVan(MODEL, A, eig("B", { samenstelling: true })), "samenstelling");
  assert.equal(indelingVan(MODEL, A, eig("string", { operatie: true })), "operatie");
  assert.equal(indelingVan(MODEL, A, eig("B", { operatie: true })), "operatie");
  for (const t of ["string", "E", "D"]) assert.equal(indelingVan(MODEL, A, eig(t)), "attribuut", t);
  // Een datatype heeft geen identiteit: ook met een klasse als type een attribuut.
  assert.equal(indelingVan(MODEL, D, eig("B")), "attribuut");
  // Een datatype als deel is een waarde: ook met samenstelling een attribuut.
  assert.equal(indelingVan(MODEL, A, eig("D", { samenstelling: true })), "attribuut");
});

test("het M3 en het projectmetamodel: elke eigenschap krijgt een indeling, samenstelling alleen tussen klassen", () => {
  for (const model of [{ klassen: M3_KLASSEN, enumeraties: M3_ENUMERATIES }, { klassen: PROJECT_KLASSEN, enumeraties: PROJECT_ENUMERATIES }]) {
    const telling = { operatie: 0, samenstelling: 0, associatie: 0, attribuut: 0 };
    for (const k of model.klassen) {
      for (const e of k.eigenschappen) {
        const i = indelingVan(model, k, e);
        telling[i]++;
        // samenstelling: tussen klassen een compositie, met een datatype als deel een attribuut (waarde).
        if (e.samenstelling && !e.operatie) {
          const verwacht = k.soort === "klasse" && typeSoortVan(model, e.type) === "klasse" ? "samenstelling" : "attribuut";
          assert.equal(i, verwacht, `${k.naam}.${e.naam}`);
          if (verwacht === "attribuut") assert.equal(typeSoortVan(model, e.type), "datatype", `${k.naam}.${e.naam}: samenstelling met een ${typeSoortVan(model, e.type)}`);
        }
      }
    }
    for (const [soort, n] of Object.entries(telling)) if (soort !== "operatie" || model.klassen === M3_KLASSEN) assert.ok(n > 0, soort);
  }
});
