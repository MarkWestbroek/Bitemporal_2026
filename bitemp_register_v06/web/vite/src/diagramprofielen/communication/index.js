// @ts-check
/**
 * communication — registratie van het profiel (descriptor + shapes +
 * iconen). Hergebruikt `ob-object` (object-profiel) en `uc-actor`.
 * Descriptor in `descriptor.js` (puur, testbaar), EA-tabel in `eaMapping.js`.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerUml2Iconen } from "../uml2Iconen.jsx";
import { maakElementFabriek } from "../uml2Basis.js";
import { COMMUNICATION_ID, communicationDiagramType, elementTypes } from "./descriptor.js";
import "../object/vormen.js"; // de ShapeTypes (één tekenaar, stap 4): ob-object en uc-actor
import "../usecase/vormen.js";

export { COMMUNICATION_ID, communicationDiagramType };

export const maakElement = maakElementFabriek(elementTypes, "cm");

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerCommunication() {
  registreerUml2Iconen();
  if (!getDiagramType(COMMUNICATION_ID)) {
    registreerDiagramType(communicationDiagramType);
  }
}
