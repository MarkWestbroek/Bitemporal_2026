// afgeleideConnectoren.test.js — ERFT-1 (overerving) en GEBR-1 («gebruikt») als connectoren.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/canoniek-uml/afgeleideConnectoren.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { vouwOudeGeneralisaties, synchroniseerGebruik, isRli } from "./afgeleideConnectoren.js";
import { canoniekUmlDiagramType } from "./index.js";
import { v3ModelNaarStore, storeNaarV3Model } from "../../store/adapters.js";
import { vanCanoniekModel, naarCanoniekModel } from "./adapter.js";
import { vindConnectorType } from "../../diagramcore/canvas/materialiseerConnectoren.js";

const ent = (id, naam, extra = {}) => ({ id, naam, elementType: "entiteit", compartimenten: [], data: {}, ...extra });
const veld = (naam, typeLabel) => ({ naam, fieldType: "attribuut", data: { typeLabel } });

test("ERFT-1: een isGeneralization-edge wordt één generalisatie-connector; de edges verdwijnen; idempotent", () => {
  const elements = { A: ent("A", "Aanvraag"), G: ent("G", "GpkAanvraag") };
  const edge = { id: "gen-G-A", source: "G", target: "A", data: { bron: { isGeneralization: true, naamLabelHeen: "is een" } } };
  const state = { elements, diagrams: { d1: { id: "d1", nodes: [], edges: [edge] }, d2: { id: "d2", nodes: [], edges: [{ ...edge }] } } };
  const uit = vouwOudeGeneralisaties(state);
  const gens = Object.values(uit.elements).filter((e) => e.elementType === "generalisatie");
  assert.equal(gens.length, 1);
  assert.deepEqual([gens[0].source, gens[0].target, gens[0].data.naamLabelHeen], ["G", "A", "is een"]);
  assert.equal(uit.diagrams.d1.edges.length, 0);
  assert.equal(uit.diagrams.d2.edges.length, 0);
  assert.equal(vouwOudeGeneralisaties(uit), null);
});

test("GEBR-1: een veldtype naar enum, gegevenstype of ref.lijst-item geeft een «gebruikt»-connector; weg als het type weg is", () => {
  const rli = ent("R", "Partijrol", { data: { entiteitSubtype: "referentielijst_item" } });
  assert.equal(isRli(rli), true);
  const elements = {
    P: { id: "P", naam: "AanvraagPartij", elementType: "relatie", source: "X", target: "Y", compartimenten: [{ compartmentType: "velden", velden: [veld("partijrol", "Partijrol"), veld("status", "Status {nieuw|oud}"), veld("datum", "Datum «date»")] }], data: {} },
    R: rli,
    S: { id: "S", naam: "Status", elementType: "enumeratie", compartimenten: [], data: {} },
    D: { id: "D", naam: "Datum", elementType: "gegevenstype", compartimenten: [], data: {} },
    X: ent("X", "Aanvraag"), Y: ent("Y", "Partij"),
    // Een handmatige «gebruikt» blijft altijd.
    h: { id: "h", naam: "", elementType: "gebruik", source: "X", target: "S", compartimenten: [], data: {} },
  };
  const uit = synchroniseerGebruik({ elements, diagrams: {} });
  const paren = Object.values(uit.elements).filter((e) => e.elementType === "gebruik").map((e) => `${e.source}->${e.target}`).sort();
  assert.deepEqual(paren, ["P->D", "P->R", "P->S", "X->S"]);
  assert.equal(uit.elements["gebr_P__R"].data.afgeleid, "veldtype");
  assert.equal(synchroniseerGebruik(uit), null, "idempotent");

  // Het veld krijgt een gewoon type: de afgeleide connector gaat weg, de handmatige blijft.
  const zonder = { ...uit.elements, P: { ...uit.elements.P, compartimenten: [{ compartmentType: "velden", velden: [veld("partijrol", "integer")] }] } };
  const na = synchroniseerGebruik({ elements: zonder, diagrams: {} });
  const over = Object.values(na.elements).filter((e) => e.elementType === "gebruik").map((e) => e.id).sort();
  assert.deepEqual(over, ["h"]);
});

test("GEBR-1: een oude «use»-presentatie-edge vervalt zodra er een connector is; een verborgen wordt verborgenConnectoren", () => {
  const elements = {
    G: { id: "G", naam: "Naam", elementType: "gegevenselement", compartimenten: [{ compartmentType: "velden", velden: [veld("soort", "Soort")] }], data: {} },
    S: { id: "S", naam: "Soort", elementType: "enumeratie", compartimenten: [], data: {} },
  };
  const diagrams = { d: { id: "d", nodes: [], edges: [{ id: "G-->Soort", source: "G", target: "S", hidden: true, data: { bron: { isDependency: true } } }, { id: "x", source: "G", target: "S", data: { bron: { isAssociation: true } } }] } };
  const uit = synchroniseerGebruik({ elements, diagrams });
  assert.deepEqual(uit.diagrams.d.edges.map((e) => e.id), ["x"]);
  assert.deepEqual(uit.diagrams.d.verborgenConnectoren, ["gebr_G__S"]);
});

test("GEBR-1 handmatig: «gebruikt» van een relatie naar een ref.lijst-item mag; naar een gewone entiteit niet (hook magVerbinden)", () => {
  const rel = { id: "P", naam: "AanvraagPartij", elementType: "relatie", source: "X", target: "Y", data: {} };
  const rli = ent("R", "Partijrol", { data: { entiteitSubtype: "referentielijst_item" } });
  assert.equal(vindConnectorType(canoniekUmlDiagramType, rel, rli, "gebruik")?.id, "gebruik");
  assert.equal(vindConnectorType(canoniekUmlDiagramType, rel, ent("Y", "Partij"), "gebruik"), null);
});

test("ERFT-1 rondreis: V3 met erft → Studio (migratie) → V3 houdt erft, ook zonder diagrammen", () => {
  const v3 = {
    entiteiten: [
      { typenaam: "Aanvraag", domein: "kern", gegevenselementen: [] },
      { typenaam: "GpkAanvraag", domein: "kern", erft: "Aanvraag", gegevenselementen: [] },
    ],
  };
  const core = vanCanoniekModel(v3ModelNaarStore(v3));
  const gemigreerd = canoniekUmlDiagramType.hooks.migreerModel({ elements: core.elements, diagrams: core.diagrams, meta: core.meta || {} }) || core;
  const els = gemigreerd.elements || core.elements;
  const gen = Object.values(els).find((e) => e.elementType === "generalisatie");
  assert.ok(gen, "een generalisatie-connector in het model");
  assert.deepEqual([gen.source, gen.target], ["GpkAanvraag", "Aanvraag"]);
  // Alle diagrammen weg: de overerving blijft, want hij zit in het model.
  const uitV3 = storeNaarV3Model(naarCanoniekModel({ ...core, ...gemigreerd, elements: els, diagrams: {} }));
  const v3Terug = uitV3.model || uitV3;
  assert.equal(v3Terug.entiteiten.find((e) => e.typenaam === "GpkAanvraag").erft, "Aanvraag");
});
