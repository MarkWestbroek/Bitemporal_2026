// afgeleid.test.js — afgeleide associaties: EA → profiel → XMI.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/ea/afgeleid.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { afgeleidUitConnector } from "./qeaHulp.js";
import { schrijfXmi } from "./schrijfXmi.js";

test("EA: '/' in de naam of een rol met Derived=1 maakt een associatie afgeleid", () => {
  assert.deepEqual(afgeleidUitConnector({ Name: "/grootouder" }), { afgeleid: true, naam: "grootouder" });
  assert.deepEqual(afgeleidUitConnector({ Name: " / heeft" }), { afgeleid: true, naam: "heeft" });
  assert.deepEqual(afgeleidUitConnector({ Name: "heeft", DestStyle: "Union=0;Derived=1;AllowDuplicates=0;" }), { afgeleid: true, naam: "heeft" });
  assert.deepEqual(afgeleidUitConnector({ Name: "heeft", SourceStyle: "Union=0;Derived=0;" }), { afgeleid: false, naam: "heeft" });
  assert.deepEqual(afgeleidUitConnector({}), { afgeleid: false, naam: "" });
});

test("XMI: isDerived op de associatie (UML afgeleid én MIM indicatieAfleidbaar) en op attributen", () => {
  const model = {
    elements: {
      a: { id: "a", naam: "Persoon", elementType: "klasse", compartimenten: [{ compartmentType: "attributen", velden: [{ naam: "leeftijd", data: { afgeleid: true } }] }], data: {} },
      b: { id: "b", naam: "Adres", elementType: "klasse", compartimenten: [], data: {} },
      r: { id: "r", naam: "woontOp", elementType: "associatie", source: "a", target: "b", compartimenten: [], data: { afgeleid: true } },
      m: { id: "m", naam: "anders", elementType: "associatie", source: "b", target: "a", compartimenten: [], data: { indicatieAfleidbaar: true } },
      g: { id: "g", naam: "gewoon", elementType: "associatie", source: "a", target: "b", compartimenten: [], data: {} },
    },
    diagrams: {},
  };
  const { xml } = schrijfXmi(model, { naam: "T", schaal: 1 });
  const assoc = (naam) => xml.match(new RegExp(`<packagedElement xmi:type="uml:Association"[^>]*name="${naam}"[^>]*>`))?.[0] || "";
  assert.match(assoc("woontOp"), /isDerived="true"/);
  assert.match(assoc("anders"), /isDerived="true"/);
  assert.doesNotMatch(assoc("gewoon"), /isDerived/);
  assert.match(xml, /name="leeftijd"[^>]*isDerived="true"/);
});
