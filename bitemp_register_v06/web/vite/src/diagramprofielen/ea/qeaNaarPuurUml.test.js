// qeaNaarPuurUml.test.js — EA .qea-rijen → puur-uml, op een echte fixture:
// het pakket "Zandbak MW / Metametamodel" (+ "Examples") uit het Gemeentelijk
// Gegevensmodel v2.3.0 (EA16), uitgesneden met scripts/inspecteer-qea.py-SQL.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/ea/qeaNaarPuurUml.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { qeaNaarPuurUml } from "./qeaNaarPuurUml.js";
import {
  stereotypenUitXref,
  customPropertiesUitXref,
  knikkenUitPath,
  kleurUitBgr,
  kardinaliteitUitGrenzen,
  rechthoekNaarNode,
  haaksAanhechtpunt,
  maakHaaks,
} from "./qeaHulp.js";

const hier = dirname(fileURLToPath(import.meta.url));
const bron = JSON.parse(readFileSync(join(hier, "fixtures", "metametamodel.qea.json"), "utf8"));
const METAMETAMODEL = 2376;

// schaal 1: de tests vergelijken met de ruwe EA-coördinaten; de standaard is EA_SCHAAL.
const model = qeaNaarPuurUml(bron, { packageId: METAMETAMODEL, schaal: 1 });
const els = Object.values(model.elements);
const opNaam = (naam, type = "klasse") => els.find((e) => e.naam === naam && e.elementType === type);

test("pakket met deelpakket: twee package-elementen, geneste bevat", () => {
  const pk = els.filter((e) => e.elementType === "package").map((e) => e.naam).sort();
  assert.deepEqual(pk, ["Examples", "Metametamodel"]);
  const bevat = els.filter((e) => e.elementType === "bevat");
  const ouder = opNaam("Metametamodel", "package");
  const kind = opNaam("Examples", "package");
  assert.ok(bevat.some((b) => b.source === ouder.id && b.target === kind.id), "Examples hangt onder Metametamodel");
  // Het t_object van type Package is niet nog eens als klasse meegekomen.
  assert.equal(els.filter((e) => e.naam === "Examples").length, 1);
});

test("alle 43 klassen, 4 kaders en 5 notities komen mee; niets overgeslagen", () => {
  assert.equal(els.filter((e) => e.elementType === "klasse").length, 43);
  assert.equal(els.filter((e) => e.elementType === "boundary").length, 4);
  assert.equal(els.filter((e) => e.elementType === "notitie").length, 5);
  assert.deepEqual(model.verslag.overgeslagen, {});
  assert.equal(model.verslag.diagrammen, 2);
});

test("stabiele identiteit: element-id uit de EA-GUID, GUID ook op data", () => {
  const et = opNaam("ElementType");
  assert.match(et.id, /^ea-[0-9a-f-]{36}$/);
  assert.equal(et.data.eaGuid, bron.t_object.find((o) => o.Name === "ElementType").ea_guid);
  assert.equal(new Set(els.map((e) => e.id)).size, els.length, "ids zijn uniek");
});

test("ElementType: attributen name en abstract:boolean, zonder 1..1-kardinaliteit", () => {
  const et = opNaam("ElementType");
  const attrs = et.compartimenten.find((c) => c.compartmentType === "attributen").velden;
  assert.deepEqual(
    attrs.map((v) => [v.naam, v.data.typeLabel ?? null, v.data.kardinaliteit ?? null]),
    [["name", null, null], ["abstract", "boolean", null]]
  );
  assert.equal(attrs[0].fieldType, "attribuut");
});

test("generalisaties: ElementType → ElementType (zelf) en ConnectorType → ElementType", () => {
  const et = opNaam("ElementType");
  const ct = opNaam("ConnectorType");
  const gens = els.filter((e) => e.elementType === "generalisatie");
  assert.ok(gens.some((g) => g.source === et.id && g.target === et.id), "zelf-overerving");
  assert.ok(gens.some((g) => g.source === ct.id && g.target === et.id));
  assert.equal(gens.length, 6);
});

test("aggregatie: ruit (bron) aan het geheel, kardinaliteit volgt de kant", () => {
  // EA: Compartment (Start, deel, SourceCard 0..9) → Element (End, geheel).
  const comp = opNaam("Compartment");
  const element = opNaam("Element");
  const agg = els.find((e) => ["aggregatie", "compositie"].includes(e.elementType) && e.target === comp.id);
  assert.ok(agg, "aggregatie Element ◇— Compartment");
  assert.equal(agg.source, element.id, "bron = geheel (Element)");
  assert.equal(agg.data.doelKardinaliteit, "0..9", "0..9 staat aan de deel-kant");
  // SubType Strong → compositie, Weak → aggregatie; beide soorten komen voor.
  assert.ok(els.some((e) => e.elementType === "compositie"));
  assert.ok(els.some((e) => e.elementType === "aggregatie"));
});

