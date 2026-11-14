import { test } from "node:test";
import assert from "node:assert/strict";
import { voegSamen, voegMapSamen, opsVoorVerschil, samenhangFouten, nieuweSamenhangFouten, plaatsingSleutel } from "./samenvoegen.js";
import { verschilMetMain } from "./verschilMetMain.js";

const kopie = (x) => structuredClone(x);

// Het voorbeeld van Mark (14-11): de branch wijzigt D, E en F; MAIN wijzigt E en G.
const BASIS = {
  formaat: "studio-project",
  versie: 3,
  structuur: {
    mappen: { dienst: { id: "dienst", naam: "Dienst", ouderId: null } },
    plaatsing: { "el::uml::D": "dienst", "el::uml::E": "dienst", "el::uml::F": "dienst", "el::uml::G": "dienst" },
  },
  kruisverbanden: [{ id: "K1", rij: { profielId: "uml", elementId: "D" }, kolom: { profielId: "bpmn", elementId: "T" }, soort: "realiseert" }],
  profielen: {
    uml: {
      diagramTypeId: "uml",
      elements: {
        D: { id: "D", naam: "D" },
        E: { id: "E", naam: "E" },
        F: { id: "F", naam: "F" },
        G: { id: "G", naam: "G" },
      },
      diagrams: { D1: { id: "D1", naam: "Dienst", nodes: [] } },
    },
    bpmn: { diagramTypeId: "bpmn", elements: { T: { id: "T", naam: "Taak" } }, diagrams: {} },
  },
};

function maakTak() {
  const t = kopie(BASIS);
  t.profielen.uml.elements.D.naam = "D'";
  t.profielen.uml.elements.F.naam = "F'";
  t.profielen.uml.elements.H = { id: "H", naam: "nieuw in de tak" };
  t.structuur.plaatsing["el::uml::H"] = "dienst";
  t.kruisverbanden.push({ id: "K2", rij: { profielId: "uml", elementId: "H" }, kolom: { profielId: "bpmn", elementId: "T" }, soort: "gebruikt" });
  return t;
}
function maakMain() {
  const m = kopie(BASIS);
  m.profielen.uml.elements.G.naam = "G'";
  return m;
}

/** De ops naspelen op een kale kopie (zoals de stores ze toepassen; volstaat voor deze vormen). */
function speel(stand, ops) {
  const s = kopie(stand);
  for (const o of ops) {
    const a = o.args[0];
    if (o.store.startsWith("model:")) {
      const pid = o.store.slice(6);
      s.profielen[pid] ||= { elements: {}, diagrams: {} };
      const veld = o.op === "patchElementen" ? "elements" : "diagrams";
      s.profielen[pid][veld] = { ...s.profielen[pid][veld], ...a.zet };
      for (const id of a.wis) delete s.profielen[pid][veld][id];
    } else if (o.store === "structuur") {
      const st = s.structuur;
      st.mappen = { ...st.mappen, ...a.zetMappen };
      for (const id of a.wisMappen) delete st.mappen[id];
      st.plaatsing = { ...st.plaatsing, ...a.zetPlaatsing };
      for (const id of a.wisPlaatsing) delete st.plaatsing[id];
    } else if (o.store === "kruis" && o.op === "patchLinks") {
      const perId = new Map(s.kruisverbanden.map((x) => [x.id, x]));
      for (const id of a.wis) perId.delete(id);
      for (const x of a.zet) perId.set(x.id, x);
      s.kruisverbanden = [...perId.values()];
    } else if (o.store === "kruis" && o.op === "zetSoorten") s.koppelsoorten = a;
  }
  return s;
}

const inhoud = (w) => ({
  profielen: Object.fromEntries(Object.entries(w.profielen).map(([k, p]) => [k, { elements: p.elements, diagrams: p.diagrams }])),
  mappen: w.structuur.mappen,
  plaatsing: w.structuur.plaatsing,
  kruis: [...w.kruisverbanden].sort((a, b) => a.id.localeCompare(b.id)),
});

test("voegMapSamen: tak wint waar alleen de tak veranderde, MAIN blijft, conflict als beide anders", () => {
  const r = voegMapSamen({ a: 1, b: 1, c: 1, d: 1 }, { a: 2, b: 1, c: 5, x: 9 }, { a: 1, b: 3, c: 6, d: 1 });
  assert.deepEqual(r.uit, { a: 2, b: 3, c: 6, x: 9 }, "d is weg in de tak, x is nieuw, c blijft MAIN bij een conflict");
  assert.deepEqual(r.conflicten, ["c"]);
  assert.deepEqual(Object.keys(r.uit), ["a", "b", "c", "x"], "volgorde van MAIN, nieuw achteraan");
});

