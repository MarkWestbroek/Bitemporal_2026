// @ts-check
/**
 * simulatie — registratie van het profiel (descriptor + shape). De descriptor staat in
 * `descriptor.js` (puur, testbaar).
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerUml2Iconen } from "../uml2Iconen.jsx";
import { maakElementFabriek } from "../uml2Basis.js";
import { SIMULATIE_ID, simulatieDiagramType, elementTypes } from "./descriptor.js";
import "./vormen.js";

export { SIMULATIE_ID, simulatieDiagramType };

export const maakElement = maakElementFabriek(elementTypes, "sm");

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerSimulatie() {
  registreerUml2Iconen();
  if (!getDiagramType(SIMULATIE_ID)) {
    registreerDiagramType(simulatieDiagramType);
  }
}
