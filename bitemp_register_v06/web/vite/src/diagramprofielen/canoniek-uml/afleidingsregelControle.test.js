// afleidingsregelControle.test.js — statische controle van een afgeleide relatie (np-loc-achtig).
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/canoniek-uml/afleidingsregelControle.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { controleerAfleidingsregel, veldenBijAfgeleid } from "./afleidingsregelControle.js";

const veld = (naam) => ({ naam, data: {} });
const ent = (id, velden = []) => ({ id, naam: id, elementType: "entiteit", compartimenten: [{ compartmentType: "velden", velden: velden.map(veld) }], data: {} });
const rel = (id, source, target, data = {}) => ({ id, naam: id, elementType: "relatie", source, target, compartimenten: [], data });

/** NatuurlijkPersoon → woonlocatie → Locatie → gebiedsligging → Gemeentedeel → gemeente → Gemeente. */
function model(regel, doel = "Gemeente") {
  return {
    NatuurlijkPersoon: ent("NatuurlijkPersoon"),
    Locatie: ent("Locatie"),
    Gemeentedeel: ent("Gemeentedeel", ["naam"]),
    Gemeente: ent("Gemeente"),
    Woonlocatie: rel("Woonlocatie", "NatuurlijkPersoon", "Locatie", { meervoud: "woonlocatie" }),
    Gebiedsligging: rel("Gebiedsligging", "Locatie", "Gemeentedeel", { meervoud: "gebiedsligging" }),
    Gemeentedeelgemeente: rel("Gemeentedeelgemeente", "Gemeentedeel", "Gemeente", { meervoud: "gemeente" }),
    Woongemeente: rel("Woongemeente", "NatuurlijkPersoon", doel, { afgeleid: true, afleidingsregel: regel }),
  };
}
const check = (regel, doel) => controleerAfleidingsregel(model(regel, doel), "Woongemeente");

test("een pad door de keten naar het doel is in orde (doorkijk via de rolnamen)", () => {
  assert.equal(check("woonlocatie.gebiedsligging.gemeente").niveau, "ok");
  assert.equal(check("Woonlocatie.Gebiedsligging.Gemeentedeelgemeente").niveau, "ok", "klassenamen werken ook");
  assert.equal(check("WOONLOCATIE.gebiedsligging.gemeente").niveau, "ok", "hoofdletterongevoelig");
  assert.equal(check("woonlocatie.gebiedsligging", "Gemeentedeel").niveau, "ok");
  assert.equal(check("woonlocatie.filter(w, w.rel_id > 0).gebiedsligging", "Gemeentedeel").niveau, "ok", "filter houdt het type");
});

test("een verkeerd doel, een onbekende naam of een waarde is een fout", () => {
  const verkeerd = check("woonlocatie.gebiedsligging");
  assert.equal(verkeerd.niveau, "fout");
  assert.match(verkeerd.melding, /Gemeentedeel.*Gemeente/);
  assert.match(check("woonlocatie.bestaatNiet").melding, /bestaatNiet/);
  assert.equal(check("woonlocatie.gebiedsligging.naam").niveau, "fout", "naam is een waarde");
  assert.equal(check("woonlocatie.gebiedsligging.naam.x").niveau, "fout");
});

test("parsefouten, lege regel, id's en niet-statische vormen", () => {
  assert.equal(check("woonlocatie gemeente").niveau, "fout", "strikt: tekst na de expressie");
  assert.equal(check("").niveau, "fout");
  assert.equal(check("woonlocatie.gebiedsligging.gemeente.rel_id").niveau, "waarschuwing", "een id mag, met waarschuwing");
  assert.equal(check("woonlocatie.map(w, w).size()").niveau, "fout", "size levert een waarde");
  assert.equal(check("woonlocatie.map(w, w)").niveau, "waarschuwing", "map is niet statisch te volgen");
  assert.equal(check("self", "NatuurlijkPersoon").niveau, "ok", "self is de bron");
});

test("niet-afgeleid: niets te controleren; velden bij afgeleid geven een waarschuwing", () => {
  const m = model("x");
  m.Woonlocatie.compartimenten = [{ compartmentType: "velden", velden: [veld("sinds")] }];
  assert.deepEqual(controleerAfleidingsregel(m, "Woonlocatie"), { niveau: "ok", melding: "" });
  assert.equal(veldenBijAfgeleid(m, "Woonlocatie"), "");
  m.Woongemeente.compartimenten = [{ compartmentType: "velden", velden: [veld("a"), veld("b")] }];
  assert.match(veldenBijAfgeleid(m, "Woongemeente"), /deze 2 velden/);
});

test("zelf-relatie in het pad: waarschuwing (register kan hem nog niet opslaan)", () => {
  const m = {
    Persoon: ent("Persoon"),
    Ouders: rel("Ouders", "Persoon", "Persoon", { meervoud: "ouders" }),
    Grootouders: rel("Grootouders", "Persoon", "Persoon", { afgeleid: true, afleidingsregel: "ouders.ouders" }),
  };
  const u = controleerAfleidingsregel(m, "Grootouders");
  assert.equal(u.niveau, "waarschuwing");
  assert.match(u.melding, /zelf-relatie Ouders/);
});
