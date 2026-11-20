// ontwerptaal.test.js — de taal van het Profiel-ontwerp is het M3 (Mark 19-11).
import test from "node:test";
import assert from "node:assert/strict";
import { M3_KLASSEN } from "../../diagramcore/types/m3.js";
import { ONTWERP_SOORTEN, m3Eigenschappen, m3PropertyTypes, isCode, naarData, uitData, naamNaarData, naamUitData } from "./ontwerptaal.js";
import { profielOntwerpKern } from "./profielOntwerp.js";

test("dekking: elke M3-eigenschap is in de ontwerptaal een eigenschap, tekening of code", () => {
  for (const [soort, { klasse: naam, tekening }] of Object.entries(ONTWERP_SOORTEN)) {
    const klasse = M3_KLASSEN.find((k) => k.naam === naam);
    assert.ok(klasse, `${soort}: ${naam} staat in het M3`);
    const eigenschappen = new Set(m3Eigenschappen(soort).map(({ e }) => e.naam));
    for (const e of klasse.eigenschappen) {
      const waar = eigenschappen.has(e.naam) ? "eigenschap" : e.naam in tekening ? "tekening" : isCode(klasse, e) ? "code" : null;
      assert.ok(waar, `${soort}: ${naam}.${e.naam} valt nergens onder`);
    }
    // De tekening noemt alleen eigenschappen die het M3 kent (een hernoeming valt zo op).
    for (const sleutel of Object.keys(tekening)) assert.ok(klasse.eigenschappen.some((e) => e.naam === sleutel), `${soort}: tekening noemt ${naam}.${sleutel}, die het M3 niet kent`);
  }
});

test("de inspector van een «elementtype»-knoop toont de M3-eigenschappen, met de M3-naam", () => {
  const elementDef = profielOntwerpKern.elementTypes.find((t) => t.id === "elementDef");
  const sleutels = elementDef.properties.map((p) => p.key);
  for (const naam of ["kleur", "stereotype", "isAbstract", "inPalet", "lidwoord", "minBreedte", "randElement", "edgePresentatie", "containerVoor"]) {
    assert.ok(sleutels.includes(`m3:${naam}`), naam);
  }
  // Wat de tekening draagt, staat niet nog eens in de inspector.
  for (const naam of ["label", "erft", "compartments", "properties"]) assert.ok(!sleutels.includes(`m3:${naam}`), naam);
  assert.equal(new Set(sleutels).size, sleutels.length, "geen dubbele sleutels");
  const bediening = Object.fromEntries(elementDef.properties.map((p) => [p.key, p.datatype]));
  assert.equal(bediening["m3:kleur"], "colour");
  assert.equal(bediening["m3:shape"], "shape-keuze");
  assert.equal(bediening["m3:minBreedte"], "m3-getal");
  assert.equal(bediening["m3:lidwoord"], "keuze");
  assert.equal(bediening["m3:randElement"], "m3-json");
  assert.ok(elementDef.properties.find((p) => p.key === "m3:lidwoord").opties.some((o) => o.waarde === "het"));
  // Een lijn (connector) toont zijn eigenschappen en vakken als gegevens; erft is een id.
  const lijn = m3PropertyTypes("verbindingsregel").map((p) => p.key);
  assert.ok(lijn.includes("m3:properties") && lijn.includes("m3:erft"));
});

test("naarData en uitData: echte waarden heen en terug, code en afgeleide sleutels niet", () => {
  const et = { id: "a", label: "A", kleur: "#fff", minBreedte: 80, inPalet: false, opname: null, facetten: { laag: "x" }, hooks: { edgeLabels: "kardinaliteiten", inhoudsregels: () => [] }, _geerfd: { properties: [] } };
  const data = naarData("elementDef", et);
  assert.deepEqual(data, { "m3:id": "a", "m3:kleur": "#fff", "m3:inPalet": false, "m3:minBreedte": 80, "m3:facetten": { laag: "x" }, "m3:opname": null, "m3:hooks": { edgeLabels: "kardinaliteiten" } });
  assert.deepEqual(uitData("elementDef", data), { id: "a", kleur: "#fff", inPalet: false, minBreedte: 80, facetten: { laag: "x" }, opname: null, hooks: { edgeLabels: "kardinaliteiten" } });
  // Een keuze buiten de enumeratie en een lege keuze tellen niet.
  assert.deepEqual(uitData("elementDef", { "m3:lidwoord": "een", "m3:naamLabel": "" }), {});
});

test("de naam van een knoop: een ontbrekend of leeg label komt terug zolang je hem niet wijzigt", () => {
  assert.deepEqual(naamNaarData("Tabel", "Tabel"), {});
  const knoop = { naam: "kolommen", data: naamNaarData(null, "kolommen") };
  assert.deepEqual(naamUitData(knoop), { gezet: true, waarde: null });
  assert.deepEqual(naamUitData({ naam: "x", data: naamNaarData(undefined, "x") }), { gezet: false });
  assert.deepEqual(naamUitData({ ...knoop, naam: "Kolommen" }), { gezet: true, waarde: "Kolommen" });
});
