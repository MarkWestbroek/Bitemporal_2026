// @ts-check
/**
 * startNaam — de naam van een nieuw element, uit zijn type (M3 `ElementType`).
 *
 * "Nieuw" plus het label zonder spaties en leestekens, met het juiste Nederlandse lidwoord
 * (Mark 14-11: "het is NieuweEntiteit, niet NieuwEntiteit"): `lidwoord: "de"` → "Nieuwe…",
 * "het" of niet opgegeven → "Nieuw…". Het lidwoord is een gegeven van het profiel (M2), naast het
 * label; de vingerafdruk van een profiel kijkt er niet naar (zoals naar het label).
 *
 * @param {{label?: string, id?: string, lidwoord?: "de"|"het"}} et
 * @param {{tekens?: RegExp}} [opties] welke tekens uit het label vallen (standaard alles behalve A–Z)
 * @returns {string}
 */
export function startNaam(et, { tekens = /[^A-Za-z]/g } = {}) {
  const basis = String(et?.label || et?.id || "").replace(tekens, "");
  return `${et?.lidwoord === "de" ? "Nieuwe" : "Nieuw"}${basis}`;
}
