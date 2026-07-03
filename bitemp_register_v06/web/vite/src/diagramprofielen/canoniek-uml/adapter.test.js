// adapter.test.js — tests voor de canoniek-uml → diagramcore afbeelding.
// Run: npm test  (vanuit web/vite/; node --test)

import test from "node:test";
import assert from "node:assert/strict";

import { vanCanoniekModel, presentatieVoorEdge } from "./adapter.js";
import { CANONIEK_UML_ID, canoniekUmlDiagramType } from "./index.js";

/** Kleine representatieve store-state (vorm van useModelStore). */
function maakBronState() {
  return {
    elements: {
      A: {
        id: "A",
        naam: "A",
        type: "entiteit",
        domein: "kern",
        data: {
          typenaam: "NatuurlijkPersoon",
          isMaterieel: true,
          kleur: "#bfdbfe",
          velden: [
            { naam: "weergavenaam", type: "string", verplicht: true, afgeleid: true },
            { naam: "leeftijd", type: "integer", verplicht: false },
          ],
        },
      },
      A_U: {
        id: "A_U",
        naam: "A_U",
        type: "gegevenselement",
        domein: "kern",
        data: {
          typenaam: "Burgerschap",
          naamLabelHeen: "heeft",
          velden: [{ naam: "landcode", type: "string", verplicht: true, format: "" }],
        },
      },
      Geslacht: {
        id: "Geslacht",
        naam: "Geslacht",
        type: "enumeratie",
        domein: "kern",
        data: { naam: "Geslacht", waarden: ["M", "V", ""] },
      },
      anker_REL: {
        id: "anker_REL",
        naam: "anker_REL",
        type: "associatieAnker",
        domein: "",
        data: { relatieNaam: "REL" },
      },
      REL: {
        id: "REL",
        naam: "REL",
        type: "relatie",
        domein: "kern",
        data: { typenaam: "Bereikbaarheid", naamLabelTerug: "van", velden: [{ naam: "soort", type: "string", verplicht: true }] },
      },
    },
    diagrams: {
      overzicht: {
        id: "overzicht",
        naam: "Overzicht",
        nodes: [
          { elementId: "A", position: { x: 0, y: 0 } },
          { elementId: "A_U", position: { x: 0, y: 200 }, layoutLocked: true },
          { elementId: "Geslacht", position: { x: 300, y: 200 } },
          { elementId: "weg", position: { x: 1, y: 1 } }, // element bestaat niet meer
        ],
        edges: [
          {
            id: "A->A_U",
            source: "A",
            target: "A_U",
            type: "metamodel",
            data: { rolnaam: "burgerschap", kardinaliteit: "0..1", momentvoorkomen: "enkelvoudig" },
          },
        ],
        viewport: { x: 10, y: 20, zoom: 0.8 },
      },
    },
  };
}

test("vanCanoniekModel: elementen krijgen compartimenten en weergavenaam", () => {
  const core = vanCanoniekModel(maakBronState());
  assert.equal(core.diagramTypeId, CANONIEK_UML_ID);

  const a = core.elements.A;
  assert.equal(a.naam, "NatuurlijkPersoon");
  assert.equal(a.elementType, "entiteit");
  assert.equal(a.data.materieel, true);
  const velden = a.compartimenten.find((c) => c.compartmentType === "velden").velden;
  assert.equal(velden.length, 2);
  assert.equal(velden[0].data.afgeleid, true);
  assert.equal(velden[1].data.verplicht, false);
  assert.equal(velden[1].data.typeLabel, "integer");

  // Enumeratie: lege waarden weggefilterd
  const enumWaarden = core.elements.Geslacht.compartimenten[0].velden;
  assert.deepEqual(enumWaarden.map((v) => v.naam), ["M", "V"]);
});

test("vanCanoniekModel: diagram-nodes met verdwenen elementen worden overgeslagen", () => {
  const core = vanCanoniekModel(maakBronState());
  const d = core.diagrams.overzicht;
  assert.equal(d.nodes.length, 3);
  assert.equal(d.nodes.find((n) => n.elementId === "A_U").layoutLocked, true);
  assert.deepEqual(d.viewport, { x: 10, y: 20, zoom: 0.8 });
});

test("presentatie: compositie ENT→GE krijgt ruit + labels aan doelzijde", () => {
  const state = maakBronState();
  const edge = state.diagrams.overzicht.edges[0];
  const p = presentatieVoorEdge(edge, state.elements);
  assert.equal(p.markerStart, "ruit");
  const rolLabel = p.labels.find((l) => l.delen.some((x) => x.soort === "rolnaam"));
  assert.equal(rolLabel.zijde, "doel");
  assert.ok(rolLabel.delen.some((x) => x.tekst === "{enkelvoudig}"));
  // heen-label van het GE-element wordt meegenomen
  const naamLabel = p.labels.find((l) => l.delen.some((x) => x.soort === "naam"));
  assert.equal(naamLabel.delen[0].tekst, "▶ heeft");
});

