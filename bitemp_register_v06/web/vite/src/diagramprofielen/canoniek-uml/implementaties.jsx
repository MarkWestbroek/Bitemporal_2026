/**
 * implementaties — het Implementatie-deel van het canoniek-uml-profiel.
 *
 * Gescheiden van index.js (het Definitie-deel) zodat de descriptor vrij
 * blijft van .jsx/component-imports en onder node testbaar is — dezelfde
 * Definitie/Implementatie-splitsing als in het metamodel (plan §2).
 *
 * Registreert profiel-eigen PropertyTypeEditors in de datatype-registry:
 *   "cel-expressie" → CelExpressieEditor (hergebruikt de umleditor-modal).
 */
import { registreerPropertyTypeEditor, getPropertyTypeEditor } from "../../diagramcore/inspector/propertyTypeEditors.jsx";
import CelExpressieEditor from "./CelExpressieEditor.jsx";

/** Idempotent (veilig bij HMR/dubbele import). */
export function registreerCanoniekUmlImplementaties() {
  if (!getPropertyTypeEditor("cel-expressie")) {
    registreerPropertyTypeEditor("cel-expressie", CelExpressieEditor);
  }
}
