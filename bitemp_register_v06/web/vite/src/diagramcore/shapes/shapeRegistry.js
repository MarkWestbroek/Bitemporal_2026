// @ts-check
/**
 * shapeRegistry — koppelt ShapeType-id's aan React-componenten.
 *
 * Dit is het Implementatie-domein uit het metamodel (plan §2): een ElementType
 * (Definitie) verwijst met `shape` naar een id hier. Shapes zijn puur vorm;
 * alles met betekenis hoort in het ElementType.
 *
 * Een shape-component ontvangt:
 *   { element, elementType, selected, children }
 * waarbij `children` de React Flow-handles zijn (aangeleverd door ElementNode,
 * zodat elke shape dezelfde aansluitpunten heeft).
 */

const _shapes = new Map();

/**
 * @param {string} id
 * @param {Function} Component - React-component
 */
export function registreerShape(id, Component) {
  _shapes.set(id, Component);
}

/**
 * @param {string} id
 * @returns {Function|undefined}
 */
export function getShape(id) {
  return _shapes.get(id);
}

/** @returns {string[]} */
export function alleShapeIds() {
  return [..._shapes.keys()];
}
