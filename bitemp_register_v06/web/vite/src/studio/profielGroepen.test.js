// profielGroepen.test.js — de ordening van de profielen in mappen (Mark 23-11).
import test from "node:test";
import assert from "node:assert/strict";
import { groepeerProfielen, PROFIEL_GROEPEN } from "./profielGroepen.js";

test("elk profiel in één groep; UML met Statisch en Dynamisch; lege groepen vallen weg", () => {
  const { mappen, mapVan } = groepeerProfielen(["puur-uml", "sequence", "erd", "weergave", "transformatie"], { ouderId: "root" });
  const naam = (id) => mappen.find((m) => m.id === id)?.naam;
  const ouder = (id) => mappen.find((m) => m.id === id)?.ouderId;
  assert.equal(naam(mapVan["puur-uml"]), "Statisch");
  assert.equal(naam(mapVan.sequence), "Dynamisch");
  assert.equal(naam(ouder(mapVan.sequence)), "UML");
  assert.equal(ouder(ouder(mapVan.sequence)), "root");
  assert.equal(naam(mapVan.erd), "Gegevensmodellering");
  assert.equal(naam(mapVan.transformatie), "Plumbing");
  assert.deepEqual(mappen.map((m) => m.naam).sort(), ["Dynamisch", "Gegevensmodellering", "Plumbing", "Statisch", "UML"]);
});

test("een onbekend profiel komt in Overig; geen profiel staat in twee groepen", () => {
  const { mapVan, mappen } = groepeerProfielen(["sp", "erd"], { ouderId: "root" });
  assert.equal(mappen.find((m) => m.id === mapVan.sp).naam, "Overig");
  const alle = [];
  const loop = (g) => {
    alle.push(...(g.profielen || []));
    (g.groepen || []).forEach(loop);
  };
  PROFIEL_GROEPEN.forEach(loop);
  assert.equal(new Set(alle).size, alle.length);
});

test("het overzicht in Modelleren volgt de groepen; UML in één groep; klassieke editors bij Business", async () => {
  const { overzichtPerGroep } = await import("./profielGroepen.js");
  const items = ["sequence", "puur-uml", "erd", "act-bpmn", "sterplaneet", "profiel-ontwerp"].map((id) => ({ id }));
  const groepen = overzichtPerGroep(items, (i) => i.id);
  assert.deepEqual(groepen.map((g) => [g.naam, g.items.map((i) => i.id)]), [
    ["UML", ["sequence", "puur-uml"]],
    ["Gegevensmodellering", ["erd"]],
    ["Business", ["act-bpmn"]],
    ["Plumbing", ["profiel-ontwerp"]],
    ["Overig", ["sterplaneet"]],
  ]);
});
