// klantDelta.test.js — klantaanpassing als delta op een basisversie (stap 8, Mark 22-11).
import test from "node:test";
import assert from "node:assert/strict";
import { maakDelta, pasDeltaToe, zetOpNieuweBasis, isLeeg, eenhedenVan } from "./klantDelta.js";

const el = (id, naam, data = {}) => ({ id, naam, elementType: "elementDef", compartimenten: [], data });

/** Een klein profielenproject: twee elementen, een diagram, een map met plaatsing. */
function basis() {
  return {
    formaat: "studio-project",
    versie: 4,
    project: { id: "omnium-sidecar", naam: "Profielen", soort: "profielen", versie: "1.0.0" },
    profielen: {
      m3Profiel05: {
        diagramTypeId: "profiel-ontwerp",
        meta: {},
        elements: { a: el("a", "Actor", { kleur: "#fff" }), b: el("b", "Use case", { kleur: "#eee" }) },
        diagrams: { d1: { id: "d1", naam: "UC", nodes: [{ elementId: "a" }, { elementId: "b" }] } },
      },
    },
    structuur: { mappen: { m1: { id: "m1", naam: "Profielen", ouderId: null } }, plaatsing: { "m3Profiel05::d1": "m1" }, plaatsingVolgorde: ["m3Profiel05::d1"] },
    kruisverbanden: [],
  };
}

test("maakDelta en pasDeltaToe: basis + delta = de klantversie", () => {
  const b = basis();
  const k = structuredClone(b);
  k.profielen.m3Profiel05.elements.a.data.kleur = "#f00"; // gewijzigd
  k.profielen.m3Profiel05.elements.c = el("c", "Systeem"); // nieuw
  delete k.profielen.m3Profiel05.elements.b; // weg
  k.structuur.mappen.m2 = { id: "m2", naam: "Klant", ouderId: "m1" };
  const delta = maakDelta(b, k, { soort: "profielen", basisVersie: "1.0.0" });
  assert.deepEqual(delta.eenheden.map((e) => `${e.soort}:${e.id}${e.weg ? " weg" : ""}`).sort(), ["element:a", "element:b weg", "element:c", "map:m2"]);
  const terug = pasDeltaToe(b, JSON.parse(JSON.stringify(delta)));
  assert.deepEqual(eenhedenVan(terug), eenhedenVan(k));
  assert.equal(b.profielen.m3Profiel05.elements.a.data.kleur, "#fff", "de basis blijft ongewijzigd");
  assert.ok(isLeeg(maakDelta(b, structuredClone(b), { soort: "profielen", basisVersie: "1.0.0" })));
});

test("op een nieuwe basis: past, botst en al opgenomen", () => {
  const oud = basis();
  const klant = structuredClone(oud);
  klant.profielen.m3Profiel05.elements.a.data.kleur = "#f00"; // botst: basis kiest #0f0
  klant.profielen.m3Profiel05.elements.b.naam = "Use case (klant)"; // past: basis liet b staan
  klant.profielen.m3Profiel05.elements.c = el("c", "Systeem"); // opgenomen: de basis voegt hem zelf toe
  const delta = maakDelta(oud, klant, { soort: "profielen", basisVersie: "1.0.0" });

  const nieuw = structuredClone(oud);
  nieuw.project.versie = "1.1.0";
  nieuw.profielen.m3Profiel05.elements.a.data.kleur = "#0f0";
  nieuw.profielen.m3Profiel05.elements.c = el("c", "Systeem");
  nieuw.profielen.m3Profiel05.elements.n = el("n", "Nieuw in de basis");

  const r = zetOpNieuweBasis({ oudeBasis: oud, nieuweBasis: nieuw, delta, nieuweVersie: "1.1.0" });
  const per = Object.fromEntries(r.uitkomsten.map((u) => [u.id, u.uitkomst]));
  assert.deepEqual(per, { a: "botst", b: "past", c: "opgenomen" });
  assert.deepEqual(r.telling, { past: 1, botst: 1, opgenomen: 1 });
  // Standaard wint bij een botsing de basis; de delta houdt alleen b.
  assert.deepEqual(r.delta.eenheden.map((e) => e.id), ["b"]);
  assert.equal(r.delta.basisVersie, "1.1.0");
  const kv = r.klantversie.profielen.m3Profiel05.elements;
  assert.equal(kv.a.data.kleur, "#0f0");
  assert.equal(kv.b.naam, "Use case (klant)");
  assert.ok(kv.n, "wat de basis toevoegt, krijgt de klant ook");

  // De klant wint bij de botsing: a blijft in de delta.
  const r2 = zetOpNieuweBasis({ oudeBasis: oud, nieuweBasis: nieuw, delta, nieuweVersie: "1.1.0", klantWint: true });
  assert.deepEqual(r2.delta.eenheden.map((e) => e.id).sort(), ["a", "b"]);
  assert.equal(r2.klantversie.profielen.m3Profiel05.elements.a.data.kleur, "#f00");
  assert.equal(r2.uitkomsten.find((u) => u.id === "a").gekozen, "klant");
});

test("per veld: klant en basis wijzigen verschillende velden van hetzelfde element → past", () => {
  const oud = basis();
  const klant = structuredClone(oud);
  klant.profielen.m3Profiel05.elements.a.data.kleur = "#f00";
  const nieuw = structuredClone(oud);
  nieuw.profielen.m3Profiel05.elements.a.naam = "Actor (hernoemd)";
  const delta = maakDelta(oud, klant, { soort: "profielen", basisVersie: "1.0.0" });
  const r = zetOpNieuweBasis({ oudeBasis: oud, nieuweBasis: nieuw, delta, nieuweVersie: "1.1.0" });
  assert.equal(r.uitkomsten[0].uitkomst, "past");
  const a = r.klantversie.profielen.m3Profiel05.elements.a;
  assert.equal(a.naam, "Actor (hernoemd)");
  assert.equal(a.data.kleur, "#f00");
});

test("als de basis alles overneemt, wordt de delta leeg", () => {
  const oud = basis();
  const klant = structuredClone(oud);
  klant.profielen.m3Profiel05.elements.b.naam = "Use case (klant)";
  const delta = maakDelta(oud, klant, { soort: "profielen", basisVersie: "1.0.0" });
  const r = zetOpNieuweBasis({ oudeBasis: oud, nieuweBasis: structuredClone(klant), delta, nieuweVersie: "1.1.0" });
  assert.ok(isLeeg(r.delta));
  assert.deepEqual(r.telling, { past: 0, botst: 0, opgenomen: 1 });
});

test("een element dat de klant weghaalde en dat de basis wijzigde, botst", () => {
  const oud = basis();
  const klant = structuredClone(oud);
  delete klant.profielen.m3Profiel05.elements.b;
  const nieuw = structuredClone(oud);
  nieuw.profielen.m3Profiel05.elements.b.naam = "Use case 2";
  const delta = maakDelta(oud, klant, { soort: "profielen", basisVersie: "1.0.0" });
  const r = zetOpNieuweBasis({ oudeBasis: oud, nieuweBasis: nieuw, delta, nieuweVersie: "1.1.0" });
  assert.equal(r.uitkomsten[0].uitkomst, "botst");
  assert.ok(r.klantversie.profielen.m3Profiel05.elements.b, "standaard wint de basis");
  const r2 = zetOpNieuweBasis({ oudeBasis: oud, nieuweBasis: nieuw, delta, nieuweVersie: "1.1.0", klantWint: { [r.uitkomsten[0].sleutel]: true } });
  assert.equal(r2.klantversie.profielen.m3Profiel05.elements.b, undefined);
});
