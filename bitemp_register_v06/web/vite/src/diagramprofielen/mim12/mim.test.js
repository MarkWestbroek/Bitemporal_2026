// mim.test.js — MIM 1.2-profiel: contract en kernstructuur.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/mim12/mim.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { mim12DiagramType, maakElement } from "./index.js";
import { valideerDiagramType, verbindingsregelsVan } from "../../diagramcore/types/typeRegistry.js";

test("mim12 descriptor voldoet aan het DiagramType-contract", () => {
  assert.deepEqual(valideerDiagramType(mim12DiagramType), []);
});

test("relatiesoort draagt de MIM-rolmetagegevens en materialiseert met velden", () => {
  const rel = mim12DiagramType.elementTypes.find((et) => et.id === "relatiesoort");
  assert.ok(rel.isConnector);
  const sleutels = rel.properties.map((p) => p.key);
  for (const verwacht of [
    "bronRolNaam",
    "doelRolNaam",
    "bronKardinaliteit",
    "doelKardinaliteit",
    "unidirectioneel",
    "indicatieMaterieleHistorie",
    "indicatieFormeleHistorie",
  ]) {
    assert.ok(sleutels.includes(verwacht), verwacht);
  }
  // Compartiment aanwezig → velden erop = relatieklasse (ASOC-patroon).
  assert.ok(rel.compartments?.length);
  // Rolnamen/kardinaliteiten als edge-labels.
  const labels = rel.hooks.edgeLabels({
    data: { bronKardinaliteit: "1", doelKardinaliteit: "0..*", doelRolNaam: "heeft" },
  });
  assert.equal(labels.kaal.length, 3);
});

test("generalisatie geldt voor objecttypen én voor datatypen (2 regels)", () => {
  const gen = mim12DiagramType.elementTypes.find((et) => et.id === "generalisatie");
  const regels = verbindingsregelsVan(gen);
  assert.equal(regels.length, 2);
  assert.ok(regels[0].bron.includes("objecttype"));
  assert.ok(regels[1].bron.includes("primitiefDatatype"));
});

test("package is container met soort-property; boom volgt bevat + gegevensgroep", () => {
  const pkg = mim12DiagramType.elementTypes.find((et) => et.id === "package");
  assert.equal(pkg.containerVoor, "bevat");
  assert.equal(pkg.standaardDichtInBoom, true);
  assert.ok(pkg.properties.some((p) => p.key === "soort"));
  assert.deepEqual(mim12DiagramType.hierarchie, ["bevat", "gegevensgroep"]);
});

test("maakElement: package start als domein; connectoren niet plaatsbaar", () => {
  const p = maakElement("package");
  assert.equal(p.data.soort, "domein");
  assert.equal(maakElement("relatiesoort"), null);
});

test("attribuutsoort-veld draagt de MIM-metagegevens", () => {
  const ft = mim12DiagramType.fieldTypes.find((f) => f.id === "attribuutsoort");
  const sleutels = ft.properties.map((p) => p.key);
  for (const verwacht of [
    "kardinaliteit",
    "authentiek",
    "indicatieMaterieleHistorie",
    "indicatieFormeleHistorie",
    "mogelijkGeenWaarde",
    "identificerend",
  ]) {
    assert.ok(sleutels.includes(verwacht), verwacht);
  }
});

// ── Transformatie canoniek → MIM ────────────────────────────────────────────
import { vanCanoniekCoreNaarMim } from "./adapter.js";

