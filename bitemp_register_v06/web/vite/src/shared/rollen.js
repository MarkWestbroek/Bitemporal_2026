// @ts-check
/**
 * rollen — rangorde van de rollen, gelijk aan middleware/rollen.go (één bron in de Go-API;
 * dit is de spiegel voor de UI). Plan 2026-10-12 Gebruikers uitnodigen §5, besluit Mark 13-10.
 *
 *   1 lezer      (= viewer)  bekijken, documenten genereren
 *   2 modelleur              modellen bewerken in projecten waar je schrijfrecht hebt
 *   3 ontwerper              + formulierdefinities, documentsjablonen, huisstijl
 *   4 bouwer     (= editor)  + codegen, schema publiceren, EA-import
 *   5 beheerder  (= admin)   + gebruikers, rollen, beleid
 *
 * De oude namen blijven geldig (bestaande accounts); toekennen gebeurt met de nieuwe.
 */

/** @type {Record<string, number>} */
export const ROL_NIVEAUS = {
  lezer: 1, viewer: 1,
  modelleur: 2,
  ontwerper: 3,
  bouwer: 4, editor: 4,
  beheerder: 5, admin: 5,
};

/** Rollen die je nu toekent (keuzelijst; later een referentielijst via de PIP). */
export const TOEKENBARE_ROLLEN = ["lezer", "modelleur", "ontwerper", "bouwer", "beheerder"];

/** Korte uitleg per rol, voor keuzelijsten en hulptekst. */
export const ROL_UITLEG = {
  lezer: "bekijkt projecten en genereert documenten",
  modelleur: "bewerkt modellen in projecten met schrijfrecht",
  ontwerper: "als modelleur, plus formulieren, documentsjablonen en huisstijl",
  bouwer: "als ontwerper, plus codegen, schema publiceren en EA-import",
  beheerder: "alles, ook gebruikers uitnodigen en rechten geven",
};

/** Niveau van een rol (0 = onbekend of leeg). */
export const rolNiveau = (rol) => ROL_NIVEAUS[String(rol || "")] || 0;

/** Heeft `huidig` minstens het niveau van `vereist`? Onbekende vereiste rol = nee. */
export function rolToegestaan(huidig, vereist) {
  const v = rolNiveau(vereist);
  return v > 0 && rolNiveau(huidig) >= v;
}

export const isBeheerder = (rol) => rolNiveau(rol) >= 5;
