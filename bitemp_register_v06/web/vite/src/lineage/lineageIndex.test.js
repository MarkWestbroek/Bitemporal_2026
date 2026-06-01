import { test } from "node:test";
import assert from "node:assert/strict";
import {
  veldKey,
  extractRefs,
  bouwLineageIndex,
  lineageVoorVeld,
  alleVelden,
  gekoppeldeArtefacten,
  veldenVanArtefact,
} from "./lineageIndex.js";

// Gedeelde testvelden.
const bsn = { typenaam: "NP_Naam_Data", veldnaam: "bsn", veldpad: "NatuurlijkPersoon.namen.bsn" };
const voornaam = { typenaam: "NP_Naam_Data", veldnaam: "voornaam", veldpad: "NatuurlijkPersoon.namen.voornaam" };
const besluit = { typenaam: "Aanmelding", veldnaam: "besluit", veldpad: "Aanmelding.besluit" };

function vasteArtefacten() {
  return [
    { soort: "dmn", naam: "BepaalBesluit", inputs: [{ fieldRef: bsn }], outputs: [{ fieldRef: besluit }] },
    { soort: "bericht", naam: "InwonerAanmelding", velden: [{ ref: bsn }, { ref: voornaam }] },
    { soort: "bpmn-event", naam: "Start", kind: "message", velden: [bsn] },
    {
      soort: "contract",
      naam: "Beoordeel",
      isCall: true,
      input: { velden: [{ ref: bsn }] },
      output: { velden: [{ ref: besluit }] },
    },
  ];
}

test("veldKey maakt typenaam::veldnaam en is leeg bij onvolledige ref", () => {
  assert.equal(veldKey(bsn), "NP_Naam_Data::bsn");
  assert.equal(veldKey({ typenaam: "X" }), "");
  assert.equal(veldKey(null), "");
});

test("extractRefs leest dmn input/output met rol", () => {
  const refs = extractRefs({ soort: "dmn", naam: "D", inputs: [{ fieldRef: bsn }], outputs: [{ fieldRef: besluit }] });
  assert.deepEqual(refs.map((r) => r.rol), ["dmn-input", "dmn-output"]);
});

test("extractRefs negeert null fieldRefs", () => {
  const refs = extractRefs({ soort: "dmn", naam: "D", inputs: [{ fieldRef: null }], outputs: [] });
  assert.equal(refs.length, 0);
});

test("extractRefs leest bpmn-event velden met kind in de rol", () => {
  const refs = extractRefs({ soort: "bpmn-event", naam: "E", kind: "signal", velden: [bsn] });
  assert.equal(refs[0].rol, "event-signal");
});

test("extractRefs leest contract input én output", () => {
  const refs = extractRefs({
    soort: "contract",
    naam: "C",
    input: { velden: [{ ref: bsn }] },
    output: { velden: [{ ref: besluit }] },
  });
  assert.deepEqual(refs.map((r) => r.rol), ["contract-input", "contract-output"]);
});

test("bouwLineageIndex bundelt gebruik per veld", () => {
  const idx = bouwLineageIndex(vasteArtefacten());
  const bsnLin = lineageVoorVeld(idx, "NP_Naam_Data::bsn");
  // bsn komt voor in dmn-input, bericht, event én contract-input = 4 keer
  assert.equal(bsnLin.gebruik.length, 4);
  const soorten = bsnLin.gebruik.map((g) => g.soort).sort();
  assert.deepEqual(soorten, ["bericht", "bpmn-event", "contract", "dmn"]);
});

test("lineageVoorVeld geeft null voor onbekend veld", () => {
  const idx = bouwLineageIndex(vasteArtefacten());
  assert.equal(lineageVoorVeld(idx, "Onbekend::x"), null);
});

test("alleVelden geeft gesorteerde lijst met telling", () => {
  const idx = bouwLineageIndex(vasteArtefacten());
  const velden = alleVelden(idx);
  assert.deepEqual(velden.map((v) => v.ref.veldnaam), ["besluit", "bsn", "voornaam"]);
  const bsnRij = velden.find((v) => v.ref.veldnaam === "bsn");
  assert.equal(bsnRij.aantal, 4);
});

test("gekoppeldeArtefacten vindt artefacten die een veld delen", () => {
  const idx = bouwLineageIndex(vasteArtefacten());
  const gek = gekoppeldeArtefacten(idx, "BepaalBesluit");
  const namen = gek.map((g) => g.naam).sort();
  // BepaalBesluit deelt bsn met bericht/event/contract en besluit met contract
  assert.deepEqual(namen, ["Beoordeel", "InwonerAanmelding", "Start"]);
  const beoordeel = gek.find((g) => g.naam === "Beoordeel");
  // deelt bsn én besluit
  assert.equal(beoordeel.gedeeld.length, 2);
});

test("veldenVanArtefact geeft de refs gesorteerd op veldpad", () => {
  const idx = bouwLineageIndex(vasteArtefacten());
  const velden = veldenVanArtefact(idx, "InwonerAanmelding");
  assert.deepEqual(velden.map((r) => r.veldnaam), ["bsn", "voornaam"]);
});
