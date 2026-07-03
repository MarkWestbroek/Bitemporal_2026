// terugreis.test.js — round-trip-tests voor fase 4 (serialisatie).
//
// Twee routes:
//  1. V3-niveau:   demoV3Model → v3ModelNaarStore → vanCanoniekModel →
//                  naarCanoniekModel → storeNaarV3Model; de V3-kernstructuren
//                  (entiteiten op typenaam, velden op goType) moeten overleven.
//  2. Store-niveau: synthetische oude-store-state met generalisatie, compositie,
//                  relatie-kardinaliteiten en een afgeleid veld — dekt wat het
//                  demo-model niet heeft.
//
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/canoniek-uml/terugreis.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { demoV3Model } from "../../demoV3Model.js";
import { v3ModelNaarStore, storeNaarV3Model } from "../../store/adapters.js";
import { vanCanoniekModel, naarCanoniekModel } from "./adapter.js";
import { exporteerV3, importeerV3 } from "./serialisatie.js";

/** Voer de volledige V3-round-trip uit en geef alle tussenstappen terug. */
function roundTrip() {
  const store1 = v3ModelNaarStore(demoV3Model);
  const core = vanCanoniekModel(store1);
  const store2 = naarCanoniekModel(core);
  const v3 = storeNaarV3Model(store2);
  return { store1, core, store2, v3: v3.model || v3 };
}

/** V3-entiteiten heten op `typenaam`; GE's en relaties op `naam`. */
function entiteitMap(v3Model) {
  const map = new Map();
  for (const ent of v3Model.entiteiten || []) map.set(ent.typenaam, ent);
  return map;
}

// ─────────────────────────── 1. V3-niveau ───────────────────────────

test("round-trip: alle entiteiten overleven op typenaam", () => {
  const { v3 } = roundTrip();
  const origineel = entiteitMap(demoV3Model);
  const terug = entiteitMap(v3);
  assert.deepEqual([...terug.keys()].sort(), [...origineel.keys()].sort());
  assert.ok(origineel.size >= 2, "demo-model heeft meerdere entiteiten");
});

test("round-trip: gegevenselementen blijven aan hun entiteit hangen, met velden en goTypes", () => {
  const { v3 } = roundTrip();
  const origineel = entiteitMap(demoV3Model);
  const terug = entiteitMap(v3);

  for (const [naam, ent] of origineel) {
    const t = terug.get(naam);
    const geNamen = (e) => (e.gegevenselementen || []).map((g) => g.naam).sort();
    assert.deepEqual(geNamen(t), geNamen(ent), `gegevenselementen van ${naam}`);

    for (const ge of ent.gegevenselementen || []) {
      const tge = (t.gegevenselementen || []).find((g) => g.naam === ge.naam);
      for (const veld of ge.velden || []) {
        const tv = (tge.velden || []).find((v) => v.naam === veld.naam);
        assert.ok(tv, `${naam}/${ge.naam}.${veld.naam} bestaat nog`);
        assert.equal(tv.goType, veld.goType, `${naam}/${ge.naam}.${veld.naam} goType`);
      }
      if (ge.momentvoorkomen) {
        assert.equal(tge.momentvoorkomen, ge.momentvoorkomen, `${naam}/${ge.naam} momentvoorkomen`);
      }
    }
  }
});

test("round-trip: relaties behouden doel en momentvoorkomen", () => {
  const { v3 } = roundTrip();
  const origineel = entiteitMap(demoV3Model);
  const terug = entiteitMap(v3);

  let totaal = 0;
  for (const [naam, ent] of origineel) {
    const t = terug.get(naam);
    const relMap = (e) => new Map((e.relaties || []).map((r) => [r.naam, r]));
    const orig = relMap(ent);
    const trg = relMap(t);
    assert.deepEqual([...trg.keys()].sort(), [...orig.keys()].sort(), `relaties van ${naam}`);
    for (const [relNaam, rel] of orig) {
      totaal += 1;
      const tr = trg.get(relNaam);
      assert.equal(tr.doelEntiteit, rel.doelEntiteit, `${naam}→${relNaam} doel`);
      assert.equal(tr.momentvoorkomen, rel.momentvoorkomen, `${naam}→${relNaam} momentvoorkomen`);
    }
  }
  assert.ok(totaal >= 1, "demo-model heeft relaties");
});

