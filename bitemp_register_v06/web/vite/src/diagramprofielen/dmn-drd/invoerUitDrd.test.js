import test from "node:test";
import assert from "node:assert/strict";
import { bronnenVan, metInvoerUitDrd, zonderKolom, invoerMeldingen } from "./invoerUitDrd.js";

const pijl = (id, source, target) => ({ id, elementType: "infoReq", source, target });
const DRD = () => ({
  top: { id: "top", naam: "Top", elementType: "decision", data: {} },
  onder: { id: "onder", naam: "Onderliggend", elementType: "decision", data: { beslistabel: { inputs: [], outputs: [{ id: "o1", naam: "categorie", type: "string", enum: ["laag", "hoog"] }], rules: [] } } },
  a: { id: "a", naam: "naam", elementType: "inputData", data: { gegeven: { profielId: "cm", elementId: "ge1", veldNaam: "langeNaam", uuid: "u-1" } } },
  b: { id: "b", naam: "geboortedatum", elementType: "inputData", data: {} },
  c: { id: "c", naam: "inkomen", elementType: "inputData", data: {} },
  p1: pijl("p1", "a", "onder"),
  p2: pijl("p2", "b", "onder"),
  p3: pijl("p3", "onder", "top"),
  p4: pijl("p4", "c", "top"),
  k1: { id: "k1", elementType: "knowReq", source: "a", target: "top" },
});
const LEEG = { naam: "T", hitPolicy: "UNIQUE", inputs: [], outputs: [], rules: [{ id: "r1", inputEntries: {}, outputEntries: {} }] };

test("bronnenVan: invoergegevens en vereiste beslissingen, alleen via information requirements", () => {
  const onder = bronnenVan(DRD(), "onder");
  assert.deepEqual(onder.map((b) => [b.soort, b.naam]), [["invoer", "geboortedatum"], ["invoer", "naam"]]);
  const top = bronnenVan(DRD(), "top");
  assert.deepEqual(top.map((b) => [b.soort, b.naam]), [["invoer", "inkomen"], ["beslissing", "Onderliggend"]]);
  assert.deepEqual(top[1].enum, ["laag", "hoog"]);
  assert.equal(top[1].uitvoerId, "o1");
});

test("bronnenVan: meer uitvoer geeft een kolom per uitvoer; geen tabel één kolom", () => {
  const els = DRD();
  els.onder.data.beslistabel.outputs.push({ id: "o2", naam: "korting" });
  assert.deepEqual(bronnenVan(els, "top").filter((b) => b.soort === "beslissing").map((b) => b.naam), ["Onderliggend.categorie", "Onderliggend.korting"]);
  delete els.onder.data.beslistabel;
  const zonder = bronnenVan(els, "top").find((b) => b.soort === "beslissing");
  assert.equal(zonder.naam, "Onderliggend");
  assert.equal(zonder.uitvoerId, undefined);
});

test("metInvoerUitDrd: kolommen erbij, met de FieldRef van het invoergegeven; daarna stabiel", () => {
  const ref = { uuid: "u-1", veldpad: "NP.naam.langeNaam", veldnaam: "langeNaam", type: "string", datatype: "", enum: [] };
  const los = (g) => (g?.uuid === "u-1" ? ref : null);
  const t = metInvoerUitDrd(LEEG, bronnenVan(DRD(), "onder"), los);
  assert.deepEqual(t.inputs.map((c) => c.naam), ["geboortedatum", "naam"]);
  assert.equal(t.inputs[1].fieldRef, ref);
  assert.equal(t.inputs[0].fieldRef, null);
  assert.deepEqual(Object.keys(t.rules[0].inputEntries).sort(), t.inputs.map((c) => c.id).sort());
  assert.equal(metInvoerUitDrd(t, bronnenVan(DRD(), "onder"), los), t, "zelfde tabel als er niets verandert");
});

