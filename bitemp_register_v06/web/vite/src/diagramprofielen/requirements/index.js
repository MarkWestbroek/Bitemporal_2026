// @ts-check
/**
 * requirements — registratie van het profiel (descriptor + shape + iconen).
 * De descriptor staat in `descriptor.js` (puur, testbaar), de EA-tabel in
 * `eaMapping.js`.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerUml2Iconen } from "../uml2Iconen.jsx";
import { maakElementFabriek } from "../uml2Basis.js";
import { registreerRequirementsShapes } from "./shapes.jsx";
import { REQUIREMENTS_ID, requirementsDiagramType, elementTypes } from "./descriptor.js";

export { REQUIREMENTS_ID, requirementsDiagramType };

export const maakElement = maakElementFabriek(elementTypes, "rq");

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerRequirements() {
  registreerUml2Iconen();
  registreerRequirementsShapes();
  if (!getDiagramType(REQUIREMENTS_ID)) {
    registreerDiagramType(requirementsDiagramType);
  }
}
