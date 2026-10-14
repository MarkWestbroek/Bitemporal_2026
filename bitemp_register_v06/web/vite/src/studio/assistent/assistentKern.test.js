import { test } from "node:test";
import assert from "node:assert/strict";
import { profielSamenvatting, vraagVoorModel, controleerModel, leesAntwoord, vraagVoorVelden, veldenToepassing, veldCompartimenten } from "./assistentKern.js";
import { planNaarCoreModel } from "../../transformatie/planNaarCoreModel.js";

// Zoals diagramprofielen/usecase (de verbindingsregels die ertoe doen).
const useCase = {
  id: "usecase05",
  naam: "Use case",
  elementTypes: [
    { id: "actor", label: "Actor" },
    { id: "usecase", label: "Use case", omschrijving: "iets wat een actor met het systeem doet" },
    { id: "systeem", label: "Systeem" },
    { id: "notitie", label: "Notitie" },
    { id: "associatie", label: "Associatie", isConnector: true, bron: { elementTypes: ["actor", "usecase"] }, doel: { elementTypes: ["actor", "usecase"] } },
    { id: "extend", label: "Extend", isConnector: true, bron: { elementTypes: ["usecase"] }, doel: { elementTypes: ["usecase"] } },
  ],
};

// Het voorbeeld van Mark (BACKLOG AI-2).
const antwoord = {
  uitleg: "Twee actoren, vier use cases; 'Voeg foto of document toe' breidt 'Bekijk status meldingen' uit.",
  diagramNaam: "Meldingen",
  elementen: [
    { sleutel: "a1", type: "actor", naam: "Gebruiker" },
    { sleutel: "a2", type: "actor", naam: "Beheerder" },
    { sleutel: "u1", type: "usecase", naam: "Maak feature request" },
    { sleutel: "u2", type: "usecase", naam: "Bekijk status meldingen" },
    { sleutel: "u3", type: "usecase", naam: "Voeg foto of document toe" },
    { sleutel: "u4", type: "usecase", naam: "Bekijk help" },
    { sleutel: "u5", type: "usecase", naam: "Behandel meldingen" },
    { sleutel: "x", type: "klasse", naam: "Verzonnen" },
  ],
  connectoren: [
    { sleutel: "c1", type: "associatie", bron: "a1", doel: "u1" },
    { sleutel: "c2", type: "associatie", bron: "a1", doel: "u2" },
    { sleutel: "c3", type: "associatie", bron: "a1", doel: "u4" },
    { sleutel: "c4", type: "associatie", bron: "a2", doel: "u5" },
    { sleutel: "c5", type: "extend", bron: "u3", doel: "u2" },
    { sleutel: "c6", type: "extend", bron: "a1", doel: "u2" },
    { sleutel: "c7", type: "include", bron: "u1", doel: "u2" },
  ],
};

test("profielSamenvatting: elementen zonder notitie, connectoren met regels", () => {
  const p = profielSamenvatting(useCase);
  assert.deepEqual(p.elementen.map((e) => e.id), ["actor", "usecase", "systeem"]);
  assert.deepEqual(p.connectoren.find((c) => c.id === "extend").regels, [{ bron: ["usecase"], doel: ["usecase"] }]);
});

test("vraagVoorModel: prompt noemt de typen en regels, schema eist elementen en connectoren", () => {
  const v = vraagVoorModel(useCase, "maak een use case model", { mapNaam: "Meldingen" });
  assert.match(v.systeem, /- usecase: Use case — iets wat een actor/);
  assert.match(v.systeem, /- extend: Extend — usecase → usecase/);
  assert.match(v.vraag, /map "Meldingen"/);
  assert.deepEqual(v.jsonSchema.required, ["uitleg", "diagramNaam", "elementen", "connectoren"]);
});

test("controleerModel: verzonnen type en ongeldige relaties eruit, met uitleg waarom", () => {
  const r = controleerModel(antwoord, useCase);
  assert.equal(r.plan.elementen.length, 7);
  assert.deepEqual(r.plan.connectoren.map((c) => c.sleutel), ["c1", "c2", "c3", "c4", "c5"]);
  assert.equal(r.problemen.length, 3);
  assert.match(r.problemen.join(" | "), /klasse.*bestaat niet/);
  assert.match(r.problemen.join(" | "), /Extend van actor naar usecase mag niet/);
  assert.match(r.problemen.join(" | "), /include.*bestaat niet/);
  assert.equal(r.diagramNaam, "Meldingen");
});

test("plan → core-model: elementen, relaties en een diagram met een opstelling", () => {
  const r = controleerModel(antwoord, useCase);
  const graaf = { knopen: r.plan.elementen.map((e) => ({ id: e.sleutel })), groepen: [], verbindingen: [], naam: r.diagramNaam };
  const uit = planNaarCoreModel(graaf, r.plan, { prefix: "ai", diagramTypeId: "usecase05", elementTypes: useCase.elementTypes, bestandsnaam: r.diagramNaam });
  const els = Object.values(uit.core.elements);
  assert.equal(els.filter((e) => !e.source).length, 7);
  assert.equal(els.filter((e) => e.source).length, 5);
  const diagrams = Object.values(uit.core.diagrams);
  assert.equal(diagrams.length, 1);
  assert.equal(diagrams[0].naam, "Meldingen");
  assert.equal(diagrams[0].nodes.length, 7);
  assert.ok(diagrams[0].nodes.every((n) => Number.isFinite(n.position.x)));
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
