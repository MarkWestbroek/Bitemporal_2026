import { test } from "node:test";
import assert from "node:assert/strict";
import { profielSamenvatting, vraagVoorOpdracht, controleerPlan, leesAntwoord, vraagVoorVelden, veldenToepassing, veldCompartimenten, genoemdeTalen } from "./assistentKern.js";
import { maakWijziging, naarOps } from "./wijziging.js";

// Zoals diagramprofielen/usecase (de verbindingsregels en aanwijzingen die ertoe doen).
const useCaseDescriptor = {
  id: "usecase",
  label: "Use case",
  assistent: { aanwijzingen: ["Een associatie verbindt een actor met een use case."], paren: { associatie: [["actor", "usecase"]] } },
  elementTypes: [
    { id: "actor", label: "Actor", resizebaar: false },
    { id: "usecase", label: "Use case", omschrijving: "iets wat een actor met het systeem doet" },
    { id: "systeem", label: "Systeemkader", containerVoor: "bevat" },
    { id: "notitie", label: "Notitie" },
    { id: "associatie", label: "Associatie", isConnector: true, bron: { elementTypes: ["actor", "usecase"] }, doel: { elementTypes: ["actor", "usecase"] } },
    { id: "extend", label: "Extend", isConnector: true, bron: { elementTypes: ["usecase"] }, doel: { elementTypes: ["usecase"] }, properties: [{ key: "voorwaarde" }] },
    { id: "notitielijn", label: "Notitie-lijn", isConnector: true, bron: { elementTypes: ["notitie"] }, doel: { elementTypes: ["actor"] } },
    { id: "bevat", label: "Bevat", isConnector: true, bron: { elementTypes: ["systeem"] }, doel: { elementTypes: ["usecase", "systeem"] } },
  ],
};
const activityDescriptor = {
  id: "activity",
  label: "Activity",
  elementTypes: [
    { id: "begin", label: "Begin", resizebaar: false },
    { id: "actie", label: "Actie" },
    { id: "eind", label: "Eind", resizebaar: false },
    { id: "controlestroom", label: "Controlestroom", isConnector: true, bron: { elementTypes: ["begin", "actie"] }, doel: { elementTypes: ["actie", "eind"] }, properties: [{ key: "guard" }] },
  ],
};
const uc = profielSamenvatting(useCaseDescriptor, "usecase05");
const ad = profielSamenvatting(activityDescriptor, "activity05");

test("profielSamenvatting: data, zonder notitie en zonder de lidmaatschap-connector", () => {
  assert.equal(uc.id, "usecase05");
  assert.equal(uc.diagramTypeId, "usecase");
  assert.deepEqual(uc.elementen.map((e) => e.id), ["actor", "usecase", "systeem"]);
  assert.deepEqual(uc.elementen.find((e) => e.id === "systeem"), { id: "systeem", label: "Systeemkader", container: "bevat", leden: ["usecase", "systeem"] });
  assert.equal(uc.elementen.find((e) => e.id === "actor").vast, true);
  assert.deepEqual(uc.connectoren.map((c) => c.id), ["associatie", "extend"]);
  assert.deepEqual(uc.connectoren.find((c) => c.id === "extend").eigenschappen, ["voorwaarde"]);
  assert.deepEqual(uc.paren, { associatie: [["actor", "usecase"]] });
  assert.doesNotThrow(() => JSON.stringify(uc));
});

test("genoemdeTalen: 'met een activiteitendiagram' haalt Activity erbij", () => {
  assert.deepEqual(genoemdeTalen("Maak een use case met een activiteitendiagram eronder", [uc, ad]), ["usecase05", "activity05"]);
  assert.deepEqual(genoemdeTalen("voeg een actor toe", [uc, ad]), []);
});

