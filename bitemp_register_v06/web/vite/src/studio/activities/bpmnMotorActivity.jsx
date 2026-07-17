/**
 * bpmnMotorActivity — "BPMN": BPMN-diagrammen op de generieke motor (v0),
 * naast de klassieke bpmn.io-activiteit ("BPMN-processen"). Boundary events
 * op het rand-primitief, subproces-doorklik via de gedragsverwijzing.
 * Descriptor + fabriek, verder niets — zie diagramprofielen/bpmn/.
 */
import { IconBPMN } from "../icons";
import { registreerBpmnMotor, bpmnMotorDiagramType, maakElement } from "../../diagramprofielen/bpmn/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerBpmnMotor();

export default maakDiagramActiviteit({
  id: "bpmnMotor05",
  label: "BPMN",
  icon: <IconBPMN />,
  descriptor: bpmnMotorDiagramType,
  maakElement,
  persistKey: "studio05-bpmn-motor",
  taakbalkSleutel: "studio05-taakbalken-bpmn-motor",
  menuPrefix: "bp05",
  menuLabel: "BPMN",
  kleur: "#ec4899",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "BPMN op de eigen motor — taken, events (incl. boundary), gateways en lanes (v0).",
  devHookNaam: "__bpmnMotor05Store",
});
