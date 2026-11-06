// @ts-check
/**
 * plaatsUitPlan — een sequence-diagram uit een plan (de ✨ assistent, de MCP) opbouwen zoals het
 * canvas dat doet (Mark, 06-11-2026: "het boxje op de levenslijn waar de berichten aankomen en
 * vanuit gaan, die mis ik").
 *
 * Een plan kent alleen levenslijnen en berichten van lijn naar lijn. Zonder nazorg werd dat een
 * rij dozen van 160 × 70 met alle berichten op één hoogte en zonder activaties: de activaties
 * zijn afgeleid uit berichten die op **punten** van de levenslijn aankomen en vertrekken
 * (activaties.js), en punten maakte alleen het canvas (hook `naVerbinden`, zelfbericht.js).
 *
 * Deze functie doet voor een plan wat een mens op het canvas doet:
 *   - nieuwe levenslijnen op één rij, in de volgorde van het plan, zonder bewaarde maat (de
 *     renderer bepaalt 14 breed en de lengte);
 *   - elk nieuw bericht van lijn naar lijn krijgt een zendpunt en een ontvangpunt, onder elkaar in
 *     de volgorde van het plan — met `puntenVoorBericht`, dezelfde functie als het canvas.
 *
 * Puur en store-loos (laadt in Node, voor de MCP): werkt op kopieën en geeft terug wat veranderde.
 */
import { puntenVoorBericht, HAAK } from "./zelfbericht.js";

/** Afstand tussen twee levenslijnen (px): ruim genoeg voor een kop van 148 en een berichtlabel. */
export const LIJN_AFSTAND = 260;
/** Verticale afstand tussen twee berichten (px). */
export const BERICHT_STAP = 50;
/** Het eerste bericht zo ver onder de bovenkant van de levenslijn (onder de kop). */
export const EERSTE_BERICHT = 90;
const PUNT = 12;

/**
 * @param {Object} p
 * @param {{id: string, nodes?: Array<any>}} p.diagram            - het diagram na het plaatsen van de knopen
 * @param {Record<string, any>} p.elements                        - alle elementen van het profiel (bestaand + nieuw)
 * @param {string[]} p.nieuweKnopen                                - element-ids die dit plan op het diagram zette, in planvolgorde
 * @param {string[]} p.nieuweRelaties                              - ids van de relaties uit dit plan, in planvolgorde
 * @param {(berichtId: string, rol: "zend"|"ontvang") => string} p.maakPuntId - een vrij id voor een punt
 * @returns {{nodes: Array<any>, elements: Record<string, any>, punten: string[]}|null}
 *   de nieuwe knopen van het diagram, de gewijzigde en nieuwe elementen, en de ids van de nieuwe
 *   punten; null als er niets te doen was
 */
export function plaatsSequenceUitPlan({ diagram, elements, nieuweKnopen, nieuweRelaties, maakPuntId }) {
  const el = { ...elements };
  const nodes = (diagram.nodes || []).map((n) => ({ ...n, position: { ...(n.position || { x: 0, y: 0 }) } }));
  const gewijzigd = {};
  const punten = [];
  let veranderd = false;
  const isLijn = (id) => el[id]?.elementType === "levenslijn";
  const nodeVan = (id) => nodes.find((n) => n.elementId === id);

  // 1. Nieuwe levenslijnen: op één rij, rechts van wat er al staat, zonder bewaarde maat.
  const nieuw = new Set(nieuweKnopen);
  const oudeLijnen = nodes.filter((n) => isLijn(n.elementId) && !nieuw.has(n.elementId));
  const nieuweLijnen = nieuweKnopen.map(nodeVan).filter((n) => n && isLijn(n.elementId));
  if (nieuweLijnen.length) {
    const y = oudeLijnen.length ? Math.min(...oudeLijnen.map((n) => n.position.y)) : Math.min(...nieuweLijnen.map((n) => n.position.y));
    let x = oudeLijnen.length ? Math.max(...oudeLijnen.map((n) => n.position.x)) + LIJN_AFSTAND : Math.min(...nieuweLijnen.map((n) => n.position.x));
    for (const n of nieuweLijnen) {
      delete n.size;
      n.position = { x: Math.round(x), y: Math.round(y) };
      x += LIJN_AFSTAND;
    }
    veranderd = true;
  }

  // 2. Berichten van lijn naar lijn: punten erbij, onder elkaar in planvolgorde, onder wat er al is.
  const berichten = nieuweRelaties.map((id) => el[id]).filter((c) => c?.source && isLijn(c.source) && isLijn(c.target) && nodeVan(c.source) && nodeVan(c.target));
  if (berichten.length) {
    const bestaandePunten = nodes.filter((n) => el[n.elementId]?.elementType === "punt" && el[n.elementId]?.data?.randVan && nodeVan(el[n.elementId].data.randVan));
    const top = Math.min(...nodes.filter((n) => isLijn(n.elementId)).map((n) => n.position.y));
    let y = bestaandePunten.length
      ? Math.max(...bestaandePunten.map((n) => nodeVan(el[n.elementId].data.randVan).position.y + n.position.y + PUNT / 2)) + BERICHT_STAP
      : top + EERSTE_BERICHT;
    // De store-vorm die puntenVoorBericht verwacht, op onze werk-kopieën.
    const s = {
      get diagrams() { return { [diagram.id]: { ...diagram, nodes } }; },
      get elements() { return el; },
      addElement(p) { el[p.id] = p; gewijzigd[p.id] = p; punten.push(p.id); },
      addElementToDiagram(_diagramId, id, position) { nodes.push({ elementId: id, position }); },
      updateElement(id, patch) { el[id] = { ...el[id], ...patch }; gewijzigd[id] = el[id]; },
    };
    for (const bericht of berichten) {
      const zelf = bericht.source === bericht.target;
      let nr = 0;
      const maakPunt = () => ({ id: maakPuntId(bericht.id, (nr += 1) === 1 ? "zend" : "ontvang"), naam: "", elementType: "punt", compartimenten: [], data: {} });
      if (puntenVoorBericht(bericht, { s, diagramId: diagram.id, maakPunt, van: { x: 0, y } })) veranderd = true;
      y += BERICHT_STAP + (zelf ? HAAK : 0);
    }
  }
  return veranderd ? { nodes, elements: gewijzigd, punten } : null;
}
