import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createDiagramStore } from "../../diagramcore/model/createDiagramStore.js";
import { bepaalNesting } from "../../diagramcore/canvas/nesting.js";
import { getTransformaties, wisTransformaties } from "../../studio/activities/transformatieRegistry.js";
import { valideerRegelset } from "../../transformatie/regels.js";
import { mermaidNaarUsecaseModel, registreerMermaidUsecaseImport } from "./mermaidImport.js";
import { MERMAID_NAAR_USECASE } from "./mermaidRegels.js";

const fixture = fs.readFileSync(new URL("./fixtures/actoren-en-klant.mmd", import.meta.url), "utf8");

// De connectoren en containers van het use case-profiel (index.js laadt
// .jsx-shapes en is hier niet importeerbaar).
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
const typesById = Object.fromEntries(elementTypes.map((et) => [et.id, et]));

const telPerType = (elements) => {
  const telling = {};
  for (const el of Object.values(elements)) telling[el.elementType] = (telling[el.elementType] || 0) + 1;
  return telling;
};
const opNaam = (elements, naam) => Object.values(elements).find((el) => el.naam === naam);
const relaties = (elements, type) =>
  Object.values(elements)
    .filter((el) => el.elementType === type)
    .map((el) => `${elements[el.source].naam} → ${elements[el.target].naam}`);

function omgeving() {
  wisTransformaties();
  const useStore = createDiagramStore();
  useStore.getState().laadModel({ diagramTypeId: "usecase", elements: {}, diagrams: {} });
  useStore.temporal.getState().clear();
  const mapState = {
    mappen: { doel: { id: "doel", naam: "Doel" } },
    plaatsing: {},
    plaatsDiagram(key, mapId) { this.plaatsing[key] = mapId; },
  };
  registreerMermaidUsecaseImport({
    getProfieltype: (id) => (id === "usecase05" ? { useStore, descriptor: { elementTypes } } : null),
    getModellerenState: () => mapState,
  });
  return { useStore, mapState, transformatie: getTransformaties("import").find((t) => t.id === "import-mermaid-usecase") };
}

test.afterEach(() => wisTransformaties());

test("de regelset is geldig", () => {
  assert.deepEqual(valideerRegelset(MERMAID_NAAR_USECASE), []);
});

test("actor- en use case-model: elementen, relaties en toelichtingen", () => {
  const { core, diagnostics, stats } = mermaidNaarUsecaseModel(fixture, { elementTypes });
  const el = core.elements;

  // Klant, Inwoner, Onderneming en Vertegenwoordiger staan in beide diagrammen
  // maar zijn elk één element.
  assert.deepEqual(telPerType(el), { actor: 13, generalisatie: 17, systeem: 5, usecase: 16, bevat: 20, associatie: 7, extend: 4, include: 1 });
  assert.equal(stats.diagrammen, 2);
  assert.deepEqual(Object.values(core.diagrams).map((d) => [d.naam, d.nodes.length]), [["actor model", 13], ["use case model klant", 25]]);

  // <br/> in een naam wordt een spatie; de notitie wordt de toelichting,
  // zonder de vetgedrukte kopregel.
  assert.ok(opNaam(el, "Technisch beheerder"));
  assert.equal(opNaam(el, "Beheerder").data.toelichting, "Algemene beheerrol.");
  assert.equal(opNaam(el, "Informatiebeheerder").data.toelichting, "Voorheen: DIV-medewerker.\nBeheert, archiveert, draagt over en vernietigt informatie.");
  assert.match(opNaam(el, "Vertegenwoordiger").data.toelichting, /^Handelt namens een andere klant\.\n\nMogelijke specialisaties:\n- gemachtigde\n/);
  assert.match(opNaam(el, "Dien verzoek in").data.toelichting, /^De klant dient een verzoek in/);
  assert.equal(telPerType(el).notitie, undefined);

  assert.ok(relaties(el, "generalisatie").includes("Technisch beheerder → Beheerder"));
  assert.ok(relaties(el, "generalisatie").includes("Voer betaling uit → Voer taak uit"));
  assert.deepEqual(relaties(el, "include"), ["Voer gesprek → Stel een vraag"]);
  assert.deepEqual(relaties(el, "extend"), [
    "Bekijk voortgang → Dien verzoek in",
    "Bekijk voortgang → Dien melding in",
    "Maak een afspraak → Dien verzoek in",
    "Maak een afspraak → Zoek informatie over producten en diensten",
  ]);
  assert.equal(relaties(el, "associatie").length, 7);
  assert.ok(relaties(el, "associatie").every((r) => r.startsWith("Klant → ")));
  assert.ok(relaties(el, "bevat").includes("Gemeentelijke dienstverlening → Vragen en informatie"));
  assert.ok(relaties(el, "bevat").includes("Vragen en informatie → Bel op"));

  // De enige interpretatie ("gespreksvorm" → generalisatie) is gemeld; verder niets.
  assert.deepEqual([...new Set(diagnostics.map((d) => `${d.severity} ${d.code}`))], ["info TRF-INTERPRETATIE"]);
  assert.equal(diagnostics.length, 4);
  assert.equal(Object.values(el).filter((x) => x.elementType === "generalisatie" && x.naam === "gespreksvorm").length, 4);
});

