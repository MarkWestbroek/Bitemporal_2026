/**
 * Tests voor de pure SVG-tekenaar (render-API voor Imprint).
 * Golden file bijwerken: UPDATE_GOLDEN=1 npm test
 * Acceptatiecriteria: docs/RENDER_API.md §Acceptatie.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { renderDiagramSvg, diagramViews, RenderFout } from "./index.js";

const hier = (p) => fileURLToPath(new URL(p, import.meta.url));
const musicbrain = JSON.parse(fs.readFileSync(hier("./fixtures/musicbrain-v3.json"), "utf8"));

const klein = {
  versie: "1",
  naam: "Klein",
  domeinen: [{ naam: "winkel", kleur: "#bfdbfe" }],
  enums: [{ goType: "Status", waarden: [{ waarde: "open" }, { waarde: "dicht" }] }],
  entiteiten: [
    {
      typenaam: "Klant",
      domein: "winkel",
      gegevenselementen: [{ naam: "Kern", velden: [{ naam: "naam", goType: "string" }, { naam: "status", goType: "Status", enum: "Status" }] }],
      relaties: [{ naam: "Rel_Klant_Order", doelEntiteit: "Order", doelKardinaliteit: "0..*" }],
    },
    { typenaam: "Order", domein: "winkel", gegevenselementen: [{ naam: "Kern", velden: [{ naam: "nummer", goType: "int" }] }] },
  ],
};

function fout(fn) {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof RenderFout, `verwacht RenderFout, kreeg ${e}`);
    return e;
  }
  assert.fail("verwacht een RenderFout");
}

test("dezelfde invoer geeft byte-gelijke SVG (acceptatie 2)", () => {
  const a = renderDiagramSvg({ taal: "v3", model: musicbrain, domein: "catalogus" });
  const b = renderDiagramSvg({ taal: "v3", model: structuredClone(musicbrain), domein: "catalogus" });
  assert.equal(a, b);
});

test("golden: MusicBrain-contentmodel, domein catalogus", () => {
  const svg = renderDiagramSvg({ taal: "v3", model: musicbrain, domein: "catalogus", idPrefix: "mb" });
  const pad = hier("./fixtures/musicbrain-catalogus.svg");
  if (process.env.UPDATE_GOLDEN || !fs.existsSync(pad)) fs.writeFileSync(pad, svg);
  // Regeleinden gelijktrekken: git kan de golden bij checkout naar CRLF omzetten.
  assert.equal(svg, fs.readFileSync(pad, "utf8").replace(/\r\n/g, "\n"));
});

test("SVG voldoet aan de eisen van Imprint (§3)", () => {
  const svg = renderDiagramSvg({ taal: "v3", model: musicbrain, domein: "catalogus" });
  const root = svg.slice(0, svg.indexOf(">"));
  assert.match(root, /viewBox="0 0 \d+ \d+"/);
  assert.doesNotMatch(root, /\s(width|height)=/);
  assert.match(root, /role="img"/);
  assert.match(root, /aria-label="[^"]*Product/);
  assert.match(svg, /<title id="[^"]+">[^<]+<\/title>/);
  assert.doesNotMatch(svg, /<script|<foreignObject|<image|@font-face|\son[a-z]+=|href="http/i);
  assert.match(svg, /fill="var\(--diagram-surface, #ffffff\)"/);
  assert.match(svg, /font-family="ui-sans-serif/);
  // entiteitnamen als tekst, doorzoekbaar
  assert.match(svg, />Product<\/text>/);
});

test("theme=light/dark: vaste kleuren, geen variabelen", () => {
  for (const theme of ["light", "dark"]) {
    const svg = renderDiagramSvg({ taal: "v3", model: klein, theme });
    assert.doesNotMatch(svg, /var\(/);
  }
});

test("tekst op een donkere domeinkleur wordt wit (contrast)", () => {
  const svg = renderDiagramSvg({ taal: "v3", model: musicbrain, domein: "site", idPrefix: "s" });
  // site-entiteiten zijn #6366f1 (indigo)
  assert.match(svg, /<g id="s-ent-Page"[^>]*><rect[^>]*fill="#6366f1"[^>]*\/><text[^>]*fill="#ffffff"/);
});

test("idPrefix: stabiele id's, twee diagrammen botsen niet (acceptatie 4)", () => {
  const ids = (svg) => [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const a = ids(renderDiagramSvg({ taal: "v3", model: musicbrain, domein: "catalogus" }));
  const b = ids(renderDiagramSvg({ taal: "v3", model: musicbrain, domein: "site" }));
  assert.equal(new Set(a).size, a.length, "id's binnen één SVG zijn uniek");
  assert.equal(a.filter((id) => b.includes(id)).length, 0, "standaardprefix verschilt per diagram");
  const c = ids(renderDiagramSvg({ taal: "v3", model: klein, idPrefix: "fig1" }));
  assert.ok(c.includes("fig1-ent-Klant"));
  assert.ok(c.every((id) => id.startsWith("fig1-")));
});

test("zonder keuze: één domein zonder diagrammen → hele model", () => {
  const svg = renderDiagramSvg({ taal: "v3", model: klein });
  assert.match(svg, />Klant<\/text>/);
  assert.match(svg, />Order<\/text>/);
});

test("zonder keuze bij meer domeinen → 400 met de keuzes", () => {
  const e = fout(() => renderDiagramSvg({ taal: "v3", model: musicbrain }));
  assert.equal(e.status, 400);
  assert.deepEqual(e.toProblem().domeinen, ["catalogus", "site"]);
  assert.deepEqual(e.toProblem().diagrammen, []);
});

test("onbekend diagram/domein → 404", () => {
  assert.equal(fout(() => renderDiagramSvg({ taal: "v3", model: musicbrain, domein: "nee" })).status, 404);
  assert.equal(fout(() => renderDiagramSvg({ taal: "v3", model: klein, diagram: "nee" })).status, 404);
});

test("ongeldig model → 422 dat het element noemt (acceptatie 3)", () => {
  const kapot = structuredClone(klein);
  kapot.entiteiten[0].relaties[0].doelEntiteit = "Bestaatniet";
  const e = fout(() => renderDiagramSvg({ taal: "v3", model: kapot }));
  assert.equal(e.status, 422);
  const p = e.toProblem();
  assert.equal(p.element, "Rel_Klant_Order");
  assert.equal(p.pad, "entiteiten[0].relaties[0].doelEntiteit");
  assert.match(p.detail, /Bestaatniet/);
  assert.equal(p.type, "urn:omnium:render:ongeldig-model");
});

test("code met een JSON-fout → 422 met regel en kolom", () => {
  const e = fout(() => renderDiagramSvg({ taal: "v3", code: '{\n  "entiteiten": [,]\n}' }));
  assert.equal(e.status, 422);
  assert.match(e.detail, /regel 2, kolom/);
});

test("Studio-export met envelop { model: … } wordt uitgepakt", () => {
  const svg = renderDiagramSvg({ taal: "v3", code: JSON.stringify({ versie: "x", model: klein }) });
  assert.match(svg, />Klant<\/text>/);
});

test("ongeldige parameters → 400", () => {
  for (const extra of [{ theme: "roze" }, { richting: "BT" }, { velden: "misschien" }, { idPrefix: "1x" }, { linkPattern: "javascript:alert(1)" }, { taal: "bpmn" }]) {
    assert.equal(fout(() => renderDiagramSvg({ taal: "v3", model: klein, ...extra })).status, 400, JSON.stringify(extra));
  }
  assert.equal(fout(() => renderDiagramSvg({ taal: "v3", model: klein, code: "{}" })).status, 400);
});

test("linkPattern maakt entiteiten klikbaar", () => {
  const svg = renderDiagramSvg({ taal: "v3", model: klein, linkPattern: "/model/{entiteit}" });
  assert.match(svg, /<a href="\/model\/Klant"><g id="[^"]+-ent-Klant"/);
});

test("entiteiten= verfijnt tot die entiteiten en hun onderlinge relaties", () => {
  const svg = renderDiagramSvg({ taal: "v3", model: musicbrain, domein: "catalogus", entiteiten: "Product,Release", idPrefix: "f" });
  assert.match(svg, /id="f-ent-Product"/);
  assert.match(svg, /id="f-rel-Rel_Release_Product"/);
  assert.doesNotMatch(svg, /id="f-ent-Component"/);
  assert.equal(fout(() => renderDiagramSvg({ taal: "v3", model: musicbrain, domein: "catalogus", entiteiten: "Page" })).status, 400);
});

test("domein-weergave toont buren uit een ander domein als externe stomp", () => {
  const m = structuredClone(klein);
  m.entiteiten[1].domein = "logistiek";
  const svg = renderDiagramSvg({ taal: "v3", model: m, domein: "winkel", idPrefix: "x" });
  assert.match(svg, /id="x-ext-ent-Order" class="element entiteit extern"/);
  assert.match(svg, /stroke-dasharray="5 3"/);
});

test("diagram-weergave gebruikt de opgeslagen posities", () => {
  const m = structuredClone(klein);
  m.diagrammen = [{ naam: "Overzicht", nodes: [{ elementId: "Klant", x: 0, y: 0 }, { elementId: "Order", x: 600, y: 0 }] }];
  const svg = renderDiagramSvg({ taal: "v3", model: m, diagram: "Overzicht", idPrefix: "d" });
  const x = (id) => Number(new RegExp(`id="d-ent-${id}"[^>]*><rect x="(\\d+)"`).exec(svg)[1]);
  assert.equal(x("Klant"), 24);
  assert.equal(x("Order"), 624);
  assert.doesNotMatch(svg, /Kern/, "gegevenselementen die niet in het diagram staan, ontbreken");
});

test("velden=false toont alleen de koppen", () => {
  const svg = renderDiagramSvg({ taal: "v3", model: klein, velden: "false" });
  assert.doesNotMatch(svg, />nummer<\/text>/);
  assert.match(svg, />Order<\/text>/);
});

test("diagramViews somt diagrammen en domeinen op", () => {
  assert.deepEqual(diagramViews({ taal: "v3", model: musicbrain }), { diagrammen: [], domeinen: ["catalogus", "site"] });
});
