// De simulatie op de GPK-casus, geijkt tegen de vijf scenario's uit
// cg-stack-voor-simulatie.md §8 (repo Fundament), en per soort einde een klein
// handgemaakt model. Ontwerp: docs/plans/2026-11-12 Simulatie van BPMN en DMN
// met cm-objecten.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { maakSimulatie } from "./simulatie.js";
import { spoorVan, objectenVanType, PROCESINSTANTIE } from "./store.js";
import { beschrijfM1Set, maakRun, verschilM1Set } from "./formaat.js";

const CG = new URL("../diagramprofielen/canoniek-uml/fixtures/cg-test/", import.meta.url);
const lees = (naam, basis = CG) => JSON.parse(fs.readFileSync(new URL(naam, basis), "utf8"));
const scenario = (nr) => lees(`./fixtures/gpk-scenario-${nr}.json`, import.meta.url);
const sha256Hex = (tekst) => crypto.createHash("sha256").update(tekst, "utf8").digest("hex");

const m1 = {
  cm: lees("inrichten-domeinen-v3.json"),
  proces: lees("inrichten-bpmn.bpmn-model.json"),
  beslissingen: [lees("gpk-beslissingen.dmn-model.json")],
  edienst: lees("gpk-edienst.json"),
};
const draai = (sc) => {
  const sim = maakSimulatie({ m1, scenario: sc });
  return { sim, stand: sim.loop(), t: sim.toestand() };
};
const einde = (stand, proces) => stand.eindes.find((e) => e.proces === proces)?.einde;

// ── De vijf scenario's ────────────────────────────────────────────────

for (const nr of [1, 2, 3]) {
  test(`GPK scenario ${nr}: niet ontvankelijk, geen zaak`, () => {
    const sc = scenario(nr);
    const { sim, stand, t } = draai(sc);
    assert.equal(stand.soort, "uitkomst");
    assert.deepEqual(stand.eindes, [{ proces: "aanvraag-oppakken", einde: sc.verwacht.einde }]);
    assert.deepEqual(t.variabelen.ontvankelijkheid, { ontvankelijk: false, reden: sc.verwacht.reden });
    assert.equal(t.objecten["aanvraag-1"].data.status, "nietInBehandeling");
    assert.deepEqual(t.extern, [], "geen zaak, rol of document");
    assert.equal(Object.values(t.gaten).length, 0, "geen gat nodig");
    assert.equal(objectenVanType(t, PROCESINSTANTIE).length, 1);
    assert.equal(sim.log.length, 6);
  });
}

