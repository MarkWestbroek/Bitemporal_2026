import { test } from "node:test";
import assert from "node:assert/strict";
import { svgMaat, svgNaarAfbeeldingen, markdownZonderSvg, merkHerkomst, svgHerkomst } from "./rijkKopieren.js";

const svgA = '<svg width="400" height="200" viewBox="0 0 400 200"><title>Overzicht</title><rect/></svg>';
const svgB = '<svg viewBox="0 0 1800 900"><rect/></svg>';

test("svgMaat: width/height, anders viewBox, anders een standaard", () => {
  assert.deepEqual(svgMaat(svgA), { breedte: 400, hoogte: 200 });
  assert.deepEqual(svgMaat(svgB), { breedte: 1800, hoogte: 900 });
  assert.deepEqual(svgMaat("<svg><rect/></svg>"), { breedte: 800, hoogte: 600 });
});

test("svgNaarAfbeeldingen: elke svg wordt een img met data-URL, max 900 breed, alt uit <title>", async () => {
  const html = `<h2>Diagram</h2>\n${svgA}\n<p>tekst</p>\n${svgB}`;
  const gezien = [];
  const uit = await svgNaarAfbeeldingen(html, async (svg, maat) => { gezien.push(maat); return `data:image/png;base64,P${gezien.length}`; });
  assert.ok(!uit.includes("<svg"));
  assert.match(uit, /<img src="data:image\/png;base64,P1" width="400" height="200" alt="Overzicht">/);
  assert.match(uit, /<img src="data:image\/png;base64,P2" width="900" height="450" alt="Diagram">/);
  assert.match(uit, /<h2>Diagram<\/h2>/);
  assert.deepEqual(gezien, [{ breedte: 400, hoogte: 200 }, { breedte: 1800, hoogte: 900 }]);
});

test("markdownZonderSvg: platte tekst zonder SVG-code", () => {
  assert.equal(markdownZonderSvg(`# Doc\n${svgA}\ntekst\n${svgB}`), "# Doc\n[Diagram 1]\ntekst\n[Diagram 2]");
});

test("merkHerkomst/svgHerkomst: profiel, diagram en naam heen en terug; ongemerkt = null", () => {
  const gemerkt = merkHerkomst(svgA, { profielId: "usecase05", diagramId: "d_1", naam: 'Klant & "Order"' });
  assert.match(gemerkt, /^<svg data-omnium-profiel="usecase05" data-omnium-diagram="d_1"/);
  assert.deepEqual(svgHerkomst(gemerkt), { profielId: "usecase05", diagramId: "d_1", naam: 'Klant & "Order"' });
  assert.equal(svgHerkomst(svgA), null);
  assert.equal(merkHerkomst(svgA, {}), svgA);
  // Het merk verandert de maat en het rasteren niet.
  assert.deepEqual(svgMaat(gemerkt), svgMaat(svgA));
});
