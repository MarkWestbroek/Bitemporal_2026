/**
 * Tests voor de canvas-lezer van het vormcontract (naarReact) en het gedeelde voorkomen
 * (voorkomen.js), plan 2026-11-04 Eén tekenaar, stap 3.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { naarReact } from "./naarReact.js";
import { bouwVoorkomen, tekenVoorkomen, basisVanPalet } from "./voorkomen.js";
import { tekenbareVorm, vorm } from "../types/shapeType.js";
import { maakPalet } from "../../diagramsvg/thema.js";
import "./basisVormen.js";

test("naarReact zet een VormBoom om in React-elementen met React-spelling van de attributen", () => {
  const boom = vorm("g", { class: "dc-inhoud", transform: "translate(1 2)" }, vorm("text", { x: 1, y: 2, "font-size": 11, "text-anchor": "middle", "data-dc-naam": "", "stroke-width": 2 }, "Klant"), null);
  const el = naarReact(boom);
  assert.equal(el.type, "g");
  assert.equal(el.props.className, "dc-inhoud");
  assert.equal(el.props.transform, "translate(1 2)");
  const kinderen = Array.isArray(el.props.children) ? el.props.children : [el.props.children];
  assert.equal(kinderen.length, 1, "null-kinderen vallen weg");
  const tekst = kinderen[0];
  assert.equal(tekst.type, "text");
  assert.equal(tekst.props.fontSize, 11);
  assert.equal(tekst.props.textAnchor, "middle");
  assert.equal(tekst.props.strokeWidth, 2);
  assert.equal(tekst.props["data-dc-naam"], "", "data-* blijft zoals het is");
  assert.equal(tekst.props.children, "Klant");
  assert.equal(naarReact("a < b"), "a < b");
  assert.equal(naarReact(null), null);
});

test("voorkomen: bewaarde of opgelegde maat wint, anders de gemeten inhoud; dezelfde uitkomst als de tekenaar", () => {
  const basis = basisVanPalet(maakPalet("auto"));
  const vormInfo = tekenbareVorm("class-box");
  const elementType = { id: "klasse", shape: "class-box", stereotype: "«klasse»", compartments: [{ id: "attributen" }] };
  const element = { id: "k1", naam: "Klant", elementType: "klasse", data: {}, compartimenten: [{ compartmentType: "attributen", velden: [{ naam: "naam", data: { typeLabel: "string" } }] }] };
  const gemeten = bouwVoorkomen({ element, elementType, ...vormInfo, basis, idPrefix: "a" });
  assert.equal(gemeten.w, 180, "class-box minimaal 180 breed");
  assert.ok(gemeten.h >= 56);
  const opgelegd = bouwVoorkomen({ element, elementType, ...vormInfo, maat: { w: 240, h: 120 }, basis, idPrefix: "a" });
  assert.deepEqual([opgelegd.w, opgelegd.h], [240, 120]);
  const viaRef = bouwVoorkomen({ element, elementType, ...vormInfo, ref: { size: { width: 200, height: 90 } }, basis, idPrefix: "a" });
  assert.deepEqual([viaRef.w, viaRef.h], [200, 90]);
  const { omtrek, inhoud, ornament, fouten } = tekenVoorkomen(opgelegd, { controleer: true });
  assert.deepEqual(fouten, []);
  assert.equal(omtrek.tag, "rect");
  assert.equal(omtrek.attrs.width, 238, "rand van 2: 240 - 2");
  assert.equal(inhoud.tag, "g");
  assert.equal(ornament, null);
  const tekst = JSON.stringify(inhoud);
  assert.match(tekst, /"data-dc-naam":""/);
  assert.match(tekst, /"data-dc-veld":"attributen:0"/);
  assert.match(tekst, /"data-dc-stereotype":""/);
  // Verborgen compartimenten: alleen de kop.
  const kop = bouwVoorkomen({ element, elementType, ...vormInfo, basis, idPrefix: "a", verborgen: true });
  assert.ok(kop.h < gemeten.h);
});
