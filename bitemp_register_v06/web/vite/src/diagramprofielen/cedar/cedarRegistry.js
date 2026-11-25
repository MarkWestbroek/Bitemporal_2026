// @ts-check
/**
 * cedarRegistry — Cedar in het gedeelde transformatiepaneel (Modelleren ▸ Transformeren), naast het
 * eigen menu van de Cedar-activiteit. Zelfde adapter; hier alleen de aansluiting, met de stores
 * geïnjecteerd (patroon shaclRegistry.js).
 *
 *   import "Cedar → Cedar-model": Cedar-tekst, Cedar-JSON (policyset, policy of schema) of een
 *          Open FTV-policylijst → elementen en een diagram in de doelmap; zonder schema afgeleid.
 *   export "Cedar-model → …": tekst (.cedar), JSON-policyset, Open FTV-lijst of schema (JSON).
 *   export "Cedar-model → Toegangsspraak" en import "Toegangsspraak → Cedar-model" (fase 2,
 *          TRANSFORMATIES.md §8.3). De import werkt het Cedar-model in de doelmap bij: dat is de
 *          woordenschat (acties, kenmerken) en de basis (ongewijzigde policies gaan letterlijk terug).
 *   export "Cedar-model → ODRL (ODRL-AP-NL, Turtle)" (fase 3): via Toegangsspraak, naarOdrl.js.
 */
import { registreerTransformatie } from "../../studio/activities/transformatieRegistry.js";
import { hernoemBotsendeIds } from "../../diagramcore/model/hernoemBotsendeIds.js";
import { vanCedar, naarCedar, lijktOpCedar } from "./adapter.js";
import { cedarNaarToegangsspraak } from "./naarToegangsspraak.js";
import { cedarNaarOdrl } from "./naarOdrl.js";
import { toegangsspraakNaarCedar, pasPoliciesToe } from "./vanToegangsspraak.js";
import { cedarPosities } from "./index.js";

export const CEDAR_PROFIEL_ID = "cedar05";

const ERNST = { fout: "error", waarschuwing: "warning", info: "info" };
const naarDiagnostic = (m) => ({ severity: ERNST[m.niveau] || "info", code: "CEDAR", message: m.bericht, sourceId: m.elementId || null });

const EXPORTS = [
  { vorm: "tekst", id: "export-cedar-tekst", label: "Cedar-model → Cedar (tekst)", ext: "cedar", toelichting: "De policies als Cedar-tekst (.cedar). Een policy die niet is gewijzigd, gaat letterlijk terug." },
  { vorm: "json", id: "export-cedar-json", label: "Cedar-model → Cedar (JSON-policyset)", ext: "json", toelichting: "De policies in de JSON-vorm van Cedar (staticPolicies, per id)." },
  { vorm: "openftv", id: "export-cedar-openftv", label: "Cedar-model → Open FTV-policylijst", ext: "openftv.json", toelichting: "De policies als lijst voor de PAP van Open FTV (id, status, metadata, data); bewaarde velden gaan ongewijzigd terug." },
  { vorm: "schema", id: "export-cedar-schema", label: "Cedar-model → Cedar-schema (JSON)", ext: "cedarschema.json", toelichting: "Entiteittypen, acties en common types als Cedar-schema (JSON), per namespace." },
];

/**
 * @param {{getProfieltype: (id: string) => any, getModellerenState: () => any, collectMapModel?: (mapId: string) => any, download?: (naam: string, tekst: string) => void}} deps
 */
