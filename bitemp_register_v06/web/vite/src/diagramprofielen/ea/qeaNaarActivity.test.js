// qeaNaarActivity.test.js — EA-activiteitendiagram → activity-profiel, op een echte
// fixture: pakket "UC.NPA.REG.0010 Registreren Natuurlijk Persoon" (HR 2020) uit het
// Gemeentelijk Gegevensmodel v2.3.0, met call-activities, pins, guards en drie einden.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/ea/qeaNaarActivity.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { qeaNaarActivity } from "./qeaNaarActivity.js";
import { qeaNaarPuurUml } from "./qeaNaarPuurUml.js";

const hier = dirname(fileURLToPath(import.meta.url));
const bron = JSON.parse(readFileSync(join(hier, "fixtures", "uc-npa-reg-0010.qea.json"), "utf8"));
const PAKKET = 1272;

const model = qeaNaarActivity(bron, { packageId: PAKKET, schaal: 1 });
const els = Object.values(model.elements);
const van = (type) => els.filter((e) => e.elementType === type);
const opNaam = (naam, type) => els.find((e) => e.naam === naam && (!type || e.elementType === type));

test("één activity-diagram; use case- en klassediagram geteld als overgeslagen", () => {
  assert.equal(model.verslag.diagrammen, 1);
  const d = Object.values(model.diagrams)[0];
  assert.equal(d.naam, "Registreren natuurlijk persoon");
  assert.equal(d.diagramType, "activity");
  assert.equal(model.verslag.overgeslagen["diagram Use Case"], 1);
  assert.equal(model.verslag.overgeslagen["diagram Logical"], 1);
});

test("knopen: 6 acties (+1 geplaatste Activity), 2 aanroepen, 4 beslissingen, 1 begin, 3 einden, 2 pins", () => {
  assert.equal(van("aanroep").length, 2);
  assert.equal(van("actie").length, 7);
  assert.equal(van("beslissing").length, 4);
  assert.equal(van("begin").length, 1);
  assert.equal(van("eind").length, 3);
  assert.equal(van("flow-eind").length, 0);
  assert.equal(van("pin").length, 2);
  assert.equal(van("notitie").length, 4); // 3 notes + 1 text
  // Het frame-Activity-element zelf is géén element.
  assert.ok(!opNaam("Registreren natuurlijk persoon", "actie"));
});

test("call-activity: naam van de aangeroepen activity, soort CallBehavior bewaard", () => {
  const aanroepen = van("aanroep").map((a) => a.naam).sort();
  assert.deepEqual(aanroepen, ["Registreren locatie", "Vastleggen natuurlijk persoon"]);
  const a = opNaam("Registreren locatie", "aanroep");
  assert.equal(a.data.custom.kind, "CallBehavior");
  assert.equal(a.data.aanroept, "Registreren locatie");
  // Het aangeroepen diagram zit niet in dit pakket → geen gedragDiagramId.
  assert.equal(a.data.gedragDiagramId, undefined);
});

test("action-soorten: RaiseException en CreateObject op data.soort", () => {
  const fout = van("actie").filter((a) => a.naam === "Geef foutmelding terug");
  assert.equal(fout.length, 2);
  assert.ok(fout.every((a) => a.data.soort === "RaiseException"));
  assert.equal(opNaam("Leg gebeurtenis vast", "actie").data.soort, "CreateObject");
  assert.equal(opNaam("Controleren bereikbaarheid", "actie").data.soort, undefined);
});

test("pins hangen aan hun actie (randVan), met type en richting; positie relatief", () => {
  // 'result' bestaat in het model (kind van de actie) maar staat in EA niet op het diagram.
  const result = opNaam("result", "pin");
  assert.equal(model.elements[result.data.randVan].naam, "Leg gebeurtenis vast");
  assert.equal(result.data.typeLabel, "NatuurlijkPersoonRegistratie");
  assert.equal(result.data.richting, "output");
  const d = Object.values(model.diagrams)[0];
  assert.ok(!d.nodes.some((n) => n.elementId === result.id), "niet getekend in EA → niet op het diagram");
  // 'natuurlijkPersoon' hangt aan de aanroep en staat wél op het diagram.
  const np = opNaam("natuurlijkPersoon", "pin");
  assert.equal(model.elements[np.data.randVan].elementType, "aanroep");
  const pinNode = d.nodes.find((n) => n.elementId === np.id);
  const hostNode = d.nodes.find((n) => n.elementId === np.data.randVan);
  assert.ok(pinNode && hostNode);
  // Relatief aan de gastheer: klein en binnen/op de rand van de actie.
  assert.ok(Math.abs(pinNode.position.x) <= hostNode.size.width + 20 && Math.abs(pinNode.position.y) <= hostNode.size.height + 20);
});

test("controlestromen met guards uit PDATA2; stromen naar pins worden objectstroom", () => {
  const cs = van("controlestroom");
  assert.ok(cs.length >= 14, `controlestromen: ${cs.length}`);
  const guards = cs.map((c) => c.data.guard).filter(Boolean).sort();
  assert.ok(guards.includes("ja") && guards.includes("nee") && guards.includes("woon- of briefadres"));
  const bekend = opNaam("bekende bereikbaarheid?", "beslissing");
  const uit = cs.filter((c) => c.source === bekend.id).map((c) => c.data.guard).sort();
  assert.deepEqual(uit, ["vertrokken onbekend waarheen", "woon- of briefadres"]);
  assert.equal(van("objectstroom").length + cs.length, 17);
});

test("begin en einden: Start zonder naam, drie benoemde einden", () => {
  assert.equal(van("begin")[0].naam, "");
  const einden = van("eind").map((e) => e.naam).sort();
  assert.ok(einden.every((n) => n.startsWith("Einde")));
});

test("diagram: 22 voorkomens met gespiegelde y; notities incl. die van elders", () => {
  const d = Object.values(model.diagrams)[0];
  assert.equal(d.nodes.length, 22);
  const pins = new Set(van("pin").map((p) => p.id));
  assert.ok(d.nodes.filter((n) => !pins.has(n.elementId)).every((n) => n.position.y >= 0));
});

test("puur-uml-lezer op hetzelfde pakket: klassen van elders op het klassediagram komen mee", () => {
  const uml = qeaNaarPuurUml(bron, { packageId: PAKKET, schaal: 1 });
  const logisch = Object.values(uml.diagrams).find((d) => d.naam.includes("Registreren Natuurlijk Persoon") && d.nodes.length === 15);
  assert.ok(logisch, "klassediagram met 15 klassen");
  assert.ok(Object.values(uml.elements).some((e) => e.naam === "NatuurlijkPersoon" && e.elementType === "klasse"));
  // Activity-knopen telt puur-uml als overgeslagen.
  assert.ok(uml.verslag.overgeslagen.Action >= 8);
});
