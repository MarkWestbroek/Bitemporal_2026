/**
 * exportFilter — wat gaat er wél en niet mee in een afbeeldings-export.
 *
 * Eén predicaat voor twee gebruikers, en dat is precies de bedoeling: de
 * serialisatie (html-to-image) én de kadermeting (tekenBounds) moeten het over
 * dezelfde verzameling elementen eens zijn. Meet je een ander kader dan je
 * tekent, dan valt er iets buiten de afbeelding.
 *
 * Let op de SVG-valkuil: html-to-image kloont een `<svg>` in één keer diep
 * (`cloneNode(true)`) en loopt de inhoud daarna níet meer langs dit filter
 * (`clone-node.js`, `cloneChildren`). React Flow zet elke edge in een eigen
 * `<svg>`-wikkel, dus een beslissing over een lijn moet op die wikkel vallen —
 * op de `<g class="react-flow__edge">` erbinnen komt het filter nooit langs.
 */

/** Canvas-chrome: nooit in een export (en dus ook niet in het kader). */
const CHROME = [
  "react-flow__minimap",
  "react-flow__controls",
  "react-flow__background",
  "react-flow__panel",
  "react-flow__attribution",
  "react-flow__handle",
  // Blauwe resize-lijntjes/blokjes van een geselecteerde node: bedieningsspul,
  // geen inhoud — anders staan ze in de geëxporteerde plaat.
  "react-flow__resize-control",
];

/** `getAttribute` werkt op HTML én SVG (anders dan `dataset` in oudere Safari). */
const attr = (el, naam) => (typeof el.getAttribute === "function" ? el.getAttribute(naam) : null);

/** Bij welke edge hoort dit element — de `<g>`, zijn `<svg>`-wikkel of een label? */
function edgeIdVan(el) {
  if (el.classList.contains("react-flow__edge")) return attr(el, "data-id");
  const labelVan = attr(el, "data-edge-id");
  if (labelVan) return labelVan;
  if ((el.tagName || "").toLowerCase() === "svg") {
    const g = el.querySelector?.(".react-flow__edge");
    if (g) return attr(g, "data-id");
  }
  return null;
}

/**
 * @param {object} [p]
 *   beperkTot: {nodeIds:Set<string>, edgeIds:Set<string>} — bij een
 *     selectie-export. Zonder beperking rendert de hele viewport en liften de
 *     buren half-afgesneden mee in het uitgesneden kader.
 * @returns {(el:Element) => boolean}
 */
export function maakExportFilter({ beperkTot } = {}) {
  return function neemMee(el) {
    const klassen = el?.classList;
    // Tekst-/commentaarknopen (geen classList) horen bij hun ouder: meenemen.
    if (!klassen || typeof klassen.contains !== "function") return true;
    if (CHROME.some((c) => klassen.contains(c))) return false;
    if (!beperkTot) return true;
    if (klassen.contains("react-flow__node")) return beperkTot.nodeIds.has(attr(el, "data-id"));
    // Edge-labels wonen in de edgelabel-renderer, los van hun edge; ze dragen
    // `data-edge-id` zodat ze hier bij hun lijn horen.
    const edgeId = edgeIdVan(el);
    if (edgeId != null) return beperkTot.edgeIds.has(edgeId);
    return true;
  };
}
