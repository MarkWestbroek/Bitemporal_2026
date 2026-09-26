/**
 * schemaValidatie.js — een kleine JSON Schema-validator voor vormConfig (de subset die
 * configSchemas.js gebruikt): type, enum, const, required, properties, additionalProperties,
 * items, anyOf, minItems, minLength, minimum/maximum, exclusiveMinimum, pattern.
 * Geen afhankelijkheid (ajv is 120 kB en draait ook in de publieke bundel); puur en getest.
 *
 * @returns {string[]} leesbare fouten met een pad, bv. "areas[2].shape: moet een van rect, circle, poly, ellipse zijn"
 */
const typeVan = (w) => (Array.isArray(w) ? "array" : w === null ? "null" : Number.isInteger(w) ? "integer" : typeof w);
const past = (w, t) => t === typeVan(w) || (t === "number" && typeof w === "number") || (t === "integer" && Number.isInteger(w));

export function valideerSchema(waarde, schema, pad = "") {
  if (!schema || waarde === undefined) return [];
  const p = pad || "(config)";
  const fouten = [];

  if (schema.anyOf) {
    if (!schema.anyOf.some((s) => valideerSchema(waarde, s, pad).length === 0)) fouten.push(`${p}: heeft niet de verwachte vorm`);
    return fouten;
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => past(waarde, t))) return [`${p}: moet ${types.join(" of ")} zijn`];
  }
  if (schema.enum && !schema.enum.includes(waarde)) fouten.push(`${p}: moet een van ${schema.enum.join(", ")} zijn`);
  if ("const" in schema && waarde !== schema.const) fouten.push(`${p}: moet ${schema.const} zijn`);

  if (typeof waarde === "string") {
    if (schema.minLength != null && waarde.length < schema.minLength) fouten.push(`${p}: mag niet leeg zijn`);
    if (schema.pattern && !new RegExp(schema.pattern).test(waarde)) fouten.push(`${p}: ongeldige waarde "${waarde}"`);
  }
  if (typeof waarde === "number") {
    if (schema.minimum != null && waarde < schema.minimum) fouten.push(`${p}: minimaal ${schema.minimum}`);
    if (schema.maximum != null && waarde > schema.maximum) fouten.push(`${p}: maximaal ${schema.maximum}`);
    if (schema.exclusiveMinimum != null && waarde <= schema.exclusiveMinimum) fouten.push(`${p}: moet groter zijn dan ${schema.exclusiveMinimum}`);
  }
  if (Array.isArray(waarde)) {
    if (schema.minItems != null && waarde.length < schema.minItems) fouten.push(`${p}: minimaal ${schema.minItems} element(en)`);
    if (schema.items) waarde.forEach((w, i) => fouten.push(...valideerSchema(w, schema.items, `${pad}[${i}]`)));
  }
  if (waarde && typeof waarde === "object" && !Array.isArray(waarde)) {
    for (const k of schema.required || []) if (waarde[k] === undefined || waarde[k] === null || waarde[k] === "") fouten.push(`${pad ? pad + "." : ""}${k}: ontbreekt`);
    const props = schema.properties || {};
    for (const [k, w] of Object.entries(waarde)) {
      const sub = props[k] || (typeof schema.additionalProperties === "object" ? schema.additionalProperties : null);
      if (sub) fouten.push(...valideerSchema(w, sub, pad ? `${pad}.${k}` : k));
    }
  }
  return fouten;
}
