/**
 * oasActivity — "OAS (0.5)": OpenAPI 3.1-schemas op de generieke
 * diagram-motor. Derde profiel (fase 5-vuurproef): descriptor + fabriek,
 * verder niets — zie diagramprofielen/oas31/.
 */
import { IconAPI } from "../icons";
import { registreerOas31, oas31DiagramType, maakElement } from "../../diagramprofielen/oas31/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerOas31();

export default maakDiagramActiviteit({
  id: "oas05",
  label: "OAS (0.5)",
  icon: <IconAPI />,
  descriptor: oas31DiagramType,
  maakElement,
  persistKey: "studio05-oas31",
  taakbalkSleutel: "studio05-taakbalken-oas31",
  menuPrefix: "o05",
  menuLabel: "OAS (0.5)",
  previewTekst: "OpenAPI 3.1-schemas — derde profiel (fase 5-vuurproef), lege sandbox.",
  devHookNaam: "__oas05Store",
});
