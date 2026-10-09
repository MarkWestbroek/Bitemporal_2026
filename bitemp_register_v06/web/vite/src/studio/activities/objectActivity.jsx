/**
 * objectActivity — "Object": UML objectdiagrammen (instance specifications
 * met classifier en slots, links) op de generieke motor. Descriptor +
 * fabriek, verder niets — zie diagramprofielen/object/.
 */
import { IconObject05 } from "../icons";
import { registreerObject, objectDiagramType, maakElement } from "../../diagramprofielen/object/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerObject();

export default maakDiagramActiviteit({
  id: "object05",
  label: "Object",
  icon: <IconObject05 />,
  descriptor: objectDiagramType,
  maakElement,
  persistKey: "studio05-object",
  taakbalkSleutel: "studio05-taakbalken-object",
  menuPrefix: "ob05",
  menuLabel: "Object",
  kleur: "#ca8a04",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "UML objectdiagram — instanties (naam : Klasse) met slots en links.",
  devHookNaam: "__object05Store",
});
