// @ts-check
/**
 * oasCanoniekImport — de Studio-transformatie "OpenAPI → canoniek model".
 *
 * Route: OAS-bestand (JSON of YAML) → `oasNaarV3` → `importeerV3` (V3 → store →
 * core-model) → het canoniek-uml-profiel (`diagram05`), geplaatst in de gekozen
 * map van de modelleeromgeving. Daarna is het een gewoon model: opschonen,
 * hernoemen en publiceren doe je met de hand in de Studio.
 *
 * Opzet volgt `archimate/exchange/archimateImport.js`: de stores worden
 * geïnjecteerd, zodat het hele pad zonder React testbaar blijft.
 */
import YAML from "yaml";
import { registreerTransformatie } from "../../studio/activities/transformatieRegistry.js";
import { oasNaarV3 } from "./oasNaarV3.js";
import { importeerV3 } from "./serialisatie.js";

const PROFIEL_ID = "diagram05";

/** Herkenning voor de bestandskiezer: een OAS 3.x met componenten-schemas. */
export function lijktOpOas({ tekst }) {
  const kop = String(tekst || "").slice(0, 4000);
  if (!/["']?openapi["']?\s*:\s*["']?3\./.test(kop)) return 0;
  return /components/.test(kop) || /schemas/.test(kop) ? 1 : 0.5;
}

/** JSON of YAML; YAML leest ook JSON, maar JSON-fouten lezen prettiger. */
export function parseOasTekst(tekst) {
  const schoon = String(tekst || "").trim();
  if (schoon.startsWith("{")) return JSON.parse(schoon);
  return YAML.parse(schoon);
}

/**
 * Hernoem alle ids in een core-model met een prefix.
 *
 * V3 kent geen vrije ids: `v3ModelNaarStore` leidt ze af uit namen. Twee
 * documenten met een schema `Persoon` zouden dus botsen, en een tweede import
 * van hetzelfde document ook — `importeerModel` weigert dat (terecht). Met een
 * prefix per import blijft elke import op zichzelf staan.
 */
export function prefixeerCoreModel(core, prefix) {
  const nieuw = (id) => (id == null ? id : `${prefix}${id}`);
  const elements = {};
  for (const [id, el] of Object.entries(core.elements || {})) {
    elements[nieuw(id)] = {
      ...el,
      id: nieuw(id),
      ...(el.source ? { source: nieuw(el.source) } : {}),
      ...(el.target ? { target: nieuw(el.target) } : {}),
    };
  }
  const diagrams = {};
  for (const [id, diag] of Object.entries(core.diagrams || {})) {
    diagrams[nieuw(id)] = {
      ...diag,
      id: nieuw(id),
      nodes: (diag.nodes || []).map((n) => ({ ...n, elementId: nieuw(n.elementId) })),
      edges: (diag.edges || []).map((e) => ({
        ...e,
        id: nieuw(e.id),
        source: nieuw(e.source),
        target: nieuw(e.target),
      })),
    };
  }
  const meta = {
    ...(core.meta || {}),
    compositieEdges: (core.meta?.compositieEdges || []).map((e) => ({
      ...e,
      id: nieuw(e.id),
      source: nieuw(e.source),
      target: nieuw(e.target),
    })),
  };
  return { ...core, elements, diagrams, meta };
}

let teller = 0;
const maakPrefix = (titel) =>
  `oas_${String(titel || "import").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24)}_${(teller += 1)}_`;

/**
 * @param {{getProfieltype: (id:string)=>any, getModellerenState: ()=>any}} deps
 */
export function registreerOasCanoniekImport({ getProfieltype, getModellerenState }) {
  registreerTransformatie({
    id: "import-oas-canoniek",
    label: "OpenAPI (components.schemas) → canoniek model",
    richting: "import",
    profielTypes: [PROFIEL_ID],
    toelichting:
      "Leest de schemas van een OAS 3.0/3.1-document als entiteiten, gegevenselementen, " +
      "relaties en enums. Toont eerlijk wat er in het document staat — normaliseren doe " +
      "je daarna met de hand. Paths/operations blijven buiten beschouwing.",
    bron: {
      types: ["file"],
      accept: [".json", ".yaml", ".yml"],
      mediaTypes: ["application/json", "application/yaml", "text/yaml"],
      detecteer: lijktOpOas,
    },
    opties: [
      { key: "domein", label: "Domein (leeg = uit info.title)", datatype: "string", default: "" },
      { key: "technischeVelden", label: "Technische velden (id, rel_id, versie) meenemen", datatype: "boolean", default: false },
    ],
    run: async ({ bron, doelMap, opties = {} }) => {
      if (!bron?.tekst) throw new Error("Kies een OpenAPI-bestand (JSON of YAML).");
      const modelleren = getModellerenState();
      if (!doelMap || !modelleren?.mappen?.[doelMap]) throw new Error("Kies een bestaande doelmap.");
      const profiel = getProfieltype(PROFIEL_ID);
      if (!profiel?.useStore?.getState) throw new Error("Het canoniek-model-profiel is niet beschikbaar.");

      let doc;
      try {
        doc = parseOasTekst(bron.tekst);
      } catch (fout) {
        throw new Error(`Het bestand is geen geldige JSON of YAML: ${fout.message}`);
      }

      const v3 = oasNaarV3(doc, {
        domein: String(opties.domein || "").trim() || undefined,
        technischeVelden: opties.technischeVelden === true,
      });
      const core = prefixeerCoreModel(importeerV3({ model: v3 }), maakPrefix(doc?.info?.title));

      // Eerst de atomaire modelmutatie (valideert ids en referenties), dan pas
      // de plaatsing in de map — zoals de ArchiMate-import.
      profiel.useStore.getState().importeerModel(core, { modus: "toevoegen" });
      const diagramIds = Object.keys(core.diagrams);
      for (const diagramId of diagramIds) modelleren.plaatsDiagram(`${PROFIEL_ID}::${diagramId}`, doelMap);

      const aantalGE = v3.entiteiten.reduce((n, e) => n + e.gegevenselementen.length, 0);
      const aantalRel = v3.entiteiten.reduce((n, e) => n + e.relaties.length, 0);
      const waarschuwingen = v3.diagnostics.filter((d) => d.severity === "warning").length;
      return {
        status: waarschuwingen ? "warning" : "success",
        summary: `${v3.entiteiten.length} entiteiten, ${aantalGE} gegevenselementen, ${aantalRel} relaties en ${v3.enums.length} enums geïmporteerd`,
        diagnostics: v3.diagnostics.map((d) => ({
          severity: d.severity,
          code: "OAS_IMPORT",
          bericht: d.bericht,
          element: d.schema || null,
        })),
        created: { profielId: PROFIEL_ID, diagramIds, elementIds: Object.keys(core.elements) },
      };
    },
  });
}
