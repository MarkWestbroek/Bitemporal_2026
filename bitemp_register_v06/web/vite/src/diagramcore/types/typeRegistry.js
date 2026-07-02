// @ts-check
/**
 * typeRegistry — register voor DiagramType-descriptors (het Definitie-domein).
 *
 * Zelfde patroon als studio/activityRegistry.js: een module-singleton met
 * encapsulatie. Registratie valideert het type-contract (schema.js), zodat
 * een fout in een profiel direct bij het laden faalt en niet pas diep in de
 * canvas-code.
 *
 * Zie docs/STUDIO-05-diagramcore-plan.md §4.2 (descriptors) en §8.2
 * (compartimenten-maximum).
 */

/** @typedef {import("./schema.js").DiagramType} DiagramType */
/** @typedef {import("./schema.js").ElementType} ElementType */

/** Hard maximum uit het metamodel: Element ◆— 0..9 Compartment. */
export const MAX_COMPARTIMENTEN = 9;

/** @type {Map<string, DiagramType>} */
const _diagramTypes = new Map();

/**
 * Valideer één ElementType binnen een DiagramType.
 * @param {string} diagramTypeId
 * @param {ElementType} et
 * @returns {string[]} foutmeldingen (leeg = geldig)
 */
function valideerElementType(diagramTypeId, et) {
  const fouten = [];
  const ctx = `DiagramType "${diagramTypeId}", ElementType "${et?.id ?? "?"}"`;
  if (!et?.id) fouten.push(`${ctx}: id ontbreekt`);
  if (!et?.label) fouten.push(`${ctx}: label ontbreekt`);
  if (!et?.shape) fouten.push(`${ctx}: shape (ShapeType-id) ontbreekt`);
  if ((et?.compartments?.length ?? 0) > MAX_COMPARTIMENTEN) {
    fouten.push(
      `${ctx}: ${et.compartments.length} compartimenten — maximum is ${MAX_COMPARTIMENTEN} (metamodel 0..9)`
    );
  }
  if (et?.isConnector) {
    if (!et.bron?.elementTypes?.length) fouten.push(`${ctx}: connector zonder bron.elementTypes`);
    if (!et.doel?.elementTypes?.length) fouten.push(`${ctx}: connector zonder doel.elementTypes`);
  }
  return fouten;
}

/**
 * Valideer een DiagramType-descriptor.
 * @param {DiagramType} dt
 * @returns {string[]} foutmeldingen (leeg = geldig)
 */
export function valideerDiagramType(dt) {
  const fouten = [];
  if (!dt?.id) fouten.push("DiagramType: id ontbreekt");
  if (!dt?.label) fouten.push(`DiagramType "${dt?.id ?? "?"}": label ontbreekt`);
  if (!dt?.style) fouten.push(`DiagramType "${dt?.id ?? "?"}": style (StyleType-id) ontbreekt`);
  if (!Array.isArray(dt?.elementTypes) || dt.elementTypes.length === 0) {
    fouten.push(`DiagramType "${dt?.id ?? "?"}": elementTypes ontbreekt of is leeg`);
    return fouten;
  }
  const gezien = new Set();
  for (const et of dt.elementTypes) {
    fouten.push(...valideerElementType(dt.id, et));
    if (et?.id) {
      if (gezien.has(et.id)) fouten.push(`DiagramType "${dt.id}": dubbel ElementType-id "${et.id}"`);
      gezien.add(et.id);
    }
  }
  // Verbindingsregels moeten naar bestaande element-typen verwijzen
  for (const et of dt.elementTypes) {
    if (!et?.isConnector) continue;
    for (const kant of ["bron", "doel"]) {
      for (const doelId of et[kant]?.elementTypes ?? []) {
        if (!gezien.has(doelId)) {
          fouten.push(
            `DiagramType "${dt.id}", connector "${et.id}": ${kant} verwijst naar onbekend ElementType "${doelId}"`
          );
        }
      }
    }
  }
  return fouten;
}

/**
 * Registreer een DiagramType. Gooit bij een ongeldig contract, zodat een
 * profiel-fout bij het laden zichtbaar wordt.
 * @param {DiagramType} descriptor
 */
export function registreerDiagramType(descriptor) {
  const fouten = valideerDiagramType(descriptor);
  if (fouten.length > 0) {
    throw new Error(`Ongeldig DiagramType:\n- ${fouten.join("\n- ")}`);
  }
  if (_diagramTypes.has(descriptor.id)) {
    throw new Error(`DiagramType "${descriptor.id}" is al geregistreerd`);
  }
  _diagramTypes.set(descriptor.id, descriptor);
}

/**
 * @param {string} id
 * @returns {DiagramType|undefined}
 */
export function getDiagramType(id) {
  return _diagramTypes.get(id);
}

/** @returns {DiagramType[]} alle geregistreerde diagramtypen, in registratievolgorde */
export function alleDiagramTypes() {
  return [..._diagramTypes.values()];
}

/** Alleen voor tests: maak het register leeg. */
export function _resetVoorTests() {
  _diagramTypes.clear();
}
