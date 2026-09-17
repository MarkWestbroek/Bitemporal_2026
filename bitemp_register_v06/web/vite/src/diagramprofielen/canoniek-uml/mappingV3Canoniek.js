// @ts-check
/**
 * mappingV3Canoniek — het velden-deel van de mapping tussen de oude datavorm
 * (IDE-store / V3) en het canonieke profiel in de sandbox: welke
 * profiel-properties 1-op-1 meegaan, met dezelfde sleutel aan beide kanten
 * (`element.data[key]` ↔ `data[key]`). Geen hernoem-tabel: de sleutels zijn
 * gelijk. De structuur-mapping (compartimenten, connectoren, diagrammen) en de
 * paar velden die wél anders heten staan in adapter.js.
 *
 * Het profiel (index.js) is de waarheid over wélke eigenschappen een element
 * heeft. De heenreis, de terugreis (adapter.js) en de migratie (migratie.js)
 * lezen de veldnamen daarom uit de `properties` van het elementtype; een
 * property erbij in het profiel gaat vanzelf mee naar model en V3.
 *
 * Twee bewuste uitzonderingen, allebei adapter-kennis:
 *
 *  - EIGEN_VERTALING: basis-eigenschappen die de adapter voor élk type al
 *    vertaalt, met een andere vorm in het oude model (`materieel` ↔
 *    `isMaterieel`, `domein` staat naast `data`, `kleur` met terugval).
 *  - GENERIEKE_TYPES: de elementtypen waarvoor deze 1-op-1-route aan staat.
 *    Andere typen (gegevenstype, enumeratie, …) hebben properties die in de
 *    oude vorm anders gestructureerd zijn en houden hun eigen vertaling.
 *
 * Aanroepers geven het elementtype mee (geen import van index.js hier), zodat
 * er geen importkring ontstaat: index.js → migratie.js → mappingV3Canoniek.js.
 */

/** Properties met een eigen vertaling in de adapter (niet 1-op-1 in data). */
export const EIGEN_VERTALING = new Set(["kleur", "materieel", "domein"]);

/** Elementtypen waarvan de properties 1-op-1 tussen sandbox en oude vorm gaan. */
export const GENERIEKE_TYPES = new Set(["entiteit", "gegevenselement", "relatie", "compositie"]);

/**
 * @param {{id: string, properties?: Array<{key: string}>}|undefined|null} elementType
 * @returns {string[]} data-sleutels die 1-op-1 meegaan (leeg als het type niet meedoet)
 */
export function vertaalbareVelden(elementType) {
  if (!elementType || !GENERIEKE_TYPES.has(elementType.id)) return [];
  return (elementType.properties || [])
    .map((p) => p.key)
    .filter((k) => k && !EIGEN_VERTALING.has(k));
}

/**
 * @param {Array<{id: string, properties?: Array<{key: string}>}>} elementTypes
 * @returns {Record<string, string[]>} elementtype-id → vertaalbare velden
 */
export function vertaalbareVeldenPerType(elementTypes) {
  const resultaat = {};
  for (const et of elementTypes || []) {
    const velden = vertaalbareVelden(et);
    if (velden.length) resultaat[et.id] = velden;
  }
  return resultaat;
}
