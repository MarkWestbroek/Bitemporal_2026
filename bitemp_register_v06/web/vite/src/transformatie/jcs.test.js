import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { jcs, jcsHash } from "./jcs.js";

test("JCS: sleutels gesorteerd, geen witruimte, geneste objecten en lijsten", () => {
  assert.equal(jcs({ b: 1, a: [3, { d: true, c: null }] }), '{"a":[3,{"c":null,"d":true}],"b":1}');
});

test("JCS: strings zoals ECMAScript, zonder HTML-escaping, niet-ASCII als UTF-8", () => {
  assert.equal(jcs({ t: "<é>&\"\n" }), '{"t":"<é>&\\"\\n"}');
});

test("JCS: getallen zoals ECMAScript (RFC 8785 §3.2.2.3)", () => {
  assert.equal(jcs([1.0, 1e21, 0.000001, -0, 255]), "[1,1e+21,0.000001,0,255]");
  assert.throws(() => jcs(Number.NaN), /geen geldig JSON-getal/);
});

test("JCS: sleutelvolgorde op UTF-16-code-units", () => {
  assert.equal(jcs({ "€": 1, "a": 2, "é": 3 }), '{"a":2,"é":3,"€":1}');
});

test("hash is onafhankelijk van sleutelvolgorde", () => {
  const sha = (t) => crypto.createHash("sha256").update(t, "utf8").digest("hex");
  assert.equal(jcsHash({ x: 1, y: [1, 2] }, sha), jcsHash({ y: [1, 2], x: 1 }, sha));
});
