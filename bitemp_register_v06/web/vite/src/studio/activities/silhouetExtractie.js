/**
 * silhouetExtractie — een SVG-string (uit Method Draw) omzetten naar een
 * genormaliseerd silhouet `{ inner, box:[x,y,w,h] }` voor een data-shape.
 *
 * Aanpak:
 *  - houd de groep-structuur intact (transforms op <g>'s blijven kloppen);
 *  - verwijder niet-tekenbare rommel (defs, title, namedview, style, script);
 *  - strip fill/stroke/stijl van álle elementen, zodat de node-vulling/-rand
 *    (op de wrapper-<g> in dataShape) via overerving wint — één egaal silhouet;
 *  - meet de bounding box met getBBox → `box` wordt de viewBox waarmee de vorm
 *    met de node-box meerekt.
 *
 * Browser-only (DOMParser + getBBox). Geen React/DOM-mount nodig buiten de
 * tijdelijke meet-svg die we zelf opruimen.
 */

const WEG = new Set(["defs", "title", "metadata", "style", "script", "namedview", "sodipodi:namedview"]);
const STRIP = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "fill-opacity",
  "opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "style",
  "class",
  "id",
];

/** Verwijder rommel-children en strip fill/stroke/stijl in de hele boom. */
function schoon(node) {
  for (const kind of [...node.children]) {
    const tag = kind.tagName.toLowerCase();
    if (WEG.has(tag) || WEG.has(kind.localName?.toLowerCase())) {
      kind.remove();
      continue;
    }
    for (const attr of STRIP) kind.removeAttribute(attr);
    if (kind.children.length) schoon(kind);
  }
}

/** Heeft de (geschoonde) boom nog echte tekenbare inhoud? */
function heeftInhoud(node) {
  return !!node.querySelector("path, rect, circle, ellipse, line, polyline, polygon");
}

/**
 * @param {string} svgString  Uitvoer van svgCanvas.getSvgString().
 * @param {Document} [doc]    Document voor de tijdelijke meet-svg (default: window.document).
 * @returns {{inner:string, box:[number,number,number,number]}|null}
 */
export function extraheerSilhouet(svgString, doc = typeof document !== "undefined" ? document : null) {
  if (!svgString || !doc) return null;
  const geparsed = new DOMParser().parseFromString(svgString, "image/svg+xml");
  const bron = geparsed.querySelector("svg");
  if (!bron || geparsed.querySelector("parsererror")) return null;

  schoon(bron);
  if (!heeftInhoud(bron)) return null;

  const inner = [...bron.children].map((k) => new XMLSerializer().serializeToString(k)).join("");
  if (!inner.trim()) return null;

  // Meet de bounding box: bouw een tijdelijke, onzichtbare svg en getBBox.
  const NS = "http://www.w3.org/2000/svg";
  const meet = doc.createElementNS(NS, "svg");
  meet.setAttribute("style", "position:absolute;left:-99999px;top:-99999px;width:10px;height:10px;opacity:0;pointer-events:none");
  const groep = doc.createElementNS(NS, "g");
  groep.innerHTML = inner;
  meet.appendChild(groep);
  doc.body.appendChild(meet);
  let box;
  try {
    const b = groep.getBBox();
    box = [round(b.x), round(b.y), round(b.width), round(b.height)];
  } catch {
    box = null;
  } finally {
    meet.remove();
  }
  if (!box || box[2] <= 0 || box[3] <= 0) return null;
  return { inner, box };
}

function round(n) {
  return Math.round(n * 100) / 100;
}
