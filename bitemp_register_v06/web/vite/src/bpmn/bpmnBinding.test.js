// bpmnBinding.test.js — tests voor de pure BPMN-binding-helpers.
// Run met: node --test src/bpmn/bpmnBinding.test.js  (vanuit web/vite/)

import test from "node:test";
import assert from "node:assert/strict";

import {
  eventKind,
  isBerichtBindbaar,
  berichttypeNaarBindingData,
  leesBinding,
  STARTER_BPMN,
} from "./bpmnBinding.js";

const messageEvent = {
  businessObject: { eventDefinitions: [{ $type: "bpmn:MessageEventDefinition" }] },
};
const signalEvent = {
  businessObject: { eventDefinitions: [{ $type: "bpmn:SignalEventDefinition" }] },
};
const plainTask = { businessObject: { $type: "bpmn:Task" } };

test("eventKind herkent message/signal/null", () => {
  assert.equal(eventKind(messageEvent), "message");
  assert.equal(eventKind(signalEvent), "signal");
  assert.equal(eventKind(plainTask), null);
  assert.equal(eventKind(null), null);
});

test("isBerichtBindbaar volgt eventKind", () => {
  assert.equal(isBerichtBindbaar(messageEvent), true);
  assert.equal(isBerichtBindbaar(signalEvent), true);
  assert.equal(isBerichtBindbaar(plainTask), false);
});

test("berichttypeNaarBindingData plat een Berichttype naar moddle-attrs", () => {
  const berichttype = {
    naam: "InwonerAanmelding",
    beschrijving: "x",
    velden: [
      {
        verplicht: true,
        ref: {
          typenaam: "NP_Naam_Data",
          veldpad: "NatuurlijkPersoon.namen.bsn",
          veldnaam: "bsn",
          type: "string",
          datatype: "BSN",
          tDimensie: "formeel",
          afgeleid: false,
        },
      },
    ],
  };
  const data = berichttypeNaarBindingData(berichttype);
  assert.equal(data.naam, "InwonerAanmelding");
  assert.equal(data.velden[0].t, "formeel");
  assert.equal(data.velden[0].datatype, "BSN");
  assert.equal(data.velden[0].verplicht, true);
});

test("leesBinding leest canoniek:Berichttype uit extensionElements", () => {
  const bo = {
    extensionElements: {
      values: [
        {
          $type: "canoniek:Berichttype",
          naam: "AdresWijziging",
          velden: [{ $type: "canoniek:FieldRef", veldnaam: "postcode", t: "materieel" }],
        },
      ],
    },
  };
  const binding = leesBinding(bo);
  assert.equal(binding.naam, "AdresWijziging");
  assert.equal(binding.velden[0].veldnaam, "postcode");
  assert.equal(binding.velden[0].t, "materieel");
});

test("leesBinding geeft null zonder binding", () => {
  assert.equal(leesBinding({}), null);
  assert.equal(leesBinding({ extensionElements: { values: [] } }), null);
});

test("STARTER_BPMN bevat message-events en is welgevormd genoeg", () => {
  assert.match(STARTER_BPMN, /<bpmn:startEvent id="StartEvent_1"/);
  assert.match(STARTER_BPMN, /bpmn:messageEventDefinition/);
  assert.match(STARTER_BPMN, /<bpmndi:BPMNDiagram/);
});
