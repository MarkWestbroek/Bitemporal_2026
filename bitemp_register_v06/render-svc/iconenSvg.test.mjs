// De ingebouwde iconen als SVG-tekst (plan 2026-11-21 Sidecar-project §7 stap 2): de JSX in de code
// (de reserve) en ingebouwdeIconen.js (de tekst voor het weergaveproject) lopen niet uit elkaar, en
// de tekst komt via een data-icoon exact terug. Alleen met web/vite/node_modules (React).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { kanGenereren, laadBron, genereer, VAST } from "./iconenSvg.mjs";

const overslaan = kanGenereren() ? false : "react-dom ontbreekt in web/vite/node_modules";
let bron;
let vast;
before(async () => {
  if (overslaan) return;
  bron = await laadBron();
  vast = (await import(pathToFileURL(VAST).href)).INGEBOUWDE_ICONEN;
});

test("ingebouwdeIconen.js is gelijk aan de JSX-iconen (anders: npm run iconen)", { skip: overslaan }, async () => {
  const { iconen, weg } = await genereer(bron);
  assert.deepEqual(weg, {}, "svgSchoon laat niets weg");
  assert.deepEqual(Object.keys(vast).sort(), Object.keys(iconen).sort(), "dezelfde iconen");
  for (const id of Object.keys(iconen)) assert.equal(vast[id], iconen[id], `icoon ${id}`);
  assert.ok(Object.keys(iconen).length > 150);
  assert.ok(iconen["vorm:class-box"] && iconen["vorm:edge"], "de standaardiconen per vorm");
});

test("elk icoon is al schoon: svgSchoon verandert er niets aan", { skip: overslaan }, () => {
  for (const [id, svg] of Object.entries(vast)) {
    const { svg: schoon, weg } = bron.schoonSvg(svg);
    assert.deepEqual(weg, [], id);
    assert.equal(schoon, svg, id);
  }
});

test("rondreis: SVG-tekst → data-icoon (zoals de Studio tekent) → dezelfde SVG-tekst", { skip: overslaan }, () => {
  for (const [id, svg] of Object.entries(vast)) {
    const getekend = bron.tekenDataIcoon({ id, svg, monochroom: false });
    assert.equal(bron.markupNaarIcoonSvg(getekend).svg, svg, id);
  }
  // $vlak wordt bij het tekenen de paneelkleur.
  assert.match(vast["am-component"], /fill="\$vlak"/);
  assert.match(bron.tekenDataIcoon({ id: "x", svg: vast["am-component"] }), /fill="var\(--s-panel, #fff\)"/);
});
