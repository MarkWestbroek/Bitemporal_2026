import test from "node:test";
import assert from "node:assert/strict";
import { leegMarks, metLaag, zetMark, marksVoor, markId } from "./marks.js";
import { registreerMarksoorten, REGISTER_MARKSOORTEN } from "./marksoorten.js";
import { doelVanElement, doelVanVeld, paneelVoorElement, markRegels, markTeken, zetEffect, schermContext } from "./marksPaneel.js";

registreerMarksoorten(REGISTER_MARKSOORTEN);
registreerMarksoorten([{ id: "proef.rol", label: "rol", datatype: "string", doelen: ["element"], profielen: ["bpmn"] }]);

const GE = {
  id: "ge1", naam: "Kaart", elementType: "gegevenselement", data: { uuid: "u-ge" },
  compartimenten: [{ velden: [{ naam: "kaartnummer", data: { uuid: "u-kn" } }, { naam: "soort", data: {} }, { data: {} }] }],
};
const TAAK = { id: "t1", naam: "Beoordelen", elementType: "userTask", data: {} };
const lagen = () => metLaag(metLaag(leegMarks(), { id: "algemeen" }), { id: "ws" });

test("doelen: uuid waar die er is, anders profiel en id; veld zonder uuid op naam", () => {
  assert.deepEqual(doelVanElement("diagram05", GE), { soort: "element", uuid: "u-ge" });
  assert.deepEqual(doelVanElement("bpmnMotor05", TAAK), { soort: "element", profielId: "bpmnMotor05", elementId: "t1" });
  assert.deepEqual(doelVanElement("x", { id: "r", source: "a", target: "b", data: {} }), { soort: "relatie", profielId: "x", elementId: "r" });
  assert.deepEqual(doelVanVeld("diagram05", GE, GE.compartimenten[0].velden[0]), { soort: "veld", uuid: "u-kn" });
  assert.deepEqual(doelVanVeld("diagram05", GE, GE.compartimenten[0].velden[1]), { soort: "veld", profielId: "diagram05", elementId: "ge1", veldNaam: "soort" });
});

test("paneelVoorElement: velden maal soorten voor het canonieke model, met de herkomst", () => {
  let st = lagen();
  st = zetMark(st, { laag: "algemeen", soort: "register.zoeksleutel", doel: { soort: "veld", uuid: "u-kn" }, waarde: true });
  const p = paneelVoorElement({ st, context: ["algemeen", "ws"], profielId: "diagram05", descriptorId: "canoniek-uml", element: GE });
  assert.deepEqual(p.veldSoorten.map((s) => s.id), ["register.sorteerbaar", "register.tekstzoeken", "register.zoeksleutel"]);
  assert.deepEqual(p.velden.map((v) => v.naam), ["kaartnummer", "soort"]);
  assert.equal(p.velden[0].cellen[2].eff.laag, "algemeen");
  assert.equal(p.velden[1].cellen[2].eff, null);
  assert.equal(p.element.length, 0);
  assert.equal(p.aantal, 1);
  assert.deepEqual(markRegels({ st, context: ["algemeen"], profielId: "diagram05", descriptorId: "canoniek-uml", element: GE }), { element: [], velden: { kaartnummer: ["zoeksleutel"] } });
  assert.equal(markRegels({ st, context: ["ws"], profielId: "diagram05", descriptorId: "canoniek-uml", element: GE }), null);
  assert.deepEqual([markTeken(0), markTeken(1), markTeken(3)], ["", "◆", "◆3"]);
  // Een BPMN-taak: geen veldsoorten, wel de soort voor het element.
  const b = paneelVoorElement({ st, context: ["algemeen"], profielId: "bpmnMotor05", descriptorId: "bpmn", element: TAAK });
  assert.deepEqual(b.element.map((r) => r.soort.id), ["proef.rol"]);
  assert.deepEqual(b.velden, []);
});

