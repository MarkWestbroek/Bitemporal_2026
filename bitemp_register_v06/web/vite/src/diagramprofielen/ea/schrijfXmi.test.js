// schrijfXmi.test.js — de terugweg: Omnium-model → EA XMI 2.1 met bewaarde GUIDs.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/ea/schrijfXmi.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { qeaNaarPuurUml } from "./qeaNaarPuurUml.js";
import { schrijfXmi, kleurNaarBgr } from "./schrijfXmi.js";

const hier = dirname(fileURLToPath(import.meta.url));
const bron = JSON.parse(readFileSync(join(hier, "fixtures", "metametamodel.qea.json"), "utf8"));
const PAKKET = 2376;
const model = qeaNaarPuurUml(bron, { packageId: PAKKET, schaal: 1 });
const els = Object.values(model.elements);
const { xml, nieuweGuids, verslag } = schrijfXmi(model, { naam: "Test", schaal: 1 });
const tel = (re) => (xml.match(re) || []).length;
const eaId = (guid) => `EAID_${guid.replace(/[{}]/g, "").replace(/-/g, "_")}`;

test("ids komen uit de EA-GUIDs: geen nieuwe GUIDs, elementen en pakketten met EAID_/EAPK_", () => {
  const nieuwOpElementNiveau = [...nieuweGuids.keys()].filter((k) => !k.includes("#"));
  assert.deepEqual(nieuwOpElementNiveau, ["__wortel__"], "alleen de wortel krijgt een nieuwe GUID (velden/tags apart)");
  const et = els.find((e) => e.naam === "ElementType");
  assert.ok(xml.includes(`xmi:type="uml:Class" xmi:id="${eaId(et.data.eaGuid)}" name="ElementType"`));
  const pakket = els.find((e) => e.elementType === "package" && e.data.eaGuid);
  assert.ok(xml.includes(`xmi:type="uml:Package" xmi:id="EAPK_${pakket.data.eaGuid.replace(/[{}]/g, "").replace(/-/g, "_")}"`));
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1"'));
  assert.ok(xml.includes('<xmi:Extension extender="Enterprise Architect"'));
});

test("klassen, attributen, enumeraties, generalisaties en associaties staan in het uml:Model", () => {
  const klassen = els.filter((e) => e.elementType === "klasse");
  assert.equal(tel(/<packagedElement xmi:type="uml:Class"/g), klassen.length);
  const attributen = els.flatMap((e) => (e.compartimenten || []).filter((c) => c.compartmentType === "attributen").flatMap((c) => c.velden));
  assert.equal(tel(/<ownedAttribute /g), attributen.length);
  assert.ok(attributen.length > 10);
  const enums = els.filter((e) => e.elementType === "enumeratie");
  assert.equal(tel(/<packagedElement xmi:type="uml:Enumeration"/g), enums.length);
  const gens = els.filter((e) => e.elementType === "generalisatie");
  assert.equal(tel(/<generalization /g), gens.length);
  const assocs = els.filter((e) => ["associatie", "aggregatie", "compositie"].includes(e.elementType));
  assert.equal(tel(/<packagedElement xmi:type="uml:Association"/g), assocs.length);
  assert.equal(tel(/<memberEnd /g), assocs.length * 2);
  // Compositie: het bron-uiteinde (het geheel) draagt aggregation="composite".
  const comp = els.find((e) => e.elementType === "compositie");
  const staart = comp.data.eaGuid.replace(/[{}]/g, "").replace(/-/g, "_").slice(2);
  assert.ok(xml.includes(`xmi:id="EAID_src${staart}"`) && new RegExp(`xmi:id="EAID_src${staart}"[^>]*aggregation="composite"`).test(xml));
  assert.equal(verslag.connectoren, assocs.length + gens.length + els.filter((e) => ["dependency", "realisatie"].includes(e.elementType)).length);
});