test("associatie: rolnamen en kardinaliteit reizen mee op data", () => {
  const regel = opNaam("Verbindingsregel");
  const assocs = els.filter((e) => e.elementType === "associatie" && e.source === regel.id);
  const rollen = assocs.map((a) => a.data.doelRolNaam).sort();
  assert.deepEqual(rollen, ["sourceType", "targetType"]);
  assert.ok(assocs.every((a) => a.data.doelKardinaliteit === "1" && a.data.directioneel === true));
});

test("realisatie naar een klasse wordt een dependency met «realize»-label", () => {
  const sr = opNaam("ShapeRenderer");
  const st = opNaam("ShapeType");
  const dep = els.find((e) => e.source === sr.id && e.target === st.id);
  assert.equal(dep.elementType, "dependency");
  assert.equal(dep.naam, "«realize»");
  assert.equal(dep.data.eaConnectorType, "Realisation");
});

test("diagram Editor: 46 voorkomens met gespiegelde y, maat uit de rechthoek", () => {
  const editor = Object.values(model.diagrams).find((d) => d.naam === "Editor");
  assert.equal(editor.diagramType, "puur-uml");
  assert.equal(editor.nodes.length, 46);
  const dobj = bron.t_diagramobjects.find((d) => d.Diagram_ID === 2643 && d.Sequence === 1);
  const node = editor.nodes.find((n) => n.position.x === dobj.RectLeft && n.position.y === -dobj.RectTop);
  assert.ok(node, "eerste diagramobject gevonden op (RectLeft, -RectTop)");
  assert.deepEqual(node.size, { width: dobj.RectRight - dobj.RectLeft, height: dobj.RectTop - dobj.RectBottom });
  assert.ok(editor.nodes.every((n) => n.position.y >= 0 && n.size.height > 0));
  // Sequence 1 (bovenop in EA) staat als laatste in de lijst (tekent bovenop).
  assert.equal(editor.nodes[editor.nodes.length - 1].elementId, node.elementId);
});

test("kaders krijgen hun maat van het diagram en liggen als achtergrond", () => {
  const editor = Object.values(model.diagrams).find((d) => d.naam === "Editor");
  const kader = opNaam("Definition", "boundary");
  const node = editor.nodes.find((n) => n.elementId === kader.id);
  assert.ok(node.size.width > 200 && node.size.height > 100);
});

test("notitie-lijnen: alle 7 NoteLinks, met de notitie als bron", () => {
  const lijnen = els.filter((e) => e.elementType === "notitielijn");
  assert.equal(lijnen.length, 7);
  for (const l of lijnen) {
    assert.equal(model.elements[l.source].elementType, "notitie");
    assert.notEqual(model.elements[l.target].elementType, "notitie");
  }
  // Elke lijn eindigt op een klasse (de notities in dit pakket wijzen naar klassen).
  assert.ok(lijnen.every((l) => model.elements[l.target].elementType === "klasse"));
});

test("notities dragen hun tekst, zonder naam", () => {
  const not = els.filter((e) => e.elementType === "notitie");
  assert.ok(not.every((n) => n.naam === "" && typeof n.data.tekst === "string" && n.data.tekst.length > 0));
});

/** Lijndata (knikken, vorm) van een connector, van het eerste diagram waar hij die heeft. */
const lijnVan = (m, id) => Object.values(m.diagrams).map((d) => d.lijnen?.[id]).find(Boolean) || null;
const alleLijnen = (m) => Object.values(m.diagrams).flatMap((d) => Object.entries(d.lijnen || {}).map(([id, l]) => ({ id, ...l })));

test("standaardschaal 1,5 vergroot posities, maten en knikpunten gelijk op", () => {
  const geschaald = qeaNaarPuurUml(bron, { packageId: METAMETAMODEL });
  const editor1 = Object.values(model.diagrams).find((d) => d.naam === "Editor");
  const editor15 = Object.values(geschaald.diagrams).find((d) => d.naam === "Editor");
  const n1 = editor1.nodes[0], n15 = editor15.nodes[0];
  assert.equal(n15.position.x, Math.round(n1.position.x * 1.5));
  assert.equal(n15.size.width, Math.round(n1.size.width * 1.5));
  const k1 = alleLijnen(model).find((l) => l.knikken);
  const k15 = lijnVan(geschaald, k1.id);
  assert.equal(k15.knikken[0].x, Math.round(k1.knikken[0].x * 1.5));
});

test("lijndata staat per diagram (diagram.lijnen), niet op het element; rechte EA-lijn → vorm recht", () => {
  assert.ok(els.every((e) => e.data?.knikken === undefined && e.data?.vorm === undefined), "element draagt geen pad of vorm");
  const lijnen = alleLijnen(model);
  const recht = lijnen.filter((l) => l.vorm === "recht");
  const hoekig = lijnen.filter((l) => l.vorm === "hoekig");
  assert.ok(recht.length > 0, "Mode=1/3 zonder Path → recht");
  assert.ok(hoekig.length > 0, "Mode=2 (auto-routing) → hoekig");
  assert.ok(recht.every((l) => !l.knikken));
});

