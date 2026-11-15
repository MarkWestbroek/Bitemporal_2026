/**
 * Run: node --import ./test/register-aliases.mjs --test src/diagramcore/model/afgeleideKoppelingen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { afgeleideKoppelingen, isAfgeleideLink } from "./afgeleideKoppelingen.js";
import { gerelateerdeElementen, kruisGraaf } from "./gerelateerd.js";
import { metKoppelingen } from "./koppellijnen.js";
import { DATA_TYPE_VELD } from "../../diagramprofielen/bpmn/dataVelden.js";

const elementTypes = [
  { id: "data-object", label: "Data-object", properties: [DATA_TYPE_VELD] },
  { id: "taak", label: "Taak" },
  { id: "data-associatie", label: "Data-associatie", isConnector: true },
];
const elements = {
  d1: { id: "d1", naam: "Aanvraag", elementType: "data-object", data: { type: { profielId: "diagram05", elementId: "e_aanvraag" } } },
  d2: { id: "d2", naam: "Los", elementType: "data-object", data: { type: { profielId: "diagram05", elementId: null } } },
  t1: { id: "t1", naam: "Toetsen", elementType: "taak", data: {} },
  a1: { id: "a1", elementType: "data-associatie", source: "d1", target: "t1", data: {} },
};

test("het type van een data-object wordt een koppeling «traceert naar» (afgeleid, niet bewaard)", () => {
  const links = afgeleideKoppelingen({ profielId: "bpmnMotor05", elements, elementTypes });
  assert.equal(links.length, 1, "zonder gekozen element geen koppeling");
  const [l] = links;
  assert.deepEqual([l.rij, l.kolom, l.soort], [{ profielId: "bpmnMotor05", elementId: "d1" }, { profielId: "diagram05", elementId: "e_aanvraag" }, "traceert naar"]);
  assert.ok(isAfgeleideLink(l.id) && l.afgeleid);
});

test("de afgeleide koppeling tekent als lijn zodra het cm-element als verwijzing op het diagram staat", () => {
  const links = afgeleideKoppelingen({ profielId: "bpmnMotor05", elements, elementTypes });
  const vid = "diagram05::e_aanvraag";
  const metVreemd = { ...elements, [vid]: { id: vid, naam: "Aanvraag", elementType: "entiteit", data: { vreemd: { profielId: "diagram05" } } } };
  const diagram = { nodes: [{ elementId: "d1" }, { elementId: vid }] };
  const uit = metKoppelingen({ elements: metVreemd, descriptor: { elementTypes }, diagram, eigenProfielId: "bpmnMotor05", links, soorten: [] });
  const lijn = Object.values(uit.elements).find((e) => e.data?.koppeling);
  assert.deepEqual([lijn.source, lijn.target, lijn.data.koppeling.soort], ["d1", vid, "traceert naar"]);
});

test("Gerelateerde elementen volgt een koppeling naar een andere taal; het vreemde element is een eindpunt", () => {
  const vid = "diagram05::e_aanvraag";
  const koppelingen = [{ id: "koppeling:x", source: "d1", target: vid, typeLabel: "«traceert naar»" }];
  const vreemdeKnopen = { [vid]: { naam: "Aanvraag", typeLabel: "Entiteit, Canoniek model" } };
  const elementTypesById = Object.fromEntries(elementTypes.map((t) => [t.id, t]));
  const lijst = gerelateerdeElementen({ startIds: ["d1"], elements, opDiagram: new Set(["d1"]), elementTypesById, koppelingen, vreemdeKnopen });
  const cm = lijst.find((k) => k.id === vid);
  assert.ok(cm, "het cm-element staat in de lijst");
  assert.deepEqual([cm.naam, cm.typeLabel, cm.via.typeLabel, cm.niveau], ["Aanvraag", "Entiteit, Canoniek model", "«traceert naar»", 1]);
  assert.ok(lijst.some((k) => k.id === "t1"), "de gewone buren blijven");
  // Zonder koppelingen: hetzelfde als voorheen.
  assert.deepEqual(gerelateerdeElementen({ startIds: ["d1"], elements, opDiagram: new Set(["d1"]), elementTypesById }).map((k) => k.id), ["t1"]);
});

test("kruisGraaf: vanaf een BPMN-data-object via het type het cm in, en daar verder over de relaties", () => {
  const cm = {
    elements: {
      e_aanvraag: { id: "e_aanvraag", naam: "Aanvraag", elementType: "entiteit" },
      e_partij: { id: "e_partij", naam: "Partij", elementType: "entiteit" },
      e_adres: { id: "e_adres", naam: "Adres", elementType: "entiteit" },
      r1: { id: "r1", naam: "aanvrager", elementType: "relatie", source: "e_aanvraag", target: "e_partij" },
      r2: { id: "r2", naam: "woont", elementType: "relatie", source: "e_partij", target: "e_adres" },
    },
    descriptor: { elementTypes: [{ id: "entiteit", label: "Entiteit" }, { id: "relatie", label: "Relatie", isConnector: true }] },
    label: "Canoniek model",
  };
  const bronVan = (pid) => (pid === "diagram05" ? cm : null);
  const links = afgeleideKoppelingen({ profielId: "bpmnMotor05", elements, elementTypes });
  const elementTypesById = Object.fromEntries(elementTypes.map((t) => [t.id, t]));
  const graaf = kruisGraaf({ eigenProfielId: "bpmnMotor05", startIds: ["d1"], links, bronVan });
  const lijst = (startIds, opDiagram, diepte) =>
    gerelateerdeElementen({ startIds, elements, opDiagram: new Set(opDiagram), elementTypesById, diepte, ...graaf }).map((k) => [k.id, k.niveau]);
  assert.deepEqual(lijst(["d1"], ["d1"], Infinity), [["diagram05::e_aanvraag", 1], ["t1", 1], ["diagram05::e_partij", 2], ["diagram05::e_adres", 3]]);
  // Vanaf het cm-element zelf (als verwijzing op het BPMN-diagram): verder in het cm.
  const vanCm = kruisGraaf({ eigenProfielId: "bpmnMotor05", startIds: ["diagram05::e_aanvraag"], links, bronVan });
  const k = gerelateerdeElementen({ startIds: ["diagram05::e_aanvraag"], elements, opDiagram: new Set(["d1", "t1", "diagram05::e_aanvraag"]), elementTypesById, ...vanCm });
  assert.deepEqual(k.map((x) => [x.naam, x.typeLabel, x.via.typeLabel]), [["Partij", "Entiteit, Canoniek model", "Relatie"]]);
});