test("vanCanoniekCoreNaarMim: entiteit/relatie/enum/domein worden MIM-tegenhangers", () => {
  const veld = (naam, data = {}) => ({ naam, fieldType: "attribuut", data });
  const core = {
    elements: {
      E1: {
        id: "E1", naam: "Persoon", elementType: "entiteit",
        compartimenten: [{ compartmentType: "velden", velden: [
          veld("bsn", { typeLabel: "string", verplicht: true }),
          veld("roepnaam", { typeLabel: "string", verplicht: false }),
        ] }],
        data: { materieel: true },
      },
      E2: { id: "E2", naam: "Adres", elementType: "entiteit", compartimenten: [], data: {} },
      GE1: {
        id: "GE1", naam: "Naam", elementType: "gegevenselement",
        compartimenten: [{ compartmentType: "velden", velden: [veld("voornaam", {})] }],
        data: {},
      },
      REL1: {
        id: "REL1", naam: "woont op", elementType: "relatie", source: "E1", target: "E2",
        compartimenten: [{ compartmentType: "velden", velden: [veld("sinds", {})] }],
        data: { bronKardinaliteit: "1", doelKardinaliteit: "0..*", naamLabelHeen: "woonadres", directioneel: true, materieel: true },
      },
      EN1: {
        id: "EN1", naam: "Geslacht", elementType: "enumeratie",
        compartimenten: [{ compartmentType: "waarden", velden: [{ naam: "man", fieldType: "waarde" }, { naam: "vrouw", fieldType: "waarde" }] }],
        data: {},
      },
      PKG1: { id: "PKG1", naam: "kern", elementType: "package", compartimenten: [], data: {} },
      BEV1: { id: "BEV1", naam: "", elementType: "bevat", source: "PKG1", target: "E1", compartimenten: [], data: {} },
    },
    diagrams: {
      d1: { id: "d1", naam: "Overzicht", diagramType: "canoniek-uml", nodes: [
        { elementId: "E1", position: { x: 10, y: 20 } },
        { elementId: "E2", position: { x: 400, y: 20 } },
      ], edges: [] },
    },
    meta: { compositieEdges: [{ id: "ce1", source: "E1", target: "GE1" }] },
  };
  const mim = vanCanoniekCoreNaarMim(core);
  const el = (id) => mim.elements[id];

  assert.equal(el("E1").elementType, "objecttype");
  const attrs = el("E1").compartimenten[0].velden;
  assert.equal(attrs[0].data.kardinaliteit, "1", "verplicht → 1");
  assert.equal(attrs[1].data.kardinaliteit, "0..1", "optioneel → 0..1");

  assert.equal(el("GE1").elementType, "gegevensgroeptype");
  const gg = Object.values(mim.elements).find((e) => e.elementType === "gegevensgroep");
  assert.deepEqual([gg.source, gg.target], ["E1", "GE1"], "compositie-meta → gegevensgroep");

  assert.equal(el("REL1").elementType, "relatiesoort");
  assert.equal(el("REL1").data.doelRolNaam, "woonadres");
  assert.equal(el("REL1").data.unidirectioneel, true);
  assert.equal(el("REL1").data.indicatieMaterieleHistorie, true, "materieel → MIM-historie");
  assert.equal(el("REL1").compartimenten.length, 1, "velden blijven (relatieklasse)");

  assert.equal(el("EN1").compartimenten[0].velden.length, 2);
  assert.equal(el("PKG1").data.soort, "domein");

  // wortel-informatiemodel boven de losse domein-packages... PKG1 heeft al
  // geen ouder → hangt onder het gegenereerde informatiemodel
  const im = Object.values(mim.elements).find((e) => e.data?.soort === "informatiemodel");
  assert.ok(im, "informatiemodel-wortel aangemaakt");
  const imBevat = Object.values(mim.elements).some(
    (e) => e.elementType === "bevat" && e.source === im.id && e.target === "PKG1"
  );
  assert.ok(imBevat, "domein hangt onder het informatiemodel");

  // layout behouden, diagramType omgezet
  assert.equal(mim.diagrams.d1.diagramType, "mim12");
  assert.deepEqual(mim.diagrams.d1.nodes[0].position, { x: 10, y: 20 });
});

test("vanCanoniekCoreNaarMim: presentatie-generalisatie wordt een echte connector", () => {
  const core = {
    elements: {
      A: { id: "A", naam: "Sub", elementType: "entiteit", compartimenten: [], data: {} },
      B: { id: "B", naam: "Super", elementType: "entiteit", compartimenten: [], data: {} },
    },
    diagrams: {
      d1: { id: "d1", naam: "x", nodes: [], edges: [
        { id: "e1", source: "A", target: "B", data: { bron: { isGeneralization: true } } },
      ] },
    },
  };
  const mim = vanCanoniekCoreNaarMim(core);
  const gen = Object.values(mim.elements).find((e) => e.elementType === "generalisatie");
  assert.deepEqual([gen.source, gen.target], ["A", "B"]);
});