test("diagrammen: geometrie in EA-eenheden (Left/Top/Right/Bottom), lijnen met Path uit diagram.lijnen", () => {
  assert.equal(tel(/<diagram xmi:id=/g), 2);
  const dobj = bron.t_diagramobjects[0]; // RectLeft 635, RectTop -404, RectRight 695, RectBottom -434
  const obj = bron.t_object.find((o) => o.Object_ID === dobj.Object_ID);
  assert.ok(xml.includes(`geometry="Left=635;Top=404;Right=695;Bottom=434;" subject="${eaId(obj.ea_guid)}"`));
  // Een lijn met knikken op een diagram krijgt een Path in EA-coördinaten (y negatief).
  const d = Object.values(model.diagrams).find((x) => Object.values(x.lijnen || {}).some((l) => l.knikken));
  const [cid, lijn] = Object.entries(d.lijnen).find(([, l]) => l.knikken);
  const pad = lijn.knikken.map((k) => `${k.x}:${-k.y}`).join("$") + "$";
  assert.ok(xml.includes(`Path=${pad};" subject="${eaId(model.elements[cid].data.eaGuid)}"`), "Path van het diagram");
});

test("extension: stereotype, documentatie, tags en kleur per element; connector met labels", () => {
  const metNotes = els.find((e) => e.data?.notes && e.elementType === "klasse");
  if (metNotes) assert.ok(xml.includes(`<element xmi:idref="${eaId(metNotes.data.eaGuid)}" xmi:type="uml:Class"`));
  assert.ok(xml.includes('ea_type="Generalization"'));
  assert.equal(kleurNaarBgr("#a7d8f9"), 16373927);
  assert.equal(kleurNaarBgr("#bbeeff"), 16772795);
});

test("model zonder GUIDs: nieuwe GUIDs, stabiel bij een tweede export met de GUIDs op data.eaGuid", () => {
  const m = {
    elements: {
      A: { id: "A", naam: "Aap", elementType: "klasse", compartimenten: [{ compartmentType: "attributen", velden: [{ naam: "naam", fieldType: "attribuut", data: { typeLabel: "String", kardinaliteit: "0..1" } }] }], data: {} },
      B: { id: "B", naam: "Beer", elementType: "klasse", compartimenten: [], data: { abstract: true } },
      g: { id: "g", naam: "", elementType: "generalisatie", source: "A", target: "B", compartimenten: [], data: {} },
      r: { id: "r", naam: "kent", elementType: "associatie", source: "A", target: "B", compartimenten: [], data: { bronKardinaliteit: "1", doelKardinaliteit: "0..*", doelRolNaam: "beren" } },
    },
    diagrams: { d1: { id: "d1", naam: "Dier", nodes: [{ elementId: "A", position: { x: 150, y: 300 }, size: { width: 300, height: 150 } }, { elementId: "B", position: { x: 600, y: 300 } }] } },
  };
  const eerste = schrijfXmi(m, { naam: "Dieren" });
  assert.ok(eerste.nieuweGuids.has("A") && eerste.nieuweGuids.has("r") && eerste.nieuweGuids.has("d1"));
  assert.ok(/^\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}$/.test(eerste.nieuweGuids.get("A")));
  assert.ok(eerste.xml.includes('isAbstract="true"'));
  assert.ok(eerste.xml.includes('<type xmi:idref="EAJava_String"/>'));
  assert.ok(eerste.xml.includes('name="beren"'));
  assert.ok(eerste.xml.includes('geometry="Left=100;Top=200;Right=300;Bottom=300;"'), "schaal 1,5 terug naar EA-eenheden");
  // Tweede export met de GUIDs op de elementen: dezelfde ids, geen nieuwe (behalve de wortel en het veld).
  for (const [id, guid] of eerste.nieuweGuids) if (m.elements[id]) m.elements[id].data.eaGuid = guid;
  const tweede = schrijfXmi(m, { naam: "Dieren" });
  assert.ok(tweede.xml.includes(`xmi:id="EAID_${eerste.nieuweGuids.get("A").replace(/[{}]/g, "").replace(/-/g, "_")}"`));
  assert.ok(!tweede.nieuweGuids.has("A"));
});
