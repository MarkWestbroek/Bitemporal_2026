// @ts-check
/**
 * component-deployment — registratie van het profiel (descriptor + shapes +
 * iconen). De descriptor zelf staat in `descriptor.js` (puur, testbaar), de
 * EA-tabel in `eaMapping.js`.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerUml2Iconen } from "../uml2Iconen.jsx";
import { maakElementFabriek } from "../uml2Basis.js";
import { registreerComponentDeploymentShapes } from "./shapes.jsx";
import { COMPONENT_DEPLOYMENT_ID, componentDeploymentDiagramType, elementTypes } from "./descriptor.js";

export { COMPONENT_DEPLOYMENT_ID, componentDeploymentDiagramType };

/** Nieuw (niet-connector-)element van het gegeven type. */
export const maakElement = maakElementFabriek(elementTypes, "cd");

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerComponentDeployment() {
  registreerUml2Iconen();
  registreerComponentDeploymentShapes();
  if (!getDiagramType(COMPONENT_DEPLOYMENT_ID)) {
    registreerDiagramType(componentDeploymentDiagramType);
  }
}
