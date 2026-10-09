// @ts-check
/**
 * wsdl — registratie van het profiel (descriptor + iconen; de shapes zijn
 * de basis-class-box en package). Descriptor in `descriptor.js` (puur,
 * testbaar), EA-tabel in `eaMapping.js`.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerUml2Iconen } from "../uml2Iconen.jsx";
import { maakElementFabriek } from "../uml2Basis.js";
import { WSDL_ID, wsdlDiagramType, elementTypes } from "./descriptor.js";

export { WSDL_ID, wsdlDiagramType };

export const maakElement = maakElementFabriek(elementTypes, "ws");

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerWsdl() {
  registreerUml2Iconen();
  if (!getDiagramType(WSDL_ID)) {
    registreerDiagramType(wsdlDiagramType);
  }
}
