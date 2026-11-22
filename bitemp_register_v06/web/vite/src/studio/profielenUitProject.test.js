// profielenUitProject.test.js — de profielen uit het sidecar-project in de tool laden (PROF-1 stap d).
import test from "node:test";
import assert from "node:assert/strict";
import { registreerDiagramType, getDiagramType } from "../diagramcore/types/typeRegistry.js";
import { sidecarProject } from "./sidecarProject.js";
import { kernenUitProject, laadKernen } from "./profielenUitProject.js";

const labels = (conn) => ({ kaal: [{ zijde: "midden", delen: [{ tekst: conn.data?.rol || "" }] }] });
registreerDiagramType({
  id: "laadproef",
  label: "Laadproef",
  style: "uml-klassiek",
  fieldTypes: [],
  elementTypes: [
    { id: "ding", label: "Ding", shape: "class-box", kleur: "#eeeeee", properties: [] },
    { id: "kent", label: "kent", shape: "edge", isConnector: true, bron: { elementTypes: ["ding"] }, doel: { elementTypes: ["ding"] }, hooks: { edgeLabels: labels } },
  ],
});

const projectInhoud = () => JSON.parse(JSON.stringify(sidecarProject({ descriptors: [getDiagramType("laadproef")] }))).profielen.m3Profiel05;

test("een bekend profiel wordt op zijn plek vervangen, ook zijn code (op id)", () => {
  const oud = getDiagramType("laadproef");
  const inhoud = projectInhoud();
  const ding = Object.values(inhoud.elements).find((e) => e.data?.["m3:id"] === "ding");
  ding.data["m3:kleur"] = "#123456";
  const { vervangen, nieuw, fouten } = laadKernen(kernenUitProject(inhoud));
  assert.deepEqual({ vervangen, nieuw, fouten }, { vervangen: ["laadproef"], nieuw: [], fouten: [] });
  assert.equal(getDiagramType("laadproef"), oud, "hetzelfde object");
  assert.equal(oud.elementTypes.find((e) => e.id === "ding").kleur, "#123456");
  assert.equal(oud.elementTypes.find((e) => e.id === "kent").hooks.edgeLabels, labels, "de hook is weer dezelfde code");
  assert.ok(oud.elementTypes.some((e) => e.id === "notitie" && e._superprofiel), "het superprofiel is weer aangevuld");
});

test("een onbekend profiel komt terug als kern; een onbekende code-id is een fout", () => {
  const inhoud = projectInhoud();
  const profiel = Object.values(inhoud.elements).find((e) => e.elementType === "profielDef");
  profiel.data["m3:id"] = "laadproef-kopie";
  assert.deepEqual(laadKernen(kernenUitProject(inhoud)).nieuw.map((k) => k.id), ["laadproef-kopie"]);

  const kapot = projectInhoud();
  const kent = Object.values(kapot.elements).find((e) => e.data?.["m3:id"] === "kent");
  kent.data["m3:hooks"] = { edgeLabels: "bestaat:niet" };
  const { vervangen, fouten } = laadKernen(kernenUitProject(kapot));
  assert.deepEqual(vervangen, []);
  assert.match(fouten[0], /onbekende edgeLabels-hook "bestaat:niet"/);
});

test("een leeg diagram is geen profiel en geen fout", () => {
  const inhoud = projectInhoud();
  inhoud.diagrams.leeg = { id: "leeg", naam: "Leeg", diagramType: "profiel-ontwerp", nodes: [], edges: [] };
  const kernen = kernenUitProject(inhoud);
  assert.deepEqual(kernen.map((k) => k.naam), ["Laadproef"]);
  assert.ok(kernen.every((k) => !k.fout));
});