test("knikpunten uit Path (Mode 2/3), niet bij Mode 1", () => {
  const metPad = alleLijnen(model).filter((l) => l.knikken);
  assert.ok(metPad.length > 0, "minstens één lijn met knikpunten");
  assert.ok(metPad.every((l) => l.knikken.every((k) => Number.isFinite(k.x) && k.y >= 0)));
});

test("TREE=OS: aanhechtpunten haaks op de rand erbij, stukken haaks (Element ◆— ProjectFolder)", () => {
  // EA: Element (398,-507)-(548,-587) → Path 408:-350;85:-350 → ProjectFolder (40,-253)-(130,-323).
  const element = opNaam("Element");
  const map = opNaam("ProjectFolder");
  const agg = els.find((e) => ["aggregatie", "compositie"].includes(e.elementType) && e.source === map.id && e.target === element.id);
  assert.ok(agg, "ProjectFolder ◆— Element");
  // Bron is het geheel (ProjectFolder); EA's Path liep van Element naar ProjectFolder
  // en is daarom omgedraaid, mét de haakse aanhechtpunten erbij.
  assert.deepEqual(lijnVan(model, agg.id).knikken, [
    { x: 85, y: 323 }, // onderrand ProjectFolder, recht boven het hoekpunt
    { x: 85, y: 350 },
    { x: 408, y: 350 },
    { x: 408, y: 507 }, // bovenrand Element
  ]);
});

test("haaksAanhechtpunt en maakHaaks", () => {
  const doos = { x: 100, y: 100, width: 100, height: 50 };
  assert.deepEqual(haaksAanhechtpunt(doos, { x: 150, y: 20 }), { x: 150, y: 100 });
  assert.deepEqual(haaksAanhechtpunt(doos, { x: 150, y: 300 }), { x: 150, y: 150 });
  assert.deepEqual(haaksAanhechtpunt(doos, { x: 20, y: 120 }), { x: 100, y: 120 });
  assert.deepEqual(haaksAanhechtpunt(doos, { x: 300, y: 120 }), { x: 200, y: 120 });
  assert.equal(haaksAanhechtpunt(doos, { x: 20, y: 20 }), null, "schuin: geen aanhechtpunt");
  assert.deepEqual(maakHaaks([{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }]), [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }]);
  // Niet-uitgelijnd stuk na een verticaal stuk: eerst horizontaal.
  assert.deepEqual(maakHaaks([{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 20 }]), [
    { x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 20 },
  ]);
});

// ── Hulpparsers ─────────────────────────────────────────────────────────

test("stereotypen uit t_xref: FQName gaat voor, volgorde behouden", () => {
  assert.deepEqual(
    stereotypenUitXref("@STEREO;Name=Objecttype;FQName=MIM::Objecttype;@ENDSTEREO;@STEREO;Name=formeel;GUID={X};@ENDSTEREO;"),
    ["MIM::Objecttype", "formeel"]
  );
  assert.deepEqual(stereotypenUitXref(null), []);
});

test("custom properties: kind=CallBehavior", () => {
  assert.deepEqual(
    customPropertiesUitXref("@PROP=@NAME=kind@ENDNAME;@TYPE=ActionKind@ENDTYPE;@VALU=CallBehavior@ENDVALU;@PRMT=@ENDPRMT;@ENDPROP;@PROP=@NAME=isStream@ENDNAME;@TYPE=boolean@ENDTYPE;@VALU=0@ENDVALU;@PRMT=@ENDPRMT;@ENDPROP;"),
    { kind: "CallBehavior", isStream: "0" }
  );
});

test("Path, kleur, kardinaliteit, rechthoek", () => {
  assert.deepEqual(knikkenUitPath("159:-238;159:-493;"), [{ x: 159, y: 238 }, { x: 159, y: 493 }]);
  assert.deepEqual(knikkenUitPath(null), []);
  assert.equal(kleurUitBgr(12641528), "#f8e4c0"); // BGR-integer 0xC0E4F8 → RGB
  assert.equal(kleurUitBgr(-1), null);
  assert.equal(kardinaliteitUitGrenzen("1", "1"), null);
  assert.equal(kardinaliteitUitGrenzen("0", "1"), "0..1");
  assert.equal(kardinaliteitUitGrenzen("0", "*"), "0..*");
  assert.equal(kardinaliteitUitGrenzen("*", "*"), "*");
  assert.deepEqual(rechthoekNaarNode({ RectLeft: 10, RectTop: -20, RectRight: 110, RectBottom: -80 }), {
    position: { x: 10, y: 20 },
    size: { width: 100, height: 60 },
  });
});
