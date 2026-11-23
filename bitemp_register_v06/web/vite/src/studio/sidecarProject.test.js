// sidecarProject.test.js — profielen en transformaties als één project (PROF-1, Mark 18/19-11).
import test from "node:test";
import assert from "node:assert/strict";
import { sidecarProject, SIDECAR_PROJECT_ID, TRANSFORMATIE_ACTIVITEIT_ID } from "./sidecarProject.js";
import { M3_PROFIEL_ID } from "./activities/m3Profiel.js";
import { bouwProfielUitOntwerp } from "./activities/profielOntwerp.js";
import { PROFIEL_TYPE, ledenVan, ontwerpStaatVan } from "./activities/profielContainer.js";
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

test("het sidecar-project: een Profiel-container per profiel, de transformaties apart, een geldig werkbestand", () => {
  const project = sidecarProject({ descriptors: [UC, ERD], vermeldingen: [{ regelset: REGELSET, richting: "in" }], taalDescriptors: { m3: { versie: "1.0.0" }, transformatie: { versie: "1.0.0" } } });
  assert.equal(project.project.id, SIDECAR_PROJECT_ID);
  const uit = normaliseerProjectData(JSON.parse(JSON.stringify(project)));
  assert.equal(uit.ok, true);
  assert.deepEqual(Object.keys(project.profielen), [M3_PROFIEL_ID, TRANSFORMATIE_ACTIVITEIT_ID]);
  assert.deepEqual(project.profielVersies, { [M3_PROFIEL_ID]: "1.0.0", [TRANSFORMATIE_ACTIVITEIT_ID]: "1.0.0" });

  // Map Profielen met per groep een map (Mark 23-11) en per profiel een Profiel-element (de
  // container, Mark 22-11), en Transformaties met in, tussen en uit.
  const mappen = Object.values(project.structuur.mappen);
  const profielen = mappen.find((m) => m.naam === "Profielen");
  const naam = (id) => project.structuur.mappen[id]?.naam;
  const transformaties = mappen.find((m) => m.naam === "Transformaties" && m.ouderId === null);
  assert.ok(transformaties);
  assert.deepEqual(mappen.filter((m) => m.ouderId === transformaties.id).map((m) => m.naam), ["In", "Tussen", "Uit"]);
  const m3 = project.profielen[M3_PROFIEL_ID];
  const containers = Object.values(m3.elements).filter((e) => e.elementType === PROFIEL_TYPE);
  assert.deepEqual(containers.map((c) => c.naam).sort(), ["ERD", "Use case"]);
  for (const c of containers) {
    const mapId = project.structuur.plaatsing[`el::${M3_PROFIEL_ID}::${c.id}`];
    assert.equal(naam(mapId), c.naam === "ERD" ? "Gegevensmodellering" : "Dynamisch", "het Profiel staat in zijn groep");
    const ouder = project.structuur.mappen[mapId].ouderId;
    assert.ok(ouder === profielen.id || project.structuur.mappen[ouder].ouderId === profielen.id, "de groep hangt onder Profielen");
    assert.ok(c.data["m3:id"], "de kop staat op het Profiel");
  }
  // Elk diagram is een view onder zijn Profiel; geen m3Profiel meer op het diagram.
  for (const d of Object.values(m3.diagrams)) {
    assert.equal(project.structuur.plaatsing[`${M3_PROFIEL_ID}::${d.id}`], `el::${M3_PROFIEL_ID}::${d.profiel}`);
    assert.equal(d.m3Profiel, undefined);
  }
  // Elk element op een diagram hoort bij zijn profiel (bevat of ◆).
  for (const c of containers) {
    const leden = ledenVan(c, m3);
    for (const d of Object.values(m3.diagrams).filter((d) => d.profiel === c.id)) for (const n of d.nodes) assert.ok(leden[n.elementId], n.elementId);
  }
  // De transformatie is een container (uitwerking) in de map In, met bron, doel en diagram eronder.
  const tId = transformatieId(REGELSET.id);
  const el = (id) => `el::${TRANSFORMATIE_ACTIVITEIT_ID}::${id}`;
  assert.equal(naam(project.structuur.plaatsing[el(tId)]), "In");
  const tr = project.profielen[TRANSFORMATIE_ACTIVITEIT_ID];
  const onder = Object.entries(project.structuur.plaatsing).filter(([, ouder]) => ouder === el(tId)).map(([k]) => k).sort();
  assert.deepEqual(onder, [el(`${tId}__bron`), el(`${tId}__doel`), `${TRANSFORMATIE_ACTIVITEIT_ID}::dg_${tId}`].sort());
  assert.deepEqual(tr.diagrams[`dg_${tId}`].nodes.map((n) => n.elementId).sort(), [tId, `${tId}__bron`, `${tId}__doel`].sort());
  assert.equal(tr.elements[`${tId}__doel`].elementType, "taal", "usecase is een profiel");
  assert.equal(tr.elements[`${tId}__bron`].elementType, "formaat");
});

test("een profiel dat geen groep heeft, komt in Overig", () => {
  const project = sidecarProject({ descriptors: [{ ...ERD, id: "eigen", label: "Eigen" }] });
  const m3 = project.profielen[M3_PROFIEL_ID];
  const c = Object.values(m3.elements).find((e) => e.elementType === PROFIEL_TYPE);
  assert.equal(project.structuur.mappen[project.structuur.plaatsing[`el::${M3_PROFIEL_ID}::${c.id}`]].naam, "Overig");
  assert.deepEqual(Object.values(project.structuur.mappen).map((m) => m.naam).sort(), ["Overig", "Profielen"]);
});

test("uit het project komt elk profiel en elke regelset terug", () => {
  const project = JSON.parse(JSON.stringify(sidecarProject({ descriptors: [ERD], vermeldingen: [{ regelset: REGELSET, richting: "in" }] })));
  const m3 = project.profielen[M3_PROFIEL_ID];
  const profiel = Object.values(m3.elements).find((e) => e.elementType === PROFIEL_TYPE);
  const kern = bouwProfielUitOntwerp(ontwerpStaatVan(profiel, m3), { id: "erd", label: "ERD" });
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
