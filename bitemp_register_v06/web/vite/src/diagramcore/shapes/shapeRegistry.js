// @ts-check
/**
 * shapeRegistry — koppelt shape-id's aan React-componenten.
 *
 * Elke component is een ShapeRenderer (Implementatie-domein uit het metamodel, plan
 * §2): een ElementType (Definitie) verwijst met `shape` naar een ShapeType (Stijl) en
 * dit is er een realisatie van. Shapes zijn puur vorm; alles met betekenis hoort in
 * het ElementType.
 *
 * Overgangsroute (2026-11-04, "één tekenaar"): nieuwe vormen krijgen een pure renderer
 * die een VormBoom geeft (types/shapeType.js, `tekenbareVorm`). Zolang een id die niet
 * heeft, tekent de component hier.
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
