import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DOMParser } from "@xmldom/xmldom";

import { parseExchange } from "./parseExchange.js";
import { naarCoreModel, kiesTaalwaarde } from "./naarCoreModel.js";
import { ELEMENT_TYPE_MAPPING, RELATIONSHIP_TYPE_MAPPING } from "./typeMapping.js";

const fixture = (naam) => fs.readFileSync(new URL(`./fixtures/${naam}`, import.meta.url), "utf8");
const converteer = (naam, opties = {}) => naarCoreModel(parseExchange(fixture(naam), { DOMParser }), { importId: "test", ...opties });

test("mappingtabellen dekken 24 elementvarianten en alle elf relatietypen met naamvarianten", () => {
  assert.equal(Object.keys(ELEMENT_TYPE_MAPPING).length, 24);
  assert.equal(new Set(Object.values(RELATIONSHIP_TYPE_MAPPING)).size, 11);
  assert.equal(Object.keys(RELATIONSHIP_TYPE_MAPPING).length, 22);
});

test("adapter vertaalt alle elf relaties en beide junctionvarianten", () => {
  const exchange = parseExchange(fixture("minimaal-model.xml"), { DOMParser });
  exchange.elements.and = { ...exchange.elements["actor-1"], identifier: "and", type: "AndJunction", names: [] };
  exchange.elements.or = { ...exchange.elements["actor-1"], identifier: "or", type: "OrJunction", names: [] };
  const verwacht = ["compositie", "aggregatie", "toewijzing", "realisatie", "bediening", "toegang", "beinvloeding", "trigger", "stroom", "specialisatie", "associatie"];
  const exchangeTypes = ["Composition", "AggregationRelationship", "Assignment", "RealizationRelationship", "Serving", "AccessRelationship", "Influence", "TriggeringRelationship", "Flow", "SpecializationRelationship", "Association"];
  exchange.relationships = Object.fromEntries(exchangeTypes.map((type, index) => [`r${index}`, { ...exchange.relationships["rel-1"], identifier: `r${index}`, type }]));
  const model = naarCoreModel(exchange, { importId: "alle" });
  assert.deepEqual(exchangeTypes.map((_, index) => model.elements[`amx:alle:r${index}`].elementType), verwacht);
  assert.equal(model.elements["amx:alle:and"].elementType, "junction");
  assert.equal(model.elements["amx:alle:and"].data.soort, undefined);
  assert.equal(model.elements["amx:alle:or"].data.soort, "of");
});

test("kiest importtaal, primaire taal, Engels, taalloos en eerste waarde", () => {
  const waarden = [{ lang: "de", value: "Deutsch" }, { lang: null, value: "Naamloos" }, { lang: "en", value: "English" }, { lang: "nl-NL", value: "Nederlands" }];
  assert.equal(kiesTaalwaarde(waarden, "nl-BE"), "Nederlands");
  assert.equal(kiesTaalwaarde(waarden, "fr"), "English");
  assert.equal(kiesTaalwaarde([{ lang: null, value: "Zonder taal" }], "fr"), "Zonder taal");
  assert.equal(kiesTaalwaarde([{ lang: "de", value: "Eerste" }], "fr"), "Eerste");
  assert.equal(kiesTaalwaarde([], "nl"), "(naamloos)");
});

test("maakt namenpaced elementen, relaties, properties en speciale relatiedata", () => {
  const basis = converteer("minimaal-model.xml");
  assert.equal(basis.elements["amx:test:actor-1"].elementType, "business-actor");
  assert.equal(basis.elements["amx:test:rel-1"].source, "amx:test:actor-1");
  const props = converteer("properties-en-stijl.xml");
  assert.equal(props.elements["amx:test:data"].naam, "Zaak");
  assert.equal(props.elements["amx:test:data"].data.exchange.properties[0].type, "string");
  assert.equal(props.elements["amx:test:data"].data.kleur, "#0c64dc");

  const exchange = parseExchange(fixture("minimaal-model.xml"), { DOMParser });
  exchange.relationships["rel-1"].type = "AccessRelationship";
  exchange.relationships["rel-1"].attributes.accessType = "ReadWrite";
  exchange.relationships.invloed = { ...exchange.relationships["rel-1"], identifier: "invloed", type: "InfluenceRelationship", attributes: { modifier: "++" } };
  const speciaal = naarCoreModel(exchange, { importId: "speciaal" });
  assert.equal(speciaal.elements["amx:speciaal:rel-1"].data.toegang, "rw");
  assert.equal(speciaal.elements["amx:speciaal:invloed"].data.invloed, "++");
});

test("importeert meerdere views, meerdere voorkomens, absolute nesting en hide-list", () => {
  const meerdere = converteer("meerdere-views.xml");
  const landschap = meerdere.diagrams["amx:test:landschap"];
  assert.equal(landschap.nodes.filter((node) => node.elementId === "amx:test:app").length, 2);
  assert.equal(landschap.connectorVoorkomens["amx:test:serveert"].doelNodeId, "amx:test:view:landschap:node:app-rechts");
  assert.deepEqual(meerdere.diagrams["amx:test:zonder-relatie"].verborgenConnectoren, ["amx:test:serveert"]);
  assert.deepEqual(meerdere.stats.ongevisualiseerdeElementIds, ["amx:test:los"]);

  const viewOnly = converteer("voorkomens-label-container.xml");
  const diagram = viewOnly.diagrams["amx:test:view-only"];
  const component = diagram.nodes.find((node) => node.nodeId.endsWith(":component-1"));
  assert.deepEqual(component.position, { x: 130, y: 140 });
  assert.equal(diagram.nodes.filter((node) => node.elementId === "amx:test:component").length, 2);
  assert.ok(Object.values(viewOnly.elements).some((element) => element.elementType === "notitie"));
  assert.ok(Object.values(viewOnly.elements).some((element) => element.elementType === "kader"));
  assert.ok(Object.values(viewOnly.elements).some((element) => element.elementType === "toelichting"));
  assert.ok(viewOnly.diagnostics.some((item) => item.code === "AMX-LOSS-ROUTING"));
});

test("onbekende typen leveren diagnostics en nooit halve connectoren", () => {
  const model = converteer("onbekende-typen.xml");
  assert.deepEqual(Object.keys(model.elements), ["amx:test:goed"]);
  assert.ok(model.diagnostics.some((item) => item.code === "AMX-TYPE-ELEMENT"));
  assert.ok(model.diagnostics.filter((item) => item.code === "AMX-TYPE-RELATIE").length >= 2);
  assert.equal(model.meta.exchange.overgeslagen.elements.vreemd.type, "Capability");
  assert.equal(Object.keys(model.meta.exchange.overgeslagen.relationships).length, 2);
});

test("blokkerende parserdiagnostics verhinderen conversie", () => {
  const exchange = parseExchange(fixture("minimaal-model.xml"), { DOMParser });
  exchange.diagnostics.push({ severity: "error", code: "AMX-ID-DUBBEL", message: "fout", sourceId: null, path: null });
  assert.throws(() => naarCoreModel(exchange), (fout) => fout.code === "AMX-ID-DUBBEL");
});