// @ts-check
/**
 * object — registratie van het profiel (descriptor + shape + iconen). De
 * descriptor staat in `descriptor.js` (puur, testbaar), de EA-tabel in
 * `eaMapping.js`.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerUml2Iconen } from "../uml2Iconen.jsx";
import { maakElementFabriek } from "../uml2Basis.js";
import { registreerObjectShapes } from "./shapes.jsx";
import { OBJECT_ID, objectDiagramType, elementTypes } from "./descriptor.js";

export { OBJECT_ID, objectDiagramType };

export const maakElement = maakElementFabriek(elementTypes, "ob");

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerObject() {
  registreerUml2Iconen();
  registreerObjectShapes();
  if (!getDiagramType(OBJECT_ID)) {
    registreerDiagramType(objectDiagramType);
  }
}