test("metInvoerUitDrd: hernoemd volgt, verdwenen bron blijft staan met bronWeg, oude kolom blijft", () => {
  const els = DRD();
  const oud = { id: "in_oud", fieldRef: { veldpad: "X.y" }, label: "X.y" };
  let t = metInvoerUitDrd({ ...LEEG, inputs: [oud] }, bronnenVan(els, "onder"));
  const naamKolom = t.inputs[2].id;
  t = { ...t, rules: t.rules.map((r) => ({ ...r, inputEntries: { ...r.inputEntries, [naamKolom]: "Jan" } })) };
  els.a.naam = "roepnaam";
  delete els.p2;
  const t2 = metInvoerUitDrd(t, bronnenVan(els, "onder"));
  assert.equal(t2.inputs[0], oud);
  assert.equal(t2.inputs[1].bronWeg, true);
  assert.equal(t2.inputs[2].naam, "roepnaam");
  assert.equal(t2.inputs[2].id, naamKolom);
  assert.equal(t2.rules[0].inputEntries[naamKolom], "Jan");
  assert.deepEqual(invoerMeldingen(t2).map((m) => m.niveau), ["info", "fout"]);
  // De pijl terug: bronWeg verdwijnt weer.
  els.p2 = pijl("p2", "b", "onder");
  assert.equal(metInvoerUitDrd(t2, bronnenVan(els, "onder")).inputs[1].bronWeg, undefined);
});

test("invoerMeldingen: invoergegeven zonder veld", () => {
  const t = metInvoerUitDrd(LEEG, bronnenVan(DRD(), "onder"));
  assert.deepEqual(invoerMeldingen(t).map((m) => m.tekst.includes("geboortedatum")), [true]);
});

test("zonderKolom haalt de kolom en haar cellen weg", () => {
  const t = metInvoerUitDrd(LEEG, bronnenVan(DRD(), "onder"));
  const weg = t.inputs[0].id;
  const t2 = zonderKolom(t, weg);
  assert.equal(t2.inputs.length, 1);
  assert.equal(weg in t2.rules[0].inputEntries, false);
});

test("een oude kolom gaat over op het invoergegeven met dezelfde naam of hetzelfde veld, en houdt haar cellen", () => {
  const els = DRD();
  const opNaam = { id: "in1", naam: "geboortedatum", fieldRef: { uuid: "u-9", veldpad: "NP.geboorte.datum", veldnaam: "datum", type: "string" } };
  const opUuid = { id: "in2", naam: "volledigeNaam", fieldRef: { uuid: "u-1", veldpad: "NP.naam.langeNaam", veldnaam: "langeNaam" } };
  const los = (g, kolom) => (kolom?.fieldRef?.uuid === g.uuid ? kolom.fieldRef : null);
  const t = metInvoerUitDrd({ ...LEEG, inputs: [opNaam, opUuid], rules: [{ id: "r1", inputEntries: { in1: "< 2000", in2: "x" }, outputEntries: {} }] }, bronnenVan(els, "onder"), los);
  assert.deepEqual(t.inputs.map((c) => [c.id, c.naam, c.bron.elementId]), [["in1", "geboortedatum", "b"], ["in2", "naam", "a"]]);
  assert.equal(t.inputs[0].fieldRef, opNaam.fieldRef, "zonder veld op het invoergegeven blijft de koppeling van de kolom");
  assert.equal(t.inputs[1].fieldRef, opUuid.fieldRef);
  assert.deepEqual(t.rules[0].inputEntries, { in1: "< 2000", in2: "x" });
});

test("alleenBestaand (export): geen kolommen erbij, geen oude overnemen, wel bijwerken", () => {
  const els = DRD();
  const oud = { id: "in1", naam: "geboortedatum", fieldRef: { veldpad: "X.y" } };
  assert.equal(metInvoerUitDrd({ ...LEEG, inputs: [oud] }, bronnenVan(els, "onder"), undefined, { alleenBestaand: true }).inputs.length, 1);
  const t = metInvoerUitDrd(LEEG, bronnenVan(els, "onder"));
  els.b.naam = "geboren";
  const t2 = metInvoerUitDrd(t, bronnenVan(els, "onder"), undefined, { alleenBestaand: true });
  assert.deepEqual(t2.inputs.map((c) => c.naam), ["geboren", "naam"]);
});
