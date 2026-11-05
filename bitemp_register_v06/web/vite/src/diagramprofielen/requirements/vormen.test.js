/**
 * Tests voor het rq-eis-ShapeType (plan 2026-11-04 Eén tekenaar, stap 4).
 * Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/requirements/vormen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { REQUIREMENTS_SHAPETYPES, eisInhoud } from "./vormen.js";
import { tekenbareVorm } from "../../diagramcore/types/shapeType.js";
import { bouwVoorkomen, tekenVoorkomen, basisVanPalet } from "../../diagramcore/tekenaar/voorkomen.js";
import { maakPalet } from "../../diagramsvg/thema.js";

const basis = basisVanPalet(maakPalet("light"));
const ET = {
  id: "requirement", shape: "rq-eis", stereotype: "«requirement»", kleur: "#ede9fe",
  hooks: { inhoudsregels: eisInhoud, stereotype: (element) => (element?.data?.soort ? `«${String(element.data.soort).toLowerCase()}»` : "") },
};
const teken = (data, naam = "Inloggen") => {
  const vormInfo = tekenbareVorm("rq-eis");
  assert.ok(vormInfo);
  const box = bouwVoorkomen({ element: { id: "r", naam, elementType: "requirement", data, compartimenten: [] }, elementType: ET, ...vormInfo, basis, idPrefix: "a" });
  const uit = tekenVoorkomen(box, { controleer: true });
  assert.deepEqual(uit.fouten, []);
  return { box, ...uit, teksten: uit.inhoud.kinderen.filter((k) => k.tag === "text").map((k) => k.kinderen[0]), pillen: uit.inhoud.kinderen.filter((k) => k.tag === "rect") };
};

test("eisInhoud: alleen wat gevuld is — id (mono), tekst (lopend), badges", () => {
  assert.deepEqual(eisInhoud({ data: {} }), []);
  const regels = eisInhoud({ data: { reqId: "REQ-012", tekst: "Lang verhaal", status: "Approved", prioriteit: "High" } });
  assert.equal(regels.length, 3);
  assert.equal(regels[0].divider, true);
  assert.equal(regels[0].delen[0].soort, "mono");
  assert.equal(regels[1].divider, false, "de scheidslijn staat al boven de id");
  assert.equal(regels[1].delen[0].soort, "tekst");
  assert.deepEqual(regels[2].delen.map((d) => d.tekst), ["Approved", "prio High"]);
  assert.equal(eisInhoud({ data: { tekst: "Alleen tekst" } })[0].divider, true);
});

test("rq-eis: stereotype uit de soort, naam, id-regel, afgebroken tekst en chips; groeit mee", () => {
  for (const st of REQUIREMENTS_SHAPETYPES) assert.ok(tekenbareVorm(st.id), st.id);
  const r = teken({ soort: "Functional", reqId: "REQ-012", tekst: "De gebruiker kan inloggen met e-mail en wachtwoord, en krijgt bij een fout een duidelijke melding.", status: "Approved", prioriteit: "High", moeilijkheid: "Medium" });
  assert.equal(r.box.w, 280, "lange tekst: tot de maximale breedte (zoals .dc-node max-width 280)");
  assert.equal(r.omtrek.attrs.fill, "#ede9fe");
  assert.equal(r.teksten[0], "«functional»");
  assert.equal(r.teksten[1], "Inloggen");
  assert.equal(r.teksten[2], "id = REQ-012");
  const tekstregels = r.teksten.slice(3, -3);
  assert.ok(tekstregels.length >= 3, `tekst over meer regels (${tekstregels.length})`);
  assert.deepEqual(r.teksten.slice(-3), ["Approved", "prio High", "moeilijkheid Medium"]);
  assert.equal(r.pillen.length, 3, "drie chips");
  assert.equal(r.pillen[0].attrs.rx, 6);
  assert.ok(r.box.h >= 110, `hoogte volgt de inhoud (${r.box.h})`);
  const kaal = teken({});
  assert.deepEqual(kaal.teksten, ["«requirement»", "Inloggen"]);
  assert.deepEqual([kaal.box.w, kaal.box.h], [180, 56]);
});
