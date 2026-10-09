// @ts-check
/**
 * dmnXmlImport — de Studio-transformatie "DMN XML → DMN DRD-model".
 *
 *   xml ──lezer──▶ brongraaf ──regelset──▶ plan ──aansluiting──▶ core-model ──▶ profiel dmnDrd05
 *       dmnXml.js            dmnXmlRegels    regels.js    planNaarCoreModel
 *
 * De DMNDI-laag levert posities/maten en waypoints (knikpunten); zonder DI
 * krijgt het DRD een automatische opstelling. Stores worden geïnjecteerd.
 */
import { registreerTransformatie } from "../../studio/activities/transformatieRegistry.js";
import { leesDmn, lijktOpDmn } from "../../transformatie/dmnXml.js";
import { pasRegelsToe } from "../../transformatie/regels.js";
import { planNaarCoreModel } from "../../transformatie/planNaarCoreModel.js";
import { DMN_XML_NAAR_DRD } from "./dmnXmlRegels.js";

export const DMN_PROFIEL_ID = "dmnDrd05";
// Gelijk aan DMN_DRD_ID in ./index.js (dat bestand laadt .jsx-shapes).
const DIAGRAMTYPE_ID = "dmn-drd";

function celMaat(type) {
  if (type === "notitie") return { breedte: 180, hoogte: 60 };
  return { breedte: 180, hoogte: 70 };
}

/**
 * Zet DMN-XML om naar een core-model voor het DRD-profiel. Puur.
 * @param {string} tekst
 * @param {Object} [opts]
 * @param {any} [opts.DOMParser]
 * @param {{elements?: Record<string, any>, diagrams?: Record<string, any>}} [opts.bestaand]
 * @param {any[]} [opts.elementTypes]
 * @param {string} [opts.bestandsnaam]
 * @param {any} [opts.regelset]
 */
export function dmnXmlNaarModel(tekst, { DOMParser, bestaand = {}, elementTypes = [], bestandsnaam = "", regelset = DMN_XML_NAAR_DRD } = {}) {
  const graaf = leesDmn(tekst, { DOMParser });
  const diagnostics = graaf.waarschuwingen.map((w) => ({ severity: "warning", code: "DMN-ONDERSTEUNING", message: `${w.melding}${w.tekst ? `: ${w.tekst}` : ""}`, sourceId: null, path: null }));
  const plan = pasRegelsToe(graaf, regelset);
  diagnostics.push(...plan.diagnostics);
  const resultaat = planNaarCoreModel(graaf, plan, { prefix: "dm", diagramTypeId: DIAGRAMTYPE_ID, elementTypes, bestaand, bestandsnaam, celMaat });
  diagnostics.push(...resultaat.diagnostics);
  return { core: resultaat.core, diagnostics, trace: plan.trace, stats: resultaat.stats };
}

function samenvatting(stats) {
  const n = (t) => stats.nieuw[t] || 0;
  return `${stats.diagrammen} ${stats.diagrammen === 1 ? "DRD" : "DRD's"}: ${n("decision")} beslissingen, ${n("inputData")} invoergegevens, ${n("bkm")} BKM's, ${n("knowledgeSource")} kennisbronnen, ${stats.connectoren} requirements geïmporteerd`;
}

/**
 * @param {{getProfieltype: (id:string)=>any, getModellerenState: ()=>any, DOMParser?: any}} deps
 */
export function registreerDmnXmlImport({ getProfieltype, getModellerenState, DOMParser = globalThis.DOMParser }) {
  registreerTransformatie({
    id: "import-dmn-xml",
    label: "DMN XML → DMN DRD-model",
    richting: "import",
    profielTypes: [DMN_PROFIEL_ID],
    toelichting:
      "Leest een DMN-bestand (.dmn, dmn:definitions) als DRD: beslissingen (met vraag), invoergegevens, business " +
      "knowledge models, kennisbronnen en de information-/knowledge-/authority requirements. De DMNDI-laag levert " +
      "posities en knikpunten; zonder DI volgt een automatische opstelling.",
    bron: {
      types: ["file"],
      accept: [".dmn", ".xml"],
      mediaTypes: ["application/xml", "text/xml"],
      detecteer: lijktOpDmn,
    },
    opties: [],
    run: async ({ bron, doelMap }) => {
      if (!bron?.tekst) throw new Error("Kies een DMN-bestand.");
      const modelleren = getModellerenState();
      if (!doelMap || !modelleren?.mappen?.[doelMap]) throw new Error("Kies een bestaande doelmap.");
      const profiel = getProfieltype(DMN_PROFIEL_ID);
      if (!profiel?.useStore?.getState) throw new Error("Het DMN DRD-profiel is niet beschikbaar.");

      const staat = profiel.useStore.getState();
      const resultaat = dmnXmlNaarModel(bron.tekst, {
        DOMParser,
        bestaand: { elements: staat.elements, diagrams: staat.diagrams },
        elementTypes: profiel.descriptor?.elementTypes || [],
        bestandsnaam: bron.naam,
      });
      const diagramIds = Object.keys(resultaat.core.diagrams);
      if (!Object.keys(resultaat.core.elements).length) throw new Error("Geen DMN-elementen gevonden in het bestand.");

      staat.importeerModel(resultaat.core, { modus: "toevoegen" });
      for (const diagramId of diagramIds) modelleren.plaatsDiagram(`${DMN_PROFIEL_ID}::${diagramId}`, doelMap);

      const waarschuwingen = resultaat.diagnostics.filter((d) => d.severity === "warning").length;
      return {
        status: waarschuwingen ? "warning" : "success",
        summary: samenvatting(resultaat.stats),
        diagnostics: resultaat.diagnostics,
        created: { profielId: DMN_PROFIEL_ID, diagramIds, elementIds: Object.keys(resultaat.core.elements) },
      };
    },
  });
}
