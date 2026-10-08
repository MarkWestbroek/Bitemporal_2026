// erfenis.test.js — ElementType.erft / isAbstract: uitvlakken en bereik-expansie.
// Run: node --import ./test/register-aliases.mjs --test src/diagramcore/types/erfenis.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { normaliseerErfenis, kopieVoorNormalisatie, concreteTypenVan } from "./erfenis.js";
import { registreerDiagramType, vervangDiagramType, getDiagramType, valideerDiagramType, verbindingsregelsVan, _resetVoorTests } from "./typeRegistry.js";

/** Marks Metamodel v2026 in het klein: abstracte Representatie boven entiteit en gegevenselement. */
function maakProfiel() {
  return {
    id: "mini-canoniek",
    label: "Mini canoniek",
    style: "uml-klassiek",
    fieldTypes: [{ id: "veld", viewer: "naam-type", properties: [{ key: "naam", datatype: "string" }] }],
    elementTypes: [
      {
        id: "representatie",
        label: "Representatie",
        isAbstract: true,
        shape: "class-box",
        kleur: "#eee",
        properties: [{ key: "alias", datatype: "string" }, { key: "beschrijving", datatype: "tekst" }],
        compartments: [{ id: "regels", label: "regels", fieldType: "veld" }],
        hooks: { a: () => 1, b: () => 2 },
      },
      {
        id: "entiteit",
        label: "Entiteit",
        kort: "ENT",
        erft: "representatie",
        kleur: "#ffd",
        properties: [{ key: "beschrijving", datatype: "string", label: "eigen" }],
        compartments: [{ id: "attributen", label: null, fieldType: "veld" }],
        hooks: { b: () => 3 },
      },
      { id: "gegevenselement", label: "Gegevenselement", kort: "GE", erft: "representatie" },
      { id: "notitie", label: "Notitie", shape: "note" },
      {
        id: "relatie",
        label: "Relatie",
        shape: "edge",
        isConnector: true,
        bron: { elementTypes: ["representatie"] },
        doel: { elementTypes: ["representatie", "notitie"] },
      },
      {
        id: "pin",
        label: "Pin",
        shape: "chip",
        randElement: { ouderTypes: ["representatie"] },
      },
    ],
    shapeSets: [{ id: "figuren", label: "Figuren", shapes: { representatie: "bol", entiteit: "ster" } }],
  };
}

test("uitvlakken: scalars en compartimenten/properties van de ouder, kind wint per id/key", () => {
  const dt = maakProfiel();
  assert.deepEqual(normaliseerErfenis(dt), []);
  const ent = dt.elementTypes.find((e) => e.id === "entiteit");
  assert.equal(ent.shape, "class-box", "shape geërfd");
  assert.equal(ent.kleur, "#ffd", "eigen kleur wint");
  assert.equal(ent.label, "Entiteit", "label nooit geërfd");
  assert.deepEqual(ent.compartments.map((c) => c.id), ["regels", "attributen"], "ouder eerst");
  assert.deepEqual(ent.properties.map((p) => [p.key, p.label ?? null]), [["alias", null], ["beschrijving", "eigen"]]);
  assert.equal(ent.hooks.a(), 1);
  assert.equal(ent.hooks.b(), 3, "hook van het kind wint");
  assert.deepEqual(ent._geerfd, { compartments: ["regels"], properties: ["alias"] });
  const ge = dt.elementTypes.find((e) => e.id === "gegevenselement");
  assert.deepEqual(ge.compartments.map((c) => c.id), ["regels"]);
  assert.ok(ge.isAbstract === undefined, "isAbstract erft niet");
});

test("bereik-expansie: abstract type → zijn concrete afstammelingen, origineel bewaard", () => {
  const dt = maakProfiel();
  normaliseerErfenis(dt);
  const rel = dt.elementTypes.find((e) => e.id === "relatie");
  assert.deepEqual(rel.bron.elementTypes, ["entiteit", "gegevenselement"]);
  assert.deepEqual(rel.doel.elementTypes, ["entiteit", "gegevenselement", "notitie"]);
  assert.deepEqual(rel.bron._voorExpansie, ["representatie"]);
  const pin = dt.elementTypes.find((e) => e.id === "pin");
  assert.deepEqual(pin.randElement.ouderTypes, ["entiteit", "gegevenselement"]);
  assert.deepEqual(dt.shapeSets[0].shapes, { representatie: "bol", entiteit: "ster", gegevenselement: "bol" });
  assert.deepEqual(concreteTypenVan(dt, "representatie"), ["entiteit", "gegevenselement"]);
  assert.deepEqual(concreteTypenVan(dt, "entiteit"), ["entiteit"]);
});