export function registreerCedarTransformaties({ getProfieltype, getModellerenState, collectMapModel, download }) {
  registreerTransformatie({
    id: "import-cedar",
    label: "Cedar → Cedar-model",
    richting: "import",
    profielTypes: [CEDAR_PROFIEL_ID],
    toelichting:
      "Leest Cedar-policies (tekst of JSON), een Cedar-schema (JSON) of een Open FTV-policylijst. Policies worden kaarten, " +
      "het schema entiteittypen en acties; zonder schema wordt het afgeleid uit de policies. Meldingen voor wat Cedar zelf " +
      "zou weigeren (een actie die niet van type Action is) en voor policies die nooit gelden.",
    bron: { types: ["file", "text"], accept: [".cedar", ".json", ".cedarschema", ".txt"], mediaTypes: ["application/json", "text/plain"], detecteer: lijktOpCedar },
    opties: [],
    run: async ({ bron, doelMap }) => {
      if (!bron?.tekst) throw new Error("Kies een Cedar-bestand of plak de tekst.");
      const modelleren = getModellerenState();
      if (!doelMap || !modelleren?.mappen?.[doelMap]) throw new Error("Kies een bestaande doelmap.");
      const profiel = getProfieltype(CEDAR_PROFIEL_ID);
      if (!profiel?.useStore?.getState) throw new Error("Het Cedar-profiel is niet beschikbaar.");
      const { meldingen, ...model } = vanCedar(bron.tekst, { bestandsnaam: bron.naam });
      if (meldingen.some((m) => m.niveau === "fout") && !Object.keys(model.elements).length) {
        return { status: "error", summary: "Niets ingelezen.", diagnostics: meldingen.map(naarDiagnostic) };
      }
      const staat = profiel.useStore.getState();
      const { elements, diagrams } = hernoemBotsendeIds(model, staat);
      staat.importeerModel({ diagramTypeId: profiel.descriptor?.id, elements, diagrams }, { modus: "toevoegen" });
      const diagramIds = Object.keys(diagrams);
      for (const id of diagramIds) modelleren.plaatsDiagram(`${CEDAR_PROFIEL_ID}::${id}`, doelMap);
      const tel = (s) => Object.values(elements).filter((el) => el.elementType === s).length;
      return {
        status: meldingen.some((m) => m.niveau !== "info") ? "warning" : "success",
        summary: `${tel("policy")} policies, ${tel("entiteittype")} entiteittypen en ${tel("actie")} acties ingelezen${meldingen.length ? `, ${meldingen.length} melding(en)` : ""}.`,
        diagnostics: meldingen.map(naarDiagnostic),
        created: { profielId: CEDAR_PROFIEL_ID, diagramIds, elementIds: Object.keys(elements) },
      };
    },
  });

  if (!collectMapModel) return;

  registreerTransformatie({
    id: "export-cedar-toegangsspraak",
    label: "Cedar-model → Toegangsspraak",
    richting: "export",
    profielTypes: [CEDAR_PROFIEL_ID],
    toelichting:
      "Schrijft de policies als Toegangsspraak: per policy en actie één regel (\"<policy> <handeling>\"). De handelingen komen uit de " +
      "actielijst (veld handeling), de kenmerken uit de attributen (…rollen → rol). Wat Toegangsspraak niet kan zeggen staat in de " +
      "meldingen: een permit valt dan weg, een forbid verliest dat stuk (beide strenger).",
    run: async ({ bronMap, mapNaam }) => {
      const deel = collectMapModel(bronMap)?.[CEDAR_PROFIEL_ID];
      if (!deel || !Object.keys(deel.elements || {}).length) throw new Error("Geen Cedar-elementen in deze map.");
      const naam = String(mapNaam || "Cedar");
      const { tekst, meldingen, vertaald } = cedarNaarToegangsspraak(deel, { naam });
      const bestand = `${naam.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "cedar"}.toegangsspraak.txt`;
      download?.(bestand, tekst);
      return {
        status: meldingen.some((m) => m.niveau !== "info") ? "warning" : "success",
        summary: `${bestand} geschreven: ${vertaald.length} policies vertaald${meldingen.length ? `, ${meldingen.length} melding(en)` : ""}.`,
        diagnostics: meldingen.map(naarDiagnostic),
      };
    },
  });

  registreerTransformatie({
    id: "export-cedar-odrl",
    label: "Cedar-model → ODRL (ODRL-AP-NL, Turtle)",
    richting: "export",
    profielTypes: [CEDAR_PROFIEL_ID],
    toelichting:
      "Via Toegangsspraak naar ODRL volgens ODRL-AP-NL (fase 3): de rol wordt apnl:rolAanvrager op de handeling, een kenmerk van de " +
      "gegevens een voorwaarde op de regel, de handelingen eigen termen (ts:). Wat Toegangsspraak niet kan zeggen staat in de meldingen.",
    run: async ({ bronMap, mapNaam }) => {
      const deel = collectMapModel(bronMap)?.[CEDAR_PROFIEL_ID];
      if (!deel || !Object.keys(deel.elements || {}).length) throw new Error("Geen Cedar-elementen in deze map.");
      const naam = String(mapNaam || "Cedar");
      const r = cedarNaarOdrl(deel, { naam });
      if (!r.turtle) return { status: "error", summary: "Geen ODRL gemaakt.", diagnostics: r.meldingen.map(naarDiagnostic) };
      const bestand = `${naam.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "cedar"}.odrl.ttl`;
      download?.(bestand, r.turtle);
      return {
        status: r.ok && !r.meldingen.some((m) => m.niveau !== "info") ? "success" : "warning",
        summary: `${bestand} geschreven${r.meldingen.length ? `, ${r.meldingen.length} melding(en)` : ""}.`,
        diagnostics: r.meldingen.map(naarDiagnostic),
      };
    },
  });

  registreerTransformatie({
    id: "import-toegangsspraak-cedar",
    label: "Toegangsspraak → Cedar-model",
    richting: "import",
    profielTypes: [CEDAR_PROFIEL_ID],
    toelichting:
      "Leest Toegangsspraak en werkt het Cedar-model in de doelmap bij (Ctrl+Z kan). Regels met dezelfde policynaam " +
      "worden weer één policy; een policy die hetzelfde zegt als in het model blijft letterlijk staan (met @reason en de velden " +
      "van Open FTV). Zonder Cedar-model in de map kent de taal de handelingen niet.",
    bron: { types: ["file", "text"], accept: [".txt", ".toegangsspraak"], mediaTypes: ["text/plain"] },
    opties: [],
    run: async ({ bron, doelMap }) => {
      if (!bron?.tekst) throw new Error("Kies een bestand met Toegangsspraak of plak de tekst.");
      const modelleren = getModellerenState();
      if (!doelMap || !modelleren?.mappen?.[doelMap]) throw new Error("Kies een bestaande doelmap.");
      const profiel = getProfieltype(CEDAR_PROFIEL_ID);
      if (!profiel?.useStore?.getState) throw new Error("Het Cedar-profiel is niet beschikbaar.");
      const deel = collectMapModel(doelMap)?.[CEDAR_PROFIEL_ID] || { elements: {}, diagrams: {} };
      const r = toegangsspraakNaarCedar(bron.tekst, { staat: deel });
      const diagnostics = r.meldingen.map(naarDiagnostic);
      if (!r.policies.length) return { status: "error", summary: "Geen policies gemaakt.", diagnostics };
      const staat = profiel.useStore.getState();
      if (!Object.keys(deel.elements || {}).length) {
        // Geen Cedar-model in de map: een nieuw model uit de geschreven Cedar-tekst (schema afgeleid).
        const { meldingen, ...model } = vanCedar(r.tekst, { bestandsnaam: bron.naam || "toegangsspraak" });
        const { elements, diagrams } = hernoemBotsendeIds(model, staat);
        staat.importeerModel({ diagramTypeId: profiel.descriptor?.id, elements, diagrams }, { modus: "toevoegen" });
        for (const id of Object.keys(diagrams)) modelleren.plaatsDiagram(`${CEDAR_PROFIEL_ID}::${id}`, doelMap);
        return {
          status: r.meldingen.some((m) => m.niveau !== "info") ? "warning" : "success",
          summary: `${r.policies.length} policies in een nieuw Cedar-model.`,
          diagnostics: [...diagnostics, ...meldingen.map(naarDiagnostic)],
          created: { profielId: CEDAR_PROFIEL_ID, diagramIds: Object.keys(diagrams), elementIds: Object.keys(elements) },
        };
      }
      const { elements, nieuweIds, weg } = pasPoliciesToe(deel, r.policies);
      // Op het (eerste) diagram van de map: wat vervalt eraf, wat nieuw is erbij, onder de rest.
      const [diagramId] = Object.keys(deel.diagrams || {});
      const diagrams = {};
      if (diagramId) {
        const d = staat.diagrams[diagramId];
        const nodes = (d.nodes || []).filter((n) => !weg.includes(n.elementId));
        const posities = cedarPosities({ ids: nieuweIds, elements });
        const onder = Math.max(0, ...nodes.map((n) => (n.position?.y || 0) + 200));
        for (const id of nieuweIds) nodes.push({ elementId: id, position: { x: posities[id]?.x || 0, y: onder + (posities[id]?.y || 0) } });
        diagrams[diagramId] = { ...d, nodes };
      }
      staat.pasWijzigingToe({ elements, diagrams });
      if (weg.length) staat.patchElementen({ wis: weg });
      const tel = (s) => r.policies.filter((p) => p.status === s).length;
      return {
        status: r.meldingen.some((m) => m.niveau !== "info") ? "warning" : "success",
        summary: `${tel("ongewijzigd")} ongewijzigd, ${tel("gewijzigd")} gewijzigd, ${tel("nieuw")} nieuw, ${tel("behouden")} behouden.`,
        diagnostics,
        created: { profielId: CEDAR_PROFIEL_ID, diagramIds: diagramId ? [diagramId] : [], elementIds: nieuweIds },
      };
    },
  });
  for (const e of EXPORTS) {
    registreerTransformatie({
      id: e.id,
      label: e.label,
      richting: "export",
      profielTypes: [CEDAR_PROFIEL_ID],
      toelichting: e.toelichting,
      run: async ({ bronMap, mapNaam }) => {
        const deel = collectMapModel(bronMap)?.[CEDAR_PROFIEL_ID];
        if (!deel || !Object.keys(deel.elements || {}).length) throw new Error("Geen Cedar-elementen in deze map.");
        const { tekst, meldingen } = naarCedar(deel, { vorm: /** @type {any} */ (e.vorm) });
        const naam = `${String(mapNaam || "cedar").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "cedar"}.${e.ext}`;
        download?.(naam, tekst);
        return {
          status: meldingen.some((m) => m.niveau !== "info") ? "warning" : "success",
          summary: `${naam} geschreven${meldingen.length ? `, ${meldingen.length} melding(en)` : ""}.`,
          diagnostics: meldingen.map(naarDiagnostic),
        };
      },
    });
  }
}
