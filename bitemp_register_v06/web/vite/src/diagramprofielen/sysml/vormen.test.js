/**
 * Tests voor de SysML-ShapeTypes (plan 2026-11-04 Eén tekenaar, stap 4).
 * Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/sysml/vormen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SYSML_SHAPETYPES, requirementInhoud } from "./vormen.js";
import { tekenbareVorm } from "../../diagramcore/types/shapeType.js";
import { bouwVoorkomen, tekenVoorkomen, basisVanPalet } from "../../diagramcore/tekenaar/voorkomen.js";
import { maakPalet } from "../../diagramsvg/thema.js";

const basis = basisVanPalet(maakPalet("light"));
const teken = (shapeId, element, elementType, extra = {}) => {
  const vormInfo = tekenbareVorm(shapeId);
  assert.ok(vormInfo, `${shapeId} is tekenbaar`);
  const box = bouwVoorkomen({ element, elementType, ...vormInfo, basis, idPrefix: "a", ...extra });
  const uit = tekenVoorkomen(box, { controleer: true });
  assert.deepEqual(uit.fouten, [], shapeId);
  return { box, ...uit, tekst: JSON.stringify([uit.omtrek, uit.inhoud, uit.ornament]) };
};
const el = (type, naam = "", data = {}) => ({ id: "x", naam, elementType: type, data, compartimenten: [] });
const REQ = { id: "requirement", shape: "sysml-requirement", stereotype: "«requirement»", kleur: "#ede9fe", hooks: { inhoudsregels: requirementInhoud } };

test("requirement: «requirement»-doos met id = … en text = … als eigen inhoud onder een scheidslijn", () => {
  for (const st of SYSML_SHAPETYPES) assert.ok(tekenbareVorm(st.id), st.id);
  const r = teken("sysml-requirement", el("requirement", "Snelle respons", { reqId: "REQ-1", tekst: "Het systeem antwoordt binnen een seconde." }), REQ);
  assert.equal(r.box.w, 280, "lange tekst: tot de maximale breedte (zoals .dc-node max-width 280)");
  assert.ok(r.box.h > 56, `groeit met de inhoud (${r.box.h})`);
  assert.equal(r.omtrek.attrs.fill, "#ede9fe");
  const teksten = r.inhoud.kinderen.filter((k) => k.tag === "text").map((k) => k.kinderen[0]);
  assert.equal(teksten[0], "«requirement»");
  assert.equal(teksten[1], "Snelle respons");
  assert.equal(teksten[2], "id = REQ-1");
  assert.ok(teksten[3].startsWith("text = Het systeem"), "lopende tekst");
  assert.ok(r.inhoud.kinderen.some((k) => k.tag === "line"), "scheidslijn boven de id-regel");
  const idRegel = r.inhoud.kinderen.find((k) => k.kinderen?.[0] === "id = REQ-1");
  assert.equal(idRegel.attrs["font-family"], "ui-monospace, monospace");
  assert.equal(idRegel.attrs["data-dc-veld"], "reqId", "inline bewerkbaar");
  const leeg = teken("sysml-requirement", el("requirement", "Leeg"), REQ);
  assert.match(leeg.tekst, /id = …/);
  assert.match(leeg.tekst, /text = \(nog geen tekst\)/);
});

test("poort: vierkantje van 16 met pijl naar binnen (in) of naar buiten (uit); geen inhoud", () => {
  const proxy = teken("sysml-poort", el("poort", "p1"), { id: "poort", shape: "sysml-poort", resizebaar: false, naamLabel: "buiten" });
  assert.deepEqual([proxy.box.w, proxy.box.h, proxy.inhoud], [16, 16, null]);
  assert.equal(proxy.omtrek.kinderen.length, 1, "proxy port: geen pijl");
  const inp = teken("sysml-poort", el("poort", "p2", { richting: "in" }), { id: "poort", shape: "sysml-poort" });
  assert.equal(inp.omtrek.kinderen.length, 2);
  assert.match(inp.omtrek.kinderen[1].attrs.d, /^M4 8 H11/);
  const uit = teken("sysml-poort", el("poort", "p3", { richting: "uit" }), { id: "poort", shape: "sysml-poort" });
  assert.match(uit.omtrek.kinderen[1].attrs.d, /^M12 8 H5/);
  assert.deepEqual(proxy.box.rand(0), { x: 16, y: 8 });
});
