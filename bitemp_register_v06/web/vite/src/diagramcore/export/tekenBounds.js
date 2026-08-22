/**
 * tekenBounds — het kader van wat er écht getekend staat, in flow-coördinaten.
 *
 * Waarom niet React Flow's `getNodesBounds`? Omdat die alleen de node-boxen
 * uit het model kent, en dat kader is stelselmatig te krap:
 *   - shapes mogen buiten hun box tekenen. De graaf-bol ("bol") zet zijn
 *     satelliet-velden ruim búiten de kern-cirkel (~56 px rondom), en
 *     `naamLabel: "buiten"` hangt de naam ónder de node.
 *   - edges lopen met een boog of knik ver buiten de rechthoek van hun
 *     eindpunten, en hun labels (rol, multipliciteit) staan daar weer naast.
 *   - rand-elementen (poorten, sentries, boundary-events) renderen als React
 *     Flow-kind: hun `position` is relatief aan de gastheer, terwijl
 *     `getNodesBounds` zonder nodeLookup hem als absoluut leest.
 * Alles wat buiten dat kader viel, werd bij het exporteren afgesneden.
 *
 * Daarom meten we de DOM in plaats van het model: de unie van de client-rects
 * van precies díe elementen die ook mee-geëxporteerd worden. Wat je ziet is
 * wat er in de afbeelding past.
 *
 * De rects staan in schermpixels op de huidige zoom; delen door de zoomfactor
 * geeft flow-eenheden (de export rendert altijd op zoom 1).
 */

/** SVG-plumbing die niets tekent (en dus niet meetelt). */
const NIET_GETEKEND = new Set(["defs", "clippath", "mask", "marker", "pattern", "lineargradient", "radialgradient", "symbol", "metadata", "title", "desc"]);

/** Overflow van een element: inline stijl eerst (werkt ook buiten de browser). */
function overflowVan(el) {
  const inline = el.style?.overflow;
  if (inline) return inline;
  if (typeof getComputedStyle !== "function") return "";
  try {
    return getComputedStyle(el).overflow;
  } catch {
    return "";
  }
}

/**
 * Meet een element zelf mee, of alleen zijn inhoud? Een `<svg>` met
 * `overflow: visible` is een tékenvlak dat ruimer is dan wat erin getekend
 * wordt — de graaf-bol hangt zijn satellieten in zo'n vlak van 204x204 terwijl
 * de bolletjes zelf een kleiner gebied beslaan. Op het vlak meten geeft dan een
 * te royale rand. Bij `overflow: hidden` (de SVG-standaard) is het vlak juist
 * wél de grens van wat je ziet.
 */
function alleenInhoud(el) {
  return (el.tagName || "").toLowerCase() === "svg" && overflowVan(el) === "visible";
}

/**
 * @param {object} p
 *   wortels: Element[] — te meten elementen; hun hele subboom telt mee
 *     (satellieten, buitenlabels, badges).
 *   oorsprong: {left:number, top:number} — schermpositie van flow-punt (0,0),
 *     oftewel de rect van `.react-flow__viewport` (transform-origin 0 0).
 *   zoom: huidige zoomfactor.
 *   neemMee: (el) => boolean — hetzelfde filter als de serialisatie gebruikt;
 *     een uitgefilterd element slaat ook zijn subboom over.
 * @returns {{x:number,y:number,width:number,height:number}|null}
 */
export function tekenBounds({ wortels, oorsprong, zoom = 1, neemMee = () => true }) {
  let links = Infinity;
  let boven = Infinity;
  let rechts = -Infinity;
  let onder = -Infinity;

  const meet = (el) => {
    if (!el || !neemMee(el)) return;
    if (NIET_GETEKEND.has((el.tagName || "").toLowerCase())) return;
    const r = alleenInhoud(el) ? null : el.getBoundingClientRect?.();
    // Lege rects (display:none, of een puur groeperend element) doen niet mee.
    if (r && (r.width || r.height)) {
      links = Math.min(links, r.left);
      boven = Math.min(boven, r.top);
      rechts = Math.max(rechts, r.right);
      onder = Math.max(onder, r.bottom);
    }
    for (const kind of el.children || []) meet(kind);
  };
  for (const wortel of wortels || []) meet(wortel);

  if (!Number.isFinite(links) || !Number.isFinite(rechts)) return null;
  const z = zoom || 1;
  // Naar buiten afronden: een halve pixel te veel is onzichtbaar, een halve
  // pixel te weinig is een afgesneden rand.
  const x = Math.floor((links - oorsprong.left) / z);
  const y = Math.floor((boven - oorsprong.top) / z);
  return {
    x,
    y,
    width: Math.ceil((rechts - oorsprong.left) / z) - x,
    height: Math.ceil((onder - oorsprong.top) / z) - y,
  };
}
