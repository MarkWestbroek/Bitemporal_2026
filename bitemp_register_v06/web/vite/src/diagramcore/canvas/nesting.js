// @ts-check
/**
 * nesting — containers houden hun inhoud vast (backlog §31.3, ontwerp
 * `docs/plans/2026-09-18 Diagrameditor — containers, afbakening …`).
 *
 * Lidmaatschap is een connector in het **model** (`ElementType.containerVoor`
 * wijst naar het connectortype, bv. `bevat`: container → lid). Deze module
 * leidt daaruit af welke voorkomens op dít diagram als React Flow-kind van een
 * container-voorkomen renderen:
 *
 *   - alleen als het lid geometrisch **ín** de container ligt (middelpunt
 *     binnen de rechthoek) — dezelfde regel als `verbergBijNesting`, zodat de
 *     lidmaatschapslijn en de nesting elkaar nooit tegenspreken en bestaande
 *     diagrammen niet verspringen;
 *   - de store blijft **absolute** posities voeren; de canvas rekent om
 *     (absoluut → relatief bij opbouwen, terug bij dragstop). Connector-
 *     materialisatie, auto-layout en export rekenen dus gewoon door.
 *
 * Puur en store-loos: testbaar met kale objecten.
 */
import { voorkomenId, voorkomensPerElement } from "../model/voorkomens.js";

const STANDAARD_MAAT = { width: 200, height: 80 };

function maatVan(ref, maten) {
  const gemeten = maten?.[voorkomenId(ref)];
  return {
    width: ref.size?.width ?? gemeten?.width ?? STANDAARD_MAAT.width,
    height: ref.size?.height ?? gemeten?.height ?? STANDAARD_MAAT.height,
  };
}

/**
 * Lid-element-id → container-element-id, uit de lidmaatschaps-connectoren.
 * @param {Record<string, Object>} elements
 * @param {Record<string, Object>} elementTypesById
 * @returns {Map<string, string>}
 */
export function containerVanElementen(elements, elementTypesById) {
  const resultaat = new Map();
  for (const el of Object.values(elements || {})) {
    if (!el?.source || !el?.target || el.source === el.target) continue;
    const bronType = elementTypesById[elements[el.source]?.elementType];
    if (!bronType?.containerVoor || bronType.containerVoor !== el.elementType) continue;
    if (!resultaat.has(el.target)) resultaat.set(el.target, el.source);
  }
  return resultaat;
}

/**
 * @typedef {Object} Nesting
 * @property {Map<string, string>} ouderVan   lid-voorkomen-id → container-voorkomen-id
 * @property {Map<string, number>} diepte     voorkomen-id → nestdiepte (0 = top-level)
 */

/**
 * @param {Record<string, Object>} elements
 * @param {Object} diagram
 * @param {Record<string, Object>} elementTypesById
 * @param {Record<string, {width:number,height:number}>} [maten] gemeten maten per voorkomen-id
 * @returns {Nesting}
 */
export function bepaalNesting(elements, diagram, elementTypesById, maten = null) {
  /** @type {Nesting} */
  const resultaat = { ouderVan: new Map(), diepte: new Map() };
  const nodes = diagram?.nodes || [];
  const containerVan = containerVanElementen(elements, elementTypesById);
  if (!containerVan.size) return resultaat;
  const voorkomens = voorkomensPerElement(nodes);

  for (const ref of nodes) {
    const containerId = containerVan.get(ref.elementId);
    if (!containerId || !ref.position) continue;
    // Een aangehecht rand-element hangt al aan zijn gastheer.
    const lid = elements[ref.elementId];
    if (elementTypesById[lid?.elementType]?.randElement && lid?.data?.randVan) continue;
    const m = maatVan(ref, maten);
    const mid = { x: ref.position.x + m.width / 2, y: ref.position.y + m.height / 2 };
    const ouder = (voorkomens.get(containerId) || []).find((c) => {
      if (!c.position || c.gedaante) return false;
      const cm = maatVan(c, maten);
      return (
        mid.x >= c.position.x &&
        mid.x <= c.position.x + cm.width &&
        mid.y >= c.position.y &&
        mid.y <= c.position.y + cm.height
      );
    });
    if (ouder) resultaat.ouderVan.set(voorkomenId(ref), voorkomenId(ouder));
  }

  // Diepte (voor de ouders-vóór-kinderen-volgorde die React Flow eist), met
  // cycle-guard: een kring in het lidmaatschap nest niemand.
  const diepteVan = (id, pad = new Set()) => {
    const ouder = resultaat.ouderVan.get(id);
    if (!ouder) return 0;
    if (pad.has(id)) return -1;
    pad.add(id);
    const d = diepteVan(ouder, pad);
    return d < 0 ? -1 : d + 1;
  };
  const dieptes = new Map();
  for (const id of resultaat.ouderVan.keys()) dieptes.set(id, diepteVan(id));
  for (const [id, d] of dieptes) {
    if (d < 0) resultaat.ouderVan.delete(id);
    else resultaat.diepte.set(id, d);
  }
  return resultaat;
}

/**
 * Alle (ook diepere) genestelde nakomelingen van een container-voorkomen.
 * @param {Nesting} nesting
 * @param {string} containerVoorkomenId
 * @returns {string[]}
 */
export function nakomelingenVan(nesting, containerVoorkomenId) {
  const uit = [];
  const rij = [containerVoorkomenId];
  while (rij.length) {
    const huidig = rij.shift();
    for (const [kind, ouder] of nesting.ouderVan) {
      if (ouder === huidig && !uit.includes(kind)) {
        uit.push(kind);
        rij.push(kind);
      }
    }
  }
  return uit;
}
