/**
 * xsdActivity — "XML Schema": XSD als klassediagram met XSD-stereotypen
 * (schema, complexType, simpleType, element, attribute, group, enumeration).
 * Descriptor + fabriek, verder niets — zie diagramprofielen/xsd/.
 */
import { IconXsd05 } from "../icons";
import { registreerXsd, xsdDiagramType, maakElement } from "../../diagramprofielen/xsd/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerXsd();

export default maakDiagramActiviteit({
  id: "xsd05",
  label: "XML Schema",
  icon: <IconXsd05 />,
  descriptor: xsdDiagramType,
  maakElement,
  persistKey: "studio05-xsd",
  taakbalkSleutel: "studio05-taakbalken-xsd",
  menuPrefix: "xs05",
  menuLabel: "XML Schema",
  kleur: "#0d9488",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "XML Schema (XSD) — schema's, complex-/simpleTypes, elementen, attributen, groups en enumerations.",
  devHookNaam: "__xsd05Store",
});