test("presentatie: dependency en generalisatie", () => {
  const state = maakBronState();
  const dep = presentatieVoorEdge({ source: "A_U", target: "Geslacht", data: { isDependency: true } }, state.elements);
  assert.equal(dep.lijn, "dash-6-3");
  assert.equal(dep.markerEnd, "pijl-open");
  assert.equal(dep.labels[0].delen[0].tekst, "«use»");

  const gen = presentatieVoorEdge({ source: "A", target: "A", data: { isGeneralization: true } }, state.elements);
  assert.equal(gen.markerEnd, "driehoek");
  assert.equal(gen.labels[0].delen[0].tekst, "«Generalisatie»");
});

test("referenceResolvers: kandidaten per ReferenceType, met groep en icoon (§4.5b)", () => {
  const core = vanCanoniekModel(maakBronState());
  const alle = canoniekUmlDiagramType.referenceTypes.flatMap((rt) =>
    canoniekUmlDiagramType.referenceResolvers[rt.id]({ elements: core.elements })
  );
  // Basistypen altijd aanwezig, zonder icoon
  assert.ok(alle.some((k) => k.waarde === "string" && k.groep === "Basistypen" && !k.icoon));
  // Enumeratie uit het model, met ◇ en eigen groep
  const geslacht = alle.find((k) => k.waarde === "Geslacht");
  assert.equal(geslacht.icoon, "◇");
  assert.equal(geslacht.groep, "Enumeraties");
  // Geen gegevenstypen in deze fixture → bron levert leeg, geen fout
  assert.ok(!alle.some((k) => k.groep === "Gegevenstypen"));
});

test("fase 3B: REL wordt teruggevouwen tot connector-element", () => {
  const state = maakBronState();
  state.structuralEdges = [{ id: "se1", source: "A", target: "REL" }];
  state.elements.REL.data.doelEntiteit = "A"; // zelf-relatie voor de test
  state.diagrams.overzicht.nodes.push(
    { elementId: "REL", position: { x: 300, y: 300 } },
    { elementId: "anker_REL", position: { x: 250, y: 150 } }
  );
  state.diagrams.overzicht.edges.push(
    { id: "A->anker", source: "A", target: "anker_REL", data: { isAssociation: true } },
    { id: "anker->A", source: "anker_REL", target: "A", data: { isAssociation: true } },
    { id: "anker-->REL", source: "anker_REL", target: "REL", data: { isAssociationClassLink: true } },
    { id: "REL-->enum", source: "REL", target: "Geslacht", data: { isDependency: true } }
  );

  const core = vanCanoniekModel(state);
  // Anker-element verdwenen; REL is connector met bron/doel + kardinaliteiten
  assert.equal(core.elements.anker_REL, undefined);
  const rel = core.elements.REL;
  assert.equal(rel.source, "A");
  assert.equal(rel.target, "A");
  assert.equal(rel.data.doelKardinaliteit, "0..*");
  assert.equal(rel.data.naamLabelTerug, "van");

  const d = core.diagrams.overzicht;
  // Anker-node weg; ankerPosition verhuisd naar het REL-lidmaatschap
  assert.ok(!d.nodes.some((n) => n.elementId === "anker_REL"));
  assert.deepEqual(d.nodes.find((n) => n.elementId === "REL").ankerPosition, { x: 250, y: 150 });
  // ASOC-edges gestript; «use» vanaf de (velden-hebbende) REL blijft
  const edgeIds = d.edges.map((e) => e.id);
  assert.ok(!edgeIds.includes("A->anker") && !edgeIds.includes("anker-->REL"));
  assert.ok(edgeIds.includes("REL-->enum"));
});

test("presentatie: ASOC-edges — anker-zijden, class-link en terug-label", () => {
  const state = maakBronState();
  // Edge 1: ENT → anker (labels bij bron, heen-label bij doel)
  const e1 = presentatieVoorEdge(
    { source: "A", target: "anker_REL", data: { isAssociation: true, kardinaliteit: "0..*" } },
    state.elements
  );
  assert.equal(e1.labels.find((l) => l.delen.some((x) => x.soort === "kardinaliteit")).zijde, "bron");

  // Edge 2: anker → ENT — terug-label komt van de relatie via het anker
  const e2 = presentatieVoorEdge(
    { source: "anker_REL", target: "A", data: { isAssociation: true, directioneel: true } },
    state.elements
  );
  assert.equal(e2.markerEnd, "pijl-open");
  const terug = e2.labels.find((l) => l.delen.some((x) => x.soort === "naam"));
  assert.equal(terug.delen[0].tekst, "◀ van");

  // Class-link: dashed, geen labels
  const link = presentatieVoorEdge(
    { source: "anker_REL", target: "REL", data: { isAssociationClassLink: true } },
    state.elements
  );
  assert.equal(link.lijn, "dash-4-3");
  assert.equal(link.labels.length, 0);
});
