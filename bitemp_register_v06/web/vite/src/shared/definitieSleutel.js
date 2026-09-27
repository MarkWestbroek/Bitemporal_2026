/**
 * definitieSleutel.js — een FormulierDefinitie of WeergaveDefinitie aanwijzen met id óf code.
 *
 * `code` (Meta-GE, optioneel, bv. "nieuwe-organisatie") is een leesbare, stabiele sleutel:
 * anders dan het id is hij op elke instantie (lokaal, pf, …) gelijk, dus bruikbaar in
 * `veld.nieuwFormulier`, `?formulier=`, `?weergave=` en OPENBARE_FORMULIEREN. Een getal
 * is altijd een id; al het andere een code. Codes zijn dus nooit alleen cijfers.
 *
 * Een definitie is hier `{ id, meta }` (zoals useFormulierDefinities) of `{ id, code }`
 * (zoals de alternatieven van useWeergaveDefinitie).
 */

/** De code van een definitie (getrimd), of "". */
export function codeVan(def) {
  const c = def?.code ?? def?.meta?.code;
  return c == null ? "" : String(c).trim();
}

/** Past `sleutel` (id of code) bij deze definitie? */
export function pastBijSleutel(def, sleutel) {
  if (!def || sleutel == null) return false;
  const s = String(sleutel).trim();
  if (!s) return false;
  if (/^\d+$/.test(s)) return String(def.id) === s;
  return codeVan(def) === s;
}

/** De definitie die bij `sleutel` hoort, of null. */
export function vindDefinitie(definities, sleutel) {
  return (definities || []).find((d) => pastBijSleutel(d, sleutel)) || null;
}

/** De sleutel om in een URL of layout te zetten: de code als die er is, anders het id. */
export function sleutelVan(def) {
  return codeVan(def) || (def?.id != null ? String(def.id) : "");
}

/** Is dit een geldige code? Kleine letters, cijfers en koppeltekens; niet alleen cijfers. */
export function isGeldigeCode(code) {
  const c = String(code ?? "").trim();
  return c === "" || (/^[a-z0-9][a-z0-9-]*$/.test(c) && !/^\d+$/.test(c));
}
