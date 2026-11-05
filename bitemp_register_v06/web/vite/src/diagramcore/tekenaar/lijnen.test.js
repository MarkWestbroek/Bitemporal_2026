/**
 * Tests voor de lijnen van de tekenaar (labels). De paden zelf bewaakt de pariteitstest
 * tests/e2e/41-studio-tekenaar-pariteit.spec.js tegen het canvas.
 * Run: node --import ./test/register-aliases.mjs --test src/diagramcore/tekenaar/lijnen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tekenLijnen } from "./lijnen.js";

const thema = { border: "#64748b", surface: "#ffffff", muted: "#64748b", text: "#0f172a" };
const doos = (x, y) => ({ x, y, w: 100, h: 40, et: {}, ctx: { shapeType: { parameters: {} } } });
const boxen = new Map([["a", doos(0, 0)], ["b", doos(300, 0)]]);
const lijn = (labels, extra = {}) => ({
  source: "a",
  target: "b",
  sourceHandle: "source-right",
  targetHandle: "target-left",
  data: { connectorId: "c", presentatie: { vorm: "recht", labels, ...extra } },
});
const teken = (edge) => tekenLijnen({ edges: [edge], boxen, elements: { c: { id: "c" } }, thema, idPrefix: "p" });
const teksten = (uit) => uit.boom.kinderen.filter((k) => k.tag === "text").map((k) => ({ tekst: k.kinderen[0], x: k.attrs.x, y: k.attrs.y - 3.5, van: k.attrs["data-dc-label"] }));

test("labels op dezelfde zijde stapelen 18 px onder elkaar (conditie + naam op een BPMN-stroom)", () => {
  const uit = teken(lijn([
    { zijde: "midden", delen: [{ tekst: "[${ontvankelijk}]", soort: "constraint" }] },
    { zijde: "midden", delen: [{ tekst: "ja", soort: "rolnaam", veld: "naam" }] },
    { zijde: "doel", delen: [{ tekst: "1", soort: "kardinaliteit" }] },
  ]));
  const [conditie, naam, doel] = teksten(uit);
  // Vaste handles: de lijn loopt van (105, 20) naar (295, 20); het labelpunt is het midden.
  assert.deepEqual([conditie.x, conditie.y], [200, 20]);
  assert.deepEqual([naam.x, naam.y], [200, 38], "het tweede label op dezelfde zijde staat 18 lager, niet erbovenop");
  assert.equal(doel.y, 20, "een label op een andere zijde stapelt niet mee");
  assert.equal(doel.x, 200 + (295 - 200) * 0.7, "op 70% richting het doel");
  assert.deepEqual([conditie.van, naam.van, doel.van], ["c", "c", "c"], "elk label draagt zijn connector");
  // Bij elk label hoort een eigen chip, op dezelfde hoogte als de tekst.
  const chips = uit.boom.kinderen.filter((k) => k.tag === "rect");
  assert.deepEqual(chips.map((k) => k.attrs.y + 8), [20, 38, 20]);
});

test("stapeling komt bovenop een handmatige verschuiving; een leeg label telt wel mee in de stapel", () => {
  const uit = teken(lijn([
    { zijde: "midden", offset: { x: 10, y: -30 }, delen: [{ tekst: "a" }] },
    { zijde: "midden", delen: [{ tekst: "" }] },
    { zijde: "midden", offset: { x: 10, y: -30 }, delen: [{ tekst: "c" }] },
  ]));
  const [a, c] = teksten(uit);
  assert.deepEqual([a.x, a.y], [210, -10]);
  assert.deepEqual([c.x, c.y], [210, -10 + 36], "derde op de zijde: twee stappen van 18, zoals het canvas telt");
});

test("labelsBoven (sequence) zet het middenlabel 13 boven de lijn; een onbekende zijde valt op het midden", () => {
  const uit = teken(lijn([{ zijde: "midden", delen: [{ tekst: "vraag" }] }, { zijde: "ergens", delen: [{ tekst: "x" }] }], { labelsBoven: true }));
  const [vraag, x] = teksten(uit);
  assert.equal(vraag.y, 20 - 13);
  assert.equal(x.y, 20 - 13 + 18, "onbekende zijde = midden, en stapelt daar");
});
