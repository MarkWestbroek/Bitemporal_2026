// @ts-check
/**
 * migratie — breng een al opgeslagen canoniek-sandbox bij met de huidige
 * heenreis (`vanCanoniekModel`).
 *
 * Aanleiding: tot 2026-09-15 (commit db24745) vertaalde de heenreis ENT ◆ GE
 * niet naar een `compositie`-connector, maar naar een *presentatie-edge per
 * diagram* (`diagram.edges`, `data.bron` = de oude edge-data) plus een kopie
 * in `meta.compositieEdges` voor de terugreis. Het model had de compositie
 * dus wél — alleen tekende de sandbox hem als losse lijn. De sandbox
 * persisteert in localStorage en spiegelt het model alleen als hij leeg is,
 * dus een vóór die datum geladen sandbox houdt de oude vorm. Gevolg: alles
 * wat een compositie-connector nodig heeft (lijn op een nieuw diagram,
 * selecteren/verwijderen, opname van een GE in de ENT) werkt daar niet.
 *
 * `vouwOudeComposities` doet wat de heenreis nu doet, maar op de opgeslagen
 * sandbox: elke structurele ENT→GE-compositie wordt een connector, de
 * dubbele presentatie-edges verdwijnen. Idempotent; `meta.compositiesGevouwen`
 * markeert dat de meta-kopie verwerkt is, zodat een compositie die je daarna
 * zelf in de sandbox verwijdert niet terugkomt.
 *
 * Tweede stap (17-09): elementen die vóór de bewerkbare properties zijn
 * ingeladen missen die sleutels in `data` (ze zaten alleen in `data.bron`),
 * bv. `jsonRolnaam` op composities of typenaam/meervoud op GE's. Welke
 * sleutels dat zijn volgt uit het profiel (mappingV3Canoniek.js). Een ontbrekende
 * sleutel wordt aangevuld uit `data.bron`; een sleutel die er al is (ook
 * leeg, na bewerken) blijft staan.
 *
 * Puur en store-loos: testbaar met kale objecten.
 */
import { normaliseerHandle } from "../../diagramcore/canvas/materialiseerConnectoren.js";
import { vertaalbareVeldenPerType } from "./mappingV3Canoniek.js";

/** Is deze presentatie-edge een (oude) compositie ENT → GE? */
function isOudeCompositie(edge, elements) {
  if (elements[edge.source]?.elementType !== "entiteit") return false;
  if (elements[edge.target]?.elementType !== "gegevenselement") return false;
  const d = edge.data?.bron || edge.data || {};
  return !(d.isAssociation || d.isDependency || d.isGeneralization || d.kind === "scope");
}

/**
 * @param {{elements: Record<string, Object>, diagrams: Record<string, Object>, meta?: Object}} state
 * @param {Array<Object>} [elementTypes]  de elementtypen van het profiel (bron van de veldnamen)
 * @returns {{elements: Record<string, Object>, diagrams: Record<string, Object>, meta: Object} | null}
 *   de bijgewerkte delen, of null als er niets te doen is
 */
export function vouwOudeComposities(state, elementTypes = []) {
  const veldenPerType = vertaalbareVeldenPerType(elementTypes);
  const elements = state?.elements || {};
  const diagrams = state?.diagrams || {};
  const meta = state?.meta || {};
  if (!Object.keys(elements).length) return null;

  const oudeEdges = [];
  for (const diag of Object.values(diagrams)) {
    for (const e of diag?.edges || []) if (isOudeCompositie(e, elements)) oudeEdges.push(e);
  }
  const metaTeDoen = meta.compositiesGevouwen ? [] : meta.compositieEdges || [];

  // Aanvullen uit data.bron (zie kop). Werkt op een kopie van de elementen.
  let aangevuld = null;
  for (const el of Object.values(elements)) {
    const velden = veldenPerType[el.elementType];
    if (!velden) continue;
    const d = el.data || {};
    const bron = d.bron || {};
    const ontbrekend = velden.filter((k) => !(k in d) && bron[k]);
    if (!ontbrekend.length) continue;
    aangevuld = aangevuld || { ...elements };
    aangevuld[el.id] = { ...el, data: { ...d, ...Object.fromEntries(ontbrekend.map((k) => [k, bron[k]])) } };
  }
  if (!oudeEdges.length && meta.compositiesGevouwen) {
    return aangevuld ? { elements: aangevuld, diagrams, meta } : null;
  }

  const bestaand = new Set(
    Object.values(elements)
      .filter((el) => el.elementType === "compositie" && el.source && el.target)
      .map((el) => `${el.source}->${el.target}`)
  );
  const metaVoorPaar = new Map(metaTeDoen.map((e) => [`${e.source}->${e.target}`, e]));

  // Kandidaten: de meta-kopie (ook composities zonder diagram-lijn) en de
  // presentatie-edges (voor handles en als vangnet zonder meta).
  const paren = new Map();
  for (const e of metaTeDoen) {
    if (elements[e.source]?.elementType !== "entiteit") continue;
    if (elements[e.target]?.elementType !== "gegevenselement") continue;
    paren.set(`${e.source}->${e.target}`, { source: e.source, target: e.target });
  }
  for (const e of oudeEdges) {
    const sleutel = `${e.source}->${e.target}`;
    if (!paren.has(sleutel)) paren.set(sleutel, { source: e.source, target: e.target });
  }

  const nieuweElements = { ...(aangevuld || elements) };
  let toegevoegd = 0;
  for (const [sleutel, { source, target }] of paren) {
    if (bestaand.has(sleutel)) continue;
    const metaEdge = metaVoorPaar.get(sleutel);
    const presentatie = oudeEdges.find((e) => e.source === source && e.target === target);
    const ed = metaEdge?.data || presentatie?.data?.bron || {};
    const structuralEdgeId = metaEdge?.id || presentatie?.id || null;
    const geBron = elements[target]?.data?.bron || {};

    const data = { bron: ed, structuralEdgeId };
    for (const k of veldenPerType.compositie || []) if (ed[k]) data[k] = ed[k];
    const heen = ed.naamLabelHeen || geBron.naamLabelHeen;
    const terug = ed.naamLabelTerug || geBron.naamLabelTerug;
    if (heen) data.naamLabelHeen = heen;
    if (terug) data.naamLabelTerug = terug;
    for (const diag of Object.values(diagrams)) {
      const pe = (diag?.edges || []).find((x) => x.source === source && x.target === target);
      if (!pe) continue;
      const bronH = normaliseerHandle(pe.sourceHandle, "source");
      const doelH = normaliseerHandle(pe.targetHandle, "target");
      if (bronH && !data.sourceHandle) data.sourceHandle = bronH;
      if (doelH && !data.targetHandle) data.targetHandle = doelH;
    }

    let id = `comp_${structuralEdgeId || sleutel}`;
    while (nieuweElements[id]) id += "_";
    nieuweElements[id] = { id, naam: "", elementType: "compositie", source, target, compartimenten: [], data };
    bestaand.add(sleutel);
    toegevoegd += 1;
  }

  const nieuweDiagrams = oudeEdges.length
    ? Object.fromEntries(
        Object.entries(diagrams).map(([id, diag]) => {
          const edges = (diag?.edges || []).filter((e) => !isOudeCompositie(e, elements));
          return [id, edges.length === (diag?.edges || []).length ? diag : { ...diag, edges }];
        })
      )
    : diagrams;

  return {
    elements: toegevoegd || aangevuld ? nieuweElements : elements,
    diagrams: nieuweDiagrams,
    meta: { ...meta, compositiesGevouwen: true },
  };
}
