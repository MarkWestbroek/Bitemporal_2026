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
 *     toelichting?, run: async (context) => void
 *   }
 * context: { mapId, mapNaam, richting, profielen: string[],
 *            bron?, doel? }  // bron/doel afhankelijk van de richting
 */
const _transformaties = [];

export function registreerTransformatie(def) {
  if (!def || !def.id || !def.richting) throw new Error("Transformatie vereist id + richting.");
  const pos = _transformaties.findIndex((t) => t.id === def.id);
  if (pos >= 0) _transformaties[pos] = def;
  else _transformaties.push(def);
}

/** Transformaties voor een richting, optioneel gefilterd op aanwezige profielen. */
export function getTransformaties(richting, aanwezigeProfielen = null) {
  return _transformaties.filter((t) => {
    if (richting && t.richting !== richting) return false;
    if (!aanwezigeProfielen || !t.profielTypes || t.profielTypes === "*") return true;
    return t.profielTypes.some((pid) => aanwezigeProfielen.includes(pid));
  });
}
