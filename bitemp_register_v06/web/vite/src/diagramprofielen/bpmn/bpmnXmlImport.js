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
import { conditiesNaarCel } from "./conditiesNaarCel.js";

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
 * Zoekt het type van een data-object op naam (16-11): het element met die naam in een taal die
 * gegevens draagt (M3-aard "gegevens": cm-entiteit, UML-klasse, MIM-objecttype, ERD-entiteit).
 * Hoofdletters tellen niet. Eén treffer = het type; meer = dubbelzinnig; geen = niet gevonden.
 * @param {{id: string, elements: Record<string, any>, elementTypes: any[]}[]} profielen
 * @returns {(naam: string) => {ref?: {profielId: string, elementId: string}, treffers: number}}
 */
export function typeZoeker(profielen) {
  return (naam) => {
    const n = String(naam || "").trim().toLowerCase();
    if (!n) return { treffers: 0 };
    const treffers = [];
    for (const p of profielen || []) {
      const gegevens = new Set((p.elementTypes || []).filter((t) => t.aard === "gegevens").map((t) => t.id));
      for (const el of Object.values(p.elements || {})) {
        if (gegevens.has(el?.elementType) && String(el.naam || "").toLowerCase() === n) treffers.push({ profielId: p.id, elementId: el.id });
      }
    }
    return treffers.length === 1 ? { ref: treffers[0], treffers: 1 } : { treffers: treffers.length };
  };
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
 * @param {ReturnType<typeof typeZoeker>} [opts.zoekType] - koppelt het type van een data-object (naam uit
 *   de itemDefinition) weer aan een element in het project
 */
export function bpmnXmlNaarModel(tekst, { DOMParser, bestaand = {}, elementTypes = [], bestandsnaam = "", regelset = BPMN_XML_NAAR_BPMN, zoekType = null } = {}) {
  const graaf = leesBpmn(tekst, { DOMParser });
  const diagnostics = graaf.waarschuwingen.map((w) => ({ severity: "warning", code: "BPMN-ONDERSTEUNING", message: `${w.melding}${w.tekst ? `: ${w.tekst}` : ""}`, sourceId: null, path: null }));
  const plan = pasRegelsToe(graaf, regelset);
  diagnostics.push(...plan.diagnostics);
  const resultaat = planNaarCoreModel(graaf, plan, { prefix: "bp", diagramTypeId: DIAGRAMTYPE_ID, elementTypes, bestaand, bestandsnaam, celMaat });
  diagnostics.push(...resultaat.diagnostics);
  // CEL is de expressietaal in het model: JUEL-condities uit de XML worden CEL; wat geen CEL
  // wordt blijft JUEL (de export laat het ongemoeid door) met een melding.
  const cel = conditiesNaarCel(resultaat.core.elements);
  for (const [id, patch] of Object.entries(cel.patches)) {
    const el = resultaat.core.elements[id];
    resultaat.core.elements[id] = { ...el, data: { ...el.data, ...patch.data } };
  }
  for (const b of cel.blijft) diagnostics.push({ severity: "warning", code: "BPMN-CONDITIE-JUEL", message: `Conditie ${b.naam || b.id} blijft JUEL: ${b.fout}`, sourceId: b.id, path: null });
  // Het type van data (itemSubjectRef → structureRef): de naam terug naar een element in het project.
  for (const [id, el] of Object.entries(resultaat.core.elements)) {
    if (!("typeNaam" in (el.data || {}))) continue;
    const { typeNaam, ...data } = el.data;
    if (typeNaam) {
      const gevonden = zoekType ? zoekType(typeNaam) : { treffers: 0 };
      if (gevonden.ref) data.type = gevonden.ref;
      else
        diagnostics.push({
          severity: gevonden.treffers > 1 ? "warning" : "info",
          code: "BPMN-DATATYPE",
          message: gevonden.treffers > 1 ? `Type "${typeNaam}" van ${el.naam || id} staat ${gevonden.treffers} keer in het project; kies het in de inspector` : `Type "${typeNaam}" van ${el.naam || id} staat niet in het project; het data-object krijgt geen type`,
          sourceId: id,
          path: null,
        });
    }
    resultaat.core.elements[id] = { ...el, data };
  }
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
 * @param {{getProfieltype: (id:string)=>any, getProfieltypen?: ()=>any[], getModellerenState: ()=>any, DOMParser?: any}} deps
 */
export function registreerBpmnXmlImport({ getProfieltype, getProfieltypen = () => [], getModellerenState, DOMParser = globalThis.DOMParser }) {
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
        zoekType: typeZoeker(
          getProfieltypen()
            .filter((p) => p?.useStore?.getState)
            .map((p) => ({ id: p.id, elements: p.useStore.getState().elements || {}, elementTypes: p.descriptor?.elementTypes || [] })),
        ),
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
