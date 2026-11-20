// codeRegister.test.js — code op id (PROF-1): een profiel wijst naar zijn code met een vaste id.
import test from "node:test";
import assert from "node:assert/strict";
import { meldCodeAan, codeVan, codeIdVan, registreerCode, isEigenLayout } from "./codeRegister.js";
import { vertaalHooks, hookIdVan, HOOK_CATALOGUS } from "../../studio/activities/profielGereedschap.js";

const labels = () => ({});
const resolver = () => [];
const migreer = (m) => m;
const eigenLayout = { id: "lagen", label: "Lagen", run: () => ({}) };
const afgeleid = { id: "leesvolgorde-tb", stijl: "x", run: () => ({}) };

test("meldCodeAan: elke hook, resolver en eigen layout krijgt een id naar zijn plek", () => {
  meldCodeAan({
    id: "proef-a",
    hooks: { migreerModel: migreer },
    referenceResolvers: { basistype: resolver },
    layouts: [eigenLayout, afgeleid],
    elementTypes: [{ id: "lijn", hooks: { edgeLabels: labels } }],
  });
  assert.equal(codeIdVan(labels), "proef-a:lijn.hooks.edgeLabels");
  assert.equal(codeIdVan(migreer), "proef-a:hooks.migreerModel");
  assert.equal(codeIdVan(resolver), "proef-a:referenceResolvers.basistype");
  assert.equal(codeIdVan(eigenLayout), "proef-a:layouts.lagen");
  assert.equal(codeIdVan(afgeleid), undefined, "een afgeleide layout is geen eigen code");
  assert.equal(codeVan("proef-a:lijn.hooks.edgeLabels"), labels);
  assert.equal(isEigenLayout(eigenLayout), true);
  assert.equal(isEigenLayout(afgeleid), false);
});

test("de eerste registratie geeft de naam; een tweede profiel met dezelfde functie wijst ernaar", () => {
  const gedeeld = () => ({});
  meldCodeAan({ id: "proef-b", elementTypes: [{ id: "x", hooks: { edgeLabels: gedeeld } }] });
  meldCodeAan({ id: "proef-c", elementTypes: [{ id: "y", hooks: { edgeLabels: gedeeld } }] });
  assert.equal(codeIdVan(gedeeld), "proef-b:x.hooks.edgeLabels");
  assert.equal(codeVan("proef-c:y.hooks.edgeLabels"), gedeeld, "ook de tweede plek is te vinden");
  registreerCode("proef-b:x.hooks.edgeLabels", () => 1);
  assert.equal(codeVan("proef-b:x.hooks.edgeLabels"), gedeeld, "een bestaande id wordt niet overschreven");
});

test("vertaalHooks: een code-id wordt de code; de catalogus gaat voor; onbekend is een fout", () => {
  const fn = () => ({});
  meldCodeAan({ id: "proef-d", elementTypes: [{ id: "z", hooks: { edgePresentatie: fn } }], referenceResolvers: { t: resolver }, layouts: [eigenLayout] });
  const uit = vertaalHooks({
    id: "kopie",
    elementTypes: [{ id: "z", hooks: { edgePresentatie: "proef-d:z.hooks.edgePresentatie", edgeLabels: "kardinaliteiten" } }],
    referenceResolvers: { t: "proef-a:referenceResolvers.basistype" },
    layouts: ["proef-a:layouts.lagen"],
  });
  assert.equal(uit.elementTypes[0].hooks.edgePresentatie, fn);
  assert.equal(uit.elementTypes[0].hooks.edgeLabels, HOOK_CATALOGUS.edgeLabels.kardinaliteiten);
  assert.equal(uit.referenceResolvers.t, resolver);
  assert.deepEqual(uit.layouts, [eigenLayout]);
  assert.equal(hookIdVan("edgeLabels", HOOK_CATALOGUS.edgeLabels.kardinaliteiten), "kardinaliteiten", "de catalogus-id gaat voor");
  assert.throws(() => vertaalHooks({ id: "k", elementTypes: [], layouts: ["bestaat:niet"] }), /onbekende code-id "bestaat:niet"/);
  assert.throws(() => vertaalHooks({ id: "k", elementTypes: [{ id: "q", hooks: { edgeLabels: "bestaat:niet" } }] }), /onbekende edgeLabels-hook "bestaat:niet"/);
});
