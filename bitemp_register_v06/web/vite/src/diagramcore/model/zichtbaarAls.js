// @ts-check
/**
 * zichtbaarAls — voorwaardelijk tonen van een eigenschap (M3 PropertyType.zichtbaarAls,
 * 2026-10-27, Mark). Een eigenschap die alleen betekenis heeft als een andere aan staat
 * (canoniek: tijdprecisie pas bij materieel) verbergt de inspector tot die voorwaarde geldt.
 *
 * Vorm: `{key}` (die eigenschap is waar/gevuld) of `{key, waarde}` (gelijk aan die waarde;
 * een lijst = één ervan). Alleen weergave: de waarde blijft in de data staan, en een
 * verborgen eigenschap die tóch gevuld is, blijft zichtbaar — dan zie je wat er staat
 * (bv. na een import) en kun je het wissen.
 */

/**
 * @param {{key?: string, zichtbaarAls?: {key: string, waarde?: any}}} regel
 * @param {Record<string, any>|undefined} data - element.data (of veld-data)
 */
export function isZichtbaar(regel, data = {}) {
  const voorwaarde = regel?.zichtbaarAls;
  if (!voorwaarde?.key) return true;
  const d = data || {};
  const eigen = regel.key ? d[regel.key] : undefined;
  if (eigen !== undefined && eigen !== null && eigen !== "" && eigen !== false) return true;
  const w = d[voorwaarde.key];
  if (!("waarde" in voorwaarde)) return !!w;
  return Array.isArray(voorwaarde.waarde) ? voorwaarde.waarde.includes(w) : w === voorwaarde.waarde;
}
