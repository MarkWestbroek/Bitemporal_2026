// @ts-check
import { registreerTransformatie } from "../../../studio/activities/transformatieRegistry.js";
import { parseExchange, lijktOpExchange } from "./parseExchange.js";
import { naarCoreModel } from "./naarCoreModel.js";

let importTeller = 0;
const standaardImportId = (modelId) => {
  importTeller += 1;
  return `${String(modelId || "model").replace(/[^a-zA-Z0-9_.-]+/g, "_")}-${Date.now()}-${importTeller}`;
};

/**
 * Registreer de transformatie met geïnjecteerde stores, zodat de uitvoering
 * zonder React/JSX als één integratiepad testbaar blijft.
 */
export function registreerArchimateImport({
  getProfieltype,
  getModellerenState,
  DOMParser = globalThis.DOMParser,
  maakImportId = standaardImportId,
}) {
  registreerTransformatie({
    id: "import-archimate-model-exchange",
    label: "ArchiMate Model Exchange → ArchiMate-model",
    richting: "import",
    profielTypes: ["archimate05"],
    toelichting: "Importeert standaard Exchange XML met elementen, relaties, views en view-only annotaties.",
    bron: {
      types: ["file"],
      accept: [".xml", ".archimate"],
      mediaTypes: ["application/xml", "text/xml"],
      detecteer: lijktOpExchange,
    },
    opties: [
      { key: "taal", label: "Voorkeurstaal", datatype: "string", default: "nl" },
      { key: "stijlen", label: "Kleuren uit views overnemen", datatype: "boolean", default: true },
    ],
    run: async ({ bron, doelMap, opties = {} }) => {
      if (!bron?.tekst) throw new Error("Kies een ArchiMate Exchange-bestand.");
      const modelleren = getModellerenState();
      if (!doelMap || !modelleren?.mappen?.[doelMap]) throw new Error("Kies een bestaande doelmap.");
      const profiel = getProfieltype("archimate05");
      if (!profiel?.useStore?.getState) throw new Error("Het ArchiMate-profiel is niet beschikbaar.");

      const exchange = parseExchange(bron.tekst, { DOMParser });
      const importId = maakImportId(exchange.model?.identifier);
      const core = naarCoreModel(exchange, { importId, taal: opties.taal || "nl", stijlen: opties.stijlen !== false });
      const profielState = profiel.useStore.getState();

      // `importeerModel` valideert alle ids/referenties vóór zijn ene set().
      // Mapplaatsing volgt pas als die atomaire modelmutatie geslaagd is.
      profielState.importeerModel(core, { modus: "toevoegen" });
      const diagramIds = Object.keys(core.diagrams);
      for (const diagramId of diagramIds) {
        modelleren.plaatsDiagram(`archimate05::${diagramId}`, doelMap);
      }
      for (const elementId of core.stats.ongevisualiseerdeElementIds) {
        modelleren.plaatsDiagram(`el::archimate05::${elementId}`, doelMap);
      }

      const waarschuwingen = core.diagnostics.filter((item) => item.severity === "warning").length;
      return {
        status: waarschuwingen ? "warning" : "success",
        summary: `${core.stats.views} views, ${core.stats.modelElementen} elementen en ${core.stats.relaties} relaties geïmporteerd`,
        diagnostics: core.diagnostics,
        created: {
          profielId: "archimate05",
          diagramIds,
          elementIds: Object.keys(core.elements),
        },
      };
    },
  });
}