/**
 * toegangsspraak — klare-taal beleidstaal voor het Register Toegangsbeleid.
 *
 * Gecontroleerde natuurlijke taal (CNL) met 1-op-1 afbeelding op de
 * NLGov-ODRL-subset. Ontwerp: docs/plans/"2026-07-22 Klare-taal
 * Toegangsbeleid — Toegangsspraak (ontwerp).md".
 *
 *   parseBeleid(tekst)  → { ok, beleid, fouten }
 *   renderBeleid(beleid)→ canonieke klare-taaltekst (van-vorm)
 *   naarOdrl(beleid)    → ODRL JSON-LD (NLGov-profiel)
 */
export { parseBeleid, valideerBeleid, padNaarVerwijzing, verwijzingNaarPad, verwijzingNaarGroepPad, ParseFout, ANKERS } from "./parser.js";
export { renderBeleid, renderVerwijzing, renderVoorwaarde } from "./renderer.js";
export { naarOdrl } from "./odrl.js";
export {
  maakVeldIndex, resolveerBeleid, resolveerVerwijzing, resolveerGroep,
  bepaalWaardetype, suggereerVanVormen, suggereerBases,
} from "./metamodel.js";
export { bepaalSuggesties } from "./editorSuggesties.js";
export {
  registreerOperatoren, resetOperatoren, geefOperatoren, GEO_OPERATOREN,
  registreerActies, geefActies, registreerPlichten, geefPlichten,
} from "./operatoren.js";
export { VOORBEELD_BELEID } from "./voorbeeld.js";
