// @ts-check
/**
 * communication — registratie van het profiel (descriptor + shapes +
 * iconen). Hergebruikt `ob-object` (object-profiel) en `uc-actor`.
 * Descriptor in `descriptor.js` (puur, testbaar), EA-tabel in `eaMapping.js`.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerUml2Iconen } from "../uml2Iconen.jsx";
import { maakElementFabriek } from "../uml2Basis.js";
import { registreerObjectShapes } from "../object/shapes.jsx";
import { registreerUseCaseShapes } from "../usecase/shapes.jsx";
import { COMMUNICATION_ID, communicationDiagramType, elementTypes } from "./descriptor.js";

export { COMMUNICATION_ID, communicationDiagramType };

export const maakElement = maakElementFabriek(elementTypes, "cm");

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerCommunication() {
  registreerUml2Iconen();
  registreerObjectShapes();
  registreerUseCaseShapes();
  if (!getDiagramType(COMMUNICATION_ID)) {
    registreerDiagramType(communicationDiagramType);
  }
}
