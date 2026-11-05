/**
 * Tests voor de toegangsregel-ShapeTypes (plan 2026-11-04 Eén tekenaar, stap 4).
 * Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/toegangsregel/vormen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { TOEGANGSREGEL_SHAPETYPES, policyInhoud, voorwaardeNaam, voorwaardeInhoud, poortSymbool, isVerbod } from "./vormen.js";
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
  return { box, ...uit, tekst: JSON.stringify([uit.omtrek, uit.inhoud, uit.ornament]), teksten: (uit.inhoud?.kinderen || []).filter((k) => k.tag === "text").map((k) => k.kinderen[0]) };
};
const el = (type, naam = "", data = {}) => ({ id: "x", naam, elementType: type, data, compartimenten: [] });

test("alle negen vormen tekenbaar; kaft met boekrug en 'vanaf · doel'; regelkaart mag (groen) / mag niet (arcering + ⃠)", () => {
  for (const st of TOEGANGSREGEL_SHAPETYPES) assert.ok(tekenbareVorm(st.id), st.id);
  const k = teken("tr-kaft", el("policy", "Inzagebeleid", { geldigVanaf: "2026-01-01", doel: "dienstverlening" }), { id: "policy", shape: "tr-kaft", kleur: "#e0e7ff", hooks: { inhoudsregels: policyInhoud } });
  assert.equal(k.omtrek.kinderen[1].attrs.fill, "#a5b4fc", "de rug");
  assert.deepEqual(k.teksten, ["Inzagebeleid", "vanaf 2026-01-01 · dienstverlening"]);
  assert.deepEqual(policyInhoud({ data: {} }), []);
  const mag = teken("tr-regelkaart", el("toegangsregel", "Inzage eigen dossier", { modaliteit: "mag" }), { id: "toegangsregel", shape: "tr-regelkaart", kleur: "#f8fafc" });
  assert.ok(mag.box.w >= 170 && mag.box.h === 52, `minstens 170×52, breder met de naam naast de band (${mag.box.w}×${mag.box.h})`);
  assert.match(mag.tekst, /"mag"/);
  assert.doesNotMatch(mag.tekst, /#dc2626/);
  assert.equal(mag.omtrek.kinderen[0].tag, "defs", "clipPath voor de band");
  assert.equal(mag.omtrek.kinderen[0].kinderen[0].attrs.id, "a-kaart", "id met idPrefix");
  const niet = teken("tr-regelkaart", el("toegangsregel", "Inzage van derden", { modaliteit: "mag niet" }), { id: "toegangsregel", shape: "tr-regelkaart" });
  assert.match(niet.tekst, /"mag niet"/);
  const arcering = niet.omtrek.kinderen[2].kinderen.find((x) => x.tag === "g");
  assert.ok(arcering.kinderen.filter((x) => x.tag === "line").length > 5, "arcering");
  assert.equal(arcering.attrs["clip-path"], "url(#a-band)", "de arcering blijft binnen de band (geen wig over de kaart)");
  assert.deepEqual(niet.omtrek.kinderen[0].kinderen[1].kinderen[0].attrs, { x: 0, y: 0, width: 11, height: niet.box.h }, "het knipvlak van de band");
  assert.ok(niet.omtrek.kinderen.some((x) => x.tag === "circle"), "⃠");
  assert.equal(isVerbod("verboden"), true);
  assert.equal(isVerbod("mag"), false);
});

test("badge, pijlblok, cilinder (▦ bij verwijzing), vaandel en tag: omtrek + ornament, naam in het inhoudsvak", () => {
  const b = teken("tr-badge", el("subject", "Behandelaar"), { id: "subject", shape: "tr-badge", kleur: "#d3f2d4" });
  assert.equal(b.omtrek.kinderen[1].attrs.y, -3, "de clip steekt boven de badge uit");
  assert.equal(b.ornament.kinderen[0].tag, "circle", "persoon");
  assert.deepEqual(b.teksten, ["Behandelaar"]);
  const p = teken("tr-pijlblok", el("handeling", "inzien"), { id: "handeling", shape: "tr-pijlblok", kleur: "#ffe1c7" });
  assert.equal(p.omtrek.tag, "polygon");
  assert.equal(p.box.renderer.inhoudsvak(p.box.ctx).w, p.box.w - 14, "ruimte voor de punt");
  const c = teken("tr-cilinder", el("gegevensselectie", "Dossier"), { id: "gegevensselectie", shape: "tr-cilinder", kleur: "#fdf0a8" });
  assert.equal(c.omtrek.kinderen[1].tag, "ellipse");
  assert.equal(c.ornament, null);
  const cv = teken("tr-cilinder", el("gegevensselectie", "Dossier", { verwijzingselement: "x" }), { id: "gegevensselectie", shape: "tr-cilinder" });
  assert.ok(cv.ornament, "▦ bij een cross-profiel verwijzing");
  const v = teken("tr-vaandel", el("plicht", "loggen"), { id: "plicht", shape: "tr-vaandel", kleur: "#d2f0ea" });
  assert.equal(v.ornament.attrs.stroke, "#0f766e", "⚑");
  const t = teken("tr-tag", el("begrip", "eigen dossier"), { id: "begrip", shape: "tr-tag", kleur: "#e2e8f0" });
  assert.equal(t.omtrek.kinderen[0].attrs["stroke-dasharray"], "4 3", "gestippeld");
  assert.equal(t.omtrek.kinderen[1].tag, "circle", "oogje");
});

test("poort: ruit 48 met symbool en de soort eronder, zonder naam; voorwaarde: links · teken · rechts of de naam", () => {
  assert.deepEqual([poortSymbool("alle"), poortSymbool("ten minste één"), poortSymbool("precies één")], ["+", "○", "×"]);
  const po = teken("tr-poort", el("voorwaardepoort", "poort 1", { soort: "ten minste één" }), { id: "voorwaardepoort", shape: "tr-poort", resizebaar: false, naamLabel: "geen", kleur: "#ecdcf7" });
  assert.deepEqual([po.box.w, po.box.h, po.inhoud], [48, 48, null]);
  assert.equal(po.omtrek.kinderen[1].kinderen[0], "○");
  assert.equal(po.ornament.kinderen[0], "ten minste één");
  assert.equal(po.ornament.attrs.y, 60, "onder de ruit");
  assert.deepEqual(po.box.rand(90), { x: 24, y: 48 });
  const ET = { id: "voorwaarde", shape: "tr-vergelijking", kleur: "#ecdcf7", hooks: { naamWeergave: voorwaardeNaam, inhoudsregels: voorwaardeInhoud } };
  const met = teken("tr-vergelijking", el("voorwaarde", "leeftijdscheck", { links: "leeftijd", vergelijking: "≥", rechts: "18" }), ET);
  assert.deepEqual(met.teksten, ["leeftijd", "≥", "18"], "delen in plaats van de naam");
  const teken2 = met.inhoud.kinderen.find((k) => k.kinderen?.[0] === "≥");
  assert.equal(teken2.attrs["font-weight"], 700);
  assert.equal(teken2.attrs.fill, "#6b21a8");
  assert.equal(met.inhoud.kinderen[0].attrs["data-dc-veld"], "links", "inline bewerkbaar");
  const zonder = teken("tr-vergelijking", el("voorwaarde", "leeftijdscheck"), ET);
  assert.deepEqual(zonder.teksten, ["leeftijdscheck"]);
  assert.equal(zonder.omtrek.attrs.rx, (zonder.box.h - 1.3) / 2, "halfrond");
});
