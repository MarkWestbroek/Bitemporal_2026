// @ts-check
/**
 * mermaidExport — de Studio-transformatie "use case-model → Mermaid flowchart".
 *
 * Route (docs/TRANSFORMATIES.md §3), de terugweg van mermaidImport.js:
 *
 *   model ──modelNaarGraaf──▶ graaf ──regelset──▶ plan ──mermaidSchrijver──▶ tekst
 *                                     mermaidExportRegels
 *
 * Eén flowchart per diagram (de voorkomens op dat diagram zijn het bereik),
 * met de diagramnaam als titelregel; elementen die op geen enkel diagram staan
 * komen in een laatste flowchart "overige elementen". Stores en de download
 * worden geïnjecteerd, zodat het pad zonder browser testbaar is.
 */
import { registreerTransformatie } from "../../studio/activities/transformatieRegistry.js";
import { modelNaarGraaf } from "../../transformatie/modelNaarGraaf.js";
import { pasRegelsToe } from "../../transformatie/regels.js";
import { planNaarMermaid } from "../../transformatie/mermaidSchrijver.js";
import { USECASE_NAAR_MERMAID } from "./mermaidExportRegels.js";

const PROFIEL_ID = "usecase05";

/** Zelfde opmaak als de gangbare hand-geschreven use case-flowcharts. */
export const KLASSE_STIJLEN = {
  actor: "fill:#ffffff,stroke:#333333,stroke-width:1.5px,color:#111111",
  usecase: "fill:#f8fbff,stroke:#356a9a,stroke-width:1.5px,color:#111111",
  note: "fill:#fffde7,stroke:#999933,stroke-width:1px,color:#333333",
};

/**
 * Zet een use case-model om naar Mermaid-tekst. Puur.
 *
 * @param {Object} invoer
 * @param {Record<string, any>} invoer.elements
 * @param {Record<string, any>} [invoer.diagrams]
 * @param {any[]} [invoer.elementTypes]
 * @param {any} [invoer.regelset]
 * @returns {{tekst: string, diagnostics: any[], trace: any[], stats: {diagrammen: number, elementen: number, relaties: number}}}
 */
export function usecaseNaarMermaid({ elements, diagrams = {}, elementTypes = [], regelset = USECASE_NAAR_MERMAID }) {
  const delen = [];
  const diagnostics = [];
  const trace = [];
  const stats = { diagrammen: 0, elementen: 0, relaties: 0 };
  const opDiagram = new Set();

  const schrijfDeel = (titel, bereik, waar) => {
    const graaf = modelNaarGraaf({ elements, elementTypes, bereik });
    if (!graaf.knopen.length) return;
    const plan = pasRegelsToe(graaf, regelset);
    diagnostics.push(...plan.diagnostics.map((d) => ({ ...d, path: [waar, d.path].filter(Boolean).join(", ") || null })));
    trace.push(...plan.trace.map((s) => ({ ...s, diagram: titel })));
    delen.push(planNaarMermaid(plan, { titel, klasseStijlen: KLASSE_STIJLEN }));
    stats.diagrammen += 1;
    stats.elementen += plan.elementen.length;
    stats.relaties += plan.connectoren.length;
  };

  for (const diagram of Object.values(diagrams)) {
    const bereik = (diagram.nodes || []).map((n) => n.elementId);
    bereik.forEach((id) => opDiagram.add(id));
    schrijfDeel(diagram.naam || diagram.id, bereik, `diagram ${diagram.naam || diagram.id}`);
  }
  const overige = Object.values(elements).filter((el) => !(el.source && el.target) && !opDiagram.has(el.id)).map((el) => el.id);
  if (overige.length) schrijfDeel(Object.keys(diagrams).length ? "overige elementen" : "model", overige, "overige elementen");

  return { tekst: delen.join("\n"), diagnostics, trace, stats };
}

/** Download in de browser; in tests wordt dit vervangen. */
function downloadTekst(naam, tekst) {
  const blob = new Blob([tekst], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = naam;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {{getProfieltype: (id:string)=>any, collectMapModel: (mapId:string)=>Record<string, any>, download?: (naam:string, tekst:string)=>void}} deps
 */
export function registreerUsecaseMermaidExport({ getProfieltype, collectMapModel, download = downloadTekst }) {
  registreerTransformatie({
    id: "export-usecase-mermaid",
    label: "Use case-model → Mermaid flowchart",
    richting: "export",
    profielTypes: [PROFIEL_ID],
    toelichting:
      "Schrijft de use case-diagrammen van deze map als Mermaid flowcharts (één per diagram): " +
      "actoren als cirkels, use cases als stadions, systeemkaders als subgraphs, toelichtingen " +
      "als notities. De import leest het bestand weer terug als hetzelfde model.",
    run: async ({ bronMap, mapNaam }) => {
      const model = collectMapModel(bronMap)?.[PROFIEL_ID];
      if (!model || !Object.keys(model.elements || {}).length) throw new Error("Deze map bevat geen use case-model.");
      const profiel = getProfieltype(PROFIEL_ID);
      const resultaat = usecaseNaarMermaid({
        elements: model.elements,
        diagrams: model.diagrams,
        elementTypes: profiel?.descriptor?.elementTypes || [],
      });
      download(`${(mapNaam || "use-case-model").replace(/\s+/g, "_")}.mmd`, resultaat.tekst);
      const waarschuwingen = resultaat.diagnostics.filter((d) => d.severity === "warning").length;
      const { diagrammen, elementen, relaties } = resultaat.stats;
      return {
        status: waarschuwingen ? "warning" : "success",
        summary: `${diagrammen} ${diagrammen === 1 ? "flowchart" : "flowcharts"} geschreven: ${elementen} elementen, ${relaties} relaties`,
        diagnostics: resultaat.diagnostics,
      };
    },
  });
}
