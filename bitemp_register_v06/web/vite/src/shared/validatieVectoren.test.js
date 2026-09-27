/**
 * De JS-kant van de gedeelde validatie-testset (testdata/validatie/vectoren.json), tegen de
 * momentopname van de datatypes (testdata/validatie/datatypes.json, bijgehouden door de Go-test
 * model/validatie_vectoren_test.go). Zelfde gevallen als in Go: "één regel in het model, overal
 * dezelfde uitkomst" (ontwerp "Invoersoort en vorm" §9d).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { zetDatatypes, datatypeMelding } from "./datatypeValidatie.js";
import { beschikbareFuncties } from "../umleditor/validatie/regels.js";
import { normaliseer } from "../umleditor/validatie/normaliseer.js";

const map = new URL("../../../../testdata/validatie/", import.meta.url);
const lees = (naam) => JSON.parse(readFileSync(fileURLToPath(new URL(naam, map)), "utf-8"));
const datatypes = lees("datatypes.json");
const vectoren = lees("vectoren.json");
zetDatatypes(datatypes);

const geldig = [
  ...vectoren.geldig,
  ...datatypes.flatMap((d) => (d.validatie?.voorbeelden || []).map((waarde) => ({ datatype: d.naam, waarde }))),
];

test(`geldig: de voorbeelden uit het model en de vaste gevallen (${geldig.length})`, () => {
  const fout = geldig.map((g) => [g, datatypeMelding(g.waarde, { datatype: g.datatype })]).filter(([, m]) => m);
  assert.deepEqual(fout.map(([g, m]) => `${g.datatype} ${g.waarde}: ${m}`), []);
});

test(`ongeldig (${vectoren.ongeldig.length})`, () => {
  const doorgelaten = vectoren.ongeldig.filter((o) => !datatypeMelding(o.waarde, { datatype: o.datatype }));
  assert.deepEqual(doorgelaten.map((o) => `${o.datatype} ${o.waarde} (${o.waarom})`), []);
});

test("normalisatie: zelfde uitkomst als de Go-kant (model/normalisatie.go)", () => {
  const perNaam = Object.fromEntries(datatypes.map((d) => [d.naam, d]));
  const fout = (vectoren.normalisatie || []).map((n) => {
    const spec = n.datatype ? perNaam[n.datatype]?.normalisatie : n.spec;
    const uit = normaliseer(n.waarde, spec || "");
    return uit === n.verwacht ? null : `${n.spec || n.datatype} ${JSON.stringify(n.waarde)} → ${JSON.stringify(uit)}, verwacht ${JSON.stringify(n.verwacht)}`;
  }).filter(Boolean);
  assert.deepEqual(fout, []);
});

test("elke function-regel uit het model is ook in JS bekend (anders alleen op de server)", () => {
  const nodig = new Set(datatypes.flatMap((d) => (d.validatie?.regels || []).filter((r) => r.type === "function").map((r) => r.expressie)));
  const bekend = new Set(beschikbareFuncties());
  assert.deepEqual([...nodig].filter((n) => !bekend.has(n)), []);
});