test("idempotent: twee keer normaliseren verandert niets meer", () => {
  const dt = maakProfiel();
  normaliseerErfenis(dt);
  const eerste = JSON.stringify(dt, (k, v) => (typeof v === "function" ? "fn" : v));
  normaliseerErfenis(dt);
  assert.equal(JSON.stringify(dt, (k, v) => (typeof v === "function" ? "fn" : v)), eerste);
});

test("fouten: onbekende ouder, cyclus, zelf, isConnector slaat om", () => {
  const dt = maakProfiel();
  dt.elementTypes.push({ id: "x", label: "X", shape: "class-box", erft: "bestaat-niet" });
  assert.match(normaliseerErfenis(dt)[0], /onbekend ElementType "bestaat-niet"/);

  const cyc = maakProfiel();
  cyc.elementTypes.find((e) => e.id === "representatie").erft = "entiteit";
  assert.ok(normaliseerErfenis(cyc).some((f) => /cyclische/.test(f)));

  const zelf = maakProfiel();
  zelf.elementTypes.find((e) => e.id === "entiteit").erft = "entiteit";
  assert.ok(normaliseerErfenis(zelf).some((f) => /van zichzelf/.test(f)));

});

test("Metamodel v2026: relatie erft van gegevenselement (connector onder knoop), representatie-bereik sluit relaties uit", () => {
  // Mark (09-10): {Relatie} is een soort {Gegevenselement}, met bron/doel naar
  // {Representatie}; een bron of doel is nooit zelf een relatie.
  const dt = maakProfiel();
  dt.elementTypes = dt.elementTypes.filter((e) => e.id !== "relatie");
  dt.elementTypes.push({
    id: "relatie",
    label: "Relatie",
    kort: "REL",
    erft: "gegevenselement",
    isConnector: true,
    shape: "edge",
    bron: { elementTypes: ["representatie"] },
    doel: { elementTypes: ["representatie"] },
    properties: [{ key: "tijdlijn", datatype: "string" }],
  });
  assert.deepEqual(valideerDiagramType(dt), []);
  normaliseerErfenis(dt);
  const rel = dt.elementTypes.find((e) => e.id === "relatie");
  assert.equal(rel.isConnector, true);
  assert.equal(rel.shape, "edge", "eigen shape wint van de geërfde class-box");
  assert.deepEqual(rel.compartments.map((c) => c.id), ["regels"], "compartimenten van gegevenselement/representatie komen mee (relatieklasse)");
  assert.deepEqual(rel.properties.map((p) => p.key), ["alias", "beschrijving", "tijdlijn"]);
  assert.deepEqual(rel.bron.elementTypes, ["entiteit", "gegevenselement"], "geen relatie in het bereik van representatie");
  assert.deepEqual(rel.doel.elementTypes, ["entiteit", "gegevenselement"]);
  // Expliciet genoemd mag een connector wél bron/doel zijn.
  const pin = dt.elementTypes.find((e) => e.id === "pin");
  pin.randElement = { ouderTypes: ["relatie"] };
  delete pin.randElement._ouderTypesVoorExpansie;
  normaliseerErfenis(dt);
  assert.deepEqual(pin.randElement.ouderTypes, ["relatie"]);
  assert.deepEqual(concreteTypenVan(dt, "representatie"), ["entiteit", "gegevenselement", "relatie"], "concreteTypenVan telt wél alles");
});

test("registry: valideren raakt de rauwe descriptor niet; registreren vlakt in place uit", () => {
  _resetVoorTests();
  const dt = maakProfiel();
  assert.deepEqual(valideerDiagramType(dt), []);
  assert.equal(dt._erfenisGenormaliseerd, undefined, "valideren laat het origineel met rust");
  assert.deepEqual(dt.elementTypes.find((e) => e.id === "relatie").bron.elementTypes, ["representatie"]);
  registreerDiagramType(dt);
  assert.equal(getDiagramType("mini-canoniek"), dt, "zelfde object (activiteiten houden het vast)");
  assert.deepEqual(verbindingsregelsVan(dt.elementTypes.find((e) => e.id === "relatie"))[0].bron, ["entiteit", "gegevenselement"]);
  // Vervangen (profiel-ontwerper) werkt op een verse descriptor net zo.
  vervangDiagramType(maakProfiel());
  assert.deepEqual(getDiagramType("mini-canoniek").elementTypes.find((e) => e.id === "pin").randElement.ouderTypes, ["entiteit", "gegevenselement"]);
  _resetVoorTests();
});

