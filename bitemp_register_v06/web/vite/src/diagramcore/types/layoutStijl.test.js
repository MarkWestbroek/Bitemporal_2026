// layoutStijl.test.js — M3 betekenis (aard, facetten) en weergave (LayoutStijl) van de auto-layout.
// Run: node --import ./test/register-aliases.mjs --test src/diagramcore/types/layoutStijl.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { valideerAardEnFacetten, valideerLayoutStijl, regelsVoorStijl, stijlVoor, AARD_CONNECTOR, AARD_ELEMENT } from "./layoutStijl.js";
import { valideerDiagramType } from "./typeRegistry.js";

const con = (id, aard, extra = {}) => ({ id, label: id, isConnector: true, bron: { elementTypes: ["a"] }, doel: { elementTypes: ["a"] }, ...(aard ? { aard } : {}), ...extra });
const knoop = (id, extra = {}) => ({ id, label: id, ...extra });

/** Een klein stroomprofiel: begin → actie → eind, met notitie en generalisatie. */
const stroomProfiel = {
  id: "t-stroom",
  label: "T",
  style: "uml-klassiek",
  elementTypes: [
    knoop("a"), knoop("begin", { aard: "begin" }), knoop("eind", { aard: "eind" }), knoop("baan", { aard: "baan" }),
    con("flow", "stroom"), con("gen", "specialisatie"), con("noot", "annotatie"), con("msg", "bericht"), con("lid", "insluiting"), con("oud"), con("generalisatie"),
  ],
};
const sets = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Array.isArray(v) && typeof v[0] !== "object" ? [...v].sort() : v]));

test("aard bepaalt de standaard: stroom mee, specialisatie omgekeerd, bericht/annotatie negeer, zonder aard de oude ids", () => {
  const r = sets(regelsVoorStijl(stroomProfiel, { id: "s", renderer: "leesvolgorde" }));
  assert.deepEqual(r.stroom, ["flow", "gen", "generalisatie", "lid", "oud"]);
  assert.deepEqual(r.omgekeerd, ["gen", "generalisatie"], "zonder aard: het id 'generalisatie' leest nog omgekeerd");
  assert.deepEqual(r.negeer, ["msg", "noot"]);
  assert.deepEqual([r.start, r.eind, r.banen], [["begin"], ["eind"], ["baan"]]);
  assert.equal(r.richting, "TB");
});

test("alleenStroom: alleen aard stroom telt; regels kiezen zoals CSS (type-id wint van aard)", () => {
  const stijl = {
    id: "s", renderer: "leesvolgorde", richting: "LR", alleenStroom: true,
    regels: [
      { selector: { connectorType: "gen" }, opties: { volgorde: "omgekeerd" } },
      { selector: { aard: "specialisatie" }, opties: { volgorde: "negeer" } },
      { selector: { elementType: "a" }, opties: { positie: "begin" } },
      { selector: { aard: "begin" }, opties: { positie: null } },
    ],
  };
  const r = sets(regelsVoorStijl(stroomProfiel, stijl));
  assert.deepEqual(r.stroom, ["flow", "gen"], "gen via zijn id terug, ondanks alleenStroom en de aard-regel");
  assert.deepEqual(r.omgekeerd, ["gen"]);
  assert.deepEqual(r.start, ["a"], "de aard-regel haalt 'begin' weg, de type-regel zet 'a'");
  assert.equal(r.richting, "LR");
});

test("rijen per facet: lagen in de volgorde van DiagramType.facetten; erft-selector volgt de keten", () => {
  const dt = {
    id: "t-lagen", label: "T", style: "uml-klassiek",
    facetten: { laag: ["boven", "midden", "onder"] },
    elementTypes: [
      knoop("x", { facetten: { laag: "onder" } }), knoop("y", { facetten: { laag: "boven" } }),
      knoop("abstract", { isAbstract: true, facetten: { laag: "midden" } }), knoop("kind", { erft: "abstract", facetten: { laag: "midden" } }),
      knoop("los"),
      con("c", "associatie", { bron: { elementTypes: ["x"] }, doel: { elementTypes: ["y"] } }),
    ],
  };
  const stijl = { id: "lagen", renderer: "leesvolgorde", rijen: "laag", regels: [{ selector: { erft: "abstract" }, opties: { positie: "eind" } }] };
  const r = regelsVoorStijl(dt, stijl);
  assert.deepEqual(r.lagen, [["y"], ["kind"], ["x"]], "abstracte typen tellen niet; lege lagen vallen weg");
  assert.deepEqual(r.eind, ["kind"]);
  assert.deepEqual(valideerLayoutStijl(dt, stijl), []);
});

test("validatie: onbekende aard of facetwaarde, stijl met onbekende renderer/selector/optie", () => {
  const fout = {
    id: "t-fout", label: "T", style: "uml-klassiek",
    facetten: { laag: ["a"] },
    elementTypes: [knoop("p", { aard: "stroom" }), knoop("q", { facetten: { laag: "z", kleur: "rood" } }), con("c", "begin")],
  };
  const f = valideerAardEnFacetten(fout).join("\n");
  assert.match(f, /"p": onbekende aard "stroom" \(element/);
  assert.match(f, /"c": onbekende aard "begin" \(connector/);
  assert.match(f, /facet laag="z"/);
  assert.match(f, /facet "kleur" staat niet/);
  const s = valideerLayoutStijl(fout, { id: "s", renderer: "elk", richting: "XY", rijen: "aspect", regels: [{ selector: { soort: 1, elementType: "weg" }, opties: { kleur: 1 } }] }).join("\n");
  for (const stuk of [/renderer "elk"/, /richting "XY"/, /rijen "aspect"/, /selector "soort"/, /elementType "weg" bestaat niet/, /optie "kleur"/]) assert.match(s, stuk);
  assert.ok(valideerDiagramType({ ...fout, layoutStijlen: [{ id: "s", renderer: "elk" }] }).some((m) => /renderer "elk"/.test(m)), "registratie controleert mee");
  assert.ok(AARD_CONNECTOR.includes("stroom") && AARD_ELEMENT.includes("baan"));
});

test("stijlVoor: gekozen id, anders de eerste, anders de generieke standaard", () => {
  const dt = { layoutStijlen: [{ id: "een", renderer: "leesvolgorde" }, { id: "twee", renderer: "leesvolgorde" }] };
  assert.equal(stijlVoor(dt, "twee").id, "twee");
  assert.equal(stijlVoor(dt, "weg").id, "een");
  assert.equal(stijlVoor({}).id, "standaard");
});

test("valideerLayoutStijl: kaderKolommen geheel getal ≥ 1, secundairAchteraan ja/nee (18-10)", () => {
  const dt = { id: "t", elementTypes: [] };
  const basis = { id: "s", renderer: "leesvolgorde" };
  assert.deepEqual(valideerLayoutStijl(dt, { ...basis, kaderKolommen: 2, secundairAchteraan: true }), []);
  assert.equal(valideerLayoutStijl(dt, { ...basis, kaderKolommen: 0 }).length, 1);
  assert.equal(valideerLayoutStijl(dt, { ...basis, kaderKolommen: 1.5 }).length, 1);
  assert.equal(valideerLayoutStijl(dt, { ...basis, secundairAchteraan: "ja" }).length, 1);
});
