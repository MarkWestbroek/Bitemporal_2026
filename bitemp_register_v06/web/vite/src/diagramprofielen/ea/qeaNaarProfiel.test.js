// qeaNaarProfiel.test.js — de gegevensgestuurde EA-lezer op de tabellen van M3-MOF.
// Fixtures uit het GGM: component "[GEB/Functie] Juridische gebeurtenissen" (2070),
// object "[objectmodel] Rol voorbeelden (NP)" (1940), requirements "Validaties opvoeren
// natuurlijk persoon" (1813, Custom + MDG Requirements). Communication en xsd synthetisch.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/ea/qeaNaarProfiel.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { qeaNaarProfiel, zoekObjectRij, zoekConnectorRij } from "./qeaNaarProfiel.js";
import { EA_PROFIELEN } from "./eaProfielen.js";

const hier = dirname(fileURLToPath(import.meta.url));
const fixture = (naam) => JSON.parse(readFileSync(join(hier, "fixtures", naam), "utf8"));
const van = (model, type) => Object.values(model.elements).filter((e) => e.elementType === type);

test("tabellen: specifieke rij (met stereotype) wint van de algemene; onbekend → null", () => {
  const { OBJECTEN, CONNECTOREN } = EA_PROFIELEN.componentDeployment.mapping;
  assert.equal(zoekObjectRij(OBJECTEN, "Node", ["device"]).elementType, "device");
  assert.equal(zoekObjectRij(OBJECTEN, "Node", ["«Device»"]).elementType, "device", "trema/hoofdletters doen niet mee");
  assert.equal(zoekObjectRij(OBJECTEN, "Node", []).elementType, "node");
  assert.equal(zoekObjectRij(OBJECTEN, "Swimlane", []), null);
  assert.equal(zoekConnectorRij(CONNECTOREN, "Dependency", "use").elementType, "gebruikt");
  assert.equal(zoekConnectorRij(CONNECTOREN, "Dependency", "asynchroon").elementType, "dependency");
});

test("component-deployment: componenten, poorten als rand-element, assembly en dependencies met stereotype-label", () => {
  const model = qeaNaarProfiel(fixture("component-geb.qea.json"), { packageId: 1868, profiel: EA_PROFIELEN.componentDeployment, schaal: 1 });
  assert.equal(Object.keys(model.diagrams).length, 1);
  assert.ok(van(model, "component").length >= 5, "componenten (ook Class«Objecttype» als verwijzing)");
  const poorten = van(model, "poort");
  assert.ok(poorten.length >= 3);
  assert.ok(poorten.every((p) => p.data.randVan && model.elements[p.data.randVan]), "poort hangt aan zijn gastheer");
  const d = Object.values(model.diagrams)[0];
  const poortNode = d.nodes.find((n) => n.elementId === poorten[0].id);
  assert.ok(poortNode && !poortNode.size, "rand-element: relatieve positie, geen maat");
  const deps = van(model, "dependency");
  assert.ok(deps.some((x) => x.data.stereotype), "stereotype van een dependency reist mee als label");
  assert.ok(van(model, "assembly").length + van(model, "gebruikt").length + van(model, "realisatie").length > 0);
  // EA's ProvidedInterface (lollipop op een poort) → interface + realisatie vanaf de gastheer.
  const interfaces = van(model, "interface");
  assert.equal(interfaces.length, 3, "ProvidedInterface«api» ×3");
  assert.equal(van(model, "realisatie").length, 3);
  assert.ok(model.verslag.overgeslagen["ProvidedInterface«api»"] === undefined);
});

test("object: objecten met klassifier en slots uit RunState; Aggregation Strong = compositie, anders link", () => {
  const model = qeaNaarProfiel(fixture("object-rol-np.qea.json"), { packageId: 1729, profiel: EA_PROFIELEN.object, schaal: 1 });
  const objecten = van(model, "object");
  assert.ok(objecten.length >= 20);
  assert.ok(objecten.some((o) => o.data.klassifierLabel), "Classifier → klassifierLabel");
  const metSlots = objecten.find((o) => o.compartimenten.some((c) => c.compartmentType === "slots"));
  assert.ok(metSlots, "RunState → slots");
  assert.ok(metSlots.compartimenten[0].velden.every((v) => v.fieldType === "slot" && v.naam));
  assert.ok(van(model, "compositie").length >= 10, "Aggregation Strong");
  assert.ok(van(model, "link").length >= 5);
  // Generalization tussen klassen-op-het-objectdiagram: M3-MOF voegde `generalisatie` toe (10-10).
  assert.ok(van(model, "generalisatie").length >= 9);
});

