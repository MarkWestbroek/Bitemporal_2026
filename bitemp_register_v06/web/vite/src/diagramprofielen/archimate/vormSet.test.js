// vormSet.test.js — de shape-set "Iconen als vorm" (P07).
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/archimate/vormSet.test.js
//
// N.B. het profiel zelf (`index.js`) importeert shapes (`.jsx`) en is daarmee
// niet laadbaar in de node-testrunner; vandaar dat de mapping in de pure
// module `vormSet.js` woont (patroon `bpmn/sequenceFlow.js`). De twee
// drift-checks lezen `index.js`/`vormShapes.jsx` daarom als **tekst**: dat
// vangt precies de bugklasse waar een shape-set stuk op gaat — een
// elementtype-id dat niet (meer) bestaat, of een shape die niet geregistreerd
// is (dan valt de node stilzwijgend terug op de standaardvorm).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { VORM_SHAPES, VORM_SHAPE_IDS, VORMEN_SET } from "./vormSet.js";
import { ELEMENT_IDS } from "./elementen.js";

const hier = dirname(fileURLToPath(import.meta.url));
const lees = (naam) => readFileSync(join(hier, naam), "utf8");


test("de set draagt het afgesproken id en label", () => {
  assert.equal(VORMEN_SET.id, "vormen");
  assert.equal(VORMEN_SET.label, "Iconen als vorm");
  assert.equal(VORMEN_SET.shapes, VORM_SHAPES);
});

test("elke mapping wijst naar een gedeclareerde vorm-shape, en elke vorm wordt gebruikt", () => {
  const gebruikt = new Set(Object.values(VORM_SHAPES));
  for (const shapeId of gebruikt) {
    assert.ok(VORM_SHAPE_IDS.includes(shapeId), `onbekende shape-id in de mapping: ${shapeId}`);
  }
  for (const shapeId of VORM_SHAPE_IDS) {
    assert.ok(gebruikt.has(shapeId), `vorm-shape ${shapeId} wordt door geen enkel elementtype gebruikt`);
  }
  assert.equal(new Set(VORM_SHAPE_IDS).size, VORM_SHAPE_IDS.length, "dubbele shape-id");
});

test("motivation-elementen dragen de Archi-figuren (01-09)", () => {
  // De spec toont motivation alleen als achthoekige box, maar Archi levert de
  // figuur-variant wél — en dat verwachten gebruikers dus ook hier.
  assert.equal(VORM_SHAPES.goal, "am-vorm-goal");
  assert.equal(VORM_SHAPES.driver, "am-vorm-driver");
  assert.equal(VORM_SHAPES.stakeholder, "am-vorm-stakeholder");
  assert.equal(VORM_SHAPES.principle, "am-vorm-principle");
  // Requirement en constraint delen het parallellogram, zoals in Archi.
  assert.equal(VORM_SHAPES.requirement, "am-vorm-requirement");
  assert.equal(VORM_SHAPES.constraint, "am-vorm-requirement");
});

test("junction, notitie en kader blijven buiten de set", () => {
  for (const id of ["junction", "notitie", "kader"]) {
    assert.ok(!(id in VORM_SHAPES), `${id} hoort niet in een ArchiMate-vormset`);
  }
});

test("meerdere elementtypen mogen één vorm delen (services, functies, objecten)", () => {
  assert.equal(VORM_SHAPES["business-service"], VORM_SHAPES["app-service"]);
  assert.equal(VORM_SHAPES["app-service"], VORM_SHAPES["tech-service"]);
  assert.equal(VORM_SHAPES["business-functie"], VORM_SHAPES["app-functie"]);
  assert.equal(VORM_SHAPES["business-object"], VORM_SHAPES["data-object"]);
});

test("elk gemapt elementtype bestaat in het profiel", () => {
  // Sinds de 3.2-completering (04-09) is de elemententabel een pure module
  // (elementen.js) — de tekst-scrape van index.js is niet meer nodig.
  for (const id of Object.keys(VORM_SHAPES)) {
    assert.ok(ELEMENT_IDS.includes(id), `elementtype ${id} bestaat niet (meer) in archimate/elementen.js`);
  }
});

test("het profiel declareert de set en registreert de vormshapes", () => {
  const bron = lees("index.js");
  assert.match(bron, /shapeSets:\s*\[VORMEN_SET\]/);
  assert.match(bron, /registreerArchimateVormShapes\(\);/);
});

test("elke vorm-shape is ook daadwerkelijk geregistreerd (drift-check op vormShapes.jsx)", () => {
  const bron = lees("vormShapes.jsx");
  for (const shapeId of VORM_SHAPE_IDS) {
    assert.ok(
      bron.includes(`"${shapeId}"`),
      `shape ${shapeId} komt niet voor in vormShapes.jsx — de node valt dan terug op de standaardvorm`,
    );
  }
});
