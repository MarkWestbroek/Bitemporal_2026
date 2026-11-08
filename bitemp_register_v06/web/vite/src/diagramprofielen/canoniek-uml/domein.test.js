// domein.test.js — één bron voor het domein (Mark 08-11: "wat domineert?"): het package in de
// boom; een GE volgt zijn entiteit, een relatie haar bron. De inspector toont het als
// alleen-lezen regel (hooks.afgeleideEigenschappen) en de export gebruikt hetzelfde.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/canoniek-uml/domein.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { domeinVanElement } from "./uniekeNamen.js";
import { canoniekUmlDiagramType } from "./index.js";
import { naarCanoniekModel } from "./adapter.js";

const el = (id, elementType, extra = {}) => ({ id, naam: id, elementType, compartimenten: [], data: {}, ...extra });
function model() {
  const elements = {
    pkgA: el("relatiebeheer", "package", { id: "pkgA" }),
    pkgB: el("zaken", "package", { id: "pkgB" }),
    Partij: el("Partij", "entiteit", { data: { domein: "oud" } }),
    Zaak: el("Zaak", "entiteit"),
    Naam: el("Naam", "gegevenselement", { data: { domein: "fout-ingevuld" } }),
    heeft: el("heeft", "relatie", { source: "Partij", target: "Zaak", data: { domein: "ook-fout" } }),
    Wees: el("Wees", "gegevenselement", { data: { domein: "eigen" } }),
    b1: el("b1", "bevat", { source: "pkgA", target: "Partij" }),
    b2: el("b2", "bevat", { source: "pkgB", target: "Zaak" }),
    c1: el("c1", "compositie", { source: "Partij", target: "Naam" }),
  };
  return elements;
}

test("domeinVanElement: package wint; GE en relatie volgen hun entiteit; anders het veld", () => {
  const els = model();
  assert.deepEqual(domeinVanElement(els.Partij, els), { domein: "relatiebeheer", via: "package" });
  assert.deepEqual(domeinVanElement(els.Naam, els), { domein: "relatiebeheer", via: "eigenaar", eigenaarId: "Partij" });
  assert.deepEqual(domeinVanElement(els.heeft, els), { domein: "relatiebeheer", via: "eigenaar", eigenaarId: "Partij" });
  assert.deepEqual(domeinVanElement(els.Wees, els), { domein: "eigen", via: "veld" });
  // Omhangen: een nieuw elements-object (zoals de store het maakt) geeft het nieuwe domein.
  const om = { ...els, b1: { ...els.b1, source: "pkgB" } };
  assert.equal(domeinVanElement(om.Naam, om).domein, "zaken");
});

test("inspector: domein als alleen-lezen regel voor ENT, GE en REL; GE heeft geen domein-veld meer", () => {
  const els = model();
  const typen = Object.fromEntries(canoniekUmlDiagramType.elementTypes.map((t) => [t.id, t]));
  for (const [id, verwacht] of [["Partij", /package/], ["Naam", /van Partij/], ["heeft", /van Partij \(de bron\)/]]) {
    const t = typen[els[id].elementType];
    const [regel] = t.hooks.afgeleideEigenschappen(els[id], { elements: els });
    assert.equal(regel.key, "domein");
    assert.equal(regel.waarde, "relatiebeheer");
    assert.match(regel.uitleg, verwacht);
    assert.equal(regel.inOndertitel, true);
  }
  for (const id of ["gegevenselement", "relatie", "entiteit"]) {
    assert.ok(!(typen[id].properties || []).some((p) => p.key === "domein"), `${id} zonder domein-veld`);
  }
});

test("export: GE en relatie krijgen het domein van hun entiteit, niet hun eigen veld", () => {
  const uit = naarCanoniekModel({ elements: model(), meta: {} }).elements;
  assert.equal(uit.Partij.domein, "relatiebeheer");
  assert.equal(uit.Naam.domein, "relatiebeheer");
});