test("requirements: Custom-diagram met MDG Requirements; velden uit Alias/Note/Status/PDATA2/PDATA3; realisatie naar een use case", () => {
  const bron = fixture("requirements-validaties.qea.json");
  const model = qeaNaarProfiel(bron, { packageId: 1604, profiel: EA_PROFIELEN.requirements, schaal: 1 });
  assert.equal(Object.keys(model.diagrams).length, 1, "Custom + MDGDgm Requirements telt als requirementsdiagram");
  const reqs = van(model, "requirement");
  assert.equal(reqs.length, 75);
  const r = reqs.find((x) => x.data.tekst);
  assert.ok(r, "Note → tekst");
  assert.equal(r.data.status, "proposed");
  assert.equal(r.data.prioriteit, "medium");
  assert.ok(["low", "medium", "high"].includes(r.data.moeilijkheid));
  assert.equal(r.data.soort, "functional");
  assert.equal(r.data.stereotype, undefined, "stereotype is de soort geworden");
  assert.equal(r.data.notes, undefined, "Note is de tekst, niet ook nog notes");
  const uc = van(model, "verwijzing");
  assert.equal(uc.length, 1);
  assert.equal(uc[0].data.stereotype, "use case");
  assert.equal(van(model, "realisatie").length, 75);
});

test("communication: EA-berichten (één connector per bericht) gevouwen tot links met een berichten-compartiment", () => {
  const g = (n) => `{00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}}`;
  const bron = {
    t_package: [{ Package_ID: 1, Parent_ID: 0, Name: "P", ea_guid: g(90) }],
    t_object: [
      { Object_ID: 1, Object_Type: "Object", Name: "", Classifier: 3, Package_ID: 1, ea_guid: g(1) },
      { Object_ID: 2, Object_Type: "Actor", Name: "Klant", Package_ID: 1, ea_guid: g(2) },
    ],
    classifiers: [{ Object_ID: 3, Name: "Balie", Object_Type: "Class" }],
    t_connector: [
      { Connector_ID: 11, Connector_Type: "Sequence", Name: "vraag", SeqNo: 1, Start_Object_ID: 2, End_Object_ID: 1, PDATA1: "Synchronous", ea_guid: g(11), DiagramID: 5 },
      { Connector_ID: 12, Connector_Type: "Sequence", Name: "antwoord", SeqNo: 2, Start_Object_ID: 1, End_Object_ID: 2, PDATA1: "Asynchronous", ea_guid: g(12), DiagramID: 5 },
    ],
    t_diagram: [{ Diagram_ID: 5, Package_ID: 1, Diagram_Type: "Collaboration", Name: "Comm", ea_guid: g(50) }],
    t_diagramobjects: [
      { Diagram_ID: 5, Object_ID: 1, RectLeft: 0, RectTop: 0, RectRight: 100, RectBottom: -50, Sequence: 1 },
      { Diagram_ID: 5, Object_ID: 2, RectLeft: 300, RectTop: 0, RectRight: 400, RectBottom: -50, Sequence: 2 },
    ],
    t_diagramlinks: [],
  };
  const model = qeaNaarProfiel(bron, { packageId: 1, profiel: EA_PROFIELEN.communication, schaal: 1 });
  const links = van(model, "link");
  assert.equal(links.length, 1, "twee berichten tussen hetzelfde paar → één link");
  const comp = links[0].compartimenten[0];
  assert.equal(comp.compartmentType, "berichten");
  assert.deepEqual(comp.velden.map((v) => [v.naam, v.data.typeLabel]), [["1", "→ vraag"], ["2", "← antwoord"]]);
  assert.equal(comp.velden[1].data.soort, "asynchroon");
  const obj = van(model, "object")[0];
  assert.equal(obj.data.klassifierLabel, "Balie");
  assert.equal(van(model, "actor").length, 1);
});

