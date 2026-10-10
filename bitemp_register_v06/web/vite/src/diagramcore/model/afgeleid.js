// @ts-check
/**
 * afgeleid — is een veld of element (bv. een relatie) **afgeleid**, dus berekend
 * in plaats van vastgelegd? De UML-notatie zet er een "/" voor (UML 2.5.1
 * §9.5.4 Property, §11.5.4 Association), voor attributen én relaties.
 *
 * Profielen noemen die eigenschap verschillend: puur-uml, canoniek en SysML
 * `afgeleid`, MIM `indicatieAfleidbaar`. Daarom wijst een profiel declaratief
 * aan welke van zijn eigenschappen "afgeleid" betekent (M3:
 * `PropertyType.betekenis: "afgeleid"`); de motor kent de namen niet.
 * Daarnaast blijven de oude vormen werken:
 *   - `data.afgeleid === true` (de bestaande conventie op velden);
 *   - `FieldType.afgeleid` / `ElementType.afgeleid` (elk voorkomen van het type
 *     is afgeleid, bv. canoniek `afgeleidVeld`).
 *
 * Puur en store-loos.
 */

/**
 * @param {Record<string, any>|null|undefined} data - `element.data` of `veld.data`
 * @param {{afgeleid?: boolean, properties?: Array<{key?: string, betekenis?: string}>}|null|undefined} [type]
 *   - het FieldType of ElementType (voor `afgeleid` en de property-betekenis)
 * @returns {boolean}
 */
export function isAfgeleid(data, type = null) {
  if (type?.afgeleid) return true;
  if (!data) return false;
  if (data.afgeleid === true) return true;
  for (const p of type?.properties || []) {
    if (p?.betekenis === "afgeleid" && p.key && data[p.key] === true) return true;
  }
  return false;
}
