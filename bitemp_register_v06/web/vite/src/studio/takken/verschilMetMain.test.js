import { test } from "node:test";
import assert from "node:assert/strict";
import { verschilMetMain, drieweg, verschillendeVelden, buitenScope } from "./verschilMetMain.js";

const kopie = (x) => structuredClone(x);

// Basis: map "dienst" (met submap "stappen") en map "cm"; element A en relatie R in "dienst", B in "cm".
const BASIS = {
  formaat: "studio-project",
  versie: 3,
  structuur: {
    mappen: {
      dienst: { id: "dienst", naam: "E-dienst GPK", ouderId: null },
      stappen: { id: "stappen", naam: "Stappen", ouderId: "dienst" },
      cm: { id: "cm", naam: "CM", ouderId: null },
    },
    plaatsing: {
      "el::uml::A": "dienst",
      "el::uml::B": "cm",
      "uml::D1": "dienst",
      "uml::D2": "cm",
    },
  },
  kruisverbanden: [{ id: "K1", rij: { profielId: "uml", elementId: "A" }, kolom: { profielId: "bpmn", elementId: "T" }, soort: "realiseert" }],
  profielen: {
    uml: {
      elements: {
        A: { id: "A", naam: "Aanvraag", data: { velden: 3, kleur: "blauw" } },
        B: { id: "B", naam: "Persoon", data: {} },
        R: { id: "R", naam: "aanvrager", source: "A", target: "B" },
      },
      diagrams: { D1: { id: "D1", naam: "Dienst", nodes: [] }, D2: { id: "D2", naam: "CM", nodes: [] } },
    },
    bpmn: { elements: { T: { id: "T", naam: "Beoordelen" } }, diagrams: {} },
  },
};

const vind = (r, id) => r.verschillen.find((v) => v.id === id);

test("drieweg: nieuw, gewijzigd, weg, alleen MAIN, conflict, gelijk aan beide kanten", () => {
  assert.equal(drieweg({ a: 1 }, { a: 1 }, { a: 1 }), null);
  assert.equal(drieweg(undefined, { a: 1 }, undefined).status, "nieuw");
  assert.deepEqual(drieweg({ a: 1 }, { a: 2 }, { a: 1 }), { status: "gewijzigd", velden: ["a"] });
  assert.equal(drieweg({ a: 1 }, undefined, { a: 1 }).status, "weg");
  assert.equal(drieweg({ a: 1 }, { a: 1 }, { a: 3 }).status, "main");
  assert.equal(drieweg({ a: 1 }, { a: 2 }, { a: 3 }).status, "conflict");
  assert.equal(drieweg({ a: 1 }, undefined, { a: 3 }).status, "conflict", "weg tegen gewijzigd");
  assert.equal(drieweg({ a: 1 }, { a: 2 }, { a: 2 }), null, "beide kanten hetzelfde");
});

test("verschillendeVelden splitst data uit", () => {
  assert.deepEqual(verschillendeVelden({ naam: "x", data: { a: 1, b: 2 } }, { naam: "y", data: { a: 1, b: 3 } }), ["data.b", "naam"]);
});

test("geen verschil als tak en MAIN gelijk zijn aan de basis", () => {
  const r = verschilMetMain({ basis: BASIS, tak: kopie(BASIS), main: kopie(BASIS), mapId: "dienst" });
  assert.deepEqual(r.verschillen, []);
  assert.deepEqual(r.telling, { nieuw: 0, gewijzigd: 0, weg: 0, conflict: 0, main: 0 });
  assert.deepEqual(r.scope.sort(), ["dienst", "stappen"]);
});

test("wijzigingen in de tak: nieuw in een submap, gewijzigd veld, relatie weg; scope via plaatsing en bron", () => {
  const tak = kopie(BASIS);
  tak.profielen.uml.elements.C = { id: "C", naam: "Bijlage" };
  tak.structuur.plaatsing["el::uml::C"] = "stappen";
  tak.profielen.uml.elements.A.data.velden = 4;
  delete tak.profielen.uml.elements.R;
  const r = verschilMetMain({ basis: BASIS, tak, main: kopie(BASIS), mapId: "dienst" });
  assert.deepEqual({ ...vind(r, "C") }, { soort: "element", profielId: "uml", id: "C", naam: "Bijlage", status: "nieuw", velden: ["map"], inScope: true });
  assert.equal(vind(r, "A").status, "gewijzigd");
  assert.deepEqual(vind(r, "A").velden, ["data.velden"]);
  assert.equal(vind(r, "R").status, "weg");
  assert.equal(vind(r, "R").inScope, true, "relatie volgt haar bron A");
  assert.deepEqual(buitenScope(r.verschillen), []);
});

