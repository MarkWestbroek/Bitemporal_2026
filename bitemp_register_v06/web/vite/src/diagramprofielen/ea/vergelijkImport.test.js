// vergelijkImport.test.js — merge op GUID: plan (nieuw/gewijzigd/ongewijzigd/verdwenen) en toepassen
// met behoud van bestaande ids. Fixture: Metametamodel (puur-uml).
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/ea/vergelijkImport.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { qeaNaarPuurUml } from "./qeaNaarPuurUml.js";
import { vergelijkMetStore, pasPlanToe, standaardKeuzes, herschrijfOpBestaandeIds } from "./vergelijkImport.js";
import { deelboomPakketten } from "./qeaHulp.js";

const hier = dirname(fileURLToPath(import.meta.url));
const bron = JSON.parse(readFileSync(join(hier, "fixtures", "metametamodel.qea.json"), "utf8"));
const PAKKET = 2376;
const pakketIds = new Set(deelboomPakketten(bron.t_package, PAKKET));

/** Minimale store met de acties die pasPlanToe gebruikt. */
function maakStore() {
  const st = {
    elements: {},
    diagrams: {},
    importeerModel(model) {
      for (const id of Object.keys(model.elements)) if (st.elements[id]) throw new Error(`Element-id bestaat al: ${id}`);
      for (const id of Object.keys(model.diagrams)) if (st.diagrams[id]) throw new Error(`Diagram-id bestaat al: ${id}`);
      st.elements = { ...st.elements, ...model.elements };
      st.diagrams = { ...st.diagrams, ...model.diagrams };
    },
    updateElementen(patches) {
      for (const [id, patch] of Object.entries(patches)) {
        const { data, ...top } = patch;
        st.elements[id] = { ...st.elements[id], ...top, data: { ...st.elements[id].data, ...data } };
      }
    },
    zetDiagram(id, patch) {
      st.diagrams[id] = { ...st.diagrams[id], ...patch };
    },
    deleteElement(id) {
      delete st.elements[id];
      for (const [k, v] of Object.entries(st.elements)) if (v.source === id || v.target === id) delete st.elements[k];
    },
    deleteDiagram(id) {
      delete st.diagrams[id];
    },
  };
  return st;
}

test("eerste import: alles nieuw; toepassen voegt alles toe", () => {
  const st = maakStore();
  const model = qeaNaarPuurUml(bron, { packageId: PAKKET, schaal: 1 });
  const plan = vergelijkMetStore(model, st, { pakketIds });
  assert.equal(plan.elementen.nieuw.length, Object.keys(model.elements).length);
  assert.equal(plan.elementen.gewijzigd.length + plan.elementen.ongewijzigd.length + plan.elementen.verdwenen.length, 0);
  assert.equal(plan.diagrammen.nieuw.length, 2);
  const uit = pasPlanToe(st, model, plan, standaardKeuzes(plan));
  assert.equal(uit.toegevoegd, Object.keys(model.elements).length);
  assert.equal(uit.diagrammenToegevoegd, 2);
  assert.equal(Object.keys(st.elements).length, Object.keys(model.elements).length);
});

test("tweede import van hetzelfde pakket: alles ongewijzigd, niets toegevoegd, ids blijven", () => {
  const st = maakStore();
  const model = qeaNaarPuurUml(bron, { packageId: PAKKET, schaal: 1 });
  pasPlanToe(st, model, vergelijkMetStore(model, st, { pakketIds }), standaardKeuzes(vergelijkMetStore(model, st, { pakketIds })));
  const idsVoor = Object.keys(st.elements).sort();
  const model2 = qeaNaarPuurUml(bron, { packageId: PAKKET, schaal: 1 });
  const plan2 = vergelijkMetStore(model2, st, { pakketIds });
  assert.equal(plan2.elementen.nieuw.length, 0);
  assert.equal(plan2.elementen.gewijzigd.length, 0, `gewijzigd: ${JSON.stringify(plan2.elementen.gewijzigd.slice(0, 3))}`);
  assert.equal(plan2.elementen.ongewijzigd.length, Object.keys(model2.elements).length);
  assert.equal(plan2.diagrammen.ongewijzigd.length, 2);
  assert.equal(plan2.elementen.verdwenen.length, 0);
  const uit = pasPlanToe(st, model2, plan2, standaardKeuzes(plan2));
  assert.deepEqual(uit, { toegevoegd: 0, bijgewerkt: 0, verwijderd: 0, diagrammenToegevoegd: 0, diagrammenBijgewerkt: 0 });
  assert.deepEqual(Object.keys(st.elements).sort(), idsVoor);
});

