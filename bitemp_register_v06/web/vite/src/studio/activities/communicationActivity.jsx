/**
 * communicationActivity — "Communication": interactie als graaf — objecten,
 * links en genummerde berichten op de link. Descriptor + fabriek, verder
 * niets — zie diagramprofielen/communication/.
 */
import { IconCommunication05 } from "../icons";
import { registreerCommunication, communicationDiagramType, maakElement } from "../../diagramprofielen/communication/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerCommunication();

export default maakDiagramActiviteit({
  id: "communication05",
  label: "Communication",
  icon: <IconCommunication05 />,
  descriptor: communicationDiagramType,
  maakElement,
  persistKey: "studio05-communication",
  taakbalkSleutel: "studio05-taakbalken-communication",
  menuPrefix: "cm05",
  menuLabel: "Communication",
  kleur: "#db2777",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "UML communication diagram — objecten, links en genummerde berichten (de graaf-zus van sequence).",
  devHookNaam: "__communication05Store",
});
