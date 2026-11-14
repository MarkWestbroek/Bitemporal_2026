// Scenario's voor branch terugmergen (plan "2026-11-14 Branch terugmergen", stap 1 en 2; Mark 14-11:
// "een aantal standaard scenario's, standaard in de test").
//
// Anders dan server.test.mjs (één samenvoeging via HTTP) spelen deze tests **meerdere rondes** na,
// met de echte profielstores (materialiseer = dezelfde naspeelcode als de server gebruikt):
// afsplitsen, in MAIN en in de branch werken, gedeeltelijk samenvoegen, verder werken, opnieuw
// samenvoegen. Een kleine nagebootste server houdt per project een log van ops bij en doet na een
// samenvoeging wat de Go-handler doet: opsMain achter MAIN, opsTak achter de branch, en de
// samengevoegde stand wordt de nieuwe basis van de branch.
//
// Na elke samenvoeging controleert `voegSamen` (hieronder) altijd:
//   - MAIN nagespeeld = de basis die de sidecar teruggaf;
//   - wat er daarna nog verschilt, is precies wat het scenario verwacht (wat niet gekozen werd).
//
// Draaien: `npm test` in render-svc (bouwt eerst de bundel), of na `node bouw.mjs`:
//   node --test samenvoegScenario.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { samenvoegProjecten, vergelijkProjecten, materialiseer } from "./dist/studio-profielen.mjs";

const P = "diagram05";
const el = (id, naam, extra = {}) => ({ id, naam, elementType: "entiteit", compartimenten: [], data: {}, ...extra });
const kopie = (x) => structuredClone(x);

/** Het startproject: map Dienst met D, E, F, G, W en C, en één koppeling naar een BPMN-taak. */
function startProject() {
  const elementen = Object.fromEntries(["D", "E", "F", "G", "W", "C"].map((id) => [id, el(id, id)]));
  return {
    formaat: "studio-project",
    versie: 3,
    structuur: {
      mappen: { dienst: { id: "dienst", naam: "Dienst", ouderId: null } },
      plaatsing: Object.fromEntries(Object.keys(elementen).map((id) => [`el::${P}::${id}`, "dienst"])),
    },
    kruisverbanden: [],
    profielen: { [P]: { diagramTypeId: P, elements: elementen, diagrams: {}, meta: {} } },
  };
}

/** Een nagebootste server: logs per project, afsplitsen en samenvoegen zoals de Go-handler. */
function maakServer() {
  const project = (profiel) => ({ profiel, ops: [] });
  const main = project(startProject());
  let tak = null;
  let basis = null;
  const stand = (p) => {
    const m = materialiseer(p);
    assert.deepEqual(m.problemen, [], "naspelen zonder problemen");
    return m.werkbestand;
  };
  const voegToe = (p, ops) => {
    for (const o of ops) p.ops.push({ ...kopie(o), volgnummer: p.ops.length + 1 });
  };
  return {
    afsplitsen() {
      const nu = stand(main);
      tak = project(kopie(nu));
      basis = project(kopie(nu));
    },
    main: (...ops) => voegToe(main, ops),
    tak: (...ops) => voegToe(tak, ops),
    standMain: () => stand(main),
    standTak: () => stand(tak),
    /** Verschil zoals *Verschil met MAIN…* het toont: [sleutel, status], gesorteerd. */
    verschil() {
      const r = vergelijkProjecten({ basis, tak, main, mapId: "dienst" });
      return r.verschillen.map((v) => [v.sleutel, v.status]).sort((a, b) => a[0].localeCompare(b[0]));
    },
    /** Samenvoegen met een keuze. Bij conflicten of samenhang verandert er niets (zoals de API). */
    samenvoegen(keuze = null) {
      const r = samenvoegProjecten({ basis, tak, main, mapId: "dienst", keuze });
      if (r.conflicten.length || r.samenhang.length) return r;
      voegToe(main, r.opsMain);
      voegToe(tak, r.opsTak);
      basis = project(r.basis);
      assert.deepEqual(this.standMain().profielen, r.basis.profielen, "MAIN nagespeeld = de nieuwe basis");
      assert.deepEqual(this.standMain().structuur.mappen, r.basis.structuur.mappen);
      assert.deepEqual(this.standMain().structuur.plaatsing, r.basis.structuur.plaatsing);
      return r;
    },
  };
}

