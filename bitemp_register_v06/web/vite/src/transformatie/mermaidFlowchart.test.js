import test from "node:test";
import assert from "node:assert/strict";

import { leesMermaidFlowcharts, lijktOpMermaidFlowchart, schoonTekst } from "./mermaidFlowchart.js";

const lees = (tekst) => leesMermaidFlowcharts(tekst)[0];
const knoop = (graaf, id) => graaf.knopen.find((k) => k.id === id);

test("knoopvormen, aangehaalde tekst en klassen", () => {
  const graaf = lees(`flowchart LR
    A(("Actor"))
    B(["Use case"])
    C["Rechthoek"]
    D(Afgerond)
    E{Keuze}
    F{{Zeshoek}}
    G[("Opslag")]
    H["tekst met ) en ] erin"]:::note
    class A,B actor;
  `);
  assert.deepEqual(graaf.knopen.map((k) => [k.id, k.vorm]), [
    ["A", "cirkel"], ["B", "stadion"], ["C", "rechthoek"], ["D", "afgerond"],
    ["E", "ruit"], ["F", "zeshoek"], ["G", "cilinder"], ["H", "rechthoek"],
  ]);
  assert.equal(knoop(graaf, "H").tekst, "tekst met ) en ] erin");
  assert.deepEqual(knoop(graaf, "H").klassen, ["note"]);
  assert.deepEqual(knoop(graaf, "A").klassen, ["actor"]);
  assert.deepEqual(graaf.waarschuwingen, []);
});

test("verbindingen: lijnsoort, pijlpunt, label in beide schrijfwijzen", () => {
  const graaf = lees(`graph TD
    A --> B
    A --- C
    A -.-> D
    A ==> E
    A -->|met label| F
    A -- ook een label --> G
    A -. gestippeld label .-> H
    A <--> I
    A --o J
    A -.->|&lt;&lt;extend&gt;&gt;| K
  `);
  const v = Object.fromEntries(graaf.verbindingen.map((x) => [x.doel, x]));
  assert.equal(graaf.richting, "TD");
  assert.deepEqual([v.B.lijn, v.B.pijl], ["doorgetrokken", true]);
  assert.deepEqual([v.C.lijn, v.C.pijl], ["doorgetrokken", false]);
  assert.deepEqual([v.D.lijn, v.D.pijl], ["gestippeld", true]);
  assert.deepEqual([v.E.lijn, v.E.pijl], ["dik", true]);
  assert.equal(v.F.label, "met label");
  assert.equal(v.G.label, "ook een label");
  assert.deepEqual([v.H.lijn, v.H.label], ["gestippeld", "gestippeld label"]);
  assert.equal(v.I.terug, true);
  assert.deepEqual([v.J.kop, v.J.pijl], ["o", false]);
  assert.equal(v.K.label, "<<extend>>");
  assert.deepEqual(graaf.waarschuwingen, []);
});

test("kettingen, & en inline gedeclareerde knopen", () => {
  const graaf = lees(`flowchart LR
    A(("a")) --> B(["b"]) -.-> C
    D & E --> F
  `);
  assert.deepEqual(graaf.verbindingen.map((v) => `${v.bron}>${v.doel}`), ["A>B", "B>C", "D>F", "E>F"]);
  assert.equal(knoop(graaf, "A").vorm, "cirkel");
  assert.equal(knoop(graaf, "C").vorm, null);
  assert.equal(knoop(graaf, "C").tekst, "C");
});

test("geneste subgraphs: lidmaatschap en titel", () => {
  const graaf = lees(`flowchart LR
    K(("Klant"))
    subgraph S["Het systeem"]
      subgraph Deel["Deel A"]
        U1(["Een"])
      end
      U2(["Twee"])
    end
    K --> U1
    K --> S
  `);
  assert.deepEqual(graaf.groepen.map((g) => [g.id, g.tekst, g.groep]), [["S", "Het systeem", null], ["Deel", "Deel A", "S"]]);
  assert.equal(knoop(graaf, "U1").groep, "Deel");
  assert.equal(knoop(graaf, "U2").groep, "S");
  assert.equal(knoop(graaf, "K").groep, null);
  // Een verbinding naar een subgraph-id maakt er geen losse knoop van.
  assert.equal(knoop(graaf, "S"), undefined);
});

test("tekst: <br/>, vette kopregel en entiteiten", () => {
  assert.deepEqual(schoonTekst('"<b>Klant</b><br/>Regel één.<br/><br/>- punt"'), {
    tekst: "Klant\nRegel één.\n\n- punt",
    kop: "Klant",
    romp: "Regel één.\n\n- punt",
  });
  assert.equal(schoonTekst('"Technisch<br/>beheerder"').tekst, "Technisch\nbeheerder");
  assert.equal(schoonTekst("&lt;&lt;include&gt;&gt; &amp; #quot;x#quot; &#8364;").tekst, '<<include>> & "x" €');
  assert.equal(schoonTekst("zonder opmaak").kop, null);
});

test("meerdere diagrammen met titelregels, ook in markdown-blokken", () => {
  const kaal = leesMermaidFlowcharts(`actor model:
flowchart LR
  A(("a"))

use case model klant:
flowchart TB
  B(["b"])
`);
  assert.deepEqual(kaal.map((g) => [g.titel, g.richting, g.knopen.map((k) => k.id)]), [
    ["actor model", "LR", ["A"]],
    ["use case model klant", "TB", ["B"]],
  ]);

  const markdown = leesMermaidFlowcharts([
    "# Actoren",
    "Lopende tekst hoort niet bij het diagram.",
    "```mermaid",
    "flowchart LR",
    "  A --> B",
    "```",
    "en",
    "```",
    "Tweede:",
    "flowchart LR",
    "  C --> D",
    "```",
  ].join("\n"));
  assert.deepEqual(markdown.map((g) => [g.titel, g.knopen.map((k) => k.id)]), [["", ["A", "B"]], ["Tweede", ["C", "D"]]]);
});

test("opmaakregels worden overgeslagen; onbegrepen regels gemeld", () => {
  const graaf = lees(`flowchart LR
    %% commentaar
    A --> B
    classDef note fill:#fffde7,stroke:#999933;
    style A fill:#fff
    linkStyle 0 stroke:red
    A ==>
    wat is dit nu
  `);
  assert.equal(graaf.verbindingen.length, 1);
  assert.deepEqual(graaf.waarschuwingen.map((w) => w.melding.split(":")[0]), ["Verbinding zonder doel", "Rest van de regel niet begrepen"]);
});

test("herkenning voor de bestandskiezer", () => {
  assert.equal(lijktOpMermaidFlowchart({ naam: "x.mmd", tekst: "flowchart LR\n A-->B" }), 1);
  assert.equal(lijktOpMermaidFlowchart({ naam: "x.md", tekst: "titel:\n\ngraph TD\n A-->B" }), 0.8);
  assert.equal(lijktOpMermaidFlowchart({ naam: "x.md", tekst: "classDiagram\n class A" }), 0);
  assert.equal(lijktOpMermaidFlowchart({ naam: "x.json", tekst: '{"openapi":"3.1.0"}' }), 0);
});