test("round-trip: enums, datatypes en referentielijsten overleven", () => {
  const { v3 } = roundTrip();
  const namen = (lijst, sleutel) => (lijst || []).map((x) => x[sleutel]).sort();

  assert.deepEqual(namen(v3.enums, "goType"), namen(demoV3Model.enums, "goType"), "enums");
  for (const e of demoV3Model.enums || []) {
    const t = (v3.enums || []).find((x) => x.goType === e.goType);
    assert.deepEqual(
      (t.waarden || []).map((w) => w.waarde),
      (e.waarden || []).map((w) => w.waarde),
      `waarden van ${e.goType}`
    );
  }

  assert.deepEqual(namen(v3.datatypes, "naam"), namen(demoV3Model.datatypes, "naam"), "datatypes");
  for (const dt of demoV3Model.datatypes || []) {
    const t = (v3.datatypes || []).find((x) => x.naam === dt.naam);
    assert.equal(t.basistype, dt.basistype, `basistype van ${dt.naam}`);
  }

  assert.deepEqual(
    namen(v3.referentielijstInstanties, "naam"),
    namen(demoV3Model.referentielijstInstanties, "naam"),
    "referentielijstInstanties"
  );
});

test("round-trip: meta (domeinen) gaat mee", () => {
  const { core, store2 } = roundTrip();
  assert.ok(core.meta, "vanCanoniekModel levert meta");
  assert.deepEqual(store2.domains, core.meta.domains, "domains terug in store");
});

// ─────────────────────── 2. Store-niveau ───────────────────────
// Dekt wat het demo-model mist: generalisatie, afgeleid veld met
// afleidingsregel, kardinaliteiten en compositie-structuur.

function maakBronState() {
  return {
    elements: {
      A: {
        id: "A",
        naam: "A",
        type: "entiteit",
        domein: "kern",
        data: {
          typenaam: "Persoon",
          isMaterieel: true,
          kleur: "#bfdbfe",
          velden: [{ naam: "bsn", type: "string", verplicht: true }],
          afgeleideVelden: [
            { naam: "leeftijd", goType: "integer", afleidingsregel: "jaren(geboortedatum)", afleidingsregelTaal: "cel" },
          ],
        },
      },
      B: {
        id: "B",
        naam: "B",
        type: "entiteit",
        domein: "kern",
        data: { typenaam: "Werknemer", velden: [] },
      },
      GE1: {
        id: "GE1",
        naam: "GE1",
        type: "gegevenselement",
        domein: "kern",
        data: {
          klassenaam: "Naam",
          momentvoorkomen: "enkelvoudig",
          velden: [{ naam: "roepnaam", type: "string", verplicht: false }],
        },
      },
      REL1: {
        id: "REL1",
        naam: "REL1",
        type: "relatie",
        domein: "kern",
        data: {
          typenaam: "werktBij",
          doelEntiteit: "B",
          bronKardinaliteit: "0..*",
          doelKardinaliteit: "1",
          momentvoorkomen: "meervoudig",
          velden: [],
        },
      },
    },
    structuralEdges: [
      { id: "se1", source: "A", target: "GE1", data: { momentvoorkomen: "enkelvoudig" } },
      { id: "se2", source: "A", target: "REL1", data: {} },
    ],
    diagrams: {
      overzicht: {
        id: "overzicht",
        naam: "Overzicht",
        nodes: [
          { elementId: "A", position: { x: 0, y: 0 } },
          { elementId: "B", position: { x: 400, y: 0 } },
          { elementId: "GE1", position: { x: 0, y: 200 } },
          { elementId: "REL1", position: { x: 200, y: 100 } },
        ],
        edges: [
          { id: "gen1", source: "B", target: "A", type: "metamodel", data: { isGeneralization: true } },
        ],
      },
    },
    domains: ["kern"],
    domainMeta: { kern: { kleur: "#eee" } },
    modelMeta: { versie: "v3", naam: "test" },
  };
}

