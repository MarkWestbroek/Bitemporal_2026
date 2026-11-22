import { test } from "node:test";
import assert from "node:assert/strict";
import { vormNaarElement, elementNaarVorm, vormGebruik, weergaveProject, vormenUitProject, vormElementId } from "./weergaveProject.js";

const kent = () => true;

test("vorm → element → vorm is exact, ook met onbekende sleutels", () => {
  const st = { id: "bpmn-taak", renderer: "bpmn-taak", parameters: { hoekRadius: 10, inhoud: "naam" }, minMaat: { w: 120, h: 60 }, ankers: "rand", label: "Taak", extra: [1, 2] };
  const el = vormNaarElement(st);
  assert.equal(el.id, "wv_bpmn-taak");
  assert.equal(el.naam, "bpmn-taak");
  assert.deepEqual(el.data, { renderer: "bpmn-taak", parameters: st.parameters, minMaat: st.minMaat, ankers: "rand", overig: { label: "Taak", extra: [1, 2] } });
  assert.notEqual(el.data.parameters, st.parameters, "een kopie");
  assert.deepEqual(elementNaarVorm(el, { kentRenderer: kent }), { shapeType: st, fouten: [] });
  // Zonder optionele sleutels blijven die weg.
  assert.deepEqual(elementNaarVorm(vormNaarElement({ id: "x", renderer: "cirkel" }), { kentRenderer: kent }).shapeType, { id: "x", renderer: "cirkel" });
});

test("elementNaarVorm meldt een ongeldige vorm", () => {
  const leeg = elementNaarVorm({ naam: "", data: {} }, { kentRenderer: kent });
  assert.equal(leeg.shapeType, null);
  assert.ok(leeg.fouten.some((f) => /id ontbreekt/.test(f)));
  const onbekend = elementNaarVorm({ naam: "a", data: { renderer: "weg" } }, { kentRenderer: () => false });
  assert.deepEqual(onbekend.fouten, ['vorm "a": onbekende renderer "weg"']);
  const slechteMaat = elementNaarVorm({ naam: "b", data: { renderer: "r", minMaat: { w: "x" } } }, { kentRenderer: kent });
  assert.ok(slechteMaat.fouten.some((f) => /minMaat/.test(f)));
});

test("vormGebruik: shape, shape-sets en eigen vormen; zonder lijnen en superprofiel", () => {
  const gebruik = vormGebruik([
    { id: "a", label: "A", elementTypes: [{ id: "x", shape: "vorm-1" }, { id: "l", shape: "edge", isConnector: true }, { id: "n", shape: "note", _superprofiel: true }], shapeSets: [{ id: "s", shapes: { x: "vorm-2" } }] },
    { id: "b", label: "B", elementTypes: [{ id: "y", shape: "vorm-1" }], shapeTypes: [{ id: "vorm-3", renderer: "r" }] },
  ]);
  assert.deepEqual(Object.fromEntries(gebruik), { "vorm-1": ["A", "B"], "vorm-2": ["A"], "vorm-3": ["B"] });
});

test("weergaveProject: map per profiel, gedeeld en los; diagram per profiel met ook de gedeelde vormen", () => {
  const shapeTypes = ["vorm-1", "vorm-2", "vorm-3", "vrij"].map((id) => ({ id, renderer: "r" }));
  const descriptors = [
    { id: "a", label: "A", elementTypes: [{ id: "x", shape: "vorm-1" }, { id: "z", shape: "vorm-2" }] },
    { id: "b", label: "B", elementTypes: [{ id: "y", shape: "vorm-1" }, { id: "w", shape: "vorm-3" }] },
  ];
  const project = weergaveProject({ shapeTypes, descriptors, taalDescriptor: { versie: "0.1.0" } });
  assert.equal(project.project.id, "omnium-weergaven");
  assert.equal(project.profielVersies.weergave05, "0.1.0");
  const { mappen, plaatsing } = project.structuur;
  const mapVan = (shapeId) => mappen[plaatsing[`el::weergave05::${vormElementId(shapeId)}`]].naam;
  assert.deepEqual(["vorm-1", "vorm-2", "vorm-3", "vrij"].map(mapVan), ["Gedeeld", "A", "B", "Niet in een profiel"]);
  const model = project.profielen.weergave05;
  const opDiagram = (naam) => Object.values(model.diagrams).find((d) => d.naam === naam).nodes.map((n) => model.elements[n.elementId].naam);
  assert.deepEqual(opDiagram("Vormen van A"), ["vorm-1", "vorm-2"]);
  assert.deepEqual(opDiagram("Vormen van B"), ["vorm-1", "vorm-3"]);
  assert.deepEqual(opDiagram("Gedeelde vormen"), ["vorm-1"]);
  // En terug.
  assert.deepEqual(vormenUitProject(model, { kentRenderer: kent }), { shapeTypes, fouten: [] });
});

test("vormenUitProject: dubbele id wordt gemeld, iconen tellen niet mee", () => {
  const elements = {
    a: { naam: "v", elementType: "vorm", data: { renderer: "r" } },
    b: { naam: "v", elementType: "vorm", data: { renderer: "r" } },
    c: { naam: "i", elementType: "icoon", data: { svg: "<svg/>" } },
  };
  const uit = vormenUitProject({ elements }, { kentRenderer: kent });
  assert.deepEqual(uit.shapeTypes, [{ id: "v", renderer: "r" }]);
  assert.deepEqual(uit.fouten, ['vorm "v" staat twee keer in het project']);
});