test("een connector-kind erft de verbindingsregels van zijn ouder als het er zelf geen heeft", () => {
  const dt = maakProfiel();
  dt.elementTypes.push({ id: "relatie-speciaal", label: "RS", shape: "edge", isConnector: true, erft: "relatie" });
  assert.deepEqual(valideerDiagramType(dt), []);
  normaliseerErfenis(dt);
  const rs = dt.elementTypes.find((e) => e.id === "relatie-speciaal");
  assert.deepEqual(rs.bron.elementTypes, ["entiteit", "gegevenselement"]);
});

test("kopieVoorNormalisatie deelt hooks maar niet de data-delen", () => {
  const dt = maakProfiel();
  const k = kopieVoorNormalisatie(dt);
  normaliseerErfenis(k);
  assert.notEqual(k.elementTypes[4].bron, dt.elementTypes[4].bron);
  assert.equal(k.elementTypes[0].hooks.a, dt.elementTypes[0].hooks.a);
  assert.equal(dt.elementTypes[1].compartments.length, 1, "origineel onaangeroerd");
});

test("bron en doel erven per kant: een kind dat alleen zijn bron vernauwt houdt het doel van de ouder", () => {
  const dt = maakProfiel();
  dt.elementTypes.push({ id: "relatie-smal", label: "RSm", shape: "edge", isConnector: true, erft: "relatie", bron: { elementTypes: ["entiteit"] } });
  assert.deepEqual(valideerDiagramType(dt), []);
  normaliseerErfenis(dt);
  const rs = dt.elementTypes.find((e) => e.id === "relatie-smal");
  assert.deepEqual(rs.bron.elementTypes, ["entiteit"]);
  assert.deepEqual(rs.doel.elementTypes, ["entiteit", "gegevenselement", "notitie"], "doel geërfd");
});

test("hierarchie, samentrekking.relatieTypes en opname.relatieTypes expanderen; containerVoor naar abstract is fout", () => {
  const dt = maakProfiel();
  dt.elementTypes.find((e) => e.id === "relatie").isAbstract = true;
  dt.elementTypes.push({ id: "bevat", label: "Bevat", shape: "edge", isConnector: true, erft: "relatie" });
  dt.elementTypes.push({ id: "gebruikt", label: "Gebruikt", shape: "edge", isConnector: true, erft: "relatie" });
  dt.hierarchie = ["relatie", { type: "relatie", omgekeerd: true }];
  const ent = dt.elementTypes.find((e) => e.id === "entiteit");
  ent.samentrekking = { gedaante: "bol", relatieTypes: ["relatie"] };
  ent.opname = { relatieTypes: ["relatie"] };
  assert.deepEqual(normaliseerErfenis(dt), []);
  assert.deepEqual(dt.hierarchie, ["bevat", "gebruikt", { type: "bevat", omgekeerd: true }, { type: "gebruikt", omgekeerd: true }]);
  assert.deepEqual(dt._hierarchieVoorExpansie, ["relatie", { type: "relatie", omgekeerd: true }]);
  assert.deepEqual(ent.samentrekking.relatieTypes, ["bevat", "gebruikt"]);
  assert.deepEqual(ent.opname.relatieTypes, ["bevat", "gebruikt"]);
  // Kind erft de gedaante-definitie van de ouder (geen `_`-sleutels mee).
  const ge = dt.elementTypes.find((e) => e.id === "gegevenselement");
  assert.equal(ge.samentrekking, undefined, "representatie had er geen");
  normaliseerErfenis(dt); // idempotent, ook voor de hiërarchie
  assert.deepEqual(dt.hierarchie.length, 4);

  const fout = maakProfiel();
  fout.elementTypes.find((e) => e.id === "relatie").isAbstract = true;
  fout.elementTypes.find((e) => e.id === "entiteit").containerVoor = "relatie";
  assert.ok(normaliseerErfenis(fout).some((f) => /containerVoor "relatie" is abstract/.test(f)));
});

test("een bewaarde profiel-kern blijft rauw als je op een kopie registreert", () => {
  _resetVoorTests();
  const kern = maakProfiel();
  const voor = JSON.stringify(kern, (k, v) => (typeof v === "function" ? "fn" : v));
  vervangDiagramType(kopieVoorNormalisatie(kern));
  assert.equal(JSON.stringify(kern, (k, v) => (typeof v === "function" ? "fn" : v)), voor);
  assert.deepEqual(getDiagramType("mini-canoniek").elementTypes.find((e) => e.id === "relatie").bron.elementTypes, ["entiteit", "gegevenselement"]);
  _resetVoorTests();
});