// Ops zoals de Studio ze stuurt.
const zet = (...elementen) => ({ store: `model:${P}`, op: "patchElementen", args: [{ zet: Object.fromEntries(elementen.map((e) => [e.id, e])), wis: [] }] });
const wis = (...ids) => ({ store: `model:${P}`, op: "patchElementen", args: [{ zet: {}, wis: ids }] });
const plaats = (id, mapId) => ({ store: "structuur", op: "patchStructuur", args: [{ zetPlaatsing: { [`el::${P}::${id}`]: mapId } }] });
const nieuweMap = (naam, ouderId, id) => ({ store: "structuur", op: "nieuweMap", args: [naam, ouderId, id] });
const koppel = (id, elementId) => ({ store: "kruis", op: "patchLinks", args: [{ zet: [{ id, rij: { profielId: P, elementId }, kolom: { profielId: "bpmnMotor05", elementId: "T" }, soort: "realiseert" }], wis: [] }] });
const S = (id) => `element:${P}:${id}`;
const naamIn = (stand, id) => stand.profielen[P].elements[id]?.naam;

test("scenario 1 — Marks voorbeeld in twee rondes: D mee, E (conflict) en F later, G en H van MAIN", () => {
  const s = maakServer();
  s.afsplitsen();
  s.tak(zet(el("D", "D'")), zet(el("E", "E'")), zet(el("F", "F'")));
  s.main(zet(el("E", "E(main)")), zet(el("G", "G'")));
  assert.deepEqual(s.verschil(), [[S("D"), "gewijzigd"], [S("E"), "conflict"], [S("F"), "gewijzigd"], [S("G"), "main"]]);

  // Ronde 1: alleen D. E is een conflict (standaard: MAIN houdt de zijne), F blijft liggen.
  s.samenvoegen({ [S("D")]: true, [S("E")]: false, [S("F")]: false });
  let m = s.standMain(), t = s.standTak();
  assert.deepEqual([naamIn(m, "D"), naamIn(m, "E"), naamIn(m, "F"), naamIn(m, "G")], ["D'", "E(main)", "F", "G'"]);
  assert.deepEqual([naamIn(t, "D"), naamIn(t, "E"), naamIn(t, "F"), naamIn(t, "G")], ["D'", "E'", "F'", "G'"], "de branch haalt G' op en houdt E' en F'");
  assert.deepEqual(s.verschil(), [[S("E"), "gewijzigd"], [S("F"), "gewijzigd"]], "E is nu een gewone wijziging t.o.v. de nieuwe basis");

  // Tussendoor werkt MAIN verder.
  s.main(zet(el("H", "H op MAIN")), plaats("H", "dienst"));
  assert.deepEqual(s.verschil(), [[S("E"), "gewijzigd"], [S("F"), "gewijzigd"], [S("H"), "main"]]);

  // Ronde 2: E mee (overschrijft MAIN), F terug naar MAIN.
  s.samenvoegen({ [S("E")]: true, [S("F")]: "terug" });
  m = s.standMain(); t = s.standTak();
  assert.equal(naamIn(m, "E"), "E'");
  assert.equal(naamIn(t, "F"), "F", "F teruggezet");
  assert.equal(naamIn(t, "H"), "H op MAIN");
  assert.deepEqual(s.verschil(), [], "branch en MAIN gelijk");
  assert.deepEqual(t.profielen, m.profielen);
});

