import { test } from "node:test";
import assert from "node:assert/strict";
import { svgNaarVormBoom, schoonSvg } from "./svgSchoon.js";

test("svgNaarVormBoom: viewBox, elementen en attributen blijven", () => {
  const { viewBox, kinderen, weg } = svgNaarVormBoom('<svg viewBox="0 0 14 14"><g stroke="currentColor"><rect x="1" y="2" width="3" height="4"/><path d="M1 1h2"/></g></svg>');
  assert.equal(viewBox, "0 0 14 14");
  assert.deepEqual(weg, []);
  assert.deepEqual(kinderen, [
    { tag: "g", attrs: { stroke: "currentColor" }, kinderen: [{ tag: "rect", attrs: { x: "1", y: "2", width: "3", height: "4" }, kinderen: [] }, { tag: "path", attrs: { d: "M1 1h2" }, kinderen: [] }] },
  ]);
});

test("svgNaarVormBoom: zonder viewBox uit width en height", () => {
  assert.equal(svgNaarVormBoom('<svg width="420" height="210"><path d="M0 0"/></svg>').viewBox, "0 0 420 210");
  assert.equal(svgNaarVormBoom("<path d='M0 0'/>").viewBox, "0 0 24 24");
});

test("svgNaarVormBoom: scripts, gebeurtenissen, style en verwijzingen naar buiten gaan eruit", () => {
  const bron = `<svg viewBox="0 0 24 24">
    <script>alert(1)</script>
    <foreignObject><div onclick="x()">hoi</div></foreignObject>
    <path d="M1 1" onclick="alert(1)" style="fill:red"/>
    <use href="https://evil.example/x.svg#a"/>
    <use href="#lokaal"/>
    <rect fill="url(javascript:alert(1))"/>
    <svg><circle r="3"/></svg>
    <title>Een titel</title>
    <text x="1">Hallo &amp; <tspan>dag</tspan></text>
  </svg>`;
  const { kinderen, weg } = svgNaarVormBoom(bron);
  const json = JSON.stringify(kinderen);
  assert.doesNotMatch(json, /alert|onclick|style|evil|javascript|div|circle/);
  assert.match(json, /"#lokaal"/);
  assert.deepEqual(kinderen.map((k) => k.tag), ["path", "use", "use", "rect", "text"]);
  assert.deepEqual(kinderen[4].kinderen, ["Hallo &amp; ", { tag: "tspan", attrs: {}, kinderen: ["dag"] }]);
  for (const reden of ["script", "foreignObject", "onclick (gebeurtenis)", "style (style)", "href (verwijzing naar buiten)", "fill (verdachte waarde)", "svg (genest)"]) assert.ok(weg.includes(reden), reden);
  assert.ok(!weg.includes("title"), "title is geen verlies");
});

test("schoonSvg: tekst terug, alleen het toegestane", () => {
  const { svg, weg } = schoonSvg('<svg viewBox="0 0 10 10"><path d="M0 0" onload="x"/><script>y</script></svg>');
  assert.equal(svg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0"/></svg>');
  assert.deepEqual(weg.sort(), ["onload (gebeurtenis)", "script"]);
});
