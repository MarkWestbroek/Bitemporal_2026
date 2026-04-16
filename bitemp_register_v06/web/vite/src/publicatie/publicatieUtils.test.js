/**
 * publicatieUtils.test.js — unit tests voor de helperfuncties in publicatieUtils.js
 * Gedraaid met: node --test src/publicatie/publicatieUtils.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  parseSegment,
  segmentNaarString,
  resolveVeldpadUitContext,
  extractVeldpaden,
  buildSelectieTree,
  treeNaarGql,
  buildGraphQLQuery,
} from "./publicatieUtils.js";

// ─── parseSegment ─────────────────────────────────────────────────────────────

test("parseSegment: segment zonder filter", () => {
  const result = parseSegment("naam");
  assert.deepEqual(result, { key: "naam", filter: null });
});

test("parseSegment: segment met [key=value] filter", () => {
  const result = parseSegment("gemeenten[rol=Realiseert]");
  assert.deepEqual(result, {
    key: "gemeenten",
    filter: { veld: "rol", waarde: "Realiseert" },
  });
});

test("parseSegment: filter met spaties in waarde", () => {
  const result = parseSegment("initiatief_gemeenten[rol=Maakt gebruik van]");
  assert.deepEqual(result, {
    key: "initiatief_gemeenten",
    filter: { veld: "rol", waarde: "Maakt gebruik van" },
  });
});

test("parseSegment: openende bracket zonder sluiting → key is het geheel", () => {
  const result = parseSegment("gemeenten[kapot");
  assert.deepEqual(result, { key: "gemeenten[kapot", filter: null });
});

test("parseSegment: bracket zonder =-teken → filter is null", () => {
  const result = parseSegment("gemeenten[zonequals]");
  assert.deepEqual(result, { key: "gemeenten", filter: null });
});

// ─── segmentNaarString ────────────────────────────────────────────────────────

test("segmentNaarString: geen filter", () => {
  assert.equal(segmentNaarString({ key: "naam", filter: null }), "naam");
});

test("segmentNaarString: met filter", () => {
  assert.equal(
    segmentNaarString({ key: "gemeenten", filter: { veld: "rol", waarde: "Realiseert" } }),
    "gemeenten[rol=Realiseert]"
  );
});

// ─── resolveVeldpadUitContext ─────────────────────────────────────────────────

test("resolveVeldpadUitContext: eenvoudig veld", () => {
  const ctx = { naam: "Amsterdam" };
  assert.equal(resolveVeldpadUitContext(ctx, "naam"), "Amsterdam");
});

test("resolveVeldpadUitContext: genest object", () => {
  const ctx = { Naam: { roepnaam: "Jan" } };
  assert.equal(resolveVeldpadUitContext(ctx, "Naam.roepnaam"), "Jan");
});

test("resolveVeldpadUitContext: array → joined met komma", () => {
  const ctx = {
    gemeente_gegevens: [{ naam: "Amsterdam" }, { naam: "Utrecht" }],
  };
  assert.equal(
    resolveVeldpadUitContext(ctx, "gemeente_gegevens.naam"),
    "Amsterdam, Utrecht"
  );
});

test("resolveVeldpadUitContext: [key=value] filter op array", () => {
  const ctx = {
    gemeenten: [
      { rol: "Realiseert", weergavenaam: "Gemeente A" },
      { rol: "Subsidieert", weergavenaam: "Gemeente B" },
    ],
  };
  assert.equal(
    resolveVeldpadUitContext(ctx, "gemeenten[rol=Realiseert].weergavenaam"),
    "Gemeente A"
  );
});

test("resolveVeldpadUitContext: [key=value] filter — geen matches → null", () => {
  const ctx = {
    gemeenten: [{ rol: "Subsidieert", weergavenaam: "Gemeente B" }],
  };
  const result = resolveVeldpadUitContext(ctx, "gemeenten[rol=Realiseert].weergavenaam");
  assert.equal(result, null);
});

test("resolveVeldpadUitContext: data-skip als data niet bestaat (GraphQL flat)", () => {
  // In GraphQL-context is 'data' al afgevlakt, dus het segment wordt geskipt
  const ctx = { type: "Standaard" };
  assert.equal(resolveVeldpadUitContext(ctx, "data.type"), "Standaard");
});

test("resolveVeldpadUitContext: data-skip werkt niet als data wél bestaat (REST)", () => {
  const ctx = { data: { type: "Uitgebreid" } };
  assert.equal(resolveVeldpadUitContext(ctx, "data.type"), "Uitgebreid");
});

test("resolveVeldpadUitContext: ontbrekend veld → null", () => {
  const ctx = { naam: "X" };
  assert.equal(resolveVeldpadUitContext(ctx, "ontbreekt"), null);
});

test("resolveVeldpadUitContext: null context → null", () => {
  assert.equal(resolveVeldpadUitContext(null, "naam"), null);
});

test("resolveVeldpadUitContext: leeg veldpad → null", () => {
  assert.equal(resolveVeldpadUitContext({ naam: "X" }, ""), null);
});

test("resolveVeldpadUitContext: array met lege waarden gefilterd", () => {
  const ctx = { items: [{ naam: "A" }, { naam: null }, { naam: "B" }] };
  assert.equal(resolveVeldpadUitContext(ctx, "items.naam"), "A, B");
});

// ─── extractVeldpaden ─────────────────────────────────────────────────────────

test("extractVeldpaden: haalt alle unieke veldpaden op", () => {
  const template = "Naam: {{Naam.roepnaam}}, Gemeente: {{gemeente}}, ook {{Naam.roepnaam}}";
  const result = extractVeldpaden(template);
  assert.deepEqual(result.sort(), ["Naam.roepnaam", "gemeente"].sort());
});

test("extractVeldpaden: lege template → lege array", () => {
  assert.deepEqual(extractVeldpaden(""), []);
});

test("extractVeldpaden: geen placeholders → lege array", () => {
  assert.deepEqual(extractVeldpaden("Vaste tekst zonder placeholders."), []);
});

// ─── buildSelectieTree ────────────────────────────────────────────────────────

test("buildSelectieTree: enkelvoudig pad", () => {
  const tree = buildSelectieTree(["naam"]);
  assert.deepEqual(tree, { naam: {} });
});

test("buildSelectieTree: genest pad", () => {
  const tree = buildSelectieTree(["Naam.roepnaam", "Naam.achternaam"]);
  assert.deepEqual(tree, { Naam: { roepnaam: {}, achternaam: {} } });
});

test("buildSelectieTree: data-segment wordt geskipt", () => {
  const tree = buildSelectieTree(["producten.data.type"]);
  assert.deepEqual(tree, { producten: { type: {} } });
});

test("buildSelectieTree: filter-veld wordt toegevoegd aan subtree", () => {
  const tree = buildSelectieTree(["gemeenten[rol=Realiseert].weergavenaam"]);
  // 'rol' moet in de subtree staan zodat client-side filtering werkt
  assert.ok(tree.gemeenten?.rol !== undefined, "rol moet in gemeenten-subtree zitten");
  assert.ok(tree.gemeenten?.weergavenaam !== undefined);
});

// ─── buildGraphQLQuery ────────────────────────────────────────────────────────

test("buildGraphQLQuery: bevat padnaam en id", () => {
  const query = buildGraphQLQuery("{{naam}}", "gemeenten", 42);
  assert.ok(query.includes("full_gemeenten(id: 42)"), "query moet padnaam + id bevatten");
  assert.ok(query.includes("naam"), "query moet veldnaam bevatten");
  assert.ok(query.includes("id"), "id moet altijd aanwezig zijn");
});

test("buildGraphQLQuery: entiteitId als string wordt geconverteerd naar number", () => {
  const query = buildGraphQLQuery("{{naam}}", "gemeenten", "7");
  assert.ok(query.includes("id: 7"), "id moet als getal in query staan");
});
