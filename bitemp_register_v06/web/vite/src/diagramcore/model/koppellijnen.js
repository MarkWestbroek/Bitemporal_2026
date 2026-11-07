// @ts-check
/**
 * koppellijnen — koppelingen (kruisverbanden) als lijnen op een diagram (Mark 07-11; stap 2 van
 * het koppeldiagram, plan "2026-10-12 Koppeldiagram" §9a).
 *
 * Een koppeling woont in de koppelingen-store (`studio/activities/koppelingenActivity.jsx`,
 * `kruisverbanden` in de project-JSON): `{id, rij:{profielId,elementId}, kolom:{…}, soort,
 * omgekeerd}`. Staan beide uiteinden op een diagram (eigen element, of een verwijzing
 * `<profielId>::<elementId>` uit model/vreemd.js), dan tekent het canvas haar als lijn. De matrix
 * en het diagram zijn zo twee weergaven van hetzelfde.
 *
 *  - `koppelTypen(soorten)`: per soort een connectortype `__koppeling:<soort>` (violet, de pijl
 *    van de soort). De verbindingsregel noemt elk elementtype op het canvas; `hooks.magVerbinden` laat alleen
 *    een paar uit **verschillende talen** door. Zo biedt het canvas bij een lijn tussen taal A en B
 *    vanzelf de koppelsoorten aan.
 *  - `metKoppelingen(...)`: voegt de typen en een synthetisch connector-element per zichtbare
 *    koppeling toe (id `koppeling:<link.id>`; de lijn op dit diagram verbergen gaat via
 *    `diagram.verborgenConnectoren`, net als bij eigen relaties).
 *
 * Puur: de links en de soorten komen van de aanroeper.
 */
import { ontleedVreemdeId, vreemdeId } from "./vreemd.js";

export const KOPPEL_TYPE_PREFIX = "__koppeling:";
export const KOPPEL_ID_PREFIX = "koppeling:";
/** Omniumpaars voor koppelingen (plan §6). */
export const KOPPEL_KLEUR = "#7c3aed";

/** @param {unknown} id */
export const isKoppelingId = (id) => typeof id === "string" && id.startsWith(KOPPEL_ID_PREFIX);
/** @param {unknown} typeId */
export const isKoppelType = (typeId) => typeof typeId === "string" && typeId.startsWith(KOPPEL_TYPE_PREFIX);
/** @param {string} id */
export const linkIdVan = (id) => (isKoppelingId(id) ? id.slice(KOPPEL_ID_PREFIX.length) : null);

/**
 * Pijl en lijn per stijl (zoals TraceGlyph in de matrix). Standaard een **dependency**
 * (gestippeld, open pijl; Mark 07-11: "zoals EA, dan zie je de richting en is het geen
 * associatie"); alleen realiseert is een realisatie (holle driehoek).
 */
const PRESENTATIE = {
  afhankelijk: { lijn: "dash-6-3", markerEnd: "pijl-open" },
  realisatie: { lijn: "dash-6-3", markerEnd: "driehoek" },
};
/** Het connectortype zonder vaste soort: bij het trekken vraagt de Studio er een (vrije soort). */
export const ANDERE_SOORT_TYPE = KOPPEL_TYPE_PREFIX + "…";

/**
 * De taal van een element zoals het op het canvas staat: een verwijzing draagt haar taal in
 * `data.vreemd`, een eigen element hoort bij het diagram.
 */
const taalVan = (el, eigenProfielId) => el?.data?.vreemd?.profielId || eigenProfielId;

/**
 * Connectortypen voor de koppelsoorten.
 * @param {{soort: string, stijl: string}[]} soorten
 * @param {string} eigenProfielId
 * @param {string[]} typeIds - alle (niet-connector) elementtypen op het canvas, eigen en vreemd
 */
