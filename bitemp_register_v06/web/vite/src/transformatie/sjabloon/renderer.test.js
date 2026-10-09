import test from "node:test";
import assert from "node:assert/strict";
import { renderSjabloon, filterLijst, splitsFrontMatter } from "./renderer.js";

const ctx = {
  map: { naam: "Klant" },
  elementen: [
    { naam: "Bel op", type: { id: "usecase", label: "Use case" }, data: { toelichting: "Telefonisch." }, verbindingen: [{ type: { id: "include" }, richting: "uit", doel: { naam: "Voer gesprek" } }] },
    { naam: "Aanvrager", type: { id: "actor", label: "Actor" }, data: {}, verbindingen: [] },
    { naam: "Voer gesprek", type: { id: "usecase", label: "Use case" }, data: {}, verbindingen: [] },
  ],
  diagrammen: [{ naam: "Overzicht", svg: () => "<svg>x</svg>" }],
};

test("waarden, if/else, lus met filter en sortering, scope-keten", () => {
  const sj = `# {{map.naam}}
{{#elk elementen type=usecase sorteer=naam}}- {{naam}} ({{type.label}}){{#if data.toelichting}}: {{data.toelichting}}{{else}}: -{{/if}} [{{map.naam}}]{{#unless laatste}};{{/unless}}
{{/elk}}`;
  const { tekst } = renderSjabloon(sj, ctx);
  assert.equal(
    tekst,
    `# Klant
- Bel op (Use case): Telefonisch. [Klant];
- Voer gesprek (Use case): - [Klant]
`
  );
});

test("geneste lus, richting-filter, functie-waarde (svg) en lijst-opsomming", () => {
  const sj = `{{#elk elementen type=usecase}}{{naam}}:{{#elk verbindingen richting=uit}} include {{doel.naam}}{{/elk}}\n{{/elk}}{{#elk diagrammen}}{{svg}}{{/elk}}|{{elementen}}`;
  const { tekst } = renderSjabloon(sj, ctx);
  assert.equal(tekst, "Bel op: include Voer gesprek\nVoer gesprek:\n<svg>x</svg>|Bel op, Aanvrager, Voer gesprek");
});

test("front matter wordt gelezen én gerenderd; deelsjablonen", () => {
  const sj = `---\ntitel: Overzicht {{map.naam}}\n---\n{{> kop}} einde`;
  const { tekst, meta } = renderSjabloon(sj, ctx, { partials: { kop: "[{{map.naam}}]" } });
  assert.equal(meta.titel, "Overzicht Klant");
  assert.equal(tekst, "[Klant] einde");
  assert.deepEqual(splitsFrontMatter("geen front matter"), { meta: {}, body: "geen front matter" });
});

test("fouten: niet-gesloten blok en onbekend deelsjabloon", () => {
  assert.throws(() => renderSjabloon("{{#if x}}open", ctx), /Niet gesloten/);
  assert.throws(() => renderSjabloon("{{> bestaat-niet}}", ctx), /Onbekend deelsjabloon/);
});

test("filterLijst: object-velden matchen op id/naam, sorteer numeriek-bewust, max", () => {
  const items = [{ naam: "b10", type: { id: "x" } }, { naam: "b2", type: { id: "x" } }, { naam: "a", type: { id: "y" } }];
  assert.deepEqual(filterLijst(items, { type: "x", sorteer: "naam" }).map((i) => i.naam), ["b2", "b10"]);
  assert.deepEqual(filterLijst(items, { sorteer: "naam", omgekeerd: true, max: "1" }).map((i) => i.naam), ["b10"]);
});
