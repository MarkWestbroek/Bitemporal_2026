// @ts-check
/**
 * beheerZichtRegels — de pure kant van beheerZicht.js (zonder React/AuthContext, dus testbaar
 * in node): welke profieltypen een gebruiker ziet, en de stand die de zijbalk bijhoudt.
 */
let _beheerZicht = false;
/** @param {boolean} aan */
export function zetBeheerZicht(aan) {
  _beheerZicht = !!aan;
}
export function heeftBeheerZicht() {
  return _beheerZicht;
}

/**
 * De profieltypen die deze gebruiker in boom, startpagina en "Nieuw diagram" ziet.
 * @template {{klassiek?: boolean}} P
 * @param {P[]} profielen
 * @param {boolean} [beheer]
 * @returns {P[]}
 */
export function zichtbareProfielen(profielen, beheer = _beheerZicht) {
  return beheer ? profielen : profielen.filter((p) => !p.klassiek);
}
