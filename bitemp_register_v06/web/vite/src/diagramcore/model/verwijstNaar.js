// @ts-check
/**
 * verwijstNaar — de vaste **doorklik** van een element naar een diagram (M3,
 * 2026-10-20, Mark: "zoals notities en cross-profile relaties, iets
 * generieks"). Zoals EA's composite element (child diagram): dubbelklik op het
 * element opent dat diagram, ook in een ander profiel.
 *
 * - Opslag: `data.verwijstNaar = {profielId, diagramId}` — dezelfde vorm als
 *   een element-verwijzing (`instantieVan = {profielId, elementId}`). 0..1.
 * - Alleen op knopen; niet op connectoren en notities. Een type zet hem uit met
 *   `ElementType.verwijstNaar: false` (analoog aan `beschrijving: false`).
 * - Heeft een profiel een eigen property met `betekenis: "verwijzing"` — de
 *   gedragsverwijzing (`gedragDiagramId`: UML CallBehaviorAction.behavior,
 *   submachine, BPMN calledElement) — dan ís die de doorklik en zet de motor
 *   er geen tweede bij. Zelfde regel als de beschrijving (MIM-definitie).
 * - Een kale string als waarde (oude `gedragDiagramId`) betekent "een diagram
 *   in dit profiel"; `normaliseerVerwijzing` maakt er het object van.
 *
 * Ontwerp: docs/plans/2026-10-20 Notities, constraints en doorklikken §4.
 * Puur en store-loos.
 */

/** De vaste M3-eigenschap. */
export const VERWIJST_NAAR = { key: "verwijstNaar", label: "verwijst naar", datatype: "diagram-verwijzing", betekenis: "verwijzing" };

/**
 * Heeft dit type de vaste doorklik? Niet bij connectoren, notities (vorm
 * `note`) en waar het profiel `verwijstNaar: false` zet.
 * @param {{verwijstNaar?: boolean, isConnector?: boolean, shape?: string}|null|undefined} type
 */
export function heeftVerwijstNaar(type) {
  if (!type) return false;
  if (type.isConnector || type.verwijstNaar === false) return false;
  return type.shape !== "note";
}

/**
 * De eigenschappen van een type, met de vaste doorklik achteraan — tenzij het
 * type hem niet heeft of zelf een property met die betekenis heeft.
 * @param {Array<{key?: string, betekenis?: string}>|undefined} properties
 * @param {any} type
 */
export function metVerwijstNaar(properties, type) {
  const lijst = properties || [];
  if (!heeftVerwijstNaar(type)) return lijst;
  if (lijst.some((p) => p?.betekenis === "verwijzing" || p?.key === VERWIJST_NAAR.key)) return lijst;
  return [...lijst, VERWIJST_NAAR];
}

/**
 * Maak van een opgeslagen waarde het object; een kale string is een diagram in
 * het eigen profiel.
 * @param {unknown} waarde
 * @param {string|null} [eigenProfielId]
 * @returns {{profielId: string|null, diagramId: string}|null}
 */
export function normaliseerVerwijzing(waarde, eigenProfielId = null) {
  if (!waarde) return null;
  if (typeof waarde === "string") return { profielId: eigenProfielId, diagramId: waarde };
  if (typeof waarde === "object" && /** @type {any} */ (waarde).diagramId) {
    const w = /** @type {any} */ (waarde);
    return { profielId: w.profielId || eigenProfielId, diagramId: w.diagramId };
  }
  return null;
}

/**
 * De doorklik van een element: eerst een profiel-eigen property met
 * `betekenis: "verwijzing"` (gedragsverwijzing), anders de vaste
 * `data.verwijstNaar`. Voor dubbelklik, badge en contextmenu.
 * @param {{data?: Record<string, any>}|null|undefined} element
 * @param {any} type
 * @param {string|null} [eigenProfielId]
 * @returns {{profielId: string|null, diagramId: string}|null}
 */
export function doorklikVan(element, type, eigenProfielId = null) {
  const data = element?.data || {};
  for (const p of type?.properties || []) {
    if (p?.betekenis === "verwijzing" && p.key && data[p.key]) return normaliseerVerwijzing(data[p.key], eigenProfielId);
  }
  if (!heeftVerwijstNaar(type)) return null;
  return normaliseerVerwijzing(data.verwijstNaar, eigenProfielId);
}
