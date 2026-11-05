// @ts-check
/**
 * business — registratie van het Eriksson-Penker-profiel (descriptor +
 * shapes + iconen). De descriptor staat in `descriptor.js` (puur, testbaar),
 * de EA-tabel in `eaMapping.js`.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerUml2Iconen } from "../uml2Iconen.jsx";
import { maakElementFabriek } from "../uml2Basis.js";
import { registreerBusinessShapes } from "./shapes.jsx";
import { BUSINESS_ID, businessDiagramType, elementTypes } from "./descriptor.js";
import "./vormen.js"; // de ShapeTypes (één tekenaar, stap 4): canvas, documenten en render-svc

export { BUSINESS_ID, businessDiagramType };

export const maakElement = maakElementFabriek(elementTypes, "ep");

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerBusiness() {
  registreerUml2Iconen();
  registreerBusinessShapes();
  if (!getDiagramType(BUSINESS_ID)) {
    registreerDiagramType(businessDiagramType);
  }
}
