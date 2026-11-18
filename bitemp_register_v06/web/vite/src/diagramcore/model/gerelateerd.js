// @ts-check
/**
 * gerelateerd — welke elementen hangen (via verbindingen) aan een element, en staan nog niet op
 * het diagram? Achter "Gerelateerde elementen toevoegen…" (Mark, 07-11: "vanuit een willekeurig
 * element … een lijstje met alle nog niet op het diagram staande elementen die een relatie hebben
 * met het element. Dat kan elk type associatie zijn. Een CM REL moet dan wel expanden naar de
 * bron- of doelENT").
 *
 * Model: elementen zijn knopen; een verbinding (connector: source + target) verbindt ze. Een
 * verbinding is zelf geen kandidaat, want een lijn tekent zich vanzelf zodra beide uiteinden op
 * het diagram staan; we lopen er doorheen naar het andere uiteinde (zo "expandeert" een relatie).
 * Is het startelement zelf een verbinding (bv. een relatie als associatieklasse-box), dan zijn
 * zijn uiteinden de buren op niveau 1.
 *
 * Niveau = aantal stappen element → element vanaf de start. Elementen die al op het diagram
 * staan, tellen mee voor de afstand (we lopen erdoorheen) maar komen niet in de lijst.
 * Node-testbaar; de activiteit plaatst ze.
 */

import { afgeleideKoppelingen } from "./afgeleideKoppelingen.js";
import { ontleedVreemdeId, vreemdeId } from "./vreemd.js";
import { KOPPEL_ID_PREFIX } from "./koppellijnen.js";

/**
 * @typedef {{ id: string, naam: string, typeLabel: string, niveau: number,
 *   via: { connectorId: string, typeLabel: string, naam: string, vanId: string, vanNaam: string } }} Kandidaat
 */

/**
 * @param {{ startIds: string[], elements: Record<string, any>, opDiagram: Set<string>,
 *   elementTypesById: Record<string, any>, diepte?: number,
 *   koppelingen?: { id: string, source: string, target: string, typeLabel: string }[],
 *   vreemdeKnopen?: Record<string, { naam: string, typeLabel: string }> }} p
 *   diepte: hoeveel stappen (1 = direct verbonden); Infinity = alles wat bereikbaar is.
 *   koppelingen (15-11): kruisverbanden naar een andere taal, met canvas-ids (een vreemd uiteinde
 *   als `<profielId>::<elementId>`); `vreemdeKnopen` geeft naam en type van die uiteinden. De
 *   verbindingen binnen die andere taal kunnen ook in `koppelingen` staan (zie `kruisGraaf`).
 * @returns {Kandidaat[]} gesorteerd op niveau, dan naam.
 */