test("GPK scenario 4: toegekend, drie processen, zonder stoppen", () => {
  const { sim, stand, t } = draai(scenario(4));
  assert.equal(stand.soort, "uitkomst");
  assert.equal(einde(stand, "aanvraag-oppakken"), "Aanvraag opgepakt");
  assert.equal(einde(stand, "gehandicaptenparkeerkaart-beoordelen"), "Beoordeling afgerond");
  assert.equal(einde(stand, "aanvraag-behandelen"), "Beschikt");

  // De objecten in de store met hun state.
  const aanvraag = t.objecten["aanvraag-1"];
  assert.equal(aanvraag.type, "GehandicaptenparkeerkaartAanvraag");
  assert.equal(aanvraag.data.beoordeling, "toegekend");
  assert.equal(aanvraag.data.beschikkingToelichting, "Kaart toegekend voor vijf jaar.");
  assert.equal(aanvraag.data.status, "ingediend", "de stack werkt de status van de aanvraag niet bij als hij wordt opgepakt");
  const instanties = objectenVanType(t, PROCESINSTANTIE);
  assert.deepEqual(instanties.map((i) => [i.data.proces, i.data.state]), [
    ["aanvraag-oppakken", "klaar"],
    ["aanvraag-behandelen", "klaar"],
    ["gehandicaptenparkeerkaart-beoordelen", "klaar"],
  ]);
  assert.ok(instanties.every((i) => i.data.sleutel === "aanvraag-1"), "één afhandeling, één sleutel");
  assert.deepEqual(t.variabelen.ontvankelijkheid, { ontvankelijk: true, reden: "" });
  assert.equal(t.variabelen.uitkomst, "toegekend");
  assert.deepEqual(t.tokens, {});

  // De ZGW-acties: buiten het cm, elk met een stub.
  assert.deepEqual(t.extern.map((e) => [e.actie, e.doel || null]), [
    ["zaakAanmaken", null],
    ["rolKoppelen", "Aanvrager"],
    ["documentKoppelen", null],
    ["zaakstatusZetten", "Ontvangen"],
  ]);
  assert.ok(t.extern.every((e) => /^https:\/\/stub\.example\//.test(e.verwijzing)));
  assert.equal(t.extern[2].voor, "https://stub.example/documenten/1", "multi-instance: één stap, een regel per document");

  // De volgorde van het log.
  const stappen = sim.log.map((r) => r.wat);
  const volgorde = ["Ontvankelijkheid toetsen", "Zaak aanmaken", "Status Ontvangen", "Aanvraag opgepakt", "Aanvraag beoordelen", "Uitkomst vastleggen", "Uitkomst beoordeling", "Stel beschikking op", "Beschikt"];
  let vanaf = 0;
  for (const naam of volgorde) {
    const i = stappen.indexOf(naam, vanaf);
    assert.ok(i >= vanaf, `"${naam}" staat op zijn plek in het log`);
    vanaf = i + 1;
  }
  assert.ok(!stappen.includes("Wijs af"));
  assert.deepEqual(sim.log.map((r) => r.nr), sim.log.map((_, i) => i + 1));
  const toets = sim.log.find((r) => r.wat === "Ontvankelijkheid toetsen");
  assert.equal(toets.beslissing.regel, "r_ok");
  assert.equal(toets.beslissing.invoer["Pasfoto bijgevoegd"], true);

  // Gaten: de wijze en de waarde staan in het log.
  const gaten = Object.values(t.gaten);
  assert.deepEqual(gaten.map((g) => [g.naam, g.aard, g.wijze]), [
    ["Zaak aanmaken", "dienst", "willekeurig"],
    ["Rol aanvrager koppelen", "dienst", "willekeurig"],
    ["Documenten koppelen", "dienst", "willekeurig"],
    ["Status Ontvangen", "dienst", "willekeurig"],
    ["Aanvraag beoordelen", "taak", "fixture"],
    ["Stel beschikking op", "taak", "fixture"],
  ]);
  const beoordelen = gaten.find((g) => g.naam === "Aanvraag beoordelen");
  assert.deepEqual(beoordelen.velden, [
    { naam: "beoordeling", type: "string", label: "Beoordeling", verplicht: true, keuzes: ["toegekend", "afgewezen", "aanvulling"] },
    { naam: "beoordelingToelichting", type: "string", label: "Toelichting bij de beoordeling" },
  ]);

  // Waarom heeft de aanvraag deze toestand?
  assert.deepEqual(spoorVan(sim.log, "aanvraag-1").map((r) => r.wat), [sim.log[0].wat, "Aanvraag beoordelen", "Stel beschikking op"]);
});

test("GPK scenario 4: terugspoelen geeft de toestand van dat moment, en de run is daarna gelijk", () => {
  const { sim } = draai(scenario(4));
  const heel = JSON.stringify(sim.log);
  const nr = sim.log.find((r) => r.wat === "Aanvraag beoordelen").nr;
  const toen = sim.toestand(nr - 1);
  assert.equal(toen.objecten["aanvraag-1"].data.beoordeling, undefined);
  assert.equal(toen.variabelen.uitkomst, undefined);
  assert.equal(toen.extern.length, 4);
  assert.equal(Object.values(toen.tokens).filter((k) => k.status === "klaar").length, 1);

  sim.spoelTerug(nr - 1);
  assert.equal(sim.log.length, nr - 1);
  assert.deepEqual(sim.toestand(), toen);
  assert.equal(sim.stand().soort, "loopt");
  sim.loop();
  assert.equal(JSON.stringify(sim.log), heel, "hetzelfde scenario geeft dezelfde run");
});

test("GPK scenario 5: een ronde aanvulling bij de klant, daarna afgewezen", () => {
  const { sim, stand, t } = draai(scenario(5));
  assert.equal(stand.soort, "uitkomst");
  assert.equal(einde(stand, "aanvraag-behandelen"), "Beschikt");
  const stappen = sim.log.map((r) => r.wat);
  assert.equal(stappen.filter((s) => s === "Aanvraag beoordelen").length, 2);
  assert.ok(stappen.includes("Wijs af") && !stappen.includes("Stel beschikking op"));
  assert.equal(objectenVanType(t, PROCESINSTANTIE).filter((i) => i.data.proces === "gehandicaptenparkeerkaart-beoordelen").length, 2);
  const gaten = Object.values(t.gaten);
  assert.deepEqual(gaten.filter((g) => g.naam === "Aanvraag beoordelen").map((g) => [g.bezoek, g.waarde.beoordeling]), [[1, "aanvulling"], [2, "afgewezen"]]);
  const klant = gaten.find((g) => g.naam === "Vraag aanvulling bij klant");
  assert.equal(klant.aard, "partner");
  assert.equal(klant.partner, "Klantportaal");
  assert.equal(t.objecten["aanvraag-1"].data.afwijzingReden, "Loopafstand groter dan 100 meter.");
  assert.equal(t.variabelen.uitkomst, "afgewezen");
});

// ── Vulwijze ──────────────────────────────────────────────────────────

test("vulwijze hand: de run stopt bij het gat en gaat verder als het gevuld is", () => {
  const sc = { ...scenario(4), vulwijze: { standaard: "fixture", perSoort: { dienst: "willekeurig" }, perGat: { "aanvraag-beoordelen": "hand" } } };
  const sim = maakSimulatie({ m1, scenario: sc });
  const stand = sim.loop();
  assert.equal(stand.soort, "gat");
  assert.equal(stand.gaten.length, 1);
  const gat = stand.gaten[0];
  assert.equal(gat.naam, "Aanvraag beoordelen");
  assert.equal(gat.formulier, "aanvraag-beoordelen");
  assert.throws(() => sim.vul(gat.id, { beoordeling: "misschien" }), /moet een van/);
  assert.throws(() => sim.vul(gat.id, {}), /verplicht/);
  sim.vul(gat.id, { beoordeling: "afgewezen" });
  assert.equal(sim.toestand().gaten[gat.id].wijze, "hand");
  // Het volgende gat (Wijs af) heeft geen antwoord in de fixture: terug naar met de hand.
  const daarna = sim.loop();
  assert.equal(daarna.soort, "gat");
  assert.equal(daarna.gaten[0].naam, "Wijs af");
  sim.vul(daarna.gaten[0].id, { afwijzingReden: "Niet aangetoond." });
  assert.equal(sim.loop().soort, "uitkomst");
});

test("vulwijze willekeurig: loopt zonder stoppen door en is met hetzelfde zaadje herhaalbaar", () => {
  const sc = (zaadje) => ({ ...scenario(4), antwoorden: {}, vulwijze: { standaard: "willekeurig" }, zaadje });
  const a = draai(sc(7));
  const b = draai(sc(7));
  assert.notEqual(a.stand.soort, "gat");
  assert.equal(JSON.stringify(a.sim.log), JSON.stringify(b.sim.log));
  const keuzes = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((z) => Object.values(draai(sc(z)).t.gaten).find((g) => g.naam === "Aanvraag beoordelen").waarde.beoordeling));
  assert.ok(keuzes.size > 1, "een ander zaadje kan een andere keuze geven");
});

// ── Kleine modellen: de soorten einde en de gaten ─────────────────────

let teller = 0;
/** Een klein BPMN-model: knopen [id, type, data?] en flows [van, naar, data?]; alles in één diagram. */
function model(knopen, flows, extra = {}) {
  const elements = {};
  for (const [id, elementType, data = {}] of knopen) elements[id] = { id, naam: id, elementType, compartimenten: [], data };
  for (const [source, target, data = {}] of flows) {
    const id = `f${++teller}`;
    elements[id] = { id, naam: data.naam || "", elementType: "sequence-flow", source, target, compartimenten: [], data };
  }
  Object.assign(elements, extra);
  const nodes = Object.values(elements).filter((e) => !e.source).map((e) => ({ elementId: e.id }));
  return { model: { elements, diagrams: { d: { id: "d", naam: "Proces", diagramType: "bpmn-motor", nodes, edges: [] } } } };
}
const klein = (proces, sc = {}) => maakSimulatie({ m1: { proces }, scenario: { ...sc, start: { type: "Ding", id: "ding", object: {}, ...sc.start } } });

test("einde: een parallelle samenkomst die nooit compleet wordt, loopt vast", () => {
  const sim = klein(
    model(
      [["start", "start-event"], ["splits", "exclusief"], ["a", "taak"], ["b", "taak"], ["samen", "parallel"], ["einde", "eind-event"]],
      [["start", "splits"], ["splits", "a", { conditie: "true" }], ["splits", "b", { standaard: true }], ["a", "samen"], ["b", "samen"], ["samen", "einde"]],
    ),
  );
  const stand = sim.loop();
  assert.equal(stand.soort, "vastgelopen");
  assert.equal(stand.tokens.length, 1);
  assert.equal(stand.tokens[0].naam, "samen");
  assert.equal(stand.tokens[0].wachtOp.soort, "samenkomst");
});

test("parallel: splitsen en samenkomen geeft een zakelijke uitkomst", () => {
  const sim = klein(
    model(
      [["start", "start-event"], ["splits", "parallel"], ["a", "taak"], ["b", "taak"], ["samen", "parallel"], ["einde", "eind-event"]],
      [["start", "splits"], ["splits", "a"], ["splits", "b"], ["a", "samen"], ["b", "samen"], ["samen", "einde"]],
    ),
  );
  assert.deepEqual(sim.loop(), { soort: "uitkomst", eindes: [{ proces: "proces", einde: "einde" }] });
});

test("einde: een fout-event breekt het verloop af", () => {
  const sim = klein(model([["start", "start-event"], ["splits", "parallel"], ["a", "taak", { taakSoort: "user" }], ["fout", "eind-event", { soort: "fout" }]], [["start", "splits"], ["splits", "a"], ["splits", "fout"]]));
  const stand = sim.loop();
  assert.deepEqual(stand, { soort: "uitzondering", bij: ["fout"] });
  assert.deepEqual(sim.toestand().tokens, {});
});

test("einde: een element dat de simulatie niet naspeelt, laat de run vastlopen met de reden", () => {
  const sim = klein(model([["start", "start-event"], ["of", "inclusief"], ["einde", "eind-event"]], [["start", "of"], ["of", "einde"]]));
  const stand = sim.loop();
  assert.equal(stand.soort, "vastgelopen");
  assert.match(stand.tokens[0].wachtOp.reden, /inclusief/);
});

test("gat: een conditie die niet te lezen is of een onbekende variabele noemt, vraagt het pad", () => {
  const proces = (conditie) =>
    model(
      [["start", "start-event"], ["keuze", "exclusief"], ["ja", "eind-event"], ["nee", "eind-event"]],
      [["start", "keuze"], ["keuze", "ja", { conditie, naam: "ja" }], ["keuze", "nee", { standaard: true, naam: "nee" }]],
    );
  for (const conditie of ["${empty x}", "onbekend == 'a'"]) {
    const sim = klein(proces(conditie));
    const stand = sim.loop();
    assert.equal(stand.soort, "gat", conditie);
    assert.equal(stand.gaten[0].aard, "expressie");
    assert.deepEqual(stand.gaten[0].velden[0].keuzes, ["ja", "nee"]);
    sim.vul(stand.gaten[0].id, { pad: "ja" });
    assert.deepEqual(sim.loop().eindes, [{ proces: "proces", einde: "ja" }]);
  }
  // CEL over het object en over een variabele; JUEL wordt gelezen door de haakjes eraf te halen.
  for (const conditie of ["kleur == 'rood'", "${kleur == 'rood'}", "aantal > 2"]) {
    const sim = klein(proces(conditie), { start: { object: { kleur: "rood" }, variabelen: { aantal: 3 } } });
    assert.deepEqual(sim.loop().eindes, [{ proces: "proces", einde: "ja" }], conditie);
  }
});

test("call activity: het aangeroepen proces is een eigen instantie; de ouder gaat verder als het klaar is", () => {
  const m = model(
    [["start", "start-event"], ["roep", "taak", { aangeroepenProces: "kind" }], ["einde", "eind-event"], ["kstart", "start-event"], ["kwerk", "taak", { taakSoort: "service", dossierstatus: "gedaan" }], ["keinde", "eind-event"]],
    [["start", "roep"], ["roep", "einde"], ["kstart", "kwerk"], ["kwerk", "keinde"]],
  );
  m.model.diagrams = {
    ouder: { id: "ouder", naam: "Ouder", nodes: ["start", "roep", "einde"].map((elementId) => ({ elementId })), edges: [] },
    kind: { id: "kind", naam: "Kind", nodes: ["kstart", "kwerk", "keinde"].map((elementId) => ({ elementId })), edges: [] },
  };
  const sim = klein(m, { start: { proces: "ouder" } });
  const stand = sim.loop();
  assert.deepEqual(stand.eindes, [{ proces: "ouder", einde: "einde" }, { proces: "kind", einde: "keinde" }]);
  assert.equal(sim.toestand().objecten.ding.data.status, "gedaan");
  const overgang = sim.log.flatMap((r) => r.wijzigingen).find((w) => w.soort === "overgang" && w.id === "ding");
  assert.deepEqual(overgang, { soort: "overgang", id: "ding", veld: "status", naar: "gedaan", van: null });
});

test("bericht: een vangend tussen-event wacht; zonder afzender loopt de run vast", () => {
  const sim = klein(model([["start", "start-event"], ["wacht", "tussen-event", { soort: "bericht", bericht: "antwoord" }], ["einde", "eind-event"]], [["start", "wacht"], ["wacht", "einde"]]));
  const stand = sim.loop();
  assert.equal(stand.soort, "vastgelopen");
  assert.deepEqual(stand.tokens[0].wachtOp, { soort: "bericht", naam: "antwoord" });
});

test("bericht: geworpen vóórdat iemand wacht, blijft liggen tot het vangende event het ophaalt", () => {
  const sim = klein(
    model(
      [["start", "start-event"], ["werp", "tussen-event", { soort: "bericht", richting: "werpt", bericht: "klaar" }], ["vang", "tussen-event", { soort: "bericht", bericht: "klaar" }], ["einde", "eind-event"]],
      [["start", "werp"], ["werp", "vang"], ["vang", "einde"]],
    ),
  );
  assert.equal(sim.loop().soort, "uitkomst");
  assert.deepEqual(sim.toestand().berichten, []);
});

test("start: het scenario kiest het proces; een proces dat op een bericht start, start alsof het bericht binnenkomt", () => {
  const drie = (proces) => draai({ ...scenario(4), start: { ...scenario(4).start, proces } });
  // Zonder e-dienstmodel is elk diagram met een startevent een proces, ook de schets "Kies zaak uit werkbak".
  const zonder = maakSimulatie({ m1: { ...m1, edienst: null }, scenario: { ...scenario(1), start: { ...scenario(1).start, proces: "aanvraag-oppakken" } } });
  assert.ok(zonder.processen.some((p) => p.id === "kies-zaak-uit-werkbak"));
  assert.deepEqual(zonder.loop().eindes, [{ proces: "aanvraag-oppakken", einde: "Aanvraag niet opgepakt" }]);
  // Op naam mag ook.
  assert.equal(einde(drie("Aanvraag oppakken").stand, "aanvraag-behandelen"), "Beschikt");
  // Het behandelproces start op een bericht; zelf gestart loopt het vast op de berichtnaam die het oppakken zou zetten.
  const behandelen = drie("aanvraag-behandelen");
  assert.equal(behandelen.sim.log[0].wat, 'Start: GehandicaptenparkeerkaartAanvraag bij "Behandeling gevraagd"');
  assert.equal(behandelen.stand.soort, "vastgelopen");
  assert.match(behandelen.stand.tokens[0].wachtOp.reden, /beoordelingsbericht/);
  // Met die variabele in het scenario loopt het door.
  const sc = scenario(4);
  const met = draai({ ...sc, start: { ...sc.start, proces: "aanvraag-behandelen", variabelen: { ...sc.start.variabelen, beoordelingsbericht: "gehandicaptenparkeerkaart-beoordelen-gevraagd" } } });
  assert.equal(einde(met.stand, "aanvraag-behandelen"), "Beschikt");
});

// ── Formaat ───────────────────────────────────────────────────────────

test("formaat: M1-set met hashes, run met log; een gewijzigd model is te zien", async () => {
  const m1set = await beschrijfM1Set(m1, sha256Hex);
  assert.deepEqual(m1set.delen.map((d) => d.rol), ["cm", "proces", "beslissingen", "edienst"]);
  assert.ok(m1set.delen.every((d) => /^[0-9a-f]{64}$/.test(d.hash) && d.naam));
  const sc = scenario(1);
  const { sim } = draai(sc);
  const run = maakRun({ scenario: sc, m1set, simulatie: sim });
  assert.equal(run.scenario, "GPK 1: zonder bsn");
  assert.equal(run.einde.soort, "uitkomst");
  assert.equal(run.log.length, 6);
  assert.doesNotThrow(() => JSON.stringify(run));

  const anders = JSON.parse(JSON.stringify(m1.proces));
  Object.values(anders.model.elements)[0].naam += " (gewijzigd)";
  assert.deepEqual(verschilM1Set(m1set, await beschrijfM1Set({ ...m1, proces: anders }, sha256Hex)), ["proces: Inrichten (bpmnMotor05)"]);
  assert.deepEqual(verschilM1Set(m1set, await beschrijfM1Set(m1, sha256Hex)), []);
});
