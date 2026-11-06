/**
 * Wat het canvas buiten de vormen om tekent, tekent de tekenaar ook (gevonden 06-11 op de
 * SVG-link van het canonieke model: de «use»-lijnen en de vakken van een gegevenstype ontbraken):
 *
 *   - de geïmporteerde presentatie-edges van het diagram (`diagram.edges`);
 *   - de afgeleide vakken van de profiel-hook `extraCompartimenten`;
 *   - een opgenomen deel als sub-vak in zijn geheel;
 *   - elk labeldeel in zijn eigen stijl.
 *
 * Canvas en tekenaar delen daarvoor `verrijkElement` (canvas/opname.js) en `geimporteerdeEdges`
 * (canvas/materialiseerConnectoren.js). De vergelijking met het echte canvas staat in
 * tests/e2e/41-studio-tekenaar-pariteit.spec.js.
 * Run: node --import ./test/register-aliases.mjs --test src/diagramcore/tekenaar/canvasPariteit.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tekenDiagram, naarSvg } from "./index.js";
import "./basisVormen.js";
import { verrijkElement, bepaalOpnames } from "../canvas/opname.js";
import { geimporteerdeEdges } from "../canvas/materialiseerConnectoren.js";

const regels = (paren) => paren.filter(([, w]) => w !== undefined && w !== "").map(([k, w]) => ({ naam: `${k}: ${w}`, fieldType: "regel" }));

const descriptor = {
  id: "proef",
  elementTypes: [
    {
      id: "entiteit",
      shape: "class-box",
      compartments: [
        { id: "velden", fieldType: "attribuut" },
        { id: "gegevenselementen", fieldType: "ingebedDeel", alleenWeergave: true },
      ],
    },
    {
      id: "gegevenselement",
      shape: "class-box",
      opname: { gedaante: "ingebed", relatieTypes: ["compositie"], compartiment: "gegevenselementen" },
      compartments: [{ id: "velden", fieldType: "attribuut" }],
    },
    {
      id: "gegevenstype",
      shape: "class-box",
      compartments: [
        { id: "eigenschappen", fieldType: "attribuut" },
        { id: "validatie", fieldType: "regel", alleenWeergave: true },
      ],
      hooks: {
        extraCompartimenten: (element) => {
          const velden = regels([["pattern", element.data?.validatie?.pattern], ["maxLength", element.data?.validatie?.maxLength]]);
          return velden.length ? [{ compartmentType: "validatie", velden }] : [];
        },
      },
    },
    { id: "enumeratie", shape: "class-box" },
    {
      id: "compositie",
      isConnector: true,
      bron: { elementTypes: ["entiteit"] },
      doel: { elementTypes: ["gegevenselement"] },
      edgePresentatie: { markerStart: "ruit" },
      hooks: {
        edgeLabels: (conn) => ({
          kaal: [
            {
              zijde: "doel",
              delen: [
                { tekst: conn.data?.rolnaam, soort: "rolnaam" },
                { tekst: conn.data?.kardinaliteit, soort: "kardinaliteit" },
                { tekst: `{${conn.data?.momentvoorkomen}}`, soort: "constraint" },
              ],
            },
          ],
        }),
      },
    },
  ],
  fieldTypes: [
    { id: "attribuut", viewer: "naam-type" },
    { id: "regel", viewer: "tekst" },
    { id: "ingebedDeel", viewer: "sub-vak" },
  ],
  compartmentTypes: [{ id: "velden" }, { id: "eigenschappen" }, { id: "validatie" }, { id: "gegevenselementen" }],
};

const elements = {
  P: { id: "P", naam: "Persoon", elementType: "entiteit", data: {}, compartimenten: [] },
  N: { id: "N", naam: "Naamgebruik", elementType: "gegevenselement", data: {}, compartimenten: [{ compartmentType: "velden", velden: [{ naam: "naamgebruik", fieldType: "attribuut", data: { typeLabel: "Soort" } }] }] },
  S: { id: "S", naam: "Soort", elementType: "enumeratie", data: {}, compartimenten: [] },
  B: {
    id: "B",
    naam: "BSN",
    elementType: "gegevenstype",
    data: { validatie: { pattern: "^[0-9]{9}$", maxLength: 9 } },
    compartimenten: [{ compartmentType: "eigenschappen", velden: [{ naam: "basistype", fieldType: "attribuut", data: { typeLabel: "string" } }] }],
  },
  c1: { id: "c1", naam: "", elementType: "compositie", source: "P", target: "N", data: { rolnaam: "Naamgebruik", kardinaliteit: "0..1", momentvoorkomen: "enkelvoudig" } },
};

const use = (id, extra = {}) => ({
  id,
  source: "N",
  target: "S",
  sourceHandle: null,
  targetHandle: null,
  hidden: false,
  data: { presentatie: { lijn: "dash-6-3", kleur: "#64748b", markerEnd: "pijl-open", labels: [{ zijde: "midden", delen: [{ tekst: "«use»", soort: "constraint", kleur: "#7c3aed" }] }] } },
  ...extra,
});

const diagram = (extra = {}) => ({
  id: "d",
  naam: "Proef",
  nodes: [
    { elementId: "P", position: { x: 0, y: 0 } },
    { elementId: "N", position: { x: 0, y: 300 }, ...(extra.gedaante ? { gedaante: extra.gedaante } : {}) },
    { elementId: "S", position: { x: 0, y: 520 } },
    { elementId: "B", position: { x: 400, y: 0 } },
  ],
  edges: extra.edges || [],
});

const teken = (d, e = elements) => {
  const uit = tekenDiagram({ diagram: d, elements: e, descriptor, idPrefix: "p", controleer: true });
  return { ...uit, svg: naarSvg(uit.boom) };
};

test("de geïmporteerde edges van het diagram worden getekend: de «use»-lijn, gestreept, met pijl en label", () => {
  const { svg } = teken(diagram({ edges: [use("N-->S"), use("weg", { hidden: true }), use("los", { target: "bestaat-niet" })] }));
  const lijn = svg.match(/<path class="dc-lijn"[^>]*data-edge-id="N--&gt;S"[^>]*>/)?.[0];
  assert.ok(lijn, "de lijn staat in de SVG, herkenbaar aan zijn edge-id");
  assert.match(lijn, /stroke-dasharray="6 3"/);
  assert.match(lijn, /marker-end="url\(#p-pijl-open/);
  // Zonder handles de kortste weg tussen de middens: N staat boven S, dus onderkant → bovenkant.
  const y = lijn.match(/\sd="M\s*([-\d.]+)[ ,]([-\d.]+)/);
  assert.ok(Number(y[2]) > 300, "vertrekt aan de onderkant van N");
  assert.match(svg, /<text[^>]*fill="#7c3aed"[^>]*font-style="italic"[^>]*font-size="9"[^>]*>«use»<\/text>|<text[^>]*font-size="9"[^>]*>«use»<\/text>/);
  assert.equal((svg.match(/«use»/g) || []).length, 1, "een verborgen edge en een edge zonder doel tekenen niet");
  assert.doesNotMatch(teken(diagram()).svg, /«use»/);
});

test("geimporteerdeEdges: kale zijden worden handles, ontbrekende de kortste weg; de maten tellen mee", () => {
  const d = diagram({ edges: [use("a", { sourceHandle: "left", targetHandle: "target-right" }), use("b"), use("c", { target: "bestaat-niet" })] });
  const [a, b, c] = geimporteerdeEdges(d, {});
  assert.deepEqual([a.sourceHandle, a.targetHandle], ["source-left", "target-right"]);
  assert.deepEqual([b.sourceHandle, b.targetHandle], ["source-bottom", "target-top"]);
  assert.deepEqual([c.sourceHandle, c.targetHandle, c.hidden], [null, null, false], "zonder doel geen handles; de tekenaar slaat de lijn over");
  // Een heel hoge bron: het midden van N zakt onder dat van S, dus andersom.
  const [hoog] = geimporteerdeEdges(diagram({ edges: [use("b")] }), { N: { width: 200, height: 800 } });
  assert.deepEqual([hoog.sourceHandle, hoog.targetHandle], ["source-top", "target-bottom"]);
  assert.deepEqual(geimporteerdeEdges({ nodes: [] }), []);
});

test("extraCompartimenten: de afgeleide vakken van het profiel staan in het beeld en maken de doos hoger", () => {
  const { svg, boom } = teken(diagram());
  assert.match(svg, /pattern: \^\[0-9\]\{9\}\$/);
  assert.match(svg, /maxLength: 9/);
  const zonderHook = { ...descriptor, elementTypes: descriptor.elementTypes.map((t) => (t.id === "gegevenstype" ? { ...t, hooks: {} } : t)) };
  const kaal = tekenDiagram({ diagram: diagram(), elements, descriptor: zonderHook, idPrefix: "p" });
  assert.doesNotMatch(naarSvg(kaal.boom), /pattern:/);
  const hoogte = (b) => Number(naarSvg(b).match(/data-element-id="B"[^>]*>.*?<rect[^>]*height="([\d.]+)"/s)[1]);
  assert.ok(hoogte(boom) > hoogte(kaal.boom) + 20, "twee regels en een scheidslijn erbij");
});

test("verrijkElement: hetzelfde element als er niets bijkomt; anders de vakken erbij, gemerkt als extra", () => {
  const typen = Object.fromEntries(descriptor.elementTypes.map((t) => [t.id, t]));
  assert.equal(verrijkElement(elements.S, typen.enumeratie, { elements, elementTypesById: typen }), elements.S);
  const b = verrijkElement(elements.B, typen.gegevenstype, { elements, elementTypesById: typen });
  assert.notEqual(b, elements.B);
  assert.deepEqual(b.compartimenten.map((c) => [c.compartmentType, !!c.extra]), [["eigenschappen", false], ["validatie", true]]);
  assert.equal(elements.B.compartimenten.length, 1, "het element zelf blijft ongemoeid");
  // Opgenomen deel: het geheel krijgt het sub-vak.
  const d = diagram({ gedaante: "ingebed" });
  const p = verrijkElement(elements.P, typen.entiteit, { elements, opnames: bepaalOpnames(elements, d, typen), elementTypesById: typen });
  assert.deepEqual(p.compartimenten.map((c) => [c.compartmentType, c.velden.map((v) => v.naam)]), [["gegevenselementen", ["Naamgebruik"]]]);
});

test("opname: het deel staat als sub-vak in zijn geheel, met zijn velden; het deel zelf is geen doos", () => {
  const los = teken(diagram());
  assert.match(los.svg, /data-element-id="N"/);
  const { svg } = teken(diagram({ gedaante: "ingebed", edges: [use("N-->S")] }));
  assert.doesNotMatch(svg, /data-element-id="N"/, "het ingebedde voorkomen is geen eigen doos");
  const geheel = svg.match(/<g class="dc-voorkomen"[^>]*data-element-id="P".*?<\/g>(?=<g class="dc-voorkomen"|<\/g>)/s)?.[0] || "";
  assert.match(geheel, />Naamgebruik</, "de naam van het deel staat in het geheel");
  assert.match(geheel, />naamgebruik</, "met zijn veld");
  assert.match(geheel, /0\.\.1/, "en de labels van de relatie in de kop");
  assert.doesNotMatch(svg, /data-connector-id="c1"/, "de compositielijn vervalt: de nesting zegt het al");
});

test("labeldelen: elk deel in zijn eigen stijl — rolnaam vet, kardinaliteit paars, constraint klein en cursief", () => {
  const { svg } = teken(diagram());
  const label = svg.match(/<text[^>]*data-dc-label="c1"[^>]*>.*?<\/text>/s)?.[0];
  assert.ok(label, "het label van de compositie");
  assert.match(label, /^<text[^>]*text-anchor="middle"/, "één gecentreerde tekst");
  const delen = [...label.matchAll(/<tspan([^>]*)>([^<]*)<\/tspan>/g)].map((m) => [m[2], m[1].trim()]);
  assert.deepEqual(delen.map((d) => d[0]), ["Naamgebruik", "0..1", "{enkelvoudig}"]);
  assert.match(delen[0][1], /font-weight="600"/);
  assert.doesNotMatch(delen[0][1], /dx=/, "het eerste deel zonder tussenruimte");
  assert.match(delen[1][1], /dx="4"/);
  assert.match(delen[1][1], /fill="#7c3aed"/);
  assert.match(delen[1][1], /font-weight="600"/);
  assert.match(delen[2][1], /dx="4"/);
  assert.match(delen[2][1], /font-style="italic"/);
  assert.match(delen[2][1], /font-size="9"/);
});
