import test from "node:test";
import assert from "node:assert/strict";

import {
  kortsteVoorkomenPaar,
  staatMeerdereVoorkomensToe,
  voorkomenId,
  vindVoorkomen,
} from "./voorkomens.js";

test("oude nodes gebruiken elementId en expliciete nodeId wint", () => {
  assert.equal(voorkomenId({ elementId: "A" }), "A");
  assert.equal(voorkomenId({ nodeId: "A-2", elementId: "A" }), "A-2");
  assert.equal(vindVoorkomen([{ elementId: "A" }, { nodeId: "A-2", elementId: "A" }], "A-2").nodeId, "A-2");
});

test("meerdere voorkomens staat standaard uit en ElementType-override wint", () => {
  assert.equal(staatMeerdereVoorkomensToe({}, {}), false);
  assert.equal(staatMeerdereVoorkomensToe({ meerdereVoorkomens: true }, {}), true);
  assert.equal(
    staatMeerdereVoorkomensToe({ meerdereVoorkomens: true }, { meerdereVoorkomens: false }),
    false
  );
});

test("kortste voorkomenpaar gebruikt voorkomenmaten", () => {
  const paar = kortsteVoorkomenPaar(
    [{ elementId: "A", position: { x: 0, y: 0 } }, { nodeId: "A-2", elementId: "A", position: { x: 500, y: 0 } }],
    [{ elementId: "B", position: { x: 800, y: 0 } }],
    { "A-2": { width: 400, height: 80 } }
  );
  assert.equal(paar.bron.nodeId, "A-2");
  assert.equal(paar.doel.elementId, "B");
});