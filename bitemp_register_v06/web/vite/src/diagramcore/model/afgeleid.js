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

/** UML-zichtbaarheid → teken (UML 2.5.1 §7.4). EA schrijft Public/Private/…. */
const ZICHTBAARHEID_TEKEN = { public: "+", private: "-", protected: "#", package: "~" };
/** Booleaanse betekenis → UML-eigenschapsstring, in vaste volgorde. */
const EIGENSCHAPPEN = [
  ["geordend", "ordered"],
  ["nietUniek", "nonunique"],
  ["alleenLezen", "readOnly"],
  ["id", "id"],
];

/**
 * De UML-aanvulling van een veld (attribuut, rol): wat er naast naam en type
 * getoond wordt, volgens de `betekenis` van de properties van het veldtype.
 * Zonder betekenis-properties: allemaal leeg — bestaande profielen ongewijzigd.
 *
 * @param {Record<string, any>|null|undefined} data
 * @param {{properties?: Array<{key?: string, betekenis?: string}>}|null|undefined} type
 * @returns {{zichtbaarheid: string, kardinaliteit: string, standaardwaarde: string, eigenschappen: string[]}}
 */
export function veldAanvulling(data, type) {
  const uit = { zichtbaarheid: "", kardinaliteit: "", standaardwaarde: "", eigenschappen: [] };
  if (!data) return uit;
  const waardeVan = (betekenis) => {
    const p = (type?.properties || []).find((x) => x?.betekenis === betekenis && x.key);
    return p ? data[p.key] : undefined;
  };
  const z = waardeVan("zichtbaarheid");
  if (z) uit.zichtbaarheid = ZICHTBAARHEID_TEKEN[String(z).toLowerCase()] || "";
  const k = waardeVan("kardinaliteit");
  if (k !== undefined && k !== null && String(k).trim()) uit.kardinaliteit = String(k).trim();
  const s = waardeVan("standaardwaarde");
  if (s !== undefined && s !== null && String(s).trim()) uit.standaardwaarde = String(s).trim();
  for (const [betekenis, tekst] of EIGENSCHAPPEN) if (waardeVan(betekenis) === true) uit.eigenschappen.push(tekst);
  return uit;
}
