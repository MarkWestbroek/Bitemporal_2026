import test from "node:test";
import assert from "node:assert/strict";
import { herkenInhoud, inhoudSamenvatting } from "./inhoudSoort.js";

const BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d">
  <bpmn:process id="p1" isExecutable="true"/>
</bpmn:definitions>`;

test("herkenInhoud: JSON-tekst, object, BPMN, overige XML, gewone tekst", () => {
  assert.deepEqual(herkenInhoud(' {"a": 1} '), { soort: "json", data: { a: 1 } });
  assert.deepEqual(herkenInhoud([1, 2]), { soort: "json", data: [1, 2] });
  assert.equal(herkenInhoud(BPMN).soort, "bpmn");
  assert.equal(herkenInhoud(BPMN.replace(/bpmn:/g, "")).soort, "bpmn");
  assert.equal(herkenInhoud("<a><b/></a>").soort, "xml");
  assert.equal(herkenInhoud("{kapot"), null);
  assert.equal(herkenInhoud("gewone tekst"), null);
  assert.equal(herkenInhoud(""), null);
  assert.equal(herkenInhoud(42), null);
});

test("inhoudSamenvatting: soort, omvang en grootte", () => {
  assert.equal(inhoudSamenvatting('{"a":1,"b":2}'), "JSON-object · 2 sleutels · 13 B");
  assert.equal(inhoudSamenvatting("[1,2,3]"), "JSON-lijst · 3 items · 7 B");
  assert.match(inhoudSamenvatting(BPMN), /^BPMN · 1 proces · \d+ B$/);
  assert.equal(inhoudSamenvatting("tekst"), null);
});
