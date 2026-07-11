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
  label: "OAS",
  icon: <IconOAS05 />,
  descriptor: oas31DiagramType,
  maakElement,
  persistKey: "studio05-oas31",
  taakbalkSleutel: "studio05-taakbalken-oas31",
  menuPrefix: "o05",
  menuLabel: "OAS",
  previewTekst: "OpenAPI 3.1-schemas — derde profiel (fase 5-vuurproef), lege sandbox.",
  devHookNaam: "__oas05Store",
  koppeling: {
    /**
     * OAS 3.0/3.1 YAML/JSON → diagram (YAML is een superset van JSON).
     * Na het kiezen van het bestand volgt de dialectkeuze op basis van het
     * openapi-veld: auto (default, volg het document), 3.0 of 3.1. De keuze
     * komt als oas-version op het api-element en stuurt de export.
     */
    importBestand: {
      label: "Importeer OAS 3.0/3.1 (YAML/JSON)…",
      accept: ".yaml,.yml,.json",
      verwerk: (tekst) => {
        const doc = parseYaml(tekst);
        if (!doc || typeof doc !== "object" || (!doc.openapi && !doc.swagger)) {
          throw new Error("Dit lijkt geen OpenAPI-document (openapi-veld ontbreekt).");
        }
        const gedetecteerd = doc.openapi ? `openapi ${doc.openapi}` : "geen openapi-veld";
        const keuze = (
          window.prompt(
            `OAS-versie voor de import (gedetecteerd: ${gedetecteerd}).\n` +
              `Typ "auto" (volg het document), "3.0" of "3.1":`,
            "auto"
          ) || "auto"
        )
          .trim()
          .toLowerCase();
        return vanOasDocument(doc, { oasVersie: keuze === "3.0" || keuze === "3.1" ? keuze : "auto" });
      },
    },
    /** Terugreis: sandbox → OpenAPI YAML in het dialect van de oas-version op het api-element. */
    exportBestand: {
      label: "Exporteer OAS (YAML, dialect volgt oas-version)…",
      bestandsnaam: (staat) =>
        `${(staat.meta?.oasInfo?.title || "openapi").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.yaml`,
      maak: (staat) => naarYaml(naarOasDocument(staat)),
    },
  },
});