test("gewijzigd in EA: naam en positie worden bijgewerkt op het bestaande id; lokale lijnvorm blijft", () => {
  const st = maakStore();
  const model = qeaNaarPuurUml(bron, { packageId: PAKKET, schaal: 1 });
  pasPlanToe(st, model, vergelijkMetStore(model, st, { pakketIds }), standaardKeuzes(vergelijkMetStore(model, st, { pakketIds })));
  // Simuleer een hernoemde klasse en een verschoven node in EA: pas de bron aan.
  const bron2 = JSON.parse(JSON.stringify(bron));
  const et = bron2.t_object.find((o) => o.Name === "ElementType");
  et.Name = "Elementtype (v2)";
  const dobj = bron2.t_diagramobjects.find((d) => d.Object_ID === et.Object_ID);
  dobj.RectLeft += 100; dobj.RectRight += 100;
  // Lokale aanpassing in Omnium die moet blijven: labelpositie op een connector.
  const eenLijn = Object.values(st.elements).find((e) => e.elementType === "generalisatie");
  st.elements[eenLijn.id].data.labelOffsets = { midden: { x: 3, y: 4 } };

  const model2 = qeaNaarPuurUml(bron2, { packageId: PAKKET, schaal: 1 });
  const plan2 = vergelijkMetStore(model2, st, { pakketIds });
  const gew = plan2.elementen.gewijzigd.find((r) => r.naam === "Elementtype (v2)");
  assert.ok(gew, "ElementType is gewijzigd");
  assert.deepEqual(gew.verschillen, ["naam"]);
  const dgew = plan2.diagrammen.gewijzigd.find((r) => r.naam === "Editor");
  assert.ok(dgew && dgew.verschillen.includes("plaatsing"));
  assert.equal(plan2.elementen.nieuw.length, 0);

  const bestaandId = gew.bestaandId;
  const uit = pasPlanToe(st, model2, plan2, standaardKeuzes(plan2));
  // Alleen ElementType zelf: het pad staat per diagram, dus de meeschuivende
  // aanhechtpunten zijn een diagramverschil ("lijnen"), geen elementverschil.
  assert.equal(uit.bijgewerkt, 1);
  assert.ok(dgew.verschillen.includes("lijnen"));
  assert.equal(uit.diagrammenBijgewerkt, 1);
  assert.equal(st.elements[bestaandId].naam, "Elementtype (v2)", "zelfde id, nieuwe naam");
  assert.deepEqual(st.elements[eenLijn.id].data.labelOffsets, { midden: { x: 3, y: 4 } }, "lokale labelpositie blijft");
  const node = st.diagrams[dgew.bestaandId].nodes.find((n) => n.elementId === bestaandId);
  assert.equal(node.position.x, dobj.RectLeft);
});

test("verdwenen in EA: pas weg als aangevinkt; standaard uit", () => {
  const st = maakStore();
  const model = qeaNaarPuurUml(bron, { packageId: PAKKET, schaal: 1 });
  pasPlanToe(st, model, vergelijkMetStore(model, st, { pakketIds }), standaardKeuzes(vergelijkMetStore(model, st, { pakketIds })));
  const bron2 = JSON.parse(JSON.stringify(bron));
  const weg = bron2.t_object.find((o) => o.Name === "ActionHook");
  bron2.t_object = bron2.t_object.filter((o) => o.Object_ID !== weg.Object_ID);
  bron2.t_connector = bron2.t_connector.filter((c) => c.Start_Object_ID !== weg.Object_ID && c.End_Object_ID !== weg.Object_ID);
  bron2.t_diagramobjects = bron2.t_diagramobjects.filter((d) => d.Object_ID !== weg.Object_ID);
  const model2 = qeaNaarPuurUml(bron2, { packageId: PAKKET, schaal: 1 });
  const plan2 = vergelijkMetStore(model2, st, { pakketIds });
  const verdwenen = plan2.elementen.verdwenen.find((r) => r.naam === "ActionHook");
  assert.ok(verdwenen, "ActionHook staat als verdwenen");
  const keuzes = standaardKeuzes(plan2);
  assert.ok(!keuzes.aan.has(`weg:${verdwenen.bestaandId}`), "verdwenen staat standaard uit");
  pasPlanToe(st, model2, plan2, keuzes);
  assert.ok(st.elements[verdwenen.bestaandId], "niet aangevinkt → blijft");
  keuzes.aan.add(`weg:${verdwenen.bestaandId}`);
  const uit = pasPlanToe(st, model2, plan2, keuzes);
  assert.equal(uit.verwijderd, 1);
  assert.ok(!st.elements[verdwenen.bestaandId]);
});