test("scenario 2 — nieuw, weg en terugzetten (ook 'geen kleur')", () => {
  const s = maakServer();
  s.afsplitsen();
  s.tak(
    zet(el("N", "Nieuw")), plaats("N", "dienst"),
    wis("W"),
    zet(el("C", "C", { data: { kleur: "#e6efe1", beschrijving: "Dit is C" } })),
  );
  assert.deepEqual(s.verschil(), [[S("C"), "gewijzigd"], [S("N"), "nieuw"], [S("W"), "weg"]]);
  s.samenvoegen({ [S("N")]: true, [S("W")]: "terug", [S("C")]: "terug" });
  const m = s.standMain(), t = s.standTak();
  assert.equal(naamIn(m, "N"), "Nieuw");
  assert.equal(naamIn(m, "W"), "W", "W niet uit MAIN");
  assert.equal(naamIn(t, "W"), "W", "W terug in de branch");
  assert.deepEqual(t.profielen[P].elements.C.data, {}, "C zonder kleur en beschrijving, zoals op MAIN");
  assert.deepEqual(s.verschil(), []);
});

test("scenario 3 — weg mee naar MAIN; en een weggehaald element dat MAIN intussen wijzigde is een conflict", () => {
  const s = maakServer();
  s.afsplitsen();
  s.tak(wis("W"), wis("F"));
  s.main(zet(el("F", "F op MAIN")));
  assert.deepEqual(s.verschil(), [[S("F"), "conflict"], [S("W"), "weg"]]);
  // Zonder keuze (stap 1): het conflict blokkeert, er gebeurt niets.
  const geblokkeerd = s.samenvoegen();
  assert.equal(geblokkeerd.conflicten.length, 1);
  assert.equal(naamIn(s.standMain(), "W"), "W");
  // Met keuze: W weg uit MAIN, F: MAIN houdt de zijne, de branch blijft zonder F.
  s.samenvoegen({ [S("W")]: true, [S("F")]: false });
  assert.equal(naamIn(s.standMain(), "W"), undefined);
  assert.equal(naamIn(s.standMain(), "F"), "F op MAIN");
  assert.equal(naamIn(s.standTak(), "F"), undefined);
  assert.deepEqual(s.verschil(), [[S("F"), "weg"]], "het weghalen van F blijft als wijziging in de branch");
});

test("scenario 4 — samenhang: een relatie zonder haar bron mag niet; samen wel", () => {
  const s = maakServer();
  s.afsplitsen();
  s.tak(zet(el("H", "H")), plaats("H", "dienst"), zet(el("R", "gebruikt", { source: "H", target: "D" })));
  const fout = s.samenvoegen({ [S("H")]: false, [S("R")]: true });
  assert.deepEqual(fout.samenhang, [{ kant: "main", fout: `element ${P}/R: source H ontbreekt` }]);
  assert.equal(naamIn(s.standMain(), "R"), undefined, "niets geschreven");
  // H terugzetten (weg uit de branch) terwijl R blijft: ook stuk, nu in de branch.
  const fout2 = s.samenvoegen({ [S("H")]: "terug", [S("R")]: false });
  assert.deepEqual(fout2.samenhang, [{ kant: "tak", fout: `element ${P}/R: source H ontbreekt` }]);
  // Samen: goed.
  s.samenvoegen({ [S("H")]: true, [S("R")]: true });
  assert.equal(s.standMain().profielen[P].elements.R.source, "H");
  assert.deepEqual(s.verschil(), []);
});

