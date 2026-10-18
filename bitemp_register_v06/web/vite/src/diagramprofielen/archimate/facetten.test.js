// facetten.test.js — ArchiMate: de facetten laag/aspect (M3, 18-10) leveren dezelfde lagen als de
// leesvolgorde in index.js, en de aspecten volgen het raamwerk.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/archimate/facetten.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { ELEMENTEN, FACETTEN, facettenVan } from "./elementen.js";

const MET_FACET = ELEMENTEN.map(([id, , kleur, , rond]) => ({ id, f: facettenVan(id, kleur, rond) || {} }));
const inLaag = (laag) => MET_FACET.filter((e) => e.f.laag === laag).map((e) => e.id).sort();

test("lagen gelijk aan de leesvolgorde van 18-10 (motivatie boven, implementatie onder)", () => {
  const verwacht = [
    ["stakeholder", "driver", "assessment", "goal", "outcome", "principle", "requirement", "constraint", "betekenis", "waarde"],
    ["resource", "capability", "koers", "waardestroom"],
    ["business-actor", "business-rol", "business-collaboratie", "business-interface", "business-proces", "business-functie", "business-interactie", "business-service", "business-event", "business-object", "contract", "representatie", "product"],
    ["app-component", "app-collaboratie", "app-interface", "app-functie", "app-interactie", "app-proces", "app-event", "app-service", "data-object"],
    ["node", "device", "systeemsoftware", "tech-collaboratie", "tech-interface", "pad", "communicatienetwerk", "tech-functie", "tech-proces", "tech-interactie", "tech-event", "tech-service", "artifact"],
    ["equipment", "facility", "distributienetwerk", "materiaal"],
    ["werkpakket", "deliverable", "implementatie-event", "plateau", "gap"],
  ];
  assert.deepEqual(FACETTEN.laag.map(inLaag), verwacht.map((l) => [...l].sort()));
  assert.deepEqual(MET_FACET.filter((e) => !e.f.laag).map((e) => e.id).sort(), ["grouping", "locatie"], "overig: geen laag");
});

test("aspecten: actief, gedrag, passief, samengesteld; motivatie zonder aspect", () => {
  const aspect = Object.fromEntries(MET_FACET.map((e) => [e.id, e.f.aspect ?? null]));
  for (const id of ["business-actor", "app-interface", "node", "facility"]) assert.equal(aspect[id], "actief", id);
  for (const id of ["business-proces", "app-service", "tech-event", "capability", "werkpakket"]) assert.equal(aspect[id], "gedrag", id);
  for (const id of ["business-object", "data-object", "artifact", "materiaal", "deliverable"]) assert.equal(aspect[id], "passief", id);
  for (const id of ["product", "plateau", "locatie", "grouping"]) assert.equal(aspect[id], "samengesteld", id);
  for (const id of ["goal", "requirement", "waarde", "resource", "gap"]) assert.equal(aspect[id], null, id);
  for (const e of MET_FACET) if (e.f.aspect) assert.ok(FACETTEN.aspect.includes(e.f.aspect), e.id);
});
