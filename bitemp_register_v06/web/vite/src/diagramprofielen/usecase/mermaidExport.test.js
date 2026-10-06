import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { getTransformaties, wisTransformaties } from "../../studio/activities/transformatieRegistry.js";
import { leesMermaidFlowcharts } from "../../transformatie/mermaidFlowchart.js";
import { valideerRegelset } from "../../transformatie/regels.js";
import { mermaidNaarUsecaseModel } from "./mermaidImport.js";
import { registreerUsecaseMermaidExport, usecaseNaarMermaid } from "./mermaidExport.js";
import { USECASE_NAAR_MERMAID } from "./mermaidExportRegels.js";

const fixture = fs.readFileSync(new URL("./fixtures/actoren-en-klant.mmd", import.meta.url), "utf8");

// Zelfde profielkennis als in mermaidImport.test.js (index.js laadt .jsx).
const elementTypes = [
  { id: "actor" },
  { id: "usecase" },
  { id: "systeem", containerVoor: "bevat" },
  { id: "notitie" },
  { id: "associatie", isConnector: true, bron: { elementTypes: ["actor", "usecase"] }, doel: { elementTypes: ["actor", "usecase"] } },
  { id: "include", isConnector: true, bron: { elementTypes: ["usecase"] }, doel: { elementTypes: ["usecase"] } },
  { id: "extend", isConnector: true, bron: { elementTypes: ["usecase"] }, doel: { elementTypes: ["usecase"] } },
  {
    id: "generalisatie",
    isConnector: true,
    verbindingsregels: [
      { bron: { elementTypes: ["actor"] }, doel: { elementTypes: ["actor"] } },
      { bron: { elementTypes: ["usecase"] }, doel: { elementTypes: ["usecase"] } },
    ],
  },
  { id: "bevat", isConnector: true, bron: { elementTypes: ["systeem"] }, doel: { elementTypes: ["usecase", "notitie", "systeem"] } },
];

/** Inhoudelijke vingerafdruk van een model: elementen op naam, relaties op namen. */
function vingerafdruk(elements) {
  const naam = (id) => elements[id].naam;
  const items = Object.values(elements).map((el) =>
    el.source ? `${el.elementType}: ${naam(el.source)} → ${naam(el.target)}${el.naam ? ` [${el.naam}]` : ""}` : `${el.elementType}: ${el.naam} | ${el.data?.toelichting || ""}`
  );
  return items.sort();
}

test("de regelset is geldig", () => {
  assert.deepEqual(valideerRegelset(USECASE_NAAR_MERMAID), []);
});

test("export: één flowchart per diagram, leesbaar voor de lezer, zonder meldingen", () => {
  const { core } = mermaidNaarUsecaseModel(fixture, { elementTypes });
  const uit = usecaseNaarMermaid({ ...core, elementTypes });
  assert.deepEqual(uit.diagnostics, []);
  assert.deepEqual(uit.stats, { diagrammen: 2, elementen: 38, relaties: 32 });

  const grafen = leesMermaidFlowcharts(uit.tekst);
  assert.deepEqual(grafen.map((g) => [g.titel, g.groepen.length, g.waarschuwingen.length]), [["actor model", 0, 0], ["use case model klant", 5, 0]]);
  assert.match(uit.tekst, /uc_bekijk_voortgang -\.->\|&lt;&lt;extend&gt;&gt;\| uc_dien_verzoek_in/);
  assert.match(uit.tekst, /uc_voer_chatgesprek -\.->\|gespreksvorm\| uc_voer_gesprek/);
  assert.match(uit.tekst, /uc_inwoner -\.->\|specialisatie\| uc_klant/);
  assert.match(uit.tekst, /subgraph uc_gemeentelijke_dienstverlening\["Gemeentelijke dienstverlening"\]\n\s+subgraph uc_verzoeken_en_meldingen/);
  assert.match(uit.tekst, /N_uc_beheerder\["<b>Beheerder<\/b><br\/>Algemene beheerrol\."\]/);
});

test("roundtrip: import → export → import geeft hetzelfde model, en de export is stabiel", () => {
  const een = mermaidNaarUsecaseModel(fixture, { elementTypes });
  const tekst = usecaseNaarMermaid({ ...een.core, elementTypes }).tekst;
  const twee = mermaidNaarUsecaseModel(tekst, { elementTypes });

  assert.deepEqual(twee.diagnostics.filter((d) => d.severity !== "info"), []);
  assert.deepEqual(vingerafdruk(twee.core.elements), vingerafdruk(een.core.elements));
  assert.deepEqual(Object.values(twee.core.diagrams).map((d) => [d.naam, d.nodes.length]), Object.values(een.core.diagrams).map((d) => [d.naam, d.nodes.length]));
  // Idempotent: een tweede rondgang schrijft letterlijk dezelfde tekst.
  assert.equal(usecaseNaarMermaid({ ...twee.core, elementTypes }).tekst, tekst);
});

test("elementen buiten elk diagram komen in een eigen flowchart; een losse notitie blijft notitie", () => {
  const elements = {
    a: { id: "a", naam: "Actor", elementType: "actor", data: {} },
    n: { id: "n", naam: "", elementType: "notitie", data: { tekst: "Los" } },
  };
  const uit = usecaseNaarMermaid({ elements, diagrams: {}, elementTypes });
  assert.match(uit.tekst, /^model:\nflowchart LR\n/);
  assert.match(uit.tekst, /n\["Los"\]/);
  assert.equal(uit.stats.diagrammen, 1);
  const terug = mermaidNaarUsecaseModel(uit.tekst, { elementTypes });
  assert.deepEqual(Object.values(terug.core.elements).map((el) => [el.elementType, el.naam || el.data.tekst]), [["actor", "Actor"], ["notitie", "Los"]]);
});

test("transformatie in de registry: schrijft het bestand van de map en meldt de aantallen", async () => {
  wisTransformaties();
  const { core } = mermaidNaarUsecaseModel(fixture, { elementTypes });
  const bestanden = [];
  registreerUsecaseMermaidExport({
    getProfieltype: (id) => (id === "usecase05" ? { descriptor: { elementTypes } } : null),
    collectMapModel: (mapId) => (mapId === "map1" ? { usecase05: { elements: core.elements, diagrams: core.diagrams } } : {}),
    download: (naam, tekst) => bestanden.push({ naam, tekst }),
  });
  const t = getTransformaties("export", ["usecase05"]).find((x) => x.id === "export-usecase-mermaid");
  assert.ok(t);
  const resultaat = await t.run({ bronMap: "map1", mapNaam: "Use cases klant" });
  assert.equal(resultaat.summary, "2 flowcharts geschreven: 38 elementen, 32 relaties");
  assert.deepEqual(bestanden.map((b) => b.naam), ["Use_cases_klant.mmd"]);
  assert.match(bestanden[0].tekst, /^actor model:\nflowchart LR/);
  await assert.rejects(() => t.run({ bronMap: "leeg", mapNaam: "x" }), /geen use case-model/);
  wisTransformaties();
});
