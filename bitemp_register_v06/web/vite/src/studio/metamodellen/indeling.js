// @ts-check
/**
 * indeling — wat een eigenschap van een metaklasse ís, in UML-termen: één regel voor alle
 * projecties van een metamodel als gegevens (het M3 uit types/m3.js, het projectmetamodel).
 *
 * Gebruikt door:
 *   - metamodelWerkbestand.js: het metamodel als puur-uml-model (attribuut, associatie, compositie,
 *     operatie);
 *   - de ontwerptaal van het Profiel-ontwerp (studio/activities/profielOntwerp.js, OMNIUM-UI): het M3
 *     als taal waarin een profiel (M2) een model is — een attribuut wordt een property, een
 *     associatie een verbinding, een samenstelling een bevat-relatie.
 * Zo kunnen die twee niet uit elkaar lopen.
 *
 * De regel (Mark 15-11: "een attribuut met een klasse kan gewoon een associatie zijn, in UML"):
 *   - code (`operatie`)                                   → "operatie"
 *   - eigenaar én type zijn een klasse, `samenstelling`   → "samenstelling" (compositie, ◆)
 *   - eigenaar én type zijn een klasse                    → "associatie"
 *   - anders (primitief, enumeratie, datatype; ook een eigenschap van een datatype) → "attribuut"
 * Een datatype heeft geen identiteit, dus geen associaties: ook een eigenschap met een klasse als
 * type blijft daar een attribuut. Andersom: een eigenschap met een datatype als type is een
 * attribuut, ook met `samenstelling` (een waarde is altijd van zijn eigenaar; bv.
 * ElementType.bron : ConnectorEindpunt, Diagram.lijnen : Lijn). De ontwerptaal kan zo'n
 * attribuut als geneste waarde tonen; `typeSoortVan(model, e.type) === "datatype"` zegt het.
 */

/**
 * @typedef {Object} MetaEigenschap
 * @property {string} naam
 * @property {string} type
 * @property {string} kard
 * @property {boolean} [operatie]
 * @property {boolean} [optioneel]
 * @property {string} [params]
 * @property {string} [sleutel]
 * @property {boolean} [samenstelling]
 * @property {string} [uitleg]
 * @property {string} [standaard] - vaste of standaardwaarde (UML `= waarde`)
 */
/**
 * @typedef {Object} MetaKlasse
 * @property {string} naam
 * @property {string} pakket
 * @property {"klasse"|"datatype"} soort
 * @property {string} [uitleg]
 * @property {MetaEigenschap[]} eigenschappen
 */
/**
 * @typedef {Object} MetaEnumeratie
 * @property {string} naam
 * @property {string} pakket
 * @property {string[]} waarden
 * @property {Record<string, string>} [uitlegPerWaarde]
 * @property {string} [uitleg]
 */
/**
 * @typedef {Object} Metamodel
 * @property {string} id           - project-id
 * @property {string} naam         - projectnaam, ook de naam van de hoofdmap
 * @property {string} [uitleg]
 * @property {{naam: string, uitleg?: string}[]} pakketten
 * @property {MetaKlasse[]} klassen
 * @property {MetaEnumeratie[]} enumeraties
 */
/** @typedef {{klassen: MetaKlasse[], enumeraties: MetaEnumeratie[]}} MetaTypen */
/** @typedef {"operatie"|"samenstelling"|"associatie"|"attribuut"} Indeling */
/** @typedef {"primitief"|"enumeratie"|"datatype"|"klasse"} TypeSoort */

/** @type {WeakMap<object, {klassen: Map<string, MetaKlasse>, enums: Map<string, MetaEnumeratie>}>} */
const INDEXEN = new WeakMap();
function index(/** @type {MetaTypen} */ model) {
  let i = INDEXEN.get(model);
  if (!i) {
    i = { klassen: new Map(model.klassen.map((k) => [k.naam, k])), enums: new Map(model.enumeraties.map((e) => [e.naam, e])) };
    INDEXEN.set(model, i);
  }
  return i;
}

/**
 * Wat voor type een typenaam is. Een naam die geen metaklasse of enumeratie is, is primitief
 * (string, boolean, number, any, functie — de controletests eisen dat elk type bestaat).
 * @param {MetaTypen} model
 * @param {string} type
 * @returns {TypeSoort}
 */
export function typeSoortVan(model, type) {
  const { klassen, enums } = index(model);
  const k = klassen.get(type);
  if (k) return k.soort === "klasse" ? "klasse" : "datatype";
  return enums.has(type) ? "enumeratie" : "primitief";
}

/**
 * De indeling van een eigenschap van een metaklasse (zie de regel bovenaan).
 * @param {MetaTypen} model
 * @param {MetaKlasse} klasse - de eigenaar
 * @param {MetaEigenschap} eigenschap
 * @returns {Indeling}
 */
export function indelingVan(model, klasse, eigenschap) {
  if (eigenschap.operatie) return "operatie";
  if (klasse.soort === "klasse" && typeSoortVan(model, eigenschap.type) === "klasse") {
    return eigenschap.samenstelling ? "samenstelling" : "associatie";
  }
  return "attribuut";
}