test("scenario 5 — nieuwe submap en verplaatsen: de map hoort erbij", () => {
  const s = maakServer();
  s.afsplitsen();
  s.tak(nieuweMap("Stappen", "dienst", "stappen"), plaats("D", "stappen"));
  const v = s.verschil();
  assert.deepEqual(v, [[S("D"), "gewijzigd"], ["map::stappen", "nieuw"]], "verplaatsen is een wijziging van D");
  // D mee zonder de map: de plaatsing wijst naar een map die MAIN niet heeft.
  const fout = s.samenvoegen({ [S("D")]: true, "map::stappen": false });
  assert.deepEqual(fout.samenhang, [{ kant: "main", fout: `plaatsing el::${P}::D: map stappen ontbreekt` }]);
  // Map alleen: mag (een lege map), D blijft in de branch verplaatst.
  s.samenvoegen({ [S("D")]: false, "map::stappen": true });
  assert.equal(s.standMain().structuur.mappen.stappen.ouderId, "dienst");
  assert.equal(s.standMain().structuur.plaatsing[`el::${P}::D`], "dienst");
  assert.deepEqual(s.verschil(), [[S("D"), "gewijzigd"]]);
  // Volgende ronde: D erachteraan.
  s.samenvoegen({ [S("D")]: true });
  assert.equal(s.standMain().structuur.plaatsing[`el::${P}::D`], "stappen");
  assert.deepEqual(s.verschil(), []);
});

test("scenario 6 — koppeling tussen talen: niet zonder haar element; terugzetten haalt haar weg", () => {
  const s = maakServer();
  s.afsplitsen();
  s.tak(zet(el("N", "N")), plaats("N", "dienst"), koppel("K1", "N"));
  assert.deepEqual(s.verschil(), [[S("N"), "nieuw"], ["kruisverband::K1", "nieuw"]]);
  const fout = s.samenvoegen({ [S("N")]: false, "kruisverband::K1": true });
  assert.deepEqual(fout.samenhang, [{ kant: "main", fout: `koppeling K1: rij ${P}/N ontbreekt` }]);
  // Beide terug: de branch is weer zoals MAIN.
  s.samenvoegen({ [S("N")]: "terug", "kruisverband::K1": "terug" });
  assert.equal(naamIn(s.standTak(), "N"), undefined);
  assert.deepEqual(s.standTak().kruisverbanden, []);
  assert.deepEqual(s.verschil(), []);
});

test("scenario 7 — niets gekozen: alleen bijwerken; de branch haalt MAIN op en houdt zijn eigen werk", () => {
  const s = maakServer();
  s.afsplitsen();
  s.tak(zet(el("D", "D'")));
  s.main(zet(el("G", "G'")), wis("W"));
  const r = s.samenvoegen({ [S("D")]: false });
  assert.deepEqual(r.opsMain, [], "MAIN krijgt niets");
  const t = s.standTak();
  assert.equal(naamIn(t, "G"), "G'");
  assert.equal(naamIn(t, "W"), undefined, "ook een verwijdering op MAIN komt mee");
  assert.equal(naamIn(t, "D"), "D'");
  assert.deepEqual(s.verschil(), [[S("D"), "gewijzigd"]]);
});

test("scenario 8 — drie rondes met doorwerken aan beide kanten blijven kloppen", () => {
  const s = maakServer();
  s.afsplitsen();
  for (let ronde = 1; ronde <= 3; ronde += 1) {
    s.tak(zet(el("D", `D tak ${ronde}`)), zet(el(`T${ronde}`, `tak ${ronde}`)), plaats(`T${ronde}`, "dienst"));
    s.main(zet(el("G", `G main ${ronde}`)), zet(el(`M${ronde}`, `main ${ronde}`)), plaats(`M${ronde}`, "dienst"));
    // Om de beurt: D wel of niet mee; het nieuwe element van de tak altijd.
    const keuze = { [S("D")]: ronde !== 2, [S(`T${ronde}`)]: true };
    s.samenvoegen(keuze);
    const m = s.standMain(), t = s.standTak();
    for (let i = 1; i <= ronde; i += 1) {
      assert.equal(naamIn(m, `T${i}`), `tak ${i}`);
      assert.equal(naamIn(t, `M${i}`), `main ${i}`);
    }
    assert.equal(naamIn(t, "G"), `G main ${ronde}`);
    assert.equal(naamIn(m, "D"), ronde === 2 ? "D tak 1" : `D tak ${ronde}`);
    assert.deepEqual(s.verschil(), ronde === 2 ? [[S("D"), "gewijzigd"]] : []);
  }
});

