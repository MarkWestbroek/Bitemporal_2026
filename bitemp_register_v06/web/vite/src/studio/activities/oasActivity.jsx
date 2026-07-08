/**
 * oasActivity — "OAS (0.5)": OpenAPI 3.1-schemas op de generieke
 * diagram-motor. Derde profiel (fase 5-vuurproef): descriptor + fabriek,
 * verder niets — zie diagramprofielen/oas31/.
 */
import { parse as parseYaml, stringify as naarYaml } from "yaml";
import { IconOAS05 } from "../icons";
import { registreerOas31, oas31DiagramType, maakElement } from "../../diagramprofielen/oas31/index.js";
import { vanOasDocument, naarOasDocument } from "../../diagramprofielen/oas31/adapter.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerOas31();

export default maakDiagramActiviteit({
  id: "oas05",
  label: "OAS (0.5)",
  icon: <IconOAS05 />,
  descriptor: oas31DiagramType,
  maakElement,
  persistKey: "studio05-oas31",
  taakbalkSleutel: "studio05-taakbalken-oas31",
  menuPrefix: "o05",
  menuLabel: "OAS (0.5)",
  previewTekst: "OpenAPI 3.1-schemas — derde profiel (fase 5-vuurproef), lege sandbox.",
  devHookNaam: "__oas05Store",
  koppeling: {
    /** OAS 3.1 YAML/JSON → diagram (YAML is een superset van JSON). */
    importBestand: {
      label: "Importeer OAS 3.1 (YAML/JSON)…",
      accept: ".yaml,.yml,.json",
      verwerk: (tekst) => {
        const doc = parseYaml(tekst);
        if (!doc || typeof doc !== "object" || (!doc.openapi && !doc.swagger)) {
          throw new Error("Dit lijkt geen OpenAPI-document (openapi-veld ontbreekt).");
        }
        return vanOasDocument(doc);
      },
    },
    /** Terugreis: sandbox → OpenAPI 3.1 YAML (spiegel + delta). */
    exportBestand: {
      label: "Exporteer OAS 3.1 (YAML)…",
      bestandsnaam: (staat) =>
        `${(staat.meta?.oasInfo?.title || "openapi").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.yaml`,
      maak: (staat) => naarYaml(naarOasDocument(staat)),
    },
  },
});