test("voegSamen: D', F', H en K2 uit de tak, G' van MAIN, geen conflict", () => {
  const { samengevoegd, conflicten } = voegSamen({ basis: BASIS, tak: maakTak(), main: maakMain() });
  assert.deepEqual(conflicten, []);
  const el = samengevoegd.profielen.uml.elements;
  assert.equal(el.D.naam, "D'");
  assert.equal(el.E.naam, "E");
  assert.equal(el.F.naam, "F'");
  assert.equal(el.G.naam, "G'");
  assert.equal(el.H.naam, "nieuw in de tak");
  assert.equal(samengevoegd.structuur.plaatsing["el::uml::H"], "dienst");
  assert.deepEqual(samengevoegd.kruisverbanden.map((x) => x.id).sort(), ["K1", "K2"]);
  assert.equal(samengevoegd.profielen.uml.diagramTypeId, "uml");
});

test("voegSamen: E aan beide kanten anders gewijzigd is een conflict", () => {
  const tak = maakTak();
  tak.profielen.uml.elements.E.naam = "E'";
  const main = maakMain();
  main.profielen.uml.elements.E.naam = "E(b)";
  const { conflicten, samengevoegd } = voegSamen({ basis: BASIS, tak, main });
  assert.deepEqual(conflicten, [{ soort: "element", profielId: "uml", id: "E" }]);
  assert.equal(samengevoegd.profielen.uml.elements.E.naam, "E(b)", "bij een conflict blijft MAIN staan");
});

test("voegSamen: weg in de tak gaat mee; weg tegen gewijzigd is een conflict", () => {
  const tak = maakTak();
  delete tak.profielen.uml.elements.F;
  delete tak.structuur.plaatsing["el::uml::F"];
  let r = voegSamen({ basis: BASIS, tak, main: maakMain() });
  assert.equal(r.samengevoegd.profielen.uml.elements.F, undefined);
  assert.equal(r.samengevoegd.structuur.plaatsing["el::uml::F"], undefined);
  const main = maakMain();
  main.profielen.uml.elements.F.naam = "F op MAIN";
  r = voegSamen({ basis: BASIS, tak, main });
  assert.deepEqual(r.conflicten.map((c) => c.id), ["F"]);
});

test("voegSamen: een profiel dat alleen in de tak bestaat komt mee, met zijn diagramTypeId", () => {
  const tak = maakTak();
  tak.profielen.dmn = { diagramTypeId: "dmnDrd", elements: { B1: { id: "B1", naam: "Besluit" } }, diagrams: {} };
  const { samengevoegd } = voegSamen({ basis: BASIS, tak, main: maakMain() });
  assert.equal(samengevoegd.profielen.dmn.diagramTypeId, "dmnDrd");
  assert.equal(samengevoegd.profielen.dmn.elements.B1.naam, "Besluit");
});

test("opsVoorVerschil: MAIN + ops = samengevoegd, en tak + ops = samengevoegd (bijwerken)", () => {
  const tak = maakTak(), main = maakMain();
  const { samengevoegd } = voegSamen({ basis: BASIS, tak, main });
  const opsMain = opsVoorVerschil(main, samengevoegd);
  const opsTak = opsVoorVerschil(tak, samengevoegd);
  assert.deepEqual(inhoud(speel(main, opsMain)), inhoud(samengevoegd));
  assert.deepEqual(inhoud(speel(tak, opsTak)), inhoud(samengevoegd));
  // Naar MAIN gaan alleen de eenheden uit de tak: D, F, H; G blijft (die is al van MAIN).
  const elOp = opsMain.find((o) => o.store === "model:uml" && o.op === "patchElementen");
  assert.deepEqual(Object.keys(elOp.args[0].zet).sort(), ["D", "F", "H"]);
  // Naar de tak gaat alleen G' (de branch haalt MAIN op).
  const elTak = opsTak.find((o) => o.store === "model:uml" && o.op === "patchElementen");
  assert.deepEqual(Object.keys(elTak.args[0].zet), ["G"]);
  assert.ok(!opsTak.some((o) => o.store === "kruis"), "de kruisverbanden van de tak zijn al goed");
});

test("na de merge is er geen verschil meer met het samengevoegde als nieuwe basis", () => {
  const tak = maakTak(), main = maakMain();
  const { samengevoegd } = voegSamen({ basis: BASIS, tak, main });
  const nieuweTak = speel(tak, opsVoorVerschil(tak, samengevoegd));
  const nieuweMain = speel(main, opsVoorVerschil(main, samengevoegd));
  const r = verschilMetMain({ basis: samengevoegd, tak: nieuweTak, main: nieuweMain, mapId: "dienst" });
  assert.deepEqual(r.verschillen, []);
});

