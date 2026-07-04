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
/**
 * Alle verbindingsregels van een connector-ElementType, in de volledige
 * vorm [{bron: string[], doel: string[]}]. Ondersteunt zowel
 * `verbindingsregels` (1..*) als de verkorte `bron`/`doel`-vorm.
 */
export function verbindingsregelsVan(et) {
  if (Array.isArray(et?.verbindingsregels) && et.verbindingsregels.length) {
    return et.verbindingsregels.map((r) => ({
      bron: r?.bron?.elementTypes || r?.bron || [],
      doel: r?.doel?.elementTypes || r?.doel || [],
    }));
  }
  if (et?.bron || et?.doel) {
    return [{ bron: et.bron?.elementTypes || [], doel: et.doel?.elementTypes || [] }];
  }
  return [];
}

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
    // Volledige vorm (verbindingsregels 1..*) of verkorte vorm (bron/doel);
    // de regel-inhoud zelf wordt op DiagramType-niveau gevalideerd.
    const regels = verbindingsregelsVan(et);
    if (!regels.length) {
      fouten.push(`${ctx}: connector zonder verbindingsregels (of bron/doel)`);
    }
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
  // Verbindingsregels: 1..* per connector, en verwijzingen moeten bestaan.
  for (const et of dt.elementTypes) {
    if (!et?.isConnector) continue;
    const regels = verbindingsregelsVan(et);
    if (!regels.length || regels.some((r) => !r.bron.length || !r.doel.length)) {
      fouten.push(
        `DiagramType "${dt.id}", connector "${et.id}": minimaal één verbindingsregel met bron én doel vereist`
      );
    }
    for (const [ri, regel] of regels.entries()) {
      for (const kant of ["bron", "doel"]) {
        for (const doelId of regel[kant]) {
          if (!gezien.has(doelId)) {
            fouten.push(
              `DiagramType "${dt.id}", connector "${et.id}", regel ${ri + 1}: ${kant} verwijst naar onbekend ElementType "${doelId}"`
            );
          }
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
 * Registreer of vervang een DiagramType (zelfde validatie). Voor de
 * meta-editor (plan §8.9): een bewerkt profiel opnieuw registreren zonder
 * pagina-herlaad.
 * @param {DiagramType} descriptor
 */
export function vervangDiagramType(descriptor) {
  const fouten = valideerDiagramType(descriptor);
  if (fouten.length > 0) {
    throw new Error(`Ongeldig DiagramType:\n- ${fouten.join("\n- ")}`);
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
