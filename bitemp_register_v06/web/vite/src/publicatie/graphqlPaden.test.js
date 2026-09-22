/**
 * graphqlPaden.test.js — veldpaden afstemmen op het GraphQL-schema.
 * Gedraaid met: node --test src/publicatie/graphqlPaden.test.js
 *
 * Het schema hieronder is een uitsnede met dezelfde vorm als op pf.common-ground-lab.nl
 * (september 2026): Initiatief → initiatief_gemeenten (InitiatiefGemeente) → gemeente
 * (Gemeente) → gemeentegegevens (Gemeente_GemeenteGegevens).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  bouwSchemaIndex,
  rootTypeVoor,
  normaliseerPad,
  normaliseerTemplatePaden,
} from "./graphqlPaden.js";

const S = (name) => ({ name, kind: "SCALAR" });
const O = (name) => ({ name, kind: "OBJECT" });
const L = (t) => ({ name: null, kind: "LIST", ofType: t });
const veld = (name, type) => ({ name, type });

const introspectie = {
  __schema: {
    queryType: { name: "Query" },
    types: [
      { name: "Query", kind: "OBJECT", fields: [veld("full_initiatieven", O("Initiatief"))] },
      {
        name: "Initiatief",
        kind: "OBJECT",
        fields: [
          veld("id", S("Int")),
          veld("producten", O("Initiatief_Product")),
          veld("initiatief_gemeenten", L(O("InitiatiefGemeente"))),
          veld("initiatief_organisaties", L(O("InitiatiefOrganisatie"))),
        ],
      },
      { name: "Initiatief_Product", kind: "OBJECT", fields: [veld("naam", S("String")), veld("data", O("Initiatief_Product_Data"))] },
      { name: "Initiatief_Product_Data", kind: "OBJECT", fields: [veld("naam", S("String"))] },
      {
        name: "InitiatiefGemeente",
        kind: "OBJECT",
        fields: [
          veld("rol", S("String")),
          veld("weergavenaam", S("String")),
          veld("data", O("InitiatiefGemeente_Data")),
          veld("gemeente", O("Gemeente")),
        ],
      },
      { name: "InitiatiefGemeente_Data", kind: "OBJECT", fields: [veld("rol", S("String"))] },
      {
        name: "Gemeente",
        kind: "OBJECT",
        fields: [
          veld("id", S("Int")),
          veld("weergavenaam", S("String")),
          veld("gemeentegegevens", O("Gemeente_GemeenteGegevens")),
          veld("aanvang", O("Gemeente_Aanvang")),
          veld("gerelateerde_initiatieven", O("Initiatief")),
        ],
      },
      { name: "Gemeente_GemeenteGegevens", kind: "OBJECT", fields: [veld("naam", S("String")), veld("code", S("String"))] },
      { name: "Gemeente_Aanvang", kind: "OBJECT", fields: [veld("datum", S("Date"))] },
      {
        name: "InitiatiefOrganisatie",
        kind: "OBJECT",
        fields: [veld("rol", S("String")), veld("organisatie", O("Organisatie"))],
      },
      {
        name: "Organisatie",
        kind: "OBJECT",
        fields: [
          veld("organisatienamen", O("Organisatie_Organisatienaam")),
          veld("organisatiecontactgegevens", O("Organisatie_Organisatiecontactgegevens")),
        ],
      },
      { name: "Organisatie_Organisatienaam", kind: "OBJECT", fields: [veld("naam", S("String"))] },
      { name: "Organisatie_Organisatiecontactgegevens", kind: "OBJECT", fields: [veld("email", S("String")), veld("naam", S("String"))] },
    ],
  },
};

const index = bouwSchemaIndex(introspectie);
const root = rootTypeVoor(index, "initiatieven");
const pad = (p) => normaliseerPad(index, root, p);

test("rootTypeVoor: type van full_<padnaam>", () => {
  assert.equal(root, "Initiatief");
});

test("normaliseerPad: juiste paden blijven gelijk (ook data en filters)", () => {
  assert.equal(pad("producten.naam"), "producten.naam");
  assert.equal(pad("producten.data.naam"), "producten.data.naam");
  assert.equal(
    pad("initiatief_gemeenten[rol=Maakt gebruik van].gemeente.gemeentegegevens.naam"),
    "initiatief_gemeenten[rol=Maakt gebruik van].gemeente.gemeentegegevens.naam"
  );
});

test("normaliseerPad: klassenaam en hoofdletters → veldnaam", () => {
  assert.equal(pad("initiatief_gemeenten.gemeente.GemeenteGegevens.naam"), "initiatief_gemeenten.gemeente.gemeentegegevens.naam");
  assert.equal(pad("Producten.Naam"), "producten.naam");
  assert.equal(
    pad("initiatief_organisaties.organisatie.Organisatienaam.naam"),
    "initiatief_organisaties.organisatie.organisatienamen.naam"
  );
});

test("normaliseerPad: één eenduidige stap wordt ingevoegd", () => {
  // van de koppeling naar de gemeente
  assert.equal(
    pad("initiatief_gemeenten[rol=Realiseert].GemeenteGegevens.naam"),
    "initiatief_gemeenten[rol=Realiseert].gemeente.gemeentegegevens.naam"
  );
  // van de gemeente naar het enige GE met 'naam' (aanvang en gerelateerde_* tellen niet mee)
  assert.equal(pad("initiatief_gemeenten.gemeente.naam"), "initiatief_gemeenten.gemeente.gemeentegegevens.naam");
  assert.equal(pad("initiatief_gemeenten.gemeente.code"), "initiatief_gemeenten.gemeente.gemeentegegevens.code");
});

test("normaliseerPad: geen stap invoegen bij twijfel; onbekend → null", () => {
  // 'naam' staat bij Organisatie in twee GE's: niet raden
  assert.equal(pad("initiatief_organisaties.organisatie.naam"), null);
  assert.equal(pad("bestaat.niet"), null);
  assert.equal(pad("producten.naam.teveel"), null);
});

test("normaliseerTemplatePaden: placeholders en voorwaarden, onbekend → leeg/onwaar", () => {
  const t =
    "{{#if initiatief_gemeenten.GemeenteGegevens.naam}}G: {{initiatief_gemeenten[rol=Realiseert].gemeente.naam}}{{/if}}" +
    " {{bestaat.niet}}{{#unless bestaat.ook.niet}}x{{/unless}} {{producten.naam}}";
  const { template, onbekend } = normaliseerTemplatePaden(t, index, root);
  assert.equal(
    template,
    "{{#if initiatief_gemeenten.gemeente.gemeentegegevens.naam}}G: {{initiatief_gemeenten[rol=Realiseert].gemeente.gemeentegegevens.naam}}{{/if}}" +
      " {{#unless __onbekend}}x{{/unless}} {{producten.naam}}"
  );
  assert.deepEqual(onbekend, ["bestaat.niet", "bestaat.ook.niet"]);
});

test("normaliseerTemplatePaden: zonder schema ongewijzigd", () => {
  const t = "{{Wat.Dan.Ook}}";
  assert.deepEqual(normaliseerTemplatePaden(t, null, null), { template: t, onbekend: [] });
});
