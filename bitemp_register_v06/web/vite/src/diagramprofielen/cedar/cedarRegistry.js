// @ts-check
/**
 * cedarRegistry — Cedar in het gedeelde transformatiepaneel (Modelleren ▸ Transformeren), naast het
 * eigen menu van de Cedar-activiteit. Zelfde adapter; hier alleen de aansluiting, met de stores
 * geïnjecteerd (patroon shaclRegistry.js).
 *
 *   import "Cedar → Cedar-model": Cedar-tekst, Cedar-JSON (policyset, policy of schema) of een
 *          Open FTV-policylijst → elementen en een diagram in de doelmap; zonder schema afgeleid.
 *   export "Cedar-model → …": tekst (.cedar), JSON-policyset, Open FTV-lijst of schema (JSON).
 */
import { registreerTransformatie } from "../../studio/activities/transformatieRegistry.js";
import { hernoemBotsendeIds } from "../../diagramcore/model/hernoemBotsendeIds.js";
import { vanCedar, naarCedar, lijktOpCedar } from "./adapter.js";

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
