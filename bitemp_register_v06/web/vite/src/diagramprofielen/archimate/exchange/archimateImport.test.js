import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DOMParser } from "@xmldom/xmldom";

import { createDiagramStore } from "../../../diagramcore/model/createDiagramStore.js";
import { getTransformaties, wisTransformaties } from "../../../studio/activities/transformatieRegistry.js";
import { registreerArchimateImport } from "./archimateImport.js";

const fixture = (naam) => fs.readFileSync(new URL(`./fixtures/${naam}`, import.meta.url), "utf8");

function omgeving() {
  wisTransformaties();
  const useStore = createDiagramStore();
  useStore.getState().laadModel({
    diagramTypeId: "archimate",
    elements: { bestaand: { id: "bestaand", naam: "Bestaand", elementType: "goal", compartimenten: [], data: {} } },
    diagrams: {},
  });
  useStore.temporal.getState().clear();
  const mapState = {
    mappen: { doel: { id: "doel", naam: "Doel" } },
    plaatsing: {},
    plaatsDiagram(key, mapId) { this.plaatsing[key] = mapId; },
  };
  registreerArchimateImport({
    getProfieltype: (id) => id === "archimate05" ? { useStore } : null,
    getModellerenState: () => mapState,
    DOMParser,
    maakImportId: () => "integratie",
  });
  return { useStore, mapState, transformatie: getTransformaties("import").find((item) => item.id === "import-archimate-model-exchange") };
}

test.afterEach(() => wisTransformaties());

test("transformatie is vindbaar en importeert atomisch naar profiel en doelmap", async () => {
  const { useStore, mapState, transformatie } = omgeving();
  assert.ok(transformatie);
  const resultaat = await transformatie.run({ bron: { naam: "meerdere-views.xml", tekst: fixture("meerdere-views.xml") }, doelMap: "doel", opties: { taal: "nl", stijlen: true } });
  assert.equal(resultaat.summary, "2 views, 3 elementen en 1 relaties geïmporteerd");
  assert.equal(useStore.getState().elements.bestaand.naam, "Bestaand");
  assert.equal(Object.keys(useStore.getState().diagrams).length, 2);
  assert.equal(mapState.plaatsing["archimate05::amx:integratie:landschap"], "doel");
  assert.equal(mapState.plaatsing["el::archimate05::amx:integratie:los"], "doel");
  assert.equal(useStore.temporal.getState().pastStates.length, 1);
  useStore.temporal.getState().undo();
  assert.deepEqual(Object.keys(useStore.getState().elements), ["bestaand"]);
  assert.deepEqual(useStore.getState().diagrams, {});
});

test("parse- of preflightfout laat profielstore en mapstructuur exact gelijk", async () => {
  const { useStore, mapState, transformatie } = omgeving();
  const voorStore = JSON.stringify({ elements: useStore.getState().elements, diagrams: useStore.getState().diagrams });
  const voorMap = JSON.stringify(mapState.plaatsing);
  await assert.rejects(() => transformatie.run({ bron: { naam: "fout.xml", tekst: "<model>" }, doelMap: "doel" }));
  assert.equal(JSON.stringify({ elements: useStore.getState().elements, diagrams: useStore.getState().diagrams }), voorStore);
  assert.equal(JSON.stringify(mapState.plaatsing), voorMap);
  assert.equal(useStore.temporal.getState().pastStates.length, 0);

  await transformatie.run({ bron: { naam: "minimaal.xml", tekst: fixture("minimaal-model.xml") }, doelMap: "doel" });
  const naEerste = JSON.stringify(mapState.plaatsing);
  await assert.rejects(() => transformatie.run({ bron: { naam: "minimaal.xml", tekst: fixture("minimaal-model.xml") }, doelMap: "doel" }), (fout) => fout.code === "DIAGRAM_IMPORT_INVALID");
  assert.equal(JSON.stringify(mapState.plaatsing), naEerste);
});