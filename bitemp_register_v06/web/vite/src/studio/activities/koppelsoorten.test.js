import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STANDAARD_SOORTEN, effectieveSoorten, vindSoort, metSoort, hernoemSoort, wijzigSoort, zonderSoort,
  normaliseerSoorten, schuifSoort, gebruikVanSoort,
} from "./koppelsoorten.js";

const namen = (lijst) => lijst.map((t) => t.soort);
const links = [{ id: "a", soort: "triggert" }, { id: "b", soort: "realiseert" }, { id: "c", soort: "triggert" }];

test("zonder eigen lijst: de standaardlijst plus de soorten uit de links", () => {
  const e = effectieveSoorten(null, links);
  assert.deepEqual(namen(e), [...namen(STANDAARD_SOORTEN), "triggert"]);
  assert.equal(vindSoort("triggert", null, links).stijl, "afhankelijk");
  assert.equal(vindSoort("realiseert", null, links).stijl, "realisatie");
});

test("een nieuwe soort komt in de eigen lijst (met de standaardsoorten erbij) en blijft na het wissen van de link", () => {
  const eigen = metSoort(null, [], "verandert");
  assert.deepEqual(namen(eigen), [...namen(STANDAARD_SOORTEN), "verandert"]);
  assert.equal(metSoort(eigen, [], "verandert"), null, "al bekend");
  assert.equal(metSoort(null, [], "realiseert"), null, "standaardsoort");
  // Een soort die alleen uit een link kwam, wordt nu echt lid van de lijst.
  const metLink = metSoort(null, links, "triggert");
  assert.deepEqual(namen(effectieveSoorten(metLink, [])).slice(-1), ["triggert"]);
});

test("hernoemen raakt lijst én links; naar een bestaande naam gaan ze samen", () => {
  const r = hernoemSoort(null, links, "triggert", "start");
  assert.ok(namen(r.soorten).includes("start"));
  assert.ok(!namen(r.soorten).includes("triggert"));
  assert.deepEqual(r.links.map((l) => l.soort), ["start", "realiseert", "start"]);
  const samen = hernoemSoort(null, links, "triggert", "realiseert");
  assert.equal(namen(samen.soorten).filter((s) => s === "realiseert").length, 1);
  assert.deepEqual(samen.links.map((l) => l.soort), ["realiseert", "realiseert", "realiseert"]);
  assert.equal(hernoemSoort(null, links, "triggert", "  "), null);
});

test("stijl wijzigen, verwijderen, schuiven en normaliseren", () => {
  const w = wijzigSoort(null, [], "verfijnt", { stijl: "realisatie", soort: "genegeerd" });
  assert.equal(w.find((t) => t.soort === "verfijnt").stijl, "realisatie");
  assert.ok(!namen(zonderSoort(null, [], "verfijnt")).includes("verfijnt"));
  // In gebruik: blijft zichtbaar via de links.
  assert.ok(namen(effectieveSoorten(zonderSoort(null, links, "triggert"), links)).includes("triggert"));
  assert.equal(gebruikVanSoort(links, "triggert"), 2);
  assert.deepEqual(namen(schuifSoort(null, [], "heeft te maken met", -1)).slice(0, 2), ["heeft te maken met", "komt voort uit"]);
  assert.equal(schuifSoort(null, [], "komt voort uit", -1), null);
  assert.equal(normaliseerSoorten(undefined), null);
  assert.deepEqual(normaliseerSoorten(["a", { soort: "a" }, { soort: " b ", stijl: "realisatie" }, { soort: "" }]), [
    { soort: "a", stijl: "afhankelijk", defaultOmgekeerd: false },
    { soort: "b", stijl: "realisatie", defaultOmgekeerd: false },
  ]);
});
