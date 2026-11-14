import test from "node:test";
import assert from "node:assert/strict";
import { celNaarJuel, celNaarFeel, isJuel, leesAlsCel, vrijeVariabelen } from "./celOmzetting.js";
import { parseCelExpressie } from "../shared/celEvaluator.js";

test("CEL → JUEL: de condities van de GPK-processen komen terug zoals ze waren", () => {
  assert.equal(celNaarJuel("ontvankelijkheid.ontvankelijk").tekst, "${ontvankelijkheid.ontvankelijk}");
  assert.equal(celNaarJuel("!ontvankelijkheid.ontvankelijk").tekst, "${!ontvankelijkheid.ontvankelijk}");
  assert.equal(celNaarJuel("uitkomst == 'toegekend'").tekst, "${uitkomst == 'toegekend'}");
  assert.equal(celNaarJuel('uitkomst == "toegekend"').tekst, "${uitkomst == 'toegekend'}");
});

test("CEL → JUEL: haakjes alleen waar de volgorde ze vraagt", () => {
  assert.equal(celNaarJuel("(a || b) && c").tekst, "${(a || b) && c}");
  assert.equal(celNaarJuel("a || (b && c)").tekst, "${a || b && c}");
  assert.equal(celNaarJuel("!(a == 1)").tekst, "${!(a == 1)}");
  assert.equal(celNaarJuel("a ? 'x' : 'y'").tekst, "${a ? 'x' : 'y'}");
});

test("CEL → JUEL: een lambda of functie is een fout, geen benadering", () => {
  const uit = celNaarJuel("bijlagen.exists(b, b.naam == 'pasfoto')");
  assert.equal(uit.tekst, null);
  assert.match(uit.fout, /exists/);
  assert.match(celNaarJuel("size(bijlagen) > 0").fout, /size/);
});

test("CEL → FEEL: de invoerexpressie van de GPK-beslistabel komt terug zoals hij was", () => {
  assert.equal(
    celNaarFeel('bijlagen != null && bijlagen.exists(b, b.naam == "pasfoto")').tekst,
    'bijlagen != null and (some b in bijlagen satisfies b.naam = "pasfoto")',
  );
});

test("CEL → FEEL: operatoren, if, every, count, filter, index", () => {
  assert.equal(celNaarFeel("a == 1 || !b").tekst, "a = 1 or not(b)");
  assert.equal(celNaarFeel("a ? 'x' : 'y'").tekst, 'if a then "x" else "y"');
  assert.equal(celNaarFeel("l.all(x, x.n > 0)").tekst, "every x in l satisfies x.n > 0");
  assert.equal(celNaarFeel("l.size() > 0").tekst, "count(l) > 0");
  assert.equal(celNaarFeel("l.filter(x, x.n > 0).size()").tekst, "count(l[item.n > 0])");
  assert.equal(celNaarFeel("l[0].naam").tekst, "l[1].naam");
  assert.match(celNaarFeel("leeftijd(geboortedatum) > 17").fout, /leeftijd/);
});

test("geen CEL: fout met geenCel, zodat de schrijver de tekst kan doorlaten", () => {
  const uit = celNaarFeel('a and (some b in l satisfies b = "x")');
  assert.equal(uit.tekst, null);
  assert.equal(uit.geenCel, true);
});

test("overgang: JUEL herkennen en als CEL lezen", () => {
  assert.equal(isJuel("${a}"), true);
  assert.equal(isJuel("a == 1"), false);
  assert.equal(leesAlsCel("${ uitkomst == 'toegekend' }"), "uitkomst == 'toegekend'");
  assert.equal(leesAlsCel("uitkomst == 'toegekend'"), "uitkomst == 'toegekend'");
});

test("vrijeVariabelen: de eerste naam van elk pad, zonder lambda-variabelen", () => {
  const v = vrijeVariabelen(parseCelExpressie("bijlagen.exists(b, b.naam == soort) && a.b.c != null"));
  assert.deepEqual([...v].sort(), ["a", "bijlagen", "soort"]);
});

// ── In de schrijvers: de omgezette GPK-modellen geven de uitvoer van voorheen ──

import fs from "node:fs";
import { schrijfBpmn } from "./bpmnXmlSchrijver.js";
import { schrijfDmn } from "./dmnXmlSchrijver.js";

const leesFixture = (naam) => JSON.parse(fs.readFileSync(new URL(`../diagramprofielen/canoniek-uml/fixtures/cg-test/${naam}`, import.meta.url), "utf8"));
const condities = (xml) => [...xml.matchAll(/<bpmn:conditionExpression[^>]*>([^<]*)</g)].map((m) => m[1]);