export function gerelateerdeElementen({ startIds, elements: eigen, opDiagram, elementTypesById, diepte = 1, koppelingen = [], vreemdeKnopen = {} }) {
  const KOPPEL_TYPE = "__gerelateerd:koppeling";
  /** @type {Record<string, any>} */
  let elements = eigen;
  if (koppelingen.length) {
    elements = { ...eigen };
    for (const [id, k] of Object.entries(vreemdeKnopen)) elements[id] = { id, naam: k.naam, elementType: `__vreemd:${k.typeLabel}` };
    for (const k of koppelingen) elements[k.id] = { id: k.id, naam: "", elementType: KOPPEL_TYPE, source: k.source, target: k.target, typeLabel: k.typeLabel };
  }
  const isConnector = (el) => !!el?.source && !!el?.target && (el.elementType === KOPPEL_TYPE || !!elementTypesById?.[el.elementType]?.isConnector);
  // Buren per element, één keer opgebouwd: [anderId, connectorId].
  /** @type {Map<string, Array<[string, string]>>} */
  const buren = new Map();
  const voeg = (a, b, cid) => {
    if (!buren.has(a)) buren.set(a, []);
    buren.get(a)?.push([b, cid]);
  };
  for (const c of Object.values(elements || {})) {
    if (!isConnector(c) || c.source === c.target) continue;
    voeg(c.source, c.target, c.id);
    voeg(c.target, c.source, c.id);
    // Een verbinding als knoop (associatieklasse-box): haar uiteinden zijn haar buren.
    voeg(c.id, c.source, c.id);
    voeg(c.id, c.target, c.id);
  }
  const label = (el) =>
    el?.typeLabel ||
    elementTypesById?.[el?.elementType]?.label ||
    (String(el?.elementType || "").startsWith("__vreemd:") ? el.elementType.slice("__vreemd:".length) : el?.elementType || "");
  /** @type {Map<string, Kandidaat>} */
  const gevonden = new Map();
  const bezocht = new Set(startIds);
  let rand = [...startIds];
  for (let niveau = 1; niveau <= diepte && rand.length; niveau++) {
    const volgende = [];
    for (const van of rand) {
      for (const [ander, cid] of buren.get(van) || []) {
        if (bezocht.has(ander) || !elements[ander]) continue;
        bezocht.add(ander);
        // Een verbinding die zelf een uiteinde is (verbinding aan een verbinding): erdoorheen,
        // zonder haar als kandidaat te tonen.
        if (!isConnector(elements[ander]) && !opDiagram.has(ander)) {
          const c = elements[cid];
          gevonden.set(ander, {
            id: ander,
            naam: elements[ander].naam || ander,
            typeLabel: label(elements[ander]),
            niveau,
            via: { connectorId: cid, typeLabel: label(c), naam: c?.naam || "", vanId: van, vanNaam: elements[van]?.naam || van },
          });
        }
        volgende.push(ander);
      }
    }
    rand = volgende;
  }
  return [...gevonden.values()].sort((a, b) => a.niveau - b.niveau || a.naam.localeCompare(b.naam));
}

/**
 * De graaf over talen heen voor `gerelateerdeElementen` (Mark 15-11: "mag ook in een vreemde taal
 * verder gaan"). Vanaf de talen van de startelementen volgen we kruisverbanden (matrix + afgeleid,
 * afgeleideKoppelingen.js) naar andere talen; van elke taal die zo meedoet komen alle elementen
 * (als canvas-id `<profielId>::<elementId>`) en haar eigen verbindingen erbij. Zo loopt "alles wat
 * bereikbaar is" door een cm-model heen, ook als je vanuit een BPMN-diagram begint.
 *
 * @param {{ eigenProfielId: string, startIds: string[], links: any[],
 *   bronVan: (profielId: string) => ({ elements: Record<string, any>, descriptor: any, label: string } | null) }} p
 *   links: de kruisverbanden uit de matrix; bronVan: de elementen/descriptor van een andere taal.
 * @returns {{ koppelingen: { id: string, source: string, target: string, typeLabel: string }[],
 *   vreemdeKnopen: Record<string, { naam: string, typeLabel: string }> }}
 */