test("de startopstelling nest elk lid in zijn systeemkader", () => {
  const { core } = mermaidNaarUsecaseModel(fixture, { elementTypes });
  const diagram = Object.values(core.diagrams)[1];
  const nesting = bepaalNesting(core.elements, diagram, typesById);
  const container = Object.fromEntries(
    Object.values(core.elements).filter((el) => el.elementType === "bevat").map((el) => [el.target, el.source])
  );
  assert.equal(Object.keys(container).length, 20);
  for (const [lid, kader] of Object.entries(container)) assert.equal(nesting.ouderVan.get(lid), kader, `${lid} ligt in ${kader}`);
  // Actoren staan buiten het systeem.
  const systeem = diagram.nodes.find((n) => n.elementId === "uc_gemeentelijke_dienstverlening");
  const klant = diagram.nodes.find((n) => n.elementId === "uc_klant");
  assert.ok(klant.position.x + 64 < systeem.position.x);
});

test("transformatie importeert atomisch en plaatst de diagrammen in de doelmap", async () => {
  const { useStore, mapState, transformatie } = omgeving();
  assert.ok(transformatie);
  const resultaat = await transformatie.run({ bron: { naam: "model.mmd", tekst: fixture }, doelMap: "doel", opties: { hergebruik: true } });
  assert.equal(resultaat.status, "success");
  assert.equal(resultaat.summary, "2 diagrammen: 13 actoren, 16 use cases, 5 systeemkaders, 49 relaties geïmporteerd");
  assert.deepEqual(mapState.plaatsing, { "usecase05::uc_diagram_actor_model": "doel", "usecase05::uc_diagram_use_case_model_klant": "doel" });
  assert.equal(useStore.temporal.getState().pastStates.length, 1);
  useStore.temporal.getState().undo();
  assert.deepEqual(useStore.getState().elements, {});
  assert.deepEqual(useStore.getState().diagrams, {});
});

