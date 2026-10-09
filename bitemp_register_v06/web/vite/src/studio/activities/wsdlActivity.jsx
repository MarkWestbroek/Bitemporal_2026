/**
 * wsdlActivity — "WSDL": service, portType, binding, message en types als
 * klassediagram met WSDL-stereotypen. Descriptor + fabriek, verder niets —
 * zie diagramprofielen/wsdl/.
 */
import { IconWsdl05 } from "../icons";
import { registreerWsdl, wsdlDiagramType, maakElement } from "../../diagramprofielen/wsdl/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerWsdl();

export default maakDiagramActiviteit({
  id: "wsdl05",
  label: "WSDL",
  icon: <IconWsdl05 />,
  descriptor: wsdlDiagramType,
  maakElement,
  persistKey: "studio05-wsdl",
  taakbalkSleutel: "studio05-taakbalken-wsdl",
  menuPrefix: "ws05",
  menuLabel: "WSDL",
  kleur: "#0e7490",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "WSDL 1.1 — service, portType, binding, message en types met hun koppelingen.",
  devHookNaam: "__wsdl05Store",
});
