// @ts-check
/**
 * projectGebruik — welk profielen- (M2) en weergaveproject een project gebruikt (plan
 * docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het project, §2 en §7 stap 4).
 *
 * Vier soorten project in volgorde van afhankelijkheid: M1 → weergaven → M2 + transformaties → M3.
 * De kop van een project zegt nu:
 *
 *   - `soort`: "model" (het gewone project; ontbreekt = model), "profielen" (het sidecar-project:
 *     M2 + transformaties) of "weergaven";
 *   - `versie`: alleen bij profielen en weergaven. Besluit Mark 22-11 (keuze A): de versie gaat
 *     alleen omhoog bij **uitbrengen** (de beheerder); wat daartussen gewijzigd is, is een concept
 *     ("0.3.0 + concept"). Een project dat de tool uit de code maakt, krijgt de versie van de Studio:
 *     release en deze projecten gaan samen (Mark 21-11).
 *   - `gebruikt`: wat er geladen was toen het project werd bewaard — `{profielen, weergaven}`, elk
 *     `{bron: "code", versie}` of `{bron: "project", id, naam, versie, concept}`. Een model noemt
 *     beide; een weergaveproject noemt de profielen (de koppeling noemt elementtype-id's); een
 *     profielenproject noemt niets (het M3 is nog code).
 *
 * Bij het openen vergelijkt de Studio `gebruikt` met wat er nu geladen is; bij een verschil een
 * **waarschuwing**, geen fout (`gebruiktMelding`).
 *
 * Wat er geladen is, houdt deze module bij: standaard de code; *Laad de weergaven uit dit project in
 * de tool* en *Laad de profielen uit dit project in de tool* zetten het project (`zetGeladen`).
 *
 * Puur, op de toestand `_geladen` na.
 */

export const SOORT_MODEL = "model";
export const SOORT_PROFIELEN = "profielen";
export const SOORT_WEERGAVEN = "weergaven";
const LABEL = { [SOORT_PROFIELEN]: "profielen", [SOORT_WEERGAVEN]: "weergaven" };

/** Welke soorten een project van deze soort gebruikt. */
export function afhankelijkVan(soort) {
  if (soort === SOORT_PROFIELEN) return [];
  if (soort === SOORT_WEERGAVEN) return [SOORT_PROFIELEN];
  return [SOORT_PROFIELEN, SOORT_WEERGAVEN];
}

/** De soort van een project (de kop of de werkbestand-data); ontbreekt = model. */
export const soortVan = (project) => (project?.soort === SOORT_PROFIELEN || project?.soort === SOORT_WEERGAVEN ? project.soort : SOORT_MODEL);

let _toolVersie = "dev";
/** @type {Record<string, any>} */
let _geladen = {};

/** De versie van de Studio (voor "uit de code"). */
export function zetToolVersie(versie) {
  _toolVersie = versie || "dev";
}
export const toolVersie = () => _toolVersie;

/** Wat er nu geladen is voor een soort (standaard: de code). */
export const geladen = (soort) => _geladen[soort] || { bron: "code", versie: _toolVersie };

/**
 * Een project is in de tool geladen.
 * @param {string} soort - SOORT_PROFIELEN | SOORT_WEERGAVEN
 * @param {{id: string, naam?: string, versie?: string, concept?: boolean}} project
 */
export function zetGeladen(soort, { id, naam, versie, concept = true }) {
  _geladen[soort] = { bron: "project", id, ...(naam ? { naam } : {}), versie: versie || "0.0.0", concept: !!concept };
}

/** Terug naar de code (bv. na een herlaad, of in tests). */
export function wisGeladen() {
  _geladen = {};
}

/** Wat een project van deze soort bij het bewaren noteert. */
export function noteerGebruikt(soort) {
  return Object.fromEntries(afhankelijkVan(soort).map((s) => [s, { ...geladen(s) }]));
}

/** Leesbaar: "0.3.0 + concept uit project X" of "uit de code (Studio 0.47.0)". */
export function beschrijf(g) {
  if (!g) return "onbekend";
  if (g.bron === "code") return `uit de code (Studio ${g.versie})`;
  return `${g.versie}${g.concept ? " + concept" : ""} uit "${g.naam || g.id}"`;
}

/**
 * Gelijk genoeg om niet te waarschuwen. Code tegenover code (een andere Studio-versie) telt als
 * gelijk: dat dekken de profielversies per profiel al (types/profielVersie.js), anders zou elke
 * release een waarschuwing geven.
 */
const zelfde = (a, b) =>
  !!a && !!b && a.bron === b.bron && (a.bron === "code" || (a.id === b.id && a.versie === b.versie && !!a.concept === !!b.concept));

/**
 * Verschillen tussen wat een project noemt en wat er nu geladen is.
 * @param {any} project - de kop (met `soort` en `gebruikt`)
 * @returns {{soort: string, was: any, nu: any}[]}
 */
export function vergelijkGebruikt(project) {
  const gebruikt = project?.gebruikt;
  if (!gebruikt || typeof gebruikt !== "object") return [];
  return afhankelijkVan(soortVan(project))
    .filter((s) => gebruikt[s] && !zelfde(gebruikt[s], geladen(s)))
    .map((s) => ({ soort: s, was: gebruikt[s], nu: geladen(s) }));
}

/** De waarschuwing bij verschillen, of null. */
export function gebruiktMelding(verschillen) {
  if (!verschillen.length) return null;
  return [
    "Dit project is gemaakt met andere profielen of weergaven dan er nu geladen zijn:",
    "",
    ...verschillen.map((v) => `• ${LABEL[v.soort]}: gemaakt met ${beschrijf(v.was)}, nu ${beschrijf(v.nu)}`),
    "",
    "Het project opent gewoon; wat er anders uitziet of ontbreekt, komt door dit verschil.",
  ].join("\n");
}

/** De kop-velden voor een project dat de tool zelf maakt (weergave- of sidecar-project uit de code). */
export const kopUitDeCode = (soort) => ({ soort, versie: _toolVersie, gebruikt: noteerGebruikt(soort) });
