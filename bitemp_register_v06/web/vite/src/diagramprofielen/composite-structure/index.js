// @ts-check
/**
 * composite-structure — registratie van het profiel (descriptor + shapes +
 * iconen). Hergebruikt `sysml-poort` en `uc-ellips`; verder class-box en
 * package. Descriptor in `descriptor.js` (puur, testbaar), EA-tabel in
 * `eaMapping.js`.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerUml2Iconen } from "../uml2Iconen.jsx";
import { maakElementFabriek } from "../uml2Basis.js";
import { registreerSysmlShapes } from "../sysml/shapes.jsx";
import { registreerUseCaseShapes } from "../usecase/shapes.jsx";
import { COMPOSITE_STRUCTURE_ID, compositeStructureDiagramType, elementTypes } from "./descriptor.js";

export { COMPOSITE_STRUCTURE_ID, compositeStructureDiagramType };

export const maakElement = maakElementFabriek(elementTypes, "cs");

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerCompositeStructure() {
  registreerUml2Iconen();
  registreerSysmlShapes();
  registreerUseCaseShapes();
  if (!getDiagramType(COMPOSITE_STRUCTURE_ID)) {
    registreerDiagramType(compositeStructureDiagramType);
  }
}
