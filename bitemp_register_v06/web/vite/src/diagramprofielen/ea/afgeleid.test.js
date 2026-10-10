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

import { rolEigenschappen } from "./qeaHulp.js";

test("EA-rol → UML-uiteinde: navigeerbaar, geordend, niet-uniek, alleen-lezen", () => {
  const c = {
    SourceStyle: "Union=0;Derived=0;AllowDuplicates=1;Owned=0;Navigable=Non-Navigable;",
    DestStyle: "Union=0;Derived=0;AllowDuplicates=0;Owned=0;Navigable=Navigable;",
    SourceIsOrdered: 0,
    DestIsOrdered: 1,
    DestChangeable: "frozen",
  };
  assert.deepEqual(rolEigenschappen(c, "Source", "bron"), { bronNavigeerbaar: "nee", bronNietUniek: true });
  assert.deepEqual(rolEigenschappen(c, "Dest", "doel"), { doelNavigeerbaar: "ja", doelGeordend: true, doelAlleenLezen: true });
  // Zonder stijlkolom: IsNavigable.
  assert.deepEqual(rolEigenschappen({ DestIsNavigable: 1 }, "Dest", "doel"), { doelNavigeerbaar: "ja" });
  assert.deepEqual(rolEigenschappen({}, "Source", "bron"), {});
});

test("XMI: kernset op attributen en uiteinden, navigableOwnedEnd", () => {
  const model = {
    elements: {
      a: {
        id: "a", naam: "Persoon", elementType: "klasse", data: {},
        compartimenten: [{ compartmentType: "attributen", velden: [{ naam: "bsn", data: { isId: true, alleenLezen: true, zichtbaarheid: "Private", standaardwaarde: "0" } }, { naam: "namen", data: { geordend: true, nietUniek: true } }] }],
      },
      b: { id: "b", naam: "Adres", elementType: "klasse", compartimenten: [], data: {} },
      r: { id: "r", naam: "woontOp", elementType: "associatie", source: "a", target: "b", compartimenten: [], data: { doelNavigeerbaar: "ja", bronNavigeerbaar: "nee", doelGeordend: true } },
      o: { id: "o", naam: "oud", elementType: "associatie", source: "b", target: "a", compartimenten: [], data: { directioneel: true } },
    },
    diagrams: {},
  };
  const { xml } = schrijfXmi(model, { naam: "T", schaal: 1 });
  assert.match(xml, /name="bsn" visibility="private"[^>]*isReadOnly="true" isID="true"/);
  assert.match(xml, /<defaultValue xmi:type="uml:LiteralString"[^>]*value="0"\/>/);
  assert.match(xml, /name="namen"[^>]*isOrdered="true" isUnique="false"/);
  const assoc = (naam) => xml.match(new RegExp(`<packagedElement xmi:type="uml:Association"[^>]*name="${naam}"[^>]*>`))?.[0] || "";
  assert.match(assoc("woontOp"), /navigableOwnedEnd="EAID_dst[^ "]+"/, "alleen het doel is navigeerbaar");
  assert.doesNotMatch(assoc("woontOp"), /EAID_src/);
  assert.match(assoc("oud"), /navigableOwnedEnd="EAID_dst/, "directioneel migreert naar doel navigeerbaar");
  assert.match(xml, /aggregation="none" isOrdered="true"><type/);
});
