// @ts-check
/**
 * bpmnXmlImport — de Studio-transformatie "BPMN 2.0 XML → BPMN-model".
 *
 *   xml ──lezer──▶ brongraaf ──regelset──▶ plan ──aansluiting──▶ core-model ──▶ profiel bpmnMotor05
 *       bpmnXml.js            bpmnXmlRegels   regels.js    planNaarCoreModel
 *
 * Dit bestand kent het doel (het profiel en de store), niet de bron. De
 * diagramlaag (BPMNDI) komt mee: posities en maten op de nodes, waypoints als
 * knikpunten op de connectoren; een uitgeklapt subproces krijgt een eigen
 * diagram via `gedragDiagramId`. Stores worden geïnjecteerd (patroon
 * archimateImport.js), zodat het pad zonder React testbaar is.
 */
import { registreerTransformatie } from "../../studio/activities/transformatieRegistry.js";
import { leesBpmn, lijktOpBpmn } from "../../transformatie/bpmnXml.js";
import { pasRegelsToe } from "../../transformatie/regels.js";
import { planNaarCoreModel } from "../../transformatie/planNaarCoreModel.js";
import { BPMN_XML_NAAR_BPMN } from "./bpmnXmlRegels.js";

export const BPMN_PROFIEL_ID = "bpmnMotor05";
// Gelijk aan BPMN_ID in ./index.js (dat bestand laadt .jsx-shapes).
const DIAGRAMTYPE_ID = "bpmn-motor";

/** Celmaat voor de automatische opstelling (alleen zonder BPMNDI). */
function celMaat(type) {
  if (type === "pool") return { breedte: 600, hoogte: 250 };
  if (type === "lane") return { breedte: 560, hoogte: 120 };
  if (["start-event", "eind-event", "tussen-event", "boundary-event"].includes(type)) return { breedte: 48, hoogte: 48 };
  if (["exclusief", "parallel", "inclusief"].includes(type)) return { breedte: 56, hoogte: 56 };
  if (type === "data-object") return { breedte: 48, hoogte: 60 };
  return { breedte: 140, hoogte: 70 };
}

/**
 * Zet BPMN-XML om naar een core-model voor het BPMN-profiel. Puur.
 * @param {string} tekst
 * @param {Object} [opts]
 * @param {any} [opts.DOMParser]
 * @param {{elements?: Record<string, any>, diagrams?: Record<string, any>}} [opts.bestaand]
 * @param {any[]} [opts.elementTypes]
 * @param {string} [opts.bestandsnaam]
 * @param {any} [opts.regelset]
 */
export function bpmnXmlNaarModel(tekst, { DOMParser, bestaand = {}, elementTypes = [], bestandsnaam = "", regelset = BPMN_XML_NAAR_BPMN } = {}) {
  const graaf = leesBpmn(tekst, { DOMParser });
  const diagnostics = graaf.waarschuwingen.map((w) => ({ severity: "warning", code: "BPMN-ONDERSTEUNING", message: `${w.melding}${w.tekst ? `: ${w.tekst}` : ""}`, sourceId: null, path: null }));
  const plan = pasRegelsToe(graaf, regelset);
  diagnostics.push(...plan.diagnostics);
  const resultaat = planNaarCoreModel(graaf, plan, { prefix: "bp", diagramTypeId: DIAGRAMTYPE_ID, elementTypes, bestaand, bestandsnaam, celMaat });
  diagnostics.push(...resultaat.diagnostics);
  return { core: resultaat.core, diagnostics, trace: plan.trace, stats: resultaat.stats };
}

function samenvatting(stats) {
  const n = (t) => stats.nieuw[t] || 0;
  const taken = n("taak") + n("subproces");
  const events = n("start-event") + n("tussen-event") + n("eind-event") + n("boundary-event");
  const gateways = n("exclusief") + n("parallel") + n("inclusief");
  return `${stats.diagrammen} ${stats.diagrammen === 1 ? "diagram" : "diagrammen"}: ${taken} taken, ${events} events, ${gateways} gateways, ${n("pool") + n("lane")} pools/lanes, ${stats.connectoren} verbindingen geïmporteerd`;
}

/**
 * @param {{getProfieltype: (id:string)=>any, getModellerenState: ()=>any, DOMParser?: any}} deps
 */
export function registreerBpmnXmlImport({ getProfieltype, getModellerenState, DOMParser = globalThis.DOMParser }) {
  registreerTransformatie({
    id: "import-bpmn-xml",
    label: "BPMN 2.0 XML → BPMN-model",
    richting: "import",
    profielTypes: [BPMN_PROFIEL_ID],
    toelichting:
      "Leest een BPMN 2.0-bestand (.bpmn, bpmn:definitions) als BPMN-model: processen, pools en lanes, taken, " +
      "events (met soort), gateways, data-objecten, sequence-/message flows en annotaties. De BPMNDI-diagramlaag " +
      "levert posities, maten en knikpunten; een uitgeklapt subproces krijgt een eigen diagram.",
    bron: {
      types: ["file"],
      accept: [".bpmn", ".xml"],
      mediaTypes: ["application/xml", "text/xml"],
      detecteer: lijktOpBpmn,
    },
    opties: [],
    run: async ({ bron, doelMap }) => {
      if (!bron?.tekst) throw new Error("Kies een BPMN 2.0-bestand.");
      const modelleren = getModellerenState();
      if (!doelMap || !modelleren?.mappen?.[doelMap]) throw new Error("Kies een bestaande doelmap.");
      const profiel = getProfieltype(BPMN_PROFIEL_ID);
      if (!profiel?.useStore?.getState) throw new Error("Het BPMN-profiel is niet beschikbaar.");

      const staat = profiel.useStore.getState();
      const resultaat = bpmnXmlNaarModel(bron.tekst, {
        DOMParser,
        bestaand: { elements: staat.elements, diagrams: staat.diagrams },
        elementTypes: profiel.descriptor?.elementTypes || [],
        bestandsnaam: bron.naam,
      });
      const diagramIds = Object.keys(resultaat.core.diagrams);
      if (!Object.keys(resultaat.core.elements).length) throw new Error("Geen BPMN-elementen gevonden in het bestand.");

      staat.importeerModel(resultaat.core, { modus: "toevoegen" });
      for (const diagramId of diagramIds) modelleren.plaatsDiagram(`${BPMN_PROFIEL_ID}::${diagramId}`, doelMap);

      const waarschuwingen = resultaat.diagnostics.filter((d) => d.severity === "warning").length;
      return {
        status: waarschuwingen ? "warning" : "success",
        summary: samenvatting(resultaat.stats),
        diagnostics: resultaat.diagnostics,
        created: { profielId: BPMN_PROFIEL_ID, diagramIds, elementIds: Object.keys(resultaat.core.elements) },
      };
    },
  });
}
