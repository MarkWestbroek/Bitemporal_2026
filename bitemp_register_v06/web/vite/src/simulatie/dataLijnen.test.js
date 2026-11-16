/**
 * Run: node --import ./test/register-aliases.mjs --test src/simulatie/dataLijnen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { toetsLijnen } from "./dataLijnen.js";
import { maakSimulatie } from "./simulatie.js";
import { metProcessen } from "./procesmodel.js";

const cm = {
  e_aanvraag: { id: "e_aanvraag", naam: "Aanvraag", elementType: "entiteit" },
  e_gpk: { id: "e_gpk", naam: "GehandicaptenparkeerkaartAanvraag", elementType: "entiteit" },
  e_zaak: { id: "e_zaak", naam: "Zaak", elementType: "entiteit" },
  g1: { id: "g1", elementType: "generalisatie", source: "e_gpk", target: "e_aanvraag" },
};
const elementenVan = (pid) => (pid === "cm" ? cm : null);
const type = (elementId) => ({ type: { profielId: "cm", elementId } });

test("toetsLijnen: leest wat er nog niet is, schrijft niet, schrijft zonder lijn", () => {
  const bpmnElementen = {
    t1: { id: "t1", naam: "Toets", elementType: "taak" },
    t2: { id: "t2", naam: "Beoordeel", elementType: "taak" },
    t3: { id: "t3", naam: "Status", elementType: "taak" },
    dA: { id: "dA", naam: "Aanvraag", elementType: "data-object", data: type("e_aanvraag") },
    dZ: { id: "dZ", naam: "Zaak", elementType: "data-object", data: { ...type("e_zaak"), toestand: "open" } },
    l1: { id: "l1", elementType: "data-associatie", source: "dZ", target: "t1" }, // t1 leest de zaak: die is er nog niet
    l2: { id: "l2", elementType: "data-associatie", source: "dA", target: "t2" }, // t2 leest de aanvraag, en schrijft hem ook
    l3: { id: "l3", elementType: "data-associatie", source: "t3", target: "dA" }, // t3 zou de aanvraag schrijven, maar doet het niet
    l4: { id: "l4", elementType: "data-associatie", source: "t1", target: "dA", data: { richting: "beide" } },
  };
  const diagrams = { d: { id: "d", nodes: ["t1", "t2", "t3", "dA", "dZ"].map((elementId) => ({ elementId })) } };
  const log = [
    { nr: 1, plek: "s", wijzigingen: [{ soort: "maak", id: "a1", type: "GehandicaptenparkeerkaartAanvraag", data: {} }] },
    { nr: 2, plek: "t1", wijzigingen: [{ soort: "zet", id: "a1", velden: { x: 1 } }] },
    { nr: 3, plek: "t2", wijzigingen: [{ soort: "zet", id: "a1", velden: { y: 2 } }] },
    { nr: 4, plek: "t3", wijzigingen: [{ soort: "variabele", naam: "v", waarde: 1 }] },
  ];
  const { bevindingen, lijnen, taken } = toetsLijnen({ bpmnElementen, diagrams, elementenVan, log });
  assert.deepEqual(
    bevindingen.map((b) => [b.soort, b.taak, b.dataObject, b.lijn]),
    [
      ["leest-niets", "t1", "dZ", "l1"],
      ["schrijft-niet", "t3", "dA", "l3"],
      ["schrijft-zonder-lijn", "t2", "dA", "l2"],
    ],
  );
  assert.match(lijnen.l1[0].reden, /Toets leest Zaak \[open\], maar er is nog geen object van type Zaak \(of een subtype\)/);
  assert.match(taken.t2[0].reden, /alleen een lezende/);
  assert.equal(lijnen.l4, undefined, "lezen en schrijven: t1 schrijft de aanvraag, dat klopt");
});

test("toetsLijnen op GPK 4: de formulieren van de medewerker komen op de aanvraag, zonder schrijvende lijn", () => {
  const CG = new URL("../diagramprofielen/canoniek-uml/fixtures/cg-test/", import.meta.url);
  const lees = (naam, basis = CG) => JSON.parse(fs.readFileSync(new URL(naam, basis), "utf8"));
  const vier = lees("./fixtures/gpk-vier-processen.bpmn-model.json", import.meta.url);
  const m1 = { proces: vier, beslissingen: [lees("gpk-beslissingen.dmn-model.json")], edienst: metProcessen(lees("gpk-edienst.json"), vier.processen) };
  const sim = maakSimulatie({ m1, scenario: lees("./fixtures/gpk-scenario-4.json", import.meta.url) });
  sim.loop();
  // Het cm van het project: de Aanvraag heeft id "Aanvraag" (V3-import), met het GPK-subtype.
  const cmProject = { Aanvraag: { id: "Aanvraag", naam: "Aanvraag" }, Gpk: { id: "Gpk", naam: "GehandicaptenparkeerkaartAanvraag" }, g: { id: "g", elementType: "generalisatie", source: "Gpk", target: "Aanvraag" } };
  const { bevindingen } = toetsLijnen({ bpmnElementen: vier.model.elements, diagrams: vier.model.diagrams, elementenVan: () => cmProject, log: sim.log });
  const naam = (id) => vier.model.elements[id]?.naam;
  assert.deepEqual(bevindingen.map((b) => [b.soort, naam(b.taak)]).sort(), [
    ["schrijft-zonder-lijn", "Aanvraag beoordelen"],
    ["schrijft-zonder-lijn", "Stel beschikking op"],
  ]);
});
