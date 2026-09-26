import { test } from "node:test";
import assert from "node:assert/strict";
import { matrixAssen, matrixRijen, zetMatrixCel, zetMatrixExtra, ontbrekendeRijen } from "./matrix.js";

const defs = {
  type_bijdrage: { naam: "type_bijdrage", enum: ["Wendbaarheid", "Dienstverlening", "Regie"] },
  schaal: { naam: "schaal", enum: ["Schaal 1", "Schaal 2", "Schaal 3", "Schaal 4"], verplicht: true },
  toelichting: { naam: "toelichting" },
};
const zoek = (n) => defs[n];
const lijst = {
  type: "lijst", bron: "Initiatief.bijdragen", vorm: "rating-grid",
  elementen: [{ type: "veld", veld: "type_bijdrage" }, { type: "veld", veld: "schaal", label: "Schaal" }, { type: "veld", veld: "toelichting" }],
};

test("assen afgeleid uit het sjabloon en de enums", () => {
  const a = matrixAssen(lijst, zoek);
  assert.equal(a.rowField, "type_bijdrage");
  assert.equal(a.columnField, "schaal");
  assert.deepEqual(a.rows.map((r) => r.value), ["Wendbaarheid", "Dienstverlening", "Regie"]);
  assert.equal(a.columns.length, 4);
  assert.deepEqual(a.extra.map((e) => e.veld), ["toelichting"]);
  assert.equal(a.columnElement.label, "Schaal");
  assert.equal(a.required, true, "kolomveld verplicht → matrix verplicht");
  assert.deepEqual(a.fouten, []);
});

test("vormConfig: eigen rijen/kolommen met labels en kleuren; vaste waarden tellen niet als as", () => {
  const a = matrixAssen({
    ...lijst,
    elementen: [{ type: "veld", veld: "soort", vasteWaarde: "x" }, ...lijst.elementen],
    vormConfig: { rows: ["Regie", { value: "Wendbaarheid", description: "snel kunnen veranderen" }],
      columns: [{ value: "Schaal 1", label: "1 · klein", color: "#fde68a" }, "Schaal 5"], required: false },
  }, zoek);
  assert.equal(a.rowField, "type_bijdrage");
  assert.deepEqual(a.rows, [{ value: "Regie", label: "Regie" }, { value: "Wendbaarheid", label: "Wendbaarheid", description: "snel kunnen veranderen" }]);
  assert.deepEqual(a.columns[0], { value: "Schaal 1", label: "1 · klein", color: "#fde68a" });
  assert.equal(a.required, false);
  assert.deepEqual(a.fouten, ['matrix: kolom "Schaal 5" hoort niet bij schaal']);
});

test("zonder enum en zonder config: fout, geen crash", () => {
  const a = matrixAssen({ type: "lijst", elementen: [{ type: "veld", veld: "a" }, { type: "veld", veld: "b" }] });
  assert.equal(a.fouten.length, 2);
  assert.deepEqual(matrixAssen({ type: "lijst", elementen: [] }).fouten, ["matrix zonder rijveld", "matrix zonder kolomveld"]);
});

test("cel kiezen: nieuwe rij, bijwerken op dezelfde rij, andere lijsten ongemoeid", () => {
  const ander = { soort: "anders", type_bijdrage: "Regie", schaal: "Schaal 2" }; // valt buiten eigenIdx
  let alle = [ander];
  alle = zetMatrixCel(alle, [], {}, "type_bijdrage", "schaal", "Regie", "Schaal 3");
  assert.deepEqual(alle, [ander, { type_bijdrage: "Regie", schaal: "Schaal 3" }]);
  const rij = alle[1];
  alle = zetMatrixCel(alle, [1], {}, "type_bijdrage", "schaal", "Regie", "Schaal 4");
  assert.deepEqual(alle[1], { ...rij, schaal: "Schaal 4" });
  assert.equal(alle.length, 2, "geen extra rij");
});

test("wissen: lege rij verdwijnt, rij met toelichting blijft", () => {
  let alle = [{ type_bijdrage: "Regie", schaal: "Schaal 1" }];
  assert.deepEqual(zetMatrixCel(alle, [0], {}, "type_bijdrage", "schaal", "Regie", ""), []);
  alle = [{ type_bijdrage: "Regie", schaal: "Schaal 1", toelichting: "omdat" }];
  assert.deepEqual(zetMatrixCel(alle, [0], {}, "type_bijdrage", "schaal", "Regie", ""), [{ type_bijdrage: "Regie", schaal: "", toelichting: "omdat" }]);
  assert.deepEqual(zetMatrixCel([], [], {}, "type_bijdrage", "schaal", "Regie", ""), [], "niets te wissen");
});

test("extra veld zet of maakt de rij; vaste waarden gaan mee", () => {
  const vast = { bron: "form" };
  let alle = zetMatrixExtra([], [], vast, "type_bijdrage", "Regie", "toelichting", "tekst");
  assert.deepEqual(alle, [{ bron: "form", type_bijdrage: "Regie", toelichting: "tekst" }]);
  alle = zetMatrixCel(alle, [0], vast, "type_bijdrage", "schaal", "Regie", "Schaal 2");
  assert.deepEqual(alle, [{ bron: "form", type_bijdrage: "Regie", toelichting: "tekst", schaal: "Schaal 2" }]);
  assert.deepEqual(zetMatrixExtra([], [], vast, "type_bijdrage", "Regie", "toelichting", ""), []);
});

test("matrixRijen en ontbrekende rijen", () => {
  const alle = [{ type_bijdrage: "Regie", schaal: "Schaal 1" }, { type_bijdrage: "Regie", schaal: "Schaal 4" }, { type_bijdrage: "Wendbaarheid" }];
  const rijen = matrixRijen(alle, [0, 1, 2], "type_bijdrage");
  assert.equal(rijen.Regie.idx, 0, "eerste voorkomen wint");
  const rows = matrixAssen(lijst, zoek).rows;
  assert.deepEqual(ontbrekendeRijen(rows, rijen, "schaal"), ["Wendbaarheid", "Dienstverlening"]);
});
