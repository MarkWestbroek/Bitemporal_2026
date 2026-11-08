// Een deel van een Studio-project als invoer voor de export (§11.17): mappen en
// domeinen (packages) recursief, met wat de elementen nodig hebben.
import test from "node:test";
import assert from "node:assert/strict";
import { vindMap, inhoudVanMappen, profielUitMappen } from "./studioProject.js";

const el = (id, elementType, extra = {}) => ({ id, naam: id, elementType, ...extra });
const lijn = (id, elementType, source, target) => ({ id, elementType, source, target });
const project = {
  structuur: {
    mappen: {
      m_dom: { id: "m_dom", naam: "Domeinen", ouderId: null },
      m_ov: { id: "m_ov", naam: "Overig", ouderId: null },
      m_inr: { id: "m_inr", naam: "Inrichting", ouderId: null },
    },
    plaatsing: {
      "el::diagram05::pkg_parkeren": "m_dom",
      "el::diagram05::pkg_gegevenstypen": "m_ov",
      "el::diagram05::Kaart": "el::diagram05::pkg_parkeren", // uitwerking: diagram onder een element
      "diagram05::d_gpk": "el::diagram05::Kaart",
      "diagram05::d_inr": "m_inr",
    },
  },
  profielen: {
    diagram05: {
      diagramTypeId: "x",
      meta: {},
      elements: {
        pkg_parkeren: el("pkg_parkeren", "package", { naam: "parkeren" }),
        pkg_gegevenstypen: el("pkg_gegevenstypen", "package", { naam: "gegevenstypen" }),
        pkg_inrichting: el("pkg_inrichting", "package", { naam: "inrichting" }),
        Kaart: el("Kaart", "entiteit"),
        KaartGegevens: el("KaartGegevens", "gegevenselement"),
        Aanvraag: el("Aanvraag", "entiteit"),
        GpkAanvraag: el("GpkAanvraag", "entiteit"),
        Kaartnummer: el("Kaartnummer", "gegevenstype"),
        Ongebruikt: el("Ongebruikt", "gegevenstype"),
        Artefact: el("Artefact", "entiteit"),
        b1: lijn("b1", "bevat", "pkg_parkeren", "Kaart"),
        b2: lijn("b2", "bevat", "pkg_parkeren", "GpkAanvraag"),
        b3: lijn("b3", "bevat", "pkg_gegevenstypen", "Kaartnummer"),
        b4: lijn("b4", "bevat", "pkg_gegevenstypen", "Ongebruikt"),
        b5: lijn("b5", "bevat", "pkg_inrichting", "Artefact"),
        c1: lijn("c1", "compositie", "Kaart", "KaartGegevens"),
        g1: lijn("g1", "gebruik", "KaartGegevens", "Kaartnummer"),
        s1: lijn("s1", "generalisatie", "GpkAanvraag", "Aanvraag"),
        r1: lijn("r1", "relatie", "Artefact", "Kaart"),
      },
      diagrams: { d_gpk: { id: "d_gpk", naam: "GPK", nodes: [{ elementId: "Kaart" }] }, d_inr: { id: "d_inr", naam: "inrichting", nodes: [{ elementId: "Artefact" }] } },
    },
  },
};

test("vindMap: map, package en pad; onbekend en dubbelzinnig geven een fout", () => {
  assert.equal(vindMap(project, "Domeinen"), "m_dom");
  assert.equal(vindMap(project, "overig/gegevenstypen"), "el::diagram05::pkg_gegevenstypen");
  assert.equal(vindMap(project, "parkeren"), "el::diagram05::pkg_parkeren");
  assert.throws(() => vindMap(project, "Zorg"), /niet gevonden/);
});

test("inhoud: recursief door packages en uitwerkingen", () => {
  const i = inhoudVanMappen(project, ["m_dom"]).diagram05;
  assert.deepEqual([...i.diagrammen], ["d_gpk"]);
  assert.ok(i.elementen.has("pkg_parkeren") && i.elementen.has("Kaart"));
});

test("profiel: alleen de relevante stukken — domein, GE's, ouder, gebruikte typen; geen inrichting", () => {
  const deel = profielUitMappen(project, ["m_dom"], "diagram05");
  assert.deepEqual(Object.keys(deel.diagrams), ["d_gpk"]);
  const ids = new Set(Object.keys(deel.elements));
  for (const id of ["Kaart", "KaartGegevens", "GpkAanvraag", "Aanvraag", "Kaartnummer", "c1", "g1", "s1"]) assert.ok(ids.has(id), id);
  for (const id of ["Ongebruikt", "Artefact", "r1", "pkg_inrichting"]) assert.ok(!ids.has(id), id);
  assert.equal(profielUitMappen(project, ["m_dom"], "bpmnMotor05"), null);
});
