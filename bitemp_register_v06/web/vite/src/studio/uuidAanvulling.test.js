// Projectformaat 4 (15-11): afgeleide uuid's (v5) en de aanvulling in de Studio.
import test from "node:test";
import assert from "node:assert/strict";
import { createDiagramStore } from "../diagramcore/model/createDiagramStore.js";
import { uuidV5, afgeleideUuidMaker, ontbrekendeUuids, vulUuids } from "../diagramprofielen/canoniek-uml/uuids.js";
import { startUuidAanvulling, zetUuidContext, vulNu, _resetUuidAanvulling } from "./uuidAanvulling.js";

const model = () => ({
  elements: {
    e1: { id: "e1", naam: "Persoon", elementType: "entiteit", compartimenten: [], data: {} },
    g1: { id: "g1", naam: "Naam", elementType: "gegevenselement", data: {}, compartimenten: [{ compartmentType: "velden", velden: [
      { naam: "achternaam", fieldType: "attribuut", data: {} },
      { naam: "", fieldType: "attribuut", data: {} },
    ] }] },
    n1: { id: "n1", naam: "notitie", elementType: "notitie", compartimenten: [], data: {} },
  },
  diagrams: {},
});

test("uuidV5 volgt RFC 9562 (testvector DNS-naamruimte)", () => {
  assert.equal(uuidV5("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "www.example.com"), "2ed6657d-e927-568b-95e1-2665a8aea6a2");
});

test("afgeleid: twee clients komen op dezelfde uuid's; een andere stam op andere", () => {
  const a = ontbrekendeUuids(model(), afgeleideUuidMaker("project-1"));
  const b = ontbrekendeUuids(model(), afgeleideUuidMaker("project-1"));
  const c = ontbrekendeUuids(model(), afgeleideUuidMaker("project-2"));
  assert.deepEqual(a, b);
  assert.notEqual(a.e1.data.uuid, c.e1.data.uuid);
  assert.match(a.e1.data.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(a.n1, undefined, "een notitie krijgt geen uuid");
  const velden = a.g1.compartimenten[0].velden;
  assert.match(velden[0].data.uuid, /^[0-9a-f-]{36}$/);
  assert.equal(velden[1].data.uuid, undefined, "een veld zonder naam nog niet");
});

test("een bestaande uuid blijft; het veld leidt af van de uuid van zijn element", () => {
  const m = model();
  m.elements.g1.data.uuid = "11111111-1111-4111-8111-111111111111";
  const p = ontbrekendeUuids(m, afgeleideUuidMaker("project-1"));
  assert.equal(p.g1.data, undefined);
  const m2 = model();
  m2.elements.g1.data.uuid = "22222222-2222-4222-8222-222222222222";
  const p2 = ontbrekendeUuids(m2, afgeleideUuidMaker("project-1"));
  assert.notEqual(p.g1.compartimenten[0].velden[0].data.uuid, p2.g1.compartimenten[0].velden[0].data.uuid);
});

test("aanvulling: vult aan, zonder undo-stap; niet zonder stam of met alleen leesrecht", () => {
  _resetUuidAanvulling();
  const store = createDiagramStore();
  store.getState().laadModel(model());
  startUuidAanvulling("canoniek-test", store, vulUuids);
  zetUuidContext({ stam: "p1", magSchrijven: false });
  assert.equal(vulNu(), 0, "alleen leesrecht: niets");
  zetUuidContext({ stam: "p1", magSchrijven: true });
  const voor = store.temporal?.getState?.().pastStates?.length ?? 0;
  assert.ok(vulNu() > 0);
  assert.equal(store.getState().elements.e1.data.uuid, afgeleideUuidMaker("p1")({ element: { id: "e1" } }));
  assert.equal(store.temporal?.getState?.().pastStates?.length ?? 0, voor, "geen undo-stap");
  assert.equal(vulNu(), 0, "tweede keer niets");
  // Hernoemen houdt de uuid.
  const u = store.getState().elements.g1.compartimenten[0].velden[0].data.uuid;
  const g1 = store.getState().elements.g1;
  store.getState().updateElementen({ g1: { compartimenten: [{ ...g1.compartimenten[0], velden: [{ ...g1.compartimenten[0].velden[0], naam: "familienaam" }, g1.compartimenten[0].velden[1]] }] } });
  vulNu();
  assert.equal(store.getState().elements.g1.compartimenten[0].velden[0].data.uuid, u);
  _resetUuidAanvulling();
});
