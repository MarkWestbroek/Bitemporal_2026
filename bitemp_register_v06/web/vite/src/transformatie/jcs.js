// @ts-check
/**
 * jcs — JSON Canonicalization Scheme (RFC 8785).
 *
 * De afgesproken hashregel voor artefacten (docs/TRANSFORMATIES.md §11):
 * `payloadHash` en `bronmodel.hash` zijn sha256 over JCS(payload). Zo geeft
 * dezelfde inhoud in JavaScript, Go en Python hetzelfde getal, ongeacht
 * sleutelvolgorde, witruimte of string-escaping.
 *
 * JCS is gedefinieerd op de serialisatie van ECMAScript: strings en getallen
 * zoals `JSON.stringify` ze schrijft, sleutels gesorteerd op UTF-16-code-units
 * (de standaardsortering van JavaScript), geen witruimte. Puur.
 */

/**
 * @param {unknown} waarde
 * @returns {string}
 */
export function jcs(waarde) {
  if (waarde === null || typeof waarde === "boolean" || typeof waarde === "string") return JSON.stringify(waarde);
  if (typeof waarde === "number") {
    if (!Number.isFinite(waarde)) throw new Error(`JCS: geen geldig JSON-getal: ${waarde}`);
    return JSON.stringify(waarde);
  }
  if (Array.isArray(waarde)) return `[${waarde.map((item) => jcs(item === undefined ? null : item)).join(",")}]`;
  if (typeof waarde === "object") {
    const delen = Object.keys(waarde)
      .filter((sleutel) => waarde[sleutel] !== undefined)
      .sort()
      .map((sleutel) => `${JSON.stringify(sleutel)}:${jcs(waarde[sleutel])}`);
    return `{${delen.join(",")}}`;
  }
  throw new Error(`JCS: niet te serialiseren waarde van type ${typeof waarde}`);
}

/**
 * sha256-hex over JCS(waarde). De hashfunctie wordt meegegeven (node:crypto in
 * een runner, SubtleCrypto in de browser), zodat deze module puur blijft.
 *
 * @param {unknown} waarde
 * @param {(tekst: string) => string | Promise<string>} sha256Hex
 */
export function jcsHash(waarde, sha256Hex) {
  return sha256Hex(jcs(waarde));
}
