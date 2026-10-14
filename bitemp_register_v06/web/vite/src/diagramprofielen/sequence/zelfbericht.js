// @ts-check
/**
 * zelfbericht — een met de hand getekend bericht krijgt vanzelf zijn
 * **punten** op de levenslijn (2026-10-15, Mark; plan "Sequence — volgorde in
 * het model" §2.1: de gebruiker maakt geen punten, ze ontstaan met het
 * bericht):
 *   - getrokken van **levenslijn naar levenslijn** (de gewone manier, zoals
 *     in EA): een zendpunt op de hoogte waar de muis de lijn pakte en een
 *     ontvangpunt op dezelfde hoogte op de doel-lijn — horizontaal;
 *   - naar **dezelfde** levenslijn, hetzelfde punt of dezelfde activatie:
 *     het ontvangpunt 15px lager — het haakje van EA, en de "rugzak"-
 *     activatie volgt uit de afleiding (activaties.js);
 *   - een uiteinde op een bestaand punt of een activatie (van een ander
 *     element) blijft waar het is.
 *
 * Implementatie van de M3-hook `naVerbinden` voor de berichttypen. De
 * expliciete handles van de sleep vervallen, zodat het profiel de zijden
 * kiest (hooks.edgePresentatie: rechts eruit, hoekig, rechts erin).
 */

/** Verticale afstand tussen zend- en ontvangpunt bij een zelf-bericht (px; EA: ±15). */
export const HAAK = 15;
/** Maat van een punt en breedte van de levenslijn-node (shapes.jsx). */
const PUNT = 12;
const LIJN_BREED = 14;
/** Zonder muispositie (bv. vanaf een handle): zo ver onder de kop. */
const STANDAARD_Y = 80;

/**
 * @param {Record<string, any>} conn - de zojuist gemaakte connector
 * @param {{s: any, diagramId: string, maakPunt: () => Record<string, any>, van?: {x:number,y:number}|null, naar?: {x:number,y:number}|null}} ctx
 *   s = de profielstore-state (addElement, addElementToDiagram, updateElement);
 *   van/naar = muispositie (flow-coördinaten) bij begin en eind van de sleep
 * @returns {{source: string, target: string}|null} de nieuwe uiteinden, of null als er niets te doen is
 */
export function puntenVoorBericht(conn, { s, diagramId, maakPunt, van = null, naar = null }) {
  if (!conn) return null;
  const nodes = s.diagrams?.[diagramId]?.nodes || [];
  const nodeVan = (id) => nodes.find((n) => n.elementId === id);
  const el = (id) => s.elements?.[id];
  const bron = el(conn.source), doel = el(conn.target);
  if (!bron || !doel) return null;

  /** Levenslijn-id van een uiteinde: de lijn zelf, of de gastheer van een punt/activatie. */
  const lijnVan = (e) => (e.elementType === "levenslijn" ? e.id : e.data?.randVan || null);
  const lijnBron = lijnVan(bron), lijnDoel = lijnVan(doel);
  if (!lijnBron || !lijnDoel) return null;
  const nodeBronLijn = nodeVan(lijnBron), nodeDoelLijn = nodeVan(lijnDoel);
  if (!nodeBronLijn?.position || !nodeDoelLijn?.position) return null;

  /** Absolute hoogte (midden) van een bestaand punt of activatie. */
  const middenVan = (e) => {
    const n = nodeVan(e.id);
    if (!n?.position) return null;
    const lijn = nodeVan(e.data?.randVan);
    const h = e.elementType === "activatie" ? (n.size?.height ?? 44) : PUNT;
    return (lijn?.position?.y ?? 0) + n.position.y + h / 2;
  };
  // Hoogte van het zendpunt: een bestaand punt/activatie, anders de muis, anders een standaard.
  const yZend = bron.elementType === "levenslijn" ? (van?.y ?? nodeBronLijn.position.y + STANDAARD_Y) : middenVan(bron);
  if (yZend == null) return null;
  const zelf = lijnBron === lijnDoel;
  const yOntvang = zelf ? yZend + HAAK : yZend;

  const nieuwPunt = (lijnId, lijnNode, yAbs) => {
    const p = maakPunt();
    p.data = { ...(p.data || {}), randVan: lijnId };
    s.addElement(p);
    s.addElementToDiagram(diagramId, p.id, { x: Math.round(LIJN_BREED / 2 - PUNT / 2), y: Math.round(yAbs - lijnNode.position.y - PUNT / 2) });
    return p.id;
  };
  let source = conn.source, target = conn.target;
  // Zendpunt: een levenslijn krijgt een punt; een activatie naar zichzelf ook
  // (de activatie blijft staan); een bestaand punt blijft.
  if (bron.elementType === "levenslijn" || (bron.elementType === "activatie" && conn.source === conn.target)) {
    source = nieuwPunt(lijnBron, nodeBronLijn, yZend);
  }
  // Ontvangpunt: een levenslijn, hetzelfde punt of dezelfde activatie krijgt een punt.
  if (doel.elementType === "levenslijn" || conn.source === conn.target) {
    target = nieuwPunt(lijnDoel, nodeDoelLijn, yOntvang);
  }
  if (source === conn.source && target === conn.target) return null;
  s.updateElement(conn.id, { source, target, data: { ...(conn.data || {}), sourceHandle: null, targetHandle: null } });
  return { source, target };
}

/**
 * Na het verwijderen van een bericht (hook naVerwijderen): zijn punten
 * verdwijnen mee als geen ander bericht ze nog gebruikt — ze bestonden alleen
 * voor dit bericht (plan §2.1: punten ontstaan en verdwijnen met hun bericht).
 * @param {Record<string, any>} conn - het (al verwijderde) bericht
 * @param {{s: any}} ctx
 * @returns {string[]} de verwijderde punt-ids
 */
export function ruimPuntenOp(conn, { s }) {
  const weg = [];
  for (const id of new Set([conn?.source, conn?.target])) {
    const p = s.elements?.[id];
    if (p?.elementType !== "punt") continue;
    const nogGebruikt = Object.values(s.elements).some((e) => e.id !== conn.id && (e.source === id || e.target === id) && e.elementType !== "notitielijn");
    if (nogGebruikt) continue;
    s.deleteElement(id);
    weg.push(id);
  }
  return weg;
}

/** @deprecated naam van vóór 15-10; zelfde gedrag voor punt→zelfde punt en activatie→zichzelf. */
export function ontvangpuntVoorZelfbericht(conn, ctx) {
  return puntenVoorBericht(conn, ctx)?.target ?? null;
}