test("tweede import hergebruikt elementen en relaties op naam; alleen het diagram is nieuw", async () => {
  const { useStore, transformatie } = omgeving();
  const actoren = fixture.slice(0, fixture.indexOf("use case model klant:"));
  const klant = fixture.slice(fixture.indexOf("use case model klant:"));

  // Eerst het use case-model: de vier actoren krijgen daar geen toelichting.
  await transformatie.run({ bron: { naam: "klant.mmd", tekst: klant }, doelMap: "doel" });
  assert.equal(opNaam(useStore.getState().elements, "Klant").data.toelichting, undefined);
  const naEerste = Object.keys(useStore.getState().elements).length;

  const tweede = await transformatie.run({ bron: { naam: "actoren.mmd", tekst: actoren }, doelMap: "doel" });
  const el = useStore.getState().elements;
  assert.equal(tweede.summary, "1 diagram: 9 actoren, 7 relaties geïmporteerd; 4 bestaande hergebruikt");
  assert.equal(telPerType(el).actor, 13);
  assert.equal(telPerType(el).generalisatie, 17);
  // De nog lege toelichting van een hergebruikt element is aangevuld.
  assert.match(opNaam(el, "Klant").data.toelichting, /^Algemene actor voor een partij/);

  // Nog eens hetzelfde: niets nieuws behalve een (uniek genummerd) diagram.
  const derde = await transformatie.run({ bron: { naam: "actoren.mmd", tekst: actoren }, doelMap: "doel" });
  assert.equal(derde.summary, "1 diagram: 0 relaties geïmporteerd; 13 bestaande hergebruikt");
  assert.equal(Object.keys(useStore.getState().elements).length, naEerste + 9 + 7);
  assert.deepEqual(Object.keys(useStore.getState().diagrams), ["uc_diagram_use_case_model_klant", "uc_diagram_actor_model", "uc_diagram_actor_model_2"]);

  // Zonder hergebruik ontstaan er kopieën met een eigen id.
  await transformatie.run({ bron: { naam: "actoren.mmd", tekst: actoren }, doelMap: "doel", opties: { hergebruik: false } });
  assert.equal(telPerType(useStore.getState().elements).actor, 26);
  assert.ok(useStore.getState().elements.uc_klant_2);
});

test("wat het profiel niet toestaat of de regelset niet kent wordt gemeld, niet geraden", async () => {
  const { useStore, transformatie } = omgeving();
  const resultaat = await transformatie.run({
    bron: {
      naam: "randgevallen.mmd",
      tekst: `flowchart LR
        A(("Actor"))
        subgraph S["Systeem"]
          U(["Use case"])
          B(("Actor in kader"))
        end
        R{"Ruit"}
        A -.->|&lt;&lt;include&gt;&gt;| U
        A -.->|specialisatie| U
        A --> U
        A --> U
        N["Losse notitie"]
      `,
    },
    doelMap: "doel",
  });
  const el = useStore.getState().elements;
  assert.equal(resultaat.status, "warning");
  assert.deepEqual(resultaat.diagnostics.map((d) => [d.severity, d.code, d.sourceId]), [
    ["warning", "TRF-GEEN-REGEL", "R"],
    ["warning", "TRF-GEEN-REGEL", "v1"],
    ["warning", "TRF-GEEN-REGEL", "v2"],
    ["info", "UC-BUITEN-KADER", "B"],
  ]);
  // «include» en specialisatie tussen een actor en een use case bestaan niet:
  // gemeld en overgeslagen. De dubbele A --> U levert één associatie.
  assert.deepEqual(telPerType(el), { actor: 2, systeem: 1, usecase: 1, notitie: 1, bevat: 1, associatie: 1 });
  assert.equal(Object.values(el).find((x) => x.elementType === "notitie").data.tekst, "Losse notitie");
});

test("zonder flowchart of doelmap blijft de store onaangeraakt", async () => {
  const { useStore, mapState, transformatie } = omgeving();
  await assert.rejects(() => transformatie.run({ bron: { naam: "x.md", tekst: "classDiagram\n class A" }, doelMap: "doel" }), /Geen Mermaid flowchart/);
  await assert.rejects(() => transformatie.run({ bron: { naam: "x.mmd", tekst: fixture }, doelMap: "bestaat-niet" }), /doelmap/);
  assert.deepEqual(useStore.getState().elements, {});
  assert.deepEqual(mapState.plaatsing, {});
  assert.equal(useStore.temporal.getState().pastStates.length, 0);
});