test("opsVoorVerschil: niets te doen geeft geen ops; splits wordt gebruikt", () => {
  assert.deepEqual(opsVoorVerschil(BASIS, kopie(BASIS)), []);
  const tak = maakTak();
  let n = 0;
  const ops = opsVoorVerschil(BASIS, tak, { splits: (p) => { n += 1; return [p]; } });
  assert.ok(n >= 1);
  assert.ok(ops.some((o) => o.op === "patchStructuur"));
});

// ── Stap 2: keuze per eenheid (14-11) ──────────────────────────────────────────────────────────

test("keuze: D mee, F niet; MAIN krijgt D', de branch houdt F' en krijgt G'", () => {
  const tak = maakTak(), main = maakMain();
  const keuze = { "element:uml:D": true, "element:uml:F": false };
  const { samengevoegd, nieuwTak, conflicten } = voegSamen({ basis: BASIS, tak, main, keuze });
  assert.deepEqual(conflicten, []);
  const m = samengevoegd.profielen.uml.elements, t = nieuwTak.profielen.uml.elements;
  assert.equal(m.D.naam, "D'");
  assert.equal(m.F.naam, "F", "niet gekozen: MAIN houdt zijn versie");
  assert.equal(m.H.naam, "nieuw in de tak", "niet in de keuze en geen conflict: mee");
  assert.equal(t.F.naam, "F'", "de branch houdt wat niet gekozen werd");
  assert.equal(t.G.naam, "G'", "de branch haalt MAIN op");
  assert.equal(t.D.naam, "D'");
  // Ops: MAIN + opsMain = samengevoegd; tak + opsTak = nieuwTak.
  assert.deepEqual(inhoud(speel(main, opsVoorVerschil(main, samengevoegd))), inhoud(samengevoegd));
  assert.deepEqual(inhoud(speel(tak, opsVoorVerschil(tak, nieuwTak))), inhoud(nieuwTak));
  // Volgende vergelijking (basis = samengevoegd): alleen F staat nog open, als wijziging in de branch.
  const r = verschilMetMain({ basis: samengevoegd, tak: nieuwTak, main: samengevoegd, mapId: "dienst" });
  assert.deepEqual(r.verschillen.map((v) => [v.sleutel, v.status]), [["element:uml:F", "gewijzigd"]]);
});

test("keuze bij een conflict: aan = de branch wint, uit = MAIN houdt (en de branch de zijne)", () => {
  const tak = maakTak();
  tak.profielen.uml.elements.E.naam = "E'";
  const main = maakMain();
  main.profielen.uml.elements.E.naam = "E(b)";
  let r = voegSamen({ basis: BASIS, tak, main, keuze: { "element:uml:E": true } });
  assert.deepEqual(r.conflicten, [{ soort: "element", profielId: "uml", id: "E", gekozen: "tak" }]);
  assert.equal(r.samengevoegd.profielen.uml.elements.E.naam, "E'");
  r = voegSamen({ basis: BASIS, tak, main, keuze: {} });
  assert.deepEqual(r.conflicten, [{ soort: "element", profielId: "uml", id: "E", gekozen: "main" }], "ontbreekt in de keuze: MAIN");
  assert.equal(r.samengevoegd.profielen.uml.elements.E.naam, "E(b)");
  assert.equal(r.nieuwTak.profielen.uml.elements.E.naam, "E'");
});

test("keuze: een verplaatsing hoort bij haar element; een nieuw element zonder keuze voor zijn plaatsing", () => {
  assert.equal(plaatsingSleutel("el::uml::H"), "element:uml:H");
  assert.equal(plaatsingSleutel("uml::D1"), "diagram:uml:D1");
  const tak = maakTak();
  const { samengevoegd, nieuwTak } = voegSamen({ basis: BASIS, tak, main: maakMain(), keuze: { "element:uml:H": false, "kruisverband::K2": false } });
  assert.equal(samengevoegd.profielen.uml.elements.H, undefined);
  assert.equal(samengevoegd.structuur.plaatsing["el::uml::H"], undefined, "de plaatsing volgt het element");
  assert.equal(nieuwTak.structuur.plaatsing["el::uml::H"], "dienst");
  assert.deepEqual(samengevoegd.kruisverbanden.map((x) => x.id), ["K1"]);
  assert.deepEqual(nieuwTak.kruisverbanden.map((x) => x.id).sort(), ["K1", "K2"]);
});