test("scenario 9 — nieuw package met een diagram eronder (element als ouder in de boom): alleen samen", () => {
  const s = maakServer();
  s.afsplitsen();
  const diagram = (id, naam) => ({ store: `model:${P}`, op: "patchDiagrammen", args: [{ zet: { [id]: { id, naam, nodes: [], edges: [] } }, wis: [] }] });
  const plaatsOnder = (sleutel, ouderSleutel) => ({ store: "structuur", op: "patchStructuur", args: [{ zetPlaatsing: { [sleutel]: ouderSleutel } }] });
  s.tak(zet(el("PKG", "besluit")), plaats("PKG", "dienst"), diagram("DB", "Besluit"), plaatsOnder(`${P}::DB`, `el::${P}::PKG`));
  assert.deepEqual(s.verschil(), [[`diagram:${P}:DB`, "nieuw"], [S("PKG"), "nieuw"]], "beide in de map, niet 'buiten de map'");
  const r = vergelijkProjecten({ basis: { profiel: s.standMain() }, tak: { profiel: s.standTak() }, main: { profiel: s.standMain() }, mapId: "dienst" });
  assert.ok(r.verschillen.every((v) => v.inScope));
  const fout = s.samenvoegen({ [S("PKG")]: false, [`diagram:${P}:DB`]: true });
  assert.deepEqual(fout.samenhang, [{ kant: "main", fout: `plaatsing ${P}::DB: element ${P}/PKG ontbreekt` }]);
  s.samenvoegen({ [S("PKG")]: true, [`diagram:${P}:DB`]: true });
  assert.equal(s.standMain().structuur.plaatsing[`${P}::DB`], `el::${P}::PKG`);
  assert.deepEqual(s.verschil(), []);
});

test("scenario 10 — diagrambundel (Mark 14-11): zichtbaar en kiesbaar; niet zonder haar diagrammen", () => {
  const s = maakServer();
  s.afsplitsen();
  const diagram = (id, naam) => ({ store: `model:${P}`, op: "patchDiagrammen", args: [{ zet: { [id]: { id, naam, nodes: [], edges: [] } }, wis: [] }] });
  const bundel = (id, naam, diagramIds) => ({ store: "structuur", op: "patchStructuur", args: [{ zetMappen: {}, wisMappen: [], zetPlaatsing: {}, wisPlaatsing: [], zetBundels: { [id]: { id, naam, tabs: diagramIds.map((d) => ({ profielId: P, diagramId: d })) } }, wisBundels: [] }] });
  s.tak(diagram("DB", "Besluit"), { store: "structuur", op: "patchStructuur", args: [{ zetPlaatsing: { [`${P}::DB`]: "dienst" } }] }, bundel("B1", "Besluit en Evenement", ["DB"]));
  assert.deepEqual(s.verschil(), [["bundel::B1", "nieuw"], [`diagram:${P}:DB`, "nieuw"]], "de bundel staat in het verschil");
  // Bundel mee, diagram niet: de tab wijst naar niets.
  const fout = s.samenvoegen({ "bundel::B1": true, [`diagram:${P}:DB`]: false });
  assert.deepEqual(fout.samenhang, [{ kant: "main", fout: `bundel B1: diagram ${P}/DB ontbreekt` }]);
  // Diagram mee, bundel nog niet: mag; de bundel blijft in de branch.
  s.samenvoegen({ "bundel::B1": false, [`diagram:${P}:DB`]: true });
  assert.equal(s.standMain().structuur.bundels?.B1, undefined);
  assert.deepEqual(s.verschil(), [["bundel::B1", "nieuw"]]);
  // Volgende ronde: de bundel erbij.
  s.samenvoegen({ "bundel::B1": true });
  assert.equal(s.standMain().structuur.bundels.B1.naam, "Besluit en Evenement");
  assert.deepEqual(s.verschil(), []);
});
