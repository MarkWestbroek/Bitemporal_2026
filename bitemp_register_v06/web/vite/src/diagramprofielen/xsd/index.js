// @ts-check
/**
 * xsd — registratie van het profiel (descriptor + iconen; de shapes zijn de
 * basis-class-box, chip en package). Descriptor in `descriptor.js` (puur,
 * testbaar), EA-tabel in `eaMapping.js`.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerUml2Iconen } from "../uml2Iconen.jsx";
import { maakElementFabriek } from "../uml2Basis.js";
import { XSD_ID, xsdDiagramType, elementTypes } from "./descriptor.js";

export { XSD_ID, xsdDiagramType };

export const maakElement = maakElementFabriek(elementTypes, "xs");

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerXsd() {
  registreerUml2Iconen();
  if (!getDiagramType(XSD_ID)) {
    registreerDiagramType(xsdDiagramType);
  }
}