test("BPMN-schrijver: CEL in het model wordt JUEL in de XML; JUEL gaat ongewijzigd door", () => {
  const model = leesFixture("inrichten-bpmn.bpmn-model.json").model;
  const inModel = Object.values(model.elements).filter((e) => e.elementType === "sequence-flow" && e.data?.conditie).map((e) => e.data.conditie);
  assert.equal(inModel.length, 5);
  assert.ok(inModel.every((c) => !isJuel(c)), "de fixture is omgezet naar CEL");
  const diagram = (naam) => Object.values(model.diagrams).find((d) => d.naam === naam).id;
  const behandelen = schrijfBpmn({ model, diagramId: diagram("Aanvraag behandelen"), proces: { id: "aanvraag-behandelen" } });
  assert.deepEqual(condities(behandelen.xml).sort(), ["${uitkomst == 'aanvulling'}", "${uitkomst == 'afgewezen'}", "${uitkomst == 'toegekend'}"]);
  const oppakken = schrijfBpmn({ model, diagramId: diagram("Aanvraag oppakken"), proces: { id: "aanvraag-oppakken" } });
  assert.deepEqual(condities(oppakken.xml).sort(), ["${!ontvankelijkheid.ontvankelijk}", "${ontvankelijkheid.ontvankelijk}"]);
  assert.ok(![...behandelen.diagnostics, ...oppakken.diagnostics].some((d) => d.code === "BPMN-CONDITIE"));

  // Nog JUEL in het model: ongewijzigd. Geen CEL en geen JUEL: een fout op het element.
  const flow = Object.values(model.elements).find((e) => e.data?.conditie === "uitkomst == 'toegekend'");
  const metJuel = { ...model, elements: { ...model.elements, [flow.id]: { ...flow, data: { ...flow.data, conditie: "${empty uitkomst}" } } } };
  assert.ok(condities(schrijfBpmn({ model: metJuel, diagramId: diagram("Aanvraag behandelen"), proces: { id: "p" } }).xml).includes("${empty uitkomst}"));
  const kapot = { ...model, elements: { ...model.elements, [flow.id]: { ...flow, data: { ...flow.data, conditie: "lijst.exists(x, x == 1)" } } } };
  const uit = schrijfBpmn({ model: kapot, diagramId: diagram("Aanvraag behandelen"), proces: { id: "p" } });
  assert.ok(uit.diagnostics.some((d) => d.severity === "error" && d.code === "BPMN-CONDITIE" && d.sourceId === flow.id));
});

test("DMN-schrijver: CEL in het model wordt FEEL in de XML; FEEL gaat door met een melding", () => {
  const tabel = Object.values(leesFixture("gpk-beslissingen.dmn-model.json").model.elements)[0].data.beslistabel;
  const expressie = tabel.inputs.find((c) => c.expressie).expressie;
  assert.equal(expressie, 'bijlagen != null && bijlagen.exists(b, b.naam == "pasfoto")');
  const uit = schrijfDmn({ beslissing: { id: "aanvraag-ontvankelijk", tabel } });
  assert.ok(uit.xml.includes("<dmn:text>bijlagen != null and (some b in bijlagen satisfies b.naam = &quot;pasfoto&quot;)</dmn:text>"));
  assert.deepEqual(uit.diagnostics, []);

  const feel = 'bijlagen != null and (some b in bijlagen satisfies b.naam = "pasfoto")';
  const oud = { ...tabel, inputs: tabel.inputs.map((c) => (c.expressie ? { ...c, expressie: feel } : c)) };
  const door = schrijfDmn({ beslissing: { id: "aanvraag-ontvankelijk", tabel: oud } });
  assert.equal(door.xml, uit.xml);
  assert.equal(door.diagnostics.length, 1);
  assert.match(door.diagnostics[0].message, /geen CEL/);
});

test("juelNaarCel: ${…} eraf, woordoperatoren naar tekens, strings ongemoeid", async () => {
  const { juelNaarCel } = await import("./celOmzetting.js");
  assert.deepEqual(juelNaarCel("${uitkomst == 'toegekend'}"), { tekst: "uitkomst == 'toegekend'", fout: null });
  assert.deepEqual(juelNaarCel("${!ontvankelijkheid.ontvankelijk}"), { tekst: "!ontvankelijkheid.ontvankelijk", fout: null });
  assert.equal(juelNaarCel("${a eq 'x' and not b}").tekst, "a == 'x' && !b");
  assert.equal(juelNaarCel("${toelichting == 'not and or'}").tekst, "toelichting == 'not and or'");
  assert.equal(juelNaarCel("#{n gt 2}").tekst, "n > 2");
  assert.deepEqual(juelNaarCel("uitkomst == 'x'"), { tekst: "uitkomst == 'x'", fout: null, geenJuel: true });
  assert.match(juelNaarCel("${empty bijlagen}").fout, /empty/);
  assert.ok(juelNaarCel("${a ==}").fout);
});
