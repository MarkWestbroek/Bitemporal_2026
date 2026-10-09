// qeaNaarSequence.test.js — EA sequence-diagram "JS" (GGM, 15 levenslijnen, 35 berichten) → sequence-profiel.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/ea/qeaNaarSequence.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { qeaNaarSequence } from "./qeaNaarSequence.js";

const hier = dirname(fileURLToPath(import.meta.url));
const bron = JSON.parse(readFileSync(join(hier, "fixtures", "sequence-js.qea.json"), "utf8"));
const PAKKET = 1170;
const model = qeaNaarSequence(bron, { packageId: PAKKET, schaal: 1 });
const els = Object.values(model.elements);
const diagram = Object.values(model.diagrams)[0];
const van = (type) => els.filter((e) => e.elementType === type);

test("levenslijnen: elk object op het diagram (Object, Sequence, Actor) wordt een smalle hoge node", () => {
  assert.equal(Object.keys(model.diagrams).length, 1);
  assert.equal(diagram.naam, "JS");
  const lijnen = van("levenslijn");
  assert.equal(lijnen.length, 14, "14 levenslijnen (de notitie niet)");
  assert.ok(lijnen.some((l) => l.naam === "Analist" && l.data.eaObjectType === "Actor"));
  assert.ok(lijnen.some((l) => l.naam === "Genereer YAML script" && l.data.eaObjectType === "Sequence"));
  // Object zonder naam: de classifier levert de naam en reist mee als typeNaam.
  const obj = lijnen.find((l) => l.data.eaObjectType === "Object" && l.naam !== "yaml" && l.naam !== "enumReps");
  assert.ok(obj && obj.data.typeNaam === obj.naam, JSON.stringify({ naam: obj?.naam, type: obj?.data?.typeNaam }));
  const node = diagram.nodes.find((n) => n.elementId === lijnen.find((l) => l.naam === "Analist").id);
  assert.equal(node.size.width, 14);
  assert.equal(node.size.height, 1311, "EA: top 50, bottom 1361");
  assert.equal(node.position.x, 15 + 45 - 7, "gecentreerd op EA's kolom");
});

test("berichten: punten op de lijnen, connector synchroon, volgnummer; zelf-bericht = lus op één punt", () => {
  const berichten = van("synchroon");
  assert.equal(berichten.length, 35);
  assert.equal(van("asynchroon").length + van("retour").length, 0);
  const eerste = berichten.find((b) => b.data.volgnummer === 1);
  assert.equal(eerste.naam, "start script vanuit representatie map");
  const vanPunt = model.elements[eerste.source], naarPunt = model.elements[eerste.target];
  assert.equal(vanPunt.elementType, "punt");
  assert.equal(model.elements[vanPunt.data.randVan].naam, "Analist");
  assert.equal(model.elements[naarPunt.data.randVan].naam, "Genereer YAML script");
  // Punt relatief aan de lijn: EA PtStartY -135 → y 135; lijn top 50 → 85 - 6.
  const n = diagram.nodes.find((x) => x.elementId === vanPunt.id);
  assert.deepEqual(n.position, { x: 1, y: 135 - 50 - 6 });
  const zelf = berichten.find((b) => b.data.volgnummer === 2);
  assert.equal(zelf.source, zelf.target, "zelf-bericht: één punt, lus");
  assert.equal(diagram.lijnen[zelf.id].vorm, "hoekig");
  assert.equal(diagram.lijnen[eerste.id].vorm, "recht");
  const metSignatuur = berichten.find((b) => b.naam === "addEnum(EA.Connector, EA.Element)");
  assert.equal(metSignatuur.data.retourtype, "EnumerationRepresentation");
  assert.equal(metSignatuur.data.argumenten, "connector, enumRep");
  assert.equal(diagram.nodes.filter((x) => model.elements[x.elementId]?.elementType === "punt").length, 35 * 2 - berichten.filter((b) => b.source === b.target).length);
});

test("verslag en schaal", () => {
  assert.equal(model.verslag.diagrammen, 1);
  const geschaald = qeaNaarSequence(bron, { packageId: PAKKET });
  const d15 = Object.values(geschaald.diagrams)[0];
  const lijn = diagram.nodes.find((n) => n.size?.height === 1311);
  const lijn15 = d15.nodes.find((n) => n.elementId === lijn.elementId);
  assert.equal(lijn15.size.height, Math.round(1311 * 1.5));
  assert.equal(lijn15.size.width, 14, "lijnbreedte schaalt niet");
});
