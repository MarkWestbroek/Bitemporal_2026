import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DOMParser } from "@xmldom/xmldom";

import { parseExchange, lijktOpExchange } from "./parseExchange.js";

const fixture = (naam) => fs.readFileSync(new URL(`./fixtures/${naam}`, import.meta.url), "utf8");
const parse = (naam) => parseExchange(fixture(naam), { DOMParser });

test("parseert model, elementen, relatie en view namespace-onafhankelijk", () => {
  const model = parse("minimaal-model.xml");
  assert.equal(model.model.identifier, "model-min");
  assert.equal(model.elements["actor-1"].type, "BusinessActor");
  assert.equal(model.relationships["rel-1"].source, "actor-1");
  assert.equal(model.views["view-1"].nodes[0].identifier, "node-a");
  assert.equal(lijktOpExchange({ tekst: fixture("minimaal-model.xml") }), 1);
  const prefixed = parseExchange('<a:model xmlns:a="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="p"><a:elements><a:element identifier="g" xsi:type="a:Goal"><a:name>Doel</a:name></a:element></a:elements></a:model>', { DOMParser });
  assert.equal(prefixed.elements.g.type, "Goal");
});

test("bewaart meertaligheid, properties en stijl", () => {
  const model = parse("properties-en-stijl.xml");
  assert.deepEqual(model.elements.data.names.map((n) => n.lang), ["en", "nl"]);
  assert.equal(model.elements.data.properties[0].waarden[0].value, "Team Zaken");
  assert.equal(model.views.stijl.nodes[0].style.fillColor.b, 220);
});

test("parseert organizations, meerdere views en geneste nodes", () => {
  const model = parse("meerdere-views.xml");
  assert.equal(Object.keys(model.views).length, 2);
  assert.equal(model.organizations[0].items[0].identifierRef, "landschap");
  const viewOnly = parse("voorkomens-label-container.xml");
  assert.equal(viewOnly.views["view-only"].nodes[0].nodes.length, 2);
  assert.equal(viewOnly.views["view-only"].connections[0].bendpoints.length, 1);
});

test("weigert onbekende namespace, verkeerde root, syntaxfout en dubbele ids", () => {
  assert.throws(() => parseExchange('<model xmlns="urn:onbekend"/>', { DOMParser }), (e) => e.code === "AMX-XML-NAMESPACE");
  assert.throws(() => parseExchange('<anders xmlns="http://www.opengroup.org/xsd/archimate/3.0/"/>', { DOMParser }), (e) => e.code === "AMX-XML-ROOT");
  assert.throws(() => parseExchange('<model>', { DOMParser }), (e) => e.code === "AMX-XML-ONGELDIG");
  const dubbel = parseExchange('<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><elements><element identifier="x" xsi:type="Goal"><name>x</name></element><element identifier="x" xsi:type="Goal"><name>x</name></element></elements></model>', { DOMParser });
  assert.ok(dubbel.diagnostics.some((d) => d.code === "AMX-ID-DUBBEL" && d.severity === "error"));
});
test("een connection mag op een latere connection eindigen (lijn-op-lijn)", () => {
  // GEMMA-realiteit: volgorde in het bestand mag geen blokkerende
  // AMX-ID-REFERENTIE opleveren wanneer het doel een connection is.
  const xml = `<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="m">
    <elements>
      <element identifier="a" xsi:type="BusinessActor"><name>A</name></element>
      <element identifier="b" xsi:type="BusinessRole"><name>B</name></element>
    </elements>
    <relationships>
      <relationship identifier="r1" source="a" target="b" xsi:type="Assignment"/>
      <relationship identifier="r2" source="a" target="b" xsi:type="Association"/>
    </relationships>
    <views><diagrams><view identifier="v" xsi:type="Diagram">
      <node identifier="na" elementRef="a" xsi:type="Element" x="0" y="0" w="100" h="50"/>
      <node identifier="nb" elementRef="b" xsi:type="Element" x="300" y="0" w="100" h="50"/>
      <connection identifier="c-eerst" relationshipRef="r2" source="na" target="c-later" xsi:type="Relationship"/>
      <connection identifier="c-later" relationshipRef="r1" source="na" target="nb" xsi:type="Relationship"/>
    </view></diagrams></views>
  </model>`;
  const exchange = parseExchange(xml, { DOMParser });
  assert.ok(!exchange.diagnostics.some((d) => d.code === "AMX-ID-REFERENTIE"), "lijn-op-lijn is geen referentiefout");
});
