// @ts-check
/**
 * afbakening — het motor-primitief waarmee een containertype **verbindingen
 * begrenst** (backlog §31.4, ontwerp `docs/plans/2026-09-18 Diagrameditor —
 * containers, afbakening …`).
 *
 * Er zijn twee soorten containers. Een **partitie** deelt alleen in (BPMN
 * Lane, UML Activity-partition, package); een **afbakening** begrenst wat er
 * verbonden mag worden (BPMN Pool/Process, uitgeklapt Sub-Process, een Region
 * van een samengestelde toestand, een CMMN-stage, de block-context in een
 * SysML-ibd). Dat verschil is geen profielregel maar een vaste eigenschap van
 * het type — net als `containerVoor` en `randElement` — dus de betekenis zit
 * hier in de core en het profiel wijst alleen aan:
 *
 *   ElementType.afbakeningVoor: [connectorTypeId, …]
 *     dit containertype begrenst die verbindingen: bron en doel liggen in
 *     **dezelfde** afbakening (of allebei in geen). BPMN: een sequence flow
 *     kruist de grens van een Pool niet — de flows zijn eigendom van het
 *     proces dat de pool afbakent.
 *
 *   ConnectorType.overbrugt: [elementTypeId, …]
 *     deze verbinding **moet** zo'n grens kruisen: bron en doel liggen in
 *     **verschillende** afbakeningen van dat type. BPMN: een message flow
 *     verbindt twee verschillende Pools, nooit twee elementen in dezelfde.
 *
 * De afbakening van een element is de dichtstbijzijnde voorouder van het
 * gevraagde type — via de lidmaatschaps-connectoren (taak → lane → pool) en,
 * voor een aangehecht rand-element, via zijn gastheer. Een element van het
 * type zelf is zijn eigen afbakening (black-box pool). Geen voorouder = `null`
 * = de impliciete deelnemer.
 *
 * Puur en store-loos: testbaar met kale objecten.
 */
import { containerVanElementen } from "./nesting.js";

/**
 * @param {Object} element
 * @param {Set<string>|string[]} grensTypeIds  elementtype-ids die als afbakening gelden
 * @param {Record<string, Object>} elements
 * @param {Map<string, string>} containerVan   lid-id → container-id
 * @returns {string|null} id van de afbakening, of null (impliciet)
 */
export function afbakeningVan(element, grensTypeIds, elements, containerVan) {
  const grens = grensTypeIds instanceof Set ? grensTypeIds : new Set(grensTypeIds);
  let cursor = element;
  for (let i = 0; i < 50 && cursor; i += 1) {
    if (grens.has(cursor.elementType)) return cursor.id ?? null;
    const ouderId = containerVan.get(cursor.id) || cursor.data?.randVan || null;
    cursor = ouderId ? elements[ouderId] : null;
  }
  return null;
}

/**
 * @typedef {Object} Weigering
 * @property {"kruist"|"overbrugt-niet"} reden
 * @property {Object} grensType  het ElementType van de afbakening
 */

/**
 * Toets één connectortype tegen de afbakeningen van het diagramtype.
 * @param {Object} diagramType
 * @param {Object} connectorType
 * @param {Object} bron
 * @param {Object} doel
 * @param {Record<string, Object>} elements
 * @param {Map<string, string>} [containerVan]  standaard afgeleid uit `elements`;
 *   geef hem mee om een nog-niet-bestaand element een container te geven
 * @returns {Weigering|null} null = toegestaan
 */
export function toetsAfbakening(diagramType, connectorType, bron, doel, elements, containerVan = null) {
  if (!connectorType || !bron || !doel || !elements) return null;
  const typen = diagramType?.elementTypes || [];
  const begrenzers = typen.filter((et) => (et.afbakeningVoor || []).includes(connectorType.id));
  const overbrugt = connectorType.overbrugt || [];
  if (!begrenzers.length && !overbrugt.length) return null;
  const elementTypesById = Object.fromEntries(typen.map((et) => [et.id, et]));
  const ouders = containerVan || containerVanElementen(elements, elementTypesById);

  for (const grensType of begrenzers) {
    const a = afbakeningVan(bron, [grensType.id], elements, ouders);
    const b = afbakeningVan(doel, [grensType.id], elements, ouders);
    if (a !== b) return { reden: "kruist", grensType };
  }
  for (const grensId of overbrugt) {
    const a = afbakeningVan(bron, [grensId], elements, ouders);
    const b = afbakeningVan(doel, [grensId], elements, ouders);
    if (a === b) return { reden: "overbrugt-niet", grensType: elementTypesById[grensId] || { id: grensId, label: grensId } };
  }
  return null;
}

/** Leesbare uitleg bij een weigering (voor het magic-link-menu). */
export function weigeringTekst(connectorType, weigering) {
  const lijn = connectorType?.label || connectorType?.id || "Deze verbinding";
  const grens = weigering?.grensType?.label || "de afbakening";
  if (weigering?.reden === "kruist") return `${lijn} mag de grens van een ${grens} niet kruisen`;
  if (weigering?.reden === "overbrugt-niet") return `${lijn} verbindt verschillende ${grens}s — deze twee liggen in dezelfde`;
  return `${lijn} mag hier niet`;
}
