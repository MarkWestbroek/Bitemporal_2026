/**
 * bpmnBinding.js — pure helpers voor het binden van een Berichttype aan een
 * BPMN message/signal-event. Geen bpmn-js-afhankelijkheid, zodat de logica
 * los te testen is (de modeler-integratie zit in BpmnEditor.jsx).
 *
 * Stap 4 van de "driehoek proces – regels – data".
 * Zie process_engine_v01/docs/driehoek-proces-regels-data.md.
 */

/**
 * Bepaal het bindbare event-type van een diagram-element op basis van zijn
 * businessObject.eventDefinitions. Retourneert "message" | "signal" | null.
 */
export function eventKind(element) {
  const bo = element?.businessObject || element || {};
  const defs = Array.isArray(bo.eventDefinitions) ? bo.eventDefinitions : [];
  if (defs.some((d) => d?.$type === "bpmn:MessageEventDefinition")) return "message";
  if (defs.some((d) => d?.$type === "bpmn:SignalEventDefinition")) return "signal";
  return null;
}

/** Kan aan dit element een Berichttype gebonden worden? */
export function isBerichtBindbaar(element) {
  return eventKind(element) !== null;
}

/**
 * Zet een Berichttype (uit berichtModel.js) om naar platte binding-data:
 * de attributen die de moddle-elementen canoniek:Berichttype + canoniek:FieldRef
 * nodig hebben. Pure transformatie, los testbaar.
 */
export function berichttypeNaarBindingData(berichttype) {
  return {
    naam: berichttype?.naam || "",
    beschrijving: berichttype?.beschrijving || "",
    velden: (berichttype?.velden || []).map((v) => {
      const r = v.ref || {};
      return {
        typenaam: r.typenaam || "",
        veldpad: r.veldpad || "",
        veldnaam: r.veldnaam || "",
        type: r.type || "",
        format: r.format || "",
        datatype: r.datatype || "",
        t: r.tDimensie || "formeel",
        afgeleid: Boolean(r.afgeleid),
        verplicht: Boolean(v.verplicht),
      };
    }),
  };
}

/**
 * Lees een bestaande Berichttype-binding uit een businessObject. Retourneert
 * {naam, beschrijving, velden[]} of null. Pure functie (werkt op de
 * moddle-/plain-vorm van extensionElements).
 */
export function leesBinding(businessObject) {
  const ext = businessObject?.extensionElements;
  const values = Array.isArray(ext?.values) ? ext.values : [];
  const bt = values.find((v) => v?.$type === "canoniek:Berichttype");
  if (!bt) return null;
  return {
    naam: bt.naam || "",
    beschrijving: bt.beschrijving || "",
    velden: (bt.velden || []).map((f) => ({
      typenaam: f.typenaam || "",
      veldpad: f.veldpad || "",
      veldnaam: f.veldnaam || "",
      type: f.type || "",
      format: f.format || "",
      datatype: f.datatype || "",
      t: f.t || "formeel",
      afgeleid: Boolean(f.afgeleid),
      verplicht: Boolean(f.verplicht),
    })),
  };
}

/** Startdiagram: een proces met message-start, taak, message-catch en message-end. */
export const STARTER_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_canoniek" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:message id="Message_Start" name="InwonerAanmelding" />
  <bpmn:message id="Message_Catch" name="AdresWijziging" />
  <bpmn:message id="Message_End" name="RegistratieBevestiging" />
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Aanmelding ontvangen">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
      <bpmn:messageEventDefinition id="MsgDef_1" messageRef="Message_Start" />
    </bpmn:startEvent>
    <bpmn:callActivity id="Task_1" name="Beoordeel aanmelding" calledElement="Subproces_Beoordeling">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:callActivity>
    <bpmn:intermediateCatchEvent id="Catch_1" name="Adreswijziging">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
      <bpmn:messageEventDefinition id="MsgDef_2" messageRef="Message_Catch" />
    </bpmn:intermediateCatchEvent>
    <bpmn:endEvent id="End_1" name="Bevestiging verstuurd">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:messageEventDefinition id="MsgDef_3" messageRef="Message_End" />
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Catch_1" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Catch_1" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="82" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="129" y="125" width="84" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="240" y="60" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Catch_1_di" bpmnElement="Catch_1">
        <dc:Bounds x="392" y="82" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="378" y="125" width="64" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="492" y="82" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="470" y="125" width="82" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="188" y="100" /><di:waypoint x="240" y="100" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="340" y="100" /><di:waypoint x="392" y="100" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="428" y="100" /><di:waypoint x="492" y="100" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