test("store-round-trip: generalisatie, compositie en kardinaliteiten overleven", () => {
  const bron = maakBronState();
  const terug = naarCanoniekModel(vanCanoniekModel(bron));

  // Elementen terug op id, met kernvelden
  assert.equal(terug.elements.A.data.typenaam, "Persoon");
  assert.equal(terug.elements.A.data.velden[0].naam, "bsn");
  assert.equal(terug.elements.A.data.velden[0].verplicht, true);
  assert.equal(terug.elements.GE1.data.klassenaam, "Naam");
  assert.equal(terug.elements.GE1.data.velden[0].verplicht, false);

  // Afgeleid veld met regel
  const av = terug.elements.A.data.afgeleideVelden[0];
  assert.equal(av.naam, "leeftijd");
  assert.equal(av.afleidingsregel, "jaren(geboortedatum)");

  // Relatie: doel + kardinaliteiten + momentvoorkomen
  const rel = terug.elements.REL1.data;
  assert.equal(rel.doelEntiteit, "B");
  assert.equal(rel.bronKardinaliteit, "0..*");
  assert.equal(rel.doelKardinaliteit, "1");
  assert.equal(rel.momentvoorkomen, "meervoudig");

  // Structural edges: compositie A→GE1 en relatie-bron A→REL1
  const paren = terug.structuralEdges.map((e) => `${e.source}->${e.target}`).sort();
  assert.deepEqual(paren, ["A->GE1", "A->REL1"]);
  const se1 = terug.structuralEdges.find((e) => e.target === "GE1");
  assert.equal(se1.data.momentvoorkomen, "enkelvoudig", "edge-data van de compositie");

  // Generalisatie terug in het overzicht-diagram, gededupliceerd
  const gens = terug.diagrams.overzicht.edges.filter((e) => e.data?.isGeneralization);
  assert.equal(gens.length, 1);
  assert.equal(gens[0].source, "B");
  assert.equal(gens[0].target, "A");

  // Meta
  assert.deepEqual(terug.domains, ["kern"]);
  assert.equal(terug.modelMeta.naam, "test");
  assert.equal(terug.domainMeta.kern.kleur, "#eee");
});

// ─────────────────── 3. Volledige V3-route (exporteerV3/importeerV3) ───────────────────
// Regressie voor het "np-loc verdwijnt"-scenario: het default-diagram
// ("overzicht") kan in de praktijk hernoemd en samengesteld zijn (subset van
// elementen), terwijl een benoemd diagram alles bevat. De oude adapters
// beschouwen het default-diagram als afgeleid en gooien het weg; de
// serialisatie-helpers moeten het bewaren.

function maakBronStateMetTweeDiagrammen() {
  const bron = maakBronState();
  // Default-diagram hernoemd en gecureerd: alleen A + GE1.
  bron.diagrams.overzicht = {
    id: "overzicht",
    naam: "np-loc",
    nodes: [
      { elementId: "A", position: { x: 10, y: 20 } },
      { elementId: "GE1", position: { x: 10, y: 220 } },
    ],
    edges: [],
  };
  // Benoemd diagram met alles, inclusief de generalisatie-edge.
  bron.diagrams.d_alles = {
    id: "d_alles",
    naam: "Alles",
    nodes: [
      { elementId: "A", position: { x: 0, y: 0 } },
      { elementId: "B", position: { x: 400, y: 0 } },
      { elementId: "GE1", position: { x: 0, y: 200 } },
      { elementId: "REL1", position: { x: 200, y: 100 } },
    ],
    edges: [
      { id: "gen1", source: "B", target: "A", type: "metamodel", data: { isGeneralization: true } },
    ],
  };
  return bron;
}

test("V3-route: hernoemd default-diagram met subset overleeft export én import", () => {
  const core = vanCanoniekModel(maakBronStateMetTweeDiagrammen());
  const { v3 } = exporteerV3(core);
  const model = v3.model || v3;

  // Export bevat het default-diagram als gewone diagrammen-entry, met
  // element-verwijzingen hernoemd naar de canonieke V3-ids (A → Persoon).
  const def = (model.diagrammen || []).find((d) => d.id === "overzicht");
  assert.ok(def, "default-diagram zit in de export");
  assert.equal(def.naam, "np-loc");
  assert.deepEqual(def.nodes.map((n) => n.elementId).sort(), ["Persoon", "Persoon_Naam"]);

  const alles = (model.diagrammen || []).find((d) => d.id === "d_alles");
  assert.ok(alles, "benoemd diagram zit in de export");
  assert.equal(alles.nodes.length, 4);

  // Import zet het default-diagram terug (geen "alles-erop"-reconstructie)
  const core2 = importeerV3(v3);
  assert.equal(core2.diagrams.overzicht.naam, "np-loc");
  assert.deepEqual(
    core2.diagrams.overzicht.nodes.map((n) => n.elementId).sort(),
    ["Persoon", "Persoon_Naam"],
    "default-diagram houdt zijn eigen samenstelling"
  );
  assert.equal(core2.diagrams.d_alles.nodes.length, 4, "benoemd diagram blijft volledig");
});