test("samenhang: een relatie zonder haar doel is een nieuwe fout; bestaande losse eindjes tellen niet", () => {
  const tak = maakTak();
  tak.profielen.uml.elements.R = { id: "R", naam: "gebruikt", source: "H", target: "D" };
  // Alleen R kiezen, H niet: in MAIN wijst R dan naar een H die er niet is.
  const keuze = { "element:uml:H": false, "kruisverband::K2": false, "element:uml:R": true };
  const { samengevoegd } = voegSamen({ basis: BASIS, tak, main: maakMain(), keuze });
  assert.deepEqual(nieuweSamenhangFouten(samengevoegd, maakMain(), tak), ["element uml/R: source H ontbreekt"]);
  // H erbij: geen fout.
  const ok = voegSamen({ basis: BASIS, tak, main: maakMain(), keuze: { ...keuze, "element:uml:H": true } });
  assert.deepEqual(nieuweSamenhangFouten(ok.samengevoegd, maakMain(), tak), []);
  // Een los eindje dat MAIN al had, telt niet.
  const main = maakMain();
  main.profielen.uml.elements.X = { id: "X", source: "bestaat-niet", target: "D" };
  assert.equal(samenhangFouten(main).length, 1);
  assert.deepEqual(nieuweSamenhangFouten(main, main), []);
});

test("samenhang: diagram-node, kruisverband en plaatsing naar iets wat er niet is", () => {
  const s = kopie(BASIS);
  s.profielen.uml.diagrams.D1.nodes = [{ elementId: "weg" }];
  s.kruisverbanden.push({ id: "K9", rij: { profielId: "uml", elementId: "weg" }, kolom: { profielId: "bpmn", elementId: "T" } });
  s.structuur.plaatsing["el::uml::D"] = "geen-map";
  assert.deepEqual(samenhangFouten(s), [
    "diagram uml/D1: element weg ontbreekt",
    "koppeling K9: rij uml/weg ontbreekt",
    "plaatsing el::uml::D: map geen-map ontbreekt",
  ]);
});

test("verschilMetMain: sleutel, map en ouder (relatie onder haar bron), en de mappen", () => {
  const tak = maakTak();
  tak.profielen.uml.elements.R = { id: "R", naam: "gebruikt", source: "H", target: "D" };
  const r = verschilMetMain({ basis: BASIS, tak, main: maakMain(), mapId: "dienst" });
  const R = r.verschillen.find((v) => v.id === "R");
  assert.equal(R.sleutel, "element:uml:R");
  assert.equal(R.ouderId, "H");
  assert.equal(R.mapId, "dienst", "een relatie ligt in de map van haar bron");
  assert.equal(r.verschillen.find((v) => v.id === "K2").sleutel, "kruisverband::K2");
  assert.deepEqual(r.mappen, { dienst: { id: "dienst", naam: "Dienst", ouderId: null } });
});

test("terug: de branch neemt de versie van MAIN letterlijk over (ook 'geen kleur'); niets naar MAIN", () => {
  // Mark 14-11: per ongeluk een kleur gewijzigd. MAIN heeft data {}, de branch een expliciete kleur.
  const basis = kopie(BASIS);
  basis.profielen.uml.elements.C = { id: "C", naam: "C", data: {} };
  const tak = kopie(basis);
  tak.profielen.uml.elements.C.data = { kleur: "#e6efe1", beschrijving: "Dit is C" };
  tak.profielen.uml.elements.N = { id: "N", naam: "alleen in de branch" };
  delete tak.profielen.uml.elements.F;
  const main = kopie(basis);
  const keuze = { "element:uml:C": "terug", "element:uml:N": "terug", "element:uml:F": "terug" };
  const { samengevoegd, nieuwTak } = voegSamen({ basis, tak, main, keuze });
  assert.deepEqual(samengevoegd.profielen.uml.elements, main.profielen.uml.elements, "MAIN verandert niet");
  assert.deepEqual(nieuwTak.profielen.uml.elements.C, { id: "C", naam: "C", data: {} }, "geen kleur, geen beschrijving");
  assert.equal(nieuwTak.profielen.uml.elements.N, undefined, "alleen in de branch: weg");
  assert.equal(nieuwTak.profielen.uml.elements.F.naam, "F", "in de branch verwijderd: terug");
  assert.deepEqual(opsVoorVerschil(main, samengevoegd), []);
  assert.deepEqual(inhoud(speel(tak, opsVoorVerschil(tak, nieuwTak))), inhoud(nieuwTak));
  // Daarna geen verschil meer.
  assert.deepEqual(verschilMetMain({ basis: samengevoegd, tak: nieuwTak, main: samengevoegd }).verschillen, []);
});

test("terug bij een conflict: MAIN wint aan beide kanten", () => {
  const tak = maakTak();
  tak.profielen.uml.elements.E.naam = "E'";
  const main = maakMain();
  main.profielen.uml.elements.E.naam = "E(b)";
  const r = voegSamen({ basis: BASIS, tak, main, keuze: { "element:uml:E": "terug" } });
  assert.equal(r.samengevoegd.profielen.uml.elements.E.naam, "E(b)");
  assert.equal(r.nieuwTak.profielen.uml.elements.E.naam, "E(b)");
  assert.deepEqual(r.conflicten, [{ soort: "element", profielId: "uml", id: "E", gekozen: "main" }]);
});
