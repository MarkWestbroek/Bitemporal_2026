// procesContract.test.js — tests voor de pure Procescontract-helpers.
// Run met: node --test src/bpmn/procesContract.test.js  (vanuit web/vite/)

import test from "node:test";
import assert from "node:assert/strict";

import {
  leegContract,
  isContractDrager,
  isCallActivity,
  bindbaarSoort,
  leesContract,
  contractNaarIoMapping,
  valideerContract,
  naarCamundaIoXml,
  naarV3Contract,
} from "./procesContract.js";

const proces = { businessObject: { $type: "bpmn:Process" } };
const callActivity = { businessObject: { $type: "bpmn:CallActivity" } };
const messageEvent = {
  businessObject: { $type: "bpmn:StartEvent", eventDefinitions: [{ $type: "bpmn:MessageEventDefinition" }] },
};
const task = { businessObject: { $type: "bpmn:Task" } };

function bericht(naam, veldnamen) {
  return {
    naam,
    beschrijving: "",
    velden: veldnamen.map((n) => ({
      verplicht: n === "bsn",
      ref: { typenaam: "NatuurlijkPersoon", veldnaam: n, veldpad: `NatuurlijkPersoon.${n}`, type: "string", tDimensie: "formeel" },
    })),
  };
}

test("isContractDrager / isCallActivity herkennen types", () => {
  assert.equal(isContractDrager(proces), true);
  assert.equal(isContractDrager(callActivity), true);
  assert.equal(isContractDrager(task), false);
  assert.equal(isCallActivity(callActivity), true);
  assert.equal(isCallActivity(proces), false);
});

test("bindbaarSoort onderscheidt contract/event/null", () => {
  assert.equal(bindbaarSoort(proces), "contract");
  assert.equal(bindbaarSoort(callActivity), "contract");
  assert.equal(bindbaarSoort(messageEvent), "event");
  assert.equal(bindbaarSoort(task), null);
});

test("leegContract is null/null", () => {
  assert.deepEqual(leegContract(), { input: null, output: null });
});

test("contractNaarIoMapping maakt 1-op-1 in/out per veld", () => {
  const contract = { input: bericht("Aanmelding", ["bsn", "geboortedatum"]), output: bericht("Bevestiging", ["status"]) };
  const m = contractNaarIoMapping(contract);
  assert.equal(m.in.length, 2);
  assert.equal(m.out.length, 1);
  assert.equal(m.in[0].source, "bsn");
  assert.equal(m.in[0].target, "bsn");
  assert.equal(m.out[0].source, "status");
});

test("valideerContract meldt lege projectie als fout", () => {
  const contract = { input: { naam: "X", velden: [] }, output: null };
  const meldingen = valideerContract(contract);
  assert.equal(meldingen.filter((m) => m.niveau === "fout").length, 1);
});

test("valideerContract waarschuwt bij leeg contract", () => {
  const meldingen = valideerContract(leegContract());
  assert.ok(meldingen.some((m) => m.niveau === "waarschuwing"));
});

test("valideerContract meldt getypeerde CallActivity-mapping", () => {
  const contract = { input: bericht("Aanmelding", ["bsn"]), output: bericht("Bevestiging", ["status"]) };
  const meldingen = valideerContract(contract, { isCall: true });
  const info = meldingen.find((m) => m.niveau === "info");
  assert.ok(info);
  assert.match(info.tekst, /camunda:in/);
  assert.match(info.tekst, /variables="all"/);
});

test("naarCamundaIoXml levert getypeerde in/out-regels", () => {
  const contract = { input: bericht("Aanmelding", ["bsn"]), output: bericht("Bevestiging", ["status"]) };
  const xml = naarCamundaIoXml(contract);
  assert.match(xml, /<camunda:in source="bsn" target="bsn"/);
  assert.match(xml, /<camunda:out source="status" target="status"/);
  assert.match(xml, /canoniek:veldpad="NatuurlijkPersoon.bsn"/);
});

test("leesContract round-trip uit moddle-vorm", () => {
  const bo = {
    extensionElements: {
      values: [
        {
          $type: "canoniek:Procescontract",
          berichten: [
            {
              kant: "input",
              naam: "Aanmelding",
              velden: [{ typenaam: "NatuurlijkPersoon", veldnaam: "bsn", veldpad: "NatuurlijkPersoon.bsn", t: "formeel", verplicht: true }],
            },
            { kant: "output", naam: "Bevestiging", velden: [{ veldnaam: "status", t: "materieel" }] },
          ],
        },
      ],
    },
  };
  const contract = leesContract(bo);
  assert.equal(contract.input.naam, "Aanmelding");
  assert.equal(contract.input.velden[0].ref.veldnaam, "bsn");
  assert.equal(contract.input.velden[0].verplicht, true);
  assert.equal(contract.output.velden[0].ref.tDimensie, "materieel");
});

test("leesContract geeft leeg contract zonder extensies", () => {
  assert.deepEqual(leesContract({}), { input: null, output: null });
});

test("naarV3Contract plat een contract af", () => {
  const contract = { input: bericht("Aanmelding", ["bsn"]), output: null };
  const v3 = naarV3Contract(contract);
  assert.equal(v3.input.naam, "Aanmelding");
  assert.equal(v3.input.velden[0].veldpad, "NatuurlijkPersoon.bsn");
  assert.equal(v3.output, null);
});
