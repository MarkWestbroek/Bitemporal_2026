// Beslistabel "Aanvraag ontvankelijk" (Mark 30-10, plan Beslissing en
// beschikking §6.1): DMN-model + objecttype → dmn-artefact, met per kolom waar
// de engine de waarde vindt.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { DOMParser } from "@xmldom/xmldom";

import { maakDmnArtefact, invoerVoorVeld } from "./dmnArtefact.js";
import { schrijfDmn, typeRef } from "../../transformatie/dmnXmlSchrijver.js";
import { maakObjecttypeArtefact } from "../canoniek-uml/objecttypeArtefact.js";

const CG = new URL("../canoniek-uml/fixtures/cg-test/", import.meta.url);
const lees = (naam) => JSON.parse(fs.readFileSync(new URL(naam, CG), "utf8"));
const sha256Hex = (t) => crypto.createHash("sha256").update(t, "utf8").digest("hex");
const datatypen = JSON.parse(fs.readFileSync(new URL("../../../../../testdata/gegevenstypen.json", import.meta.url), "utf8")).datatypes;

const objecttype = async () =>
  (
    await maakObjecttypeArtefact({
      modelBestand: lees("omnium-model-cg-test-v3.json"),
      edienst: lees("gpk-edienst.json"),
      datatypen,
      referentielijsten: { Aanvraagtype: lees("aanvraag-aanvraagtypen.json"), Partijrol: lees("relatiebeheer-partijrollen.json") },
      identifier: "gehandicaptenparkeerkaartaanvraag",
      sha256Hex,
    })
  ).artefact;

test("typeRef: model- en Go-typen naar FEEL-basistypen", () => {
  assert.equal(typeRef("bool"), "boolean");
  assert.equal(typeRef("int64"), "number");
  assert.equal(typeRef(""), "string");
});

test("invoerVoorVeld: veld → JSON-pointer, meervoudig GE → lijst, envelop → procesvariabele", async () => {
  const ot = await objecttype();
  assert.deepEqual(invoerVoorVeld("GehandicaptenparkeerkaartAanvraag.GpkAanvraagKaart.soort", ot), { bron: "dossier", pointer: "/soort", lijst: false });
  assert.deepEqual(invoerVoorVeld("Aanvraag.AanvraagBijlage.naam", ot), { bron: "dossier", pointer: "/bijlagen", lijst: true });
  assert.deepEqual(invoerVoorVeld("envelop:bsn", ot), { bron: "variabele", variabele: "bsn" });
  assert.equal(invoerVoorVeld("Bestaat.Niet.veld", ot), null);
});

test("aanvraag-ontvankelijk: DMN 1.3, FIRST, vijf regels, invoer per kolom", async () => {
  const { artefact, diagnostics, invoer } = await maakDmnArtefact({
    modelBestand: lees("gpk-beslissingen.dmn-model.json"),
    edienst: lees("gpk-edienst.json"),
    identifier: "aanvraag-ontvankelijk",
    objecttype: await objecttype(),
    sha256Hex,
  });
  // Sinds Mark het rijbewijsnummer toevoegde (31-10) staat elk veld in het objecttype.
  assert.deepEqual(diagnostics, []);

  const xml = artefact.artefactInhoud.payload;
  assert.equal(artefact.artefactInhoud.payloadHash, sha256Hex(xml));
  assert.equal(artefact.artefactInhoud.formaat, "dmn-xml");
  assert.equal(artefact.artefactHerkomst.schrijverId, "dmn-xml-schrijver@0.1.0");
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const decision = doc.getElementsByTagName("dmn:decision")[0];
  assert.equal(decision.getAttribute("id"), "aanvraag-ontvankelijk");
  assert.equal(doc.getElementsByTagName("dmn:decisionTable")[0].getAttribute("hitPolicy"), "FIRST");
  assert.equal(doc.getElementsByTagName("dmn:rule").length, 5);
  assert.deepEqual([...doc.getElementsByTagName("dmn:output")].map((o) => [o.getAttribute("name"), o.getAttribute("typeRef")]), [
    ["ontvankelijk", "boolean"],
    ["reden", "string"],
  ]);
  // Zonder bijlagen is `some …` null, en null matcht de regel "false" niet; feel-scala eist haakjes om
  // een kwantor rechts van `and` (FUNDAMENT 31-10).
  assert.match(xml, /<dmn:text>bijlagen != null and \(some b in bijlagen satisfies b.naam = &quot;pasfoto&quot;\)<\/dmn:text>/);

  assert.deepEqual(invoer.map((x) => [x.naam, x.bron, x.pointer || x.variabele]), [
    ["bsn", "variabele", "bsn"],
    ["bijlagen", "dossier", "/bijlagen"],
    ["eerdereKaart", "dossier", "/eerdereKaart"],
    ["eerderKaartnummer", "dossier", "/eerderKaartnummer"],
    ["soort", "dossier", "/soort"],
    ["rijbewijsnummer", "dossier", "/rijbewijsnummer"],
  ]);
  assert.deepEqual(artefact.afhankelijkheden.map((a) => [a.identifier, a.soort]), [["gehandicaptenparkeerkaart", "dossierdefinitie"], ["gehandicaptenparkeerkaartaanvraag", "objecttype"]]);
});

