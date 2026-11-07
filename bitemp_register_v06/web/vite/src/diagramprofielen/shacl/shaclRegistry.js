// @ts-check
/**
 * shaclRegistry — SHACL (Turtle) in het gedeelde transformatiepaneel (Modelleren ▸ Transformeren),
 * naast het eigen menu van de SHACL-activiteit. Zelfde lezer en schrijver (adapter.js,
 * schrijver.js); hier alleen de aansluiting, met de stores geïnjecteerd (patroon bpmnXmlImport.js).
 *
 *   import  "SHACL (Turtle) → SHACL-model": bestand of geplakte tekst → elementen en een diagram in
 *           de doelmap; de lint-meldingen (plan §11) worden de meldingen van het paneel.
 *   export  "SHACL-model → Turtle": de SHACL-elementen van de map als .ttl-download; meldingen van
 *           schrijver en lint komen als #-commentaar bovenaan en in het paneel.
 */
import { registreerTransformatie } from "../../studio/activities/transformatieRegistry.js";
import { hernoemBotsendeIds } from "../../diagramcore/model/hernoemBotsendeIds.js";
import { vanTurtle, lintTurtle } from "./adapter.js";
import { naarTurtle } from "./schrijver.js";

export const SHACL_PROFIEL_ID = "shacl05";

/** Herkent Turtle met SHACL: de sh:-namespace of een NodeShape. */
export function lijktOpShacl({ naam = "", tekst = "" } = {}) {
  const t = String(tekst).slice(0, 20000);
  let score = 0;
  if (/http:\/\/www\.w3\.org\/ns\/shacl#/.test(t)) score += 0.6;
  if (/\bsh:(NodeShape|property|targetClass|path)\b/.test(t)) score += 0.3;
  if (/\.(ttl|turtle|shacl)$/i.test(naam)) score += 0.1;
  return Math.min(1, score);
}

const ERNST = { fout: "error", waarschuwing: "warning", info: "info" };
const naarDiagnostic = (m) => ({ severity: ERNST[m.niveau] || "info", code: m.code ? `SHACL-${m.code}` : "SHACL", message: m.bericht, sourceId: m.elementId || null });

/**
 * @param {{getProfieltype: (id: string) => any, getModellerenState: () => any, collectMapModel?: (mapId: string) => any, download?: (naam: string, tekst: string) => void}} deps
 */
export function registreerShaclTransformaties({ getProfieltype, getModellerenState, collectMapModel, download }) {
  registreerTransformatie({
    id: "import-shacl-turtle",
    label: "SHACL (Turtle) → SHACL-model",
    richting: "import",
    profielTypes: [SHACL_PROFIEL_ID],
    toelichting:
      "Leest een SHACL-bestand (Turtle): node shapes als box, property shapes als regels, sh:class/sh:node als pijlen, " +
      "sh:or/xone/sparql als constraint. Wat niet past blijft bewaard; de bekende valkuilen (reekspad, sh:or zonder " +
      "voorwaarde, SPARQL die niet draait, …) komen als meldingen.",
    bron: { types: ["file", "text"], accept: [".ttl", ".turtle", ".shacl", ".txt"], mediaTypes: ["text/turtle"], detecteer: lijktOpShacl },
    opties: [],
    run: async ({ bron, doelMap }) => {
      if (!bron?.tekst) throw new Error("Kies een Turtle-bestand of plak de tekst.");
      const modelleren = getModellerenState();
      if (!doelMap || !modelleren?.mappen?.[doelMap]) throw new Error("Kies een bestaande doelmap.");
      const profiel = getProfieltype(SHACL_PROFIEL_ID);
      if (!profiel?.useStore?.getState) throw new Error("Het SHACL-profiel is niet beschikbaar.");
      const { meldingen, ...model } = vanTurtle(bron.tekst, { bestandsnaam: bron.naam });
      const staat = profiel.useStore.getState();
      const { elements, diagrams } = hernoemBotsendeIds(model, staat);
      staat.importeerModel({ diagramTypeId: profiel.descriptor?.id, elements, diagrams }, { modus: "toevoegen" });
      const diagramIds = Object.keys(diagrams);
      for (const id of diagramIds) modelleren.plaatsDiagram(`${SHACL_PROFIEL_ID}::${id}`, doelMap);
      const shapes = Object.values(elements).filter((el) => el.elementType === "nodeshape" || el.elementType === "propertyshape").length;
      return {
        status: meldingen.some((m) => m.niveau !== "info") ? "warning" : "success",
        summary: `${shapes} shapes ingelezen${meldingen.length ? `, ${meldingen.length} melding(en)` : ", geen meldingen"}.`,
        diagnostics: meldingen.map(naarDiagnostic),
        created: { profielId: SHACL_PROFIEL_ID, diagramIds, elementIds: Object.keys(elements) },
      };
    },
  });

  if (!collectMapModel) return;
  registreerTransformatie({
    id: "export-shacl-turtle",
    label: "SHACL-model → Turtle",
    richting: "export",
    profielTypes: [SHACL_PROFIEL_ID],
    toelichting: "Schrijft de SHACL-elementen van deze map als Turtle (.ttl). Lezen en weer schrijven geeft dezelfde graaf; commentaar en volgorde gaan verloren.",
    run: async ({ bronMap, mapNaam }) => {
      const deel = collectMapModel(bronMap)?.[SHACL_PROFIEL_ID];
      if (!deel || !Object.keys(deel.elements || {}).length) throw new Error("Geen SHACL-elementen in deze map.");
      const { tekst, meldingen } = naarTurtle(deel);
      const alle = [...meldingen, ...lintTurtle(tekst)];
      const kop = alle.length ? alle.map((m) => `# ${m.niveau}: ${m.bericht.replace(/\n/g, " ")}`).join("\n") + "\n\n" : "";
      const naam = `${String(mapNaam || "shapes").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "shapes"}.ttl`;
      download?.(naam, kop + tekst);
      return {
        status: alle.some((m) => m.niveau !== "info") ? "warning" : "success",
        summary: `${naam} geschreven${alle.length ? `, ${alle.length} melding(en)` : ""}.`,
        diagnostics: alle.map(naarDiagnostic),
      };
    },
  });
}
