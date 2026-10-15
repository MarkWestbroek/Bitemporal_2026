// @ts-check
/**
 * verschuif — een sequence-bericht verticaal verschuiven (2026-10-14, Mark).
 * Implementatie van de M3-hook `verschuifConnector` voor de berichttypen.
 *
 * Regels:
 *   - het bericht neemt beide punten mee en ligt daarna **horizontaal**: het
 *     doel-punt komt op de hoogte van het bron-punt (een zelf-bericht houdt
 *     zijn haakje);
 *   - **omlaag** duwt de berichten eronder weg zodra ze dichter dan `AFSTAND`
 *     komen (trapsgewijs) — zo maak je ruimte voor een bericht ertussen;
 *   - **omhoog** schuift vrij. Dat verandert de volgorde alleen als je een
 *     ander bericht kruist: in v0 ís de hoogte de volgorde (plan
 *     "Sequence — volgorde in het model, layout erbovenop" §2–§3).
 *
 * Alleen punten verschuiven; een uiteinde op een activatie blijft staan
 * (activaties volgen in v1, met relatieve ankers). Een **notitie** die met
 * een notitie-lijn aan een verschoven punt hangt, schuift evenveel mee (plan
 * §3: relatief aan haar anker; het anker zelf wordt nog niet bewaard).
 * Punten zijn rand-elementen: hun positie is relatief aan hun levenslijn;
 * een notitie staat absoluut. Puur en store-loos.
 */
import { voorkomenId } from "../../diagramcore/model/voorkomens.js";
import { BERICHTEN as BERICHT_TYPEN } from "./labels.js";

/** Minimale verticale afstand tussen twee berichten bij wegduwen (px). */
export const AFSTAND = 32;

const BERICHTEN = new Set(BERICHT_TYPEN);

/**
 * @param {Record<string, any>} connector
 * @param {number} dy - verschuiving in flow-pixels (positief = omlaag)
 * @param {{elements: Record<string, any>, diagram: any}} ctx
 * @returns {Record<string, {x:number, y:number}>} nieuwe (relatieve) posities per voorkomen-id
 */
export function verschuifBericht(connector, dy, { elements, diagram }) {
  const nodes = diagram?.nodes || [];
  const perElement = new Map();
  for (const n of nodes) if (!perElement.has(n.elementId)) perElement.set(n.elementId, n);
  /** Punt-uiteinde → { id, node, lijnY } of null (activatie/onbekend). */
  const punt = (id) => {
    const el = elements?.[id];
    if (el?.elementType !== "punt") return null;
    const node = perElement.get(id);
    const lijn = perElement.get(el.data?.randVan);
    if (!node?.position || !lijn?.position) return null;
    return { id: voorkomenId(node), node, lijnY: lijn.position.y, lijnId: el.data.randVan };
  };
  const absY = (p) => p.lijnY + p.node.position.y;

  /** Rijen: elk bericht op dit diagram met zijn punten en hoogte (van het bron-punt). */
  const rijen = [];
  const opDiagram = new Set(nodes.map((n) => n.elementId));
  for (const c of Object.values(elements || {})) {
    if (!BERICHTEN.has(c?.elementType) || !opDiagram.has(c.source) || !opDiagram.has(c.target)) continue;
    const punten = [punt(c.source), punt(c.target)].filter(Boolean);
    if (!punten.length) continue;
    const uniek = [...new Map(punten.map((p) => [p.id, p])).values()];
    rijen.push({ id: c.id, punten: uniek, y: absY(punten[0]) });
  }
  const eigen = rijen.find((r) => r.id === connector?.id);
  if (!eigen || !dy) return {};

  /** @type {Record<string, {x:number, y:number}>} */
  const uit = {};
  const zet = (p, nieuweAbsY) => {
    uit[p.id] = { x: p.node.position.x, y: Math.round(nieuweAbsY - p.lijnY) };
  };
  const nieuwY = eigen.y + dy;
  // Horizontaal: het ontvangpunt op de hoogte van het zendpunt — behalve bij
  // een zelf-bericht (zelfde lijn): dat houdt zijn haakje (±15px).
  const bronLijn = eigen.punten[0].lijnId;
  for (const p of eigen.punten) zet(p, p.lijnId === bronLijn ? absY(p) + dy : nieuwY);

  if (dy > 0) {
    // Wegduwen: wat eronder lag, blijft eronder met minstens AFSTAND ertussen.
    const eronder = rijen.filter((r) => r !== eigen && r.y >= eigen.y).sort((a, b) => a.y - b.y);
    let vorige = nieuwY;
    for (const r of eronder) {
      if (r.y >= vorige + AFSTAND) {
        vorige = r.y;
        continue;
      }
      const verschuiving = vorige + AFSTAND - r.y;
      for (const p of r.punten) if (!uit[p.id]) zet(p, absY(p) + verschuiving);
      vorige = r.y + verschuiving;
    }
  }

  // Notities aan een verschoven punt: evenveel mee als dat punt.
  const puntNodes = new Map();
  for (const r of rijen) for (const p of r.punten) puntNodes.set(p.id, p);
  const dyVan = (puntId) => {
    const p = puntNodes.get(puntId);
    return p && uit[p.id] ? uit[p.id].y - p.node.position.y : 0;
  };
  for (const c of Object.values(elements || {})) {
    if (c?.elementType !== "notitielijn") continue;
    const [notitieId, puntId] = elements[c.source]?.elementType === "notitie" ? [c.source, c.target] : [c.target, c.source];
    const d = dyVan(puntId);
    const node = perElement.get(notitieId);
    if (!d || !node?.position || uit[voorkomenId(node)]) continue;
    uit[voorkomenId(node)] = { x: node.position.x, y: node.position.y + d };
  }
  return uit;
}
