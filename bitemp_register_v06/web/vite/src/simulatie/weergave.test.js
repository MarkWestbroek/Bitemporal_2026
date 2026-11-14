import test from "node:test";
import assert from "node:assert/strict";
import { tokenBeeld, tokenCss, standTekst, mutatieTekst, TOKEN_KLEUR } from "./weergave.js";

const toestand = {
  tokens: {
    a: { id: "a", plek: "taak1", status: "klaar" },
    b: { id: "b", plek: "taak1", status: "wacht", wachtOp: { soort: "gat", id: "g" } },
    c: { id: "c", plek: "vang", status: "wacht", wachtOp: { soort: "bericht", naam: "x" } },
    d: { id: "d", plek: "of", status: "wacht", wachtOp: { soort: "vast", reden: "…" } },
  },
};
const log = [
  { nr: 1, plek: "start", wijzigingen: [{ soort: "token", id: "a", plek: "start" }] },
  { nr: 2, plek: "start", wijzigingen: [{ soort: "token", id: "a", plek: "taak1", via: "f1" }] },
  { nr: 3, plek: "taak1", wijzigingen: [] },
];

test("tokenBeeld: tokens per plek met de dringendste status, en waar het token geweest is", () => {
  const beeld = tokenBeeld(toestand, log);
  assert.deepEqual(beeld.plekken, { taak1: { aantal: 2, status: "gat" }, vang: { aantal: 1, status: "wacht" }, of: { aantal: 1, status: "vast" } });
  assert.deepEqual(beeld.bezocht, ["start"], "een plek met een token telt niet als bezocht");
  assert.deepEqual(beeld.flows, ["f1"]);
  assert.deepEqual(tokenBeeld(null, []), { plekken: {}, bezocht: [], flows: [] });
});

test("tokenCss: wijst de canvas-nodes aan op hun element-id, met kleur en aantal", () => {
  const css = tokenCss(tokenBeeld(toestand, log));
  assert.ok(css.includes(`.react-flow__node[data-id="taak1"] { outline: 3px solid ${TOKEN_KLEUR.gat}`));
  assert.ok(css.includes(`.react-flow__node[data-id="taak1"]::after { content: "2"`));
  assert.ok(css.includes(`.react-flow__node[data-id="vang"]::after { content: ""`));
  assert.ok(css.includes(`.react-flow__node[data-id="start"] { outline: 2px solid rgba(34, 211, 238, 0.55)`));
  assert.ok(css.includes(`.react-flow__edge[data-id="f1"]`));
  assert.ok(css.includes(`.react-flow__node[data-id="a\\"b"]`) === false);
  assert.ok(tokenCss({ plekken: { 'a"b': { aantal: 1, status: "klaar" } }, bezocht: [], flows: [] }).includes('[data-id="a\\"b"]'), "een id met een aanhalingsteken breekt de selector niet");
});

test("standTekst en mutatieTekst: gewone woorden", () => {
  assert.equal(standTekst({ soort: "gat", gaten: [{ naam: "Aanvraag beoordelen" }] }), "Wacht op invoer: Aanvraag beoordelen.");
  assert.equal(standTekst({ soort: "uitkomst", eindes: [{ proces: "p", einde: "Beschikt" }] }), "Klaar. p: Beschikt.");
  assert.match(standTekst({ soort: "vastgelopen", tokens: [{ naam: "samen", wachtOp: { soort: "samenkomst" } }] }), /samen \(de samenkomst wordt niet compleet\)/);
  assert.equal(mutatieTekst({ soort: "overgang", id: "a", veld: "status", van: "ingediend", naar: "nietInBehandeling" }), "overgang a.status: ingediend → nietInBehandeling");
  assert.equal(mutatieTekst({ soort: "token", id: "t", plek: "x" }), null);
});