test("MAIN-wijziging zonder tak-wijziging = 'main'; aan beide kanten anders = conflict", () => {
  const tak = kopie(BASIS), main = kopie(BASIS);
  main.profielen.uml.elements.B.naam = "Natuurlijk persoon"; // buiten de map, alleen MAIN
  tak.profielen.uml.elements.A.naam = "Aanvraag GPK";
  main.profielen.uml.elements.A.naam = "Aanvraag parkeerkaart";
  const r = verschilMetMain({ basis: BASIS, tak, main, mapId: "dienst" });
  assert.equal(vind(r, "B").status, "main");
  assert.equal(vind(r, "B").kant, "main");
  assert.equal(vind(r, "B").inScope, false);
  assert.equal(vind(r, "A").status, "conflict");
  assert.deepEqual(vind(r, "A").velden, ["naam"]);
  assert.equal(r.verschillen[0].id, "A", "conflicten eerst");
  assert.deepEqual(r.telling, { nieuw: 0, gewijzigd: 0, weg: 0, conflict: 1, main: 1 });
});

test("doel van een relatie op MAIN verwijderd: gemeld als 'main' (loshangend pas bij de merge, stap 2)", () => {
  const main = kopie(BASIS);
  delete main.profielen.uml.elements.B;
  delete main.structuur.plaatsing["el::uml::B"];
  const r = verschilMetMain({ basis: BASIS, tak: kopie(BASIS), main, mapId: "dienst" });
  assert.equal(vind(r, "B").status, "main");
  assert.equal(r.verschillen.filter((v) => v.id === "B").length, 1, "plaatsing en element samen één regel");
});

test("tak wijzigt buiten de scope: buitenScope meldt het", () => {
  const tak = kopie(BASIS);
  tak.profielen.uml.elements.B.naam = "Persoon (gewijzigd in de tak)";
  const r = verschilMetMain({ basis: BASIS, tak, main: kopie(BASIS), mapId: "dienst" });
  assert.deepEqual(buitenScope(r.verschillen).map((v) => v.id), ["B"]);
});

test("verplaatsen, diagram, map en kruisverband", () => {
  const tak = kopie(BASIS);
  tak.structuur.plaatsing["el::uml::A"] = "stappen"; // binnen de scope verplaatst
  tak.profielen.uml.diagrams.D1.nodes = [{ id: "n1", elementId: "A" }];
  tak.structuur.mappen.stappen.naam = "Processtappen";
  tak.kruisverbanden[0].soort = "gebruikt";
  const r = verschilMetMain({ basis: BASIS, tak, main: kopie(BASIS), mapId: "dienst" });
  assert.deepEqual(vind(r, "A").velden, ["map"]);
  assert.equal(vind(r, "A").status, "gewijzigd");
  assert.deepEqual({ status: vind(r, "D1").status, soort: vind(r, "D1").soort, inScope: vind(r, "D1").inScope }, { status: "gewijzigd", soort: "diagram", inScope: true });
  assert.deepEqual({ status: vind(r, "stappen").status, soort: vind(r, "stappen").soort, inScope: vind(r, "stappen").inScope }, { status: "gewijzigd", soort: "map", inScope: true });
  assert.deepEqual({ status: vind(r, "K1").status, inScope: vind(r, "K1").inScope, velden: vind(r, "K1").velden }, { status: "gewijzigd", inScope: true, velden: ["soort"] });
});

test("kind in de hiërarchie zonder eigen plaatsing volgt de boomouder (ouderVan)", () => {
  const tak = kopie(BASIS);
  tak.profielen.uml.elements.V = { id: "V", naam: "veld", data: { ouder: "A" } };
  const ouderVan = (pid, id, stand) => stand.profielen?.[pid]?.elements?.[id]?.data?.ouder || null;
  const zonder = verschilMetMain({ basis: BASIS, tak, main: kopie(BASIS), mapId: "dienst" });
  assert.equal(vind(zonder, "V").inScope, false);
  const met = verschilMetMain({ basis: BASIS, tak, main: kopie(BASIS), mapId: "dienst", ouderVan });
  assert.equal(vind(met, "V").inScope, true);
});
