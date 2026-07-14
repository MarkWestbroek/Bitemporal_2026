/**
 * statemachineActivity — "State machine": UML-toestandsdiagrammen op de
 * generieke motor (gedragsdiagram-verkenning). Descriptor + fabriek, verder
 * niets — zie diagramprofielen/statemachine/.
 */
import { IconStateMachine } from "../icons";
import { registreerStateMachine, statemachineDiagramType, maakElement } from "../../diagramprofielen/statemachine/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerStateMachine();

export default maakDiagramActiviteit({
  id: "statemachine05",
  label: "State machine",
  icon: <IconStateMachine />,
  descriptor: statemachineDiagramType,
  maakElement,
  persistKey: "studio05-statemachine",
  taakbalkSleutel: "studio05-taakbalken-statemachine",
  menuPrefix: "sm05",
  menuLabel: "State machine",
  kleur: "#8b5cf6",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "UML state machine — begin/toestand/eind + transities (gedragsdiagram-verkenning).",
  devHookNaam: "__statemachine05Store",
});