test("schrijver: lege cel = '-', ontbrekende uitkomst geeft een melding", () => {
  const tabel = {
    hitPolicy: "unique",
    inputs: [{ id: "i", naam: "x", type: "int" }],
    outputs: [{ id: "o", naam: "y", type: "string" }],
    rules: [{ id: "r", inputEntries: { i: "" }, outputEntries: {} }],
  };
  const { xml, diagnostics } = schrijfDmn({ beslissing: { id: "b", tabel } });
  assert.match(xml, /<dmn:inputEntry id="r-i"><dmn:text>-<\/dmn:text><\/dmn:inputEntry>/);
  assert.match(xml, /hitPolicy="UNIQUE"/);
  assert.deepEqual(diagnostics.map((d) => d.code), ["DMN-SCHRIJVER"]);
});

// Binding via de uuid (besluit Mark 31-10, BACKLOG §40): hernoem je het veld in het model, dan
// volgt de kolom; de export schrijft het naampad van dát moment.
test("kolom gebonden via de uuid volgt een hernoeming; export op het naampad van nu", async () => {
  const v3 = lees("omnium-model-cg-test-v3.json");
  const ge = (v3.model || v3).entiteiten.flatMap((e) => e.gegevenselementen || []).find((g) => g.naam === "GpkAanvraagKaart");
  const veld = ge.velden.find((v) => v.naam === "soort");
  veld.uuid = "8f1c2d3e-0000-4000-8000-000000000001";
  veld.naam = "kaartsoort";
  const edienst = lees("gpk-edienst.json");
  const ot = edienst.artefacten.find((a) => a.identifier === "gehandicaptenparkeerkaartaanvraag");
  const s = JSON.stringify(ot).split('"GehandicaptenparkeerkaartAanvraag.GpkAanvraagKaart.soort"').join('"GehandicaptenparkeerkaartAanvraag.GpkAanvraagKaart.kaartsoort"');
  Object.assign(ot, JSON.parse(s));
  const objecttypeNu = (
    await maakObjecttypeArtefact({
      modelBestand: v3,
      edienst,
      datatypen,
      referentielijsten: { Aanvraagtype: lees("aanvraag-aanvraagtypen.json"), Partijrol: lees("relatiebeheer-partijrollen.json") },
      identifier: "gehandicaptenparkeerkaartaanvraag",
      sha256Hex,
    })
  ).artefact;

  const dmn = lees("gpk-beslissingen.dmn-model.json");
  const besl = Object.values((dmn.model || dmn).elements).find((e) => e.elementType === "decision");
  const kolom = besl.data.beslistabel.inputs.find((c) => c.naam === "soort");
  kolom.fieldRef.uuid = veld.uuid; // opgeslagen met de oude naam

  const { artefact, diagnostics, invoer } = await maakDmnArtefact({ modelBestand: dmn, edienst, identifier: "aanvraag-ontvankelijk", objecttype: objecttypeNu, v3Model: v3, sha256Hex });
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(invoer.find((x) => x.naam === "soort"), { naam: "soort", bron: "dossier", pointer: "/kaartsoort", lijst: false });
  const trace = artefact.traceregels.find((t) => t.doelPad === "#aanvraag-ontvankelijk/input/soort");
  assert.equal(trace.bronGE, "GehandicaptenparkeerkaartAanvraag.GpkAanvraagKaart.kaartsoort");
  assert.equal(trace.bronUuid, veld.uuid);

  // Veld met die uuid weg uit het model: melding, en het opgeslagen naampad blijft.
  ge.velden = ge.velden.filter((v) => v !== veld);
  const weg = await maakDmnArtefact({ modelBestand: dmn, edienst, identifier: "aanvraag-ontvankelijk", objecttype: objecttypeNu, v3Model: v3, sha256Hex });
  assert.ok(weg.diagnostics.some((d) => d.code === "DMN-UUID"));
});
