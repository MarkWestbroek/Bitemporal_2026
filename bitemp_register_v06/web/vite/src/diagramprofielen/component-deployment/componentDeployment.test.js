// componentDeployment.test.js — descriptor geldig, overerving/bereik, EA-tabel sluitend.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/component-deployment/componentDeployment.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { valideerDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { normaliseerErfenis, kopieVoorNormalisatie } from "../../diagramcore/types/erfenis.js";
import { componentDeploymentDiagramType, elementTypes } from "./descriptor.js";
import { OBJECTEN, CONNECTOREN, RAND_ELEMENTEN, CONTAINERS, elementTypeVoorObject, elementTypeVoorConnector } from "./eaMapping.js";

const genormaliseerd = () => {
  const dt = kopieVoorNormalisatie(componentDeploymentDiagramType);
  assert.deepEqual(normaliseerErfenis(dt), []);
  return dt;
};
const et = (dt, id) => dt.elementTypes.find((t) => t.id === id);

test("descriptor is geldig volgens het M3-contract", () => {
  assert.deepEqual(valideerDiagramType(componentDeploymentDiagramType), []);
});

test("overerving: device/executieomgeving erven shape, container en compartiment van node → klassifier", () => {
  const dt = genormaliseerd();
  const device = et(dt, "device");
  assert.equal(device.shape, "cd-node");
  assert.equal(device.containerVoor, "bevat");
  assert.deepEqual(device.compartments.map((c) => c.id), ["eigenschappen"]);
  assert.ok(device.properties.some((p) => p.key === "toelichting"));
  assert.equal(et(dt, "deploymentspec").icoon, "cd-artifact");
});

test("bereik: 'klassifier' en 'node' staan voor hun concrete afstammelingen, nooit voor de abstracte wortel", () => {
  const dt = genormaliseerd();
  assert.deepEqual(et(dt, "deployment").doel.elementTypes, ["node", "device", "executieomgeving"]);
  const dep = et(dt, "dependency").bron.elementTypes;
  for (const id of ["component", "interface", "artifact", "deploymentspec", "node", "device", "executieomgeving", "package"]) {
    assert.ok(dep.includes(id), `dependency-bron mist ${id}`);
  }
  assert.ok(!dep.includes("klassifier"));
  assert.ok(!dep.includes("poort"), "een poort is geen klassifier");
});

test("EA-tabel: elk doel-id bestaat, is concreet en van de juiste soort", () => {
  const perId = new Map(elementTypes.map((t) => [t.id, t]));
  for (const rij of OBJECTEN) {
    const t = perId.get(rij.elementType);
    assert.ok(t, `onbekend elementtype ${rij.elementType}`);
    assert.ok(!t.isConnector && !t.isAbstract, `${rij.elementType} moet een concreet knoop-type zijn`);
  }
  for (const rij of CONNECTOREN) {
    const t = perId.get(rij.elementType);
    assert.ok(t?.isConnector, `${rij.elementType} moet een connectortype zijn`);
  }
  for (const id of RAND_ELEMENTEN) assert.ok(perId.get(id)?.randElement, `${id} is geen randElement`);
  for (const id of CONTAINERS) {
    const dt = genormaliseerd();
    assert.ok(et(dt, id).containerVoor, `${id} is geen container`);
  }
});

test("opzoeken: stereotype wint van het kale Object_Type; connectoren idem", () => {
  assert.equal(elementTypeVoorObject("Node"), "node");
  assert.equal(elementTypeVoorObject("Node", ["device"]), "device");
  assert.equal(elementTypeVoorObject("Node", ["ExecutionEnvironment"]), "executieomgeving");
  assert.equal(elementTypeVoorObject("Artifact", ["deployment spec"]), "deploymentspec");
  assert.equal(elementTypeVoorObject("Onbekend"), null);
  assert.equal(elementTypeVoorConnector("Dependency"), "dependency");
  assert.equal(elementTypeVoorConnector("Dependency", "deploy"), "deployment");
  assert.equal(elementTypeVoorConnector("Dependency", "Use"), "gebruikt");
  assert.equal(elementTypeVoorConnector("Assembly"), "assembly");
});

test("elk profiel heeft notitie + notitie-lijn (EA tekent overal Notes)", () => {
  const dt = genormaliseerd();
  assert.ok(et(dt, "notitie"));
  assert.deepEqual(et(dt, "notitielijn").bron.elementTypes, ["notitie"]);
  assert.ok(et(dt, "notitielijn").doel.elementTypes.includes("device"));
});
