// qeaKern.test.js — lijnpad per connector komt van het diagram dat geïmporteerd wordt.
// Fixture: Metamodel v2026 (GGM), diagrammen "META - {Representatie}" (2630) en
// "META - {Gegeven} " (2633): dezelfde generalisaties, elk met een eigen boompad
// (EA "Tree Style - Vertical"). De rij van 2633 staat in de fixture vóór die van 2630.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/ea/qeaKern.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { maakHulptabellen, knikkenVoor } from "./qeaKern.js";
import { qeaNaarPuurUml } from "./qeaNaarPuurUml.js";

const hier = dirname(fileURLToPath(import.meta.url));
const bron = JSON.parse(readFileSync(join(hier, "fixtures", "metamodel-v2026.qea.json"), "utf8"));
const PAKKET = 2371;
const REPRESENTATIE_DIAGRAM = 2630;
const GEN_ENTITEIT = 15660; // {Entiteit} → {Representatie}

test("maakHulptabellen: zonder voorkeur de eerste rij, met voorkeur de rij van dat diagram", () => {
  const los = maakHulptabellen(bron, 1);
  assert.equal(los.linkPerConnector.get(GEN_ENTITEIT).DiagramID, 2633, "eerste rij in de bron");
  const h = maakHulptabellen(bron, 1, { diagramVoorkeur: [REPRESENTATIE_DIAGRAM] });
  assert.equal(h.linkPerConnector.get(GEN_ENTITEIT).DiagramID, REPRESENTATIE_DIAGRAM);
});

test("het pad staat per diagram: op 'META - {Representatie}' ligt de lat tussen kind en ouder van dát diagram", () => {
  const model = qeaNaarPuurUml(bron, {
    packageId: PAKKET,
    schaal: 1,
    diagramFilter: (d) => d.Diagram_ID === REPRESENTATIE_DIAGRAM,
  });
  const gen = Object.values(model.elements).find(
    (e) => e.elementType === "generalisatie" && model.elements[e.source]?.naam === "{Entiteit}" && model.elements[e.target]?.naam === "{Representatie}"
  );
  assert.ok(gen, "generalisatie {Entiteit} → {Representatie}");
  assert.equal(gen.data.knikken, undefined, "het element draagt geen pad");
  const lijn = Object.values(model.diagrams)[0].lijnen[gen.id];
  // EA-pad op diagram 2630: 149:-526;167:-526 → de dwarslat ligt op y=526,
  // tussen de onderkant van {Representatie} (476) en de bovenkant van {Entiteit} (552).
  const ys = lijn.knikken.map((k) => k.y);
  assert.ok(ys.every((y) => y >= 476 && y <= 552), `knikken op de lat tussen ouder en kind: ${JSON.stringify(lijn.knikken)}`);
  assert.ok(lijn.knikken.some((k) => k.x === 149 && k.y === 526));
  assert.equal(lijn.vorm, undefined, "met knikken geen vaste lijnvorm");
});

test("dezelfde lijn op twee diagrammen: elk diagram zijn eigen pad", () => {
  const model = qeaNaarPuurUml(bron, { packageId: PAKKET, schaal: 1 });
  const gen = Object.values(model.elements).find(
    (e) => e.elementType === "generalisatie" && model.elements[e.source]?.naam === "{Entiteit}" && model.elements[e.target]?.naam === "{Representatie}"
  );
  const paden = Object.values(model.diagrams).map((d) => d.lijnen?.[gen.id]?.knikken).filter(Boolean);
  assert.equal(paden.length, 2, "op beide diagrammen een pad");
  assert.notDeepEqual(paden[0], paden[1]);
  // 2633: 304:-170;455:-170 (lat op y=170); 2630: lat op y=526.
  const latten = paden.map((p) => p[1].y).sort((a, b) => a - b);
  assert.deepEqual(latten, [170, 526]);
});

test("kleur: EA kleurt het diagramobject (ObjectStyle BCol), niet het element — komt op data.kleur", () => {
  const dv = JSON.parse(readFileSync(join(hier, "fixtures", "dienstverlening.qea.json"), "utf8"));
  const h = maakHulptabellen(dv, 1, { diagramVoorkeur: [267] });
  const zaaktype = dv.t_object.find((o) => o.Name === "Zaaktype");
  assert.equal(zaaktype.Backcolor, -1, "element zelf zonder kleur");
  assert.equal(h.kleurPerObject.get(zaaktype.Object_ID), "#a7d8f9", "BCol=16373927 (BGR) → #a7d8f9");
  const model = qeaNaarPuurUml(dv, { packageId: 327, schaal: 1 });
  const el = Object.values(model.elements).find((e) => e.naam === "Zaaktype");
  assert.equal(el.data.kleur, "#a7d8f9");
});