test("xsd: alleen Logical-diagrammen met MDG XSD; complexType met elementen/attributen, tagged values op het schema", () => {
  const g = (n) => `{00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}}`;
  const bron = {
    t_package: [{ Package_ID: 1, Parent_ID: 0, Name: "P", ea_guid: g(90) }],
    t_object: [
      { Object_ID: 1, Object_Type: "Package", Name: "adres.xsd", Stereotype: "XSDschema", Package_ID: 1, ea_guid: g(1) },
      { Object_ID: 2, Object_Type: "Class", Name: "Adres", Stereotype: "XSDcomplexType", Package_ID: 1, ParentID: 1, ea_guid: g(2) },
      { Object_ID: 3, Object_Type: "Class", Name: "Postcode", Stereotype: "XSDsimpleType", Package_ID: 1, ea_guid: g(3) },
    ],
    t_attribute: [
      { Object_ID: 2, Name: "straat", Type: "xs:string", LowerBound: "1", UpperBound: "1", ID: 1, Pos: 0 },
      { Object_ID: 2, Name: "huisnummers", Type: "xs:int", LowerBound: "0", UpperBound: "*", ID: 2, Pos: 1 },
      { Object_ID: 2, Name: "id", Type: "xs:ID", Stereotype: "XSDattribute", ID: 3, Pos: 2 },
      { Object_ID: 3, Name: "pattern", Default: "[1-9][0-9]{3}[A-Z]{2}", ID: 4, Pos: 0 },
    ],
    t_objectproperties: [{ Object_ID: 1, Property: "targetNamespace", Value: "urn:adres" }, { Object_ID: 3, Property: "base", Value: "xs:string" }],
    t_connector: [{ Connector_ID: 7, Connector_Type: "Association", Start_Object_ID: 2, End_Object_ID: 3, DestRole: "postcode", DestCard: "0..1", ea_guid: g(7) }],
    t_diagram: [
      { Diagram_ID: 5, Package_ID: 1, Diagram_Type: "Logical", Name: "Adres", StyleEx: "MDGDgm=XSD::XML Schema;", ea_guid: g(50) },
      { Diagram_ID: 6, Package_ID: 1, Diagram_Type: "Logical", Name: "Gewoon", StyleEx: "", ea_guid: g(51) },
    ],
    t_diagramobjects: [1, 2, 3].map((id, i) => ({ Diagram_ID: 5, Object_ID: id, RectLeft: i * 200, RectTop: 0, RectRight: i * 200 + 150, RectBottom: -80, Sequence: i + 1 })),
    t_diagramlinks: [],
  };
  const model = qeaNaarProfiel(bron, { packageId: 1, profiel: EA_PROFIELEN.xsd, schaal: 1 });
  assert.equal(Object.keys(model.diagrams).length, 1, "het kale Logical-diagram is niet van xsd");
  const schema = van(model, "schema")[0];
  assert.equal(schema.data.targetNamespace, "urn:adres");
  const adres = van(model, "complexType")[0];
  const elementen = adres.compartimenten.find((c) => c.compartmentType === "elementen").velden;
  assert.deepEqual(elementen.map((v) => [v.naam, v.data.typeLabel, v.data.minOccurs, v.data.maxOccurs]), [["straat", "xs:string", "1", "1"], ["huisnummers", "xs:int", "0", "unbounded"]]);
  assert.equal(adres.compartimenten.find((c) => c.compartmentType === "attributen").velden[0].fieldType, "xsAttribute");
  assert.ok(Object.values(model.elements).some((e) => e.elementType === "bevat" && e.source === schema.id && e.target === adres.id), "schema is container");
  const simple = van(model, "simpleType")[0];
  assert.equal(simple.data.base, "xs:string");
  assert.equal(simple.compartimenten[0].velden[0].data.typeLabel, "[1-9][0-9]{3}[A-Z]{2}");
  const vt = van(model, "vanType")[0];
  assert.equal(vt.data.rolnaam, "postcode");
  assert.deepEqual([vt.data.minOccurs, vt.data.maxOccurs], ["0", "1"]);
});
