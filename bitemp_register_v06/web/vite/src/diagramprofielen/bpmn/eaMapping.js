// @ts-check
/**
 * eaMapping — Sparx EA (BPMN 2.0 MDG) → bpmn-motor-profiel. In Marks GGM-
 * bestand staan BPMN-diagrammen als Diagram_Type "Analysis" (net als
 * Eriksson-Penker!); de lezer houdt ze uit elkaar op de **stereotypen**: EA's
 * BPMN-MDG zet Activity«Activity», Event«StartEvent»/«IntermediateEvent»/
 * «EndEvent», ActivityPartition«Pool»/«Lane», Decision«Gateway», Artifact
 * «DataObject»/«DataStore», Note«TextAnnotation». Puur data; id's zijn een
 * contract (EA-GUID → id).
 *
 * Event-soort en gateway-soort staan in EA in tagged values (t_objectproperties:
 * `eventDefinition`/`trigger` → soort; `gatewayDirection`/`gatewayType` →
 * exclusief/parallel/inclusief) — de lezer leest die; hieronder de vaste
 * afbeelding op Object_Type + stereotype.
 */

export const EA_DIAGRAM_TYPES = ["Analysis", "Business Process", "BPMN2.0"];
export const EA_MDG = "BPMN";

/** @type {{objectType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const OBJECTEN = [
  { objectType: "Activity", stereotype: "activity", elementType: "taak", opmerking: "tagged value activityType/isExpanded (subProcess → subproces); taskType → data.taakSoort via TAAK_SOORT" },
  { objectType: "Activity", stereotype: "task", elementType: "taak" },
  { objectType: "Activity", stereotype: "subprocess", elementType: "subproces" },
  { objectType: "Activity", stereotype: "businessprocess", elementType: "subproces" },
  { objectType: "Activity", stereotype: "decision", elementType: "exclusief", opmerking: "EA tekent een gateway soms als Activity«Decision»" },
  { objectType: "Decision", stereotype: "gateway", elementType: "exclusief", opmerking: "tagged value gatewayType → GATEWAY_TYPE (Exclusive/Parallel/Inclusive/Complex/Event)" },
  { objectType: "Decision", elementType: "exclusief" },
  { objectType: "Event", stereotype: "startevent", elementType: "start-event", opmerking: "tagged value eventDefinition/trigger → soort (bericht/timer/fout/signaal)" },
  { objectType: "Event", stereotype: "intermediateevent", elementType: "tussen-event", opmerking: "alleen met ParentID = een Activity«Activity»/«SubProcess» → boundary-event (cancelActivity → onderbrekend); in het GGM is de ouder meestal de pool → gewoon tussen-event" },
  { objectType: "ObjectNode", stereotype: "intermediateevent", elementType: "tussen-event" },
  { objectType: "Event", stereotype: "endevent", elementType: "eind-event" },
  { objectType: "Event", elementType: "tussen-event" },
  { objectType: "ActivityPartition", stereotype: "pool", elementType: "pool" },
  { objectType: "ActivityPartition", stereotype: "lane", elementType: "lane" },
  { objectType: "ActivityPartition", elementType: "lane" },
  { objectType: "Artifact", stereotype: "dataobject", elementType: "data-object", opmerking: "tagged value isCollection → data.verzameling" },
  { objectType: "Artifact", stereotype: "datastore", elementType: "data-store" },
  { objectType: "Object", stereotype: "dataobject", elementType: "data-object" },
  { objectType: "Note", stereotype: "textannotation", elementType: "notitie" },
  { objectType: "Note", elementType: "notitie" },
  { objectType: "Text", elementType: "notitie" },
];

/** @type {{connectorType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const CONNECTOREN = [
  { connectorType: "ControlFlow", stereotype: "sequenceflow", elementType: "sequence-flow", opmerking: "tagged value conditionExpression → conditie; isDefault → standaard" },
  { connectorType: "ControlFlow", stereotype: "messageflow", elementType: "message-flow" },
  { connectorType: "ControlFlow", elementType: "sequence-flow" },
  { connectorType: "InformationFlow", elementType: "message-flow" },
  { connectorType: "Dependency", stereotype: "datainputassociation", elementType: "data-associatie" },
  { connectorType: "Dependency", stereotype: "dataoutputassociation", elementType: "data-associatie" },
  { connectorType: "Dependency", stereotype: "informationrequirement", elementType: "data-associatie", opmerking: "GGM gebruikt dit stereotype op BPMN-diagrammen voor data → taak" },
  { connectorType: "Dependency", stereotype: "association", elementType: "notitielijn", opmerking: "alleen als een uiteinde een annotatie is; anders data-associatie" },
  { connectorType: "Dependency", elementType: "data-associatie", opmerking: "overig stereotype (bv. «toekomst») → data.stereotype, als label op de lijn; alleen tussen activiteit en data-object/-store" },
  { connectorType: "Association", elementType: "data-associatie", opmerking: "idem; stereotype → data.stereotype" },
  { connectorType: "ObjectFlow", elementType: "data-associatie" },
  { connectorType: "NoteLink", elementType: "notitielijn" },
  { connectorType: "Nesting", elementType: "bevat" },
];

export const RAND_ELEMENTEN = ["boundary-event"];
export const CONTAINERS = ["pool", "lane"];

/** EA-tagged value eventDefinition/trigger (kleine letters) → `data.soort` van een event. */
export const EVENT_SOORT = {
  message: "bericht",
  timer: "timer",
  error: "fout",
  signal: "signaal",
  escalation: "escalatie",
  compensation: "compensatie",
  compensate: "compensatie",
  conditional: "conditioneel",
  link: "link",
  cancel: "annulering",
  terminate: "terminate",
};
/** EA-tagged value gatewayType (kleine letters) → gateway-elementtype. */
export const GATEWAY_TYPE = { exclusive: "exclusief", parallel: "parallel", inclusive: "inclusief", complex: "complex", event: "event-gateway", "event-based": "event-gateway", eventbased: "event-gateway" };
/** EA-tagged value taskType (kleine letters) → `data.taakSoort` van een taak. */
export const TAAK_SOORT = { abstract: "", user: "user", service: "service", send: "send", receive: "receive", manual: "manual", script: "script", businessrule: "businessRule" };
