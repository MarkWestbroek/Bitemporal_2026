// @ts-check
/**
 * bpmnXmlRegels — de **regelset** "BPMN 2.0 XML → BPMN-profiel (bpmn-motor)".
 * Data, geen code: per bron-item (knoop/groep/verbinding uit de lezer
 * `transformatie/bpmnXml.js`) een geordende lijst `als … maak …`-regels; de
 * eerste die past wint. Wat de BPMN-syntax is weet de lezer, wat ons profiel
 * ermee doet staat hier.
 *
 * Event-soorten: de lezer levert `eventDefinitie` (message, timer, error,
 * signal, …); het profiel kent `soort` bericht/timer/fout/signaal. Dat is een
 * vaste vertaling, dus één regel per (event, definitie)-paar — gegenereerd
 * uit twee tabelletjes, maar nog steeds data.
 */

const SOORTEN = [
  ["message", "bericht"],
  ["timer", "timer"],
  ["error", "fout"],
  ["signal", "signaal"],
  ["escalation", "escalatie"],
  ["compensate", "compensatie"],
  ["conditional", "conditioneel"],
  ["link", "link"],
  ["cancel", "annulering"],
  ["terminate", "terminate"],
];
const EVENTS = [
  ["startEvent", "start-event"],
  ["endEvent", "eind-event"],
  ["intermediateCatchEvent", "tussen-event"],
  ["intermediateThrowEvent", "tussen-event"],
];

const eventRegels = [];
for (const [aard, type] of EVENTS) {
  for (const [definitie, soort] of SOORTEN) {
    eventRegels.push({ naam: `${aard} (${definitie})`, bij: "knoop", als: { aard, eventDefinitie: definitie }, maak: { type, data: { soort } } });
  }
  eventRegels.push({ naam: `${aard}`, bij: "knoop", als: { aard }, maak: { type, data: { soort: "" } } });
}
const boundaryRegels = [];
for (const [definitie, soort] of SOORTEN) {
  boundaryRegels.push({ naam: `boundaryEvent (${definitie})`, bij: "knoop", als: { aard: "boundaryEvent", eventDefinitie: definitie }, maak: { type: "boundary-event", data: { soort, onderbrekend: "{onderbrekend}" } } });
}
boundaryRegels.push({ naam: "boundaryEvent", bij: "knoop", als: { aard: "boundaryEvent" }, maak: { type: "boundary-event", data: { soort: "", onderbrekend: "{onderbrekend}" } } });

/** BPMN-taakelement → `taakSoort` (BPMN 2.0 §10.3). */
const TAKEN = [
  ["task", ""],
  ["userTask", "user"],
  ["serviceTask", "service"],
  ["sendTask", "send"],
  ["receiveTask", "receive"],
  ["manualTask", "manual"],
  ["scriptTask", "script"],
  ["businessRuleTask", "businessRule"],
  ["callActivity", ""],
];
const taakRegels = TAKEN.map(([aard, taakSoort]) => ({ naam: `Taak (${aard})`, bij: "knoop", als: { aard }, maak: { type: "taak", data: { taakSoort, bpmnAard: "{aard}" } } }));
const SUBPROCESSEN = ["subProcess", "adHocSubProcess", "transaction"];

export const BPMN_XML_NAAR_BPMN = {
  id: "bpmn-xml-naar-bpmn-motor",
  versie: 1,
  titel: "BPMN 2.0 XML → BPMN-profiel",
  bron: "bpmn-xml",
  doel: "bpmn-motor",
  regels: [
    // ── Knopen ──
    ...taakRegels,
    { naam: "Subproces", bij: "knoop", als: { aard: SUBPROCESSEN }, maak: { type: "subproces", data: { bpmnAard: "{aard}" } } },
    ...eventRegels,
    ...boundaryRegels,
    { naam: "Exclusieve gateway", bij: "knoop", als: { aard: "exclusiveGateway" }, maak: { type: "exclusief" } },
    { naam: "Parallelle gateway", bij: "knoop", als: { aard: "parallelGateway" }, maak: { type: "parallel" } },
    { naam: "Inclusieve gateway", bij: "knoop", als: { aard: "inclusiveGateway" }, maak: { type: "inclusief" } },
    { naam: "Event-based gateway", bij: "knoop", als: { aard: "eventBasedGateway" }, maak: { type: "event-gateway" } },
    { naam: "Complexe gateway", bij: "knoop", als: { aard: "complexGateway" }, maak: { type: "complex" } },
    { naam: "Data-object", bij: "knoop", als: { aard: ["dataObjectReference", "dataObject"] }, maak: { type: "data-object", data: { verzameling: "{verzameling}" } } },
    { naam: "Data store", bij: "knoop", als: { aard: "dataStoreReference" }, maak: { type: "data-store" } },
    { naam: "Tekstannotatie", bij: "knoop", als: { aard: "textAnnotation" }, maak: { type: "notitie", naam: "", data: { tekst: "{tekst}" } } },

    // ── Groepen ──
    { naam: "Pool", bij: "groep", als: { aard: "participant" }, maak: { type: "pool" } },
    { naam: "Lane", bij: "groep", als: { aard: "lane" }, maak: { type: "lane" } },

    // ── Verbindingen ──
    { naam: "Sequence flow", bij: "verbinding", als: { aard: "sequenceFlow" }, maak: { type: "sequence-flow", naam: "{label}", data: { conditie: "{conditie}", standaard: "{standaard}" } } },
    { naam: "Message flow", bij: "verbinding", als: { aard: "messageFlow" }, maak: { type: "message-flow", naam: "{label}" } },
    { naam: "Data-invoer", bij: "verbinding", als: { aard: "dataInputAssociation" }, maak: { type: "data-associatie" } },
    { naam: "Data-uitvoer", bij: "verbinding", als: { aard: "dataOutputAssociation" }, maak: { type: "data-associatie" } },
    // Annotatie-lijn: de notitie is altijd de bron van onze notitie-lijn.
    { naam: "Notitie-lijn", bij: "verbinding", als: { aard: "association", bron: { type: "notitie" } }, maak: { type: "notitielijn" } },
    { naam: "Notitie-lijn (omgekeerd)", bij: "verbinding", als: { aard: "association", doel: { type: "notitie" } }, maak: { type: "notitielijn", omgekeerd: true } },
    { naam: "Overige associatie", bij: "verbinding", als: { aard: "association" }, negeer: true },
  ],
};