test("nieuw element in EA naast bestaande: connector wijst naar het bestaande id", () => {
  const st = maakStore();
  const model = qeaNaarPuurUml(bron, { packageId: PAKKET, schaal: 1 });
  pasPlanToe(st, model, vergelijkMetStore(model, st, { pakketIds }), standaardKeuzes(vergelijkMetStore(model, st, { pakketIds })));
  const bron2 = JSON.parse(JSON.stringify(bron));
  const et = bron2.t_object.find((o) => o.Name === "ElementType");
  bron2.t_object.push({ ...et, Object_ID: 999999, Name: "NieuwType", ea_guid: "{00000000-0000-0000-0000-000000000001}" });
  bron2.t_connector.push({ Connector_ID: 999999, Connector_Type: "Generalization", Start_Object_ID: 999999, End_Object_ID: et.Object_ID, Direction: "Source -> Destination", ea_guid: "{00000000-0000-0000-0000-000000000002}" });
  const model2 = qeaNaarPuurUml(bron2, { packageId: PAKKET, schaal: 1 });
  const plan2 = vergelijkMetStore(model2, st, { pakketIds });
  assert.equal(plan2.elementen.nieuw.filter((r) => r.elementType !== "bevat").length, 2, "NieuwType + zijn generalisatie");
  pasPlanToe(st, model2, plan2, standaardKeuzes(plan2));
  const gen = Object.values(st.elements).find((e) => e.elementType === "generalisatie" && st.elements[e.source]?.naam === "NieuwType");
  assert.ok(gen);
  assert.equal(st.elements[gen.target].naam, "ElementType", "doel is het bestaande element");
  const her = herschrijfOpBestaandeIds(model2, plan2.idMap);
  assert.ok(her.elements[gen.target], "herschreven model gebruikt bestaande ids");
});

test("her-import: oude knikken/vorm op het element (oude lezer) gaan weg; lijndata komt per diagram, lokale labelpositie blijft", () => {
  const st = maakStore();
  const model = qeaNaarPuurUml(bron, { packageId: PAKKET, schaal: 1 });
  pasPlanToe(st, model, vergelijkMetStore(model, st, { pakketIds }), standaardKeuzes(vergelijkMetStore(model, st, { pakketIds })));
  // Simuleer de oude lezer: pad en vorm op het element.
  const lijn = Object.values(st.elements).find((e) => e.elementType === "generalisatie");
  st.elements[lijn.id].data = { ...st.elements[lijn.id].data, knikken: [{ x: 1, y: 1 }, { x: 2, y: 2 }], vorm: "recht" };
  // Lokale labelpositie op een diagram, en een verschoven doos in EA.
  const editor = Object.values(st.diagrams).find((d) => d.naam === "Editor");
  const metPad = Object.keys(editor.lijnen)[0];
  editor.lijnen[metPad] = { ...editor.lijnen[metPad], labelOffsets: { midden: { x: 5, y: 6 } } };
  const bron2 = JSON.parse(JSON.stringify(bron));
  const et = bron2.t_object.find((o) => o.Name === "ElementType");
  const dobj = bron2.t_diagramobjects.find((d) => d.Object_ID === et.Object_ID);
  dobj.RectLeft += 100; dobj.RectRight += 100;
  const model2 = qeaNaarPuurUml(bron2, { packageId: PAKKET, schaal: 1 });
  const plan2 = vergelijkMetStore(model2, st, { pakketIds });
  const gew = plan2.elementen.gewijzigd.find((r) => r.bestaandId === lijn.id);
  assert.ok(gew && gew.verschillen.includes("data.knikken") && gew.verschillen.includes("data.vorm"), JSON.stringify(gew?.verschillen));
  pasPlanToe(st, model2, plan2, standaardKeuzes(plan2));
  assert.equal(st.elements[lijn.id].data.knikken, undefined, "oude knikken van het element weg");
  assert.equal(st.elements[lijn.id].data.vorm, undefined, "oude vorm van het element weg");
  const editor2 = st.diagrams[editor.id];
  assert.deepEqual(editor2.lijnen[metPad].labelOffsets, { midden: { x: 5, y: 6 } }, "lokale labelpositie op het diagram blijft");
  assert.ok(editor2.lijnen[metPad].knikken || editor2.lijnen[metPad].vorm, "lijndata uit EA op het diagram");
});
