/**
 * toegangsspraak — klare-taal beleidstaal voor het Register Toegangsbeleid.
 *
 * Gecontroleerde natuurlijke taal (CNL) met 1-op-1 afbeelding op de
 * NLGov-ODRL-subset. Ontwerp: docs/plans/"2026-07-22 Klare-taal
 * Toegangsbeleid — Toegangsspraak (ontwerp).md".
 *
 *   parseBeleid(tekst)  → { ok, beleid, fouten }
 *   renderBeleid(beleid)→ canonieke klare-taaltekst (van-vorm)
 *   toegangsspraakNaarOdrl(beleid) → ODRL volgens ODRL-AP-NL, als Turtle en als JSON-LD
 *   odrlNaarToegangsspraak(turtle) → beleid in klare taal uit ODRL (Turtle)
 *   compileerBundel(beleid, { index }) → uitvoerbare beleidsbundel voor de PDP (Go)
 */
export { parseBeleid, valideerBeleid, padNaarVerwijzing, verwijzingNaarPad, verwijzingNaarGroepPad, ParseFout, ANKERS } from "./parser.js";
export { renderBeleid, renderVerwijzing, renderVoorwaarde } from "./renderer.js";
export { toegangsspraakNaarOdrl } from "./odrlExport.js";
export { odrlNaarToegangsspraak, importMeldingen } from "./odrlImport.js";
export { compileerBundel, BUNDEL_FORMAAT } from "./bundel.js";
export {
  maakVeldIndex, resolveerBeleid, resolveerVerwijzing, resolveerGroep, isGroepPad,
  bepaalWaardetype, suggereerVanVormen, suggereerBases,
} from "./metamodel.js";
export { bepaalSuggesties } from "./editorSuggesties.js";
export {
  registreerOperatoren, resetOperatoren, geefOperatoren, GEO_OPERATOREN,
  registreerActies, geefActies, registreerPlichten, geefPlichten,
} from "./operatoren.js";
export { VOORBEELD_BELEID } from "./voorbeeld.js";
