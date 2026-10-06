import test from "node:test";
import assert from "node:assert/strict";

import { mermaidId, mermaidTekst, planNaarMermaid } from "./mermaidSchrijver.js";
import { leesMermaidFlowcharts } from "./mermaidFlowchart.js";

const plan = {
  elementen: [
    { sleutel: "k", type: "cirkel", naam: "Klant", data: { klasse: "actor", notitie: "Wie 'm gebruikt.\nTwee regels." }, groep: null },
    { sleutel: "sys", type: "subgraph", naam: "Het \"systeem\"", data: {}, groep: null },
    { sleutel: "deel", type: "subgraph", naam: "Deel", data: {}, groep: "sys" },
    { sleutel: "u1", type: "stadion", naam: "Doe #1 <nu>", data: { klasse: "usecase" }, groep: "deel" },
    { sleutel: "u2", type: "stadion", naam: "Doe 2", data: { klasse: "usecase" }, groep: "sys" },
    { sleutel: "end", type: "rechthoek", naam: "Vrije notitie", data: { klasse: "note" }, groep: "weg" },
  ],
  connectoren: [
    { sleutel: "v1", type: "doorgetrokken", bron: "k", doel: "u1", data: { label: "" } },
    { sleutel: "v2", type: "gestippeld", bron: "u2", doel: "u1", data: { label: "<<include>>" } },
    { sleutel: "v3", type: "dik", bron: "u1", doel: "u2", data: { label: "a|b", pijl: false } },
  ],
};

test("id's en teksten zijn veilig voor Mermaid", () => {
  assert.equal(mermaidId("uc klant-1"), "uc_klant_1");
  assert.equal(mermaidId("end"), "n_end");
  assert.equal(mermaidId("1e"), "n_1e");
  assert.equal(mermaidTekst('Zeg "hoi" <b>#1</b>\nregel 2'), '"Zeg #quot;hoi#quot; #60;b#62;#35;1#60;/b#62;<br/>regel 2"');
});

test("plan → flowchart: nesting, notities, lijnen en klassen", () => {
  const tekst = planNaarMermaid(plan, { titel: "proef", klasseStijlen: { note: "fill:#fffde7" } });
  assert.equal(tekst, [
    "proef:",
    "flowchart LR",
    "",
    '    k(("Klant"))',
    '    subgraph sys["Het #quot;systeem#quot;"]',
    '        subgraph deel["Deel"]',
    '            u1(["Doe #35;1 #60;nu#62;"])',
    "        end",
    '        u2(["Doe 2"])',
    "    end",
    '    n_end["Vrije notitie"]',
    "",
    "    %% Notities",
    '    N_k["<b>Klant</b><br/>Wie \'m gebruikt.<br/>Twee regels."]',
    "    k -.-> N_k",
    "",
    "    k --> u1",
    "    u2 -.->|&lt;&lt;include&gt;&gt;| u1",
    "    u1 ===|a#124;b| u2",
    "",
    "    classDef note fill:#fffde7;",
    "    class k actor;",
    "    class u1,u2 usecase;",
    "    class n_end,N_k note;",
    "",
  ].join("\n"));
});

test("wat de schrijver schrijft, leest de lezer zonder verlies terug", () => {
  const [graaf] = leesMermaidFlowcharts(planNaarMermaid(plan, { titel: "proef" }));
  assert.equal(graaf.titel, "proef");
  assert.deepEqual(graaf.waarschuwingen, []);
  const knoop = (id) => graaf.knopen.find((k) => k.id === id);
  assert.deepEqual([knoop("u1").tekst, knoop("u1").vorm, knoop("u1").groep], ["Doe #1 <nu>", "stadion", "deel"]);
  assert.deepEqual(graaf.groepen.map((g) => [g.id, g.tekst, g.groep]), [["sys", 'Het "systeem"', null], ["deel", "Deel", "sys"]]);
  assert.deepEqual([knoop("N_k").kop, knoop("N_k").romp, knoop("N_k").klassen], ["Klant", "Wie 'm gebruikt.\nTwee regels.", ["note"]]);
  assert.deepEqual(graaf.verbindingen.map((v) => [v.bron, v.doel, v.lijn, v.pijl, v.label]), [
    ["k", "N_k", "gestippeld", true, ""],
    ["k", "u1", "doorgetrokken", true, ""],
    ["u2", "u1", "gestippeld", true, "<<include>>"],
    ["u1", "u2", "dik", false, "a|b"],
  ]);
});
