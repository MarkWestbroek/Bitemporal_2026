// @ts-check
/**
 * host — wat de tekenaar aan zijn gastheer mag vragen (plan 2026-11-04 Eén tekenaar, stap 4:
 * "host-callback"). De tekenaar is puur en kent geen stores; een enkele vorm heeft toch iets
 * nodig dat alleen de gastheer weet, zoals de naam van een element in een ánder profiel
 * (object: `data.instantieVan` → "jan : Persoon"). De Studio registreert die functies één keer
 * bij het opstarten (studio/elementVerwijzing.jsx); de server en `node --test` registreren
 * niets en krijgen `null` — de vorm valt dan terug op wat in het element zelf staat
 * (`data.klassifierLabel`).
 *
 * Bewust klein: alleen lezen, alleen tekst. Geen stores of elementen naar buiten.
 */

/** @type {{verwijzingLabel: ((verwijzing: any) => string|null)|null}} */
const _host = { verwijzingLabel: null };

/**
 * Registreer (een deel van) de host-functies; latere registraties vullen aan of vervangen.
 * @param {Partial<typeof _host>} deel
 */
export function zetHost(deel) {
  Object.assign(_host, deel);
}

/** De host-functies (alleen-lezen gebruiken). */
export const host = () => _host;

/** Alleen voor tests. */
export function _resetHostVoorTests() {
  _host.verwijzingLabel = null;
}
