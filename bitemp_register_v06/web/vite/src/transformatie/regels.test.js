import test from "node:test";
import assert from "node:assert/strict";

import { pasRegelsToe, past, valideerRegelset, voldoet, vul } from "./regels.js";

const graaf = {
  knopen: [
    { id: "K", tekst: "Klant", romp: "Klant", vorm: "cirkel", klassen: ["actor"], groep: null, regel: 2 },
    { id: "U", tekst: "Doe\niets", romp: "Doe\niets", vorm: "stadion", klassen: [], groep: "G", regel: 4 },
    { id: "N", tekst: "Klant\nDe afnemer.", kop: "Klant", romp: "De afnemer.", vorm: "rechthoek", klassen: ["note"], groep: null, regel: 6 },
    { id: "X", tekst: "?", romp: "?", vorm: "ruit", klassen: [], groep: null, regel: 7 },
  ],
  groepen: [{ id: "G", tekst: "Systeem", klassen: [], groep: null, regel: 3 }],
  verbindingen: [
    { id: "v1", bron: "K", doel: "U", lijn: "doorgetrokken", pijl: true, label: "", regel: 8 },
    { id: "v2", bron: "K", doel: "N", lijn: "gestippeld", pijl: true, label: "", regel: 9 },
    { id: "v3", bron: "U", doel: "X", lijn: "gestippeld", pijl: true, label: "raar", regel: 10 },
  ],
};

const regelset = {
  id: "test",
  regels: [
    { naam: "Notitie", bij: "knoop", als: { klasse: "note" }, maak: { type: "notitie", naam: "", data: { tekst: "{tekst}" } } },
    { naam: "Actor", bij: "knoop", als: { vorm: ["cirkel", "dubbele-cirkel"] }, maak: { type: "actor" } },
    { naam: "Use case", bij: "knoop", als: { vorm: "stadion" }, maak: { type: "usecase" } },
    { naam: "Systeem", bij: "groep", maak: { type: "systeem" } },
    { naam: "Toelichting", bij: "verbinding", als: { doel: { type: "notitie" } }, zet: { op: "bron", data: { toelichting: "{doel.romp}" }, vervalt: "doel" } },
    { naam: "Associatie", bij: "verbinding", meld: true, als: { lijn: "doorgetrokken", bron: { type: "actor" }, doel: { type: "usecase" } }, maak: { type: "associatie", naam: "{label}" } },
  ],
};

test("toetsen: gelijk, lijst, patroon, leeg, niet — ook op een lijst waarden", () => {
  assert.equal(voldoet("Cirkel ", "cirkel"), true);
  assert.equal(voldoet("ruit", ["cirkel", "stadion"]), false);
  assert.equal(voldoet(["actor", "note"], "note"), true);
  assert.equal(voldoet([], "note"), false);
  assert.equal(voldoet("<<Extend>>", { patroon: "^(<<)?extend(>>)?$" }), true);
  assert.equal(voldoet("", { leeg: true }), true);
  assert.equal(voldoet("x", { leeg: false }), true);
  assert.equal(voldoet("notitie", { niet: "notitie" }), false);
  assert.equal(voldoet(true, true), true);
  assert.equal(past({ lijn: "gestippeld", bron: { type: "actor" } }, { lijn: "gestippeld", bron: { type: ["actor", "usecase"] } }), true);
  assert.equal(past({ lijn: "gestippeld", bron: null }, { bron: { type: "actor" } }), false);
});

test("sjablonen met pad en filter", () => {
  assert.equal(vul("{tekst|eenregel} ({bron.type})", { tekst: "Doe\n iets", bron: { type: "actor" } }), "Doe iets (actor)");
  assert.equal(vul("{ontbreekt}", {}), "");
  assert.equal(vul(true, {}), true);
});

test("eerste passende regel wint; elementen, connector en trace", () => {
  const plan = pasRegelsToe(graaf, regelset);
  assert.deepEqual(plan.elementen.map((e) => [e.sleutel, e.type, e.naam, e.groep]), [
    ["G", "systeem", "Systeem", null],
    ["K", "actor", "Klant", null],
    ["U", "usecase", "Doe iets", "G"],
  ]);
  assert.deepEqual(plan.connectoren.map((c) => [c.type, c.bron, c.doel]), [["associatie", "K", "U"]]);
  // De notitie ging op in de toelichting van de actor en vervalt als element.
  assert.equal(plan.elementen.find((e) => e.sleutel === "K").data.toelichting, "De afnemer.");
  assert.deepEqual(plan.trace.find((s) => s.bronId === "N"), { soort: "knoop", bronId: "N", regel: "Notitie", actie: "opgegaan", doel: "K" });
  assert.deepEqual(plan.trace.find((s) => s.bronId === "v2").actie, "gezet");
});

test("geen passende regel is een waarschuwing, nooit een stille gok", () => {
  const plan = pasRegelsToe(graaf, regelset);
  const codes = plan.diagnostics.map((d) => [d.severity, d.code, d.sourceId, d.path]);
  assert.deepEqual(codes, [
    ["warning", "TRF-GEEN-REGEL", "X", "regel 7"],
    ["info", "TRF-INTERPRETATIE", "v1", "regel 8"],
    ["warning", "TRF-GEEN-REGEL", "v3", "regel 10"],
  ]);
  assert.equal(plan.trace.find((s) => s.bronId === "X").actie, "geen-regel");
});

test("lid van een niet-omgezette groep schuift door naar de omvattende groep", () => {
  const genest = {
    knopen: [{ id: "U", tekst: "u", vorm: "stadion", klassen: [], groep: "Binnen", regel: 1 }],
    groepen: [
      { id: "Buiten", tekst: "Buiten", klassen: [], groep: null, regel: 1 },
      { id: "Binnen", tekst: "Binnen", klassen: ["sla-over"], groep: "Buiten", regel: 1 },
    ],
    verbindingen: [],
  };
  const plan = pasRegelsToe(genest, {
    id: "t",
    regels: [
      { naam: "Overslaan", bij: "groep", als: { klasse: "sla-over" }, negeer: true },
      { naam: "Systeem", bij: "groep", maak: { type: "systeem" } },
      { naam: "Use case", bij: "knoop", maak: { type: "usecase" } },
    ],
  });
  assert.equal(plan.elementen.find((e) => e.sleutel === "U").groep, "Buiten");
  assert.deepEqual(plan.diagnostics, []);
});

test("een ongeldige regelset wordt geweigerd met leesbare fouten", () => {
  const fouten = valideerRegelset({
    id: "kapot",
    regels: [
      { bij: "knoop", maak: { type: "x" } },
      { naam: "Twee acties", bij: "verbinding", maak: { type: "x" }, negeer: true },
      { naam: "Zet bij knoop", bij: "knoop", zet: { op: "links", data: {} } },
      { naam: "Patroon", bij: "pijl", als: { label: { patroon: "(" }, bron: "actor", vorm: { bevat: "x" } }, maak: {} },
    ],
  });
  assert.equal(fouten.length, 9);
  assert.match(fouten.join("\n"), /naam ontbreekt/);
  assert.match(fouten.join("\n"), /precies één van maak, zet of negeer/);
  assert.match(fouten.join("\n"), /ongeldig patroon/);
  assert.match(fouten.join("\n"), /onbekende toets/);
  assert.throws(() => pasRegelsToe(graaf, { id: "leeg", regels: [] }), /Ongeldige regelset/);
  assert.deepEqual(valideerRegelset(regelset), []);
});
