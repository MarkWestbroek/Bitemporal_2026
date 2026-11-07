// @ts-check
/**
 * vreemd — elementen uit een andere taal (profiel) op een diagram (Mark 07-11; plan
 * "2026-10-12 Koppeldiagram", §9a).
 *
 * Een diagram woont in één taal: `profielen.<taal>.diagrams`, en een node wijst met `elementId`
 * naar `profielen.<taal>.elements`. Een element uit een andere taal staat op het diagram als
 * node met een **samengestelde id** `<profielId>::<elementId>` (dezelfde scheiding als de
 * boomsleutels van de Modelleren-host):
 *
 *     { elementId: "archimate05::el-12", position: {…} }
 *
 * Zo werken de bestaande store-acties (plaatsen, verplaatsen, van het diagram halen, maat)
 * ongewijzigd: de sleutel is uniek binnen het diagram. Het element zelf blijft in zijn eigen
 * taal; het diagram heeft alleen een verwijzing. Een tekenaar of export die de id niet kent,
 * slaat de node over (zoals elke node zonder element).
 *
 * Voor het canvas vult `metVreemdeElementen` de elementen en de elementtypen aan:
 *  - elk vreemd element als kopie met de samengestelde id en elementType `<profielId>::<type>`;
 *  - verbindingen van die vreemde taal waarvan beide uiteinden op dit diagram staan (die tekent
 *    het canvas vanzelf, net als eigen relaties);
 *  - de elementtypen van die taal (notatie, vorm, compartimenten) met de samengestelde id, maar
 *    zonder verbindingsregels: op dit diagram maak je geen nieuwe relaties van een andere taal.
 *    De hooks voor weergave (labels, extra compartimenten, validatie) krijgen het origineel en
 *    de elementen van hun eigen taal.
 *
 * Puur: de bron per taal komt van de aanroeper (in de Studio: het profieltype-register).
 */

export const VREEMD_SCHEIDER = "::";

/** @param {string} profielId @param {string} elementId */
export function vreemdeId(profielId, elementId) {
  return `${profielId}${VREEMD_SCHEIDER}${elementId}`;
}

/**
 * @param {unknown} id
 * @returns {{profielId: string, elementId: string} | null}
 */
export function ontleedVreemdeId(id) {
  if (typeof id !== "string") return null;
  const i = id.indexOf(VREEMD_SCHEIDER);
  if (i <= 0 || i + VREEMD_SCHEIDER.length >= id.length) return null;
  return { profielId: id.slice(0, i), elementId: id.slice(i + VREEMD_SCHEIDER.length) };
}

/** De talen waarvan een element op dit diagram staat (buiten de eigen taal). */
export function vreemdeProfielen(diagram) {
  const uit = new Set();
  for (const n of diagram?.nodes || []) {
    const v = ontleedVreemdeId(n?.elementId);
    if (v) uit.add(v.profielId);
  }
  return uit;
}

const WEERGAVE_HOOKS = ["edgeLabels", "extraCompartimenten", "valideer"];

/**
 * @typedef {{ elements: Record<string, any>, descriptor: any, label?: string }} VreemdeBron
 * @param {{
 *   elements: Record<string, any>,
 *   descriptor: any,
 *   diagram: any,
 *   bron: (profielId: string) => VreemdeBron | null,
 * }} invoer
 * @returns {{ elements: Record<string, any>, descriptor: any, origineel: Map<string, {profielId: string, element: any}> }}
 *   ongewijzigde objecten als er niets vreemds op het diagram staat
 */
export function metVreemdeElementen({ elements, descriptor, diagram, bron }) {
  const origineel = new Map();
  const talen = vreemdeProfielen(diagram);
  if (!talen.size) return { elements, descriptor, origineel };

  const extraElementen = {};
  const extraTypen = [];
  const extraVeldTypen = [];
  const eigenVeldTypen = new Set((descriptor?.fieldTypes || []).map((ft) => ft.id));

  for (const profielId of talen) {
    const b = bron(profielId);
    if (!b?.elements || !b?.descriptor) continue;
    const opDiagram = new Set();
    for (const n of diagram.nodes || []) {
      const v = ontleedVreemdeId(n?.elementId);
      if (v?.profielId === profielId && b.elements[v.elementId]) opDiagram.add(v.elementId);
    }
    const kopieer = (el) => {
      const id = vreemdeId(profielId, el.id);
      origineel.set(id, { profielId, element: el });
      extraElementen[id] = {
        ...el,
        id,
        elementType: vreemdeId(profielId, el.elementType),
        ...(el.source ? { source: vreemdeId(profielId, el.source) } : {}),
        ...(el.target ? { target: vreemdeId(profielId, el.target) } : {}),
        data: { ...(el.data || {}), vreemd: { profielId, elementId: el.id, taal: b.label || b.descriptor.label || profielId } },
      };
    };
    for (const eid of opDiagram) kopieer(b.elements[eid]);
    // Relaties binnen de vreemde taal tussen elementen die hier staan: zoals eigen relaties.
    for (const el of Object.values(b.elements)) {
      if (el?.source && el?.target && opDiagram.has(el.source) && opDiagram.has(el.target) && !opDiagram.has(el.id)) kopieer(el);
    }
    const nodigeTypen = new Set();
    for (const [id, { profielId: p, element }] of origineel) if (p === profielId && id) nodigeTypen.add(element.elementType);
    for (const et of b.descriptor.elementTypes || []) {
      if (nodigeTypen.has(et.id)) extraTypen.push(vreemdType(et, profielId, b, origineel));
    }
    for (const ft of b.descriptor.fieldTypes || []) {
      if (!eigenVeldTypen.has(ft.id)) {
        eigenVeldTypen.add(ft.id);
        extraVeldTypen.push(ft);
      }
    }
  }
  if (!origineel.size) return { elements, descriptor, origineel };
  return {
    elements: { ...elements, ...extraElementen },
    // Vreemde typen vóór de eigen: bij een botsende compartiment-id wint de eigen taal.
    descriptor: {
      ...descriptor,
      elementTypes: [...extraTypen, ...(descriptor?.elementTypes || [])],
      fieldTypes: [...(descriptor?.fieldTypes || []), ...extraVeldTypen],
    },
    origineel,
  };
}

/** Een elementtype van een andere taal, zoals het op dit diagram meedoet. */
function vreemdType(et, profielId, b, origineel) {
  const hooks = {};
  for (const naam of WEERGAVE_HOOKS) {
    const fn = et.hooks?.[naam];
    if (typeof fn !== "function") continue;
    hooks[naam] = (el, ctx = {}) => {
      try {
        return fn(origineel.get(el?.id)?.element || el, { ...ctx, elements: b.elements });
      } catch {
        return naam === "edgeLabels" ? null : [];
      }
    };
  }
  const { verbindingsregels: _r, bron: _b, doel: _d, containerVoor: _c, afbakeningVoor: _a, overbrugt: _o, randElement: _re, ...rest } = et;
  return {
    ...rest,
    id: vreemdeId(profielId, et.id),
    hooks,
    vreemd: { profielId, taal: b.label || b.descriptor.label || profielId },
    ...(et.isConnector ? { bron: { elementTypes: [] }, doel: { elementTypes: [] } } : {}),
  };
}
