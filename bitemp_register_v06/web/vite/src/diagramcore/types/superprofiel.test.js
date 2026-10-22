// superprofiel.test.js — notitie, constraint, notitielijn en diagramverwijzing in elk profiel (M3, 20-10).
// Run: node --import ./test/register-aliases.mjs --test src/diagramcore/types/superprofiel.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { vulSuperprofielAan, migreerHernoemdeTypen, maakSuperprofielElement, SUPERPROFIEL_IDS } from "./superprofiel.js";
import { valideerDiagramType } from "./typeRegistry.js";

const profiel = (extra = {}) => ({
  id: "t", label: "T", style: "uml-klassiek",
  elementTypes: [
    { id: "klasse", label: "Klasse", shape: "class-box" },
    { id: "abstract", label: "A", shape: "class-box", isAbstract: true },
    { id: "rel", label: "Rel", shape: "edge", isConnector: true, bron: { elementTypes: ["klasse"] }, doel: { elementTypes: ["klasse"] } },
  ],
  ...extra,
});
const type = (dt, id) => dt.elementTypes.find((e) => e.id === id);

test("elk profiel erft de vier typen; de lijn wijst naar elke concrete knoop", () => {
  const dt = profiel();
  assert.deepEqual(vulSuperprofielAan(dt), []);
  for (const id of SUPERPROFIEL_IDS) assert.ok(type(dt, id), id);
  assert.deepEqual(type(dt, "notitielijn").doel.elementTypes.sort(), ["constraint", "diagramverwijzing", "klasse", "notitie"]);
  assert.deepEqual(type(dt, "notitielijn").bron.elementTypes, ["notitie", "constraint"]);
  assert.equal(type(dt, "notitielijn").aard, "annotatie");
  const n = dt.elementTypes.length;
  vulSuperprofielAan(dt);
  assert.equal(dt.elementTypes.length, n, "idempotent");
});

test("notitie en notitielijn: de superprofielversie wint; een eigen constraint blijft (specialisatie)", () => {
  const dt = profiel();
  dt.elementTypes.push(
    { id: "notitie", label: "Oud", shape: "note", handleStijl: "onzichtbaar" },
    { id: "notitielijn", label: "Oud", isConnector: true, bron: { elementTypes: ["notitie"] }, doel: { elementTypes: ["klasse"] } },
    { id: "constraint", label: "ArchiMate Constraint", shape: "archimate-box" },
  );
  vulSuperprofielAan(dt);
  assert.equal(type(dt, "notitie").handleStijl, undefined, "superprofielversie");
  assert.ok(type(dt, "notitielijn").doel.elementTypes.includes("constraint"));
  assert.equal(type(dt, "constraint").shape, "archimate-box", "profielvariant blijft");
  assert.equal(dt.elementTypes.filter((e) => e.id === "notitie").length, 1);
});

test("alleen het palet mag uit; weghalen of andere sleutels zijn een fout", () => {
  const dt = profiel({ superprofiel: { constraint: { inPalet: false } } });
  assert.deepEqual(vulSuperprofielAan(dt), []);
  assert.equal(type(dt, "constraint").inPalet, false);
  const fout = vulSuperprofielAan(profiel({ superprofiel: { notitie: { weg: true }, onzin: {} } })).join("\n");
  assert.match(fout, /alleen inPalet mag/);
  assert.match(fout, /geen type "onzin"/);
  assert.ok(valideerDiagramType(profiel({ superprofiel: { onzin: {} } })).some((m) => /geen type "onzin"/.test(m)), "registratie controleert mee");
  assert.deepEqual(valideerDiagramType(profiel()), [], "een gewoon profiel valideert met het superprofiel erbij");
});

test("migratie: hernoemde typen (ArchiMate toelichting → notitielijn)", () => {
  const uit = migreerHernoemdeTypen({ a: { id: "a", elementType: "toelichting" }, b: { id: "b", elementType: "klasse" } }, { toelichting: "notitielijn" });
  assert.equal(uit.a.elementType, "notitielijn");
  assert.equal(uit.b.elementType, "klasse");
  assert.equal(migreerHernoemdeTypen({ b: { id: "b", elementType: "klasse" } }, { toelichting: "notitielijn" }), null);
  assert.equal(migreerHernoemdeTypen({}, undefined), null);
});

test("maakSuperprofielElement: terugval voor typen die het profiel niet kent", () => {
  assert.deepEqual(maakSuperprofielElement("constraint").data, { specificatie: "" });
  assert.equal(maakSuperprofielElement("diagramverwijzing").elementType, "diagramverwijzing");
  assert.equal(maakSuperprofielElement("notitielijn"), null, "een lijn trek je");
  assert.equal(maakSuperprofielElement("klasse"), null);
});