test("lijn op twee diagrammen (Dienstverlening): per diagram een eigen pad en lijnvorm", () => {
  const dv = JSON.parse(readFileSync(join(hier, "fixtures", "dienstverlening.qea.json"), "utf8"));
  const model = qeaNaarPuurUml(dv, { packageId: 327, schaal: 1 });
  const el = (naam) => Object.values(model.elements).find((e) => e.naam === naam);
  const d267 = Object.values(model.diagrams).find((d) => d.naam === "Entiteiten Dienstverlening");
  const d268 = Object.values(model.diagrams).find((d) => d.naam === "Entiteiten Klantcontact");
  // "hoofdonderwerp" (lus op Onderwerp) staat op beide, met een ander pad.
  const lus = el("hoofdonderwerp");
  assert.ok(d267.lijnen[lus.id].knikken.length >= 5 && d268.lijnen[lus.id].knikken.length >= 5);
  assert.notDeepEqual(d267.lijnen[lus.id].knikken, d268.lijnen[lus.id].knikken);
  // "kan leiden tot" (Klantcontact → AanvraagOfMelding): Auto Routing op 267, Orthogonal-Square op 268 → beide hoekig.
  const klt = Object.values(model.elements).find((e) => e.naam === "kan leiden tot" && model.elements[e.source]?.naam === "Klantcontact");
  assert.equal(d267.lijnen[klt.id].vorm, "hoekig");
  assert.equal(d268.lijnen[klt.id].vorm, "hoekig");
  // Zonder pad: Orthogonal-Square → hoekig, Custom zonder waypoints → recht.
  assert.equal(d267.lijnen[el("afhandelend medewerker").id].vorm, "hoekig");
  assert.equal(d267.lijnen[el("is van").id].vorm, "recht");
  assert.ok(Object.values(model.elements).every((e) => e.data?.knikken === undefined && e.data?.vorm === undefined));
});

test("EA 'Hide attributes' op een diagram (PDATA HideAtts=1) → diagram.verbergCompartimenten", () => {
  const dv = JSON.parse(readFileSync(join(hier, "fixtures", "dienstverlening.qea.json"), "utf8"));
  const model = qeaNaarPuurUml(dv, { packageId: 327, schaal: 1 });
  const d267 = Object.values(model.diagrams).find((d) => d.naam === "Entiteiten Dienstverlening");
  assert.equal(d267.verbergCompartimenten, true);
  const mm = qeaNaarPuurUml(bron, { packageId: PAKKET, schaal: 1 });
  assert.ok(Object.values(mm.diagrams).every((d) => !d.verbergCompartimenten), "Metamodel v2026 toont zijn attributen");
});

test("knikkenVoor: alleen Custom (Mode=3) volgt het pad; Direct en Auto Routing laten een oud pad liggen (10-10)", () => {
  const g = (n) => `{00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}}`;
  const bron = {
    t_package: [{ Package_ID: 1, Parent_ID: 0, Name: "P", ea_guid: g(90) }],
    t_object: [
      { Object_ID: 1, Object_Type: "Class", Name: "A", Package_ID: 1, ea_guid: g(1) },
      { Object_ID: 2, Object_Type: "Class", Name: "B", Package_ID: 1, ea_guid: g(2) },
    ],
    t_connector: [{ Connector_ID: 7, Connector_Type: "Association", Start_Object_ID: 1, End_Object_ID: 2, ea_guid: g(7) }],
    t_diagram: [{ Diagram_ID: 5, Package_ID: 1, Diagram_Type: "Logical", Name: "D", ea_guid: g(50) }],
    t_diagramobjects: [
      { Diagram_ID: 5, Object_ID: 1, RectLeft: 0, RectTop: 0, RectRight: 100, RectBottom: -50, Sequence: 1 },
      { Diagram_ID: 5, Object_ID: 2, RectLeft: 300, RectTop: 0, RectRight: 400, RectBottom: -50, Sequence: 2 },
    ],
    t_diagramlinks: [{ DiagramID: 5, ConnectorID: 7, Style: "Mode=3;TREE=OS;", Path: "200:-25;", Geometry: "" }],
  };
  const c = bron.t_connector[0];
  const h = maakHulptabellen(bron, 1);
  assert.ok(knikkenVoor(h, c, bron.t_diagramlinks[0]).length >= 1, "Custom: pad gevolgd");
  for (const mode of ["1", "2"]) {
    const link = { ...bron.t_diagramlinks[0], Style: `Mode=${mode};`, Path: "-500:-300;" };
    assert.deepEqual(knikkenVoor(h, c, link), [], `Mode=${mode}: oud pad genegeerd`);
  }
});
