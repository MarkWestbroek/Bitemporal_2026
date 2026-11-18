import test from "node:test";
import assert from "node:assert/strict";
import { planTraceOmzetting, gegevenVoor } from "./traceNaarGegeven.js";

const veld = (naam, uuid) => ({ naam, data: { uuid, typeLabel: "string" } });
const ELEMENTEN = {
  "dmn::a": { id: "a", elementType: "inputData", data: {} },
  "dmn::b": { id: "b", elementType: "inputData", data: {} },
  "dmn::c": { id: "c", elementType: "inputData", data: { gegeven: { profielId: "cm", elementId: "geboorte", veldNaam: "datum" } } },
  "dmn::d": { id: "d", elementType: "decision", data: {} },
  "cm::naam": { id: "naam", compartimenten: [{ velden: [veld("naam", "u-n"), veld("langeNaam", "u-l")] }] },
  "cm::geboorte": { id: "geboorte", compartimenten: [{ velden: [veld("datum", "u-d")] }] },
  "cm::inkomen": { id: "inkomen", compartimenten: [{ velden: [veld("bedrag", "u-b"), veld("jaar", "")] }] },
};
const elementVan = (r) => ELEMENTEN[`${r.profielId}::${r.elementId}`] || null;
const link = (id, van, naar, soort = "traceert naar", omgekeerd = false) => ({
  id, soort, omgekeerd, rij: { profielId: van.split("::")[0], elementId: van.split("::")[1] }, kolom: { profielId: naar.split("::")[0], elementId: naar.split("::")[1] },
});

test("gegevenVoor: één veld wordt het veld, meer laat het veld open", () => {
  assert.deepEqual(gegevenVoor("cm", ELEMENTEN["cm::geboorte"]), { profielId: "cm", elementId: "geboorte", veldNaam: "datum", uuid: "u-d" });
  assert.deepEqual(gegevenVoor("cm", ELEMENTEN["cm::naam"]), { profielId: "cm", elementId: "naam" });
});

test("planTraceOmzetting: lijn wordt gegeven en verdwijnt", () => {
  const plan = planTraceOmzetting({
    links: [link("l1", "dmn::a", "cm::naam"), link("l2", "dmn::b", "cm::geboorte")],
    dmnProfielen: ["dmn"],
    elementVan,
  });
  assert.deepEqual(plan.wis, ["l1", "l2"]);
  assert.deepEqual(plan.zet, [
    { profielId: "dmn", elementId: "a", gegeven: { profielId: "cm", elementId: "naam" } },
    { profielId: "dmn", elementId: "b", gegeven: { profielId: "cm", elementId: "geboorte", veldNaam: "datum", uuid: "u-d" } },
  ]);
});

test("planTraceOmzetting: omgekeerd getekend telt ook; andere soorten, beslissingen en andere talen niet", () => {
  const plan = planTraceOmzetting({
    links: [
      link("l1", "cm::geboorte", "dmn::a", "traceert naar", true),
      link("l2", "dmn::b", "cm::naam", "heeft te maken met"),
      link("l3", "dmn::d", "cm::naam"),
      link("l4", "cm::naam", "cm::geboorte"),
    ],
    dmnProfielen: ["dmn"],
    elementVan,
  });
  assert.deepEqual(plan.wis, ["l1"]);
  assert.equal(plan.zet[0].gegeven.elementId, "geboorte");
});

test("planTraceOmzetting: al een gegeven → dubbel weg, ander element blijft staan", () => {
  const plan = planTraceOmzetting({
    links: [link("l1", "dmn::c", "cm::geboorte"), link("l2", "dmn::c", "cm::inkomen")],
    dmnProfielen: ["dmn"],
    elementVan,
  });
  assert.deepEqual(plan, { wis: ["l1"], zet: [] });
});

test("planTraceOmzetting: twee lijnen van één invoergegeven: de eerste wint, de tweede blijft", () => {
  const plan = planTraceOmzetting({
    links: [link("l1", "dmn::a", "cm::inkomen"), link("l2", "dmn::a", "cm::naam")],
    dmnProfielen: ["dmn"],
    elementVan,
  });
  assert.deepEqual(plan.wis, ["l1"]);
  assert.equal(plan.zet.length, 1);
});
