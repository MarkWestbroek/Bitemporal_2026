import { test } from "node:test";
import assert from "node:assert/strict";
import "../studio/activities/regelsetsIngebouwd.js";
import { alleRegelsets } from "./regelsetCatalogus.js";
import { valideerRegelset } from "./regels.js";
import { regelsetNaarElement, regelsetsNaarModel, modelNaarRegelset, transformatieId, regelsetAlsUitwerking } from "./regelsetModel.js";
import { transformatieDiagramType, maakElement, TRANSFORMATIE_TYPE } from "../diagramprofielen/transformatie/index.js";
import { valideerDiagramType } from "../diagramcore/types/typeRegistry.js";
import { profielOntwerpKern } from "../studio/activities/profielOntwerp.js";

const PROFIELEN = new Set(["usecase", "bpmn-motor", "dmn-drd"]);
const isProfiel = (naam) => PROFIELEN.has(naam);

test("elke ingebouwde regelset gaat zonder verlies naar het model en terug", () => {
  const alle = alleRegelsets();
  assert.ok(alle.length >= 11);
  // Het model is gewone modeldata: het overleeft JSON (opslag, sync).
  const { elements } = JSON.parse(JSON.stringify(regelsetsNaarModel(alle, { isProfiel })));
  for (const v of alle) {
    const terug = modelNaarRegelset(elements[transformatieId(v.regelset.id)], elements);
    assert.deepEqual(terug.fouten, [], v.regelset.id);
    assert.deepEqual(terug.regelset, v.regelset, v.regelset.id);
    assert.equal(terug.richting, v.richting);
    assert.equal(terug.schrijver, v.schrijver);
    if (v.vorm === "regels") assert.deepEqual(valideerRegelset(terug.regelset), []);
  }
});

test("als uitwerking (een container met eigen bron en doel): ook zonder verlies terug", () => {
  for (const v of alleRegelsets()) {
    const { element, elements, leden, nodes } = JSON.parse(JSON.stringify(regelsetAlsUitwerking(v, { isProfiel })));
    const terug = modelNaarRegelset(element, elements);
    assert.deepEqual(terug.fouten, [], v.regelset.id);
    assert.deepEqual(terug.regelset, v.regelset, v.regelset.id);
    assert.equal(terug.richting, v.richting);
    assert.ok(["in", "tussen", "uit"].includes(terug.richting));
    const eindpunten = (v.regelset.bron !== undefined ? 1 : 0) + (v.regelset.doel !== undefined ? 1 : 0);
    assert.equal(leden.length, eindpunten, v.regelset.id);
    assert.equal(nodes.length, 1 + eindpunten);
  }
});

test("het model: kop in de data, regels in volgorde als velden, bron en doel als gedeelde elementen", () => {
  const a = {
    id: "a-naar-b",
    versie: 2,
    titel: "A → B",
    bron: "mermaid-flowchart",
    doel: "usecase",
    prefixen: { ex: "http://example.org/" },
    regels: [
      { naam: "actor", bij: "knoop", als: { vorm: "cirkel" }, maak: { type: "actor", naam: "{tekst}" }, meld: true },
      { naam: "erft", bij: "verbinding", zet: { op: "doel", data: { abstract: true } } },
      { naam: "rest", bij: "groep", negeer: true },
    ],
  };
  const b = { id: "b-naar-a", versie: "0.1.0", titel: "B → A", bron: "usecase", doel: "mermaid-flowchart", regels: [{ naam: "r", bij: "knoop", negeer: true }] };
  const { elements, nodes } = regelsetsNaarModel([{ regelset: a, richting: "import" }, { regelset: b, richting: "export" }], { isProfiel });

  const el = elements[transformatieId("a-naar-b")];
  assert.equal(el.elementType, TRANSFORMATIE_TYPE);
  assert.equal(el.naam, "A → B");
  assert.deepEqual(el.data, { code: "a-naar-b", versie: "2", versieIsGetal: true, richting: "import" });
  const [regels, instellingen] = el.compartimenten;
  assert.deepEqual(regels.velden.map((v) => [v.naam, v.data.typeLabel, v.data.actie]), [
    ["actor", "knoop → actor", "maak"],
    ["erft", "verbinding → zet op doel", "zet"],
    ["rest", "groep → negeer", "negeer"],
  ]);
  assert.equal(regels.velden[2].data.dan, undefined);
  assert.deepEqual(instellingen.velden.map((v) => [v.naam, v.data.typeLabel]), [["prefixen", "{ex}"]]);

  // Twee eindpunten, gedeeld door beide transformaties: een profiel is een taal, de rest een formaat.
  const per = (type) => Object.values(elements).filter((e) => e.elementType === type);
  assert.deepEqual(per("taal").map((e) => e.naam), ["usecase"]);
  assert.deepEqual(per("formaat").map((e) => e.naam), ["mermaid-flowchart"]);
  assert.equal(per("van").length, 2);
  assert.equal(per("naar").length, 2);
  // Alleen knopen op het diagram, elk op een eigen plek.
  assert.equal(nodes.length, 4);
  assert.equal(new Set(nodes.map((n) => `${n.position.x},${n.position.y}`)).size, 4);

  assert.deepEqual(modelNaarRegelset(el, elements).regelset, a);
  assert.deepEqual(modelNaarRegelset(elements[transformatieId("b-naar-a")], elements).regelset, b);
  // Zonder het model eromheen ontbreken alleen bron en doel.
  const { bron, doel, ...zonder } = a;
  assert.deepEqual(modelNaarRegelset(el).regelset, zonder);
});