test("V3-route: generalisatie (erft) overleeft ook een tweede export", () => {
  const core = vanCanoniekModel(maakBronStateMetTweeDiagrammen());
  const { v3 } = exporteerV3(core);
  const erftVan = (m) =>
    ((m.model || m).entiteiten || []).find((e) => e.typenaam === "Werknemer")?.erft;
  assert.equal(erftVan(v3), "Persoon", "eerste export");

  // Nog een keer door de molen: import → export.
  const { v3: v3b } = exporteerV3(importeerV3(v3));
  assert.equal(erftVan(v3b), "Persoon", "tweede export");
});

test("V3-route: import zonder overzicht-entry reconstrueert zoals voorheen", () => {
  // Oude-IDE-export (geen diagrammen-entry met id "overzicht"): de default
  // wordt afgeleid met alle elementen — bestaand gedrag blijft intact.
  const core = importeerV3(demoV3Model);
  const aantalElementen = Object.keys(core.elements).length;
  assert.ok(core.diagrams.overzicht.nodes.length >= aantalElementen - 1);
});

test("gegevenstype: validatie/normalisatie/weergave zijn bewerkbaar en winnen van de bron", () => {
  const bron = {
    elements: {
      DT1: {
        id: "DT1",
        naam: "DT1",
        type: "gegevenstype",
        domein: "register",
        data: {
          naam: "Postcode",
          basistype: "string",
          validatie: { pattern: "^[0-9]{4}$", maxLength: 4, foutmelding: "Ongeldig" },
          normalisatie: "trim",
          weergave: { placeholder: "1234" },
        },
      },
    },
    structuralEdges: [],
    diagrams: {
      overzicht: {
        id: "overzicht",
        naam: "Overzicht",
        nodes: [{ elementId: "DT1", position: { x: 0, y: 0 } }],
        edges: [],
      },
    },
  };
  const core = vanCanoniekModel(bron);

  // Heenreis: bewerkbare kopieën in element.data
  assert.equal(core.elements.DT1.data.validatie.pattern, "^[0-9]{4}$");
  assert.equal(core.elements.DT1.data.normalisatie, "trim");
  assert.equal(core.elements.DT1.data.weergave.placeholder, "1234");

  // 0.5-bewerking via de property-editors: pattern aangescherpt, masker erbij
  core.elements.DT1 = {
    ...core.elements.DT1,
    data: {
      ...core.elements.DT1.data,
      validatie: { pattern: "^[1-9][0-9]{3}\\s?[A-Z]{2}$", maxLength: 7 },
      weergave: { placeholder: "1234 AB", inputMask: "0000 AA" },
    },
  };

  const terug = naarCanoniekModel(core);
  assert.deepEqual(terug.elements.DT1.data.validatie, {
    pattern: "^[1-9][0-9]{3}\\s?[A-Z]{2}$",
    maxLength: 7,
  });
  assert.equal(terug.elements.DT1.data.normalisatie, "trim", "onbewerkt blijft uit de bron");
  assert.equal(terug.elements.DT1.data.weergave.inputMask, "0000 AA");

  // En helemaal door naar V3
  const v3 = storeNaarV3Model(terug);
  const dt = (v3.model || v3).datatypes.find((x) => x.naam === "Postcode");
  assert.equal(dt.validatie.pattern, "^[1-9][0-9]{3}\\s?[A-Z]{2}$");
  assert.equal(dt.weergave.inputMask, "0000 AA");
  assert.equal(dt.normalisatie, "trim");
});

test("store-round-trip: bewerking in 0.5 (delta) wint van de bron-spiegel", () => {
  const bron = maakBronState();
  const core = vanCanoniekModel(bron);

  // Simuleer een 0.5-bewerking: hernoem entiteit A en zet een veld optioneel.
  core.elements.A = { ...core.elements.A, naam: "Burger" };
  const comp = core.elements.A.compartimenten.find((c) => c.compartmentType === "velden");
  comp.velden[0] = { ...comp.velden[0], data: { ...comp.velden[0].data, verplicht: false } };

  const terug = naarCanoniekModel(core);
  assert.equal(terug.elements.A.data.typenaam, "Burger");
  assert.equal(terug.elements.A.naam, "Burger");
  assert.equal(terug.elements.A.data.velden[0].verplicht, false);
});