export function kruisGraaf({ eigenProfielId, startIds, links, bronVan }) {
  const talen = new Map(); // profielId → bron (eigen taal: null; die zit al in `elements`)
  talen.set(eigenProfielId, null);
  const voegTaal = (pid) => {
    if (!pid || talen.has(pid)) return false;
    const bron = bronVan(pid);
    if (!bron) return false;
    talen.set(pid, bron);
    return true;
  };
  for (const s of startIds) voegTaal(ontleedVreemdeId(s)?.profielId);
  // Kruisverbanden: de matrix plus de afgeleide van elke taal die meedoet (die kunnen er
  // bijkomen als er een taal bijkomt). Herhalen tot er geen taal meer bijkomt.
  /** @type {any[]} */
  let alle = [];
  for (let ronde = 0; ronde < 50; ronde++) {
    alle = [...(links || [])];
    for (const [pid, bron] of talen) if (bron) alle.push(...afgeleideKoppelingen({ profielId: pid, elements: bron.elements, elementTypes: bron.descriptor?.elementTypes }));
    let erbij = false;
    for (const l of alle) {
      if (!l?.rij || !l?.kolom) continue;
      if (talen.has(l.rij.profielId)) erbij = voegTaal(l.kolom.profielId) || erbij;
      if (talen.has(l.kolom.profielId)) erbij = voegTaal(l.rij.profielId) || erbij;
    }
    if (!erbij) break;
  }
  const cid = (ref) => (ref.profielId === eigenProfielId ? ref.elementId : vreemdeId(ref.profielId, ref.elementId));
  /** @type {Record<string, { naam: string, typeLabel: string }>} */
  const vreemdeKnopen = {};
  const koppelingen = [];
  for (const [pid, bron] of talen) {
    if (!bron) continue;
    const typen = Object.fromEntries((bron.descriptor?.elementTypes || []).map((t) => [t.id, t]));
    for (const el of Object.values(bron.elements || {})) {
      const t = typen[el?.elementType];
      if (t?.isConnector && el.source && el.target) {
        koppelingen.push({ id: vreemdeId(pid, el.id), source: vreemdeId(pid, el.source), target: vreemdeId(pid, el.target), typeLabel: t.label || el.elementType });
      } else if (el?.id) {
        vreemdeKnopen[vreemdeId(pid, el.id)] = { naam: el.naam || el.id, typeLabel: `${t?.label || el.elementType}, ${bron.label}` };
      }
    }
  }
  for (const l of alle) {
    if (!l?.rij || !l?.kolom || !talen.has(l.rij.profielId) || !talen.has(l.kolom.profielId)) continue;
    koppelingen.push({ id: KOPPEL_ID_PREFIX + l.id, source: cid(l.rij), target: cid(l.kolom), typeLabel: `«${l.soort}»` });
  }
  return { koppelingen, vreemdeKnopen };
}

/**
 * Posities voor nieuwe elementen in de vrije ruimte (Mark 15-11: de kring zette elementen boven het
 * startpunt, onder de werkbalken). Per niveau een kolom rechts van het anker (niveau 1 de eerste),
 * van boven naar beneden vanaf de hoogte van het anker; een plek die een bestaand element (of een
 * eerder geplaatst nieuw element) raakt, wordt overgeslagen. Nooit boven het anker.
 * @param {{x: number, y: number, width?: number}} anker - linksboven (en breedte) van het startelement
 * @param {Array<{id: string, niveau: number}>} kandidaten
 * @param {Array<{x: number, y: number, width: number, height: number}>} [bezet] - de elementen die er al staan
 * @param {{width: number, height: number, tussen: number}} [maat] - de ruimte die een nieuw element vraagt
 * @returns {Record<string, {x: number, y: number}>}
 */
export function vrijePosities(anker, kandidaten, bezet = [], maat = { width: 180, height: 90, tussen: 60 }) {
  const vakken = bezet.map((b) => ({ ...b }));
  const raakt = (v) => vakken.some((b) => v.x < b.x + b.width + maat.tussen / 2 && b.x < v.x + v.width + maat.tussen / 2 && v.y < b.y + b.height + maat.tussen / 2 && b.y < v.y + v.height + maat.tussen / 2);
  const niveaus = [...new Set(kandidaten.map((k) => k.niveau))].sort((a, b) => a - b);
  const kolomX = (i) => Math.round(anker.x + (anker.width || maat.width) + maat.tussen * 2 + i * (maat.width + maat.tussen * 2));
  /** @type {Record<string, {x: number, y: number}>} */
  const uit = {};
  niveaus.forEach((niveau, i) => {
    const x = kolomX(i);
    let rij = 0;
    for (const k of kandidaten.filter((c) => c.niveau === niveau)) {
      let v;
      for (;; rij += 1) {
        v = { x, y: Math.round(anker.y + rij * (maat.height + maat.tussen)), width: maat.width, height: maat.height };
        if (!raakt(v)) break;
      }
      vakken.push(v);
      uit[k.id] = { x: v.x, y: v.y };
      rij += 1;
    }
  });
  return uit;
}