const bestaand = [{
  profielId: "usecase05",
  diagrammen: [{ id: "d_uc", naam: "Use case model" }],
  elementen: [{ id: "e_gebr", type: "actor", naam: "gebruiker", diagrammen: ["d_uc"] }, { id: "e_test", type: "usecase", naam: "test", diagrammen: ["d_uc"] }],
  relaties: [],
}];

test("vraagVoorOpdracht: talen, aanwijzingen, wat er al is en de vorm", () => {
  const v = vraagVoorOpdracht([uc, ad], "verbind gebruiker en test", { mapNaam: "Test", submappen: ["Oud"], bestaand });
  assert.match(v.systeem, /## usecase05 — Use case/);
  assert.match(v.systeem, /## activity05 — Activity/);
  assert.match(v.systeem, /- associatie: Associatie — actor → usecase/);
  assert.match(v.systeem, /systeem: Systeemkader \(container: usecase, systeem kunnen erin liggen/);
  assert.match(v.systeem, /Een associatie verbindt een actor met een use case\./);
  assert.match(v.systeem, /element e_gebr: actor "gebruiker" op d_uc/);
  assert.match(v.systeem, /map "Test"; submappen: "Oud"/);
  assert.deepEqual(v.jsonSchema.required, ["uitleg", "diagrammen", "elementen", "connectoren"]);
});

test("controleerPlan: relatie tussen bestaande elementen, omgekeerde associatie wordt gedraaid", () => {
  const r = controleerPlan({ uitleg: "ok", diagrammen: [], elementen: [], connectoren: [{ type: "associatie", bron: "e_test", doel: "e_gebr" }] }, [uc], bestaand);
  assert.deepEqual(r.problemen, []);
  assert.equal(r.connectoren.length, 1);
  assert.deepEqual([r.connectoren[0].bron, r.connectoren[0].doel], [{ id: "e_gebr" }, { id: "e_test" }]);
  assert.match(r.opmerkingen[0], /omgedraaid/);
});

test("controleerPlan: verzonnen type, actor–actor, zelfrelatie, onbekend id en lege diagrammen eruit", () => {
  const r = controleerPlan({
    uitleg: "x",
    diagrammen: [{ sleutel: "d1", taal: "usecase05", naam: "UC" }, { sleutel: "d9", taal: "usecase05", naam: "Leeg" }, { sleutel: "dx", taal: "bestaatniet", naam: "?" }],
    elementen: [
      { sleutel: "a1", type: "actor", naam: "Lid", diagram: "d1" },
      { sleutel: "u1", type: "usecase", naam: "Leen boek", diagram: "d1" },
      { sleutel: "k1", type: "klasse", naam: "Verzonnen", diagram: "d1" },
    ],
    connectoren: [
      { type: "associatie", bron: "a1", doel: "u1" },
      { type: "associatie", bron: "a1", doel: "e_gebr" },
      { type: "extend", bron: "u1", doel: "u1" },
      { type: "associatie", bron: "a1", doel: "zz" },
      { type: "associatie", bron: "a1", doel: "u1" },
    ],
  }, [uc], bestaand);
  assert.deepEqual(r.elementen.map((e) => e.sleutel), ["a1", "u1"]);
  assert.equal(r.connectoren.length, 1);
  const p = r.problemen.join(" | ");
  assert.match(p, /bestaatniet/);
  assert.match(p, /klasse.*bestaat niet/);
  assert.match(p, /tussen actor en actor/);
  assert.match(p, /naar zichzelf/);
  assert.match(p, /onbekende elementen/);
  assert.match(p, /"Leeg" blijft leeg/);
  assert.deepEqual(r.diagrammen.map((d) => d.sleutel), ["d1"]);
});

test("wijziging: relatie tussen bestaande elementen → alleen de connector, geen diagram", () => {
  const stand = {
    mappen: { m1: { id: "m1", naam: "Test", ouderId: null } },
    plaatsing: { "usecase05::d_uc": "m1" },
    profielen: {
      usecase05: {
        elements: { e_gebr: { id: "e_gebr", naam: "gebruiker", elementType: "actor" }, e_test: { id: "e_test", naam: "test", elementType: "usecase" } },
        diagrams: { d_uc: { id: "d_uc", naam: "Use case model", nodes: [{ elementId: "e_gebr", position: { x: 0, y: 100 } }, { elementId: "e_test", position: { x: 200, y: 0 } }] } },
      },
    },
  };
  const plan = controleerPlan({ uitleg: "", diagrammen: [], elementen: [], connectoren: [{ type: "associatie", bron: "e_gebr", doel: "e_test" }] }, [uc], bestaand);
  const w = maakWijziging(plan, stand, { mapId: "m1", samenvattingen: [uc], nu: 1 });
  const els = Object.values(w.profielen.usecase05.elements);
  assert.equal(els.length, 1);
  assert.deepEqual([els[0].source, els[0].target, els[0].elementType], ["e_gebr", "e_test", "associatie"]);
  assert.deepEqual(w.profielen.usecase05.diagrams, {});
  assert.deepEqual(w.mappen, []);
  assert.equal(w.samenvatting, "1 relatie");
  assert.deepEqual(naarOps(w).map((o) => `${o.store}:${o.op}`), ["model:usecase05:patchElementen"]);
});

test("wijziging: map + use case met activiteitendiagram eronder, verband, nieuwe knoop op bestaand diagram", () => {
  const stand = {
    mappen: { m1: { id: "m1", naam: "Test", ouderId: null } },
    plaatsing: {},
    profielen: {
      usecase05: {
        elements: { e_gebr: { id: "e_gebr", naam: "gebruiker", elementType: "actor" } },
        diagrams: { d_uc: { id: "d_uc", naam: "Use case model", nodes: [{ elementId: "e_gebr", position: { x: 40, y: 40 } }] } },
      },
      activity05: { elements: {}, diagrams: {} },
    },
  };
  const plan = controleerPlan({
    uitleg: "",
    diagrammen: [{ sleutel: "d1", bestaand: "d_uc" }, { sleutel: "d2", taal: "activity05", naam: "Leen boek", map: "Uitwerking" }],
    elementen: [
      { sleutel: "u1", type: "usecase", naam: "Leen boek", diagram: "d1" },
      { sleutel: "b", type: "begin", naam: "", diagram: "d2" },
      { sleutel: "x1", type: "actie", naam: "Zoek boek", diagram: "d2" },
      { sleutel: "e", type: "eind", naam: "", diagram: "d2" },
    ],
    connectoren: [
      { type: "associatie", bron: "e_gebr", doel: "u1" },
      { type: "controlestroom", bron: "b", doel: "x1" },
      { type: "controlestroom", bron: "x1", doel: "e", eigenschappen: { guard: "gevonden", onzin: "weg" } },
    ],
    verbanden: [{ van: "x1", naar: "u1", soort: "realiseert" }],
  }, [uc, ad], bestaand);
  assert.deepEqual(plan.problemen, []);
  const w = maakWijziging(plan, stand, { mapId: "m1", samenvattingen: [uc, ad], nu: 7 });
  // Submap "Uitwerking" onder Test, het AD erin; de use case op het bestaande UC-diagram.
  assert.deepEqual(w.mappen, [{ id: "map_7_ai1", naam: "Uitwerking", ouderId: "m1" }]);
  const adDiagram = Object.values(w.profielen.activity05.diagrams)[0];
  assert.equal(adDiagram.nodes.length, 3);
  assert.equal(adDiagram.diagramType, "activity");
  assert.equal(w.plaatsing[`activity05::${adDiagram.id}`], "map_7_ai1");
  const ucDiagram = w.profielen.usecase05.diagrams.d_uc;
  assert.equal(ucDiagram.nodes.length, 2);
  assert.ok(ucDiagram.nodes[1].position.x > 40 + 160, "nieuwe knoop rechts naast de bestaande");
  const guard = Object.values(w.profielen.activity05.elements).find((e) => e.target && e.data.guard);
  assert.deepEqual(guard.data, { guard: "gevonden" });
  assert.equal(w.links.length, 1);
  assert.equal(w.links[0].soort, "realiseert");
  assert.equal(w.links[0].rij.profielId, "activity05");
  // Begin/eind (vast) zonder maat, een actie met maat.
  assert.ok(adDiagram.nodes.some((n) => !n.size) && adDiagram.nodes.some((n) => n.size));
  const ops = naarOps(w).map((o) => `${o.store}:${o.op}`);
  // Eerst de mappen, dan de modellen (volgorde tussen profielen maakt niet uit), dan plaatsing en verbanden.
  assert.equal(ops[0], "structuur:nieuweMap");
  assert.deepEqual(ops.slice(1, 5).sort(), [
    "model:activity05:patchDiagrammen", "model:activity05:patchElementen",
    "model:usecase05:patchDiagrammen", "model:usecase05:patchElementen",
  ]);
  assert.deepEqual(ops.slice(5), ["structuur:plaatsPerMap", "kruis:patchLinks"]);
});

test("controleerPlan: een verband met een diagram landt op het eerste element dat geen begin/eind is", () => {
  const r = controleerPlan({
    uitleg: "",
    diagrammen: [{ sleutel: "d2", taal: "activity05", naam: "Lenen" }],
    elementen: [{ sleutel: "b", type: "begin", naam: "", diagram: "d2" }, { sleutel: "x1", type: "actie", naam: "Zoek boek", diagram: "d2" }],
    connectoren: [{ type: "controlestroom", bron: "b", doel: "x1" }],
    verbanden: [{ van: "d2", naar: "e_test", soort: "realiseert" }],
  }, [uc, ad], bestaand);
  assert.deepEqual(r.verbanden, [{ van: { nieuw: "x1" }, naar: { id: "e_test" }, vanProfiel: "activity05", naarProfiel: "usecase05", soort: "realiseert" }]);
  assert.match(r.opmerkingen.join(), /diagram "Lenen" gelegd op "Zoek boek"/);
});

test("wijziging: use case in een systeemkader → bevat-connector, container eerst; een actor mag er niet in", () => {
  const plan = controleerPlan({
    uitleg: "",
    diagrammen: [{ sleutel: "d1", taal: "usecase05", naam: "Bieb" }],
    elementen: [
      { sleutel: "s", type: "systeem", naam: "Bibliotheek", diagram: "d1" },
      { sleutel: "u1", type: "usecase", naam: "Leen boek", diagram: "d1", in: "s" },
      { sleutel: "a1", type: "actor", naam: "Lid", diagram: "d1", in: "s" },
    ],
    connectoren: [{ type: "associatie", bron: "a1", doel: "u1" }],
  }, [uc], []);
  assert.match(plan.problemen.join(), /"Lid" kan niet in s liggen \(een actor hoort niet in een systeem\)/);
  const w = maakWijziging(plan, { profielen: { usecase05: { elements: {}, diagrams: {} } } }, { mapId: null, samenvattingen: [uc], nu: 1 });
  const els = Object.values(w.profielen.usecase05.elements);
  const bevat = els.filter((e) => e.elementType === "bevat");
  assert.equal(bevat.length, 1);
  const systeem = els.find((e) => e.elementType === "systeem");
  assert.equal(bevat[0].source, systeem.id);
  const d = Object.values(w.profielen.usecase05.diagrams)[0];
  assert.equal(d.nodes[0].elementId, systeem.id);
  assert.equal(d.nodes.length, 3);
});

test("melding #9: bestaande use case in een nieuw systeemkader — bevat én er echt in op het diagram", () => {
  const stand = {
    mappen: {}, plaatsing: {},
    profielen: { usecase05: {
      elements: { e_gebr: { id: "e_gebr", naam: "gebruiker", elementType: "actor" }, e_test: { id: "e_test", naam: "test", elementType: "usecase" } },
      diagrams: { d_uc: { id: "d_uc", naam: "Use case model", nodes: [{ elementId: "e_gebr", position: { x: 40, y: 100 } }, { elementId: "e_test", position: { x: 250, y: 90 }, size: { width: 160, height: 70 } }] } },
    } },
  };
  for (const antwoord of [
    // zoals bedoeld: `in` bij het bestaande element
    { uitleg: "", diagrammen: [{ sleutel: "d1", bestaand: "d_uc" }], elementen: [{ sleutel: "s", type: "systeem", naam: "Omnium", diagram: "d1" }, { bestaand: "e_test", in: "s" }], connectoren: [] },
    // zoals Flash het vaak doet: het diagram-id direct, zonder bestaand-diagram in het plan
    { uitleg: "", diagrammen: [], elementen: [{ sleutel: "s", type: "systeem", naam: "Omnium", diagram: "d_uc" }, { bestaand: "e_test", in: "s" }], connectoren: [] },
    // of helemaal zonder diagram (er is er maar één in de map)
    { uitleg: "", diagrammen: [], elementen: [{ sleutel: "s", type: "systeem", naam: "Omnium" }, { bestaand: "e_test", in: "s" }], connectoren: [] },
    // zoals de AI het ook doet: een bevat-relatie
    { uitleg: "", diagrammen: [{ sleutel: "d1", bestaand: "d_uc" }], elementen: [{ sleutel: "s", type: "systeem", naam: "Omnium", diagram: "d1" }], connectoren: [{ type: "bevat", bron: "s", doel: "e_test" }] },
  ]) {
    const plan = controleerPlan(antwoord, [uc], bestaand);
    assert.deepEqual(plan.problemen, []);
    assert.deepEqual(plan.leden, [{ profielId: "usecase05", id: "e_test", in: { nieuw: "s" } }]);
    const w = maakWijziging(plan, stand, { mapId: null, samenvattingen: [uc], nu: 1 });
    const els = Object.values(w.profielen.usecase05.elements);
    const systeem = els.find((e) => e.elementType === "systeem");
    const bevat = els.find((e) => e.elementType === "bevat");
    assert.deepEqual([bevat.source, bevat.target], [systeem.id, "e_test"]);
    const nodes = w.profielen.usecase05.diagrams.d_uc.nodes;
    const sn = nodes.find((n) => n.elementId === systeem.id), tn = nodes.find((n) => n.elementId === "e_test");
    assert.ok(tn.position.x >= sn.position.x && tn.position.y >= sn.position.y, "test ligt binnen het kader");
    assert.ok(tn.position.x + 160 <= sn.position.x + sn.size.width && tn.position.y + 70 <= sn.position.y + sn.size.height);
    assert.equal(nodes.filter((n) => n.elementId === "e_test").length, 1);
    assert.match(w.samenvatting, /1 in een container gezet/);
  }
});

test("melding #11: uitlijnen — op één rij, dan test en kader boven elkaar; leden schuiven mee", () => {
  const stand = {
    mappen: {}, plaatsing: {},
    profielen: { usecase05: {
      elements: {
        e_gebr: { id: "e_gebr", naam: "gebruiker", elementType: "actor" },
        e_test: { id: "e_test", naam: "test", elementType: "usecase" },
        e_sys: { id: "e_sys", naam: "Omnium", elementType: "systeem" },
        e_bevat: { id: "e_bevat", elementType: "bevat", source: "e_sys", target: "e_test" },
      },
      diagrams: { d_uc: { id: "d_uc", naam: "Use case model", nodes: [
        { elementId: "e_gebr", position: { x: 40, y: 100 } },
        { elementId: "e_sys", position: { x: 300, y: 40 }, size: { width: 400, height: 300 } },
        { elementId: "e_test", position: { x: 320, y: 220 }, size: { width: 160, height: 70 } },
      ] } },
    } },
  };
  const metSys = [{ ...bestaand[0], elementen: [...bestaand[0].elementen, { id: "e_sys", type: "systeem", naam: "Omnium", diagrammen: ["d_uc"] }] }];
  const plan = controleerPlan({ uitleg: "", diagrammen: [], elementen: [], connectoren: [], opstelling: [
    { diagram: "d_uc", actie: "naast-elkaar", elementen: ["e_gebr", "e_sys"] },
    { diagram: "d_uc", actie: "boven-elkaar", elementen: ["e_test", "e_sys"] },
  ] }, [uc], metSys);
  assert.deepEqual(plan.problemen, []);
  // De Studio geeft de gemeten maten van het canvas mee (actor: 64×69, zoals getekend).
  const w = maakWijziging(plan, stand, { mapId: null, samenvattingen: [uc], nu: 1, gemeten: { e_gebr: { w: 64, h: 69 } } });
  const n = Object.fromEntries(w.profielen.usecase05.diagrams.d_uc.nodes.map((x) => [x.elementId, x]));
  // naast elkaar: y-midden van gebruiker (gemeten 64×69) en kader gelijk
  assert.ok(Math.abs(n.e_gebr.position.y + 34.5 - (n.e_sys.position.y + 150)) <= 1);
  // boven elkaar: x-midden van test en kader gelijk; test ligt nog in het kader
  assert.ok(Math.abs(n.e_test.position.x + 80 - (n.e_sys.position.x + 200)) <= 1);
  assert.ok(n.e_test.position.y >= n.e_sys.position.y && n.e_test.position.y + 70 <= n.e_sys.position.y + 300);
  assert.match(w.samenvatting, /opnieuw opgesteld/);
});

test("leesAntwoord: kale JSON, codeblok of tekst eromheen", () => {
  assert.deepEqual(leesAntwoord('{"a":1}'), { a: 1 });
  assert.deepEqual(leesAntwoord('Hier:\n```json\n{"a":2}\n```'), { a: 2 });
  assert.deepEqual(leesAntwoord('Zie {"a":3} hierboven'), { a: 3 });
  assert.equal(leesAntwoord("geen json"), null);
});

const canoniek = {
  fieldTypes: [{ id: "attribuut", viewer: "naam-type" }, { id: "afgeleidVeld", viewer: "naam-type", afgeleid: true }],
  elementTypes: [{ id: "gegevenselement", compartments: [{ id: "afgeleid", fieldType: "afgeleidVeld" }, { id: "velden", fieldType: "attribuut" }] }],
};
const klasse = { id: "ge1", naam: "Persoon", elementType: "gegevenselement", compartimenten: [{ compartmentType: "velden", velden: [{ naam: "aap", fieldType: "attribuut", data: { typeLabel: "string" } }] }] };

test("velden: alleen bewerkbare naam-type-compartimenten; bestaande niet dubbel", () => {
  assert.deepEqual(veldCompartimenten(canoniek, "gegevenselement").map((c) => c.id), ["velden"]);
  const v = vraagVoorVelden(canoniek, klasse, "voeg aap: string, noot: int, mies: tekst toe");
  assert.match(v.systeem, /Het heeft al: velden: aap : string/);
  const r = veldenToepassing({ uitleg: "ok", compartiment: "velden", velden: [{ naam: "aap", type: "string" }, { naam: "noot", type: "int" }, { naam: "mies", type: "tekst", verplicht: true }] }, canoniek, klasse);
  assert.deepEqual(r.nieuw.map((x) => [x.naam, x.data.typeLabel, !!x.data.verplicht]), [["noot", "int", false], ["mies", "tekst", true]]);
  assert.match(r.problemen[0], /"aap" bestaat al/);
  assert.equal(r.compartimenten[0].velden.length, 3);
  assert.equal(r.compartimenten[0].velden[1].fieldType, "attribuut");
});