test("paneelVoorElement: een mark van een onbekende soort blijft zichtbaar", () => {
  const st = zetMark(lagen(), { laag: "algemeen", soort: "weg.iets", doel: doelVanElement("bpmnMotor05", TAAK), waarde: "x" });
  const p = paneelVoorElement({ st, context: ["algemeen"], profielId: "bpmnMotor05", descriptorId: "bpmn", element: TAAK });
  assert.deepEqual(p.element.map((r) => [r.soort.id, r.soort.datatype]), [["proef.rol", "string"], ["weg.iets", "onbekend"]]);
});

test("zetEffect: aan, uit in een hogere laag (uitzetten), en terug", () => {
  const doel = { soort: "veld", uuid: "u-kn" };
  const context = ["algemeen", "ws"];
  const soort = "register.zoeksleutel";
  let st = zetEffect(lagen(), { laag: "algemeen", soort, doel, waarde: true, context });
  assert.deepEqual(marksVoor(st, doel, context), { [soort]: true });
  assert.equal(zetEffect(st, { laag: "algemeen", soort, doel, waarde: true, context }), st, "niets te doen");
  // Uit in Waterstede: de algemene mark blijft, Waterstede zet hem uit.
  const uit = zetEffect(st, { laag: "ws", soort, doel, waarde: undefined, context });
  assert.deepEqual(marksVoor(uit, doel, context), {});
  assert.equal(uit.marks.find((m) => m.id === markId("ws", soort, doel)).waarde, null);
  assert.deepEqual(marksVoor(uit, doel, ["algemeen"]), { [soort]: true });
  // Weer aan in Waterstede: de uitzetting gaat weg (geen dubbele mark).
  const aan = zetEffect(uit, { laag: "ws", soort, doel, waarde: true, context });
  assert.deepEqual(aan.marks.map((m) => m.laag), ["algemeen"]);
  // Uit in de laag waar hij staat: gewoon weg.
  assert.equal(zetEffect(st, { laag: "algemeen", soort, doel, waarde: undefined, context }).marks.length, 0);
});

test("schermContext: de gekozen context, anders alle lagen", () => {
  const st = lagen();
  assert.deepEqual(schermContext(st, null), ["algemeen", "ws"]);
  assert.deepEqual(schermContext(st, ["ws"]), ["ws"]);
  assert.deepEqual(schermContext(st, ["bestaat-niet"]), ["algemeen", "ws"]);
});

test("bestaatIn: uuid op element of veld, verwijzing op profiel en id; map bestaat altijd", async () => {
  const { bestaatIn } = await import("./marksPaneel.js");
  const { wezen } = await import("./marks.js");
  const bestaat = bestaatIn([{ id: "diagram05", elements: { ge1: GE } }, { id: "bpmnMotor05", elements: { t1: TAAK } }]);
  assert.equal(bestaat({ soort: "veld", uuid: "u-kn" }), true);
  assert.equal(bestaat({ soort: "element", uuid: "u-ge" }), true);
  assert.equal(bestaat({ soort: "veld", uuid: "weg" }), false);
  assert.equal(bestaat({ soort: "element", profielId: "bpmnMotor05", elementId: "t1" }), true);
  assert.equal(bestaat({ soort: "element", profielId: "bpmnMotor05", elementId: "t2" }), false);
  assert.equal(bestaat({ soort: "veld", profielId: "diagram05", elementId: "ge1", veldNaam: "soort" }), true);
  assert.equal(bestaat({ soort: "veld", profielId: "diagram05", elementId: "ge1", veldNaam: "weg" }), false);
  assert.equal(bestaat({ soort: "map", mapId: "m" }), true);
  let st = zetMark(lagen(), { laag: "algemeen", soort: "register.zoeksleutel", doel: { soort: "veld", uuid: "weg" }, waarde: true });
  st = zetMark(st, { laag: "algemeen", soort: "register.zoeksleutel", doel: { soort: "veld", uuid: "u-kn" }, waarde: true });
  assert.deepEqual(wezen(st, bestaat).map((m) => m.doel.uuid), ["weg"]);
});