test("wat niet te lezen is wordt gemeld, niet weggelaten", () => {
  const el = regelsetNaarElement({ id: "x", versie: 1, titel: "X", regels: [{ naam: "r", bij: "knoop", maak: { type: "t" } }] });
  el.compartimenten[0].velden[0].data.dan = "{ type: t }";
  el.compartimenten[0].velden.push({ naam: "leeg", fieldType: "regel", data: { bij: "knoop", actie: "" } });
  const { regelset, fouten } = modelNaarRegelset(el);
  assert.equal(regelset, null);
  assert.equal(fouten.length, 2);
  assert.match(fouten[0], /Regel 1 "r", dan: geen geldige JSON/);
  assert.match(fouten[1], /Regel 2 "leeg": actie moet maak, zet of negeer zijn/);
  assert.equal(modelNaarRegelset({ elementType: "taal", naam: "usecase", data: {} }).fouten.length, 2);

  // Twee bronnen is een fout in het model.
  const goed = regelsetNaarElement({ id: "y", versie: 1, titel: "Y", regels: [{ naam: "r", bij: "knoop", negeer: true }] });
  const elements = {
    [goed.id]: goed,
    f1: { id: "f1", naam: "een", elementType: "formaat", data: {} },
    f2: { id: "f2", naam: "twee", elementType: "formaat", data: {} },
    v1: { id: "v1", elementType: "van", source: "f1", target: goed.id },
    v2: { id: "v2", elementType: "van", source: "f2", target: goed.id },
  };
  assert.match(modelNaarRegelset(goed, elements).fouten[0], /meer dan één bron/);
});

test("het profiel Transformatie is een geldige descriptor; het Profiel-ontwerp (de M3-taal) kent het type niet", () => {
  assert.deepEqual(valideerDiagramType(transformatieDiagramType), []);
  // Elke sleutel die de omzetting in de data zet, is een eigenschap van het type.
  const et = transformatieDiagramType.elementTypes.find((t) => t.id === TRANSFORMATIE_TYPE);
  const el = regelsetNaarElement(alleRegelsets()[0].regelset, { richting: "import", schrijver: "s" });
  const bekend = new Set(et.properties.map((p) => p.key));
  assert.deepEqual(Object.keys(el.data).filter((k) => !bekend.has(k)), []);
  for (const c of el.compartimenten) {
    const ft = transformatieDiagramType.fieldTypes.find((f) => f.id === et.compartments.find((x) => x.id === c.compartmentType).fieldType);
    const sleutels = new Set(ft.properties.map((p) => p.key));
    for (const v of c.velden) assert.deepEqual(Object.keys(v.data).filter((k) => !sleutels.has(k)), [], v.naam);
  }
  assert.equal(maakElement("transformatie").compartimenten.length, 2);
  assert.equal(maakElement("van"), null);
  // Een transformatie is een M2 (een profiel), geen deel van de taal waarin je profielen tekent.
  assert.equal(profielOntwerpKern.elementTypes.some((t) => /transformatie/i.test(t.id)), false);
});
