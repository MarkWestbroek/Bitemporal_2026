// @ts-check
/**
 * umlEigenschappen — gedeelde PropertyTypes voor UML-achtige eigenschappen van
 * attributen en relaties (UML 2.5.1: §7.5 MultiplicityElement, §9.5 Property,
 * §11.5 Association), voor puur-uml, canoniek, MIM en SysML. Puur data: de
 * profielen nemen ze op in hun eigen `properties`, zodat de sleutels in alle
 * profielen hetzelfde heten.
 *
 * `betekenis: "afgeleid"` (M3, diagramcore/model/afgeleid.js) laat de motor de
 * UML-"/" tekenen, ook als een profiel de eigenschap anders noemt (MIM:
 * `indicatieAfleidbaar`).
 */

/** UML isDerived op een attribuut of relatie: berekend, niet vastgelegd. */
export const AFGELEID = { key: "afgeleid", label: "afgeleid (/)", datatype: "boolean", betekenis: "afgeleid" };

/**
 * De regel waarmee een afgeleide relatie/attribuut berekend wordt. Vrije tekst
 * (OCL, pseudocode); canoniek gebruikt zijn eigen CEL-variant.
 */
export const AFLEIDINGSREGEL = { key: "afleidingsregel", label: "afleidingsregel", datatype: "tekst", placeholder: "bijv. ouder.ouder" };

/** MIM 1.2: indicatie afleidbaar — telt voor de motor als afgeleid. */
export const MIM_AFLEIDBAAR = { key: "indicatieAfleidbaar", label: "afleidbaar", datatype: "boolean", betekenis: "afgeleid" };
