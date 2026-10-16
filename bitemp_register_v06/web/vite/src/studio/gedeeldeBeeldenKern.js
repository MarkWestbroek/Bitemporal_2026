// @ts-check
/**
 * gedeeldeBeeldenKern — het bijwerken van actuele gedeelde plaatjes, zonder browser, server of
 * stores (die komen als afhankelijkheden binnen; zie gedeeldeBeelden.js).
 */
import { svgMaat, svgHerkomst } from "../transformatie/sjabloon/rijkKopieren.js";

const sleutel = (profielId, diagramId) => `${profielId}::${diagramId}`;

/**
 * Kern van het bijwerken, met ingespoten afhankelijkheden.
 * @param {{ actueel: () => Array<{profiel_id:string, diagram_id:string, token:string}>,
 *           teken: (profielId:string, diagramId:string) => string,
 *           rasteriseer: (svg:string) => Promise<string>,
 *           stuur: (invoer:Object) => Promise<Object>,
 *           vergeet: (token:string) => void,
 *           bijgewerkt?: (meta:Object) => void }} deps
 */
export function maakBeeldWachter(deps) {
  const laatste = new Map(); // sleutel → laatst verstuurde SVG-tekst
  let bezig = null;
  return {
    /** Werk alle actuele plaatjes bij waarvan de tekening veranderd is. Geeft het aantal verstuurde. */
    async ververs() {
      if (bezig) return bezig;
      bezig = (async () => {
        let n = 0;
        for (const b of deps.actueel()) {
          const k = sleutel(b.profiel_id, b.diagram_id);
          const svg = deps.teken(b.profiel_id, b.diagram_id);
          if (!svg || svg === laatste.get(k)) continue; // (nog) niet geladen, of niets veranderd
          try {
            const { breedte, hoogte } = svgMaat(svg);
            const meta = await deps.stuur({
              profiel_id: b.profiel_id,
              diagram_id: b.diagram_id,
              diagram_naam: svgHerkomst(svg)?.naam || b.diagram_naam || "",
              soort: "actueel",
              png: await deps.rasteriseer(svg),
              breedte,
              hoogte,
              alleen_bijwerken: true,
            });
            laatste.set(k, svg);
            n += 1;
            deps.bijgewerkt?.(meta);
          } catch (e) {
            // 404: ingetrokken (ook door een ander) — niet meer bijwerken. Anders: volgende keer opnieuw.
            if (e?.status === 404) deps.vergeet(b.token);
          }
        }
        return n;
      })();
      try {
        return await bezig;
      } finally {
        bezig = null;
      }
    },
    /** Na zelf delen: deze tekening staat er al. */
    onthoud(profielId, diagramId, svg) {
      laatste.set(sleutel(profielId, diagramId), svg);
    },
  };
}