export function koppelTypen(soorten, eigenProfielId, typeIds) {
  return [...(soorten || []), { soort: null, stijl: "afhankelijk" }].map((t) => ({
    id: t.soort ? KOPPEL_TYPE_PREFIX + t.soort : ANDERE_SOORT_TYPE,
    label: t.soort ? `Koppeling: ${t.soort}` : "Koppeling: andere soort…",
    kort: t.soort || "andere soort…",
    shape: "edge",
    isConnector: true,
    koppeling: true,
    koppelSoort: t.soort,
    // Elk elementtype mag; de hook beperkt tot een paar uit twee verschillende talen.
    bron: { elementTypes: typeIds },
    doel: { elementTypes: typeIds },
    hooks: {
      magVerbinden: (bron, doel) => !!bron && !!doel && taalVan(bron, eigenProfielId) !== taalVan(doel, eigenProfielId),
    },
    edgePresentatie: {
      kleur: KOPPEL_KLEUR,
      ...(PRESENTATIE[t.stijl] || PRESENTATIE.afhankelijk),
      labels: [{ zijde: "midden", delen: [{ tekst: `«${t.soort || "…"}»`, soort: "constraint", kleur: KOPPEL_KLEUR }] }],
    },
  }));
}

/**
 * De canvas-id van een koppelingsuiteinde op een diagram van `eigenProfielId`.
 * @param {{profielId: string, elementId: string}} ref
 * @param {string} eigenProfielId
 */
export const canvasIdVan = (ref, eigenProfielId) => (ref.profielId === eigenProfielId ? ref.elementId : vreemdeId(ref.profielId, ref.elementId));

/**
 * Omgekeerd: de ref (taal + element) van een canvas-id.
 * @param {string} canvasId
 * @param {string} eigenProfielId
 */
export const refVanCanvasId = (canvasId, eigenProfielId) => ontleedVreemdeId(canvasId) || { profielId: eigenProfielId, elementId: canvasId };

/**
 * @param {{
 *   elements: Record<string, any>,
 *   descriptor: any,
 *   diagram: any,
 *   eigenProfielId: string,
 *   links: {id: string, rij: any, kolom: any, soort: string, omgekeerd?: boolean}[],
 *   soorten: {soort: string, stijl: string}[],
 * }} invoer - `soorten`: de vaste lijst; een vrije soort uit een link krijgt er een type bij
 *   (stijl dependency)
 */
export function metKoppelingen({ elements, descriptor, diagram, eigenProfielId, links, soorten: vast }) {
  if (!diagram) return { elements, descriptor };
  const bekend = new Set((vast || []).map((t) => t.soort));
  const vrij = [...new Set((links || []).map((l) => l?.soort).filter((s) => s && !bekend.has(s)))].sort();
  const soorten = [...(vast || []), ...vrij.map((soort) => ({ soort, stijl: "afhankelijk" }))];
  const opDiagram = new Set((diagram.nodes || []).map((n) => n?.elementId));
  const extra = {};
  for (const l of links || []) {
    if (!l?.rij || !l?.kolom) continue;
    const van = l.omgekeerd ? l.kolom : l.rij;
    const naar = l.omgekeerd ? l.rij : l.kolom;
    const bron = canvasIdVan(van, eigenProfielId);
    const doel = canvasIdVan(naar, eigenProfielId);
    if (!opDiagram.has(bron) || !opDiagram.has(doel) || !elements[bron] || !elements[doel]) continue;
    const id = KOPPEL_ID_PREFIX + l.id;
    extra[id] = {
      id,
      naam: "",
      elementType: l.soort ? KOPPEL_TYPE_PREFIX + l.soort : ANDERE_SOORT_TYPE,
      source: bron,
      target: doel,
      compartimenten: [],
      data: { koppeling: { linkId: l.id, soort: l.soort } },
    };
  }
  // De typen altijd erbij (ook zonder koppelingen): dan kun je er een trekken.
  const typeIds = (descriptor?.elementTypes || []).filter((t) => !t.isConnector).map((t) => t.id);
  const typen = koppelTypen(soorten, eigenProfielId, typeIds);
  return {
    elements: Object.keys(extra).length ? { ...elements, ...extra } : elements,
    descriptor: { ...descriptor, elementTypes: [...(descriptor?.elementTypes || []), ...typen] },
  };
}
