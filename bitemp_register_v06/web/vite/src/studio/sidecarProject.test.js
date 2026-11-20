// sidecarProject.test.js — profielen en transformaties als één project (PROF-1, Mark 18/19-11).
import test from "node:test";
import assert from "node:assert/strict";
import { sidecarProject, SIDECAR_PROJECT_ID, TRANSFORMATIE_ACTIVITEIT_ID } from "./sidecarProject.js";
import { M3_PROFIEL_ID } from "./activities/m3Profiel.js";
import { bouwProfielUitOntwerp } from "./activities/profielOntwerp.js";
import { modelNaarRegelset, transformatieId } from "../transformatie/regelsetModel.js";
import { normaliseerProjectData } from "./activities/projectSync.js";

const ERD = {
  id: "erd",
  label: "ERD",
  versie: "1.1.0",
  style: "uml-klassiek",
  fieldTypes: [{ id: "kolom", viewer: "naam-type", properties: [{ key: "naam", datatype: "string", verplicht: true }] }],
  elementTypes: [
    { id: "entiteit", label: "Entiteit", shape: "class-box", kort: "ENT", properties: [], compartments: [{ id: "kolommen", label: null, fieldType: "kolom" }] },
    { id: "relatie", label: "Relatie", shape: "edge", isConnector: true, bron: { elementTypes: ["entiteit"] }, doel: { elementTypes: ["entiteit"] }, edgePresentatie: { lijn: "solid" } },
  ],
  taakbalken: [],
};
const UC = {
  id: "usecase",
  label: "Use case",
  style: "uml-klassiek",
  fieldTypes: [],
  elementTypes: [{ id: "actor", label: "Actor", shape: "class-box", properties: [] }],
};
const REGELSET = { id: "mermaid-naar-usecase", versie: 1, titel: "Mermaid → use case", bron: "mermaid-flowchart", doel: "usecase", regels: [{ naam: "actor", bij: "knoop", maak: { type: "actor" } }] };

test("het sidecar-project: een map per profiel, de transformaties apart, een geldig werkbestand", () => {
  const project = sidecarProject({ descriptors: [UC, ERD], vermeldingen: [{ regelset: REGELSET, richting: "import" }], taalDescriptors: { m3: { versie: "1.0.0" }, transformatie: { versie: "1.0.0" } } });
  assert.equal(project.project.id, SIDECAR_PROJECT_ID);
  const uit = normaliseerProjectData(JSON.parse(JSON.stringify(project)));
  assert.equal(uit.ok, true);
  assert.deepEqual(Object.keys(project.profielen), [M3_PROFIEL_ID, TRANSFORMATIE_ACTIVITEIT_ID]);
  assert.deepEqual(project.profielVersies, { [M3_PROFIEL_ID]: "1.0.0", [TRANSFORMATIE_ACTIVITEIT_ID]: "1.0.0" });

  // Mappen: Profielen met per profiel een submap (op naam), en Transformaties.
  const mappen = Object.values(project.structuur.mappen);
  const profielen = mappen.find((m) => m.naam === "Profielen");
  assert.deepEqual(mappen.filter((m) => m.ouderId === profielen.id).map((m) => m.naam), ["ERD", "Use case"]);
  assert.ok(mappen.some((m) => m.naam === "Transformaties" && m.ouderId === null));
  // Elk diagram en elk getekend element staat in een map.
  const m3 = project.profielen[M3_PROFIEL_ID];
  for (const id of Object.keys(m3.diagrams)) assert.ok(project.structuur.plaatsing[`${M3_PROFIEL_ID}::${id}`], id);
  for (const d of Object.values(m3.diagrams)) for (const n of d.nodes) assert.ok(project.structuur.plaatsing[`el::${M3_PROFIEL_ID}::${n.elementId}`], n.elementId);
});

test("uit het project komt elk profiel en elke regelset terug", () => {
  const project = JSON.parse(JSON.stringify(sidecarProject({ descriptors: [ERD], vermeldingen: [{ regelset: REGELSET, richting: "import" }] })));
  const m3 = project.profielen[M3_PROFIEL_ID];
  const diagram = m3.diagrams.dg_erd;
  const opDiagram = new Set(diagram.nodes.map((n) => n.elementId));
  const elementen = Object.fromEntries(Object.entries(m3.elements).filter(([id, el]) => opDiagram.has(id) || (opDiagram.has(el.source) && opDiagram.has(el.target))));
  const kern = bouwProfielUitOntwerp({ elements: elementen, m3Profiel: diagram.m3Profiel }, { id: "erd", label: "ERD" });
  assert.deepEqual(JSON.parse(JSON.stringify(kern.elementTypes)), ERD.elementTypes);
  assert.deepEqual(kern.fieldTypes, ERD.fieldTypes);
  assert.equal(kern.versie, "1.1.0");

  const tr = project.profielen[TRANSFORMATIE_ACTIVITEIT_ID];
  assert.deepEqual(modelNaarRegelset(tr.elements[transformatieId(REGELSET.id)], tr.elements).regelset, REGELSET);
});

test("de id's zijn vast: twee exports geven dezelfde elementen", () => {
  const a = sidecarProject({ descriptors: [ERD, UC] });
  const b = sidecarProject({ descriptors: [UC, ERD] });
  assert.deepEqual(Object.keys(a.profielen[M3_PROFIEL_ID].elements).sort(), Object.keys(b.profielen[M3_PROFIEL_ID].elements).sort());
  assert.deepEqual(a.structuur, b.structuur);
  assert.equal(a.profielen[TRANSFORMATIE_ACTIVITEIT_ID], undefined, "zonder regelsets geen transformaties");
});
