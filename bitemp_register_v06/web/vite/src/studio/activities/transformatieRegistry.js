/**
 * transformatieRegistry — register van transformaties (consolidatieplan
 * "Genereren als aspect", sessie 2026-07-13).
 *
 * Transformeren is de generieke term; drie richtingen van hetzelfde aspect:
 *   - "import"    : van buiten (bestand/API) naar het model (doel = de map);
 *   - "export"    : van het model naar buiten (bron = de map);
 *   - "transform" : van model naar model (bron = de map, doel = een map).
 *
 * Een transformatie hangt zich hier op met een `run(context)`; het generieke
 * scherm (TransformatiePaneel) roept haar aan met de gekozen map, profielen,
 * elementen en bron/doel. Specifieke generatoren (code) sluiten zo aan zonder
 * dat het scherm hun interne werking kent.
 *
 * Descriptor:
 *   {
 *     id, label, richting: "import"|"export"|"transform",
 *     profielTypes?: string[] | "*",   // van toepassing op deze profieltypen
 *     bron?: { types?: string[], accept?: string[], mediaTypes?: string[],
 *              detecteer?: ({naam, tekst}) => number },
 *     opties?: Array<{key:string,label:string,datatype:string,default?:any}>,
 *     toelichting?, run: async (context) => void
 *   }
 * context: { mapId, mapNaam, richting, profielen: string[],
 *            bron?, doel?, opties? }  // bron/doel afhankelijk van de richting
 * run mag niets teruggeven (compatibel) of:
 *   { status:"success"|"warning", summary?, diagnostics?, created? }
 */
const _transformaties = [];

export function registreerTransformatie(def) {
  if (!def || !def.id || !def.richting) throw new Error("Transformatie vereist id + richting.");
  if (!["import", "export", "transform"].includes(def.richting)) {
    throw new Error(`Onbekende transformatierichting: ${def.richting}.`);
  }
  const pos = _transformaties.findIndex((t) => t.id === def.id);
  if (pos >= 0) _transformaties[pos] = def;
  else _transformaties.push(def);
}

/** Alleen voor tests; productiecode registreert descriptors idempotent op id. */
export function wisTransformaties() {
  _transformaties.length = 0;
}

/** Transformaties voor een richting, optioneel gefilterd op aanwezige profielen. */
export function getTransformaties(richting, aanwezigeProfielen = null) {
  return _transformaties.filter((t) => {
    if (richting && t.richting !== richting) return false;
    if (!aanwezigeProfielen || !t.profielTypes || t.profielTypes === "*") return true;
    return t.profielTypes.some((pid) => aanwezigeProfielen.includes(pid));
  });
}

/** Waarden waarmee een declaratieve optieset begint. */
export function standaardOpties(def) {
  return Object.fromEntries((def?.opties || []).map((optie) => [optie.key, optie.default ?? (optie.datatype === "boolean" ? false : "")]));
}

/** HTML accept-attribuut voor de bestandskiezer; oude descriptors houden de brede fallback. */
export function acceptVoor(def) {
  const accept = def?.bron?.accept;
  return Array.isArray(accept) && accept.length
    ? accept.join(",")
    : ".json,application/json,.yaml,.yml,.xml,text/*";
}

/** Achterwaarts compatibel resultaat voor oude `run()`-functies zonder returnwaarde. */
export function normaliseerTransformatieResultaat(resultaat) {
  if (!resultaat) return { status: "success", summary: "Gelukt.", diagnostics: [], created: null };
  const diagnostics = Array.isArray(resultaat.diagnostics) ? resultaat.diagnostics : [];
  return {
    status: resultaat.status === "warning" ? "warning" : "success",
    summary: resultaat.summary || (resultaat.status === "warning" ? "Voltooid met waarschuwingen." : "Gelukt."),
    diagnostics,
    created: resultaat.created || null,
  };
}

/** Kies de best passende importtransformatie; score <= 0 betekent geen herkenning. */
export function detecteerTransformatie(definities, bron) {
  let beste = null;
  let hoogste = 0;
  for (const def of definities || []) {
    if (typeof def?.bron?.detecteer !== "function") continue;
    let score = 0;
    try {
      score = Number(def.bron.detecteer(bron)) || 0;
    } catch {
      score = 0;
    }
    if (score > hoogste) {
      beste = def;
      hoogste = score;
    }
  }
  return beste;
}
